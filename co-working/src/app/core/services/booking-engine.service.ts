import { Injectable, computed, inject, signal } from '@angular/core';
import { AvailabilitySlot, Booking, BookingDraft, Resource, SlotLock } from '../models';
import { ClientStoreService } from './client-store.service';
import { SettingsService } from './settings.service';
import { BookingService, PaymentService, InvoiceService } from './data/transaction-data.service';
import { ResourceService, LocationService } from './data/workspace-data.service';
import { CreditTransactionService, SubscriptionService } from './data/membership-data.service';
import { RefundService, CreditNoteService } from './data/transaction-data.service';
import { MemberService } from './data/people-data.service';
import { NotificationCenterService } from './notification.service';

/** Fallback only; the slot lock length comes from Settings → Business rules (database). */
export const LOCK_MINUTES = 10;
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 21;
const LOCK_KEY = 'officera:slot-lock';

export interface BookingQuote {
  hours: number;
  units: number;
  unitLabel: string;
  subtotal: number;
  tax: number;
  total: number;
  creditsAvailable: number;
  creditsApplied: number;
  balance: number;
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);
}

/**
 * Booking rules from UC-1: real-time availability, 10-minute slot lock during checkout,
 * membership credits applied first, remaining balance paid, lock released on failure/expiry.
 */
@Injectable({ providedIn: 'root' })
export class BookingEngineService {
  private readonly db = inject(ClientStoreService);
  private readonly settings = inject(SettingsService);
  private readonly bookings = inject(BookingService);
  private readonly resources = inject(ResourceService);
  private readonly locations = inject(LocationService);
  private readonly subs = inject(SubscriptionService);
  private readonly credits = inject(CreditTransactionService);
  private readonly payments = inject(PaymentService);
  private readonly invoices = inject(InvoiceService);
  private readonly refunds = inject(RefundService);
  private readonly creditNotes = inject(CreditNoteService);
  private readonly members = inject(MemberService);
  private readonly notify = inject(NotificationCenterService);

  /** The current checkout hold (one per browser session in the mock). */
  readonly lock = signal<SlotLock | null>(this.readLock());
  readonly lockActive = computed(() => {
    const l = this.lock();
    return !!l && l.expiresAt > Date.now();
  });

  hours(start: string, end: string): number {
    return Math.max(0, (toMin(end) - toMin(start)) / 60);
  }

  /**
   * Resource ids unavailable for the window: bookings this user can see plus every member's occupied slots
   * from the server (POST /api/Booking/GetOccupancy). The API re-checks the slot when the booking is saved.
   */
  busyResourceIds(locationId: string, date: string, start: string, end: string, excludeBookingId?: string): string[] {
    const busy = new Set<string>();
    const own = this.bookings
      .items()
      .filter((b) => b.locationId === locationId && b.date === date && (b.status === 'CONFIRMED' || b.status === 'PENDING'));
    own.filter((b) => b.id !== excludeBookingId).forEach((b) => {
      if (overlaps(b.startTime, b.endTime, start, end)) busy.add(b.resourceId);
    });
    // The occupancy feed has no booking ids, so skip slots that belong to the booking being edited.
    const excluded = excludeBookingId ? this.bookings.find(excludeBookingId) : undefined;
    this.bookings
      .occupancy()
      .filter((s) => s.locationId === locationId && s.date === date)
      .filter((s) => !(excluded && s.resourceId === excluded.resourceId && s.date === excluded.date && s.startTime === excluded.startTime && s.endTime === excluded.endTime))
      .forEach((s) => {
        if (overlaps(s.startTime, s.endTime, start, end)) busy.add(s.resourceId);
      });
    return [...busy];
  }

  isAvailable(resource: Resource, date: string, start: string, end: string, excludeBookingId?: string): boolean {
    if (resource.status !== 'ACTIVE' || resource.blocked) return false;
    return !this.busyResourceIds(resource.locationId, date, start, end, excludeBookingId).includes(resource.id);
  }

  candidates(draft: BookingDraft): Resource[] {
    if (!draft.locationId || !draft.type) return [];
    return this.resources
      .byLocation(draft.locationId)
      .filter((r) => r.type === draft.type && r.capacity >= (draft.type === 'MEETING_ROOM' || draft.type === 'PRIVATE_OFFICE' ? draft.seats : 1));
  }

  /** Hourly start slots for a type/date with availability of at least one resource. */
  slots(draft: BookingDraft, duration: number): AvailabilitySlot[] {
    const res = this.candidates(draft);
    const now = new Date();
    const todayIso = now.toLocaleDateString('en-CA');
    const out: AvailabilitySlot[] = [];
    for (let h = OPEN_HOUR; h + duration <= CLOSE_HOUR; h++) {
      const start = `${String(h).padStart(2, '0')}:00`;
      const end = `${String(h + duration).padStart(2, '0')}:00`;
      const past = draft.date === todayIso && h <= now.getHours();
      const free = !past && !!draft.date && res.some((r) => this.isAvailable(r, draft.date!, start, end));
      out.push({ time: start, available: free });
    }
    return out;
  }

  quote(resource: Resource, start: string, end: string, seats: number, memberId?: string, useCredits = true): BookingQuote {
    const hours = this.hours(start, end);
    let units: number;
    let unitLabel: string;
    if (resource.priceUnit === 'hour') {
      units = hours;
      unitLabel = `${hours} hr × ${'₹' + resource.price.toLocaleString('en-IN')}`;
    } else {
      units = hours >= 6 ? 1 : 0.5;
      unitLabel = units === 1 ? `Full day × ₹${resource.price.toLocaleString('en-IN')}` : `Half day × ₹${resource.price.toLocaleString('en-IN')}`;
    }
    const seatFactor = resource.type === 'HOT_DESK' || resource.type === 'DEDICATED_DESK' ? Math.max(1, seats) : 1;
    const subtotal = Math.round(resource.price * units * seatFactor);
    const tax = Math.round(subtotal * this.settings.gstFraction());
    const total = subtotal + tax;
    const sub = memberId ? this.subs.forMember(memberId) : undefined;
    const creditsAvailable = sub && sub.status === 'ACTIVE' ? Math.max(0, sub.creditsTotal - sub.creditsUsed) : 0;
    const creditsApplied = useCredits ? Math.min(creditsAvailable, total) : 0;
    return { hours, units, unitLabel, subtotal, tax, total, creditsAvailable, creditsApplied, balance: total - creditsApplied };
  }

  // ---------------- slot lock ----------------
  acquireLock(resourceId: string, date: string, start: string, end: string): SlotLock | null {
    const res = this.resources.find(resourceId);
    if (!res || !this.isAvailable(res, date, start, end)) return null;
    const lock: SlotLock = { resourceId, date, startTime: start, endTime: end, expiresAt: Date.now() + (this.settings.settings().slotLockMinutes || LOCK_MINUTES) * 60_000 };
    this.lock.set(lock);
    this.db.write(LOCK_KEY, lock);
    return lock;
  }

  releaseLock(): void {
    this.lock.set(null);
    this.db.remove(LOCK_KEY);
  }

  /** Demo helper: fast-forward the lock to expire in a few seconds. */
  expireLockSoon(seconds = 5): void {
    const l = this.lock();
    if (!l) return;
    const next = { ...l, expiresAt: Date.now() + seconds * 1000 };
    this.lock.set(next);
    this.db.write(LOCK_KEY, next);
  }

  // ---------------- lifecycle ----------------
  /** Creates the confirmed booking after credits / payment. Consumes credits and room hours. */
  confirm(opts: {
    memberId: string;
    resourceId: string;
    date: string;
    start: string;
    end: string;
    seats: number;
    quote: BookingQuote;
    paymentId?: string;
    method?: Booking['paymentMethod'];
    notes?: string;
  }): Booking {
    const res = this.resources.find(opts.resourceId)!;
    const member = this.members.find(opts.memberId);
    const booking = this.bookings.createSync({
      memberId: opts.memberId,
      companyId: member?.companyId,
      locationId: res.locationId,
      resourceId: res.id,
      date: opts.date,
      startTime: opts.start,
      endTime: opts.end,
      seats: opts.seats,
      amount: opts.quote.total,
      creditsUsed: opts.quote.creditsApplied,
      balanceDue: opts.quote.balance,
      status: 'CONFIRMED',
      paymentStatus: opts.quote.balance === 0 ? 'NOT_REQUIRED' : 'PAID',
      paymentMethod: opts.method,
      paymentId: opts.paymentId,
      notes: opts.notes,
      createdAt: new Date().toISOString(),
    });
    if (opts.paymentId) this.payments.updateSync(opts.paymentId, { bookingId: booking.id });
    const sub = this.subs.forMember(opts.memberId);
    if (sub && opts.quote.creditsApplied > 0) {
      this.subs.updateSync(sub.id, {
        creditsUsed: sub.creditsUsed + opts.quote.creditsApplied,
        roomHoursUsed: res.type === 'MEETING_ROOM' ? Math.min(sub.roomHoursTotal, sub.roomHoursUsed + opts.quote.hours) : sub.roomHoursUsed,
      });
      this.credits.createSync({ memberId: opts.memberId, date: new Date().toISOString(), type: 'USED', amount: -opts.quote.creditsApplied, reference: booking.id, note: `${res.name} booking` });
    }
    this.releaseLock();
    this.notify.dispatch({
      event: 'Booking Confirmed',
      audience: 'MEMBER',
      memberId: opts.memberId,
      category: 'BOOKING',
      title: 'Booking confirmed',
      message: `${res.name} at ${this.locations.name(res.locationId)} on ${opts.date}, ${opts.start}–${opts.end}. A reminder will be sent 1 hour before.`,
      link: `/member/bookings/${booking.id}`,
      recipient: member?.email,
      locationId: res.locationId,
      channels: ['EMAIL', 'PUSH', 'SMS'],
    });
    return booking;
  }

  cancel(bookingId: string, reason: string): Booking {
    const b = this.bookings.find(bookingId)!;
    const updated = this.bookings.updateSync(b.id, {
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      cancelReason: reason,
      paymentStatus: b.paymentStatus === 'PAID' ? 'REFUNDED' : b.paymentStatus,
    });
    // Restore credits
    if (b.creditsUsed > 0) {
      const sub = this.subs.forMember(b.memberId);
      if (sub) this.subs.updateSync(sub.id, { creditsUsed: Math.max(0, sub.creditsUsed - b.creditsUsed) });
      this.credits.createSync({ memberId: b.memberId, date: new Date().toISOString(), type: 'REFUNDED', amount: b.creditsUsed, reference: b.id, note: 'Credits restored on cancellation' });
    }
    // Refund paid balance + credit note against the invoice
    if (b.paymentStatus === 'PAID' && b.paymentId) {
      const pay = this.payments.find(b.paymentId);
      this.payments.updateSync(b.paymentId, { status: 'REFUNDED' });
      this.refunds.createSync({ paymentId: b.paymentId, memberId: b.memberId, locationId: b.locationId, amount: b.balanceDue, reason: reason || 'Booking cancelled', status: 'REQUESTED', requestedAt: new Date().toISOString() });
      if (pay?.invoiceId) {
        const inv = this.invoices.find(pay.invoiceId);
        this.creditNotes.createSync({
          number: `OFC/CN/${String(this.creditNotes.items().length + 1).padStart(4, '0')}`,
          invoiceId: pay.invoiceId,
          memberId: b.memberId,
          locationId: b.locationId,
          amount: inv?.total ?? b.balanceDue,
          reason: 'Booking cancellation',
          date: new Date().toLocaleDateString('en-CA'),
          status: 'ISSUED',
        });
      }
    }
    this.notify.dispatch({ event: 'Booking Cancelled', audience: 'MEMBER', memberId: b.memberId, category: 'BOOKING', title: 'Booking cancelled', message: `${this.resources.name(b.resourceId)} on ${b.date} has been cancelled.${b.paymentStatus === 'PAID' ? ' Your refund has been initiated.' : ''}`, link: `/member/bookings/${b.id}`, locationId: b.locationId });
    return updated;
  }

  reschedule(bookingId: string, date: string, start: string, end: string, resourceId?: string): Booking {
    const b = this.bookings.find(bookingId)!;
    const updated = this.bookings.updateSync(b.id, { date, startTime: start, endTime: end, resourceId: resourceId ?? b.resourceId });
    this.notify.dispatch({ event: 'Booking Confirmed', audience: 'MEMBER', memberId: b.memberId, category: 'BOOKING', title: 'Booking rescheduled', message: `${this.resources.name(updated.resourceId)} moved to ${date}, ${start}–${end}.`, link: `/member/bookings/${b.id}`, locationId: b.locationId });
    return updated;
  }

  /** ICS calendar file for "Add to calendar". */
  ics(b: Booking): string {
    const res = this.resources.find(b.resourceId);
    const loc = this.locations.find(b.locationId);
    const dt = (d: string, t: string) => `${d.replace(/-/g, '')}T${t.replace(':', '')}00`;
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Officera//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${b.id}@officera.in`,
      `DTSTART:${dt(b.date, b.startTime)}`,
      `DTEND:${dt(b.date, b.endTime)}`,
      `SUMMARY:${res?.name ?? 'Officera booking'} – ${loc?.name ?? ''}`,
      `LOCATION:${loc?.address ?? ''}`,
      `DESCRIPTION:Booking ${b.id}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  downloadIcs(b: Booking): void {
    if (typeof document === 'undefined') return;
    const blob = new Blob([this.ics(b)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${b.id}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** Marks past confirmed bookings completed and stale pending ones expired. */
  sweep(): void {
    const today = new Date().toLocaleDateString('en-CA');
    this.bookings
      .items()
      .filter((b) => b.date < today && (b.status === 'CONFIRMED' || b.status === 'PENDING'))
      .forEach((b) => this.bookings.updateSync(b.id, { status: b.status === 'CONFIRMED' ? 'COMPLETED' : 'EXPIRED', paymentStatus: b.status === 'PENDING' ? 'FAILED' : b.paymentStatus }));
  }

  private readLock(): SlotLock | null {
    const l = this.db.read<SlotLock>(LOCK_KEY);
    return l && l.expiresAt > Date.now() ? l : null;
  }
}

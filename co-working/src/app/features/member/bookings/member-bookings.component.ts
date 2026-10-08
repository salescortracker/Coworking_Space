import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, todayIso } from '../../../shared';
import { Booking, SPACE_TYPE_LABELS } from '../../../core/models';
import { BookingService } from '../../../core/services/data/transaction-data.service';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { BookingEngineService } from '../../../core/services/booking-engine.service';
import { ConfirmService, ToastService } from '../../../core/services/ui.service';
import { IntegrationService } from '../../../core/services/integration.service';

@Component({
  selector: 'app-member-bookings',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="My Bookings" subtitle="Desks, offices and meeting rooms you’ve reserved." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Bookings' }]">
        <a class="btn btn-secondary" routerLink="/member/calendar"><app-icon name="calendar" [size]="16" /> Calendar view</a>
        <a class="btn btn-primary" routerLink="/member/bookings/new"><app-icon name="plus" [size]="16" /> New booking</a>
      </app-page-header>
      <app-tabs [tabs]="tabs()" [(value)]="tab" label="Booking status" />
      <div class="mt-4">
        <app-data-table
          [rows]="rows()"
          [columns]="cols"
          [status]="loader.status()"
          (retry)="loader.load()"
          [defaultSort]="{ key: 'date', dir: tab() === 'upcoming' ? 'asc' : 'desc' }"
          searchPlaceholder="Search booking ID or resource"
          [emptyTitle]="tab() === 'upcoming' ? 'No bookings found.' : 'No ' + tab() + ' bookings'"
          [emptyMessage]="tab() === 'upcoming' ? 'Book a desk or meeting room to see it here.' : ''"
          emptyIcon="calendar"
          [rowClickable]="true"
          (rowClick)="router.navigate(['/member/bookings', $event.id])"
          caption="My bookings"
        >
          <a empty-action class="btn btn-primary btn-sm" routerLink="/member/bookings/new">Book now</a>
          <ng-template appCell="resource" let-row>
            <span class="cell-primary d-block">{{ resources.name(row.resourceId) }}</span>
            <span class="cell-sub">{{ locations.shortName(row.locationId) }}</span>
          </ng-template>
          <ng-template appCell="actions" let-row>
            @if (row.status === 'CONFIRMED' || row.status === 'PENDING') {
              <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/member/bookings', row.id]" [queryParams]="{ action: 'reschedule' }" aria-label="Reschedule"><app-icon name="calendar" [size]="16" /></a>
              <button type="button" class="btn btn-ghost btn-icon btn-sm text-danger" (click)="cancel(row)" aria-label="Cancel booking"><app-icon name="x-circle" [size]="16" /></button>
            } @else {
              <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/member/bookings', row.id]" aria-label="View"><app-icon name="eye" [size]="16" /></a>
            }
          </ng-template>
        </app-data-table>
      </div>
    </div>
  `,
})
export class MemberBookingsComponent {
  protected readonly bookings = inject(BookingService);
  protected readonly resources = inject(ResourceService);
  protected readonly locations = inject(LocationService);
  private readonly acct = inject(MemberAccountService);
  private readonly engine = inject(BookingEngineService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly router = inject(Router);

  protected readonly loader = createLoader(() => this.bookings.list());
  protected readonly tab = signal('upcoming');
  private readonly mine = computed(() => this.bookings.forMember(this.acct.memberId()));
  private readonly groups = computed(() => {
    const t = todayIso();
    const m = this.mine();
    return {
      upcoming: m.filter((b) => b.date >= t && (b.status === 'CONFIRMED' || b.status === 'PENDING')),
      completed: m.filter((b) => b.status === 'COMPLETED'),
      cancelled: m.filter((b) => b.status === 'CANCELLED' || b.status === 'EXPIRED'),
      all: m,
    } as Record<string, Booking[]>;
  });
  protected readonly rows = computed(() => this.groups()[this.tab()] ?? []);
  protected readonly tabs = computed(() => [
    { id: 'upcoming', label: 'Upcoming', count: this.groups()['upcoming'].length },
    { id: 'completed', label: 'Completed', count: this.groups()['completed'].length },
    { id: 'cancelled', label: 'Cancelled', count: this.groups()['cancelled'].length },
    { id: 'all', label: 'All', count: this.groups()['all'].length },
  ]);
  protected readonly cols: Column<Booking>[] = [
    { key: 'id', label: 'Booking ID', primary: true },
    { key: 'resource', label: 'Workspace', value: (b) => this.resources.name(b.resourceId) },
    { key: 'type', label: 'Type', value: (b) => SPACE_TYPE_LABELS[this.resources.find(b.resourceId)?.type ?? 'HOT_DESK'], hideMobile: true },
    { key: 'date', label: 'Date', type: 'date', sortValue: (b) => b.date + b.startTime },
    { key: 'time', label: 'Time', value: (b) => `${b.startTime}–${b.endTime}` },
    { key: 'amount', label: 'Amount', type: 'currency', hideMobile: true },
    { key: 'paymentStatus', label: 'Payment', type: 'status', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected async cancel(b: Booking): Promise<void> {
    const reason = await this.confirm.prompt({
      title: 'Cancel this booking?',
      message: `${this.resources.name(b.resourceId)} on ${b.date}, ${b.startTime}–${b.endTime}. Credits will be restored${b.paymentStatus === 'PAID' ? ' and your payment refunded' : ''}.`,
      confirmText: 'Cancel booking',
      cancelText: 'Keep booking',
      tone: 'danger',
      input: { label: 'Reason (optional)', placeholder: 'Meeting moved…' },
    });
    if (reason === null) return;
    this.engine.cancel(b.id, reason);
    this.toast.success('Booking cancelled', b.paymentStatus === 'PAID' ? 'Your refund has been initiated.' : 'Credits restored to your account.');
  }
}

@Component({
  selector: 'app-member-booking-detail',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (booking(); as b) {
        <app-page-header [title]="'Booking ' + b.id" [subtitle]="resources.name(b.resourceId) + ' · ' + locations.name(b.locationId)" [breadcrumbs]="[{ label: 'Bookings', link: '/member/bookings' }, { label: b.id }]">
          <app-status-badge badge [status]="b.status" />
          @if (active()) {
            <app-dropdown width="240px">
              <button trigger type="button" class="btn btn-secondary"><app-icon name="calendar" [size]="16" /> Add to Calendar <app-icon name="chevron-down" [size]="14" /></button>
              @if (calendars().google; as g) {
                <button type="button" class="menu-item" (click)="syncCalendar(g)"><app-icon name="calendar" [size]="16" /> {{ g }}</button>
              }
              @if (calendars().outlook; as o) {
                <button type="button" class="menu-item" (click)="syncCalendar(o)"><app-icon name="calendar" [size]="16" /> {{ o }}</button>
              }
              <button type="button" class="menu-item" (click)="engine.downloadIcs(b)"><app-icon name="download" [size]="16" /> Download .ics file</button>
            </app-dropdown>
            <button type="button" class="btn btn-secondary" (click)="openReschedule()"><app-icon name="refresh" [size]="16" /> Reschedule</button>
            <button type="button" class="btn btn-danger" (click)="cancel()"><app-icon name="x-circle" [size]="16" /> Cancel</button>
          }
        </app-page-header>
        <div class="split">
          <section class="card">
            <div class="card-header"><h2 class="card-title">Booking details</h2></div>
            <div class="card-body">
              <div class="kv-grid">
                <div class="kv-item"><div class="k">Booking ID</div><div class="v mono">{{ b.id }}</div></div>
                <div class="kv-item"><div class="k">Workspace</div><div class="v">{{ resources.name(b.resourceId) }}</div></div>
                <div class="kv-item"><div class="k">Location</div><div class="v">{{ locations.name(b.locationId) }}</div></div>
                <div class="kv-item"><div class="k">Date</div><div class="v">{{ b.date | date: 'EEE, d MMM y' }}</div></div>
                <div class="kv-item"><div class="k">Time</div><div class="v">{{ b.startTime | time12 }} – {{ b.endTime | time12 }}</div></div>
                <div class="kv-item"><div class="k">Seats</div><div class="v">{{ b.seats }}</div></div>
                <div class="kv-item"><div class="k">Amount</div><div class="v">{{ b.amount | inr }}</div></div>
                <div class="kv-item"><div class="k">Credits used</div><div class="v">{{ b.creditsUsed | inr }}</div></div>
                <div class="kv-item"><div class="k">Paid</div><div class="v">{{ b.balanceDue | inr }}</div></div>
                <div class="kv-item"><div class="k">Payment status</div><div class="v"><app-status-badge [status]="b.paymentStatus" /></div></div>
                <div class="kv-item"><div class="k">Booking status</div><div class="v"><app-status-badge [status]="b.status" /></div></div>
                <div class="kv-item"><div class="k">Booked on</div><div class="v">{{ b.createdAt | date: 'd MMM y, h:mm a' }}</div></div>
              </div>
              @if (b.cancelReason) {
                <div class="alert alert-warning mt-4"><app-icon name="info" /><div class="alert-body">Cancelled {{ b.cancelledAt | date: 'd MMM, h:mm a' }} · {{ b.cancelReason }}</div></div>
              }
              @if (b.status === 'PENDING' && b.paymentStatus === 'PENDING') {
                <div class="alert alert-warning mt-4"><app-icon name="clock" /><div class="alert-body">Waiting for payment confirmation from your bank. We’ll confirm the booking automatically once payment succeeds.</div></div>
              }
            </div>
            <div class="card-footer">
              <span class="text-sm text-muted">{{ resource()?.cancellationRule }}</span>
              @if (b.paymentId) {
                <a routerLink="/member/payments" class="btn btn-ghost btn-sm">View payment</a>
              }
            </div>
          </section>
          <div class="stack">
            <section class="card card-body" style="display: flex; flex-direction: column; align-items: center">
              <h3 class="section-title" style="align-self: flex-start">QR / access</h3>
              <app-qr-card [value]="'OFB-' + b.id" [title]="resources.name(b.resourceId)" [subtitle]="(b.date | date: 'd MMM') + ' · ' + b.startTime + '–' + b.endTime" caption="Booking pass" [active]="active()" inactiveText="Not valid" [size]="150" />
              <p class="text-xs text-muted text-center mt-3 mb-0">Show this at reception or scan at the turnstile during your booking window.</p>
            </section>
          </div>
        </div>
      } @else {
        <div class="card"><app-empty-state icon="calendar" title="Booking not found"><a class="btn btn-secondary" routerLink="/member/bookings">Back to bookings</a></app-empty-state></div>
      }
    </div>

    <app-modal [open]="rescheduleOpen()" title="Reschedule booking" subtitle="Pick a new date and start time. The duration stays the same." (closed)="rescheduleOpen.set(false)">
      <app-date-strip [value]="newDate()" (pick)="newDate.set($event); newStart.set(null)" />
      <span class="label d-block mt-4 mb-2">Start time</span>
      <app-time-slots [slots]="rescheduleSlots()" [value]="newStart()" (pick)="newStart.set($event)" />
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="rescheduleOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="!newStart()" (click)="reschedule()">Confirm new time</button>
      </div>
    </app-modal>
  `,
})
export class MemberBookingDetailComponent {
  readonly id = input.required<string>();
  readonly action = input<string>();
  private readonly bookings = inject(BookingService);
  protected readonly resources = inject(ResourceService);
  protected readonly locations = inject(LocationService);
  protected readonly engine = inject(BookingEngineService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly booking = computed(() => this.bookings.find(this.id()));
  protected readonly resource = computed(() => this.resources.find(this.booking()?.resourceId));
  protected readonly active = computed(() => {
    const b = this.booking();
    return !!b && (b.status === 'CONFIRMED' || b.status === 'PENDING') && b.date >= todayIso();
  });
  private readonly integrations = inject(IntegrationService);
  /** Calendar providers enabled in Configuration / Integrations. */
  protected readonly calendars = computed(() => ({
    google: this.integrations.isAvailable('GOOGLE_CALENDAR') ? 'Google Calendar' : null,
    outlook: this.integrations.isAvailable('OUTLOOK_CALENDAR') ? 'Outlook Calendar' : null,
  }));
  protected readonly rescheduleOpen = signal(false);
  protected readonly newDate = signal(todayIso());
  protected readonly newStart = signal<string | null>(null);
  private readonly hours = computed(() => {
    const b = this.booking();
    return b ? this.engine.hours(b.startTime, b.endTime) : 1;
  });
  protected readonly rescheduleSlots = computed(() => {
    const b = this.booking();
    const r = this.resource();
    if (!b || !r) return [];
    const now = new Date();
    const out = [];
    for (let h = 8; h + this.hours() <= 21; h++) {
      const start = `${String(h).padStart(2, '0')}:00`;
      const end = `${String(h + this.hours()).padStart(2, '0')}:00`;
      const past = this.newDate() === todayIso() && h <= now.getHours();
      out.push({ time: start, available: !past && this.engine.isAvailable(r, this.newDate(), start, end, b.id) });
    }
    return out;
  });

  constructor() {
    queueMicrotask(() => {
      if (this.action() === 'reschedule' && this.active()) this.openReschedule();
    });
  }

  /** Mock: production calls POST /api/bookings/{id}/calendar-sync with the member's OAuth grant. */
  protected syncCalendar(name: string): void {
    this.toast.success(`Added to ${name}`, 'The event will update automatically if you reschedule or cancel.');
  }

  protected openReschedule(): void {
    this.newDate.set(this.booking()?.date ?? todayIso());
    this.newStart.set(null);
    this.rescheduleOpen.set(true);
  }

  protected reschedule(): void {
    const b = this.booking();
    const start = this.newStart();
    if (!b || !start) return;
    const end = `${String(Number(start.slice(0, 2)) + this.hours()).padStart(2, '0')}:00`;
    this.engine.reschedule(b.id, this.newDate(), start, end);
    this.rescheduleOpen.set(false);
    this.toast.success('Booking rescheduled', `${this.newDate()} · ${start}–${end}`);
  }

  protected async cancel(): Promise<void> {
    const b = this.booking();
    if (!b) return;
    const reason = await this.confirm.prompt({
      title: 'Cancel this booking?',
      message: `Credits will be restored${b.paymentStatus === 'PAID' ? ' and the paid amount refunded to your original payment method' : ''}.`,
      confirmText: 'Cancel booking',
      cancelText: 'Keep booking',
      tone: 'danger',
      input: { label: 'Reason (optional)' },
    });
    if (reason === null) return;
    this.engine.cancel(b.id, reason);
    this.toast.success('Booking cancelled');
  }
}

import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Booking, CreditNote, Invoice, Payment, Refund } from '../../models';
import { ApiCollection } from '../api-collection';

/** Occupied slot from POST /api/Booking/GetOccupancy (no member details). */
export interface OccupiedSlot {
  resourceId: string;
  locationId: string;
  date: string;
  startTime: string;
  endTime: string;
}

@Injectable({ providedIn: 'root' })
export class BookingService extends ApiCollection<Booking> {
  /**
   * Every member's occupied slots (from the server), so availability reflects other members' bookings
   * even though a member can only read their own booking records.
   */
  readonly occupancy = signal<OccupiedSlot[]>([]);

  constructor() {
    super('Booking', 'BKG', (b) => b.locationId);
  }

  override async load(): Promise<void> {
    await Promise.all([super.load(), this.loadOccupancy()]);
  }

  override reset(): void {
    super.reset();
    this.occupancy.set([]);
  }

  async loadOccupancy(): Promise<void> {
    try {
      this.occupancy.set(await firstValueFrom(this.api.post<OccupiedSlot[]>('Booking/GetOccupancy', {}, { spinner: 'none' })));
    } catch {
      this.occupancy.set([]);
    }
  }

  forMember(memberId: string | undefined): Booking[] {
    return this.items().filter((b) => b.memberId === memberId);
  }
}

@Injectable({ providedIn: 'root' })
export class PaymentService extends ApiCollection<Payment> {
  constructor() {
    super('Payment', 'PAY', (p) => p.locationId);
  }

  forMember(memberId: string | undefined): Payment[] {
    return this.items()
      .filter((p) => p.memberId === memberId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}

@Injectable({ providedIn: 'root' })
export class InvoiceService extends ApiCollection<Invoice> {
  constructor() {
    super('Invoice', 'INV', (i) => i.locationId);
  }

  forMember(memberId: string | undefined): Invoice[] {
    return this.items()
      .filter((i) => i.memberId === memberId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}

@Injectable({ providedIn: 'root' })
export class RefundService extends ApiCollection<Refund> {
  constructor() {
    super('Refund', 'RFD', (r) => r.locationId);
  }
}

@Injectable({ providedIn: 'root' })
export class CreditNoteService extends ApiCollection<CreditNote> {
  constructor() {
    super('CreditNote', 'CN', (c) => c.locationId);
  }
}

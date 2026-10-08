import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { SupplierInfo } from '../models';
import { ApiService } from './api.service';

export interface OrgSettings {
  supplier: SupplierInfo;
  gstRate: number;
  slotLockMinutes: number;
  freeCancellationHours: number;
  ticketEscalationHours: number;
  paymentRetryDays: number[];
  gracePeriodDays: number;
  bookingReminderMinutes: number;
  renewalReminderDays: number;
  maxLoginAttempts: number;
  lockoutMinutes: number;
  currency: string;
  timezone: string;
}

/** Placeholder until the settings arrive from the API (they are loaded before the first screen renders). */
const NOT_LOADED: OrgSettings = {
  supplier: { legalName: '', gstin: '', address: '', state: '', stateCode: '', pan: '', email: '', phone: '' },
  gstRate: 0,
  slotLockMinutes: 0,
  freeCancellationHours: 0,
  ticketEscalationHours: 0,
  paymentRetryDays: [],
  gracePeriodDays: 0,
  bookingReminderMinutes: 0,
  renewalReminderDays: 0,
  maxLoginAttempts: 0,
  lockoutMinutes: 0,
  currency: 'INR',
  timezone: 'Asia/Kolkata',
};

/** Organisation-wide configuration (business rules from the FRD), stored in the database (POST /api/Configuration/Get | Update). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);
  readonly settings = signal<OrgSettings>(NOT_LOADED);

  /** GST rate as a fraction (18 → 0.18). */
  readonly gstFraction = computed(() => this.settings().gstRate / 100);

  async load(): Promise<void> {
    try {
      this.settings.set(await firstValueFrom(this.api.post<OrgSettings>('Configuration/Get', {}, { spinner: 'background' })));
    } catch {
      /* keep the current values */
    }
  }

  save(value: OrgSettings): Observable<OrgSettings> {
    return this.api.post<OrgSettings>('Configuration/Update', value, { spinner: 'blocking', message: 'Saving…' }).pipe(tap((s) => this.settings.set(s)));
  }

  /** Current saved values (used by "reset form"). */
  defaults(): OrgSettings {
    return structuredClone(this.settings());
  }
}

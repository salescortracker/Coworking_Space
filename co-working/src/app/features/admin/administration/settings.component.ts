import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SHARED, emailValidator, gstinValidator } from '../../../shared';
import { SettingsService } from '../../../core/services/settings.service';
import { ClientStoreService } from '../../../core/services/client-store.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-settings',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header title="Settings" subtitle="Organisation, billing and business rules." [breadcrumbs]="[{ label: 'Administration' }, { label: 'Settings' }]" />
      <app-tabs [tabs]="tabs" [(value)]="tab" label="Settings sections" />
      <div class="mt-5">
        @switch (tab()) {
          @case ('org') {
            <form [formGroup]="org" (ngSubmit)="saveOrg()" class="card card-body" novalidate>
              <h2 class="form-section-title">GST registration</h2>
              <p class="form-section-desc">Printed on every invoice. CGST + SGST applies when the customer is in the same state, IGST otherwise.</p>
              <div class="form-grid">
                <div class="field span-2">
                  <label class="label" for="ln">Legal name <span class="req">*</span></label>
                  <input id="ln" class="input" formControlName="legalName" />
                  <app-field-error [control]="org.controls.legalName" label="Legal name" />
                </div>
                <div class="field">
                  <label class="label" for="gst">GSTIN <span class="req">*</span></label>
                  <input id="gst" class="input" formControlName="gstin" />
                  <app-field-error [control]="org.controls.gstin" label="GSTIN" />
                </div>
                <div class="field">
                  <label class="label" for="pan">PAN <span class="req">*</span></label>
                  <input id="pan" class="input" formControlName="pan" />
                </div>
                <div class="field span-2">
                  <label class="label" for="ad">Registered address <span class="req">*</span></label>
                  <textarea id="ad" class="textarea" rows="2" formControlName="address"></textarea>
                </div>
                <div class="field">
                  <label class="label" for="st">State <span class="req">*</span></label>
                  <input id="st" class="input" formControlName="state" />
                </div>
                <div class="field">
                  <label class="label" for="sc">State code <span class="req">*</span></label>
                  <input id="sc" class="input" formControlName="stateCode" maxlength="2" />
                </div>
                <div class="field">
                  <label class="label" for="be">Billing email <span class="req">*</span></label>
                  <input id="be" class="input" formControlName="email" />
                  <app-field-error [control]="org.controls.email" label="Email" />
                </div>
                <div class="field">
                  <label class="label" for="bp">Billing phone</label>
                  <input id="bp" class="input" formControlName="phone" />
                </div>
              </div>
              <div class="form-actions"><button type="submit" class="btn btn-primary" [disabled]="org.invalid || !auth.can('settings.edit')">Save organisation</button></div>
            </form>
          }
          @case ('rules') {
            <form [formGroup]="rules" (ngSubmit)="saveRules()" class="card card-body" novalidate>
              <h2 class="form-section-title">Business rules</h2>
              <p class="form-section-desc">Values from the FRD. They drive booking locks, escalations, retries and lockouts across the app.</p>
              <div class="form-grid">
                <div class="field"><label class="label" for="r1">GST rate (%)</label><input id="r1" class="input" type="number" formControlName="gstRate" /></div>
                <div class="field"><label class="label" for="r2">Booking slot lock (minutes)</label><input id="r2" class="input" type="number" formControlName="slotLockMinutes" /></div>
                <div class="field"><label class="label" for="r3">Free cancellation window (hours)</label><input id="r3" class="input" type="number" formControlName="freeCancellationHours" /></div>
                <div class="field"><label class="label" for="r4">Ticket auto-escalation (hours)</label><input id="r4" class="input" type="number" formControlName="ticketEscalationHours" /></div>
                <div class="field"><label class="label" for="r5">Payment retry schedule (days)</label><input id="r5" class="input" formControlName="paymentRetryDays" /><span class="field-hint">Comma separated, e.g. 1, 3, 7</span></div>
                <div class="field"><label class="label" for="r6">Grace period before suspension (days)</label><input id="r6" class="input" type="number" formControlName="gracePeriodDays" /></div>
                <div class="field"><label class="label" for="r7">Booking reminder (minutes before)</label><input id="r7" class="input" type="number" formControlName="bookingReminderMinutes" /></div>
                <div class="field"><label class="label" for="r8">Renewal reminder (days before)</label><input id="r8" class="input" type="number" formControlName="renewalReminderDays" /></div>
                <div class="field"><label class="label" for="r9">Max failed logins</label><input id="r9" class="input" type="number" formControlName="maxLoginAttempts" /></div>
                <div class="field"><label class="label" for="r10">Lockout duration (minutes)</label><input id="r10" class="input" type="number" formControlName="lockoutMinutes" /></div>
              </div>
              <div class="form-actions"><button type="submit" class="btn btn-primary" [disabled]="rules.invalid || !auth.can('settings.edit')">Save rules</button></div>
            </form>
          }
          @case ('demo') {
            <section class="card card-body stack">
              <div class="alert alert-info">
                <app-icon name="info" />
                <div class="alert-body">These developer controls only affect this browser so reviewers can see loading and error states. Data always comes from the Officera API.</div>
              </div>
              <div class="field">
                <label class="label" for="lat">Simulated network latency: {{ db.latency() }} ms</label>
                <input id="lat" type="range" min="0" max="2000" step="50" [value]="db.latency()" (input)="db.updateSettings({ latency: +$any($event.target).value })" />
              </div>
              <label class="switch">
                <input type="checkbox" [checked]="db.simulateErrors()" (change)="db.updateSettings({ simulateErrors: $any($event.target).checked })" />
                <span class="track"></span>
                <span>Simulate API errors on list pages (shows error states with retry)</span>
              </label>
              <hr />
              <div class="row-between row-wrap">
                <div>
                  <div class="fw-600">Reset demo data</div>
                  <div class="text-sm text-muted">Clears what this browser has stored (session, selections) and signs you out. Data in the database is not changed.</div>
                </div>
                <button type="button" class="btn btn-danger" (click)="reset()"><app-icon name="refresh" [size]="16" /> Reset data</button>
              </div>
            </section>
          }
        }
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly settings = inject(SettingsService);
  protected readonly db = inject(ClientStoreService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly audit = inject(AuditService);

  protected readonly tab = signal('org');
  protected readonly tabs = [
    { id: 'org', label: 'Organisation', icon: 'building' },
    { id: 'rules', label: 'Business rules', icon: 'sliders' },
    { id: 'demo', label: 'Demo controls', icon: 'zap' },
  ];

  private readonly s = this.settings.settings();
  protected readonly org = this.fb.nonNullable.group({
    legalName: [this.s.supplier.legalName, Validators.required],
    gstin: [this.s.supplier.gstin, [Validators.required, gstinValidator]],
    pan: [this.s.supplier.pan, Validators.required],
    address: [this.s.supplier.address, Validators.required],
    state: [this.s.supplier.state, Validators.required],
    stateCode: [this.s.supplier.stateCode, [Validators.required, Validators.pattern(/^\d{2}$/)]],
    email: [this.s.supplier.email, [Validators.required, emailValidator]],
    phone: [this.s.supplier.phone],
  });
  protected readonly rules = this.fb.nonNullable.group({
    gstRate: [this.s.gstRate, [Validators.required, Validators.min(0), Validators.max(28)]],
    slotLockMinutes: [this.s.slotLockMinutes, [Validators.required, Validators.min(1)]],
    freeCancellationHours: [this.s.freeCancellationHours, [Validators.required, Validators.min(0)]],
    ticketEscalationHours: [this.s.ticketEscalationHours, [Validators.required, Validators.min(1)]],
    paymentRetryDays: [this.s.paymentRetryDays.join(', '), [Validators.required, Validators.pattern(/^\s*\d+(\s*,\s*\d+)*\s*$/)]],
    gracePeriodDays: [this.s.gracePeriodDays, [Validators.required, Validators.min(0)]],
    bookingReminderMinutes: [this.s.bookingReminderMinutes, [Validators.required, Validators.min(5)]],
    renewalReminderDays: [this.s.renewalReminderDays, [Validators.required, Validators.min(1)]],
    maxLoginAttempts: [this.s.maxLoginAttempts, [Validators.required, Validators.min(1)]],
    lockoutMinutes: [this.s.lockoutMinutes, [Validators.required, Validators.min(1)]],
  });

  protected saveOrg(): void {
    if (this.org.invalid) return this.org.markAllAsTouched();
    const cur = this.settings.settings();
    this.settings.save({ ...cur, supplier: { ...cur.supplier, ...this.org.getRawValue() } }).subscribe(() => {
      this.audit.record('UPDATE', 'Administration', 'Settings', 'ORG', 'Updated organisation GST details');
      this.toast.success('Organisation saved');
    });
  }

  protected saveRules(): void {
    if (this.rules.invalid) return this.rules.markAllAsTouched();
    const v = this.rules.getRawValue();
    this.settings
      .save({ ...this.settings.settings(), ...v, paymentRetryDays: v.paymentRetryDays.split(',').map((x) => Number(x.trim())) })
      .subscribe(() => {
        this.audit.record('UPDATE', 'Administration', 'Settings', 'RULES', 'Updated business rules');
        this.toast.success('Business rules saved');
      });
  }

  protected async reset(): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Reset this browser?', message: 'Your session and saved selections in this browser will be cleared and you will be signed out. Data in the database is not changed.', confirmText: 'Reset data', tone: 'danger' });
    if (!ok) return;
    this.db.resetAll();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED, gstinValidator } from '../../shared';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/ui.service';
import { CompanyService, MemberService } from '../../core/services/data/people-data.service';
import { LocationService } from '../../core/services/data/workspace-data.service';
import { LookupService } from '../../core/services/lookup.service';

/** Flow 4: Create account → Complete profile (name, photo, company, GST) → Member dashboard. */
@Component({
  selector: 'app-complete-profile',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="auth-title">Complete your profile</h1>
    <p class="auth-sub">Add your work details so invoices carry your company and GST number.</p>
    <div class="auth-panel">
      <div class="stepper mb-4" aria-label="Registration progress">
        <span class="step done"><span class="num"><app-icon name="check" [size]="12" /></span>Account</span>
        <span class="step-sep"></span>
        <span class="step done"><span class="num"><app-icon name="check" [size]="12" /></span>OTP verified</span>
        <span class="step-sep"></span>
        <span class="step active"><span class="num">3</span>Profile</span>
      </div>
      <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <div class="row">
          <app-avatar [name]="auth.user()?.name ?? 'You'" [size]="56" />
          <div class="flex-1">
            <div class="label mb-2">Profile photo</div>
            <app-file-upload accept="image/*" category="profiles" [multiple]="false" hint="JPG or PNG, square works best" (filesChange)="photo.set($event[0]?.url ?? '')" />
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label class="label" for="ds">Designation</label>
            <input id="ds" class="input" formControlName="designation" placeholder="e.g. Product Manager" />
          </div>
          <div class="field">
            <label class="label" for="hl">Home location <span class="req">*</span></label>
            <select id="hl" class="select" formControlName="locationId">
              @for (l of locations.active(); track l.id) {
                <option [value]="l.id">{{ l.name }} · {{ l.city }}</option>
              }
            </select>
          </div>
        </div>
        <label class="check"><input type="checkbox" formControlName="isCompany" /> I’m joining on behalf of a company</label>
        @if (form.controls.isCompany.value) {
          <div class="form-grid">
            <div class="field span-2">
              <label class="label" for="cn">Company name <span class="req">*</span></label>
              <input id="cn" class="input" formControlName="companyName" />
              <app-field-error [control]="form.controls.companyName" label="Company name" />
            </div>
            <div class="field">
              <label class="label" for="gst">GST number</label>
              <input id="gst" class="input" formControlName="gstin" placeholder="36AABCN1234A1Z5" style="text-transform: uppercase" />
              <app-field-error [control]="form.controls.gstin" label="GST number" />
            </div>
            <div class="field">
              <label class="label" for="st">State <span class="req">*</span></label>
              <select id="st" class="select" formControlName="state">
                @for (s of states; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </div>
            <div class="field span-2">
              <label class="label" for="ba">Billing address <span class="req">*</span></label>
              <textarea id="ba" class="textarea" rows="2" formControlName="billingAddress"></textarea>
              <app-field-error [control]="form.controls.billingAddress" label="Billing address" />
            </div>
          </div>
        }
        <div class="row-sm">
          <button type="button" class="btn btn-ghost" (click)="skip()">Skip for now</button>
          <button type="submit" class="btn btn-primary flex-1" [disabled]="form.invalid || busy()" [appBusy]="busy()" busyText="Saving…">
            Save & go to dashboard
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CompleteProfileComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  protected readonly locations = inject(LocationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly photo = signal('');
  private readonly lookup = inject(LookupService);
  /** States from POST /api/Lookup/GetStates. */
  protected get states(): string[] {
    return this.lookup.stateNames();
  }

  protected readonly form = this.fb.nonNullable.group({
    designation: [''],
    locationId: ['', Validators.required],
    isCompany: [false],
    companyName: [''],
    gstin: ['', gstinValidator],
    state: [''],
    billingAddress: [''],
  });

  constructor() {
    this.form.controls.isCompany.valueChanges.subscribe((on) => {
      const c = this.form.controls;
      [c.companyName, c.billingAddress].forEach((ctrl) => {
        ctrl.setValidators(on ? [Validators.required] : []);
        ctrl.updateValueAndValidity();
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const memberId = this.auth.user()?.memberId;
    if (!memberId) return;
    const v = this.form.getRawValue();
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    let companyId: string | undefined;
    if (v.isCompany) {
      companyId = this.companies.createSync({
        name: v.companyName.trim(),
        gstin: v.gstin.toUpperCase(),
        billingAddress: v.billingAddress,
        state: v.state,
        industry: '',
        size: '1–10',
        website: '',
        locationId: v.locationId,
        primaryContactId: memberId,
      }).id;
    }
    this.members.update(memberId, { designation: v.designation, locationId: v.locationId, companyId, photo: this.photo() || undefined, profileCompleted: true }).subscribe(() => {
      this.busy.set(false);
      this.toast.success('Profile saved', 'Pick a membership plan to activate access and credits.');
      this.router.navigateByUrl('/member/dashboard');
    });
  }

  protected skip(): void {
    this.router.navigateByUrl('/member/dashboard');
  }
}

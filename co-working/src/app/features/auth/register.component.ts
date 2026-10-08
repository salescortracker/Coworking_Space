import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED, emailValidator, matchValidator, mobileValidator, passwordValidator } from '../../shared';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/ui.service';
import { UserService } from '../../core/services/data/people-data.service';

@Component({
  selector: 'app-register',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="auth-title">Create your account</h1>
    <p class="auth-sub">Join Officera to book workspaces, manage your membership and invite guests.</p>
    <div class="auth-panel">
      @if (error()) {
        <div class="alert alert-danger mb-4" role="alert">
          <app-icon name="alert" />
          <div class="alert-body">{{ error() }} <a routerLink="/login">Sign in</a></div>
        </div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
        <div class="form-grid">
          <div class="field">
            <label class="label" for="fn">First name <span class="req">*</span></label>
            <input id="fn" class="input" formControlName="firstName" autocomplete="given-name" />
            <app-field-error [control]="form.controls.firstName" label="First name" />
          </div>
          <div class="field">
            <label class="label" for="ln">Last name <span class="req">*</span></label>
            <input id="ln" class="input" formControlName="lastName" autocomplete="family-name" />
            <app-field-error [control]="form.controls.lastName" label="Last name" />
          </div>
        </div>
        <div class="field">
          <label class="label" for="em">Work email <span class="req">*</span></label>
          <input id="em" class="input" type="email" formControlName="email" autocomplete="email" placeholder="you@company.com" />
          <app-field-error [control]="form.controls.email" label="Email" />
        </div>
        <div class="field">
          <label class="label" for="mb">Mobile number <span class="req">*</span></label>
          <div class="input-group">
            <span class="addon">+91</span>
            <input id="mb" class="input" inputmode="numeric" maxlength="10" formControlName="mobile" autocomplete="tel-national" />
          </div>
          <span class="field-hint">We’ll send a one-time code to verify this number.</span>
          <app-field-error [control]="form.controls.mobile" label="Mobile number" />
        </div>
        <div class="form-grid">
          <div class="field">
            <label class="label" for="pw">Password <span class="req">*</span></label>
            <input id="pw" class="input" type="password" formControlName="password" autocomplete="new-password" />
            <app-field-error [control]="form.controls.password" label="Password" />
          </div>
          <div class="field">
            <label class="label" for="cpw">Confirm password <span class="req">*</span></label>
            <input id="cpw" class="input" type="password" formControlName="confirmPassword" autocomplete="new-password" />
            <app-field-error [control]="form.controls.confirmPassword" label="Confirm password" [groupErrors]="form.errors?.['mismatch'] ? { mismatch: true } : null" />
          </div>
        </div>
        <div class="pw-meter">
          @for (r of rules; track r.label) {
            <span class="text-xs" [class.text-success]="r.test(form.controls.password.value)" [class.text-muted]="!r.test(form.controls.password.value)">
              <app-icon [name]="r.test(form.controls.password.value) ? 'check-circle' : 'x-circle'" [size]="12" /> {{ r.label }}
            </span>
          }
        </div>
        <label class="check">
          <input type="checkbox" formControlName="terms" />
          <span>I agree to the <a routerLink="/about" fragment="terms">Terms of Service</a> and <a routerLink="/about" fragment="privacy">Privacy Policy</a>.</span>
        </label>
        <app-field-error [control]="form.controls.terms" label="Terms" />
        <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="form.invalid || busy()" [appBusy]="busy()" busyText="Please wait…">
            Continue
          </button>
      </form>
      <p class="text-center text-sm mt-4 mb-0">Already have an account? <a routerLink="/login">Sign in</a></p>
    </div>
  `,
  styles: `.pw-meter { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: -6px; } .pw-meter span { display: inline-flex; align-items: center; gap: 4px; }`,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly rules = [
    { label: '8+ characters', test: (v: string) => v.length >= 8 },
    { label: 'Upper & lower case', test: (v: string) => /[A-Z]/.test(v) && /[a-z]/.test(v) },
    { label: 'A number', test: (v: string) => /\d/.test(v) },
    { label: 'A symbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
  ];

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(40)]],
      lastName: ['', [Validators.required, Validators.maxLength(40)]],
      email: ['', [Validators.required, emailValidator]],
      mobile: ['', [Validators.required, mobileValidator]],
      password: ['', [Validators.required, passwordValidator]],
      confirmPassword: ['', Validators.required],
      terms: [false, Validators.requiredTrue],
    },
    { validators: matchValidator('password', 'confirmPassword') },
  );

  protected submit(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.users.items().some((u) => u.email.toLowerCase() === v.email.toLowerCase())) {
      this.error.set('An account with this email already exists.');
      return;
    }
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    this.auth.pendingRegistration.set({ firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim(), mobile: v.mobile, password: v.password });
    this.auth.sendOtp(v.mobile).subscribe(({ sentTo }) => {
      this.busy.set(false);
      this.auth.otpDestination.set(sentTo);
      this.toast.info('Verify your mobile', `We sent a 6-digit code to ${sentTo}.`);
      this.router.navigate(['/verify-otp'], { queryParams: { purpose: 'register' } });
    });
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED, emailValidator, matchValidator, passwordValidator } from '../../shared';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/ui.service';

@Component({
  selector: 'app-forgot-password',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="auth-title">Forgot your password?</h1>
    <p class="auth-sub">Enter the email linked to your account. We’ll send a verification code to your registered mobile.</p>
    <div class="auth-panel">
      <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
        <div class="field">
          <label class="label" for="fe">Email <span class="req">*</span></label>
          <input id="fe" class="input" type="email" formControlName="email" autocomplete="email" />
          <app-field-error [control]="form.controls.email" label="Email" />
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="form.invalid || busy()" [appBusy]="busy()" busyText="Sending code…">
            Send verification code
          </button>
        <a routerLink="/login" class="btn btn-ghost btn-block"><app-icon name="arrow-left" [size]="16" /> Back to sign in</a>
      </form>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, emailValidator]] });

  protected submit(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    const email = this.form.controls.email.value;
    this.auth.requestPasswordReset(email).subscribe(({ sentTo }) => {
      this.busy.set(false);
      this.auth.pendingResetEmail.set(email);
      this.auth.otpDestination.set(sentTo);
      this.toast.info('Code sent', `If an account exists, a code was sent to ${sentTo}.`);
      this.router.navigate(['/verify-otp'], { queryParams: { purpose: 'reset' } });
    });
  }
}

@Component({
  selector: 'app-reset-password',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (done()) {
      <div class="auth-panel">
        <app-success-state title="Password updated" message="Your password has been reset and any account lock has been cleared. You can now sign in with your new password.">
          <a routerLink="/login" class="btn btn-primary">Go to sign in</a>
        </app-success-state>
      </div>
    } @else {
      <h1 class="auth-title">Set a new password</h1>
      <p class="auth-sub">For {{ auth.pendingResetEmail() ?? 'your account' }}.</p>
      <div class="auth-panel">
        @if (!auth.pendingResetEmail()) {
          <div class="alert alert-warning mb-4">
            <app-icon name="alert" />
            <div class="alert-body">Please verify your identity first. <a routerLink="/forgot-password">Start password reset</a></div>
          </div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
          <div class="field">
            <label class="label" for="np">New password <span class="req">*</span></label>
            <input id="np" class="input" type="password" formControlName="password" autocomplete="new-password" />
            <app-field-error [control]="form.controls.password" label="Password" />
          </div>
          <div class="field">
            <label class="label" for="ncp">Confirm new password <span class="req">*</span></label>
            <input id="ncp" class="input" type="password" formControlName="confirmPassword" autocomplete="new-password" />
            <app-field-error [control]="form.controls.confirmPassword" label="Confirm password" [groupErrors]="form.errors?.['mismatch'] ? { mismatch: true } : null" />
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="form.invalid || busy() || !auth.pendingResetEmail()" [appBusy]="busy()" busyText="Updating…">
            Update password
          </button>
        </form>
      </div>
    }
  `,
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly form = this.fb.nonNullable.group(
    { password: ['', [Validators.required, passwordValidator]], confirmPassword: ['', Validators.required] },
    { validators: matchValidator('password', 'confirmPassword') },
  );

  protected submit(): void {
    const email = this.auth.pendingResetEmail();
    if (this.form.invalid || !email) return this.form.markAllAsTouched();
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    this.auth.resetPassword(email, this.form.controls.password.value).subscribe(() => {
      this.busy.set(false);
      this.auth.pendingResetEmail.set(null);
      this.done.set(true);
      this.toast.success('Password updated');
    });
  }
}

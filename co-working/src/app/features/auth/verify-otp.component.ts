import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED } from '../../shared';
import { AuthError, AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/ui.service';

/** OTP step shared by registration and password reset (flow 4: OTP verified? → retry / continue). */
@Component({
  selector: 'app-verify-otp',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="auth-title">Verify your mobile</h1>
    <p class="auth-sub">
      Enter the 6-digit code we sent to <strong>{{ auth.otpDestination() || 'your mobile' }}</strong>.
    </p>
    <div class="auth-panel stack">
      @if (missingContext()) {
        <div class="alert alert-warning">
          <app-icon name="alert" />
          <div class="alert-body">
            <div class="alert-title">Your session expired</div>
            Please start again so we can send you a fresh code.
            <div class="alert-actions">
              <a class="btn btn-secondary btn-sm" [routerLink]="purpose() === 'reset' ? '/forgot-password' : '/register'">Start again</a>
            </div>
          </div>
        </div>
      } @else {
        @if (error()) {
          <div class="alert alert-danger" role="alert">
            <app-icon name="alert" />
            <div class="alert-body">{{ error() }} @if (attempts() > 0) {<span>({{ attempts() }} failed attempt{{ attempts() > 1 ? 's' : '' }})</span>}</div>
          </div>
        }
        <app-otp-input [formControl]="code" [invalid]="!!error()" (completed)="verify()" label="Verification code" />
        <div class="row-between text-sm">
          <span class="field-hint">@if (demoOtp()) {Demo code: <code>{{ demoOtp() }}</code>}</span>
          @if (resendIn() > 0) {
            <span class="text-muted">Resend in {{ resendIn() }}s</span>
          } @else {
            <button type="button" class="btn btn-link text-sm" (click)="resend()">Resend code</button>
          }
        </div>
        <button type="button" class="btn btn-primary btn-lg btn-block" [disabled]="code.value?.length !== 6 || busy()" (click)="verify()" [appBusy]="busy()" busyText="Verifying…">
            {{ purpose() === 'reset' ? 'Verify & continue' : 'Verify & create account' }}
          </button>
        <a class="btn btn-ghost btn-block" [routerLink]="purpose() === 'reset' ? '/forgot-password' : '/register'">
          <app-icon name="arrow-left" [size]="16" /> {{ purpose() === 'reset' ? 'Use a different email' : 'Edit details' }}
        </a>
      }
    </div>
  `,
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly purpose = input<'register' | 'reset'>('register');
  protected readonly demoOtp = this.auth.devOtp;
  protected readonly code = new FormControl('', { nonNullable: true });
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly attempts = signal(0);
  protected readonly resendIn = signal(30);
  private timer?: ReturnType<typeof setInterval>;

  protected readonly missingContext = computed(() =>
    this.purpose() === 'reset' ? !this.auth.pendingResetEmail() : !this.auth.pendingRegistration(),
  );

  ngOnInit(): void {
    this.tick();
  }

  protected verify(): void {
    if (this.code.value.length !== 6 || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.auth.verifyOtp(this.code.value).subscribe({
      next: () => (this.purpose() === 'reset' ? this.afterReset() : this.afterRegister()),
      error: (e: AuthError) => {
        this.busy.set(false);
        this.attempts.update((a) => a + 1);
        this.error.set(e.message);
        this.code.setValue('');
      },
    });
  }

  private afterRegister(): void {
    const pending = this.auth.pendingRegistration();
    if (!pending) return;
    this.auth.register(pending).subscribe({
      next: () => {
        this.auth.pendingRegistration.set(null);
        this.toast.success('Account created', 'Your mobile number is verified. Let’s complete your profile.');
        this.router.navigateByUrl('/complete-profile');
      },
      error: (e: AuthError) => {
        this.busy.set(false);
        this.error.set(e.message);
      },
    });
  }

  private afterReset(): void {
    this.busy.set(false);
    this.router.navigateByUrl('/reset-password');
  }

  protected resend(): void {
    this.auth.resendOtp().subscribe(({ sentTo }) => {
      this.toast.info('Code re-sent', `A new code was sent to ${sentTo}.`);
      this.tick();
    });
  }

  private tick(): void {
    clearInterval(this.timer);
    this.resendIn.set(30);
    this.timer = setInterval(() => {
      this.resendIn.update((s) => Math.max(0, s - 1));
      if (this.resendIn() === 0) clearInterval(this.timer);
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}

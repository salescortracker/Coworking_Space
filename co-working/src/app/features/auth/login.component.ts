import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED, emailValidator, mobileValidator } from '../../shared';
import { AuthError, AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/ui.service';
import { DemoAccount, ROLE_LABELS, User } from '../../core/models';
import { IntegrationService } from '../../core/services/integration.service';

@Component({
  selector: 'app-login',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="auth-title">Welcome back</h1>
    <p class="auth-sub">Sign in to manage your workspace, bookings and payments.</p>

    <div class="auth-panel">
      <app-tabs [tabs]="tabs" [(value)]="mode" label="Sign-in method" />

      @if (error(); as e) {
        <div class="alert mt-4" [class.alert-danger]="e.code !== 'LOCKED'" [class.alert-warning]="e.code === 'LOCKED'" role="alert">
          <app-icon [name]="e.code === 'LOCKED' ? 'lock' : 'alert'" />
          <div class="alert-body">
            <div class="alert-title">{{ e.code === 'LOCKED' ? 'Account locked' : 'Sign-in failed' }}</div>
            {{ e.message }}
            @if (e.attemptsLeft !== undefined) {
              <div class="text-sm mt-1">{{ e.attemptsLeft }} attempt{{ e.attemptsLeft === 1 ? '' : 's' }} left before your account is locked for 15 minutes.</div>
            }
            @if (e.code === 'LOCKED') {
              <div class="alert-actions"><a routerLink="/forgot-password" class="btn btn-secondary btn-sm">Reset password</a></div>
            }
          </div>
        </div>
      }

      @if (mode() === 'password') {
        <form class="stack mt-4" [formGroup]="pwForm" (ngSubmit)="loginPassword()" novalidate>
          <div class="field">
            <label class="label" for="email">Email <span class="req">*</span></label>
            <input id="email" class="input" type="email" formControlName="email" autocomplete="username" placeholder="you@company.com" />
            <app-field-error [control]="pwForm.controls.email" label="Email" />
          </div>
          <div class="field">
            <div class="row-between">
              <label class="label" for="password">Password <span class="req">*</span></label>
              <a routerLink="/forgot-password" class="text-sm">Forgot password?</a>
            </div>
            <div class="input-group">
              <input id="password" class="input" [type]="showPw() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" placeholder="Enter your password" />
              <button type="button" class="addon btn-ghost" style="cursor: pointer" (click)="showPw.set(!showPw())" [attr.aria-label]="showPw() ? 'Hide password' : 'Show password'">
                <app-icon [name]="showPw() ? 'eye-off' : 'eye'" [size]="16" />
              </button>
            </div>
            <app-field-error [control]="pwForm.controls.password" label="Password" />
          </div>
          <label class="check"><input type="checkbox" formControlName="remember" /> Keep me signed in on this device</label>
          <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="pwForm.invalid || busy()" [appBusy]="busy()" busyText="Signing in…">
            Sign in
          </button>
        </form>
      } @else {
        <form class="stack mt-4" (ngSubmit)="otpSent() ? loginOtp() : sendOtp()" novalidate>
          <div class="field">
            <label class="label" for="mobile">Mobile number <span class="req">*</span></label>
            <div class="input-group">
              <span class="addon">+91</span>
              <input id="mobile" class="input" inputmode="numeric" maxlength="10" [formControl]="mobile" placeholder="10-digit mobile" [readonly]="otpSent()" />
            </div>
            <app-field-error [control]="mobile" label="Mobile number" />
          </div>
          @if (otpSent()) {
            <div class="field">
              <label class="label">Enter the 6-digit code sent to {{ auth.otpDestination() }}</label>
              <app-otp-input [formControl]="otp" [invalid]="error()?.code === 'INVALID_OTP'" (completed)="loginOtp()" />
              <div class="row-between text-sm">
                <span class="field-hint">@if (demoOtp()) {Demo code: <code>{{ demoOtp() }}</code>}</span>
                @if (resendIn() > 0) {
                  <span class="text-muted">Resend in {{ resendIn() }}s</span>
                } @else {
                  <button type="button" class="btn btn-link text-sm" (click)="sendOtp()">Resend code</button>
                }
              </div>
            </div>
            <div class="row-sm">
              <button type="button" class="btn btn-secondary" (click)="resetOtp()">Change number</button>
              <button type="submit" class="btn btn-primary flex-1" [disabled]="otp.value?.length !== 6 || busy()" [appBusy]="busy()" busyText="Signing in…">
            Verify & sign in
          </button>
            </div>
          } @else {
            <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="mobile.invalid || busy()" [appBusy]="busy()" busyText="Sending code…">
            Send OTP
          </button>
          }
        </form>
      }

      <!-- Shown only when Google Sign-In is enabled in Configuration / Integrations -->
      @if (googleEnabled()) {
      <div class="divider-text">or</div>
      <button type="button" class="btn btn-secondary btn-lg btn-block" (click)="google()" [disabled]="busy()">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" />
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6a24 24 0 0 0 0 21.4l7.8-6z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.4 2.2-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
        </svg>
        Continue with Google
      </button>
      }
      <p class="text-center text-sm mt-4 mb-0">New to Officera? <a routerLink="/register">Create an account</a></p>
    </div>

    @if (demo.length) {
    <section class="auth-panel mt-4" aria-labelledby="demo-title">
      <div class="row-between mb-3">
        <h2 id="demo-title" class="text-md fw-600">Demo accounts</h2>
        <span class="badge badge-info no-dot">Mock data</span>
      </div>
      <p class="text-sm text-muted">Pick a role to sign in instantly. Each role sees only the screens it is permitted to use.</p>
      <div class="demo-accounts">
        @for (a of demo; track a.userId) {
          <button type="button" class="demo-account" (click)="useDemo(a)" [disabled]="busy()">
            <app-avatar [name]="a.label" [size]="34" />
            <span class="flex-1 min-0">
              <span class="d-block fw-600">{{ a.label }}</span>
              <span class="d-block text-xs text-muted">{{ a.description }}</span>
              <span class="d-block creds">{{ a.email }} · {{ a.password }}</span>
            </span>
            <app-icon name="arrow-right" [size]="16" />
          </button>
        }
      </div>
    </section>
    }
  `,
})
export class LoginComponent implements OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly demoOtp = this.auth.devOtp;
  private readonly integrations = inject(IntegrationService);
  protected readonly googleEnabled = computed(() => this.integrations.activeFor('OAUTH')?.providerKey === 'GOOGLE_OAUTH');
  protected readonly demo = this.auth.demoAccounts();
  protected readonly tabs = [
    { id: 'password', label: 'Email & password', icon: 'mail' },
    { id: 'otp', label: 'Mobile OTP', icon: 'phone' },
  ];
  protected readonly mode = signal('password');
  protected readonly busy = signal(false);
  protected readonly error = signal<AuthError | null>(null);
  protected readonly showPw = signal(false);
  protected readonly otpSent = signal(false);
  protected readonly resendIn = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  protected readonly pwForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, emailValidator]],
    password: ['', Validators.required],
    remember: [true],
  });
  protected readonly mobile = this.fb.nonNullable.control('', [Validators.required, mobileValidator]);
  protected readonly otp = this.fb.nonNullable.control('');
  protected readonly modeLabel = computed(() => this.mode());

  protected loginPassword(): void {
    if (this.pwForm.invalid) return this.pwForm.markAllAsTouched();
    const { email, password } = this.pwForm.getRawValue();
    this.run(this.auth.login(email, password));
  }

  protected sendOtp(): void {
    if (this.mobile.invalid) return this.mobile.markAsTouched();
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    this.error.set(null);
    this.auth.sendOtp(this.mobile.value, 'LOGIN').subscribe(({ sentTo }) => {
      this.auth.otpDestination.set(sentTo);
      this.busy.set(false);
      this.otpSent.set(true);
      this.otp.setValue('');
      this.toast.info('OTP sent', `A 6-digit code was sent to ${sentTo}.`);
      this.startResendTimer();
    });
  }

  protected loginOtp(): void {
    if (this.otp.value.length !== 6 || this.busy()) return;
    this.run(this.auth.loginWithOtp(this.mobile.value, this.otp.value));
  }

  protected resetOtp(): void {
    this.otpSent.set(false);
    this.otp.setValue('');
    this.error.set(null);
  }

  protected google(): void {
    this.run(this.auth.loginWithGoogle());
  }

  protected useDemo(a: DemoAccount): void {
    this.mode.set('password');
    this.pwForm.patchValue({ email: a.email, password: a.password });
    this.run(this.auth.loginAsDemo(a));
  }

  private run(obs: import('rxjs').Observable<User>): void {
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    this.error.set(null);
    obs.subscribe({
      next: (user) => {
        this.busy.set(false);
        this.toast.success(`Welcome, ${user.name.split(' ')[0]}`, `Signed in as ${ROLE_LABELS[user.role]}.`);
        const target = this.auth.redirectUrl ?? this.auth.homeUrl(user.role);
        this.auth.redirectUrl = null;
        this.router.navigateByUrl(target);
      },
      error: (e: AuthError) => {
        this.busy.set(false);
        this.error.set(e);
      },
    });
  }

  private startResendTimer(): void {
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

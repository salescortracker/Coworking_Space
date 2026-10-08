import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, defer, from, map, switchMap, tap, throwError } from 'rxjs';
import { DemoAccount, Member, Role, STAFF_ROLES, User } from '../models';
import { ApiError, ApiService } from './api.service';
import { SpinnerService } from './spinner.service';
import { SessionStore } from './session.store';
import { DataBootstrapService } from './data-bootstrap.service';
import { WriteQueueService } from './write-queue.service';
import { MemberService, UserService } from './data/people-data.service';
import { ToastService } from './ui.service';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export interface AuthError {
  code: 'INVALID_CREDENTIALS' | 'LOCKED' | 'NOT_FOUND' | 'INACTIVE' | 'INVALID_OTP' | 'EXISTS' | 'UNAVAILABLE';
  message: string;
  attemptsLeft?: number;
  lockedUntil?: number;
}

interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
  permissions: string[];
}

interface OtpContext {
  destination: string;
  purpose: 'LOGIN' | 'REGISTER' | 'RESET' | 'ENQUIRY';
}

/**
 * Authentication against the Officera API (JWT). The token is kept by SessionStore and sent by the HTTP
 * interceptor; role and permissions always come from the server. No credentials live in the frontend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly bootstrap = inject(DataBootstrapService);
  private readonly queue = inject(WriteQueueService);
  private readonly users = inject(UserService);
  private readonly members = inject(MemberService);
  private readonly router = inject(Router);
  private readonly spinner = inject(SpinnerService);
  private readonly toast = inject(ToastService);

  /** The signed-in user as returned by the API (kept in step with the users collection). */
  private readonly sessionUser = signal<User | null>(null);
  private readonly permissionSet = signal<Set<string>>(new Set());

  readonly user = computed<User | null>(() => {
    const u = this.sessionUser();
    if (!u) return null;
    return this.users.items().find((x) => x.id === u.id) ?? u;
  });
  readonly isAuthenticated = computed(() => !!this.user());
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  readonly isStaff = computed(() => !!this.role() && STAFF_ROLES.includes(this.role()!));
  readonly isMember = computed(() => this.role() === 'MEMBER');
  readonly member = computed<Member | undefined>(() => this.members.find(this.user()?.memberId));
  readonly permissions = computed(() => this.permissionSet());

  /** Remembers where a guard bounced the user from, so login can return there. */
  redirectUrl: string | null = null;

  /** Registration waiting for OTP verification. */
  readonly pendingRegistration = signal<{ firstName: string; lastName: string; email: string; mobile: string; password: string } | null>(null);
  /** Email whose password is being reset (after OTP). */
  readonly pendingResetEmail = signal<string | null>(null);
  /** Masked destination of the last OTP sent. */
  readonly otpDestination = signal('');
  /** Development only: the code returned by the API when no SMS/e-mail provider is configured. */
  readonly devOtp = signal<string | null>(null);

  private otpContext: OtpContext | null = null;
  private verificationId: string | null = null;

  constructor() {
    this.session.expired$.subscribe(() => {
      this.clearState();
      this.toast.warning('Session expired', 'Please sign in again.');
      this.router.navigateByUrl('/login');
    });
  }

  /** Restores the session on page load (runs before the first screen renders). */
  async restore(): Promise<void> {
    if (!this.session.isActive()) {
      await this.bootstrap.loadPublic();
      return;
    }
    try {
      const me = await new Promise<{ user: User; permissions: string[] }>((resolve, reject) =>
        this.api.post<{ user: User; permissions: string[] }>('Auth/Me', {}, { spinner: 'none' }).subscribe({ next: resolve, error: reject }),
      );
      this.sessionUser.set(me.user);
      this.permissionSet.set(new Set(me.permissions));
      await this.bootstrap.loadForUser(me.user.role, this.permissionSet());
    } catch {
      this.session.clear();
      this.clearState();
      await this.bootstrap.loadPublic();
    }
  }

  /** Demo accounts are not shipped with the app: credentials only exist in the database. */
  demoAccounts(): DemoAccount[] {
    return [];
  }

  can(permission: string): boolean {
    if (this.role() === 'SUPER_ADMIN') return true;
    return this.permissions().has(permission);
  }

  hasRole(...roles: Role[]): boolean {
    const r = this.role();
    return !!r && roles.includes(r);
  }

  homeUrl(role: Role | null = this.role()): string {
    if (!role) return '/login';
    return role === 'MEMBER' ? '/member/dashboard' : '/admin/dashboard';
  }

  login(email: string, password: string): Observable<User> {
    return this.signIn('Auth/Login', { email: email.trim(), password });
  }

  /** Step 1 of mobile OTP sign-in. */
  sendOtp(mobile: string, purpose: OtpContext['purpose'] = this.pendingRegistration() ? 'REGISTER' : 'LOGIN'): Observable<{ sentTo: string; expiresInSec: number }> {
    const destination = mobile.replace(/\D/g, '').slice(-10);
    return this.requestOtp({ destination, purpose });
  }

  /** Verifies the last code sent (registration, password reset or enquiry). */
  verifyOtp(code: string): Observable<true> {
    return defer(() => {
      const ctx = this.otpContext;
      if (!ctx) return throwError(() => this.error('INVALID_OTP', 'Please request a new verification code.'));
      return this.api.post<{ verificationId: string }>('Auth/VerifyOtp', { ...ctx, code }, { spinner: 'blocking', message: 'Verifying code…' }).pipe(
        tap((r) => (this.verificationId = r.verificationId)),
        map(() => true as const),
        catchError((e) => throwError(() => this.toAuthError(e))),
      );
    });
  }

  /** Single-use proof of the last OTP verification (website enquiries). */
  takeVerificationId(): string | null {
    const id = this.verificationId;
    this.verificationId = null;
    return id;
  }

  /** Re-sends the code for whichever flow is in progress. */
  resendOtp(): Observable<{ sentTo: string; expiresInSec: number }> {
    return defer(() => (this.otpContext ? this.requestOtp(this.otpContext) : throwError(() => this.error('INVALID_OTP', 'Please start again.'))));
  }

  loginWithOtp(mobile: string, code: string): Observable<User> {
    return this.signIn('Auth/LoginWithOtp', { mobile: mobile.replace(/\D/g, '').slice(-10), code });
  }

  /** Google Sign-In needs the Google Identity Services client on this page; it is not wired yet. */
  loginWithGoogle(): Observable<User> {
    return throwError(() => this.error('UNAVAILABLE', 'Google sign-in is not available yet. Please use email or mobile OTP.'));
  }

  loginAsDemo(account: DemoAccount): Observable<User> {
    return this.login(account.email, account.password);
  }

  register(data: { firstName: string; lastName: string; email: string; mobile: string; password: string }): Observable<User> {
    return defer(() =>
      this.signIn('Auth/Register', { ...data, mobile: data.mobile.replace(/\D/g, '').slice(-10), verificationId: this.verificationId ?? '' }, 'Creating your account…'),
    );
  }

  /** Creates a login for a member created by staff (e.g. lead conversion). Runs after the member is saved. */
  createMemberLogin(member: Member): void {
    this.queue
      .enqueue(() => this.api.post<{ user: User }>('Auth/CreateMemberLogin', { memberId: member.id }, { spinner: 'background' }))
      .then(() => this.users.load())
      .catch((e: ApiError) => this.toast.error('Member login not created', e.message));
  }

  requestPasswordReset(email: string): Observable<{ sentTo: string }> {
    return this.requestOtp({ destination: email.trim().toLowerCase(), purpose: 'RESET' });
  }

  resetPassword(email: string, password: string): Observable<true> {
    return defer(() =>
      this.api
        .post<unknown>('Auth/ResetPassword', { email: email.trim().toLowerCase(), password, verificationId: this.verificationId ?? '' }, { spinner: 'blocking', message: 'Updating password…' })
        .pipe(
          tap(() => (this.verificationId = null)),
          map(() => true as const),
          catchError((e) => throwError(() => this.toAuthError(e))),
        ),
    );
  }

  changePassword(current: string, next: string): Observable<true> {
    return this.api.post<unknown>('Auth/ChangePassword', { currentPassword: current, newPassword: next }, { spinner: 'blocking', message: 'Updating password…' }).pipe(
      map(() => true as const),
      catchError((e) => throwError(() => this.toAuthError(e))),
    );
  }

  /** Admin action: clears lockout for a user. */
  unlock(email: string): void {
    this.api.post<unknown>('Auth/Unlock', { email }, { spinner: 'background' }).subscribe({
      next: () => this.users.load(),
      error: (e: ApiError) => this.toast.error('Could not unlock', e.message),
    });
  }

  isLocked(email: string): boolean {
    const u = this.users.items().find((x) => x.email.toLowerCase() === email.toLowerCase());
    return !!u?.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now();
  }

  logout(): void {
    const ticket = this.spinner.show({ mode: 'blocking', message: 'Signing out…' });
    const done = () => {
      this.session.clear();
      this.clearState();
      this.bootstrap.loadPublic().finally(() => this.router.navigateByUrl('/login').finally(() => this.spinner.hide(ticket)));
    };
    this.queue.idle().then(() => this.api.post<unknown>('Auth/Logout', {}, { spinner: 'none' }).subscribe({ next: done, error: done }));
  }

  // ---------------- internals ----------------
  private signIn(path: string, body: unknown, message = 'Signing in…'): Observable<User> {
    return this.api.post<AuthResponse>(path, body, { spinner: 'blocking', message }).pipe(
      switchMap((res) => from(this.startSession(res)).pipe(map(() => res.user))),
      catchError((e) => throwError(() => this.toAuthError(e))),
    );
  }

  private async startSession(res: AuthResponse): Promise<void> {
    this.session.set({ token: res.token, expiresAt: res.expiresAt, userId: res.user.id });
    this.sessionUser.set(res.user);
    this.permissionSet.set(new Set(res.permissions));
    this.verificationId = null;
    this.otpContext = null;
    this.devOtp.set(null);
    await this.bootstrap.loadForUser(res.user.role, this.permissionSet());
  }

  private requestOtp(ctx: OtpContext): Observable<{ sentTo: string; expiresInSec: number }> {
    return this.api
      .post<{ sentTo: string; expiresInSec: number; devCode?: string }>('Auth/SendOtp', ctx, { spinner: 'blocking', message: 'Sending verification code…' })
      .pipe(
        tap((r) => {
          this.otpContext = ctx;
          this.verificationId = null;
          this.devOtp.set(r.devCode ?? null);
        }),
        catchError((e) => throwError(() => this.toAuthError(e))),
      );
  }

  private clearState(): void {
    this.sessionUser.set(null);
    this.permissionSet.set(new Set());
    this.bootstrap.clear();
  }

  private toAuthError(e: unknown): AuthError {
    const err = e instanceof ApiError ? e : ApiService.toError(e);
    const data = err.data as Partial<AuthError> | undefined;
    if (data?.code) return { code: data.code, message: data.message ?? err.message, attemptsLeft: data.attemptsLeft, lockedUntil: data.lockedUntil };
    const code: AuthError['code'] = err.status === 409 ? 'EXISTS' : err.status === 404 ? 'NOT_FOUND' : err.status === 0 ? 'UNAVAILABLE' : 'INVALID_CREDENTIALS';
    return { code, message: err.message };
  }

  private error(code: AuthError['code'], message: string): AuthError {
    return { code, message };
  }
}

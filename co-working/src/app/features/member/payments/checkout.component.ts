import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED } from '../../../shared';
import { CheckoutService, PaymentOutcome } from '../../../core/services/checkout.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { BookingEngineService, BookingQuote } from '../../../core/services/booking-engine.service';
import { PromotionService } from '../../../core/services/data/membership-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { BookingService, PaymentService } from '../../../core/services/data/transaction-data.service';
import { ToastService } from '../../../core/services/ui.service';
import { PaymentMethod, Promotion } from '../../../core/models';
import { IntegrationService } from '../../../core/services/integration.service';
import { SettingsService } from '../../../core/services/settings.service';

/**
 * Generic checkout (flow 6 & 7 & 8): plan summary → promo code → referral credit →
 * security deposit → total → payment (UPI / card / net banking) → result.
 */
@Component({
  selector: 'app-checkout',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (!session()) {
        <div class="card">
          <app-empty-state icon="credit-card" title="Nothing to pay for" message="Your checkout session has ended. Start again from plans or bookings.">
            <a routerLink="/member/membership/plans" class="btn btn-secondary">View plans</a>
            <a routerLink="/member/bookings/new" class="btn btn-primary">Book workspace</a>
          </app-empty-state>
        </div>
      } @else {
        <app-page-header title="Checkout" [subtitle]="session()!.title" [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Checkout' }]">
          @if (session()!.kind === 'BOOKING' && lockLeft() !== null) {
            <span class="lock-timer" [class.urgent]="lockLeft()! < 60" role="timer" aria-live="polite">
              <app-icon name="lock" [size]="14" /> Slot held for {{ mmss(lockLeft()!) }}
            </span>
          }
        </app-page-header>

        @if (lockExpired()) {
          <div class="card">
            <app-empty-state icon="clock" title="Your slot hold expired" message="We held the slot for 10 minutes. It has been released so other members can book it. Your booking was not created and you were not charged.">
              <a routerLink="/member/bookings/new" class="btn btn-primary" (click)="checkout.clear()">Retry booking</a>
            </app-empty-state>
          </div>
        } @else {
          <div class="split">
            <div class="stack">
              <!-- 1. Summary -->
              <section class="card">
                <div class="card-header"><h2 class="card-title">1. Summary</h2></div>
                <div class="card-body">
                  @for (l of session()!.lines; track $index) {
                    <div class="summary-line"><span>{{ l.description }}</span><span class="tabular">{{ l.amount | inr }}</span></div>
                  }
                  @if (session()!.kind === 'BOOKING') {
                    <p class="text-sm text-muted mt-2 mb-0">Credits are applied first; you only pay the balance.</p>
                  }
                </div>
              </section>

              <!-- 2. Promo -->
              @if (session()!.promoScope) {
                <section class="card">
                  <div class="card-header"><h2 class="card-title">2. Promo code</h2></div>
                  <div class="card-body">
                    @if (promo(); as p) {
                      <div class="row-between alert alert-success">
                        <span><app-icon name="tag" [size]="16" /> <strong>{{ p.code }}</strong> applied · {{ p.description }}</span>
                        <button type="button" class="btn btn-ghost btn-sm" (click)="promo.set(null)">Remove</button>
                      </div>
                    } @else {
                      <div class="row-sm">
                        <label class="sr-only" for="promo">Promo code</label>
                        <input id="promo" class="input" [formControl]="promoCode" placeholder="e.g. WELCOME10" style="text-transform: uppercase; max-width: 240px" />
                        <button type="button" class="btn btn-secondary" (click)="applyPromo()" [disabled]="!promoCode.value.trim()">Apply</button>
                      </div>
                      @if (promoError()) {
                        <span class="field-error mt-2"><app-icon name="alert" [size]="12" /> {{ promoError() }}</span>
                      }
                      @if (promoHint()) {
                <span class="field-hint d-block mt-2">Try {{ promoHint() }}.</span>
              }
                    }
                  </div>
                </section>
              }

              <!-- 3. Referral -->
              @if (session()!.allowReferral && referralAvailable() > 0) {
                <section class="card">
                  <div class="card-header"><h2 class="card-title">3. Referral credit</h2></div>
                  <div class="card-body">
                    <label class="check"><input type="checkbox" [checked]="useReferral()" (change)="useReferral.set(!useReferral())" /> Use {{ referralAvailable() | inr }} referral credit</label>
                  </div>
                </section>
              }

              <!-- 4. Payment -->
              <section class="card">
                <div class="card-header"><h2 class="card-title">Payment method</h2></div>
                <div class="card-body">
                  @if (totals().total === 0) {
                    <div class="alert alert-success"><app-icon name="check-circle" /><div class="alert-body">Nothing to pay. Your membership credits cover this booking.</div></div>
                  } @else {
                    <div class="choice-grid">
                      @for (m of methods; track m.id) {
                        <button type="button" class="choice" [class.selected]="method() === m.id" (click)="method.set(m.id)" [attr.aria-pressed]="method() === m.id">
                          <span class="choice-icon"><app-icon [name]="m.icon" /></span>
                          <span><span class="choice-title d-block">{{ m.label }}</span><span class="choice-desc d-block">{{ m.desc }}</span></span>
                        </button>
                      }
                    </div>
                    <div class="mt-4">
                      @switch (method()) {
                        @case ('UPI') {
                          <div class="field" style="max-width: 360px">
                            <label class="label" for="upi">UPI ID <span class="req">*</span></label>
                            <input id="upi" class="input" [formControl]="upiId" placeholder="name@bank" />
                            <app-field-error [control]="upiId" label="UPI ID" />
                          </div>
                        }
                        @case ('CARD') {
                          <div class="form-grid" [formGroup]="card" style="max-width: 520px">
                            <div class="field span-2">
                              <label class="label" for="cnum">Card number <span class="req">*</span></label>
                              <input id="cnum" class="input" inputmode="numeric" formControlName="number" placeholder="4111 1111 1111 1111" autocomplete="off" />
                              <app-field-error [control]="card.controls.number" label="Card number" />
                            </div>
                            <div class="field">
                              <label class="label" for="cexp">Expiry (MM/YY) <span class="req">*</span></label>
                              <input id="cexp" class="input" formControlName="expiry" placeholder="12/28" autocomplete="off" />
                              <app-field-error [control]="card.controls.expiry" label="Expiry" />
                            </div>
                            <div class="field">
                              <label class="label" for="ccvv">CVV <span class="req">*</span></label>
                              <input id="ccvv" class="input" type="password" inputmode="numeric" maxlength="4" formControlName="cvv" autocomplete="off" />
                              <app-field-error [control]="card.controls.cvv" label="CVV" />
                            </div>
                            <div class="field span-2">
                              <label class="label" for="cname">Name on card <span class="req">*</span></label>
                              <input id="cname" class="input" formControlName="name" autocomplete="off" />
                            </div>
                          </div>
                        }
                        @case ('NET_BANKING') {
                          <div class="field" style="max-width: 360px">
                            <label class="label" for="bank">Bank <span class="req">*</span></label>
                            <select id="bank" class="select" [formControl]="bank">
                              <option value="">Select your bank</option>
                              @for (b of banks; track b) {
                                <option [value]="b">{{ b }}</option>
                              }
                            </select>
                          </div>
                        }
                      }
                    </div>
                    <p class="text-xs text-muted mt-3 mb-0">
                      <app-icon name="lock" [size]="12" />
                      @if (gateway(); as g) {
                        Secured by {{ g }}. Mock mode: no real payment is processed and card details are not stored.
                      } @else {
                        No payment gateway is active (Configuration / Integrations). Running in mock mode.
                      }
                    </p>
                  }
                </div>
              </section>
            </div>

            <!-- Order total -->
            <aside class="sticky-side stack">
              <section class="card">
                <div class="card-header"><h2 class="card-title">Order total</h2></div>
                <div class="card-body">
                  <div class="summary-line"><span>Subtotal</span><span class="tabular">{{ totals().subtotal | inr }}</span></div>
                  @if (totals().discount) {
                    <div class="summary-line"><span>Promo discount</span><span class="tabular neg">−{{ totals().discount | inr }}</span></div>
                  }
                  <div class="summary-line"><span>GST ({{ gstPct }}%)</span><span class="tabular">{{ totals().tax | inr }}</span></div>
                  @if (totals().credits) {
                    <div class="summary-line"><span>Membership credits</span><span class="tabular neg">−{{ totals().credits | inr }}</span></div>
                  }
                  @if (totals().referral) {
                    <div class="summary-line"><span>Referral credit</span><span class="tabular neg">−{{ totals().referral | inr }}</span></div>
                  }
                  @if (totals().deposit) {
                    <div class="summary-line"><span>Security deposit (refundable)</span><span class="tabular">{{ totals().deposit | inr }}</span></div>
                  }
                  <div class="summary-line total"><span>Total payable</span><span class="tabular">{{ totals().total | inr }}</span></div>
                </div>
                <div class="card-footer" style="display: block">
                  <div class="field mb-3">
                    <label class="label" for="outcome">Demo: payment gateway result</label>
                    <select id="outcome" class="select" [ngModel]="outcome()" (ngModelChange)="outcome.set($event)" [disabled]="totals().total === 0">
                      <option value="SUCCESS">Success</option>
                      <option value="FAILED">Failed</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </div>
                  <button type="button" class="btn btn-primary btn-lg btn-block" [disabled]="!canPay() || busy()" [appBusy]="busy()" busyText="Processing…" (click)="pay()">
                    {{ totals().total === 0 ? 'Confirm booking' : 'Pay ' + (totals().total | inr) }}
                  </button>
                  <button type="button" class="btn btn-ghost btn-block mt-2" (click)="abandon()">Cancel</button>
                  @if (session()!.kind === 'BOOKING') {
                    <button type="button" class="btn btn-link btn-block text-xs mt-2" (click)="engine.expireLockSoon(5)">Demo: expire slot lock in 5 seconds</button>
                  }
                </div>
              </section>
            </aside>
          </div>
        }
      }
    </div>
  `,
})
export class CheckoutComponent implements OnInit, OnDestroy {
  protected readonly checkout = inject(CheckoutService);
  protected readonly engine = inject(BookingEngineService);
  private readonly acct = inject(MemberAccountService);
  private readonly promos = inject(PromotionService);
  private readonly members = inject(MemberService);
  private readonly bookings = inject(BookingService);
  private readonly payments = inject(PaymentService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly session = this.checkout.session;
  private readonly integrations = inject(IntegrationService);
  protected readonly gateway = computed(() => this.integrations.activeLabel('PAYMENT'));
  protected readonly method = signal<PaymentMethod>('UPI');
  protected readonly outcome = signal<PaymentOutcome>('SUCCESS');
  protected readonly promo = signal<Promotion | null>(null);
  protected readonly promoError = signal('');
  protected readonly useReferral = signal(false);
  protected readonly busy = signal(false);
  protected readonly now = signal(Date.now());
  private timer?: ReturnType<typeof setInterval>;

  protected readonly promoCode = this.fb.nonNullable.control('');
  /** GST rate from Settings → Business rules (database). */
  protected readonly gstPct = inject(SettingsService).settings().gstRate;
  /** Active promo codes for this checkout (from the API), e.g. "WELCOME10 on plans". */
  protected readonly promoHint = computed(() => {
    const scope = this.session()?.promoScope;
    if (!scope) return '';
    const today = new Date().toLocaleDateString('en-CA');
    return this.promos
      .items()
      .filter((p) => p.status === 'ACTIVE' && p.expiry >= today && p.used < p.usageLimit && (p.appliesTo === 'ALL' || p.appliesTo === scope))
      .slice(0, 3)
      .map((p) => `${p.code} on ${p.appliesTo === 'ALL' ? 'plans and bookings' : p.appliesTo.toLowerCase()}`)
      .join(', ');
  });
  protected readonly upiId = this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[\w.-]{2,}@[a-zA-Z]{2,}$/)]);
  protected readonly bank = this.fb.nonNullable.control('');
  protected readonly card = this.fb.nonNullable.group({
    number: ['', [Validators.required, Validators.pattern(/^(\d{4} ?){3}\d{4}$/)]],
    expiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    name: ['', Validators.required],
  });

  protected readonly methods: { id: PaymentMethod; label: string; desc: string; icon: string }[] = [
    { id: 'UPI', label: 'UPI', desc: 'GPay, PhonePe, Paytm', icon: 'zap' },
    { id: 'CARD', label: 'Card', desc: 'Credit or debit card', icon: 'credit-card' },
    { id: 'NET_BANKING', label: 'Net Banking', desc: 'All major banks', icon: 'building' },
  ];
  protected readonly banks = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Yes Bank'];

  protected readonly referralAvailable = computed(() => this.members.find(this.session()?.memberId)?.referralCredit ?? 0);
  protected readonly totals = computed(() => {
    const s = this.session();
    if (!s) return { subtotal: 0, discount: 0, taxable: 0, tax: 0, referral: 0, credits: 0, deposit: 0, total: 0 };
    const subtotal = s.lines.reduce((a, l) => a + l.amount, 0);
    const discount = this.promo() ? this.promos.discountFor(this.promo()!, subtotal) : 0;
    return this.checkout.totals(s, discount, this.useReferral() ? this.referralAvailable() : 0);
  });
  protected readonly lockLeft = computed(() => {
    const s = this.session();
    if (!s?.lockExpiresAt) return null;
    const l = this.engine.lock();
    const exp = l?.expiresAt ?? s.lockExpiresAt;
    return Math.max(0, Math.round((exp - this.now()) / 1000));
  });
  protected readonly lockExpired = computed(() => this.session()?.kind === 'BOOKING' && this.lockLeft() === 0);
  /** Plain method (not computed): form validity is not signal-based. */
  protected canPay(): boolean {
    if (this.totals().total === 0) return true;
    switch (this.method()) {
      case 'UPI':
        return this.upiId.valid;
      case 'CARD':
        return this.card.valid;
      default:
        return !!this.bank.value;
    }
  }

  ngOnInit(): void {
    this.timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.lockExpired()) {
        this.engine.releaseLock();
        clearInterval(this.timer);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected mmss(sec: number): string {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  protected applyPromo(): void {
    const s = this.session();
    if (!s?.promoScope) return;
    const res = this.promos.validate(this.promoCode.value, s.promoScope);
    if (typeof res === 'string') {
      this.promoError.set(res);
      return;
    }
    this.promoError.set('');
    this.promo.set(res);
    this.toast.success('Promo applied', res.description);
  }

  protected abandon(): void {
    const s = this.session();
    if (s?.kind === 'BOOKING') this.engine.releaseLock();
    this.checkout.clear();
    this.router.navigateByUrl(s?.returnUrl ?? '/member/dashboard');
  }

  protected pay(): void {
    const s = this.session();
    if (!s || !this.canPay()) return;
    if (s.kind === 'BOOKING' && this.lockExpired()) return;
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    const totals = this.totals();
    const outcome: PaymentOutcome = totals.total === 0 ? 'SUCCESS' : this.outcome();
    this.checkout.pay(s, totals, this.method(), outcome).subscribe((result) => {
      this.busy.set(false);
      const planId = s.payload['planId'] as string | undefined;
      if (outcome === 'SUCCESS') {
        if (this.promo()) this.promos.updateSync(this.promo()!.id, { used: this.promo()!.used + 1 });
        if (totals.referral) {
          const m = this.members.find(s.memberId);
          if (m) this.members.updateSync(m.id, { referralCredit: Math.max(0, (m.referralCredit ?? 0) - totals.referral) });
        }
      }
      switch (s.kind) {
        case 'SUBSCRIPTION':
        case 'DAY_PASS':
          if (outcome === 'SUCCESS' && planId) {
            const sub = this.acct.activateSubscription(s.memberId, planId, s.locationId);
            this.payments.updateSync(result.payment.id, { subscriptionId: sub.id });
          }
          break;
        case 'UPGRADE':
          if (outcome === 'SUCCESS' && planId) this.acct.applyUpgrade(s.payload['subscriptionId'] as string, planId);
          break;
        case 'DUES':
          if (outcome === 'SUCCESS') this.acct.settleDues(s.memberId, s.payload['invoiceIds'] as string[], result.payment.id);
          else if (outcome === 'FAILED' && s.payload['subscriptionId']) this.acct.recordRetryFailure(s.payload['subscriptionId'] as string);
          break;
        case 'BOOKING': {
          const p = s.payload as { resourceId: string; date: string; start: string; end: string; seats: number; quote: BookingQuote; notes?: string };
          if (outcome === 'SUCCESS') {
            const b = this.engine.confirm({ memberId: s.memberId, resourceId: p.resourceId, date: p.date, start: p.start, end: p.end, seats: p.seats, quote: p.quote, paymentId: totals.total ? result.payment.id : undefined, method: totals.total ? this.method() : 'CREDITS', notes: p.notes });
            this.checkout.lastResult.set({ ...result, session: { ...s, payload: { ...s.payload, bookingId: b.id } } });
          } else if (outcome === 'PENDING') {
            const b = this.bookings.createSync({ memberId: s.memberId, companyId: this.members.find(s.memberId)?.companyId, locationId: s.locationId, resourceId: p.resourceId, date: p.date, startTime: p.start, endTime: p.end, seats: p.seats, amount: p.quote.total, creditsUsed: 0, balanceDue: p.quote.total, status: 'PENDING', paymentStatus: 'PENDING', paymentId: result.payment.id, createdAt: new Date().toISOString() });
            this.payments.updateSync(result.payment.id, { bookingId: b.id });
            this.engine.releaseLock();
            this.checkout.lastResult.set({ ...result, session: { ...s, payload: { ...s.payload, bookingId: b.id } } });
          } else {
            // Payment failed → release slot → booking not created → retry
            this.engine.releaseLock();
          }
          break;
        }
      }
      this.checkout.clear();
      this.router.navigateByUrl('/member/payments/result');
    });
  }
}

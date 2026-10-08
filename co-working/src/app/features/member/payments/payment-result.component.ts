import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED } from '../../../shared';
import { CheckoutService } from '../../../core/services/checkout.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { BookingService, PaymentService } from '../../../core/services/data/transaction-data.service';
import { ToastService } from '../../../core/services/ui.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { PAYMENT_METHOD_LABELS } from '../../../core/models';

/** Payment result screens: Success / Failed / Pending. */
@Component({
  selector: 'app-payment-result',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      @if (result(); as r) {
        <section class="card">
          @switch (status()) {
            @case ('SUCCESS') {
              <app-success-state [title]="r.session.kind === 'BOOKING' ? 'Booking confirmed' : 'Payment successful'" [message]="successMessage()">
                <dl details class="kv result-kv">
                  <dt>Payment ID</dt><dd class="mono">{{ r.payment.id }}</dd>
                  <dt>Amount</dt><dd>{{ r.payment.amount | inr }}</dd>
                  <dt>Method</dt><dd>{{ methodLabels[r.payment.method] }}</dd>
                  <dt>Gateway ref</dt><dd class="mono">{{ r.payment.gatewayRef }}</dd>
                  @if (r.invoice) {
                    <dt>GST invoice</dt><dd class="mono">{{ r.invoice.number }}</dd>
                  }
                  @if (bookingId()) {
                    <dt>Booking ID</dt><dd class="mono">{{ bookingId() }}</dd>
                  }
                </dl>
                @if (bookingId()) {
                  <a class="btn btn-primary" [routerLink]="['/member/bookings', bookingId()]">View booking</a>
                } @else {
                  <a class="btn btn-primary" [routerLink]="r.session.returnUrl">Continue</a>
                }
                @if (r.invoice) {
                  <a class="btn btn-secondary" [routerLink]="['/member/invoices', r.invoice.id]"><app-icon name="receipt" [size]="16" /> View invoice</a>
                }
              </app-success-state>
            }
            @case ('FAILED') {
              <div class="empty-state error">
                <div class="empty-icon"><app-icon name="x-circle" [size]="30" /></div>
                <h1 class="empty-title">Payment failed</h1>
                <p class="empty-msg">{{ r.payment.failureReason ?? 'Your bank declined the transaction.' }} {{ r.session.kind === 'BOOKING' ? 'The slot has been released and no booking was created.' : 'You have not been charged.' }}</p>
                <dl class="kv result-kv mt-3">
                  <dt>Payment ID</dt><dd class="mono">{{ r.payment.id }}</dd>
                  <dt>Amount</dt><dd>{{ r.payment.amount | inr }}</dd>
                  <dt>Status</dt><dd><app-status-badge status="FAILED" /></dd>
                </dl>
                <div class="empty-actions">
                  <button type="button" class="btn btn-primary" (click)="retry()"><app-icon name="refresh" [size]="16" /> {{ r.session.kind === 'BOOKING' ? 'Retry booking' : 'Retry payment' }}</button>
                  <a class="btn btn-secondary" routerLink="/member/payments">Go to payments</a>
                </div>
              </div>
            }
            @case ('PENDING') {
              <div class="empty-state">
                <div class="empty-icon" style="background: var(--warning-50); color: var(--warning)"><app-icon name="clock" [size]="30" /></div>
                <h1 class="empty-title">Payment pending</h1>
                <p class="empty-msg">Your bank hasn’t confirmed the payment yet. This usually takes a few minutes. We’ll notify you once it completes.</p>
                <dl class="kv result-kv mt-3">
                  <dt>Payment ID</dt><dd class="mono">{{ r.payment.id }}</dd>
                  <dt>Amount</dt><dd>{{ r.payment.amount | inr }}</dd>
                  <dt>Status</dt><dd><app-status-badge status="PENDING" /></dd>
                </dl>
                <div class="empty-actions">
                  <button type="button" class="btn btn-primary" (click)="checkStatus()" [disabled]="checking()" [appBusy]="checking()" busyText="Checking…">
            Check status
          </button>
                  <a class="btn btn-secondary" routerLink="/member/payments">Go to payments</a>
                </div>
              </div>
            }
          }
        </section>
      } @else {
        <div class="card"><app-empty-state icon="credit-card" title="No recent payment" message="Your payment history is available on the Payments page."><a class="btn btn-primary" routerLink="/member/payments">Payments</a></app-empty-state></div>
      }
    </div>
  `,
  styles: `.result-kv { text-align: left; width: 100%; max-width: 380px; margin: 8px auto 0; padding: 12px 16px; background: var(--surface-alt); border-radius: 8px; border: 1px solid var(--border); }`,
})
export class PaymentResultComponent {
  private readonly checkout = inject(CheckoutService);
  private readonly acct = inject(MemberAccountService);
  private readonly payments = inject(PaymentService);
  private readonly bookings = inject(BookingService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly result = this.checkout.lastResult;
  protected readonly checking = signal(false);
  private readonly spinner = inject(SpinnerService);
  protected readonly status = computed(() => {
    const r = this.result();
    return r ? (this.payments.find(r.payment.id)?.status === 'SUCCESS' ? 'SUCCESS' : r.outcome) : null;
  });
  protected readonly bookingId = computed(() => (this.result()?.session.payload['bookingId'] as string | undefined) ?? undefined);
  protected readonly successMessage = computed(() => {
    const r = this.result()!;
    switch (r.session.kind) {
      case 'BOOKING':
        return 'Your workspace is reserved. A confirmation and calendar invite have been sent, with a reminder 1 hour before.';
      case 'SUBSCRIPTION':
      case 'DAY_PASS':
        return 'Your subscription is active. Credits and door access have been activated, and your GST invoice has been emailed.';
      case 'UPGRADE':
        return 'Your plan has been upgraded. New allowances are available immediately.';
      case 'DUES':
        return 'Thanks for clearing your dues. Your subscription is active and access has been restored.';
      default:
        return 'Your payment was received.';
    }
  });

  protected retry(): void {
    const r = this.result();
    if (!r) return;
    if (r.session.kind === 'BOOKING') {
      this.router.navigateByUrl('/member/bookings/new');
      return;
    }
    this.checkout.start(r.session);
    this.router.navigateByUrl('/member/checkout');
  }

  /** Simulates the gateway webhook confirming a pending payment. */
  protected checkStatus(): void {
    const r = this.result();
    if (!r) return;
    if (this.checking()) return; // ignore repeat clicks while running
    this.checking.set(true);
    this.spinner.after(900, () => {
      try {
      const s = r.session;
      const totals = this.checkout.totals(s);
      const invoice = this.checkout.createInvoice(s, totals);
      this.payments.updateSync(r.payment.id, { status: 'SUCCESS', invoiceId: invoice.id });
      const planId = s.payload['planId'] as string | undefined;
      if ((s.kind === 'SUBSCRIPTION' || s.kind === 'DAY_PASS') && planId) this.acct.activateSubscription(s.memberId, planId, s.locationId);
      if (s.kind === 'UPGRADE' && planId) this.acct.applyUpgrade(s.payload['subscriptionId'] as string, planId);
      if (s.kind === 'DUES') this.acct.settleDues(s.memberId, s.payload['invoiceIds'] as string[], r.payment.id);
      const bId = s.payload['bookingId'] as string | undefined;
      if (bId) this.bookings.updateSync(bId, { status: 'CONFIRMED', paymentStatus: 'PAID' });
      this.checkout.lastResult.set({ ...r, outcome: 'SUCCESS', invoice, payment: this.payments.find(r.payment.id)! });
      this.toast.success('Payment confirmed', 'Your bank confirmed the payment.');
      } finally {
        this.checking.set(false);
      }
    }, { message: 'Checking payment status…' });
  }
}

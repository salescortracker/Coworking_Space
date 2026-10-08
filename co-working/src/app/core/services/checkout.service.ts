import { Injectable, inject, signal } from '@angular/core';
import { Observable, defer, from, map } from 'rxjs';
import { SpinnerService } from './spinner.service';
import { WriteQueueService } from './write-queue.service';
import { Invoice, InvoiceLine, Payment, PaymentMethod, PaymentType } from '../models';
import { ClientStoreService } from './client-store.service';
import { SettingsService } from './settings.service';
import { LocationService } from './data/workspace-data.service';
import { InvoiceService, PaymentService } from './data/transaction-data.service';
import { CompanyService, MemberService } from './data/people-data.service';
import { NotificationCenterService } from './notification.service';

export type CheckoutKind = 'SUBSCRIPTION' | 'UPGRADE' | 'BOOKING' | 'DUES' | 'DAY_PASS';
export type PaymentOutcome = 'SUCCESS' | 'FAILED' | 'PENDING';

/** Everything the generic checkout page needs to render and complete a payment. */
export interface CheckoutSession {
  kind: CheckoutKind;
  memberId: string;
  locationId: string;
  title: string;
  lines: InvoiceLine[];
  /** Non-taxable refundable deposit. */
  securityDeposit: number;
  promoScope: 'PLANS' | 'BOOKINGS' | null;
  allowReferral: boolean;
  /** Booking credits already applied (bookings only). */
  creditsApplied: number;
  /** Arbitrary payload for the flow that started checkout (plan id, booking draft…). */
  payload: Record<string, unknown>;
  /** For bookings: the slot lock expiry (epoch ms). */
  lockExpiresAt?: number;
  returnUrl: string;
  createdAt: number;
}

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  referral: number;
  credits: number;
  deposit: number;
  total: number;
}

export interface PaymentResult {
  outcome: PaymentOutcome;
  payment: Payment;
  invoice?: Invoice;
  session: CheckoutSession;
}

const SESSION_KEY = 'officera:checkout-session';
const RESULT_KEY = 'officera:checkout-result';

/**
 * Mock payment gateway + GST invoicing. Creates the payment record and, on success,
 * the GST invoice (CGST/SGST for intra-state, IGST for inter-state), then emails it.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly db = inject(ClientStoreService);
  private readonly settings = inject(SettingsService);
  private readonly locations = inject(LocationService);
  private readonly spinner = inject(SpinnerService);
  private readonly queue = inject(WriteQueueService);
  private readonly payments = inject(PaymentService);
  private readonly invoices = inject(InvoiceService);
  private readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  private readonly notify = inject(NotificationCenterService);

  readonly session = signal<CheckoutSession | null>(this.db.read<CheckoutSession>(SESSION_KEY));
  readonly lastResult = signal<PaymentResult | null>(this.db.read<PaymentResult>(RESULT_KEY));

  start(session: Omit<CheckoutSession, 'createdAt'>): void {
    const s = { ...session, createdAt: Date.now() };
    this.session.set(s);
    this.db.write(SESSION_KEY, s);
  }

  clear(): void {
    this.session.set(null);
    this.db.remove(SESSION_KEY);
  }

  totals(s: CheckoutSession, discount = 0, referral = 0): CheckoutTotals {
    const subtotal = s.lines.reduce((sum, l) => sum + l.amount, 0);
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * this.settings.gstFraction());
    const gross = taxable + tax;
    const credits = Math.min(s.creditsApplied, gross);
    const ref = Math.min(referral, gross - credits);
    return { subtotal, discount, taxable, tax, referral: ref, credits, deposit: s.securityDeposit, total: Math.max(0, gross - credits - ref) + s.securityDeposit };
  }

  /**
   * Records the payment (and GST invoice) through the API and completes once they are saved.
   * The gateway outcome is still chosen on the checkout screen: live gateway checkout is not wired yet.
   */
  pay(s: CheckoutSession, totals: CheckoutTotals, method: PaymentMethod, outcome: PaymentOutcome): Observable<PaymentResult> {
    return this.spinner.track(
      defer(() => {
        const result = this.record(s, totals, method, outcome);
        return from(this.queue.idle()).pipe(
          map(() => {
            // Show what the API stored (e.g. the invoice number it issued).
            const saved: PaymentResult = { ...result, payment: this.payments.find(result.payment.id) ?? result.payment, invoice: result.invoice ? (this.invoices.find(result.invoice.id) ?? result.invoice) : undefined };
            this.lastResult.set(saved);
            this.db.write(RESULT_KEY, saved);
            return saved;
          }),
        );
      }),
      { mode: 'blocking', message: 'Processing payment…' },
    );
  }

  /** Synchronous variant used by staff-side flows (e.g. recording a manual payment). */
  record(s: CheckoutSession, totals: CheckoutTotals, method: PaymentMethod, outcome: PaymentOutcome, retryOf?: Payment): PaymentResult {
    const type: PaymentType =
      s.kind === 'BOOKING' ? 'BOOKING' : s.kind === 'DUES' ? 'RENEWAL' : s.kind === 'DAY_PASS' ? 'DAY_PASS' : 'SUBSCRIPTION';
    let invoice: Invoice | undefined;
    // Dues settle invoices that already exist, so no new invoice is raised for them.
    if (outcome === 'SUCCESS' && s.kind !== 'DUES') invoice = this.createInvoice(s, totals);

    const payment = retryOf
      ? this.payments.updateSync(retryOf.id, {
          status: outcome === 'SUCCESS' ? 'SUCCESS' : outcome,
          retryCount: retryOf.retryCount + 1,
          invoiceId: invoice?.id,
          method,
          date: new Date().toISOString(),
          failureReason: outcome === 'FAILED' ? 'Payment declined by bank (simulated)' : undefined,
        })
      : this.payments.createSync({
          memberId: s.memberId,
          locationId: s.locationId,
          date: new Date().toISOString(),
          type,
          description: s.title,
          amount: totals.total,
          method: totals.total === 0 ? 'CREDITS' : method,
          status: outcome,
          gatewayRef: `pay_${Math.random().toString(36).slice(2, 12)}`,
          invoiceId: invoice?.id,
          bookingId: (s.payload['bookingId'] as string) ?? undefined,
          subscriptionId: (s.payload['subscriptionId'] as string) ?? undefined,
          retryCount: 0,
          failureReason: outcome === 'FAILED' ? 'Payment declined by bank (simulated)' : undefined,
        });
    if (invoice) this.invoices.updateSync(invoice.id, { paymentId: payment.id });

    const member = this.members.find(s.memberId);
    if (outcome === 'SUCCESS') {
      this.notify.dispatch({ event: 'Payment Success', audience: 'MEMBER', memberId: s.memberId, category: 'PAYMENT', title: 'Payment successful', message: `We received ₹${totals.total.toLocaleString('en-IN')} for ${s.title}. Your GST invoice is ready in Payments & Invoices.`, link: `/member/invoices/${invoice?.id}`, recipient: member?.email, locationId: s.locationId, channels: ['EMAIL', 'PUSH'] });
    } else if (outcome === 'FAILED') {
      this.notify.dispatch({ event: 'Payment Failure', audience: 'MEMBER', memberId: s.memberId, category: 'PAYMENT', title: 'Payment failed', message: `Your payment of ₹${totals.total.toLocaleString('en-IN')} for ${s.title} did not go through. Please retry.`, link: '/member/payments', recipient: member?.mobile, locationId: s.locationId, channels: ['SMS', 'PUSH'] });
      this.notify.dispatch({ event: 'Payment Failure', audience: 'STAFF', category: 'PAYMENT', title: 'Payment failed', message: `${member?.firstName ?? 'A member'} ${member?.lastName ?? ''} – ${s.title} (₹${totals.total.toLocaleString('en-IN')}) failed.`, link: '/admin/finance/payments', locationId: s.locationId, channels: ['EMAIL'] });
    }

    const result: PaymentResult = { outcome, payment, invoice, session: s };
    this.lastResult.set(result);
    this.db.write(RESULT_KEY, result);
    return result;
  }

  createInvoice(s: CheckoutSession, totals: CheckoutTotals): Invoice {
    const member = this.members.find(s.memberId);
    const company = this.companies.find(member?.companyId);
    // Supplier state = state of the centre providing the service (place of business), from the database.
    const supplierState = this.locations.find(s.locationId)?.state ?? this.settings.settings().supplier.state;
    const customerState = company?.state ?? supplierState;
    const intra = supplierState === customerState;
    const lines = [...s.lines];
    if (totals.discount) lines.push({ description: 'Promotional discount', sac: '', qty: 1, rate: -totals.discount, amount: -totals.discount });
    const today = new Date().toLocaleDateString('en-CA');
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const gross = totals.taxable + totals.tax;
    const inv = this.invoices.createSync({
      // The invoice number is issued by the API (sequential per financial year) when the invoice is saved.
      number: '',
      date: today,
      dueDate: due.toLocaleDateString('en-CA'),
      memberId: s.memberId,
      locationId: s.locationId,
      customerName: member ? `${member.firstName} ${member.lastName}` : 'Member',
      companyName: company?.name,
      customerGstin: company?.gstin,
      billingAddress: company ? `${company.billingAddress}, ${company.state}` : '',
      placeOfSupply: customerState,
      intraState: intra,
      lines,
      subtotal: totals.taxable,
      cgst: intra ? Math.round(totals.tax / 2) : 0,
      sgst: intra ? totals.tax - Math.round(totals.tax / 2) : 0,
      igst: intra ? 0 : totals.tax,
      tax: totals.tax,
      total: gross,
      amountPaid: gross,
      status: 'PAID',
      emailedAt: new Date().toISOString(),
    });
    return inv;
  }
}

import { Injectable, computed, inject } from '@angular/core';
import { AccessState, Plan, Subscription } from '../models';
import { AuthService } from './auth.service';
import { CompanyService, MemberService } from './data/people-data.service';
import { CreditTransactionService, PlanService, SubscriptionService } from './data/membership-data.service';
import { InvoiceService, PaymentService } from './data/transaction-data.service';
import { AccessCredentialService } from './data/operations-data.service';
import { NotificationCenterService } from './notification.service';

const DAY = 86400000;
const today = () => new Date().toLocaleDateString('en-CA');
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

/** Access rules (FR-5.1 / 5.2): active plan → access; paused/suspended/expired → revoked; overdue → grace period. */
export function accessStateFor(sub: Subscription | undefined): AccessState {
  if (!sub) return 'EXPIRED';
  switch (sub.status) {
    case 'ACTIVE':
      return sub.endDate < today() && !sub.autoRenew ? 'EXPIRED' : 'ACTIVE';
    case 'OVERDUE':
      return sub.graceUntil && sub.graceUntil < today() ? 'SUSPENDED' : 'OVERDUE';
    case 'PAUSED':
    case 'SUSPENDED':
      return 'SUSPENDED';
    default:
      return 'EXPIRED';
  }
}

export function cycleDays(cycle: Subscription['billingCycle']): number {
  return cycle === 'DAILY' ? 1 : cycle === 'QUARTERLY' ? 90 : cycle === 'YEARLY' ? 365 : 30;
}

/**
 * Current member's account context and all membership lifecycle actions
 * (subscribe, upgrade, downgrade, pause, resume, cancel, settle dues).
 * Staff screens call the same actions with an explicit member id.
 */
@Injectable({ providedIn: 'root' })
export class MemberAccountService {
  private readonly auth = inject(AuthService);
  private readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  private readonly plans = inject(PlanService);
  private readonly subs = inject(SubscriptionService);
  private readonly credits = inject(CreditTransactionService);
  private readonly invoices = inject(InvoiceService);
  private readonly payments = inject(PaymentService);
  private readonly creds = inject(AccessCredentialService);
  private readonly notify = inject(NotificationCenterService);

  readonly memberId = computed(() => this.auth.user()?.memberId);
  readonly member = computed(() => this.members.find(this.memberId()));
  readonly company = computed(() => this.companies.find(this.member()?.companyId));
  readonly subscription = computed(() => {
    this.subs.items();
    return this.subs.forMember(this.memberId());
  });
  readonly plan = computed<Plan | undefined>(() => {
    const s = this.subscription();
    return s && !['CANCELLED', 'EXPIRED'].includes(s.status) ? this.plans.find(s.planId) : undefined;
  });
  readonly accessState = computed<AccessState>(() => accessStateFor(this.subscription()));
  readonly creditsRemaining = computed(() => {
    const s = this.subscription();
    return s && this.accessState() !== 'EXPIRED' ? Math.max(0, s.creditsTotal - s.creditsUsed) : 0;
  });
  readonly roomHoursRemaining = computed(() => {
    const s = this.subscription();
    return s ? Math.max(0, s.roomHoursTotal - s.roomHoursUsed) : 0;
  });
  readonly guestPassesRemaining = computed(() => {
    const s = this.subscription();
    return s ? Math.max(0, s.guestPassesTotal - s.guestPassesUsed) : 0;
  });
  readonly outstandingInvoices = computed(() =>
    this.invoices.forMember(this.memberId()).filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE'),
  );
  readonly outstandingAmount = computed(() => this.outstandingInvoices().reduce((s, i) => s + (i.total - i.amountPaid), 0));
  readonly daysToRenewal = computed(() => {
    const s = this.subscription();
    if (!s) return null;
    return Math.ceil((new Date(s.endDate + 'T12:00:00').getTime() - Date.now()) / DAY);
  });

  // ---------------- lifecycle actions ----------------

  /** Called after a successful subscription payment. Cancels any older plan and activates the new one. */
  activateSubscription(memberId: string, planId: string, locationId: string): Subscription {
    const plan = this.plans.find(planId)!;
    this.subs
      .items()
      .filter((s) => s.memberId === memberId && !['CANCELLED', 'EXPIRED'].includes(s.status))
      .forEach((s) => this.subs.updateSync(s.id, { status: 'CANCELLED', cancelReason: 'Replaced by new plan', cancelAt: today() }));
    const start = today();
    const sub = this.subs.createSync({
      memberId,
      planId,
      locationId,
      status: 'ACTIVE',
      startDate: start,
      endDate: addDays(start, cycleDays(plan.billingCycle)),
      billingCycle: plan.billingCycle,
      price: plan.price,
      roomHoursTotal: plan.roomHours,
      roomHoursUsed: 0,
      guestPassesTotal: plan.guestPasses,
      guestPassesUsed: 0,
      creditsTotal: plan.credits,
      creditsUsed: 0,
      securityDeposit: plan.securityDeposit,
      autoRenew: plan.billingCycle !== 'DAILY',
      paymentRetries: 0,
      createdAt: new Date().toISOString(),
    });
    this.plans.updateSync(plan.id, { subscribers: plan.subscribers + 1 });
    this.members.updateSync(memberId, { status: 'ACTIVE' });
    if (plan.credits) this.credits.createSync({ memberId, date: new Date().toISOString(), type: 'ALLOCATED', amount: plan.credits, reference: sub.id, note: `${plan.name} credits` });
    this.syncAccess(memberId);
    this.notify.dispatch({ event: 'Member Welcome', audience: 'MEMBER', memberId, category: 'MEMBERSHIP', title: 'Subscription active', message: `Your ${plan.name} plan is active. Credits and access have been activated.`, link: '/member/membership', locationId });
    return sub;
  }

  /** Immediate upgrade after the prorated payment succeeds. */
  applyUpgrade(subscriptionId: string, planId: string): Subscription {
    const sub = this.subs.find(subscriptionId)!;
    const plan = this.plans.find(planId)!;
    const updated = this.subs.updateSync(sub.id, {
      planId,
      price: plan.price,
      roomHoursTotal: plan.roomHours,
      guestPassesTotal: plan.guestPasses,
      creditsTotal: sub.creditsTotal + Math.max(0, plan.credits - sub.creditsTotal),
      securityDeposit: Math.max(sub.securityDeposit, plan.securityDeposit),
      status: 'ACTIVE',
      scheduledChange: undefined,
    });
    this.syncAccess(sub.memberId);
    this.notify.dispatch({ event: 'Plan Changed', audience: 'MEMBER', memberId: sub.memberId, category: 'MEMBERSHIP', title: 'Plan upgraded', message: `You are now on ${plan.name}.`, link: '/member/membership', locationId: sub.locationId });
    return updated;
  }

  /** Prorated amount for switching to a new plan today. */
  prorate(sub: Subscription, plan: Plan): { remainingDays: number; amount: number } {
    const total = cycleDays(sub.billingCycle);
    const remainingDays = Math.max(0, Math.ceil((new Date(sub.endDate + 'T12:00:00').getTime() - Date.now()) / DAY));
    const amount = Math.round(((plan.price - sub.price) * remainingDays) / total);
    return { remainingDays, amount };
  }

  scheduleDowngrade(subscriptionId: string, planId: string): Subscription {
    const sub = this.subs.find(subscriptionId)!;
    const plan = this.plans.find(planId)!;
    const updated = this.subs.updateSync(sub.id, { scheduledChange: { planId, effective: sub.endDate } });
    this.notify.dispatch({ event: 'Plan Changed', audience: 'MEMBER', memberId: sub.memberId, category: 'MEMBERSHIP', title: 'Downgrade scheduled', message: `You will move to ${plan.name} on ${sub.endDate}.`, link: '/member/membership', locationId: sub.locationId });
    return updated;
  }

  cancelScheduledChange(subscriptionId: string): void {
    this.subs.updateSync(subscriptionId, { scheduledChange: undefined });
  }

  pause(subscriptionId: string, until: string): Subscription {
    const sub = this.subs.updateSync(subscriptionId, { status: 'PAUSED', pausedUntil: until });
    this.syncAccess(sub.memberId);
    this.notify.dispatch({ event: 'Plan Paused', audience: 'MEMBER', memberId: sub.memberId, category: 'MEMBERSHIP', title: 'Membership paused', message: `Your membership is paused until ${until}. Door access is suspended during the pause.`, link: '/member/access', locationId: sub.locationId });
    return sub;
  }

  resume(subscriptionId: string): Subscription {
    const sub = this.subs.updateSync(subscriptionId, { status: 'ACTIVE', pausedUntil: undefined });
    this.syncAccess(sub.memberId);
    this.notify.dispatch({ event: 'Plan Resumed', audience: 'MEMBER', memberId: sub.memberId, category: 'MEMBERSHIP', title: 'Membership resumed', message: 'Welcome back! Your access has been restored.', link: '/member/access', locationId: sub.locationId });
    return sub;
  }

  cancel(subscriptionId: string, reason: string): Subscription {
    const sub = this.subs.find(subscriptionId)!;
    const updated = this.subs.updateSync(subscriptionId, { autoRenew: false, cancelAt: sub.endDate, cancelReason: reason });
    this.notify.dispatch({ event: 'Plan Cancelled', audience: 'STAFF', category: 'MEMBERSHIP', title: 'Plan cancellation', message: `${this.members.fullName(sub.memberId)} cancelled effective ${sub.endDate}. Reason: ${reason}`, link: '/admin/membership/subscriptions', locationId: sub.locationId });
    return updated;
  }

  undoCancel(subscriptionId: string): Subscription {
    return this.subs.updateSync(subscriptionId, { autoRenew: true, cancelAt: undefined, cancelReason: undefined });
  }

  /** Staff/admin status change (activate / suspend). */
  setStatus(subscriptionId: string, status: Subscription['status']): Subscription {
    const sub = this.subs.updateSync(subscriptionId, { status, paymentRetries: status === 'ACTIVE' ? 0 : this.subs.find(subscriptionId)!.paymentRetries });
    this.syncAccess(sub.memberId);
    return sub;
  }

  /** Overdue invoices settled → subscription active → access restored (flow 9). */
  settleDues(memberId: string, invoiceIds: string[], paymentId: string): void {
    invoiceIds.forEach((id) => {
      const inv = this.invoices.find(id);
      if (inv) this.invoices.updateSync(id, { status: 'PAID', amountPaid: inv.total, paymentId });
    });
    this.payments
      .items()
      .filter((p) => p.memberId === memberId && p.status === 'FAILED' && p.type !== 'BOOKING')
      .forEach((p) => this.payments.updateSync(p.id, { status: 'SUCCESS', failureReason: undefined, invoiceId: p.invoiceId ?? invoiceIds[0] }));
    const sub = this.subs.forMember(memberId);
    if (sub && ['OVERDUE', 'SUSPENDED'].includes(sub.status)) {
      this.subs.updateSync(sub.id, { status: 'ACTIVE', paymentRetries: 0, graceUntil: undefined });
      this.members.updateSync(memberId, { status: 'ACTIVE' });
    }
    this.syncAccess(memberId);
    this.notify.dispatch({ event: 'Payment Success', audience: 'MEMBER', memberId, category: 'MEMBERSHIP', title: 'Access restored', message: 'Thanks for clearing your dues. Your subscription is active and door access has been restored.', link: '/member/access' });
  }

  /** Recurring payment retry schedule (day 1, 3, 7) then grace period → suspension. */
  recordRetryFailure(subscriptionId: string): Subscription {
    const sub = this.subs.find(subscriptionId)!;
    const retries = sub.paymentRetries + 1;
    const patch: Partial<Subscription> =
      retries >= 3
        ? sub.graceUntil && sub.graceUntil < today()
          ? { paymentRetries: retries, status: 'SUSPENDED' }
          : { paymentRetries: retries, status: 'OVERDUE', graceUntil: sub.graceUntil ?? addDays(today(), 5) }
        : { paymentRetries: retries, status: 'OVERDUE' };
    const updated = this.subs.updateSync(sub.id, patch);
    this.syncAccess(sub.memberId);
    return updated;
  }

  /** Keeps the member's QR credential in line with the subscription state. */
  syncAccess(memberId: string): void {
    const state = accessStateFor(this.subs.forMember(memberId));
    const cred = this.creds.items().find((c) => c.holderId === memberId);
    const member = this.members.find(memberId);
    if (!member) return;
    const status = state === 'ACTIVE' || state === 'OVERDUE' ? 'ACTIVE' : state === 'EXPIRED' ? 'EXPIRED' : 'REVOKED';
    const reason = state === 'SUSPENDED' ? 'Plan paused / suspended' : state === 'EXPIRED' ? 'No active plan' : undefined;
    if (cred) this.creds.updateSync(cred.id, { status, revokedReason: reason, locationId: member.locationId });
    else
      this.creds.createSync({
        holderId: memberId,
        holderName: `${member.firstName} ${member.lastName}`,
        holderType: 'MEMBER',
        locationId: member.locationId,
        code: `OFM-${memberId.replace(/\D/g, '')}${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
        status,
        issuedAt: new Date().toISOString(),
        validUntil: addDays(today(), 30),
        accessHours: '8:00 AM – 9:00 PM',
        revokedReason: reason,
      });
  }
}

import { Injectable, computed } from '@angular/core';
import { CreditTransaction, Plan, Promotion, Subscription } from '../../models';
import { ApiCollection } from '../api-collection';

@Injectable({ providedIn: 'root' })
export class PlanService extends ApiCollection<Plan> {
  constructor() {
    super('Plan', 'PLN');
  }
  readonly published = computed(() => this.items().filter((p) => p.status === 'ACTIVE'));

  name(id: string | undefined): string {
    return this.find(id)?.name ?? '—';
  }
}

@Injectable({ providedIn: 'root' })
export class PromotionService extends ApiCollection<Promotion> {
  constructor() {
    super('Promotion', 'PRM');
  }

  /** Validates a promo code for a scope; returns the promotion or an error message. */
  validate(code: string, scope: 'PLANS' | 'BOOKINGS'): Promotion | string {
    const p = this.items().find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
    if (!p) return 'This promo code is not valid.';
    if (p.status !== 'ACTIVE') return 'This promo code is no longer active.';
    if (p.expiry < new Date().toLocaleDateString('en-CA')) return 'This promo code has expired.';
    if (p.used >= p.usageLimit) return 'This promo code has reached its usage limit.';
    if (p.appliesTo !== 'ALL' && p.appliesTo !== scope) return `This code only applies to ${p.appliesTo.toLowerCase()}.`;
    return p;
  }

  discountFor(p: Promotion, amount: number): number {
    return Math.min(amount, p.discountType === 'PERCENT' ? Math.round((amount * p.discount) / 100) : p.discount);
  }
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService extends ApiCollection<Subscription> {
  constructor() {
    super('Subscription', 'SUB', (s) => s.locationId);
  }

  /** Most relevant subscription for a member (active first, then most recent). */
  forMember(memberId: string | undefined): Subscription | undefined {
    if (!memberId) return undefined;
    const subs = this.items().filter((s) => s.memberId === memberId);
    const order = ['ACTIVE', 'OVERDUE', 'PAUSED', 'SUSPENDED', 'PENDING_PAYMENT', 'EXPIRED', 'CANCELLED'];
    return subs.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.createdAt.localeCompare(a.createdAt))[0];
  }
}

@Injectable({ providedIn: 'root' })
export class CreditTransactionService extends ApiCollection<CreditTransaction> {
  constructor() {
    super('CreditTransaction', 'CRT');
  }
  forMember(memberId: string): CreditTransaction[] {
    return this.items()
      .filter((c) => c.memberId === memberId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}

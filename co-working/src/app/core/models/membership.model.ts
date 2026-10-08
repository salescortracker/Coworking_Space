import { ID, ISODate, ISODateTime } from './common.model';

export type PlanType = 'DAY_PASS' | 'HOT_DESK' | 'DEDICATED_DESK' | 'PRIVATE_OFFICE';
export type BillingCycle = 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  DAY_PASS: 'Day Pass',
  HOT_DESK: 'Monthly Hot Desk',
  DEDICATED_DESK: 'Dedicated Desk',
  PRIVATE_OFFICE: 'Private Office',
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  DAILY: 'Per day',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

export interface Plan {
  id: ID;
  name: string;
  type: PlanType;
  price: number;
  billingCycle: BillingCycle;
  roomHours: number;
  guestPasses: number;
  /** Booking credits (1 credit = ₹1 towards bookings). */
  credits: number;
  securityDeposit: number;
  description: string;
  benefits: string[];
  accessHours: string;
  status: 'ACTIVE' | 'INACTIVE';
  popular?: boolean;
  subscribers: number;
}

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'OVERDUE'
  | 'SUSPENDED'
  | 'PENDING_PAYMENT';

export interface Subscription {
  id: ID;
  memberId: ID;
  planId: ID;
  locationId: ID;
  status: SubscriptionStatus;
  startDate: ISODate;
  endDate: ISODate;
  billingCycle: BillingCycle;
  price: number;
  roomHoursTotal: number;
  roomHoursUsed: number;
  guestPassesTotal: number;
  guestPassesUsed: number;
  creditsTotal: number;
  creditsUsed: number;
  securityDeposit: number;
  autoRenew: boolean;
  /** Recurring payment retry count (retries on day 1, 3 and 7). */
  paymentRetries: number;
  graceUntil?: ISODate;
  pausedUntil?: ISODate;
  cancelAt?: ISODate;
  cancelReason?: string;
  /** Downgrades take effect at the end of the current cycle. */
  scheduledChange?: { planId: ID; effective: ISODate };
  createdAt: ISODateTime;
}

export interface CreditTransaction {
  id: ID;
  memberId: ID;
  date: ISODateTime;
  type: 'ALLOCATED' | 'USED' | 'REFUNDED' | 'ADJUSTED' | 'EXPIRED';
  amount: number;
  reference: string;
  note: string;
}

export interface Promotion {
  id: ID;
  code: string;
  description: string;
  discountType: 'PERCENT' | 'FLAT';
  discount: number;
  expiry: ISODate;
  usageLimit: number;
  used: number;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  appliesTo: 'ALL' | 'PLANS' | 'BOOKINGS';
}

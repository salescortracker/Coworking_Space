import { ID, ISODate, ISODateTime, PaymentMethod } from './common.model';

export type BookingStatus = 'CONFIRMED' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type BookingPaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'NOT_REQUIRED';

export interface Booking {
  id: ID;
  memberId: ID;
  companyId?: ID;
  locationId: ID;
  resourceId: ID;
  date: ISODate;
  startTime: string;
  endTime: string;
  seats: number;
  amount: number;
  creditsUsed: number;
  balanceDue: number;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentId?: ID;
  notes?: string;
  createdAt: ISODateTime;
  cancelledAt?: ISODateTime;
  cancelReason?: string;
}

/** A temporary hold placed on a slot while the member checks out. */
export interface SlotLock {
  resourceId: ID;
  date: ISODate;
  startTime: string;
  endTime: string;
  expiresAt: number;
}

export interface BookingDraft {
  locationId?: ID;
  type?: 'HOT_DESK' | 'DEDICATED_DESK' | 'PRIVATE_OFFICE' | 'MEETING_ROOM';
  date?: ISODate;
  startTime?: string;
  endTime?: string;
  seats: number;
  resourceId?: ID;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
}

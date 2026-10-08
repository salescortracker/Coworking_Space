import { ID, ISODate, ISODateTime, PaymentMethod } from './common.model';

export type PaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
export type PaymentType = 'SUBSCRIPTION' | 'BOOKING' | 'DEPOSIT' | 'DAY_PASS' | 'RENEWAL';

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  SUBSCRIPTION: 'Subscription',
  BOOKING: 'Booking',
  DEPOSIT: 'Security Deposit',
  DAY_PASS: 'Day Pass',
  RENEWAL: 'Renewal',
};

export interface Payment {
  id: ID;
  memberId: ID;
  locationId: ID;
  date: ISODateTime;
  type: PaymentType;
  description: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayRef: string;
  invoiceId?: ID;
  bookingId?: ID;
  subscriptionId?: ID;
  retryCount: number;
  failureReason?: string;
}

export interface InvoiceLine {
  description: string;
  sac: string;
  qty: number;
  rate: number;
  amount: number;
}

export type InvoiceStatus = 'PAID' | 'UNPAID' | 'OVERDUE' | 'CANCELLED' | 'PARTIALLY_PAID';

export interface Invoice {
  id: ID;
  number: string;
  date: ISODate;
  dueDate: ISODate;
  memberId: ID;
  locationId: ID;
  customerName: string;
  companyName?: string;
  customerGstin?: string;
  billingAddress: string;
  placeOfSupply: string;
  /** True when supplier and customer are in the same state (CGST+SGST), else IGST. */
  intraState: boolean;
  lines: InvoiceLine[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  paymentId?: ID;
  emailedAt?: ISODateTime;
}

export interface Refund {
  id: ID;
  paymentId: ID;
  memberId: ID;
  locationId: ID;
  amount: number;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'PROCESSED' | 'REJECTED';
  requestedAt: ISODateTime;
  processedAt?: ISODateTime;
}

export interface CreditNote {
  id: ID;
  number: string;
  invoiceId: ID;
  memberId: ID;
  locationId: ID;
  amount: number;
  reason: string;
  date: ISODate;
  status: 'ISSUED' | 'APPLIED' | 'VOID';
}

/** Supplier (Officera) GST registration used on invoices. */
export interface SupplierInfo {
  legalName: string;
  gstin: string;
  address: string;
  state: string;
  stateCode: string;
  pan: string;
  email: string;
  phone: string;
}

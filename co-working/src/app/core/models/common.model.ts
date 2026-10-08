/** Shared primitive types used across Officera models. */
export type ID = string;

/** ISO date string (yyyy-mm-dd) */
export type ISODate = string;
/** ISO date-time string */
export type ISODateTime = string;

export type SpaceType = 'HOT_DESK' | 'DEDICATED_DESK' | 'PRIVATE_OFFICE' | 'MEETING_ROOM' | 'DAY_PASS';

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  HOT_DESK: 'Hot Desk',
  DEDICATED_DESK: 'Dedicated Desk',
  PRIVATE_OFFICE: 'Private Office',
  MEETING_ROOM: 'Meeting Room',
  DAY_PASS: 'Day Pass',
};

export type PaymentMethod = 'UPI' | 'CARD' | 'NET_BANKING' | 'CREDITS';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: 'UPI',
  CARD: 'Card',
  NET_BANKING: 'Net Banking',
  CREDITS: 'Membership Credits',
};

export interface Comment {
  id: ID;
  author: string;
  authorRole?: string;
  text: string;
  at: ISODateTime;
}

export interface TimelineEntry {
  id: ID;
  title: string;
  description?: string;
  at: ISODateTime;
  actor?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon?: string;
}

export interface Attachment {
  id: ID;
  name: string;
  size: number;
  type: string;
  /** Path of the stored file returned by POST /api/File/Upload. */
  url?: string;
}

export interface SelectOption<T = string> {
  value: T;
  label: string;
}

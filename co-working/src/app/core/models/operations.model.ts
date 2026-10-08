import { Attachment, Comment, ID, ISODate, ISODateTime, TimelineEntry } from './common.model';

/* ---------------- Visitors ---------------- */
export type VisitorStatus = 'EXPECTED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'EXPIRED' | 'CANCELLED';

export interface Visitor {
  id: ID;
  name: string;
  mobile: string;
  email: string;
  company?: string;
  hostMemberId: ID;
  locationId: ID;
  visitDate: ISODate;
  visitTime: string;
  purpose: string;
  status: VisitorStatus;
  passCode: string;
  photoCaptured: boolean;
  hostNotified: boolean;
  checkInAt?: ISODateTime;
  checkOutAt?: ISODateTime;
  createdAt: ISODateTime;
  notifiedVia: ('SMS' | 'EMAIL')[];
}

/* ---------------- Access control ---------------- */
export type AccessState = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'OVERDUE';

export interface AccessCredential {
  id: ID;
  holderId: ID;
  holderName: string;
  holderType: 'MEMBER' | 'VISITOR' | 'STAFF';
  locationId: ID;
  code: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  issuedAt: ISODateTime;
  validUntil: ISODate;
  accessHours: string;
  revokedReason?: string;
}

export interface AccessLog {
  id: ID;
  person: string;
  personType: 'MEMBER' | 'VISITOR' | 'STAFF';
  personId: ID;
  locationId: ID;
  door: string;
  at: ISODateTime;
  direction: 'IN' | 'OUT';
  status: 'GRANTED' | 'DENIED';
  reason?: string;
}

/* ---------------- Support ---------------- */
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const TICKET_CATEGORIES = [
  'Wi-Fi / Internet',
  'Air Conditioning',
  'Cleaning',
  'Electrical',
  'Furniture',
  'Access Card / QR',
  'Billing',
  'Meeting Room AV',
  'Pantry',
  'Other',
];

export interface Ticket {
  id: ID;
  memberId: ID;
  locationId: ID;
  category: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  resolvedAt?: ISODateTime;
  escalated: boolean;
  escalatedTo?: string;
  attachments: Attachment[];
  comments: Comment[];
  timeline: TimelineEntry[];
}

/* ---------------- Notifications ---------------- */
export type NotificationCategory = 'BOOKING' | 'PAYMENT' | 'MEMBERSHIP' | 'VISITOR' | 'SUPPORT' | 'SYSTEM';
export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH';

export interface AppNotification {
  id: ID;
  audience: 'MEMBER' | 'STAFF';
  /** Specific recipient, or undefined for everyone in the audience. */
  userId?: ID;
  category: NotificationCategory;
  title: string;
  message: string;
  at: ISODateTime;
  read: boolean;
  link?: string;
}

export interface NotificationTemplate {
  id: ID;
  name: string;
  event: string;
  channel: NotificationChannel;
  subject: string;
  message: string;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: ISODateTime;
}

export interface NotificationLog {
  id: ID;
  event: string;
  templateName: string;
  channel: NotificationChannel;
  recipient: string;
  at: ISODateTime;
  status: 'DELIVERED' | 'FAILED' | 'QUEUED';
  /** Provider that delivered the message (from Configuration / Integrations). */
  provider?: string;
  locationId: ID;
}

/* ---------------- Audit ---------------- */
export interface AuditLog {
  id: ID;
  user: string;
  role: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'APPROVE' | 'STATUS_CHANGE';
  module: string;
  entity: string;
  entityId: ID;
  at: ISODateTime;
  ip: string;
  device: string;
  description: string;
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

/** Maps every status value used in Officera to a badge tone, in one place. */
const STATUS_TONES: Record<string, Tone> = {
  // generic
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  PUBLISHED: 'success',
  DRAFT: 'neutral',
  HIDDEN: 'neutral',
  COMING_SOON: 'info',
  MAINTENANCE: 'warning',
  INVITED: 'info',
  LOCKED: 'danger',
  PENDING: 'warning',
  // membership
  PAUSED: 'warning',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  OVERDUE: 'danger',
  SUSPENDED: 'danger',
  PENDING_PAYMENT: 'warning',
  // bookings
  CONFIRMED: 'success',
  COMPLETED: 'info',
  NOT_REQUIRED: 'neutral',
  // payments & finance
  SUCCESS: 'success',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'info',
  UNPAID: 'warning',
  PARTIALLY_PAID: 'warning',
  REQUESTED: 'warning',
  APPROVED: 'info',
  PROCESSED: 'success',
  REJECTED: 'danger',
  ISSUED: 'info',
  APPLIED: 'success',
  VOID: 'neutral',
  // visitors
  EXPECTED: 'info',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'neutral',
  // access
  REVOKED: 'danger',
  GRANTED: 'success',
  DENIED: 'danger',
  IN: 'success',
  OUT: 'neutral',
  // tickets
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
  // leads
  NEW: 'info',
  CONTACTED: 'primary',
  TOUR_SCHEDULED: 'warning',
  TOUR_DONE: 'warning',
  CONVERTED: 'success',
  LOST: 'danger',
  // notifications
  DELIVERED: 'success',
  QUEUED: 'warning',
  // integrations
  CONNECTED: 'success',
  NOT_CONFIGURED: 'warning',
  ERROR: 'danger',
  DISABLED: 'neutral',
  UNTESTED: 'info',
  SANDBOX: 'warning',
  LIVE: 'success',
  // floor map
  AVAILABLE: 'success',
  BOOKED: 'danger',
  SELECTED: 'primary',
  BLOCKED: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  TOUR_DONE: 'Tour Done',
  NOT_REQUIRED: 'Covered by credits',
  CHECKED_IN: 'Checked In',
  CHECKED_OUT: 'Checked Out',
  PENDING_PAYMENT: 'Payment Pending',
  IN: 'Entry',
  OUT: 'Exit',
  SUCCESS: 'Success',
};

export function statusTone(status: string | null | undefined): Tone {
  return (status && STATUS_TONES[status]) || 'neutral';
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

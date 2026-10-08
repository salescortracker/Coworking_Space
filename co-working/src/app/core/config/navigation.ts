/**
 * Navigation configuration for the member portal and operator console.
 * Admin items declare the permission required to see them; the sidebar filters by role.
 */
export interface NavItem {
  label: string;
  icon?: string;
  link?: string;
  permission?: string;
  children?: NavItem[];
  /** Matches the active state on exact URL only. */
  exact?: boolean;
}

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', link: '/admin/dashboard', permission: 'dashboard.view' },
  { label: 'Front Desk', icon: 'monitor', link: '/admin/front-desk', permission: 'frontdesk.view' },
  {
    label: 'Workspace Management',
    icon: 'building',
    children: [
      { label: 'Locations', link: '/admin/locations', permission: 'locations.view' },
      { label: 'Resources', link: '/admin/resources', permission: 'resources.view' },
      { label: 'Floor Maps', link: '/admin/floor-maps', permission: 'resources.view' },
    ],
  },
  {
    label: 'Membership',
    icon: 'membership',
    children: [
      { label: 'Plans', link: '/admin/membership/plans', permission: 'plans.view' },
      { label: 'Subscriptions', link: '/admin/membership/subscriptions', permission: 'subscriptions.view' },
      { label: 'Credits', link: '/admin/membership/credits', permission: 'subscriptions.view' },
      { label: 'Promotions', link: '/admin/membership/promotions', permission: 'plans.view' },
    ],
  },
  {
    label: 'Bookings',
    icon: 'calendar',
    children: [
      { label: 'All Bookings', link: '/admin/bookings', permission: 'bookings.view', exact: true },
      { label: 'Calendar', link: '/admin/bookings/calendar', permission: 'bookings.view' },
      { label: 'Availability', link: '/admin/bookings/availability', permission: 'bookings.view' },
    ],
  },
  {
    label: 'Members',
    icon: 'users',
    children: [
      { label: 'Members', link: '/admin/members', permission: 'members.view', exact: true },
      { label: 'Companies', link: '/admin/members/companies', permission: 'members.view' },
      { label: 'Visitors', link: '/admin/members/visitors', permission: 'visitors.view' },
    ],
  },
  {
    label: 'Finance',
    icon: 'wallet',
    children: [
      { label: 'Overview', link: '/admin/finance', permission: 'payments.view', exact: true },
      { label: 'Payments', link: '/admin/finance/payments', permission: 'payments.view' },
      { label: 'Invoices', link: '/admin/finance/invoices', permission: 'invoices.view' },
      { label: 'Refunds', link: '/admin/finance/refunds', permission: 'refunds.view' },
      { label: 'Credit Notes', link: '/admin/finance/credit-notes', permission: 'invoices.view' },
      { label: 'Outstanding Dues', link: '/admin/finance/dues', permission: 'dues.view' },
      { label: 'Accounting Export', link: '/admin/finance/export', permission: 'accounting.view' },
    ],
  },
  {
    label: 'Access Control',
    icon: 'shield',
    children: [
      { label: 'Access', link: '/admin/access', permission: 'access.view', exact: true },
      { label: 'QR Credentials', link: '/admin/access/credentials', permission: 'access.view' },
      { label: 'Entry/Exit Logs', link: '/admin/access/logs', permission: 'access.view' },
    ],
  },
  {
    label: 'Support',
    icon: 'support',
    children: [
      { label: 'Tickets', link: '/admin/support', permission: 'support.view', exact: true },
      { label: 'Escalations', link: '/admin/support/escalations', permission: 'support.view' },
    ],
  },
  {
    label: 'Community',
    icon: 'message',
    children: [
      { label: 'Posts', link: '/admin/community/posts', permission: 'community.view' },
      { label: 'Events', link: '/admin/community/events', permission: 'community.view' },
      { label: 'Directory', link: '/admin/community/directory', permission: 'community.view' },
      { label: 'Partner Perks', link: '/admin/community/perks', permission: 'community.view' },
    ],
  },
  {
    label: 'Leads',
    icon: 'target',
    children: [
      { label: 'Leads', link: '/admin/leads', permission: 'leads.view', exact: true },
      { label: 'Follow-ups', link: '/admin/leads/follow-ups', permission: 'leads.view' },
      { label: 'Conversion', link: '/admin/leads/conversion', permission: 'leads.view' },
    ],
  },
  {
    label: 'Marketing / Content',
    icon: 'megaphone',
    children: [
      { label: 'Blog', link: '/admin/content/blog', permission: 'content.view' },
      { label: 'Gallery', link: '/admin/content/gallery', permission: 'content.view' },
      { label: 'Homepage Content', link: '/admin/content/homepage', permission: 'content.view' },
    ],
  },
  {
    label: 'Notifications',
    icon: 'bell',
    children: [
      { label: 'Notification Center', link: '/admin/notifications', permission: 'dashboard.view', exact: true },
      { label: 'Templates', link: '/admin/notifications/templates', permission: 'notifications.view' },
      { label: 'Notification Logs', link: '/admin/notifications/logs', permission: 'notifications.view' },
    ],
  },
  {
    label: 'Reports',
    icon: 'chart',
    children: [
      { label: 'All Reports', link: '/admin/reports', permission: 'reports.view', exact: true },
      { label: 'Occupancy', link: '/admin/reports/occupancy', permission: 'reports.view' },
      { label: 'Revenue', link: '/admin/reports/revenue', permission: 'reports.view' },
      { label: 'Membership', link: '/admin/reports/membership', permission: 'reports.view' },
      { label: 'Churn', link: '/admin/reports/churn', permission: 'reports.view' },
      { label: 'Dues', link: '/admin/reports/dues', permission: 'reports.view' },
      { label: 'Booking', link: '/admin/reports/bookings', permission: 'reports.view' },
      { label: 'Top Rooms', link: '/admin/reports/top-rooms', permission: 'reports.view' },
      { label: 'Leads', link: '/admin/reports/leads', permission: 'reports.view' },
      { label: 'Lead Conversion', link: '/admin/reports/lead-conversion', permission: 'reports.view' },
    ],
  },
  { label: 'Configuration / Integrations', icon: 'sliders', link: '/admin/integrations', permission: 'integrations.view' },
  {
    label: 'Administration',
    icon: 'settings',
    children: [
      { label: 'Users', link: '/admin/administration/users', permission: 'users.view' },
      { label: 'Roles', link: '/admin/administration/roles', permission: 'users.view' },
      { label: 'Permissions', link: '/admin/administration/permissions', permission: 'users.view' },
      { label: 'Audit Logs', link: '/admin/administration/audit', permission: 'audit.view' },
      { label: 'Settings', link: '/admin/administration/settings', permission: 'settings.view' },
    ],
  },
];

export const MEMBER_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', link: '/member/dashboard' },
  { label: 'My Profile', icon: 'user', link: '/member/profile' },
  { label: 'My Company', icon: 'briefcase', link: '/member/company' },
  { label: 'Membership', icon: 'membership', link: '/member/membership' },
  { label: 'Bookings', icon: 'calendar', link: '/member/bookings' },
  { label: 'Calendar', icon: 'clock', link: '/member/calendar' },
  { label: 'Payments', icon: 'credit-card', link: '/member/payments' },
  { label: 'Invoices', icon: 'receipt', link: '/member/invoices' },
  { label: 'Visitors', icon: 'user-plus', link: '/member/visitors' },
  { label: 'Access / QR', icon: 'qr', link: '/member/access' },
  { label: 'Support', icon: 'support', link: '/member/support' },
  { label: 'Community', icon: 'message', link: '/member/community' },
  { label: 'Events', icon: 'star', link: '/member/events' },
  { label: 'Member Directory', icon: 'users', link: '/member/directory' },
  { label: 'Partner Perks', icon: 'gift', link: '/member/perks' },
  { label: 'Notifications', icon: 'bell', link: '/member/notifications' },
];

/** Mobile bottom navigation for members (most used destinations). */
export const MEMBER_BOTTOM_NAV: NavItem[] = [
  { label: 'Home', icon: 'home', link: '/member/dashboard' },
  { label: 'Book', icon: 'calendar', link: '/member/bookings' },
  { label: 'Access', icon: 'qr', link: '/member/access' },
  { label: 'Visitors', icon: 'user-plus', link: '/member/visitors' },
];

export const PUBLIC_NAV: NavItem[] = [
  { label: 'Locations', link: '/locations' },
  { label: 'Find Workspace', link: '/search' },
  { label: 'Membership', link: '/membership' },
  { label: 'Events', link: '/events' },
  { label: 'Blog', link: '/blog' },
  { label: 'About', link: '/about' },
  { label: 'Contact', link: '/contact' },
];

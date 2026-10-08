import { Routes } from '@angular/router';

/** Member portal: each module is lazy-loaded independently. */
export const MEMBER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', title: 'Dashboard · Officera', loadComponent: () => import('./dashboard/member-dashboard.component').then((m) => m.MemberDashboardComponent) },
  { path: 'profile', title: 'My profile · Officera', loadComponent: () => import('./profile/member-profile.component').then((m) => m.MemberProfileComponent) },
  { path: 'company', title: 'My company · Officera', loadComponent: () => import('./profile/member-profile.component').then((m) => m.MemberCompanyComponent) },
  {
    path: 'membership',
    loadChildren: () => import('./membership/membership.routes').then((m) => m.MEMBERSHIP_ROUTES),
  },
  {
    path: 'bookings',
    loadChildren: () => import('./bookings/bookings.routes').then((m) => m.BOOKING_ROUTES),
  },
  { path: 'calendar', title: 'Calendar · Officera', loadComponent: () => import('./bookings/member-calendar.component').then((m) => m.MemberCalendarComponent) },
  { path: 'visitors', loadChildren: () => import('./operations.routes').then((m) => m.MEMBER_VISITOR_ROUTES) },
  { path: 'access', title: 'Access / QR · Officera', loadComponent: () => import('./access/member-access.component').then((m) => m.MemberAccessComponent) },
  { path: 'support', loadChildren: () => import('./operations.routes').then((m) => m.MEMBER_SUPPORT_ROUTES) },
  { path: 'community', title: 'Community · Officera', loadComponent: () => import('./community/member-community.component').then((m) => m.CommunityFeedComponent) },
  { path: 'events', title: 'Events · Officera', loadComponent: () => import('./community/member-community.component').then((m) => m.MemberEventsComponent) },
  { path: 'directory', title: 'Member directory · Officera', loadComponent: () => import('./community/member-community.component').then((m) => m.MemberDirectoryComponent) },
  { path: 'perks', title: 'Partner perks · Officera', loadComponent: () => import('./community/member-community.component').then((m) => m.MemberPerksComponent) },
  { path: 'notifications', title: 'Notifications · Officera', loadComponent: () => import('../shared-pages/notification-center.component').then((m) => m.NotificationCenterComponent) },
  {
    path: '',
    loadChildren: () => import('./payments/payments.routes').then((m) => m.PAYMENT_ROUTES),
  },
];

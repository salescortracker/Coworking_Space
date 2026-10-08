import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/auth.guards';

export const FRONT_DESK_ROUTES: Routes = [
  { path: '', title: 'Front desk · Officera', loadComponent: () => import('./front-desk.component').then((m) => m.FrontDeskComponent) },
];

export const ACCESS_ADMIN_ROUTES: Routes = [
  { path: '', title: 'Access control · Officera', loadComponent: () => import('./access-admin.component').then((m) => m.AccessDashboardComponent) },
  { path: 'credentials', title: 'QR credentials · Officera', loadComponent: () => import('./access-admin.component').then((m) => m.CredentialsComponent) },
  { path: 'logs', title: 'Entry/exit logs · Officera', loadComponent: () => import('./access-admin.component').then((m) => m.AccessLogsComponent) },
];

export const SUPPORT_ADMIN_ROUTES: Routes = [
  { path: '', title: 'Support tickets · Officera', loadComponent: () => import('./support-admin.component').then((m) => m.TicketsAdminComponent) },
  { path: 'escalations', title: 'Escalations · Officera', loadComponent: () => import('./support-admin.component').then((m) => m.TicketsAdminComponent) },
  { path: ':id', title: 'Ticket · Officera', loadComponent: () => import('../../member/support/member-support.component').then((m) => m.TicketDetailComponent) },
];

export const NOTIFICATION_ADMIN_ROUTES: Routes = [
  { path: '', title: 'Notifications · Officera', loadComponent: () => import('../../shared-pages/notification-center.component').then((m) => m.NotificationCenterComponent) },
  { path: 'templates', title: 'Notification templates · Officera', canMatch: [roleGuard], data: { permission: 'notifications.view' }, loadComponent: () => import('./notifications-admin.component').then((m) => m.NotificationTemplatesComponent) },
  { path: 'logs', title: 'Notification logs · Officera', canMatch: [roleGuard], data: { permission: 'notifications.view' }, loadComponent: () => import('./notifications-admin.component').then((m) => m.NotificationLogsComponent) },
];

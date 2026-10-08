import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/auth.guards';

/**
 * Operator console. Every module is lazy-loaded and protected by the
 * permission matrix (roleGuard + route data).
 */
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', title: 'Dashboard · Officera', loadComponent: () => import('./dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent) },
  {
    path: 'reports',
    canMatch: [roleGuard],
    data: { permission: 'reports.view' },
    children: [
      { path: '', title: 'Reports · Officera', loadComponent: () => import('./reports/reports.component').then((m) => m.ReportsIndexComponent) },
      { path: ':type', title: 'Report · Officera', loadComponent: () => import('./reports/reports.component').then((m) => m.ReportComponent) },
    ],
  },
  {
    path: 'locations',
    canMatch: [roleGuard],
    data: { permission: 'locations.view' },
    loadChildren: () => import('./workspace/workspace.routes').then((m) => m.LOCATION_ROUTES),
  },
  {
    path: 'resources',
    canMatch: [roleGuard],
    data: { permission: 'resources.view' },
    loadChildren: () => import('./workspace/workspace.routes').then((m) => m.RESOURCE_ROUTES),
  },
  {
    path: 'floor-maps',
    canMatch: [roleGuard],
    data: { permission: 'resources.view' },
    loadChildren: () => import('./workspace/workspace.routes').then((m) => m.FLOOR_MAP_ROUTES),
  },
  {
    path: 'membership',
    loadChildren: () => import('./membership/membership-admin.routes').then((m) => m.MEMBERSHIP_ADMIN_ROUTES),
  },
  {
    path: 'bookings',
    canMatch: [roleGuard],
    data: { permission: 'bookings.view' },
    loadChildren: () => import('./bookings/bookings-admin.routes').then((m) => m.BOOKINGS_ADMIN_ROUTES),
  },
  {
    path: 'members',
    loadChildren: () => import('./members/members-admin.routes').then((m) => m.MEMBERS_ADMIN_ROUTES),
  },
  {
    path: 'finance',
    canMatch: [roleGuard],
    data: { permission: 'payments.view' },
    loadChildren: () => import('./finance/finance-admin.routes').then((m) => m.FINANCE_ADMIN_ROUTES),
  },
  {
    path: 'front-desk',
    canMatch: [roleGuard],
    data: { permission: 'frontdesk.view' },
    loadChildren: () => import('./operations/operations.routes').then((m) => m.FRONT_DESK_ROUTES),
  },
  {
    path: 'access',
    canMatch: [roleGuard],
    data: { permission: 'access.view' },
    loadChildren: () => import('./operations/operations.routes').then((m) => m.ACCESS_ADMIN_ROUTES),
  },
  {
    path: 'support',
    canMatch: [roleGuard],
    data: { permission: 'support.view' },
    loadChildren: () => import('./operations/operations.routes').then((m) => m.SUPPORT_ADMIN_ROUTES),
  },
  {
    path: 'community',
    canMatch: [roleGuard],
    data: { permission: 'community.view' },
    loadChildren: () => import('./community/community-admin.routes').then((m) => m.COMMUNITY_ADMIN_ROUTES),
  },
  {
    path: 'leads',
    canMatch: [roleGuard],
    data: { permission: 'leads.view' },
    loadChildren: () => import('./leads/leads-admin.routes').then((m) => m.LEADS_ADMIN_ROUTES),
  },
  {
    path: 'content',
    canMatch: [roleGuard],
    data: { permission: 'content.view' },
    loadChildren: () => import('./leads/leads-admin.routes').then((m) => m.CONTENT_ADMIN_ROUTES),
  },
  {
    path: 'notifications',
    loadChildren: () => import('./operations/operations.routes').then((m) => m.NOTIFICATION_ADMIN_ROUTES),
  },
  {
    path: 'integrations',
    canMatch: [roleGuard],
    data: { roles: ['SUPER_ADMIN'], permission: 'integrations.view' },
    loadChildren: () => import('./integrations/integrations.routes').then((m) => m.INTEGRATION_ROUTES),
  },
  {
    path: 'administration',
    loadChildren: () => import('./administration/administration.routes').then((m) => m.ADMINISTRATION_ROUTES),
  },
  { path: 'profile', title: 'My profile · Officera', loadComponent: () => import('./administration/staff-profile.component').then((m) => m.StaffProfileComponent) },
  { path: 'forbidden', title: 'Access restricted · Officera', loadComponent: () => import('../misc/misc-pages.component').then((m) => m.ForbiddenComponent) },
  { path: '**', loadComponent: () => import('../misc/misc-pages.component').then((m) => m.NotFoundComponent) },
];

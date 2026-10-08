import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/auth.guards';

export const ADMINISTRATION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  { path: 'users', title: 'Users · Officera', canMatch: [roleGuard], data: { permission: 'users.view' }, loadComponent: () => import('./users.component').then((m) => m.UsersComponent) },
  { path: 'roles', title: 'Roles · Officera', canMatch: [roleGuard], data: { permission: 'users.view' }, loadComponent: () => import('./roles.component').then((m) => m.RolesComponent) },
  { path: 'permissions', title: 'Permissions · Officera', canMatch: [roleGuard], data: { permission: 'users.view' }, loadComponent: () => import('./roles.component').then((m) => m.PermissionsComponent) },
  { path: 'audit', title: 'Audit logs · Officera', canMatch: [roleGuard], data: { permission: 'audit.view' }, loadComponent: () => import('./audit-logs.component').then((m) => m.AuditLogsComponent) },
  { path: 'settings', title: 'Settings · Officera', canMatch: [roleGuard], data: { permission: 'settings.view' }, loadComponent: () => import('./settings.component').then((m) => m.SettingsComponent) },
];

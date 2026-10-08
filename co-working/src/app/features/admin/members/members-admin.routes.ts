import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/auth.guards';

export const MEMBERS_ADMIN_ROUTES: Routes = [
  { path: '', title: 'Members · Officera', loadComponent: () => import('./members-admin.component').then((m) => m.MembersAdminComponent) },
  { path: 'new', title: 'Add member · Officera', canMatch: [roleGuard], data: { permission: 'members.create' }, loadComponent: () => import('./member-form.component').then((m) => m.MemberFormComponent) },
  { path: 'visitors', title: 'Visitors · Officera', canMatch: [roleGuard], data: { permission: 'visitors.view' }, loadComponent: () => import('../operations/front-desk.component').then((m) => m.VisitorsAdminComponent) },
  { path: 'companies', title: 'Companies · Officera', loadComponent: () => import('./members-admin.component').then((m) => m.CompaniesComponent) },
  { path: ':id/edit', title: 'Edit member · Officera', canMatch: [roleGuard], data: { permission: 'members.edit' }, loadComponent: () => import('./member-form.component').then((m) => m.MemberFormComponent) },
  { path: ':id', title: 'Member · Officera', loadComponent: () => import('./members-admin.component').then((m) => m.MemberAdminDetailComponent) },
];

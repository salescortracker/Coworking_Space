import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/auth.guards';

export const MEMBERSHIP_ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'plans' },
  { path: 'plans', title: 'Plans · Officera', canMatch: [roleGuard], data: { permission: 'plans.view' }, loadComponent: () => import('./plans-admin.component').then((m) => m.PlansAdminComponent) },
  { path: 'plans/new', title: 'Create plan · Officera', canMatch: [roleGuard], data: { permission: 'plans.create' }, loadComponent: () => import('./plans-admin.component').then((m) => m.PlanFormComponent) },
  { path: 'plans/:id/edit', title: 'Edit plan · Officera', canMatch: [roleGuard], data: { permission: 'plans.edit' }, loadComponent: () => import('./plans-admin.component').then((m) => m.PlanFormComponent) },
  { path: 'plans/:id', title: 'Plan · Officera', canMatch: [roleGuard], data: { permission: 'plans.view' }, loadComponent: () => import('./plans-admin.component').then((m) => m.PlanDetailComponent) },
  { path: 'subscriptions', title: 'Subscriptions · Officera', canMatch: [roleGuard], data: { permission: 'subscriptions.view' }, loadComponent: () => import('./subscriptions.component').then((m) => m.SubscriptionsComponent) },
  { path: 'credits', title: 'Credits · Officera', canMatch: [roleGuard], data: { permission: 'subscriptions.view' }, loadComponent: () => import('./subscriptions.component').then((m) => m.CreditsComponent) },
  { path: 'promotions', title: 'Promotions · Officera', canMatch: [roleGuard], data: { permission: 'plans.view' }, loadComponent: () => import('./subscriptions.component').then((m) => m.PromotionsComponent) },
];

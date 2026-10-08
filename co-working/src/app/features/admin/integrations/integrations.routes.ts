import { Routes } from '@angular/router';

/** Configuration / Integrations – Super Admin only (guarded in admin.routes.ts). */
export const INTEGRATION_ROUTES: Routes = [
  { path: '', title: 'Configuration / Integrations', loadComponent: () => import('./integrations.component').then((m) => m.IntegrationsComponent) },
  { path: ':category', title: 'Integration settings', loadComponent: () => import('./integrations.component').then((m) => m.IntegrationCategoryComponent) },
];

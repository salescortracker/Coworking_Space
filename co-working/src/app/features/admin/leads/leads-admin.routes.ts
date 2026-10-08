import { Routes } from '@angular/router';

export const LEADS_ADMIN_ROUTES: Routes = [
  { path: '', title: 'Leads · Officera', loadComponent: () => import('./leads-admin.component').then((m) => m.LeadsAdminComponent) },
  { path: 'follow-ups', title: 'Follow-ups · Officera', loadComponent: () => import('./leads-admin.component').then((m) => m.FollowUpsComponent) },
  { path: 'conversion', title: 'Conversion · Officera', loadComponent: () => import('./leads-admin.component').then((m) => m.LeadConversionComponent) },
  { path: ':id', title: 'Lead · Officera', loadComponent: () => import('./leads-admin.component').then((m) => m.LeadDetailComponent) },
];

export const CONTENT_ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'blog' },
  { path: 'blog', title: 'Blog · Officera', loadComponent: () => import('../content/content-admin.component').then((m) => m.BlogAdminComponent) },
  { path: 'gallery', title: 'Gallery · Officera', loadComponent: () => import('../content/content-admin.component').then((m) => m.GalleryAdminComponent) },
  { path: 'homepage', title: 'Homepage content · Officera', loadComponent: () => import('../content/content-admin.component').then((m) => m.HomepageAdminComponent) },
];

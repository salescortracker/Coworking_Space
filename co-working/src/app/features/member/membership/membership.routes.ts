import { Routes } from '@angular/router';

export const MEMBERSHIP_ROUTES: Routes = [
  { path: '', title: 'Membership · Officera', loadComponent: () => import('./membership.component').then((m) => m.MembershipComponent) },
  { path: 'plans', title: 'Plans · Officera', loadComponent: () => import('./plans.component').then((m) => m.MemberPlansComponent) },
];

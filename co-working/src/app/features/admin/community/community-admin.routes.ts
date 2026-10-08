import { Routes } from '@angular/router';

export const COMMUNITY_ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'posts' },
  { path: 'posts', title: 'Posts · Officera', loadComponent: () => import('./community-admin.component').then((m) => m.PostsAdminComponent) },
  { path: 'events', title: 'Events · Officera', loadComponent: () => import('./community-admin.component').then((m) => m.EventsAdminComponent) },
  { path: 'directory', title: 'Directory · Officera', loadComponent: () => import('./community-admin.component').then((m) => m.DirectoryAdminComponent) },
  { path: 'perks', title: 'Partner perks · Officera', loadComponent: () => import('./community-admin.component').then((m) => m.PerksAdminComponent) },
];

import { Routes } from '@angular/router';
import { memberGuard, staffGuard } from './core/guards/auth.guards';

/**
 * Three experiences, each with its own shell and lazy-loaded feature modules:
 *   Public website   →  /, /search, /locations, /book-now … (+ auth screens)
 *   Member portal    →  /member/**
 *   Operator console →  /admin/**
 */
export const routes: Routes = [
  {
    path: 'member',
    canMatch: [memberGuard],
    loadComponent: () => import('./layouts/member-layout.component').then((m) => m.MemberLayoutComponent),
    loadChildren: () => import('./features/member/member.routes').then((m) => m.MEMBER_ROUTES),
  },
  {
    path: 'admin',
    canMatch: [staffGuard],
    loadComponent: () => import('./layouts/admin-layout.component').then((m) => m.AdminLayoutComponent),
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  // Public website first so "/" resolves to the homepage.
  {
    path: '',
    loadComponent: () => import('./layouts/public-layout.component').then((m) => m.PublicLayoutComponent),
    loadChildren: () => import('./features/public/public.routes').then((m) => m.PUBLIC_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./layouts/auth-layout.component').then((m) => m.AuthLayoutComponent),
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  { path: '**', loadComponent: () => import('./features/misc/misc-pages.component').then((m) => m.NotFoundComponent) },
];

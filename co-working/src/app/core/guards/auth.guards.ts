import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlSegment } from '@angular/router';
import { Role } from '../models';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/ui.service';

const urlOf = (segments: UrlSegment[]) => '/' + segments.map((s) => s.path).join('/');

/** Any signed-in user. */
export const authGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  auth.redirectUrl = urlOf(segments);
  return inject(Router).createUrlTree(['/login']);
};

/** Member portal. Staff are sent to the console. */
export const memberGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    auth.redirectUrl = urlOf(segments);
    return router.createUrlTree(['/login']);
  }
  return auth.isMember() ? true : router.createUrlTree([auth.homeUrl()]);
};

/** Operator console: any staff role. */
export const staffGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    auth.redirectUrl = urlOf(segments);
    return router.createUrlTree(['/login']);
  }
  return auth.isStaff() ? true : router.createUrlTree([auth.homeUrl()]);
};

/**
 * Role / permission guard. Route data:
 *   { roles: Role[] }        – any of these roles
 *   { permission: 'x.view' } – permission from the role matrix
 */
export const roleGuard: CanMatchFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data?.['roles'] as Role[] | undefined;
  const permission = route.data?.['permission'] as string | undefined;
  const ok = (!roles || auth.hasRole(...roles)) && (!permission || auth.can(permission));
  if (ok) return true;
  inject(ToastService).warning('Access restricted', 'Your role does not have permission to open that page.');
  return router.createUrlTree(['/admin/forbidden']);
};

/** Login / register pages: signed-in users go to their home. */
export const guestGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree([auth.homeUrl()]) : true;
};

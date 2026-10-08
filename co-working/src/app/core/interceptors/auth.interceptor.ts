import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../services/session.store';

/** Endpoints where a 401 means "wrong credentials", not "session expired". */
const AUTH_ENDPOINTS = ['/Auth/Login', '/Auth/LoginWithOtp', '/Auth/Register', '/Auth/VerifyOtp', '/Auth/SendOtp', '/Auth/ResetPassword', '/Auth/ChangePassword'];

/**
 * Adds "Authorization: Bearer {token}" to calls to the Officera API (environment.apiUrl only, never to
 * third-party URLs) and signs the user out when the API reports the token as expired or revoked.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const session = inject(SessionStore);
  const token = session.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !AUTH_ENDPOINTS.some((p) => req.url.includes(p))) {
        session.expire();
      }
      return throwError(() => err);
    }),
  );
};

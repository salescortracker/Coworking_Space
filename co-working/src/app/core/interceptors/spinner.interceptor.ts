import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SpinnerService, SpinnerMode } from '../services/spinner.service';

/** Opt a request out of the global spinner: `new HttpContext().set(SKIP_SPINNER, true)`. */
export const SKIP_SPINNER = new HttpContextToken<boolean>(() => false);

/**
 * Override the spinner mode for a request. Defaults: GET/HEAD → 'background' (top bar),
 * POST/PUT/PATCH/DELETE → 'blocking' (overlay).
 */
export const SPINNER_MODE = new HttpContextToken<SpinnerMode | null>(() => null);

/** Optional caption for blocking requests, e.g. "Processing payment…". */
export const SPINNER_MESSAGE = new HttpContextToken<string | undefined>(() => undefined);

/**
 * Starts the global spinner when an HTTP request begins and always stops it when the request
 * completes, errors or is cancelled (finalize via SpinnerService.track).
 */
export const spinnerInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_SPINNER)) return next(req);
  const spinner = inject(SpinnerService);
  const mode = req.context.get(SPINNER_MODE) ?? (req.method === 'GET' || req.method === 'HEAD' ? 'background' : 'blocking');
  return spinner.track(next(req), { mode, message: req.context.get(SPINNER_MESSAGE) });
};

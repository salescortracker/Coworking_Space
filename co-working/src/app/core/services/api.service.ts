import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, delay, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_SPINNER, SPINNER_MESSAGE, SPINNER_MODE } from '../interceptors/spinner.interceptor';
import { SpinnerMode } from './spinner.service';
import { Attachment } from '../models';
import { ClientStoreService } from './client-store.service';

/** Envelope returned by every Officera API endpoint (officera.Shared.Common.ApiResponse). */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors: string[];
  statusCode: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

/** Error raised for any failed API call. `message` is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: string[] = [],
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiCallOptions {
  /** Spinner behaviour: 'background' (top bar), 'blocking' (overlay) or 'none'. */
  spinner?: SpinnerMode | 'none';
  message?: string;
}

/**
 * The only place that talks to the Officera API. Builds URLs from environment.apiUrl, unwraps the
 * response envelope and turns failures into ApiError with a readable message.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(ClientStoreService);

  post<T>(path: string, body: unknown = {}, options: ApiCallOptions = {}): Observable<T> {
    const call$ = this.http
      .post<ApiEnvelope<T>>(`${environment.apiUrl}/${path}`, body ?? {}, { context: this.context(options) })
      .pipe(
        map((res) => res.data),
        catchError((e: unknown) => throwError(() => ApiService.toError(e))),
      );
    // Optional extra latency from Settings → Demo controls (to review loading states).
    const extra = this.store.latency();
    return extra > 0 ? of(null).pipe(delay(extra), switchMap(() => call$)) : call$;
  }

  /** Multipart upload to POST /api/File/Upload. Returns attachments carrying the stored file URL. */
  upload(files: File[], category: 'images' | 'documents' | 'profiles' | 'attachments', options: ApiCallOptions = {}): Observable<Attachment[]> {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    form.append('category', category);
    return this.http
      .post<ApiEnvelope<{ id: string; name: string; size: number; type: string; url: string }[]>>(`${environment.apiUrl}/File/Upload`, form, {
        context: this.context({ spinner: options.spinner ?? 'blocking', message: options.message ?? 'Uploading…' }),
      })
      .pipe(
        map((res) => res.data.map((f) => ({ id: f.id, name: f.name, size: f.size, type: f.type, url: f.url }))),
        catchError((e: unknown) => throwError(() => ApiService.toError(e))),
      );
  }

  /** Absolute URL for a path returned by the API (e.g. /uploads/images/x.jpg). */
  fileUrl(path: string | undefined | null): string {
    if (!path) return '';
    return /^https?:\/\//i.test(path) ? path : `${environment.baseurl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private context(options: ApiCallOptions): HttpContext {
    const ctx = new HttpContext();
    if (options.spinner === 'none') return ctx.set(SKIP_SPINNER, true);
    if (options.spinner) ctx.set(SPINNER_MODE, options.spinner);
    if (options.message) ctx.set(SPINNER_MESSAGE, options.message);
    return ctx;
  }

  static toError(e: unknown): ApiError {
    if (e instanceof ApiError) return e;
    if (e instanceof HttpErrorResponse) {
      const body = e.error as Partial<ApiEnvelope<unknown>> | null;
      if (body && typeof body === 'object' && typeof body.message === 'string') {
        return new ApiError(body.message, e.status, body.errors ?? [], body.data);
      }
      if (e.status === 0) return new ApiError('The Officera server could not be reached. Check your connection and try again.', 0);
      if (e.status === 401) return new ApiError('Please sign in to continue.', 401);
      if (e.status === 403) return new ApiError('You do not have permission to perform this action.', 403);
      if (e.status === 429) return new ApiError('Too many attempts. Please wait a minute and try again.', 429);
      return new ApiError('Something went wrong. Please try again.', e.status);
    }
    return new ApiError(e instanceof Error ? e.message : 'Something went wrong. Please try again.', 0);
  }
}

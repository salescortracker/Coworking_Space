import { DestroyRef, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Tracks loading / error / ready state for a page's initial data request.
 * Data itself is read from the services' signals; the loader only drives UI state.
 */
export class Loader<T = unknown> {
  readonly status = signal<LoadStatus>('loading');
  readonly error = signal('');
  readonly data = signal<T | undefined>(undefined);
  private sub?: Subscription;

  constructor(private readonly source: () => Observable<T>) {}

  load(): void {
    this.sub?.unsubscribe();
    this.status.set('loading');
    this.error.set('');
    this.sub = this.source().subscribe({
      next: (v) => {
        this.data.set(v);
        this.status.set('ready');
      },
      error: (e: Error) => {
        this.error.set(e?.message ?? 'Something went wrong.');
        this.status.set('error');
      },
    });
  }

  destroy(): void {
    this.sub?.unsubscribe();
  }
}

/** Must be called in an injection context (field initializer or constructor). */
export function createLoader<T>(source: () => Observable<T>, autoLoad = true): Loader<T> {
  const loader = new Loader<T>(source);
  inject(DestroyRef).onDestroy(() => loader.destroy());
  if (autoLoad) queueMicrotask(() => loader.load());
  return loader;
}

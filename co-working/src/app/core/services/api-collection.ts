import { Injector, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, defer, from, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiError, ApiService, PagedResult } from './api.service';
import { ClientStoreService } from './client-store.service';
import { IdPoolService } from './id-pool.service';
import { WriteQueueService } from './write-queue.service';
import { LOCATION_MATCHER } from './location-matcher.token';
import { ApiErrorBus } from './api-error-bus';

/** Every API-backed collection, so they can be loaded together at sign-in and cleared at sign-out. */
export const COLLECTIONS: ApiCollection<{ id: string }>[] = [];

/**
 * A module's records, loaded from the Officera API (POST /api/{Resource}/Get) into a signal that every screen
 * reads. Writes go to POST /api/{Resource}/Save | Update | Delete.
 *
 * The method names and signatures are the ones the screens already used, so no component changed:
 *  - list / get / create / update / remove return Observables that complete when the API has answered;
 *  - createSync / updateSync update the screen immediately and save in the background (business flows that
 *    create several related records in one go). If the API rejects the change, the record is reloaded from
 *    the server and the API's message is shown.
 */
export abstract class ApiCollection<T extends { id: string }> {
  protected readonly api = inject(ApiService);
  protected readonly store = inject(ClientStoreService);
  private readonly ids = inject(IdPoolService);
  private readonly queue = inject(WriteQueueService);
  private readonly injector = inject(Injector);

  /** Full collection (everything the signed-in user may see). */
  readonly items: WritableSignal<T[]> = signal<T[]>([]);

  /** Collection filtered by the global admin location selector. */
  readonly scoped: Signal<T[]>;

  /** True once the first load from the API has finished. */
  readonly loaded = signal(false);

  protected constructor(
    /** API controller name, e.g. "Location" → /api/Location/Get. */
    readonly resource: string,
    private readonly idPrefix: string,
    private readonly locationOf?: (item: T) => string | undefined,
  ) {
    this.scoped = computed(() => {
      const all = this.items();
      if (!this.locationOf) return all;
      const matches = this.injector.get(LOCATION_MATCHER)();
      return all.filter((i) => matches(this.locationOf!(i)));
    });
    COLLECTIONS.push(this as unknown as ApiCollection<{ id: string }>);
  }

  /** Loads (or reloads) the collection. Modules the user may not see simply stay empty. */
  load(): Promise<void> {
    return new Promise((resolve) => {
      this.fetch().subscribe({
        next: () => resolve(),
        error: () => {
          this.items.set([]);
          this.loaded.set(true);
          resolve();
        },
      });
    });
  }

  /** Empties the collection (sign-out). */
  reset(): void {
    this.items.set([]);
    this.loaded.set(false);
  }

  /** POST /{resource}/Get – reloads from the server after any pending saves. */
  list(): Observable<T[]> {
    return defer(() => from(this.queue.idle())).pipe(
      switchMap(() => (this.store.simulateErrors() ? throwError(() => new ApiError('The server could not be reached. Please try again.', 0)) : this.fetch())),
      map(() => this.items()),
    );
  }

  /** Same request; the location filter is applied on the screen. */
  listScoped(): Observable<T[]> {
    return this.list().pipe(map(() => this.scoped()));
  }

  /** POST /{resource}/GetById */
  get(id: string): Observable<T | undefined> {
    const cached = this.find(id);
    if (cached) return of(cached);
    return this.api.post<T>(`${this.resource}/GetById`, { id }, { spinner: 'background' }).pipe(
      tap((item) => this.upsert(item)),
      map((item) => item as T | undefined),
    );
  }

  /** Synchronous lookup from the loaded collection. */
  find(id: string | undefined): T | undefined {
    if (!id) return undefined;
    return this.items().find((i) => i.id === id);
  }

  /** POST /{resource}/Save – completes with the record as stored by the server. */
  create(data: Omit<T, 'id'> & { id?: string }): Observable<T> {
    return defer(() => {
      const entity = { ...data, id: data.id ?? this.ids.take(this.idPrefix) } as T;
      return from(this.queue.enqueue(() => this.api.post<T>(`${this.resource}/Save`, entity, { spinner: 'blocking', message: 'Saving…' }))).pipe(
        tap((saved) => this.upsert(saved, entity.id)),
      );
    });
  }

  /** Adds the record on screen now and saves it in the background. */
  createSync(data: Omit<T, 'id'> & { id?: string }): T {
    const entity = { ...data, id: data.id ?? this.ids.take(this.idPrefix) } as T;
    this.items.set([entity, ...this.items()]);
    this.background(`${this.resource}/Save`, entity, entity.id);
    return entity;
  }

  /** POST /{resource}/Update with the full merged record. */
  update(id: string, patch: Partial<T>): Observable<T> {
    return defer(() => {
      const current = this.find(id);
      if (!current) return throwError(() => new ApiError(`${this.resource} ${id} was not found.`, 404));
      const merged = { ...current, ...patch, id } as T;
      return from(this.queue.enqueue(() => this.api.post<T>(`${this.resource}/Update`, merged, { spinner: 'blocking', message: 'Saving changes…' }))).pipe(
        tap((saved) => this.upsert(saved)),
      );
    });
  }

  /** Updates the record on screen now and saves it in the background. */
  updateSync(id: string, patch: Partial<T>): T {
    const current = this.find(id);
    if (!current) throw new Error(`${this.resource} ${id} not found`);
    const merged = { ...current, ...patch, id } as T;
    this.items.set(this.items().map((i) => (i.id === id ? merged : i)));
    this.background(`${this.resource}/Update`, merged, id);
    return merged;
  }

  /** POST /{resource}/Delete */
  remove(id: string): Observable<void> {
    return defer(() =>
      from(this.queue.enqueue(() => this.api.post<unknown>(`${this.resource}/Delete`, { id }, { spinner: 'blocking', message: 'Deleting…' }))).pipe(
        tap(() => this.items.set(this.items().filter((i) => i.id !== id))),
        map(() => undefined),
      ),
    );
  }

  /** Replaces (or adds) a record with the server's version. */
  protected upsert(item: T, previousId = item.id): void {
    const list = this.items();
    const exists = list.some((i) => i.id === previousId);
    this.items.set(exists ? list.map((i) => (i.id === previousId ? item : i)) : [item, ...list]);
  }

  /** Extra request body for the Get call (e.g. include inactive rows). */
  protected getRequest(): Record<string, unknown> {
    return { pageNumber: 1, pageSize: 0 };
  }

  private fetch(): Observable<void> {
    return this.api.post<PagedResult<T>>(`${this.resource}/Get`, this.getRequest(), { spinner: 'background' }).pipe(
      map((page) => {
        this.items.set(page.items);
        this.loaded.set(true);
      }),
    );
  }

  private background(path: string, body: T, id: string): void {
    this.queue
      .enqueue(() => this.api.post<T>(path, body, { spinner: 'background' }))
      .then((saved) => this.upsert(saved, id))
      .catch((e: ApiError) => {
        this.injector.get(ApiErrorBus).publish('Could not save', e.message);
        this.load();
      });
  }
}

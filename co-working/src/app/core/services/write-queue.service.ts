import { Injectable, computed, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

/**
 * Sends writes to the API one after another, in the order the app made them.
 * Business flows create related records back to back (invoice → payment → booking), and the database
 * relationships require the earlier record to exist before the next one references it.
 */
@Injectable({ providedIn: 'root' })
export class WriteQueueService {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly pendingCount = signal(0);

  readonly busy = computed(() => this.pendingCount() > 0);

  enqueue<T>(task: () => Observable<T>): Promise<T> {
    this.pendingCount.update((n) => n + 1);
    const run = this.tail.then(() => firstValueFrom(task()));
    this.tail = run
      .catch(() => undefined)
      .finally(() => this.pendingCount.update((n) => Math.max(0, n - 1)));
    return run;
  }

  /** Resolves once every write queued so far has finished. */
  idle(): Promise<void> {
    return this.tail.then(() => undefined);
  }
}

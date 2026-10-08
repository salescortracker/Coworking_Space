import { Injectable, WritableSignal, computed, signal } from '@angular/core';
import { Observable, defer, finalize } from 'rxjs';

/**
 * How an operation is surfaced:
 *  - 'blocking'   → centred spinner on a semi-transparent overlay that prevents interaction
 *                   (saves, deletes, payments, login, configuration tests…)
 *  - 'background' → slim progress bar at the top of the screen, no interaction block
 *                   (page/route loads, list reads – pages also show their own skeletons)
 */
export type SpinnerMode = 'blocking' | 'background';

export interface SpinnerOptions {
  mode?: SpinnerMode;
  /** Optional caption under the blocking spinner, e.g. "Processing payment…". */
  message?: string;
}

/** Wait before showing anything so very fast operations never flash a spinner. */
const SHOW_DELAY_MS = 150;
/** Once visible, stay at least this long to avoid flicker. */
const MIN_VISIBLE_MS = 300;
/** Safety net: an operation that never completes must not lock the UI forever. */
const WATCHDOG_MS = 30_000;

interface Ticket {
  id: number;
  mode: SpinnerMode;
  message?: string;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Central, reference-counted loading state for the whole application.
 * Each `show()` returns a ticket; the spinner stays on until every ticket is released, so
 * overlapping requests never switch it off early:
 *   request 1 starts → ON · request 2 starts → ON · request 1 ends → ON · request 2 ends → OFF
 */
@Injectable({ providedIn: 'root' })
export class SpinnerService {
  private seq = 0;
  private readonly active = new Map<number, Ticket>();
  private readonly counts = signal({ blocking: 0, background: 0 });
  private readonly messages = signal<string[]>([]);
  private readonly shownBlocking = signal(false);
  private readonly shownBackground = signal(false);
  private showTimers: Partial<Record<SpinnerMode, ReturnType<typeof setTimeout>>> = {};
  private visibleSince: Partial<Record<SpinnerMode, number>> = {};

  /** Number of operations in flight, by mode. */
  readonly pending = this.counts.asReadonly();
  /** True while any operation is running (immediately, without the display delay). */
  readonly isLoading = computed(() => this.counts().blocking + this.counts().background > 0);
  /** True while a blocking operation is running – used to disable submit buttons. */
  readonly isBlocking = computed(() => this.counts().blocking > 0);
  /** Display flags consumed by <app-global-spinner> (include delay / minimum time). */
  readonly overlayVisible = this.shownBlocking.asReadonly();
  readonly barVisible = this.shownBackground.asReadonly();
  readonly message = computed(() => this.messages().at(-1) ?? '');

  /** Starts an operation. Returns a ticket id to pass to `hide()`. */
  show(options: SpinnerOptions = {}): number {
    const mode = options.mode ?? 'blocking';
    const id = ++this.seq;
    const timer = setTimeout(() => {
      console.warn(`[Officera] Spinner ticket ${id} released by watchdog after ${WATCHDOG_MS / 1000}s.`);
      this.hide(id);
    }, WATCHDOG_MS);
    this.active.set(id, { id, mode, message: options.message, timer });
    this.recount();
    return id;
  }

  /** Ends an operation. Safe to call twice and never lets the counter go below zero. */
  hide(id?: number): void {
    if (id === undefined) {
      // Manual counterpart of an un-ticketed show(): release the most recent ticket.
      id = [...this.active.keys()].at(-1);
      if (id === undefined) return;
    }
    const t = this.active.get(id);
    if (!t) return;
    clearTimeout(t.timer);
    this.active.delete(id);
    this.recount();
  }

  /** Wraps an Observable: spinner on at subscribe, off on complete, error or unsubscribe. */
  track<T>(source: Observable<T>, options: SpinnerOptions = {}): Observable<T> {
    return defer(() => {
      const id = this.show(options);
      return source.pipe(finalize(() => this.hide(id)));
    });
  }

  /** Wraps a Promise or async function the same way. */
  async run<T>(work: Promise<T> | (() => Promise<T>), options: SpinnerOptions = {}): Promise<T> {
    const id = this.show(options);
    try {
      return await (typeof work === 'function' ? work() : work);
    } finally {
      this.hide(id);
    }
  }

  /**
   * Runs simulated asynchronous work (mock gateways, syncs) after `ms` under a spinner ticket.
   * The ticket is always released, even if the work throws.
   */
  after(ms: number, work: () => void, options: SpinnerOptions = {}): void {
    const id = this.show(options);
    setTimeout(() => {
      try {
        work();
      } finally {
        this.hide(id);
      }
    }, ms);
  }

  /** Emergency reset (e.g. after a hard navigation). */
  reset(): void {
    this.active.forEach((t) => clearTimeout(t.timer));
    this.active.clear();
    this.recount();
  }

  private recount(): void {
    let blocking = 0;
    let background = 0;
    const msgs: string[] = [];
    this.active.forEach((t) => {
      if (t.mode === 'blocking') blocking++;
      else background++;
      if (t.mode === 'blocking' && t.message) msgs.push(t.message);
    });
    this.counts.set({ blocking, background });
    this.messages.set(msgs);
    this.sync('blocking', blocking > 0, this.shownBlocking);
    this.sync('background', background > 0 || blocking > 0, this.shownBackground);
  }

  private sync(mode: SpinnerMode, wanted: boolean, flag: WritableSignal<boolean>): void {
    if (typeof window === 'undefined') return;
    if (wanted) {
      if (flag() || this.showTimers[mode]) return;
      this.showTimers[mode] = setTimeout(() => {
        this.showTimers[mode] = undefined;
        if ((mode === 'blocking' ? this.counts().blocking : this.counts().blocking + this.counts().background) > 0) {
          this.visibleSince[mode] = Date.now();
          flag.set(true);
        }
      }, SHOW_DELAY_MS);
    } else {
      if (this.showTimers[mode]) {
        clearTimeout(this.showTimers[mode]);
        this.showTimers[mode] = undefined;
      }
      if (!flag()) return;
      const remaining = MIN_VISIBLE_MS - (Date.now() - (this.visibleSince[mode] ?? 0));
      setTimeout(() => {
        const stillWanted = mode === 'blocking' ? this.counts().blocking > 0 : this.counts().blocking + this.counts().background > 0;
        if (!stillWanted) flag.set(false);
      }, Math.max(0, remaining));
    }
  }
}

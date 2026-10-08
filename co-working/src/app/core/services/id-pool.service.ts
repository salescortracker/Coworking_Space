import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { SessionStore } from './session.store';
import { ClientStoreService } from './client-store.service';

const REFILL_BELOW = 1;
const BATCH = 3;
const STORE_KEY = 'officera:id-pool';

/**
 * Human-readable ids (BKG-0042) reserved in advance from POST /api/Ids/Reserve, so a new record can be shown
 * (and linked to other records) immediately while it is being saved. The server issues each id only once.
 * Unused reservations are kept for the signed-in user across page reloads, so numbers are not skipped needlessly.
 */
@Injectable({ providedIn: 'root' })
export class IdPoolService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly store = inject(ClientStoreService);
  private pools = new Map<string, string[]>();
  private owner: string | null = null;
  private readonly refilling = new Set<string>();

  /** Next reserved id for the prefix. Falls back to a unique time-based id if the pool is empty. */
  take(prefix: string): string {
    this.restore();
    const pool = this.pools.get(prefix) ?? [];
    const id = pool.shift();
    this.pools.set(prefix, pool);
    this.persist();
    if (pool.length < REFILL_BELOW) this.refill([prefix]);
    if (id) return id;
    const unique = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`.toUpperCase();
    return `${prefix}-${unique}`;
  }

  /** Makes sure every prefix has at least one reserved id after sign-in (one request for all of them). */
  warmUp(prefixes: string[]): void {
    this.restore();
    this.refill(prefixes.filter((p) => (this.pools.get(p)?.length ?? 0) < REFILL_BELOW));
  }

  clear(): void {
    this.pools = new Map();
    this.owner = null;
  }

  private refill(prefixes: string[]): void {
    if (!this.session.isActive()) return;
    const wanted = prefixes.filter((p) => !this.refilling.has(p));
    if (!wanted.length) return;
    wanted.forEach((p) => this.refilling.add(p));
    this.api.post<Record<string, string[]>>('Ids/Reserve', { prefixes: wanted, count: BATCH }, { spinner: 'none' }).subscribe({
      next: (res) => {
        for (const [prefix, ids] of Object.entries(res)) this.pools.set(prefix, [...(this.pools.get(prefix) ?? []), ...ids]);
        this.persist();
        wanted.forEach((p) => this.refilling.delete(p));
      },
      error: () => wanted.forEach((p) => this.refilling.delete(p)),
    });
  }

  /** Loads the pools saved for the current user (ids are only valid for the user who reserved them). */
  private restore(): void {
    const userId = this.session.session()?.userId ?? null;
    if (this.owner === userId) return;
    this.owner = userId;
    const saved = this.store.read<{ userId: string; pools: Record<string, string[]> }>(STORE_KEY);
    this.pools = new Map(saved && saved.userId === userId ? Object.entries(saved.pools) : []);
  }

  private persist(): void {
    if (!this.owner) return;
    this.store.write(STORE_KEY, { userId: this.owner, pools: Object.fromEntries(this.pools) });
  }
}

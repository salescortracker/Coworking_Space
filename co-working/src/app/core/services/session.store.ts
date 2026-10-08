import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ClientStoreService } from './client-store.service';

const SESSION_KEY = 'officera:session';

export interface StoredSession {
  token: string;
  /** ISO date-time the JWT expires. */
  expiresAt: string;
  userId: string;
}

/**
 * Holds the JWT issued by POST /api/Auth/Login. Kept separate from AuthService so the HTTP interceptor
 * can read the token without depending on the data services.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly store = inject(ClientStoreService);
  private readonly current = signal<StoredSession | null>(this.readValid());

  /** Fires when the API rejects the token (expired / revoked) so the app can sign the user out. */
  readonly expired$ = new Subject<void>();

  readonly session = this.current.asReadonly();
  readonly token = computed(() => this.current()?.token ?? null);
  readonly isActive = computed(() => !!this.current());

  set(session: StoredSession): void {
    this.current.set(session);
    this.store.write(SESSION_KEY, session);
  }

  clear(): void {
    this.current.set(null);
    this.store.remove(SESSION_KEY);
  }

  /** Called by the interceptor on a 401 for an authenticated request. */
  expire(): void {
    if (!this.current()) return;
    this.clear();
    this.expired$.next();
  }

  private readValid(): StoredSession | null {
    const s = this.store.read<StoredSession>(SESSION_KEY);
    if (!s?.token || !s.expiresAt || new Date(s.expiresAt).getTime() <= Date.now()) {
      this.store.remove(SESSION_KEY);
      return null;
    }
    return s;
  }
}

import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const SETTINGS_KEY = 'officera:demo-settings';

interface DeveloperSettings {
  latency: number;
  simulateErrors: boolean;
}

/**
 * Browser-only storage for UI state (session token, selected location, checkout hand-off between pages).
 * Application data is never stored here: it always comes from the Officera API.
 *
 * The two developer switches (extra latency, simulated list errors) back the Settings → Demo controls tab so
 * loading and error states can still be reviewed against the real API.
 */
@Injectable({ providedIn: 'root' })
export class ClientStoreService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly latency = signal(0);
  readonly simulateErrors = signal(false);

  constructor() {
    const s = this.read<DeveloperSettings>(SETTINGS_KEY);
    if (s) {
      this.latency.set(s.latency);
      this.simulateErrors.set(s.simulateErrors);
    }
  }

  updateSettings(patch: Partial<DeveloperSettings>): void {
    if (patch.latency !== undefined) this.latency.set(patch.latency);
    if (patch.simulateErrors !== undefined) this.simulateErrors.set(patch.simulateErrors);
    this.write(SETTINGS_KEY, { latency: this.latency(), simulateErrors: this.simulateErrors() });
  }

  /** Clears everything Officera keeps in this browser (session, selections). Server data is untouched. */
  resetAll(): void {
    if (!this.isBrowser) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('officera:'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage unavailable */
    }
  }

  read<T>(key: string): T | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  write(key: string, value: unknown): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or privacy mode: keep working in memory */
    }
  }

  remove(key: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

import { Injectable, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CategoryDefinition, ConnectionTest, Integration, IntegrationCategory, ProviderDefinition, SecretRef } from '../models';
import { integrationCatalog } from '../config/integration-catalog';
import { ApiCollection } from './api-collection';

export interface IntegrationDraft {
  category: IntegrationCategory;
  providerKey: string;
  displayName: string;
  environment: Integration['environment'];
  config: Record<string, string>;
  /** Plain secret values typed by the admin. Sent once to the API, encrypted there, never kept in the browser. */
  secretInputs: Record<string, string>;
}

/**
 * Configuration / Integrations (Super Admin). Records live in the database (POST /api/Integration/*).
 *
 * Security model:
 *  - Non-secret settings (hosts, IDs, URLs) are stored like any other record.
 *  - Secret values (API keys, passwords, tokens) are sent once with the save request; the API encrypts them
 *    (ASP.NET Core Data Protection) and only returns a masked hint. Nothing secret is kept in the browser.
 *  - Users without integrations.view only receive which providers are active (no settings at all).
 */
@Injectable({ providedIn: 'root' })
export class IntegrationService extends ApiCollection<Integration> {
  private readonly defs = integrationCatalog();

  constructor() {
    super('Integration', 'INT');
  }

  readonly summary = computed(() => {
    const all = this.items();
    const required = this.defs.filter((c) => c.required);
    return {
      total: all.length,
      connected: all.filter((i) => i.enabled && i.status === 'CONNECTED').length,
      errors: all.filter((i) => i.enabled && i.status === 'ERROR').length,
      untested: all.filter((i) => i.enabled && (i.status === 'UNTESTED' || i.status === 'NOT_CONFIGURED')).length,
      missingRequired: required.filter((c) => !this.activeFor(c.key)).map((c) => c.label),
    };
  });

  catalog(): CategoryDefinition[] {
    return this.defs;
  }

  category(key: IntegrationCategory | string | undefined): CategoryDefinition | undefined {
    return this.defs.find((c) => c.key === key);
  }

  provider(category: IntegrationCategory | string | undefined, providerKey: string | undefined): ProviderDefinition | undefined {
    return this.category(category)?.providers.find((p) => p.key === providerKey);
  }

  forCategory(category: IntegrationCategory): Integration[] {
    return this.items().filter((i) => i.category === category);
  }

  /** The provider currently used by Officera for a category, if enabled. */
  activeFor(category: IntegrationCategory): Integration | undefined {
    return this.items().find((i) => i.category === category && i.active && i.enabled);
  }

  isAvailable(category: IntegrationCategory): boolean {
    const a = this.activeFor(category);
    return !!a && a.status !== 'ERROR' && a.status !== 'NOT_CONFIGURED';
  }

  /** e.g. "Razorpay (Sandbox)" – used by checkout, notifications, calendar and storage UIs. */
  activeLabel(category: IntegrationCategory): string | null {
    const a = this.activeFor(category);
    if (!a) return null;
    const p = this.provider(a.category, a.providerKey);
    return `${p?.name ?? a.displayName}${a.environment === 'SANDBOX' ? ' (Sandbox)' : ''}`;
  }

  missingFields(i: Integration, pendingSecrets: string[] = []): string[] {
    const p = this.provider(i.category, i.providerKey);
    if (!p) return [];
    return p.fields
      .filter((f) => f.required && f.type !== 'toggle')
      .filter((f) => (f.type === 'secret' ? !i.secrets[f.key]?.isSet && !pendingSecrets.includes(f.key) : !(i.config[f.key] ?? '').trim()))
      .map((f) => f.label);
  }

  saveDraft(id: string | null, draft: IntegrationDraft): Integration {
    const now = new Date().toISOString();
    const existing = id ? this.find(id) : undefined;
    const secretInputs = Object.fromEntries(Object.entries(draft.secretInputs).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v.trim()]));
    // Masked placeholders so the screen shows "set" immediately; the API replies with the stored hints.
    const secrets: Record<string, SecretRef> = { ...(existing?.secrets ?? {}) };
    for (const [key, value] of Object.entries(secretInputs)) secrets[key] = { isSet: true, hint: `••••${value.slice(-4)}`, updatedAt: now };
    const record: Omit<Integration, 'id'> = {
      category: draft.category,
      providerKey: draft.providerKey,
      displayName: draft.displayName,
      environment: draft.environment,
      enabled: existing?.enabled ?? true,
      active: existing?.active ?? !this.items().some((i) => i.category === draft.category && i.active),
      status: 'UNTESTED',
      config: { ...draft.config },
      secrets,
      tests: existing?.tests ?? [],
      updatedAt: now,
      updatedBy: existing?.updatedBy ?? '',
    };
    const missing = this.missingFields({ ...record, id: id ?? '' } as Integration).length > 0;
    const payload = { ...record, status: missing ? ('NOT_CONFIGURED' as const) : record.status, secretInputs } as Omit<Integration, 'id'>;
    const saved = existing ? this.updateSync(existing.id, payload) : this.createSync(payload);
    // Plain secret values never stay in memory once the request has been queued.
    return this.stripSecretInputs(saved.id);
  }

  clearSecret(id: string, key: string): Integration {
    const i = this.find(id)!;
    const secrets = { ...i.secrets };
    delete secrets[key];
    return this.updateSync(id, { secrets, status: 'NOT_CONFIGURED', updatedAt: new Date().toISOString() });
  }

  setEnabled(id: string, enabled: boolean): Integration {
    const i = this.find(id)!;
    return this.updateSync(id, {
      enabled,
      active: enabled ? i.active : false,
      status: enabled ? (this.missingFields(i).length ? 'NOT_CONFIGURED' : 'UNTESTED') : 'DISABLED',
      updatedAt: new Date().toISOString(),
    });
  }

  setActive(id: string): Integration {
    const i = this.find(id)!;
    // The API switches the previous provider of this category off in the same save.
    this.items.set(this.items().map((x) => (x.category === i.category && x.id !== id && x.active ? { ...x, active: false } : x)));
    return this.updateSync(id, { active: true, enabled: true, status: i.status === 'DISABLED' ? 'UNTESTED' : i.status, updatedAt: new Date().toISOString() });
  }

  /** Server-side connection test with the stored credentials (POST /api/Integration/Test). */
  testConnection(id: string): Observable<ConnectionTest> {
    const p = this.provider(this.find(id)?.category, this.find(id)?.providerKey);
    return this.api.post<ConnectionTest>('Integration/Test', { id }, { spinner: 'blocking', message: `Testing ${p?.name ?? 'connection'}…` }).pipe(
      tap((r) => {
        const cur = this.find(id);
        if (cur) this.items.set(this.items().map((x) => (x.id === id ? { ...x, tests: [r, ...x.tests].slice(0, 10), status: r.ok ? 'CONNECTED' : 'ERROR' } : x)));
      }),
    );
  }

  private stripSecretInputs(id: string): Integration {
    let result!: Integration;
    this.items.set(
      this.items().map((x) => {
        if (x.id !== id) return x;
        const { secretInputs: _drop, ...rest } = x as Integration & { secretInputs?: unknown };
        result = rest as Integration;
        return result;
      }),
    );
    return result;
  }
}

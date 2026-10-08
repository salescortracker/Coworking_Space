import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED, createLoader, emailValidator } from '../../../shared';
import { CategoryDefinition, Integration, IntegrationCategory, ProviderDefinition, ProviderField } from '../../../core/models';
import { IntegrationService } from '../../../core/services/integration.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

const GROUPS = ['All', 'Communication', 'Payments & Finance', 'Calendar', 'Operations', 'Identity & Storage', 'Other'] as const;

/** Configuration / Integrations overview: every external service Officera needs, by category. */
@Component({
  selector: 'app-integrations',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Configuration / Integrations" subtitle="Manage the external services Officera depends on: messaging, payments, calendars, doors, storage, sign-in and accounting." [breadcrumbs]="[{ label: 'Configuration / Integrations' }]" />

      <div class="alert alert-info mb-4">
        <app-icon name="shield" />
        <div class="alert-body">
          <div class="alert-title">Secrets never live in the browser</div>
          API keys, passwords, tokens and connection strings are sent once to the Officera API and stored in the server-side vault. This screen only shows whether a secret is set and its last 4 characters.
        </div>
      </div>

      @if (svc.summary().missingRequired.length) {
        <div class="alert alert-warning mb-4">
          <app-icon name="alert" />
          <div class="alert-body">
            <div class="alert-title">Required services without an active provider</div>
            {{ svc.summary().missingRequired.join(', ') }}. Officera falls back to mock behaviour for these until a provider is configured and activated.
          </div>
        </div>
      }

      <div class="stat-grid mb-5">
        <app-stat-card label="Configured providers" [value]="svc.summary().total" icon="sliders" />
        <app-stat-card label="Connected" [value]="svc.summary().connected" icon="check-circle" tone="success" />
        <app-stat-card label="Needs attention" [value]="svc.summary().errors" icon="alert" tone="danger" hint="Last test failed" />
        <app-stat-card label="Untested / incomplete" [value]="svc.summary().untested" icon="clock" tone="warning" />
      </div>

      <section class="card mb-4">
        <div class="toolbar">
          <div class="input-icon search">
            <app-icon name="search" [size]="16" />
            <input class="input" type="search" aria-label="Search integrations" placeholder="Search services or providers" [ngModel]="q()" (ngModelChange)="q.set($event)" />
          </div>
          <label class="sr-only" for="grp">Group</label>
          <select id="grp" class="select" [ngModel]="group()" (ngModelChange)="group.set($event)">
            @for (g of groups; track g) {
              <option [value]="g">{{ g === 'All' ? 'All groups' : g }}</option>
            }
          </select>
          <span class="spacer"></span>
          <span class="text-sm text-muted">{{ categories().length }} services</span>
        </div>
      </section>

      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="6" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else {
        <div class="grid grid-auto">
          @for (c of categories(); track c.key) {
            @let active = svc.activeFor(c.key);
            <article class="card integration-card">
              <div class="card-body stack-sm">
                <div class="row-between row-start">
                  <span class="stat-icon tone-primary"><app-icon [name]="c.icon" [size]="18" /></span>
                  <div class="row-sm">
                    @if (c.required) {
                      <span class="tag">Required</span>
                    }
                    @if (active) {
                      <app-status-badge [status]="active.status" />
                    } @else {
                      <span class="badge badge-neutral">Not active</span>
                    }
                  </div>
                </div>
                <h2 class="text-md fw-600">{{ c.label }}</h2>
                <p class="text-sm text-muted mb-0">{{ c.description }}</p>
                <div class="text-sm">
                  <span class="text-muted">Active provider: </span>
                  <span class="fw-500">{{ active ? svc.activeLabel(c.key) : 'None' }}</span>
                </div>
                <div class="tag-list">
                  @for (u of c.usedBy.slice(0, 3); track u) {
                    <span class="tag">{{ u }}</span>
                  }
                  @if (c.usedBy.length > 3) {
                    <span class="tag">+{{ c.usedBy.length - 3 }}</span>
                  }
                </div>
              </div>
              <div class="card-footer">
                <span class="text-xs text-muted">{{ svc.forCategory(c.key).length }} provider{{ svc.forCategory(c.key).length === 1 ? '' : 's' }} configured · {{ c.providers.length }} supported</span>
                <a class="btn btn-secondary btn-sm" [routerLink]="['/admin/integrations', c.key]">Configure</a>
              </div>
            </article>
          } @empty {
            <div class="card" style="grid-column: 1 / -1"><app-empty-state icon="search" title="No services match" message="Try another search or group." /></div>
          }
        </div>
      }
    </div>
  `,
  styles: `.integration-card { display: flex; flex-direction: column; } .integration-card .card-body { flex: 1; }`,
})
export class IntegrationsComponent {
  protected readonly svc = inject(IntegrationService);
  protected readonly loader = createLoader(() => this.svc.list());
  protected readonly groups = GROUPS;
  protected readonly group = signal<string>('All');
  protected readonly q = signal('');
  protected readonly categories = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.svc
      .catalog()
      .filter((c) => this.group() === 'All' || c.group === this.group())
      .filter((c) => !q || `${c.label} ${c.description} ${c.providers.map((p) => p.name).join(' ')}`.toLowerCase().includes(q));
  });
}

/** One service category: configured providers, active provider, enable/disable, test, edit. */
@Component({
  selector: 'app-integration-category',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (cat(); as c) {
        <app-page-header [title]="c.label" [subtitle]="c.description" [breadcrumbs]="[{ label: 'Configuration / Integrations', link: '/admin/integrations' }, { label: c.label }]">
          @if (auth.can('integrations.create')) {
            <button type="button" class="btn btn-primary" (click)="openEditor(null)"><app-icon name="plus" [size]="16" /> Add provider</button>
          }
        </app-page-header>

        <section class="card card-body mb-4">
          <div class="row row-wrap row-start">
            <div class="flex-1" style="min-width: 220px">
              <div class="label mb-1">Used by in Officera</div>
              <div class="tag-list">
                @for (u of c.usedBy; track u) {
                  <span class="tag">{{ u }}</span>
                }
              </div>
            </div>
            <div style="min-width: 220px">
              <div class="label mb-1">Active provider</div>
              <div class="fw-600">{{ svc.activeLabel(c.key) ?? 'None – mock behaviour in use' }}</div>
            </div>
          </div>
        </section>

        <div class="stack">
          @for (i of rows(); track i.id) {
            @let p = svc.provider(i.category, i.providerKey);
            <article class="card" [class.selected]="i.active && i.enabled">
              <div class="card-header">
                <div class="row-sm row-wrap">
                  <span class="stat-icon" [class.tone-success]="i.status === 'CONNECTED'" [class.tone-danger]="i.status === 'ERROR'" [class.tone-neutral]="i.status !== 'CONNECTED' && i.status !== 'ERROR'"><app-icon [name]="c.icon" [size]="18" /></span>
                  <div>
                    <h2 class="card-title">{{ i.displayName }}</h2>
                    <div class="card-subtitle">{{ p?.name }} · {{ i.id }}</div>
                  </div>
                </div>
                <div class="row-sm row-wrap">
                  @if (i.active && i.enabled) {
                    <span class="badge badge-primary">Active provider</span>
                  }
                  <app-status-badge [status]="i.environment" [label]="i.environment === 'SANDBOX' ? 'Sandbox' : 'Live'" />
                  <app-status-badge [status]="i.status" [label]="statusLabel(i.status)" />
                </div>
              </div>
              <div class="card-body">
                <div class="kv-grid">
                  @for (f of visibleFields(p); track f.key) {
                    <div class="kv-item">
                      <div class="k">{{ f.label }}</div>
                      <div class="v" [class.mono]="f.type === 'secret' || f.type === 'url'">
                        @if (f.type === 'secret') {
                          @if (i.secrets[f.key]?.isSet) {
                            <span class="text-success"><app-icon name="lock" [size]="12" /> Stored {{ i.secrets[f.key]!.hint }}</span>
                          } @else {
                            <span class="text-danger">Not set</span>
                          }
                        } @else {
                          {{ display(i, f) }}
                        }
                      </div>
                    </div>
                  }
                </div>
                @if (svc.missingFields(i).length && i.enabled) {
                  <div class="alert alert-warning mt-4"><app-icon name="alert" /><div class="alert-body">Missing: {{ svc.missingFields(i).join(', ') }}</div></div>
                }
                @if (i.tests[0]; as t) {
                  <div class="alert mt-4" [class.alert-success]="t.ok" [class.alert-danger]="!t.ok">
                    <app-icon [name]="t.ok ? 'check-circle' : 'x-circle'" />
                    <div class="alert-body">
                      <div class="alert-title">Last test {{ t.ok ? 'passed' : 'failed' }} · {{ t.at | ago }}</div>
                      {{ t.message }}
                    </div>
                  </div>
                } @else {
                  <p class="text-sm text-muted mt-4 mb-0">Connection not tested yet.</p>
                }
              </div>
              <div class="card-footer">
                <label class="switch">
                  <input type="checkbox" [checked]="i.enabled" [disabled]="!auth.can('integrations.edit')" (change)="toggle(i)" [attr.aria-label]="(i.enabled ? 'Disable ' : 'Enable ') + i.displayName" />
                  <span class="track"></span>
                  <span class="text-sm">{{ i.enabled ? 'Enabled' : 'Disabled' }}</span>
                </label>
                <div class="btn-group">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="history.set(i)"><app-icon name="history" [size]="14" /> History</button>
                  <button type="button" class="btn btn-secondary btn-sm" [disabled]="testing() === i.id || !i.enabled" [appBusy]="testing() === i.id" busyText="Testing…" (click)="test(i)">
                    <app-icon name="zap" [size]="14" /> Test connection
                  </button>
                  @if (auth.can('integrations.edit')) {
                    @if (!(i.active && i.enabled)) {
                      <button type="button" class="btn btn-secondary btn-sm" (click)="makeActive(i)">Set as active</button>
                    }
                    <button type="button" class="btn btn-primary btn-sm" (click)="openEditor(i)"><app-icon name="edit" [size]="14" /> Edit</button>
                  }
                  @if (auth.can('integrations.delete') && !i.active) {
                    <button type="button" class="btn btn-ghost btn-icon btn-sm text-danger" (click)="remove(i)" [attr.aria-label]="'Remove ' + i.displayName"><app-icon name="trash" [size]="14" /></button>
                  }
                </div>
              </div>
            </article>
          } @empty {
            <div class="card">
              <app-empty-state [icon]="c.icon" title="No provider configured" [message]="'Add a ' + c.label + ' provider so Officera can use it.'">
                <button type="button" class="btn btn-primary" (click)="openEditor(null)">Add provider</button>
              </app-empty-state>
            </div>
          }
        </div>

        <section class="mt-5">
          <h2 class="section-title">Supported providers</h2>
          <div class="grid grid-auto-sm">
            @for (p of c.providers; track p.key) {
              <div class="card card-body">
                <div class="fw-600">{{ p.name }}</div>
                <div class="text-sm text-muted">{{ p.description }}</div>
                @if (p.sandbox) {
                  <span class="tag mt-2" style="align-self: flex-start">Sandbox available</span>
                }
              </div>
            }
          </div>
        </section>
      } @else {
        <div class="card"><app-empty-state icon="sliders" title="Service not found"><a class="btn btn-secondary" routerLink="/admin/integrations">All integrations</a></app-empty-state></div>
      }
    </div>

    <!-- Editor -->
    <app-drawer [open]="editorOpen()" [title]="editing() ? 'Edit ' + editing()!.displayName : 'Add provider'" [subtitle]="cat()?.label ?? ''" width="560px" (closed)="editorOpen.set(false)">
      @if (form(); as f) {
        <form id="int-form" [formGroup]="f" (ngSubmit)="save(false)" novalidate class="stack">
          <div class="field">
            <label class="label" for="ip">Provider <span class="req">*</span></label>
            <select id="ip" class="select" [ngModel]="providerKey()" [ngModelOptions]="{ standalone: true }" (ngModelChange)="selectProvider($event)" [disabled]="!!editing()">
              @for (p of cat()?.providers ?? []; track p.key) {
                <option [value]="p.key">{{ p.name }}</option>
              }
            </select>
            <span class="field-hint">{{ provider()?.description }}</span>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="label" for="idn">Display name <span class="req">*</span></label>
              <input id="idn" class="input" formControlName="__displayName" />
              <app-field-error [control]="f.controls['__displayName']" label="Display name" />
            </div>
            <div class="field">
              <label class="label" for="ienv">Environment</label>
              <select id="ienv" class="select" formControlName="__environment">
                @if (provider()?.sandbox) {
                  <option value="SANDBOX">Sandbox / test</option>
                }
                <option value="LIVE">Live / production</option>
              </select>
            </div>
          </div>
          <hr class="mt-0 mb-0" />
          @for (fd of provider()?.fields ?? []; track fd.key) {
            <div class="field">
              @if (fd.type === 'toggle') {
                <label class="switch"><input type="checkbox" [formControlName]="fd.key" /><span class="track"></span><span>{{ fd.label }}</span></label>
              } @else {
                <label class="label" [for]="'if-' + fd.key">{{ fd.label }} @if (fd.required) {<span class="req">*</span>}</label>
                @switch (fd.type) {
                  @case ('select') {
                    <select class="select" [id]="'if-' + fd.key" [formControlName]="fd.key">
                      @for (o of fd.options ?? []; track o) {
                        <option [value]="o">{{ o }}</option>
                      }
                    </select>
                  }
                  @case ('textarea') {
                    <textarea class="textarea" rows="4" [id]="'if-' + fd.key" [formControlName]="fd.key" [placeholder]="fd.placeholder ?? ''"></textarea>
                  }
                  @case ('secret') {
                    @if (editing()?.secrets?.[fd.key]?.isSet && !replacing().includes(fd.key)) {
                      <div class="row-between secret-row">
                        <span class="text-sm"><app-icon name="lock" [size]="14" /> Stored in vault <code>{{ editing()!.secrets[fd.key]!.hint }}</code> · updated {{ editing()!.secrets[fd.key]!.updatedAt | ago }}</span>
                        <button type="button" class="btn btn-ghost btn-sm" (click)="replace(fd.key)">Replace</button>
                      </div>
                    } @else {
                      <input class="input mono" type="password" autocomplete="new-password" [id]="'if-' + fd.key" [formControlName]="fd.key" [placeholder]="'Enter ' + fd.label.toLowerCase()" />
                    }
                  }
                  @default {
                    <input class="input" [id]="'if-' + fd.key" [type]="fd.type === 'number' ? 'number' : fd.type === 'email' ? 'email' : fd.type === 'url' ? 'url' : 'text'" [formControlName]="fd.key" [placeholder]="fd.placeholder ?? ''" />
                  }
                }
                @if (fd.hint) {
                  <span class="field-hint">{{ fd.hint }}</span>
                }
                <app-field-error [control]="f.controls[fd.key]" [label]="fd.label" />
              }
            </div>
          }
          <div class="alert alert-info"><app-icon name="shield" /><div class="alert-body text-sm">Secret fields are sent once to the Officera API vault and are not saved in this browser.</div></div>
        </form>
      }
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="editorOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-secondary" [disabled]="!form() || form()!.invalid" (click)="save(true)">Save & test</button>
        <button type="submit" form="int-form" class="btn btn-primary" [disabled]="!form() || form()!.invalid">Save</button>
      </div>
    </app-drawer>

    <!-- Test / change history -->
    <app-drawer [open]="!!history()" [title]="'History · ' + (history()?.displayName ?? '')" subtitle="Connection tests (latest 10)" (closed)="history.set(null)">
      @if (current(); as h) {
        <dl class="kv mb-4">
          <dt>Last updated</dt><dd>{{ h.updatedAt | date: 'd MMM y, h:mm a' }} by {{ h.updatedBy }}</dd>
          <dt>Status</dt><dd><app-status-badge [status]="h.status" [label]="statusLabel(h.status)" /></dd>
        </dl>
        <ul class="list-plain">
          @for (t of h.tests; track t.at) {
            <li class="list-row row-start">
              <span class="min-0">
                <span class="d-block fw-500" [class.text-success]="t.ok" [class.text-danger]="!t.ok">{{ t.ok ? 'Passed' : 'Failed' }} · {{ t.latencyMs }} ms</span>
                <span class="d-block text-sm text-secondary">{{ t.message }}</span>
                <span class="d-block text-xs text-muted">{{ t.at | date: 'd MMM y, h:mm a' }} · {{ t.by }}</span>
              </span>
            </li>
          } @empty {
            <li class="text-muted text-sm">No tests yet.</li>
          }
        </ul>
      }
    </app-drawer>
  `,
  styles: `.secret-row { border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; background: var(--surface-alt); gap: 8px; flex-wrap: wrap; }`,
})
export class IntegrationCategoryComponent {
  readonly categoryKey = input.required<string>({ alias: 'category' });
  protected readonly svc = inject(IntegrationService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly cat = computed<CategoryDefinition | undefined>(() => this.svc.category(this.categoryKey()));
  protected readonly rows = computed(() => (this.cat() ? this.svc.forCategory(this.cat()!.key).sort((a, b) => Number(b.active) - Number(a.active)) : []));
  protected readonly testing = signal<string | null>(null);
  protected readonly history = signal<Integration | null>(null);
  protected readonly current = computed(() => this.svc.find(this.history()?.id));

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<Integration | null>(null);
  protected readonly providerKey = signal('');
  protected readonly provider = computed<ProviderDefinition | undefined>(() => this.svc.provider(this.cat()?.key, this.providerKey()));
  protected readonly form = signal<FormGroup | null>(null);
  protected readonly replacing = signal<string[]>([]);

  protected statusLabel(s: Integration['status']): string {
    return { CONNECTED: 'Connected', NOT_CONFIGURED: 'Not configured', ERROR: 'Connection error', DISABLED: 'Disabled', UNTESTED: 'Not tested' }[s];
  }

  protected visibleFields(p: ProviderDefinition | undefined): ProviderField[] {
    return (p?.fields ?? []).filter((f) => f.type !== 'textarea');
  }

  protected display(i: Integration, f: ProviderField): string {
    const v = i.config[f.key];
    if (f.type === 'toggle') return v === 'true' ? 'On' : 'Off';
    return v ? v : '—';
  }

  protected openEditor(i: Integration | null): void {
    const c = this.cat();
    if (!c) return;
    this.editing.set(i);
    this.replacing.set([]);
    this.providerKey.set(i?.providerKey ?? c.providers[0].key);
    this.buildForm();
    this.editorOpen.set(true);
  }

  protected selectProvider(key: string): void {
    this.providerKey.set(key);
    this.buildForm();
  }

  protected replace(key: string): void {
    this.replacing.update((r) => [...r, key]);
    const ctrl = this.form()?.controls[key];
    ctrl?.setValidators(Validators.required);
    ctrl?.updateValueAndValidity();
  }

  private buildForm(): void {
    const p = this.provider();
    const ed = this.editing();
    if (!p) return;
    const controls: Record<string, FormControl> = {
      __displayName: new FormControl(ed?.displayName ?? p.name, { nonNullable: true, validators: [Validators.required, Validators.maxLength(60)] }),
      __environment: new FormControl(ed?.environment ?? (p.sandbox ? 'SANDBOX' : 'LIVE'), { nonNullable: true }),
    };
    for (const f of p.fields) {
      const v: ValidatorFn[] = [];
      const secretAlreadySet = f.type === 'secret' && !!ed?.secrets[f.key]?.isSet;
      if (f.required && f.type !== 'toggle' && !secretAlreadySet) v.push(Validators.required);
      if (f.type === 'url') v.push(Validators.pattern(/^https?:\/\/[^\s]+$/));
      if (f.type === 'email') v.push(emailValidator);
      if (f.type === 'number') v.push(Validators.min(1), Validators.max(65535));
      const initial = f.type === 'secret' ? '' : f.type === 'toggle' ? (ed?.config[f.key] ?? f.default) === 'true' : (ed?.config[f.key] ?? f.default ?? '');
      controls[f.key] = new FormControl(initial, { nonNullable: true, validators: v });
    }
    this.form.set(new FormGroup(controls));
  }

  protected save(thenTest: boolean): void {
    const f = this.form();
    const p = this.provider();
    const c = this.cat();
    if (!f || !p || !c) return;
    if (f.invalid) return f.markAllAsTouched();
    const raw = f.getRawValue() as Record<string, string | boolean>;
    const config: Record<string, string> = {};
    const secretInputs: Record<string, string> = {};
    for (const fd of p.fields) {
      const v = raw[fd.key];
      if (fd.type === 'secret') secretInputs[fd.key] = String(v ?? '');
      else config[fd.key] = typeof v === 'boolean' ? String(v) : String(v ?? '').trim();
    }
    const saved = this.svc.saveDraft(this.editing()?.id ?? null, { category: c.key, providerKey: p.key, displayName: String(raw['__displayName']), environment: raw['__environment'] as Integration['environment'], config, secretInputs });
    // Clear plain secret values from memory as soon as they have been handed to the vault.
    for (const fd of p.fields) if (fd.type === 'secret') f.controls[fd.key].setValue('');
    this.audit.record(this.editing() ? 'UPDATE' : 'CREATE', 'Integrations', c.label, saved.id, `${this.editing() ? 'Updated' : 'Added'} ${p.name} configuration (${saved.environment.toLowerCase()})`);
    this.editorOpen.set(false);
    this.toast.success('Configuration saved', `${saved.displayName}${Object.values(secretInputs).some((s) => s) ? ' · secrets sent to vault' : ''}`);
    if (thenTest) this.test(saved);
  }

  protected test(i: Integration): void {
    this.testing.set(i.id);
    this.svc.testConnection(i.id).subscribe((r) => {
      this.testing.set(null);
      this.audit.record('UPDATE', 'Integrations', 'Connection test', i.id, `${r.ok ? 'Passed' : 'Failed'}: ${r.message}`);
      if (r.ok) this.toast.success('Connection successful', r.message);
      else this.toast.error('Connection failed', r.message);
    });
  }

  protected async toggle(i: Integration): Promise<void> {
    if (i.enabled && i.active) {
      const ok = await this.confirm.confirm({
        title: `Disable ${i.displayName}?`,
        message: `This is the active ${this.cat()?.label} provider. Officera will stop using it until another provider is activated.`,
        confirmText: 'Disable',
        tone: 'danger',
      });
      if (!ok) return;
    }
    const u = this.svc.setEnabled(i.id, !i.enabled);
    this.audit.record('STATUS_CHANGE', 'Integrations', this.cat()?.label ?? '', i.id, `${u.enabled ? 'Enabled' : 'Disabled'} ${i.displayName}`);
    this.toast.success(u.enabled ? 'Integration enabled' : 'Integration disabled', i.displayName);
  }

  protected async makeActive(i: Integration): Promise<void> {
    const prev = this.svc.activeFor(i.category);
    const ok = await this.confirm.confirm({
      title: `Use ${i.displayName}?`,
      message: prev ? `Officera will switch from ${prev.displayName} to ${i.displayName} for ${this.cat()?.label}.` : `Officera will start using ${i.displayName} for ${this.cat()?.label}.`,
      confirmText: 'Set as active',
    });
    if (!ok) return;
    this.svc.setActive(i.id);
    this.audit.record('UPDATE', 'Integrations', this.cat()?.label ?? '', i.id, `Set ${i.displayName} as active provider`);
    this.toast.success('Active provider changed', i.displayName);
  }

  protected async remove(i: Integration): Promise<void> {
    const ok = await this.confirm.confirm({ title: `Remove ${i.displayName}?`, message: 'The configuration and its vault references will be deleted. This cannot be undone.', confirmText: 'Remove', tone: 'danger' });
    if (!ok) return;
    this.svc.remove(i.id).subscribe(() => {
      this.audit.record('DELETE', 'Integrations', this.cat()?.label ?? '', i.id, `Removed ${i.displayName}`);
      this.toast.success('Integration removed');
    });
  }
}

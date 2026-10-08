import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SHARED, createLoader } from '../../../shared';
import { Permission, RoleDefinition } from '../../../core/models';
import { RoleService, UserService } from '../../../core/services/data/people-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ToastService } from '../../../core/services/ui.service';

/** Roles list with per-role permission editing (drawer). */
@Component({
  selector: 'app-roles',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Roles" subtitle="The four operator roles from the FRD. Each role only sees permitted screens." [breadcrumbs]="[{ label: 'Administration' }, { label: 'Roles' }]">
        <a class="btn btn-secondary" routerLink="/admin/administration/permissions"><app-icon name="grid" [size]="16" /> Permission matrix</a>
      </app-page-header>
      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="4" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else {
        <div class="grid grid-2">
          @for (r of roles.items(); track r.id) {
            <article class="card">
              <div class="card-header">
                <div class="row-sm">
                  <span class="stat-icon tone-primary"><app-icon name="shield" [size]="18" /></span>
                  <div>
                    <h2 class="card-title">{{ r.name }}</h2>
                    <div class="card-subtitle">{{ userCount(r) }} user{{ userCount(r) === 1 ? '' : 's' }} · {{ r.permissions.length }} permissions</div>
                  </div>
                </div>
                @if (r.system) {
                  <span class="badge badge-neutral no-dot">System role</span>
                }
              </div>
              <div class="card-body">
                <p class="text-secondary">{{ r.description }}</p>
                <div class="tag-list">
                  @for (m of modulesFor(r).slice(0, 8); track m) {
                    <span class="tag">{{ m }}</span>
                  }
                  @if (modulesFor(r).length > 8) {
                    <span class="tag">+{{ modulesFor(r).length - 8 }} more</span>
                  }
                </div>
              </div>
              <div class="card-footer">
                <span class="text-sm text-muted">{{ r.key === 'SUPER_ADMIN' ? 'Always has full access' : 'Editable' }}</span>
                <button type="button" class="btn btn-secondary btn-sm" (click)="edit(r)" [disabled]="r.key === 'SUPER_ADMIN' || !auth.can('users.edit')">
                  <app-icon name="edit" [size]="14" /> Edit permissions
                </button>
              </div>
            </article>
          }
        </div>
      }
    </div>

    <app-drawer [open]="!!editing()" [title]="'Permissions · ' + (editing()?.name ?? '')" subtitle="Changes apply on the user's next navigation." width="560px" (closed)="editing.set(null)">
      @for (g of groups; track g.module) {
        <fieldset class="perm-group">
          <legend class="fw-600">{{ g.module }}</legend>
          <div class="chip-select">
            @for (p of g.perms; track p.key) {
              <label><input type="checkbox" [checked]="draft().includes(p.key)" (change)="togglePerm(p.key)" />{{ p.action | titlecase }}</label>
            }
          </div>
        </fieldset>
      }
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="editing.set(null)">Cancel</button>
        <button type="button" class="btn btn-primary" (click)="save()">Save permissions</button>
      </div>
    </app-drawer>
  `,
  styles: `.perm-group { border: 0; border-bottom: 1px solid var(--border); padding: 0 0 14px; margin: 0 0 14px; } .perm-group legend { margin-bottom: 8px; padding: 0; }`,
})
export class RolesComponent {
  protected readonly roles = inject(RoleService);
  private readonly users = inject(UserService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly loader = createLoader(() => this.roles.list());
  protected readonly editing = signal<RoleDefinition | null>(null);
  protected readonly draft = signal<string[]>([]);
  private readonly perms = this.roles.catalog();
  protected readonly groups = [...new Set(this.perms.map((p) => p.module))].map((module) => ({ module, perms: this.perms.filter((p) => p.module === module) as Permission[] }));

  protected readonly counts = computed(() => {
    const m: Record<string, number> = {};
    this.users.items().forEach((u) => (m[u.role] = (m[u.role] ?? 0) + 1));
    return m;
  });

  protected userCount(r: RoleDefinition): number {
    return this.counts()[r.key] ?? 0;
  }

  protected modulesFor(r: RoleDefinition): string[] {
    return [...new Set(this.perms.filter((p) => r.permissions.includes(p.key)).map((p) => p.module))];
  }

  protected edit(r: RoleDefinition): void {
    this.draft.set([...r.permissions]);
    this.editing.set(r);
  }

  protected togglePerm(key: string): void {
    this.draft.update((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]));
  }

  protected save(): void {
    const r = this.editing()!;
    this.roles.updateSync(r.id, { permissions: this.draft() });
    this.audit.record('UPDATE', 'Administration', 'Role', r.id, `Updated permissions for ${r.name} (${this.draft().length})`);
    this.toast.success('Permissions saved', r.name);
    this.editing.set(null);
  }
}

/** Module × role permission matrix (view permission per module + full action grid). */
@Component({
  selector: 'app-permissions',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Permissions" subtitle="Toggle what each role can do. Super Admin always has every permission." [breadcrumbs]="[{ label: 'Administration' }, { label: 'Permissions' }]">
        <button type="button" class="btn btn-primary" (click)="save()" [disabled]="!dirty() || !auth.can('users.edit')"><app-icon name="check" [size]="16" /> Save changes</button>
      </app-page-header>
      <section class="card">
        <div class="table-wrap">
          <table class="table matrix">
            <caption class="sr-only">Permission matrix</caption>
            <thead>
              <tr>
                <th scope="col">Permission</th>
                @for (r of roles.items(); track r.id) {
                  <th scope="col">{{ r.name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (p of perms; track p.key) {
                <tr>
                  <td><span class="cell-primary">{{ p.module }}</span><span class="cell-sub">{{ p.action | titlecase }}</span></td>
                  @for (r of roles.items(); track r.id) {
                    <td>
                      <input
                        type="checkbox"
                        [checked]="r.key === 'SUPER_ADMIN' || has(r.id, p.key)"
                        [disabled]="r.key === 'SUPER_ADMIN' || !auth.can('users.edit')"
                        (change)="toggle(r.id, p.key)"
                        [attr.aria-label]="r.name + ' – ' + p.label"
                      />
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class PermissionsComponent {
  protected readonly roles = inject(RoleService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly perms = this.roles.catalog();
  private readonly draft = signal<Record<string, string[]>>(Object.fromEntries(this.roles.items().map((r) => [r.id, [...r.permissions]])));
  protected readonly dirty = signal(false);

  protected has(roleId: string, key: string): boolean {
    return this.draft()[roleId]?.includes(key) ?? false;
  }

  protected toggle(roleId: string, key: string): void {
    this.draft.update((d) => {
      const list = d[roleId] ?? [];
      return { ...d, [roleId]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
    });
    this.dirty.set(true);
  }

  protected save(): void {
    Object.entries(this.draft()).forEach(([id, permissions]) => this.roles.updateSync(id, { permissions }));
    this.audit.record('UPDATE', 'Administration', 'Role', 'ALL', 'Updated permission matrix');
    this.dirty.set(false);
    this.toast.success('Permissions saved', 'Role access updated.');
  }
}

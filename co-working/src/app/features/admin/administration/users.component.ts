import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Column, SHARED, createLoader, emailValidator, mobileValidator } from '../../../shared';
import { ROLE_LABELS, Role, STAFF_ROLES, User } from '../../../core/models';
import { UserService } from '../../../core/services/data/people-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-users',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Users" subtitle="Staff accounts, roles and location assignments." [breadcrumbs]="[{ label: 'Administration' }, { label: 'Users' }]">
        @if (auth.can('users.create')) {
          <button type="button" class="btn btn-primary" (click)="openForm()"><app-icon name="user-plus" [size]="16" /> Invite user</button>
        }
      </app-page-header>

      <div class="stat-grid mb-5">
        @for (r of roleStats(); track r.role) {
          <app-stat-card [label]="r.label" [value]="r.count" icon="shield" [tone]="r.tone" />
        }
      </div>

      <app-data-table
        [rows]="filtered()"
        [columns]="columns"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!role() || !!status()"
        (clearFilters)="role.set(''); status.set('')"
        searchPlaceholder="Search name or email"
        emptyTitle="No users found"
        caption="Users"
      >
        <ng-container filters>
          <select class="select" aria-label="Role" [ngModel]="role()" (ngModelChange)="role.set($event)">
            <option value="">All roles</option>
            @for (r of staffRoles; track r) {
              <option [value]="r">{{ roleLabels[r] }}</option>
            }
          </select>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="INVITED">Invited</option>
          </select>
        </ng-container>
        <ng-template appCell="name" let-row>
          <div class="row-sm">
            <app-avatar [name]="row.name" [size]="30" />
            <div class="min-0">
              <span class="cell-primary d-block">{{ row.name }}</span>
              <span class="cell-sub">{{ row.email }}</span>
            </div>
          </div>
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [status]="isLocked(row) ? 'LOCKED' : row.status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          @if (auth.can('users.edit')) {
            <app-dropdown width="200px">
              <button trigger type="button" class="btn btn-ghost btn-icon btn-sm" [attr.aria-label]="'Actions for ' + row.name"><app-icon name="more" [size]="16" /></button>
              <button type="button" class="menu-item" (click)="openForm(row)"><app-icon name="edit" [size]="16" /> Edit</button>
              <button type="button" class="menu-item" (click)="resetPassword(row)"><app-icon name="key" [size]="16" /> Reset password</button>
              @if (isLocked(row)) {
                <button type="button" class="menu-item" (click)="unlock(row)"><app-icon name="unlock" [size]="16" /> Unlock account</button>
              }
              <div class="menu-sep"></div>
              <button type="button" class="menu-item" [class.danger]="row.status === 'ACTIVE'" (click)="toggle(row)" [disabled]="row.id === auth.user()?.id">
                <app-icon [name]="row.status === 'ACTIVE' ? 'pause' : 'play'" [size]="16" /> {{ row.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
              </button>
            </app-dropdown>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [open]="formOpen()" [title]="editing() ? 'Edit user' : 'Invite user'" subtitle="Staff sign in with email and password, or mobile OTP." (closed)="formOpen.set(false)">
      <form [formGroup]="form" id="user-form" (ngSubmit)="save()" novalidate class="form-grid">
        <div class="field span-2">
          <label class="label" for="un">Full name <span class="req">*</span></label>
          <input id="un" class="input" formControlName="name" />
          <app-field-error [control]="form.controls.name" label="Full name" />
        </div>
        <div class="field">
          <label class="label" for="ue">Email <span class="req">*</span></label>
          <input id="ue" class="input" type="email" formControlName="email" />
          <app-field-error [control]="form.controls.email" label="Email" />
        </div>
        <div class="field">
          <label class="label" for="um">Mobile <span class="req">*</span></label>
          <input id="um" class="input" inputmode="numeric" maxlength="10" formControlName="mobile" />
          <app-field-error [control]="form.controls.mobile" label="Mobile" />
        </div>
        <div class="field span-2">
          <label class="label" for="ur">Role <span class="req">*</span></label>
          <select id="ur" class="select" formControlName="role">
            @for (r of staffRoles; track r) {
              <option [value]="r">{{ roleLabels[r] }}</option>
            }
          </select>
        </div>
        <div class="field span-2">
          <span class="label">Assigned locations</span>
          <span class="field-hint">Leave all unchecked for access to every location.</span>
          <div class="chip-select mt-2">
            @for (l of locations.items(); track l.id) {
              <label><input type="checkbox" [checked]="locSel().includes(l.id)" (change)="toggleLoc(l.id)" />{{ l.name.replace('Officera ', '') }}</label>
            }
          </div>
          @if (form.controls.role.value === 'LOCATION_MANAGER' && locSel().length === 0) {
            <span class="field-error"><app-icon name="alert" [size]="12" /> Location managers must be assigned at least one location.</span>
          }
        </div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancel</button>
        <button type="submit" form="user-form" class="btn btn-primary" [disabled]="form.invalid || (form.controls.role.value === 'LOCATION_MANAGER' && locSel().length === 0)">
          {{ editing() ? 'Save changes' : 'Send invite' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class UsersComponent {
  private readonly users = inject(UserService);
  protected readonly locations = inject(LocationService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly audit = inject(AuditService);

  protected readonly loader = createLoader(() => this.users.list());
  protected readonly staffRoles = STAFF_ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly role = signal('');
  protected readonly status = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<User | null>(null);
  protected readonly locSel = signal<string[]>([]);

  protected readonly staff = computed(() => this.users.items().filter((u) => u.role !== 'MEMBER'));
  protected readonly filtered = computed(() => this.staff().filter((u) => (!this.role() || u.role === this.role()) && (!this.status() || u.status === this.status())));
  protected readonly roleStats = computed(() =>
    STAFF_ROLES.map((r, i) => ({ role: r, label: ROLE_LABELS[r], count: this.staff().filter((u) => u.role === r).length, tone: (['primary', 'info', 'success', 'warning'] as const)[i] })),
  );

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, emailValidator]],
    mobile: ['', [Validators.required, mobileValidator]],
    role: ['FRONT_DESK' as Role, Validators.required],
  });

  protected readonly columns: Column<User>[] = [
    { key: 'name', label: 'User', primary: true },
    { key: 'role', label: 'Role', value: (u) => ROLE_LABELS[u.role] },
    { key: 'locations', label: 'Locations', value: (u) => (u.locationIds.length ? u.locationIds.map((id) => this.locations.shortName(id)).join(', ') : 'All locations') },
    { key: 'mobile', label: 'Mobile', hideMobile: true },
    { key: 'lastLogin', label: 'Last login', type: 'datetime', hideMobile: true },
    { key: 'status', label: 'Status' },
  ];

  protected isLocked(u: User): boolean {
    return this.auth.isLocked(u.email);
  }

  protected openForm(u?: User): void {
    this.editing.set(u ?? null);
    this.form.reset({ name: u?.name ?? '', email: u?.email ?? '', mobile: u?.mobile ?? '', role: (u?.role as Role) ?? 'FRONT_DESK' });
    this.locSel.set(u ? [...u.locationIds] : []);
    this.formOpen.set(true);
  }

  protected toggleLoc(id: string): void {
    this.locSel.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const ed = this.editing();
    if (ed) {
      this.users.updateSync(ed.id, { ...v, locationIds: this.locSel() });
      this.audit.record('UPDATE', 'Administration', 'User', ed.id, `Updated user ${v.name} (${ROLE_LABELS[v.role]})`);
      this.toast.success('User updated', v.name);
    } else {
      const u = this.users.createSync({ ...v, locationIds: this.locSel(), status: 'INVITED', createdAt: new Date().toISOString() });
      this.audit.record('CREATE', 'Administration', 'User', u.id, `Invited ${v.name} as ${ROLE_LABELS[v.role]}`);
      this.toast.success('Invitation sent', `${v.email} will receive a link to set a password.`);
    }
    this.formOpen.set(false);
  }

  protected async toggle(u: User): Promise<void> {
    const deactivate = u.status === 'ACTIVE';
    const ok = await this.confirm.confirm({
      title: deactivate ? `Deactivate ${u.name}?` : `Activate ${u.name}?`,
      message: deactivate ? 'They will be signed out and can no longer access the console.' : 'They will be able to sign in again.',
      confirmText: deactivate ? 'Deactivate' : 'Activate',
      tone: deactivate ? 'danger' : 'primary',
    });
    if (!ok) return;
    this.users.updateSync(u.id, { status: deactivate ? 'INACTIVE' : 'ACTIVE' });
    this.audit.record('STATUS_CHANGE', 'Administration', 'User', u.id, `${deactivate ? 'Deactivated' : 'Activated'} ${u.name}`);
    this.toast.success(deactivate ? 'User deactivated' : 'User activated');
  }

  protected async resetPassword(u: User): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Send password reset?', message: `A reset link and OTP will be sent to ${u.email} and ${u.mobile}.`, confirmText: 'Send reset link' });
    if (!ok) return;
    this.audit.record('UPDATE', 'Administration', 'User', u.id, `Password reset sent to ${u.email}`);
    this.toast.success('Reset link sent', u.email);
  }

  protected unlock(u: User): void {
    this.auth.unlock(u.email);
    this.audit.record('UPDATE', 'Administration', 'User', u.id, `Unlocked account for ${u.email}`);
    this.toast.success('Account unlocked', u.name);
  }
}

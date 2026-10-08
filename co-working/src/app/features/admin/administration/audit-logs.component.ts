import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Column, SHARED, createLoader, downloadCsv, printAsPdf, todayStamp } from '../../../shared';
import { AuditLog, ROLE_LABELS, Role } from '../../../core/models';
import { AuditLogService } from '../../../core/services/data/operations-data.service';
import { ToastService } from '../../../core/services/ui.service';

/** Audit log (§32): who did what, where and when. */
@Component({
  selector: 'app-audit-logs',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Audit Logs" subtitle="Every create, update, delete, export and sign-in by staff." [breadcrumbs]="[{ label: 'Administration' }, { label: 'Audit Logs' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        <button type="button" class="btn btn-secondary" (click)="pdf()"><app-icon name="printer" [size]="16" /> PDF</button>
      </app-page-header>
      <app-data-table
        [rows]="filtered()"
        [columns]="cols"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!user() || !!module() || !!action() || !!date()"
        (clearFilters)="user.set(''); module.set(''); action.set(''); date.set('')"
        [defaultSort]="{ key: 'date', dir: 'desc' }"
        [initialPageSize]="25"
        searchPlaceholder="Search description or entity ID"
        emptyTitle="No audit entries"
        emptyIcon="history"
        [rowClickable]="true"
        (rowClick)="selected.set($event)"
        caption="Audit logs"
      >
        <ng-container filters>
          <select class="select" aria-label="User" [ngModel]="user()" (ngModelChange)="user.set($event)">
            <option value="">All users</option>
            @for (u of users(); track u) {
              <option [value]="u">{{ u }}</option>
            }
          </select>
          <select class="select" aria-label="Module" [ngModel]="module()" (ngModelChange)="module.set($event)">
            <option value="">All modules</option>
            @for (m of modules(); track m) {
              <option [value]="m">{{ m }}</option>
            }
          </select>
          <select class="select" aria-label="Action" [ngModel]="action()" (ngModelChange)="action.set($event)">
            <option value="">All actions</option>
            @for (a of actions; track a) {
              <option [value]="a">{{ a | humanize }}</option>
            }
          </select>
          <input class="input" type="date" aria-label="Date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
        </ng-container>
        <ng-template appCell="action" let-row><span class="tag">{{ row.action | humanize }}</span></ng-template>
      </app-data-table>
    </div>
    <app-drawer [open]="!!selected()" [title]="selected()?.id ?? ''" [subtitle]="selected()?.description ?? ''" (closed)="selected.set(null)">
      @if (selected(); as a) {
        <dl class="kv">
          <dt>User</dt><dd>{{ a.user }}</dd>
          <dt>Role</dt><dd>{{ roleLabel(a.role) }}</dd>
          <dt>Action</dt><dd>{{ a.action | humanize }}</dd>
          <dt>Module</dt><dd>{{ a.module }}</dd>
          <dt>Entity</dt><dd>{{ a.entity }} · <span class="mono">{{ a.entityId }}</span></dd>
          <dt>Date & time</dt><dd>{{ a.at | date: 'd MMM y, h:mm:ss a' }}</dd>
          <dt>IP address</dt><dd class="mono">{{ a.ip }}</dd>
          <dt>Device</dt><dd>{{ a.device }}</dd>
          <dt>Description</dt><dd>{{ a.description }}</dd>
        </dl>
      }
    </app-drawer>
  `,
})
export class AuditLogsComponent {
  private readonly logs = inject(AuditLogService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.logs.list());
  protected readonly actions: AuditLog['action'][] = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'APPROVE', 'EXPORT', 'LOGIN', 'LOGOUT'];
  protected readonly user = signal('');
  protected readonly module = signal('');
  protected readonly action = signal('');
  protected readonly date = signal('');
  protected readonly selected = signal<AuditLog | null>(null);
  protected readonly users = computed(() => [...new Set(this.logs.items().map((l) => l.user))].sort());
  protected readonly modules = computed(() => [...new Set(this.logs.items().map((l) => l.module))].sort());
  protected readonly filtered = computed(() =>
    this.logs.items().filter((l) => (!this.user() || l.user === this.user()) && (!this.module() || l.module === this.module()) && (!this.action() || l.action === this.action()) && (!this.date() || new Date(l.at).toDateString() === new Date(this.date() + 'T12:00:00').toDateString())),
  );
  protected roleLabel(r: string): string {
    return ROLE_LABELS[r as Role] ?? r;
  }
  protected readonly cols: Column<AuditLog>[] = [
    { key: 'id', label: 'Log ID', primary: true },
    { key: 'user', label: 'User' },
    { key: 'role', label: 'Role', value: (l) => this.roleLabel(l.role), hideMobile: true },
    { key: 'action', label: 'Action' },
    { key: 'module', label: 'Module' },
    { key: 'entity', label: 'Entity', hideMobile: true },
    { key: 'entityId', label: 'Entity ID', hideMobile: true },
    { key: 'date', label: 'Date', value: (l) => l.at, type: 'date', sortValue: (l) => l.at },
    { key: 'time', label: 'Time', value: (l) => new Date(l.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), sortValue: (l) => l.at },
    { key: 'ip', label: 'IP / Device', value: (l) => `${l.ip} · ${l.device}`, hideMobile: true },
    { key: 'description', label: 'Description', hideMobile: true },
  ];
  protected csv(): void {
    downloadCsv(`audit-logs-${todayStamp()}`, this.filtered(), [
      { label: 'Log ID', value: (l) => l.id },
      { label: 'User', value: (l) => l.user },
      { label: 'Role', value: (l) => this.roleLabel(l.role) },
      { label: 'Action', value: (l) => l.action },
      { label: 'Module', value: (l) => l.module },
      { label: 'Entity', value: (l) => l.entity },
      { label: 'Entity ID', value: (l) => l.entityId },
      { label: 'Date time', value: (l) => l.at },
      { label: 'IP', value: (l) => l.ip },
      { label: 'Device', value: (l) => l.device },
      { label: 'Description', value: (l) => l.description },
    ]);
    this.toast.success('CSV exported');
  }
  protected pdf(): void {
    printAsPdf();
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Column, SHARED, createLoader, downloadCsv, printAsPdf, todayIso, todayStamp } from '../../../shared';
import { AccessCredential, AccessLog } from '../../../core/models';
import { AccessCredentialService, AccessLogService } from '../../../core/services/data/operations-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { OperationsService, ScanResult } from '../../../core/services/operations.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

/** Access dashboard (§26): credential counts, today's entries/exits, exceptions, scan simulator. */
@Component({
  selector: 'app-access-dashboard',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Access Control" [subtitle]="'QR access at ' + ctx.label() + '.'" [breadcrumbs]="[{ label: 'Access Control' }, { label: 'Access' }]">
        <a class="btn btn-secondary" routerLink="/admin/access/logs"><app-icon name="list" [size]="16" /> Entry/exit logs</a>
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Active credentials" [value]="count('ACTIVE')" icon="qr" tone="success" link="/admin/access/credentials" />
        <app-stat-card label="Revoked credentials" [value]="count('REVOKED')" icon="lock" tone="danger" link="/admin/access/credentials" />
        <app-stat-card label="Today's entries" [value]="today('IN')" icon="log-in" tone="info" />
        <app-stat-card label="Today's exits" [value]="today('OUT')" icon="logout" tone="neutral" />
        <app-stat-card label="Access exceptions" [value]="exceptions().length" icon="alert" tone="warning" hint="Denied today" />
      </div>
      <div class="split">
        <section class="card">
          <div class="card-header"><h2 class="card-title">Access exceptions today</h2></div>
          <app-data-table [rows]="exceptions()" [columns]="cols" [searchable]="false" [paginate]="false" emptyTitle="No exceptions" emptyIcon="check-circle" caption="Access exceptions" />
        </section>
        <section class="card">
          <div class="card-header"><h2 class="card-title">Member verification</h2></div>
          <div class="card-body stack">
            <p class="text-sm text-muted mb-0">Scan or type a member or visitor QR code. Checks: valid QR, active plan, within plan hours.</p>
            <div class="row-sm">
              <input class="input mono" aria-label="QR code" [ngModel]="code()" (ngModelChange)="code.set($event)" placeholder="OFM-XXXXXX" style="text-transform: uppercase" />
              <button type="button" class="btn btn-primary" [disabled]="!code().trim()" (click)="run()">Validate</button>
            </div>
            <div class="tag-list">
              @for (c of samples(); track c.id) {
                <button type="button" class="tag" style="border: 0; cursor: pointer" (click)="code.set(c.code); run()">{{ c.holderName }} ({{ c.status | humanize }})</button>
              }
            </div>
            @if (result(); as r) {
              <div class="alert" [class.alert-success]="r.valid" [class.alert-danger]="!r.valid">
                <app-icon [name]="r.valid ? 'unlock' : 'lock'" />
                <div class="alert-body">
                  <div class="alert-title">{{ r.valid ? 'Valid · door opened' : 'Invalid · access denied' }} — {{ r.name }}</div>
                  <ul class="list-plain text-sm">
                    @for (c of r.checks; track c.label) {
                      <li><app-icon [name]="c.ok ? 'check' : 'x'" [size]="12" /> {{ c.label }}</li>
                    }
                  </ul>
                  <div class="text-xs mt-1">Logged to entry/exit log.</div>
                </div>
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AccessDashboardComponent {
  private readonly creds = inject(AccessCredentialService);
  private readonly logs = inject(AccessLogService);
  private readonly locations = inject(LocationService);
  private readonly ops = inject(OperationsService);
  protected readonly ctx = inject(LocationContextService);
  protected readonly code = signal('');
  protected readonly result = signal<ScanResult | null>(null);
  protected count(s: string): number {
    return this.creds.scoped().filter((c) => c.status === s).length;
  }
  private readonly todays = computed(() => this.logs.scoped().filter((l) => l.at.slice(0, 10) === todayIso() || new Date(l.at).toDateString() === new Date().toDateString()));
  protected today(dir: 'IN' | 'OUT'): number {
    return this.todays().filter((l) => l.direction === dir && l.status === 'GRANTED').length;
  }
  protected readonly exceptions = computed(() => this.todays().filter((l) => l.status === 'DENIED'));
  protected readonly samples = computed(() => {
    const s = this.creds.scoped();
    return [s.find((c) => c.status === 'ACTIVE' && c.holderType === 'MEMBER'), s.find((c) => c.status === 'REVOKED'), s.find((c) => c.status === 'EXPIRED')].filter((x): x is AccessCredential => !!x);
  });
  protected readonly cols: Column<AccessLog>[] = [
    { key: 'at', label: 'Time', type: 'datetime' },
    { key: 'person', label: 'Person', primary: true },
    { key: 'door', label: 'Door', hideMobile: true },
    { key: 'reason', label: 'Reason' },
  ];
  protected run(): void {
    this.result.set(this.ops.scan(this.code(), this.ctx.singleLocationId() ?? this.locations.scoped()[0]?.id ?? ''));
  }
}

@Component({
  selector: 'app-credentials',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="QR Credentials" subtitle="Member, staff and visitor QR credentials." [breadcrumbs]="[{ label: 'Access Control', link: '/admin/access' }, { label: 'QR Credentials' }]" />
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!status() || !!type()" (clearFilters)="status.set(''); type.set('')" searchPlaceholder="Search holder or code" emptyTitle="No credentials" emptyIcon="qr" caption="QR credentials">
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of ['ACTIVE', 'REVOKED', 'EXPIRED']; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <select class="select" aria-label="Holder type" [ngModel]="type()" (ngModelChange)="type.set($event)">
            <option value="">All holders</option>
            @for (s of ['MEMBER', 'STAFF', 'VISITOR']; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
        </ng-container>
        <ng-template appCell="actions" let-row>
          @if (auth.can('access.edit')) {
            @if (row.status === 'ACTIVE') {
              <button type="button" class="btn btn-ghost btn-sm text-danger" (click)="revoke(row)">Revoke</button>
            } @else {
              <button type="button" class="btn btn-secondary btn-sm" (click)="reissue(row)">Reissue</button>
            }
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class CredentialsComponent {
  private readonly creds = inject(AccessCredentialService);
  private readonly locations = inject(LocationService);
  private readonly ops = inject(OperationsService);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.creds.listScoped());
  protected readonly status = signal('');
  protected readonly type = signal('');
  protected readonly filtered = computed(() => this.creds.scoped().filter((c) => (!this.status() || c.status === this.status()) && (!this.type() || c.holderType === this.type())));
  protected readonly cols: Column<AccessCredential>[] = [
    { key: 'holderName', label: 'Holder', primary: true },
    { key: 'holderType', label: 'Type', value: (c) => c.holderType },
    { key: 'code', label: 'QR code' },
    { key: 'location', label: 'Location', value: (c) => this.locations.shortName(c.locationId), hideMobile: true },
    { key: 'accessHours', label: 'Access hours', hideMobile: true },
    { key: 'validUntil', label: 'Valid until', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected async revoke(c: AccessCredential): Promise<void> {
    const reason = await this.confirm.prompt({ title: `Revoke ${c.holderName}'s QR?`, message: 'Door access stops immediately.', confirmText: 'Revoke', tone: 'danger', input: { label: 'Reason', required: true } });
    if (reason === null) return;
    this.ops.revoke(c.id, reason);
    this.audit.record('STATUS_CHANGE', 'Access', 'Credential', c.id, `Revoked: ${reason}`);
    this.toast.success('Credential revoked');
  }
  protected reissue(c: AccessCredential): void {
    this.ops.reissue(c.id);
    this.audit.record('UPDATE', 'Access', 'Credential', c.id, 'Reissued QR credential');
    this.toast.success('New QR issued', c.holderName);
  }
}

@Component({
  selector: 'app-access-logs',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Entry/Exit Logs" subtitle="Every door event with direction and result." [breadcrumbs]="[{ label: 'Access Control', link: '/admin/access' }, { label: 'Entry/Exit Logs' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        <button type="button" class="btn btn-secondary" (click)="pdf()"><app-icon name="printer" [size]="16" /> PDF</button>
      </app-page-header>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!date() || !!status() || !!person()" (clearFilters)="date.set(''); status.set(''); person.set('')" [defaultSort]="{ key: 'at', dir: 'desc' }" [initialPageSize]="25" searchPlaceholder="Search person or door" emptyTitle="No access logs" caption="Entry and exit logs">
        <ng-container filters>
          <input class="input" type="date" aria-label="Date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
          <input class="input" aria-label="Person" placeholder="Person" [ngModel]="person()" (ngModelChange)="person.set($event)" />
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All results</option>
            <option value="GRANTED">Granted</option>
            <option value="DENIED">Denied</option>
          </select>
        </ng-container>
      </app-data-table>
    </div>
  `,
})
export class AccessLogsComponent {
  private readonly logs = inject(AccessLogService);
  private readonly locations = inject(LocationService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.logs.listScoped());
  protected readonly date = signal('');
  protected readonly status = signal('');
  protected readonly person = signal('');
  protected readonly filtered = computed(() =>
    this.logs.scoped().filter((l) => (!this.date() || new Date(l.at).toDateString() === new Date(this.date() + 'T12:00:00').toDateString()) && (!this.status() || l.status === this.status()) && (!this.person() || l.person.toLowerCase().includes(this.person().toLowerCase()))),
  );
  protected readonly cols: Column<AccessLog>[] = [
    { key: 'person', label: 'Person', primary: true },
    { key: 'personType', label: 'Type', value: (l) => l.personType },
    { key: 'location', label: 'Location', value: (l) => this.locations.shortName(l.locationId) },
    { key: 'door', label: 'Door', hideMobile: true },
    { key: 'date', label: 'Date', value: (l) => l.at, type: 'date', sortValue: (l) => l.at },
    { key: 'time', label: 'Time', value: (l) => new Date(l.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), sortValue: (l) => l.at },
    { key: 'direction', label: 'Direction', type: 'status' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected csv(): void {
    downloadCsv(`access-logs-${todayStamp()}`, this.filtered(), [
      { label: 'Person', value: (l) => l.person },
      { label: 'Type', value: (l) => l.personType },
      { label: 'Location', value: (l) => this.locations.name(l.locationId) },
      { label: 'Door', value: (l) => l.door },
      { label: 'Date time', value: (l) => l.at },
      { label: 'Direction', value: (l) => l.direction },
      { label: 'Status', value: (l) => l.status },
      { label: 'Reason', value: (l) => l.reason ?? '' },
    ]);
    this.toast.success('CSV exported');
  }
  protected pdf(): void {
    printAsPdf();
  }
}

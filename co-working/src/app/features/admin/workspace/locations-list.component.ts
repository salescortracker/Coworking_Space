import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, downloadCsv, todayStamp } from '../../../shared';
import { Location } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-locations-list',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Locations" subtitle="Centres, opening hours, amenities and capacity." [breadcrumbs]="[{ label: 'Workspace Management' }, { label: 'Locations' }]">
        <button type="button" class="btn btn-secondary" (click)="export()"><app-icon name="download" [size]="16" /> Export CSV</button>
        @if (auth.can('locations.create')) {
          <a class="btn btn-primary" routerLink="/admin/locations/new"><app-icon name="plus" [size]="16" /> Add location</a>
        }
      </app-page-header>

      <div class="stat-grid mb-5">
        <app-stat-card label="Locations" [value]="rows().length" icon="building" />
        <app-stat-card label="Active" [value]="activeCount()" icon="check-circle" tone="success" />
        <app-stat-card label="Total resources" [value]="resourceTotal()" icon="layers" tone="info" />
        <app-stat-card label="Members" [value]="memberTotal()" icon="users" tone="warning" />
      </div>

      <app-data-table
        [rows]="filtered()"
        [columns]="columns"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!city() || !!status()"
        (clearFilters)="city.set(''); status.set('')"
        searchPlaceholder="Search name, city or address"
        emptyTitle="No locations yet"
        emptyMessage="Add your first centre to start publishing resources."
        emptyIcon="building"
        [rowClickable]="true"
        (rowClick)="open($event)"
        caption="Locations"
      >
        <ng-container filters>
          <label class="sr-only" for="f-city">City</label>
          <select id="f-city" class="select" [ngModel]="city()" (ngModelChange)="city.set($event)">
            <option value="">All cities</option>
            @for (c of locations.cities(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
          <label class="sr-only" for="f-status">Status</label>
          <select id="f-status" class="select" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="COMING_SOON">Coming soon</option>
          </select>
        </ng-container>
        <ng-template appCell="name" let-row>
          <div class="row-sm">
            <app-workspace-image [seed]="row.photos[0]" [alt]="row.name" sizes="88px" style="width: 44px; height: 32px; border-radius: 4px" />
            <div class="min-0">
              <span class="cell-primary d-block">{{ row.name }}</span>
              <span class="cell-sub">{{ row.id }}</span>
            </div>
          </div>
        </ng-template>
        <ng-template appCell="hours" let-row>
          <span class="text-sm">{{ row.openingHours.weekdays }}</span>
          <span class="cell-sub">Sat: {{ row.openingHours.saturday }}</span>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/locations', row.id]" aria-label="View"><app-icon name="eye" [size]="16" /></a>
          @if (auth.can('locations.edit')) {
            <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/locations', row.id, 'edit']" aria-label="Edit"><app-icon name="edit" [size]="16" /></a>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="toggle(row)" [attr.aria-label]="row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'">
              <app-icon [name]="row.status === 'ACTIVE' ? 'pause' : 'play'" [size]="16" />
            </button>
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class LocationsListComponent {
  protected readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  private readonly members = inject(MemberService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly loader = createLoader(() => this.locations.listScoped());
  protected readonly city = signal('');
  protected readonly status = signal('');

  protected readonly rows = computed(() => this.locations.scoped());
  protected readonly filtered = computed(() =>
    this.rows().filter((l) => (!this.city() || l.city === this.city()) && (!this.status() || l.status === this.status())),
  );
  protected readonly activeCount = computed(() => this.rows().filter((l) => l.status === 'ACTIVE').length);
  protected readonly resourceTotal = computed(() => {
    const ids = new Set(this.rows().map((l) => l.id));
    return this.resources.items().filter((r) => ids.has(r.locationId)).length;
  });
  protected readonly memberTotal = computed(() => {
    const ids = new Set(this.rows().map((l) => l.id));
    return this.members.items().filter((m) => ids.has(m.locationId)).length;
  });

  protected readonly columns: Column<Location>[] = [
    { key: 'name', label: 'Location Name', value: (l) => l.name, primary: true },
    { key: 'city', label: 'City' },
    { key: 'address', label: 'Address', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'hours', label: 'Opening Hours', value: (l) => l.openingHours.weekdays, sortable: false, hideMobile: true },
    { key: 'resources', label: 'Resources', type: 'number', value: (l) => this.resources.items().filter((r) => r.locationId === l.id).length },
    { key: 'members', label: 'Members', type: 'number', value: (l) => this.members.items().filter((m) => m.locationId === l.id).length },
  ];

  protected open(l: Location): void {
    this.router.navigate(['/admin/locations', l.id]);
  }

  protected async toggle(l: Location): Promise<void> {
    const deactivate = l.status === 'ACTIVE';
    const ok = await this.confirm.confirm({
      title: deactivate ? 'Deactivate location?' : 'Activate location?',
      message: deactivate
        ? `${l.name} will be hidden from the website and new bookings will be blocked. Existing bookings are not affected.`
        : `${l.name} will be visible on the website and open for bookings.`,
      confirmText: deactivate ? 'Deactivate' : 'Activate',
      tone: deactivate ? 'danger' : 'primary',
    });
    if (!ok) return;
    this.locations.update(l.id, { status: deactivate ? 'INACTIVE' : 'ACTIVE' }).subscribe(() => {
      this.audit.record('STATUS_CHANGE', 'Locations', 'Location', l.id, `${deactivate ? 'Deactivated' : 'Activated'} ${l.name}`);
      this.toast.success(deactivate ? 'Location deactivated' : 'Location activated', l.name);
    });
  }

  protected export(): void {
    downloadCsv(`locations-${todayStamp()}`, this.filtered(), [
      { label: 'ID', value: (l) => l.id },
      { label: 'Name', value: (l) => l.name },
      { label: 'City', value: (l) => l.city },
      { label: 'Address', value: (l) => l.address },
      { label: 'Status', value: (l) => l.status },
      { label: 'Weekday hours', value: (l) => l.openingHours.weekdays },
    ]);
    this.toast.success('Export ready', 'locations.csv downloaded.');
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, downloadCsv, todayStamp } from '../../../shared';
import { Resource, SPACE_TYPE_LABELS } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-resources-list',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Resources" subtitle="Hot desks, dedicated desks, private offices and meeting rooms." [breadcrumbs]="[{ label: 'Workspace Management' }, { label: 'Resources' }]">
        <button type="button" class="btn btn-secondary" (click)="export()"><app-icon name="download" [size]="16" /> Export CSV</button>
        <a class="btn btn-secondary" routerLink="/admin/floor-maps"><app-icon name="map" [size]="16" /> Floor maps</a>
        @if (auth.can('resources.create')) {
          <a class="btn btn-primary" routerLink="/admin/resources/new"><app-icon name="plus" [size]="16" /> Add resource</a>
        }
      </app-page-header>

      <div class="stat-grid mb-5">
        @for (s of typeStats(); track s.type) {
          <app-stat-card [label]="s.label" [value]="s.count" [icon]="s.icon" [hint]="s.active + ' active'" />
        }
      </div>

      <app-data-table
        [rows]="filtered()"
        [columns]="columns"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!type() || !!status() || !!location()"
        (clearFilters)="type.set(''); status.set(''); location.set('')"
        searchPlaceholder="Search name or code"
        emptyTitle="No resources found"
        emptyMessage="Add desks, offices or rooms to make them bookable."
        emptyIcon="layers"
        [rowClickable]="true"
        (rowClick)="router.navigate(['/admin/resources', $event.id])"
        caption="Resources"
      >
        <ng-container filters>
          <select class="select" aria-label="Location" [ngModel]="location()" (ngModelChange)="location.set($event)">
            <option value="">All locations</option>
            @for (l of locations.scoped(); track l.id) {
              <option [value]="l.id">{{ l.name }}</option>
            }
          </select>
          <select class="select" aria-label="Type" [ngModel]="type()" (ngModelChange)="type.set($event)">
            <option value="">All types</option>
            @for (t of types; track t) {
              <option [value]="t">{{ labels[t] }}</option>
            }
          </select>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </ng-container>
        <ng-template appCell="name" let-row>
          <span class="cell-primary d-block">{{ row.name }}</span>
          <span class="cell-sub">{{ row.code }} · {{ row.floor }}</span>
        </ng-template>
        <ng-template appCell="price" let-row>
          <span class="tabular">{{ row.price | inr }}</span><span class="cell-sub">per {{ row.priceUnit }}</span>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/resources', row.id]" aria-label="View"><app-icon name="eye" [size]="16" /></a>
          @if (auth.can('resources.edit')) {
            <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/resources', row.id, 'edit']" aria-label="Edit"><app-icon name="edit" [size]="16" /></a>
          }
          @if (auth.can('resources.delete')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm text-danger" (click)="remove(row)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class ResourcesListComponent {
  protected readonly resources = inject(ResourceService);
  protected readonly locations = inject(LocationService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly loader = createLoader(() => this.resources.listScoped());
  protected readonly types = ['HOT_DESK', 'DEDICATED_DESK', 'PRIVATE_OFFICE', 'MEETING_ROOM'] as const;
  protected readonly labels = SPACE_TYPE_LABELS;
  protected readonly type = signal('');
  protected readonly status = signal('');
  protected readonly location = signal('');

  protected readonly filtered = computed(() =>
    this.resources
      .scoped()
      .filter((r) => (!this.type() || r.type === this.type()) && (!this.status() || r.status === this.status()) && (!this.location() || r.locationId === this.location())),
  );

  protected readonly typeStats = computed(() => {
    const icons: Record<string, string> = { HOT_DESK: 'desk', DEDICATED_DESK: 'armchair', PRIVATE_OFFICE: 'door', MEETING_ROOM: 'users' };
    return this.types.map((t) => {
      const list = this.resources.scoped().filter((r) => r.type === t);
      return { type: t, label: SPACE_TYPE_LABELS[t], count: list.length, active: list.filter((r) => r.status === 'ACTIVE').length, icon: icons[t] };
    });
  });

  protected readonly columns: Column<Resource>[] = [
    { key: 'name', label: 'Resource', primary: true },
    { key: 'type', label: 'Type', value: (r) => SPACE_TYPE_LABELS[r.type] },
    { key: 'location', label: 'Location', value: (r) => this.locations.shortName(r.locationId) },
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'price', label: 'Price', type: 'currency' },
    { key: 'availability', label: 'Availability', hideMobile: true, sortable: false },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected async remove(r: Resource): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Delete resource?', message: `${r.name} (${r.code}) will be removed from the floor map and can no longer be booked. This cannot be undone.`, confirmText: 'Delete resource', tone: 'danger' });
    if (!ok) return;
    this.resources.remove(r.id).subscribe(() => {
      this.audit.record('DELETE', 'Resources', 'Resource', r.id, `Deleted ${r.name}`);
      this.toast.success('Resource deleted', r.name);
    });
  }

  protected export(): void {
    downloadCsv(`resources-${todayStamp()}`, this.filtered(), [
      { label: 'ID', value: (r) => r.id },
      { label: 'Code', value: (r) => r.code },
      { label: 'Name', value: (r) => r.name },
      { label: 'Type', value: (r) => SPACE_TYPE_LABELS[r.type] },
      { label: 'Location', value: (r) => this.locations.name(r.locationId) },
      { label: 'Capacity', value: (r) => r.capacity },
      { label: 'Price', value: (r) => r.price },
      { label: 'Unit', value: (r) => r.priceUnit },
      { label: 'Status', value: (r) => r.status },
    ]);
    this.toast.success('Export ready');
  }
}

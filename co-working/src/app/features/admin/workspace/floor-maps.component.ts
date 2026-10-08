import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { SHARED } from '../../../shared';
import { FloorMapComponent } from '../../../shared/components/domain/floor-map.component';
import { Resource, SPACE_TYPE_LABELS } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { BookingService } from '../../../core/services/data/transaction-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { BookingEngineService } from '../../../core/services/booking-engine.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-floor-maps',
  imports: [...SHARED, FloorMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Floor Maps" subtitle="Live view of desks and rooms. Click any resource for details, blocking and bookings." [breadcrumbs]="[{ label: 'Workspace Management' }, { label: 'Floor Maps' }]" />

      <section class="card">
        <div class="toolbar">
          <select class="select" aria-label="Location" [ngModel]="locationId()" (ngModelChange)="locationId.set($event)">
            @for (l of locations.scoped(); track l.id) {
              <option [value]="l.id">{{ l.name }}</option>
            }
          </select>
          <input class="input" type="date" aria-label="Date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
          <select class="select" aria-label="Time slot" [ngModel]="hour()" (ngModelChange)="hour.set(+$event)">
            @for (h of hours; track h) {
              <option [value]="h">{{ h }}:00 – {{ h + 1 }}:00</option>
            }
          </select>
          <span class="spacer"></span>
          <span class="text-sm text-muted">{{ stats().available }} available · {{ stats().booked }} occupied · {{ stats().blocked }} blocked</span>
        </div>
        <div class="card-body">
          @if (resources().length) {
            <app-floor-map [resources]="resources()" [bookedIds]="busy()" [selectedId]="selected()?.id" [allowBlockedClick]="true" (pick)="selected.set($event)" [label]="'Floor map for ' + locations.name(locationId())" />
          } @else {
            <app-empty-state icon="map" title="No resources at this location" message="Add resources to see them on the floor map."><a class="btn btn-primary btn-sm" routerLink="/admin/resources/new" [queryParams]="{ locationId: locationId() }">Add resource</a></app-empty-state>
          }
        </div>
      </section>

      <app-drawer [open]="!!selected()" [title]="selected()?.name ?? ''" [subtitle]="selected() ? labels[selected()!.type] + ' · ' + selected()!.code : ''" (closed)="selected.set(null)">
        @if (selected(); as r) {
          <app-workspace-image [seed]="r.photos[0] ?? 1" style="height: 150px; border-radius: 8px" />
          <div class="row-sm mt-4">
            <app-status-badge [status]="busy().includes(r.id) ? 'BOOKED' : r.blocked ? 'BLOCKED' : r.status === 'ACTIVE' ? 'AVAILABLE' : r.status" />
            <span class="text-sm text-muted">for {{ date() }} · {{ hour() }}:00–{{ hour() + 1 }}:00</span>
          </div>
          <dl class="kv mt-4">
            <dt>Capacity</dt>
            <dd>{{ r.capacity }}</dd>
            <dt>Price</dt>
            <dd>{{ r.price | inr }} / {{ r.priceUnit }}</dd>
            <dt>Zone</dt>
            <dd>{{ r.floor }}</dd>
            <dt>Availability</dt>
            <dd>{{ r.availability }}</dd>
            <dt>Amenities</dt>
            <dd>{{ r.amenities.join(', ') }}</dd>
          </dl>
          <h4 class="section-title mt-5">Bookings on {{ date() }}</h4>
          <ul class="list-plain">
            @for (b of dayBookings(); track b.id) {
              <li class="list-row">
                <span><span class="fw-500">{{ b.startTime }}–{{ b.endTime }}</span> · {{ members.fullName(b.memberId) }}</span>
                <app-status-badge [status]="b.status" />
              </li>
            } @empty {
              <li class="text-muted text-sm">No member bookings on this date.</li>
            }
          </ul>
        }
        <div footer class="btn-group">
          @if (selected(); as r) {
            @if (auth.can('resources.edit')) {
              <button type="button" class="btn btn-secondary" (click)="toggleBlock(r)">
                <app-icon [name]="r.blocked ? 'unlock' : 'lock'" [size]="16" /> {{ r.blocked ? 'Unblock' : 'Block' }}
              </button>
            }
            <a class="btn btn-primary" [routerLink]="['/admin/resources', r.id]">Open resource</a>
          }
        </div>
      </app-drawer>
    </div>
  `,
})
export class FloorMapsComponent implements OnInit {
  readonly queryLocation = input<string>(undefined, { alias: 'locationId' });
  protected readonly locations = inject(LocationService);
  private readonly resourceSvc = inject(ResourceService);
  private readonly bookings = inject(BookingService);
  protected readonly members = inject(MemberService);
  private readonly engine = inject(BookingEngineService);
  private readonly ctx = inject(LocationContextService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly labels = SPACE_TYPE_LABELS;
  protected readonly hours = Array.from({ length: 13 }, (_, i) => 8 + i);
  protected readonly locationId = signal('');
  protected readonly date = signal(new Date().toLocaleDateString('en-CA'));
  protected readonly hour = signal(Math.min(Math.max(new Date().getHours(), 8), 20));
  protected readonly selected = signal<Resource | null>(null);

  ngOnInit(): void {
    const initial = this.queryLocation() ?? this.ctx.singleLocationId() ?? this.locations.scoped()[0]?.id;
    if (initial) this.locationId.set(initial);
  }

  protected readonly resources = computed(() => this.resourceSvc.items().filter((r) => r.locationId === this.locationId()));
  protected readonly busy = computed(() =>
    this.engine.busyResourceIds(this.locationId(), this.date(), `${String(this.hour()).padStart(2, '0')}:00`, `${String(this.hour() + 1).padStart(2, '0')}:00`),
  );
  protected readonly stats = computed(() => {
    const busy = new Set(this.busy());
    const rs = this.resources();
    const blocked = rs.filter((r) => r.blocked || r.status !== 'ACTIVE').length;
    const booked = rs.filter((r) => busy.has(r.id) && !r.blocked && r.status === 'ACTIVE').length;
    return { blocked, booked, available: rs.length - blocked - booked };
  });
  protected readonly dayBookings = computed(() => {
    const r = this.selected();
    if (!r) return [];
    return this.bookings.items().filter((b) => b.resourceId === r.id && b.date === this.date());
  });

  protected toggleBlock(r: Resource): void {
    const updated = this.resourceSvc.updateSync(r.id, { blocked: !r.blocked });
    this.selected.set(updated);
    this.audit.record('UPDATE', 'Resources', 'Resource', r.id, `${updated.blocked ? 'Blocked' : 'Unblocked'} ${r.name} on floor map`);
    this.toast.success(updated.blocked ? 'Resource blocked' : 'Resource unblocked', r.name);
  }
}

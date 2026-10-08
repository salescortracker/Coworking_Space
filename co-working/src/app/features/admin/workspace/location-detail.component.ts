import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader } from '../../../shared';
import { FloorMapComponent } from '../../../shared/components/domain/floor-map.component';
import { Booking, Member, Resource, SPACE_TYPE_LABELS } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { MemberService, CompanyService } from '../../../core/services/data/people-data.service';
import { BookingService } from '../../../core/services/data/transaction-data.service';
import { PlanService } from '../../../core/services/data/membership-data.service';
import { BookingEngineService } from '../../../core/services/booking-engine.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-location-detail',
  imports: [...SHARED, FloorMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @switch (loader.status()) {
        @case ('loading') {
          <app-loading-state variant="detail" />
        }
        @case ('error') {
          <div class="card"><app-error-state (retry)="loader.load()" /></div>
        }
        @default {
          @if (loc(); as l) {
            <app-page-header [title]="l.name" [subtitle]="l.address + ', ' + l.city + ' ' + l.pincode" [breadcrumbs]="[{ label: 'Locations', link: '/admin/locations' }, { label: l.name }]">
              <app-status-badge badge [status]="l.status" />
              <a class="btn btn-secondary" [routerLink]="['/locations', l.id]" target="_blank"><app-icon name="external" [size]="16" /> Public page</a>
              @if (auth.can('resources.create')) {
                <a class="btn btn-secondary" routerLink="/admin/resources/new" [queryParams]="{ locationId: l.id }"><app-icon name="plus" [size]="16" /> Add resource</a>
              }
              @if (auth.can('locations.edit')) {
                <a class="btn btn-primary" [routerLink]="['/admin/locations', l.id, 'edit']"><app-icon name="edit" [size]="16" /> Edit</a>
              }
            </app-page-header>

            <app-tabs [tabs]="tabs()" [(value)]="tab" label="Location sections" />

            <div class="mt-5">
              @switch (tab()) {
                @case ('overview') {
                  <div class="split">
                    <div class="stack">
                      <div class="grid grid-3">
                        @for (p of l.photos.slice(0, 3); track p) {
                          <app-workspace-image [seed]="p" style="height: 150px; border-radius: 8px" />
                        }
                      </div>
                      <section class="card card-body">
                        <h3 class="section-title">About</h3>
                        <p class="text-secondary">{{ l.description }}</p>
                        <h3 class="section-title mt-4">Amenities</h3>
                        <div class="tag-list">
                          @for (a of l.amenities; track a) {
                            <span class="tag">{{ a }}</span>
                          }
                        </div>
                      </section>
                      <div class="stat-grid">
                        <app-stat-card label="Resources" [value]="resources().length" icon="layers" />
                        <app-stat-card label="Members" [value]="members().length" icon="users" tone="info" />
                        <app-stat-card label="Bookings today" [value]="todayBookings()" icon="calendar" tone="success" />
                        <app-stat-card label="Rating" [value]="l.rating + ' ★'" icon="star" tone="warning" [hint]="l.reviewCount + ' reviews'" />
                      </div>
                    </div>
                    <div class="stack">
                      <section class="card card-body">
                        <h3 class="section-title">Contact & hours</h3>
                        <dl class="kv">
                          <dt>Weekdays</dt>
                          <dd>{{ l.openingHours.weekdays }}</dd>
                          <dt>Saturday</dt>
                          <dd>{{ l.openingHours.saturday }}</dd>
                          <dt>Sunday</dt>
                          <dd>{{ l.openingHours.sunday }}</dd>
                          <dt>Phone</dt>
                          <dd>{{ l.phone }}</dd>
                          <dt>Email</dt>
                          <dd>{{ l.email }}</dd>
                          <dt>Coordinates</dt>
                          <dd class="mono">{{ l.latitude }}, {{ l.longitude }}</dd>
                          <dt>Total seats</dt>
                          <dd>{{ l.totalSeats }}</dd>
                        </dl>
                      </section>
                      <section class="card card-body">
                        <h3 class="section-title">Nearby transport</h3>
                        <ul class="check-list">
                          @for (t of l.transport; track t) {
                            <li><app-icon name="train" [size]="16" /> {{ t }}</li>
                          } @empty {
                            <li class="text-muted">No transport details yet.</li>
                          }
                        </ul>
                      </section>
                    </div>
                  </div>
                }
                @case ('resources') {
                  <app-data-table [rows]="resources()" [columns]="resourceCols" searchPlaceholder="Search resources" emptyTitle="No resources at this location" [rowClickable]="true" (rowClick)="router.navigate(['/admin/resources', $event.id])" caption="Resources">
                    <a empty-action class="btn btn-primary btn-sm" routerLink="/admin/resources/new" [queryParams]="{ locationId: l.id }">Add resource</a>
                  </app-data-table>
                }
                @case ('floor') {
                  <section class="card card-body">
                    <div class="row-between mb-4 row-wrap">
                      <div>
                        <h3 class="card-title">Live floor map</h3>
                        <p class="text-muted text-sm mb-0">Occupancy right now ({{ now.start }}–{{ now.end }}). Click a resource for details.</p>
                      </div>
                      <a class="btn btn-secondary btn-sm" routerLink="/admin/floor-maps" [queryParams]="{ locationId: l.id }">Open floor map manager</a>
                    </div>
                    <app-floor-map [resources]="resources()" [bookedIds]="busy()" (pick)="router.navigate(['/admin/resources', $event.id])" />
                  </section>
                }
                @case ('pricing') {
                  <div class="grid grid-2">
                    <section class="card">
                      <div class="card-header"><h3 class="card-title">Resource pricing</h3></div>
                      <div class="card-body flush">
                        <table class="table responsive">
                          <thead><tr><th>Type</th><th class="num">From</th><th class="num">To</th><th>Unit</th></tr></thead>
                          <tbody>
                            @for (p of pricing(); track p.type) {
                              <tr>
                                <td data-label="Type" class="cell-primary">{{ p.label }}</td>
                                <td data-label="From" class="num">{{ p.min | inr }}</td>
                                <td data-label="To" class="num">{{ p.max | inr }}</td>
                                <td data-label="Unit">per {{ p.unit }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <section class="card">
                      <div class="card-header"><h3 class="card-title">Membership plans</h3><a routerLink="/admin/membership/plans" class="btn btn-ghost btn-sm">Manage</a></div>
                      <div class="card-body flush">
                        <table class="table responsive">
                          <thead><tr><th>Plan</th><th class="num">Price</th><th>Cycle</th></tr></thead>
                          <tbody>
                            @for (p of plans.published(); track p.id) {
                              <tr>
                                <td data-label="Plan" class="cell-primary">{{ p.name }}</td>
                                <td data-label="Price" class="num">{{ p.price | inr }}</td>
                                <td data-label="Cycle">{{ p.billingCycle | humanize }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                }
                @case ('bookings') {
                  <app-data-table [rows]="bookings()" [columns]="bookingCols" [defaultSort]="{ key: 'date', dir: 'desc' }" searchPlaceholder="Search bookings" emptyTitle="No bookings yet" [rowClickable]="true" (rowClick)="router.navigate(['/admin/bookings', $event.id])" caption="Bookings" />
                }
                @case ('members') {
                  <app-data-table [rows]="members()" [columns]="memberCols" searchPlaceholder="Search members" emptyTitle="No members at this location" [rowClickable]="true" (rowClick)="router.navigate(['/admin/members', $event.id])" caption="Members" />
                }
              }
            </div>
          } @else {
            <div class="card"><app-empty-state icon="building" title="Location not found" message="This location may have been removed."><a routerLink="/admin/locations" class="btn btn-secondary">Back to locations</a></app-empty-state></div>
          }
        }
      }
    </div>
  `,
})
export class LocationDetailComponent {
  readonly id = input.required<string>();
  private readonly locations = inject(LocationService);
  private readonly resourceSvc = inject(ResourceService);
  private readonly memberSvc = inject(MemberService);
  private readonly companies = inject(CompanyService);
  private readonly bookingSvc = inject(BookingService);
  protected readonly plans = inject(PlanService);
  private readonly engine = inject(BookingEngineService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  protected readonly loader = createLoader(() => this.locations.get(this.id()));
  protected readonly tab = signal('overview');
  protected readonly loc = computed(() => this.locations.find(this.id()));
  protected readonly resources = computed(() => this.resourceSvc.items().filter((r) => r.locationId === this.id()));
  protected readonly members = computed(() => this.memberSvc.items().filter((m) => m.locationId === this.id()));
  protected readonly bookings = computed(() => this.bookingSvc.items().filter((b) => b.locationId === this.id()));
  protected readonly todayBookings = computed(() => {
    const t = new Date().toLocaleDateString('en-CA');
    return this.bookings().filter((b) => b.date === t && b.status !== 'CANCELLED').length;
  });
  protected readonly now = (() => {
    const h = Math.min(Math.max(new Date().getHours(), 8), 20);
    return { start: `${String(h).padStart(2, '0')}:00`, end: `${String(h + 1).padStart(2, '0')}:00` };
  })();
  protected readonly busy = computed(() => this.engine.busyResourceIds(this.id(), new Date().toLocaleDateString('en-CA'), this.now.start, this.now.end));

  protected readonly tabs = computed(() => [
    { id: 'overview', label: 'Overview' },
    { id: 'resources', label: 'Resources', count: this.resources().length },
    { id: 'floor', label: 'Floor Map' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'bookings', label: 'Bookings', count: this.bookings().length },
    { id: 'members', label: 'Members', count: this.members().length },
  ]);

  protected readonly pricing = computed(() => {
    const types = ['HOT_DESK', 'DEDICATED_DESK', 'PRIVATE_OFFICE', 'MEETING_ROOM'] as const;
    return types
      .map((t) => {
        const rs = this.resources().filter((r) => r.type === t);
        return { type: t, label: SPACE_TYPE_LABELS[t], min: Math.min(...rs.map((r) => r.price)), max: Math.max(...rs.map((r) => r.price)), unit: rs[0]?.priceUnit ?? 'hour', count: rs.length };
      })
      .filter((p) => p.count);
  });

  protected readonly resourceCols: Column<Resource>[] = [
    { key: 'name', label: 'Resource', primary: true },
    { key: 'code', label: 'Code', hideMobile: true },
    { key: 'type', label: 'Type', value: (r) => SPACE_TYPE_LABELS[r.type] },
    { key: 'capacity', label: 'Capacity', type: 'number' },
    { key: 'price', label: 'Price', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly bookingCols: Column<Booking>[] = [
    { key: 'id', label: 'Booking ID', primary: true },
    { key: 'member', label: 'Member', value: (b) => this.memberSvc.fullName(b.memberId) },
    { key: 'resource', label: 'Resource', value: (b) => this.resourceSvc.name(b.resourceId) },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'time', label: 'Time', value: (b) => `${b.startTime}–${b.endTime}`, hideMobile: true },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly memberCols: Column<Member>[] = [
    { key: 'name', label: 'Name', value: (m) => `${m.firstName} ${m.lastName}`, primary: true },
    { key: 'company', label: 'Company', value: (m) => this.companies.name(m.companyId) },
    { key: 'email', label: 'Email', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'joinDate', label: 'Joined', type: 'date' },
  ];
}

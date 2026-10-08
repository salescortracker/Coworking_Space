import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader } from '../../../shared';
import { Booking, SPACE_TYPE_LABELS } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { BookingService } from '../../../core/services/data/transaction-data.service';
import { BookingEngineService, CLOSE_HOUR, OPEN_HOUR } from '../../../core/services/booking-engine.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-resource-detail',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (loader.status() === 'loading') {
        <app-loading-state variant="detail" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else if (res(); as r) {
        <app-page-header [title]="r.name" [subtitle]="labels[r.type] + ' · ' + locations.name(r.locationId) + ' · ' + r.floor" [breadcrumbs]="[{ label: 'Resources', link: '/admin/resources' }, { label: r.name }]">
          <app-status-badge badge [status]="r.status" />
          @if (r.blocked) {
            <span badge class="badge badge-neutral">Blocked</span>
          }
          @if (auth.can('resources.edit')) {
            <button type="button" class="btn btn-secondary" (click)="toggleMaintenance()">
              <app-icon name="settings" [size]="16" /> {{ r.status === 'MAINTENANCE' ? 'End maintenance' : 'Mark maintenance' }}
            </button>
            <a class="btn btn-primary" [routerLink]="['/admin/resources', r.id, 'edit']"><app-icon name="edit" [size]="16" /> Edit</a>
          }
        </app-page-header>
        <app-tabs [tabs]="tabs" [(value)]="tab" label="Resource sections" />
        <div class="mt-5">
          @switch (tab()) {
            @case ('overview') {
              <div class="split">
                <section class="card card-body">
                  <app-workspace-image [seed]="r.photos[0] ?? 1" style="height: 220px; border-radius: 8px" />
                  <div class="kv-grid mt-5">
                    <div class="kv-item"><div class="k">Code</div><div class="v mono">{{ r.code }}</div></div>
                    <div class="kv-item"><div class="k">Type</div><div class="v">{{ labels[r.type] }}</div></div>
                    <div class="kv-item"><div class="k">Capacity</div><div class="v">{{ r.capacity }} {{ r.capacity === 1 ? 'seat' : 'seats' }}</div></div>
                    <div class="kv-item"><div class="k">Price</div><div class="v">{{ r.price | inr }} / {{ r.priceUnit }}</div></div>
                    <div class="kv-item"><div class="k">Availability</div><div class="v">{{ r.availability }}</div></div>
                    <div class="kv-item"><div class="k">Location</div><div class="v"><a [routerLink]="['/admin/locations', r.locationId]">{{ locations.name(r.locationId) }}</a></div></div>
                  </div>
                </section>
                <div class="stack">
                  <div class="stat-grid" style="grid-template-columns: 1fr 1fr">
                    <app-stat-card label="Upcoming" [value]="upcoming()" icon="calendar" />
                    <app-stat-card label="Utilisation (30d)" [value]="utilisation() + '%'" icon="chart" tone="success" />
                  </div>
                  <section class="card card-body">
                    <h3 class="section-title">Cancellation rules</h3>
                    <p class="text-secondary mb-0">{{ r.cancellationRule }}</p>
                  </section>
                </div>
              </div>
            }
            @case ('availability') {
              <section class="card">
                <div class="card-header">
                  <div>
                    <h3 class="card-title">Next 7 days</h3>
                    <div class="card-subtitle">Green = available, red = booked/occupied, grey = closed</div>
                  </div>
                </div>
                <div class="card-body" style="overflow-x: auto">
                  <div class="avail-grid" [style.grid-template-columns]="'110px repeat(' + hours.length + ', minmax(30px, 1fr))'">
                    <span></span>
                    @for (h of hours; track h) {
                      <span class="avail-hour">{{ h }}</span>
                    }
                    @for (d of availability(); track d.date) {
                      <span class="avail-label">{{ d.label }}</span>
                      @for (c of d.cells; track $index) {
                        <span class="avail-cell" [class.busy]="c === 'busy'" [class.closed]="c === 'closed'" [attr.title]="d.label + ' ' + hours[$index] + ':00 – ' + c"></span>
                      }
                    }
                  </div>
                </div>
              </section>
            }
            @case ('bookings') {
              <app-data-table [rows]="bookings()" [columns]="cols" [defaultSort]="{ key: 'date', dir: 'desc' }" emptyTitle="No bookings for this resource" [rowClickable]="true" (rowClick)="router.navigate(['/admin/bookings', $event.id])" caption="Resource bookings" />
            }
            @case ('pricing') {
              <section class="card card-body" style="max-width: 560px">
                <h3 class="section-title">Pricing</h3>
                <div class="summary-line"><span>Base price</span><span>{{ r.price | inr }} / {{ r.priceUnit }}</span></div>
                <div class="summary-line"><span>GST ({{ gstPct }}%)</span><span>{{ r.price * gst | inr }}</span></div>
                <div class="summary-line total"><span>Price incl. GST</span><span>{{ r.price * (1 + gst) | inr }}</span></div>
                <p class="text-sm text-muted mt-3 mb-0">Members can pay with plan credits first; any balance is charged at checkout. Half-day rates apply to day-priced resources under 6 hours.</p>
              </section>
            }
            @case ('amenities') {
              <section class="card card-body">
                <ul class="check-list" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))">
                  @for (a of r.amenities; track a) {
                    <li><app-icon name="check" [size]="16" /> {{ a }}</li>
                  }
                </ul>
              </section>
            }
          }
        </div>
      } @else {
        <div class="card"><app-empty-state icon="layers" title="Resource not found"><a routerLink="/admin/resources" class="btn btn-secondary">Back to resources</a></app-empty-state></div>
      }
    </div>
  `,
})
export class ResourceDetailComponent {
  readonly id = input.required<string>();
  private readonly resources = inject(ResourceService);
  protected readonly locations = inject(LocationService);
  private readonly members = inject(MemberService);
  private readonly bookingSvc = inject(BookingService);
  private readonly engine = inject(BookingEngineService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly audit = inject(AuditService);

  protected readonly loader = createLoader(() => this.resources.get(this.id()));
  protected readonly labels = SPACE_TYPE_LABELS;
  /** GST rate from Settings → Business rules (database). */
  protected readonly gst = inject(SettingsService).gstFraction();
  protected readonly gstPct = inject(SettingsService).settings().gstRate;
  protected readonly tab = signal('overview');
  protected readonly tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'availability', label: 'Availability' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'amenities', label: 'Amenities' },
  ];
  protected readonly hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
  protected readonly res = computed(() => this.resources.find(this.id()));
  protected readonly bookings = computed(() => this.bookingSvc.items().filter((b) => b.resourceId === this.id()));
  protected readonly upcoming = computed(() => {
    const t = new Date().toLocaleDateString('en-CA');
    return this.bookings().filter((b) => b.date >= t && b.status === 'CONFIRMED').length;
  });
  protected readonly utilisation = computed(() => {
    const r = this.res();
    if (!r) return 0;
    let busy = 0;
    let total = 0;
    for (let d = -30; d < 0; d++) {
      const date = new Date(Date.now() + d * 86400000).toLocaleDateString('en-CA');
      for (const h of this.hours) {
        total++;
        if (this.engine.busyResourceIds(r.locationId, date, `${String(h).padStart(2, '0')}:00`, `${String(h + 1).padStart(2, '0')}:00`).includes(r.id)) busy++;
      }
    }
    return Math.round((busy / total) * 100);
  });
  protected readonly availability = computed(() => {
    const r = this.res();
    if (!r) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const date = d.toLocaleDateString('en-CA');
      const sunday = d.getDay() === 0;
      return {
        date,
        label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        cells: this.hours.map((h) => {
          if (sunday && !r.availability.includes('All days')) return 'closed';
          if (r.status !== 'ACTIVE') return 'closed';
          const busy = this.engine.busyResourceIds(r.locationId, date, `${String(h).padStart(2, '0')}:00`, `${String(h + 1).padStart(2, '0')}:00`).includes(r.id);
          return busy ? 'busy' : 'free';
        }),
      };
    });
  });

  protected readonly cols: Column<Booking>[] = [
    { key: 'id', label: 'Booking ID', primary: true },
    { key: 'member', label: 'Member', value: (b) => this.members.fullName(b.memberId) },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'time', label: 'Time', value: (b) => `${b.startTime}–${b.endTime}` },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected async toggleMaintenance(): Promise<void> {
    const r = this.res()!;
    const toMaint = r.status !== 'MAINTENANCE';
    const ok = await this.confirm.confirm({
      title: toMaint ? 'Mark under maintenance?' : 'End maintenance?',
      message: toMaint ? 'Members will not be able to book this resource until maintenance ends.' : 'The resource becomes bookable again.',
      confirmText: toMaint ? 'Mark maintenance' : 'End maintenance',
      tone: toMaint ? 'warning' : 'primary',
    });
    if (!ok) return;
    this.resources.update(r.id, { status: toMaint ? 'MAINTENANCE' : 'ACTIVE' }).subscribe(() => {
      this.audit.record('STATUS_CHANGE', 'Resources', 'Resource', r.id, `${toMaint ? 'Maintenance started' : 'Maintenance ended'} for ${r.name}`);
      this.toast.success(toMaint ? 'Resource under maintenance' : 'Resource active');
    });
  }
}

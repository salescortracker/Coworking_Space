import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED, createLoader, todayIso } from '../../../shared';
import { PlanCardComponent, WorkspaceCardComponent } from '../../../shared/components/domain/domain-cards.component';
import { AMENITIES, SPACE_TYPE_LABELS, SpaceType } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { PlanService } from '../../../core/services/data/membership-data.service';
import { CatalogService, SearchCriteria } from '../../../core/services/catalog.service';
import { SettingsService } from '../../../core/services/settings.service';

/** Search results (§4): filters, sorting, list / map view. */
@Component({
  selector: 'app-search',
  imports: [...SHARED, WorkspaceCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      <app-page-header [title]="results().length + ' workspaces found'" [subtitle]="summary()" [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Search' }]">
        <label class="sr-only" for="sort">Sort by</label>
        <select id="sort" class="select" style="width: auto" [ngModel]="sort()" (ngModelChange)="sort.set($event)">
          <option value="rating">Rating</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="distance">Distance</option>
        </select>
        <div class="segmented" role="radiogroup" aria-label="View mode">
          <button type="button" [class.active]="view() === 'list'" (click)="view.set('list')"><app-icon name="list" [size]="14" /> List</button>
          <button type="button" [class.active]="view() === 'map'" (click)="view.set('map')"><app-icon name="map" [size]="14" /> Map</button>
        </div>
        <button type="button" class="btn btn-secondary show-mobile-flex" (click)="filtersOpen.set(!filtersOpen())"><app-icon name="filter" [size]="16" /> Filters</button>
      </app-page-header>

      <div class="search-layout">
        <aside class="card card-body filter-panel" [class.hide-mobile]="!filtersOpen()" aria-label="Filters">
          <div class="row-between"><h2 class="text-md fw-600">Filters</h2><button type="button" class="btn btn-link text-sm" (click)="clear()">Clear all</button></div>
          <div class="filter-group">
            <h3>Location</h3>
            <select class="select" aria-label="City" [ngModel]="city()" (ngModelChange)="city.set($event); locationId.set('')">
              <option value="">All cities</option>
              @for (c of locations.cities(); track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
            <select class="select mt-2" aria-label="Centre" [ngModel]="locationId()" (ngModelChange)="locationId.set($event)">
              <option value="">All centres</option>
              @for (l of centres(); track l.id) {
                <option [value]="l.id">{{ l.name }}</option>
              }
            </select>
          </div>
          <div class="filter-group">
            <h3>Space type</h3>
            <div class="stack-sm">
              <label class="check"><input type="radio" name="type" [checked]="!type()" (change)="type.set('')" /> Any</label>
              @for (t of types; track t) {
                <label class="check"><input type="radio" name="type" [checked]="type() === t" (change)="type.set(t)" /> {{ labels[t] }}</label>
              }
            </div>
          </div>
          <div class="filter-group">
            <h3>Date & capacity</h3>
            <input class="input" type="date" aria-label="Date" [min]="today" [ngModel]="date()" (ngModelChange)="date.set($event)" />
            <label class="label mt-3 d-block" for="cap">Seats needed: {{ seats() }}</label>
            <input id="cap" type="range" min="1" max="12" [ngModel]="seats()" (ngModelChange)="seats.set(+$event)" class="w-100" />
          </div>
          <div class="filter-group">
            <h3>Max price</h3>
            <label class="label d-block" for="price">Up to {{ maxPrice() ? (maxPrice() | inr) : 'any price' }}</label>
            <input id="price" type="range" min="0" max="6000" step="100" [ngModel]="maxPrice()" (ngModelChange)="maxPrice.set(+$event)" class="w-100" />
          </div>
          <div class="filter-group">
            <h3>Rating</h3>
            <div class="segmented">
              @for (r of [0, 4, 4.5]; track r) {
                <button type="button" [class.active]="minRating() === r" (click)="minRating.set(r)">{{ r ? r + '+' : 'Any' }}</button>
              }
            </div>
          </div>
          <div class="filter-group">
            <h3>Amenities</h3>
            <div class="stack-sm">
              @for (a of amenityOptions; track a) {
                <label class="check"><input type="checkbox" [checked]="amenities().includes(a)" (change)="toggleAmenity(a)" /> {{ a }}</label>
              }
            </div>
          </div>
        </aside>

        <div>
          @if (loader.status() === 'loading') {
            <app-loading-state variant="cards" [rows]="4" />
          } @else if (loader.status() === 'error') {
            <div class="card"><app-error-state (retry)="loader.load()" /></div>
          } @else if (!results().length) {
            <div class="card"><app-empty-state icon="search" title="No workspaces match your filters" message="Try another date, fewer seats or a different city."><button type="button" class="btn btn-secondary" (click)="clear()">Clear filters</button></app-empty-state></div>
          } @else if (view() === 'list') {
            <div class="stack">
              @for (o of results(); track o.location.id) {
                <app-workspace-card layout="list" [location]="o.location" [type]="o.type" [price]="o.price" [unit]="o.unit" [capacity]="o.capacity" [available]="o.available" />
              }
            </div>
          } @else {
            <div class="map-ph" style="height: 420px" role="img" aria-label="Map of matching locations">
              <span class="road" style="left: 0; right: 0; top: 46%; height: 10px"></span>
              <span class="road" style="top: 0; bottom: 0; left: 38%; width: 10px"></span>
              <span class="road" style="top: 0; bottom: 0; left: 72%; width: 8px"></span>
              @for (o of results(); track o.location.id; let i = $index) {
                <button type="button" class="map-pin" [class.active]="hover() === o.location.id" style="background: none; border: 0" [style.left.%]="pinX(i)" [style.top.%]="pinY(i)" (click)="hover.set(o.location.id)" (mouseenter)="hover.set(o.location.id)">
                  <span>{{ o.price | inr }}</span>
                  <app-icon name="map-pin" [size]="28" [stroke]="2.2" />
                </button>
              }
            </div>
            <div class="grid grid-2 mt-4">
              @for (o of results(); track o.location.id) {
                <div (mouseenter)="hover.set(o.location.id)"><app-workspace-card [location]="o.location" [type]="o.type" [price]="o.price" [unit]="o.unit" [capacity]="o.capacity" [available]="o.available" /></div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class SearchComponent implements OnInit {
  readonly qCity = input<string>(undefined, { alias: 'city' });
  readonly qType = input<string>(undefined, { alias: 'type' });
  readonly qDate = input<string>(undefined, { alias: 'date' });
  readonly qSeats = input<string>(undefined, { alias: 'seats' });
  protected readonly locations = inject(LocationService);
  private readonly catalog = inject(CatalogService);
  protected readonly loader = createLoader(() => this.locations.list());
  protected readonly labels = SPACE_TYPE_LABELS;
  protected readonly types = Object.keys(SPACE_TYPE_LABELS) as SpaceType[];
  protected readonly amenityOptions = AMENITIES.slice(0, 10);
  protected readonly today = todayIso();
  protected readonly city = signal('');
  protected readonly locationId = signal('');
  protected readonly type = signal<SpaceType | ''>('');
  protected readonly date = signal(todayIso());
  protected readonly seats = signal(1);
  protected readonly maxPrice = signal(0);
  protected readonly minRating = signal(0);
  protected readonly amenities = signal<string[]>([]);
  protected readonly sort = signal<NonNullable<SearchCriteria['sort']>>('rating');
  protected readonly view = signal<'list' | 'map'>('list');
  protected readonly filtersOpen = signal(false);
  protected readonly hover = signal<string | null>(null);

  ngOnInit(): void {
    this.city.set(this.qCity() ?? '');
    this.type.set((this.qType() as SpaceType) ?? '');
    if (this.qDate()) this.date.set(this.qDate()!);
    if (this.qSeats()) this.seats.set(Math.max(1, Number(this.qSeats())));
  }

  protected readonly centres = computed(() => this.locations.active().filter((l) => !this.city() || l.city === this.city()));
  protected readonly results = computed(() =>
    this.catalog.search({ city: this.city(), locationId: this.locationId(), type: this.type(), date: this.date(), seats: this.seats(), maxPrice: this.maxPrice() || undefined, minRating: this.minRating() || undefined, amenities: this.amenities(), sort: this.sort() }),
  );
  protected readonly summary = computed(() => [this.city() || 'All cities', this.type() ? SPACE_TYPE_LABELS[this.type() as SpaceType] : 'Any workspace', this.date(), `${this.seats()} seat${this.seats() > 1 ? 's' : ''}`].join(' · '));

  protected toggleAmenity(a: string): void {
    this.amenities.update((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]));
  }
  protected clear(): void {
    this.city.set('');
    this.locationId.set('');
    this.type.set('');
    this.seats.set(1);
    this.maxPrice.set(0);
    this.minRating.set(0);
    this.amenities.set([]);
  }
  protected pinX(i: number): number {
    return [20, 44, 64, 82, 30, 55][i % 6];
  }
  protected pinY(i: number): number {
    return [30, 62, 28, 70, 80, 45][i % 6];
  }
}

@Component({
  selector: 'app-locations-public',
  imports: [...SHARED, WorkspaceCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      <app-page-header title="Our locations" subtitle="Premium coworking centres in three cities." [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Locations' }]">
        <div class="segmented" role="radiogroup" aria-label="City">
          <button type="button" [class.active]="!city()" (click)="city.set('')">All</button>
          @for (c of locations.cities(); track c) {
            <button type="button" [class.active]="city() === c" (click)="city.set(c)">{{ c }}</button>
          }
        </div>
      </app-page-header>
      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="3" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else {
        <div class="grid grid-3">
          @for (o of list(); track o.location.id) {
            <app-workspace-card [location]="o.location" [price]="o.price" [unit]="o.unit" [capacity]="o.capacity" [available]="o.available" />
          }
        </div>
      }
    </div>
  `,
})
export class LocationsPublicComponent {
  protected readonly locations = inject(LocationService);
  private readonly catalog = inject(CatalogService);
  protected readonly loader = createLoader(() => this.locations.list());
  protected readonly city = signal('');
  protected readonly list = computed(() => this.catalog.search({ city: this.city(), sort: 'distance' }));
}

/** Location details (§4): gallery, description, amenities, hours, map, types, plans, pricing, transport, reviews, CTAs. */
@Component({
  selector: 'app-location-public',
  imports: [...SHARED, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      @if (loader.status() === 'loading') {
        <app-loading-state variant="detail" />
      } @else if (loc(); as l) {
        <app-page-header [title]="l.name" [subtitle]="l.address + ', ' + l.city + ' ' + l.pincode" [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Locations', link: '/locations' }, { label: l.name }]">
          <span badge class="rating"><app-icon name="star" [size]="14" /> {{ l.rating }} ({{ l.reviewCount }})</span>
        </app-page-header>
        <div class="gallery-grid mb-5">
          @for (p of gallery(); track $index) {
            <app-workspace-image [seed]="p" [place]="l.name" [priority]="$first" [sizes]="$first ? '(max-width: 767px) 100vw, 50vw' : '(max-width: 767px) 50vw, 25vw'" />
          }
        </div>
        <div class="split">
          <div class="stack-lg">
            <section>
              <h2 class="section-title">About this centre</h2>
              <p class="text-secondary">{{ l.description }}</p>
            </section>
            <section>
              <h2 class="section-title">Workspace types & pricing</h2>
              <div class="card">
                <table class="table responsive">
                  <thead><tr><th>Workspace</th><th>Capacity</th><th class="num">From</th><th></th></tr></thead>
                  <tbody>
                    @for (o of offerings(); track o.type) {
                      <tr>
                        <td data-label="Workspace" class="cell-primary">{{ labels[o.type!] }}</td>
                        <td data-label="Capacity">{{ o.type === 'MEETING_ROOM' || o.type === 'PRIVATE_OFFICE' ? 'Up to ' + o.capacity + ' people' : o.type === 'DAY_PASS' ? 'Any open desk' : o.capacity + ' desks' }}</td>
                        <td data-label="From" class="num">{{ o.price | inr }} / {{ o.unit }}</td>
                        <td data-label="" class="num"><a class="btn btn-secondary btn-sm" routerLink="/book-now" [queryParams]="{ location: l.id, type: o.type }">Book</a></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2 class="section-title">Amenities</h2>
              <ul class="check-list" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))">
                @for (a of l.amenities; track a) {
                  <li><app-icon name="check" [size]="16" /> {{ a }}</li>
                }
              </ul>
            </section>
            <section>
              <div class="row-between mb-3"><h2 class="section-title mb-0">Membership plans</h2><a routerLink="/membership" class="btn btn-ghost btn-sm">Compare all</a></div>
              <div class="grid grid-2" style="padding-top: 10px">
                @for (p of plans.published().slice(1, 3); track p.id) {
                  <app-plan-card [plan]="p" cta="Get started" (choose)="router.navigate(['/register'])" />
                }
              </div>
            </section>
            <section>
              <h2 class="section-title">Reviews</h2>
              <div class="stack">
                @for (r of l.reviews; track r.id) {
                  <div class="card card-body">
                    <div class="row-between"><span class="fw-600">{{ r.author }}</span><span class="rating">@for (s of stars(r.rating); track $index) {<app-icon name="star" [size]="13" />}</span></div>
                    <p class="mb-0 mt-2 text-secondary">{{ r.text }}</p>
                    <div class="text-xs text-muted mt-1">{{ r.date | date: 'd MMM y' }}</div>
                  </div>
                } @empty {
                  <p class="text-muted">No reviews yet.</p>
                }
              </div>
            </section>
          </div>
          <aside class="stack sticky-side">
            <section class="card card-body stack-sm">
              <div class="text-sm text-muted">Workspaces from</div>
              <div><span class="price-lg">{{ l.startingPrice | inr }}</span><span class="price-unit"> / day</span></div>
              <a class="btn btn-primary btn-lg btn-block" routerLink="/book-now" [queryParams]="{ location: l.id }">Book Now</a>
              <a class="btn btn-secondary btn-block" routerLink="/schedule-tour" [queryParams]="{ location: l.id }"><app-icon name="calendar" [size]="16" /> Schedule Tour</a>
              <a class="btn btn-secondary btn-block" routerLink="/request-callback" [queryParams]="{ location: l.id }"><app-icon name="phone" [size]="16" /> Request Callback</a>
            </section>
            <section class="card card-body">
              <h3 class="section-title">Opening hours</h3>
              <dl class="kv">
                <dt>Mon – Fri</dt><dd>{{ l.openingHours.weekdays }}</dd>
                <dt>Saturday</dt><dd>{{ l.openingHours.saturday }}</dd>
                <dt>Sunday</dt><dd>{{ l.openingHours.sunday }}</dd>
              </dl>
            </section>
            <section class="card card-body">
              <h3 class="section-title">Address & map</h3>
              <p class="text-sm">{{ l.address }}, {{ l.city }}, {{ l.state }} {{ l.pincode }}</p>
              <div class="map-ph" role="img" [attr.aria-label]="'Map placeholder for ' + l.name">
                <span class="road" style="left: 0; right: 0; top: 55%; height: 10px"></span>
                <span class="road" style="top: 0; bottom: 0; left: 40%; width: 8px"></span>
                <span class="map-pin active" style="left: 46%; top: 52%"><span>{{ l.name.replace('Officera ', '') }}</span><app-icon name="map-pin" [size]="30" [stroke]="2.2" /></span>
              </div>
              <a class="btn btn-ghost btn-sm mt-2" [href]="'https://maps.google.com/?q=' + l.latitude + ',' + l.longitude" target="_blank" rel="noopener"><app-icon name="external" [size]="14" /> Open in Maps</a>
            </section>
            <section class="card card-body">
              <h3 class="section-title">Nearby transport</h3>
              <ul class="check-list">
                @for (t of l.transport; track t) {
                  <li><app-icon name="train" [size]="16" /> {{ t }}</li>
                }
              </ul>
            </section>
          </aside>
        </div>
      } @else {
        <div class="card"><app-empty-state icon="building" title="Location not found"><a class="btn btn-secondary" routerLink="/locations">See all locations</a></app-empty-state></div>
      }
    </div>
  `,
})
export class LocationPublicComponent {
  readonly id = input.required<string>();
  private readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  protected readonly plans = inject(PlanService);
  private readonly catalog = inject(CatalogService);
  protected readonly router = inject(Router);
  protected readonly loader = createLoader(() => this.locations.get(this.id()));
  protected readonly labels = SPACE_TYPE_LABELS;
  protected readonly loc = computed(() => this.locations.find(this.id()));
  protected readonly gallery = computed(() => {
    // Fill the 5-tile grid with shared amenity shots (pantry, phone booths, focus zone) rather than repeating a photo.
    const p = this.loc()?.photos ?? [];
    return [...p, ...[83, 87, 84].filter((s) => !p.includes(s))].slice(0, 5);
  });
  protected readonly offerings = computed(() => {
    const l = this.loc();
    return l ? l.spaceTypes.map((t) => this.catalog.offering(l, t)) : [];
  });
  protected stars(n: number): number[] {
    return Array.from({ length: Math.round(n) });
  }
}

@Component({
  selector: 'app-membership-public',
  imports: [...SHARED, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      <app-page-header title="Membership plans" [subtitle]="'All prices exclude ' + gstPct + '% GST. Credits, room hours and guest passes renew every cycle.'" [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Membership' }]" />
      <div class="grid grid-4" style="padding-top: 10px">
        @for (p of plans.published(); track p.id) {
          <app-plan-card [plan]="p" cta="Get started" (choose)="router.navigate(['/register'])" />
        }
      </div>
      <div class="cta-band mt-6">
        <div><h2>Not sure which plan fits?</h2><p class="mb-0 mt-2">Tell us about your team and we’ll recommend the right workspace.</p></div>
        <a class="btn btn-secondary btn-lg" routerLink="/request-callback">Request a callback</a>
      </div>
    </div>
  `,
})
export class MembershipPublicComponent {
  /** GST rate from Settings → Business rules (database). */
  protected readonly gstPct = inject(SettingsService).settings().gstRate;
  protected readonly plans = inject(PlanService);
  protected readonly router = inject(Router);
}

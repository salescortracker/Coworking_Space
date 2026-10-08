import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED, todayIso } from '../../../shared';
import { PlanCardComponent, WorkspaceCardComponent } from '../../../shared/components/domain/domain-cards.component';
import { SPACE_TYPE_LABELS, SpaceType } from '../../../core/models';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { EventService, HomepageContentService } from '../../../core/services/data/engagement-data.service';
import { PlanService } from '../../../core/services/data/membership-data.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-home',
  imports: [...SHARED, WorkspaceCardComponent, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="site-container hero-inner">
        <div>
          <span class="eyebrow" style="color: #aab4ff">Officera coworking</span>
          <h1 class="mt-2">{{ content.content().heroTitle }}</h1>
          <p class="lead">{{ content.content().heroSubtitle }}</p>
          <form class="hero-search" [formGroup]="search" (ngSubmit)="go()" aria-label="Find a workspace">
            <div class="field">
              <label class="label" for="hs-city">City</label>
              <select id="hs-city" class="select" formControlName="city">
                <option value="">Any city</option>
                @for (c of locations.cities(); track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="label" for="hs-type">Space type</label>
              <select id="hs-type" class="select" formControlName="type">
                <option value="">Any type</option>
                @for (t of types; track t) {
                  <option [value]="t">{{ labels[t] }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="label" for="hs-date">Date</label>
              <input id="hs-date" class="input" type="date" [min]="today" formControlName="date" />
            </div>
            <div class="field">
              <label class="label" for="hs-seats">Seats</label>
              <input id="hs-seats" class="input" type="number" min="1" max="50" formControlName="seats" />
            </div>
            <button type="submit" class="btn btn-primary btn-lg"><app-icon name="search" [size]="18" /> Search</button>
          </form>
          <div class="hero-stats">
            @for (s of content.content().stats; track s.label) {
              <div><strong>{{ s.value }}</strong><span>{{ s.label }}</span></div>
            }
          </div>
        </div>
        <app-workspace-image class="hero-art" [seed]="5" [priority]="true" sizes="(max-width: 1023px) 100vw, 600px" alt="Members working in a premium Officera coworking space" />
      </div>
    </section>

    <section class="public-section">
      <div class="site-container">
        <div class="section-head">
          <div><span class="eyebrow">Workspaces</span><h2>Space for every way you work</h2><p>From a single day at a hot desk to a private office for your whole team.</p></div>
        </div>
        <div class="grid grid-auto-sm">
          @for (t of typeCards; track t.type) {
            <a class="card interactive type-card" routerLink="/search" [queryParams]="{ type: t.type }">
              <span class="stat-icon tone-primary"><app-icon [name]="t.icon" [size]="20" /></span>
              <span class="fw-600 text-md">{{ labels[t.type] }}</span>
              <span class="text-sm text-muted">{{ t.desc }}</span>
              <span class="text-sm fw-600 text-primary mt-1">From {{ fromPrice(t.type) | inr }} / {{ t.unit }} →</span>
            </a>
          }
        </div>
      </div>
    </section>

    <section class="public-section alt">
      <div class="site-container">
        <div class="section-head">
          <div><span class="eyebrow">Locations</span><h2>Centres in {{ cityList() }}</h2></div>
          <a class="btn btn-secondary" routerLink="/locations">All locations <app-icon name="arrow-right" [size]="16" /></a>
        </div>
        <div class="grid grid-3">
          @for (o of featured(); track o.location.id) {
            <app-workspace-card [location]="o.location" [price]="o.price" [unit]="o.unit" [capacity]="o.capacity" [available]="o.available" />
          }
        </div>
      </div>
    </section>

    <section class="public-section">
      <div class="site-container">
        <div class="section-head"><div><span class="eyebrow">Why Officera</span><h2>Everything runs from one app</h2></div></div>
        <div class="grid grid-4">
          @for (f of content.content().features; track f.title) {
            <div class="feature">
              <span class="stat-icon tone-primary"><app-icon [name]="f.icon" [size]="20" /></span>
              <div><div class="fw-600">{{ f.title }}</div><p class="text-sm text-muted mb-0 mt-1">{{ f.description }}</p></div>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="public-section alt">
      <div class="site-container">
        <div class="section-head">
          <div><span class="eyebrow">Membership</span><h2>Simple, transparent plans</h2><p>Prices exclude {{ gstPct }}% GST. Upgrade, pause or cancel any time.</p></div>
          <a class="btn btn-secondary" routerLink="/membership">Compare plans</a>
        </div>
        <div class="grid grid-4" style="padding-top: 10px">
          @for (p of plans.published().slice(0, 4); track p.id) {
            <app-plan-card [plan]="p" cta="Get started" (choose)="router.navigate(['/register'])" />
          }
        </div>
      </div>
    </section>

    @if (content.content().testimonials.length) {
    <section class="public-section">
      <div class="site-container">
        <div class="section-head"><div><span class="eyebrow">Members say</span><h2>Trusted by companies across our centres</h2></div></div>
        <div class="grid grid-3">
          @for (t of content.content().testimonials; track t.name) {
            <figure class="card card-body" style="margin: 0">
              <blockquote class="quote" style="margin: 0">“{{ t.quote }}”</blockquote>
              <figcaption class="row-sm mt-4"><app-avatar [name]="t.name" [size]="36" /><span><span class="d-block fw-600">{{ t.name }}</span><span class="text-sm text-muted">{{ t.role }}</span></span></figcaption>
            </figure>
          }
        </div>
      </div>
    </section>
    }

    <section class="public-section alt">
      <div class="site-container">
        <div class="section-head">
          <div><span class="eyebrow">Events</span><h2>Meet the community</h2></div>
          <a class="btn btn-secondary" routerLink="/events">All events</a>
        </div>
        <div class="grid grid-3">
          @for (e of upcomingEvents(); track e.id) {
            <article class="card">
              <app-workspace-image [seed]="e.imageSeed" style="height: 130px" />
              <div class="card-body">
                <span class="tag">{{ e.category }}</span>
                <div class="fw-600 mt-2">{{ e.title }}</div>
                <div class="text-sm text-muted">{{ e.date | date: 'EEE, d MMM' }} · {{ e.startTime | time12 }} · {{ locations.shortName(e.locationId) }}</div>
              </div>
            </article>
          }
        </div>
      </div>
    </section>

    <section class="public-section">
      <div class="site-container">
        <div class="cta-band">
          <div><h2>See it for yourself</h2><p class="mb-0 mt-2">Book a free tour or ask us to call you back. No account needed.</p></div>
          <div class="btn-group">
            <a class="btn btn-secondary btn-lg" routerLink="/schedule-tour">Schedule a tour</a>
            <a class="btn btn-secondary btn-lg" routerLink="/request-callback">Request a callback</a>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class HomeComponent {
  protected readonly content = inject(HomepageContentService);
  protected readonly locations = inject(LocationService);
  protected readonly plans = inject(PlanService);
  private readonly events = inject(EventService);
  private readonly catalog = inject(CatalogService);
  protected readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly today = todayIso();
  protected readonly labels = SPACE_TYPE_LABELS;
  protected readonly types = Object.keys(SPACE_TYPE_LABELS) as SpaceType[];
  protected readonly typeCards: { type: SpaceType; icon: string; desc: string; unit: string }[] = [
    { type: 'HOT_DESK', icon: 'desk', desc: 'Any open desk in a shared zone, by the hour or month.', unit: 'hour' },
    { type: 'DEDICATED_DESK', icon: 'armchair', desc: 'Your own fixed desk with storage and 24x7 access.', unit: 'day' },
    { type: 'PRIVATE_OFFICE', icon: 'door', desc: 'Lockable cabins for teams of 4 to 10.', unit: 'day' },
    { type: 'MEETING_ROOM', icon: 'users', desc: 'Rooms with video conferencing for 4 to 12.', unit: 'hour' },
    { type: 'DAY_PASS', icon: 'ticket', desc: 'Drop in for a productive day at any centre.', unit: 'day' },
  ];
  protected readonly search = this.fb.nonNullable.group({ city: [''], type: [''], date: [todayIso()], seats: [1] });
  /** GST rate from Settings → Business rules (database). */
  protected readonly gstPct = inject(SettingsService).settings().gstRate;
  /** Cities with a centre, from the API (e.g. "Hyderabad, Bangalore and Chennai"). */
  protected readonly cityList = computed(() => {
    const cities = [...new Set(this.locations.active().map((l) => l.city))];
    return cities.length > 1 ? `${cities.slice(0, -1).join(', ')} and ${cities[cities.length - 1]}` : (cities[0] ?? 'your city');
  });
  protected readonly featured = computed(() => this.catalog.search({ sort: 'rating' }).slice(0, 3));
  protected readonly upcomingEvents = computed(() => this.events.items().filter((e) => e.isPublic && e.status === 'PUBLISHED' && e.date >= this.today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3));

  protected fromPrice(t: SpaceType): number {
    const prices = this.locations.active().map((l) => this.catalog.offering(l, t).price);
    return prices.length ? Math.min(...prices) : 0;
  }

  protected go(): void {
    const v = this.search.getRawValue();
    const qp: Record<string, string | number> = {};
    Object.entries(v).forEach(([k, val]) => {
      if (val !== '' && val !== null) qp[k] = val;
    });
    this.router.navigate(['/search'], { queryParams: qp });
  }
}

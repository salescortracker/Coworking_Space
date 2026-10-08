import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED, addDaysIso, todayIso } from '../../../shared';
import { FloorMapComponent } from '../../../shared/components/domain/floor-map.component';
import { BookingDraft, Resource, SPACE_TYPE_LABELS } from '../../../core/models';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { BookingEngineService, CLOSE_HOUR, LOCK_MINUTES } from '../../../core/services/booking-engine.service';
import { SettingsService } from '../../../core/services/settings.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { CheckoutService } from '../../../core/services/checkout.service';
import { ToastService } from '../../../core/services/ui.service';

type DeskType = 'HOT_DESK' | 'DEDICATED_DESK' | 'PRIVATE_OFFICE' | 'MEETING_ROOM';

/**
 * Booking wizard (UC-1 / flow 7):
 * Location → Type → Date → Time → Seats → Availability (floor map) → Summary → Checkout (lock 10 min) → Confirmation.
 */
@Component({
  selector: 'app-booking-wizard',
  imports: [...SHARED, FloorMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Book a workspace" subtitle="Real-time availability. Your slot is held for 10 minutes during checkout." [breadcrumbs]="[{ label: 'Bookings', link: '/member/bookings' }, { label: 'New booking' }]" />

      <nav class="card card-body mb-4" aria-label="Booking steps" style="padding: 12px 16px">
        <ol class="stepper list-plain" style="padding: 0; margin: 0">
          @for (s of steps; track s; let i = $index) {
            <li class="step" [class.active]="step() === i" [class.done]="step() > i">
              <button type="button" class="btn-link" style="display: inline-flex; align-items: center; gap: 8px; color: inherit; background: none; border: 0; padding: 0" [disabled]="i > maxReached() || i > 6" (click)="go(i)">
                <span class="num">
                  @if (step() > i) {
                    <app-icon name="check" [size]="12" />
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                {{ s }}
              </button>
            </li>
            @if (i < steps.length - 1) {
              <li class="step-sep" aria-hidden="true"></li>
            }
          }
        </ol>
      </nav>

      <div class="split">
        <section class="card">
          <div class="card-header">
            <div>
              <div class="eyebrow">Step {{ step() + 1 }} of 9</div>
              <h2 class="card-title mt-1">{{ titles[step()] }}</h2>
            </div>
          </div>
          <div class="card-body">
            @switch (step()) {
              @case (0) {
                <div class="choice-grid">
                  @for (l of locations.active(); track l.id) {
                    <button type="button" class="choice" [class.selected]="draft().locationId === l.id" (click)="patch({ locationId: l.id, resourceId: undefined }); next()">
                      <span class="choice-icon"><app-icon name="building" /></span>
                      <span class="min-0">
                        <span class="choice-title d-block">{{ l.name }}</span>
                        <span class="choice-desc d-block">{{ l.city }} · {{ l.openingHours.weekdays }}</span>
                      </span>
                    </button>
                  }
                </div>
              }
              @case (1) {
                <div class="choice-grid">
                  @for (t of types; track t.id) {
                    <button type="button" class="choice" [class.selected]="draft().type === t.id" [disabled]="!typeOffered(t.id)" (click)="patch({ type: t.id, resourceId: undefined, seats: t.id === 'MEETING_ROOM' ? 4 : 1 }); next()">
                      <span class="choice-icon"><app-icon [name]="t.icon" /></span>
                      <span>
                        <span class="choice-title d-block">{{ t.label }}</span>
                        <span class="choice-desc d-block">{{ t.desc }}</span>
                        <span class="text-xs fw-600 d-block mt-1">From {{ fromPrice(t.id) | inr }} / {{ t.unit }}</span>
                      </span>
                    </button>
                  }
                </div>
              }
              @case (2) {
                <app-date-strip [value]="draft().date" (pick)="patch({ date: $event, startTime: undefined, resourceId: undefined })" />
                <div class="field mt-4" style="max-width: 240px">
                  <label class="label" for="bdate">Or pick another date</label>
                  <input id="bdate" class="input" type="date" [min]="today" [max]="maxDate" [ngModel]="draft().date" (ngModelChange)="patch({ date: $event, startTime: undefined, resourceId: undefined })" />
                  @if (draft().date && draft().date! < today) {
                    <span class="field-error">Choose today or a future date.</span>
                  }
                </div>
              }
              @case (3) {
                <div class="field mb-4" style="max-width: 260px">
                  <label class="label" for="dur">Duration</label>
                  <select id="dur" class="select" [ngModel]="duration()" (ngModelChange)="duration.set(+$event); patch({ startTime: undefined, resourceId: undefined })">
                    @for (d of durations(); track d.value) {
                      <option [value]="d.value">{{ d.label }}</option>
                    }
                  </select>
                </div>
                <span class="label d-block mb-2">Start time</span>
                @if (anySlot()) {
                  <app-time-slots [slots]="slots()" [value]="draft().startTime" (pick)="patch({ startTime: $event, endTime: endFor($event), resourceId: undefined })" />
                  <p class="field-hint mt-2">Struck-out times are fully booked for this duration.</p>
                } @else {
                  <app-empty-state [compact]="true" icon="clock" title="No availability on this date" message="Every {{ typeLabel() }} is booked for the selected duration. Try a shorter duration or another date.">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="go(2)">Change date</button>
                  </app-empty-state>
                }
              }
              @case (4) {
                <div class="field" style="max-width: 260px">
                  <label class="label" for="seats">{{ draft().type === 'MEETING_ROOM' ? 'Number of attendees' : 'Number of seats' }}</label>
                  <div class="input-group">
                    <button type="button" class="addon" style="cursor: pointer" (click)="patch({ seats: Math.max(1, draft().seats - 1), resourceId: undefined })" aria-label="Decrease"><app-icon name="minus" [size]="14" /></button>
                    <input id="seats" class="input text-center" type="number" min="1" [max]="maxSeats()" [ngModel]="draft().seats" (ngModelChange)="patch({ seats: +$event, resourceId: undefined })" style="border-radius: 0" />
                    <button type="button" class="addon" style="cursor: pointer" (click)="patch({ seats: Math.min(maxSeats(), draft().seats + 1), resourceId: undefined })" aria-label="Increase"><app-icon name="plus" [size]="14" /></button>
                  </div>
                  @if (draft().seats < 1 || draft().seats > maxSeats()) {
                    <span class="field-error">Enter between 1 and {{ maxSeats() }}.</span>
                  }
                  <span class="field-hint">{{ draft().type === 'MEETING_ROOM' || draft().type === 'PRIVATE_OFFICE' ? 'We’ll only show rooms that fit everyone.' : 'Desks are priced per seat.' }}</span>
                </div>
              }
              @case (5) {
                <div class="row-between row-wrap mb-3">
                  <span class="text-sm text-muted">{{ locations.name(draft().locationId) }} · {{ draft().date | date: 'EEE d MMM' }} · {{ draft().startTime | time12 }}–{{ draft().endTime | time12 }}</span>
                  <app-status-badge [status]="availableCount() ? 'AVAILABLE' : 'BOOKED'" [label]="availableCount() + ' available'" />
                </div>
                @if (availableCount() === 0) {
                  <div class="alert alert-warning mb-4">
                    <app-icon name="alert" />
                    <div class="alert-body">Nothing is available for this slot. Choose another time or date.<div class="alert-actions"><button type="button" class="btn btn-secondary btn-sm" (click)="go(3)">Change time</button></div></div>
                  </div>
                }
                <app-floor-map
                  [resources]="mapResources()"
                  [bookedIds]="busyIds()"
                  [selectedId]="draft().resourceId"
                  [selectableTypes]="[draft().type!]"
                  (pick)="pickResource($event)"
                  label="Choose a desk or room"
                />
                <h3 class="section-title mt-5">Or choose from the list</h3>
                <ul class="list-plain">
                  @for (r of candidates(); track r.id) {
                    <li class="list-row">
                      <span class="min-0">
                        <span class="fw-500 d-block">{{ r.name }}</span>
                        <span class="text-xs text-muted">{{ r.code }} · {{ r.capacity }} seat{{ r.capacity > 1 ? 's' : '' }} · {{ r.price | inr }}/{{ r.priceUnit }}</span>
                      </span>
                      @if (busyIds().includes(r.id) || r.status !== 'ACTIVE' || r.blocked) {
                        <span class="badge badge-danger">Unavailable</span>
                      } @else {
                        <button type="button" class="btn btn-sm" [class.btn-primary]="draft().resourceId === r.id" [class.btn-secondary]="draft().resourceId !== r.id" (click)="pickResource(r)">
                          {{ draft().resourceId === r.id ? 'Selected' : 'Select' }}
                        </button>
                      }
                    </li>
                  }
                </ul>
              }
              @case (6) {
                @if (selected(); as r) {
                  <div class="row mb-4">
                    <app-workspace-image [seed]="r.photos[0] ?? 1" [alt]="r.name" sizes="240px" style="width: 120px; height: 80px; border-radius: 6px" />
                    <div>
                      <div class="fw-600 text-md">{{ r.name }}</div>
                      <div class="text-sm text-muted">{{ typeLabel() }} · {{ r.code }}</div>
                    </div>
                  </div>
                  <dl class="kv">
                    <dt>Location</dt><dd>{{ locations.name(r.locationId) }}</dd>
                    <dt>Resource</dt><dd>{{ r.name }}</dd>
                    <dt>Date</dt><dd>{{ draft().date | date: 'EEEE, d MMMM y' }}</dd>
                    <dt>Time</dt><dd>{{ draft().startTime | time12 }} – {{ draft().endTime | time12 }}</dd>
                    <dt>Duration</dt><dd>{{ quote()?.hours }} hour{{ quote()?.hours === 1 ? '' : 's' }}</dd>
                    <dt>{{ draft().type === 'MEETING_ROOM' ? 'Attendees' : 'Seats' }}</dt><dd>{{ draft().seats }}</dd>
                  </dl>
                  <hr />
                  <label class="switch">
                    <input type="checkbox" [checked]="useCredits()" (change)="useCredits.set(!useCredits())" [disabled]="!quote()?.creditsAvailable" />
                    <span class="track"></span>
                    <span>Use membership credits ({{ quote()?.creditsAvailable | inr }} available)</span>
                  </label>
                  <p class="text-sm text-muted mt-2 mb-0">Cancellation: {{ r.cancellationRule }}</p>
                }
              }
            }
          </div>
          <div class="card-footer">
            <button type="button" class="btn btn-secondary" (click)="back()" [disabled]="step() === 0"><app-icon name="arrow-left" [size]="16" /> Back</button>
            @if (step() < 6) {
              <button type="button" class="btn btn-primary" (click)="next()" [disabled]="!canNext()">Continue <app-icon name="arrow-right" [size]="16" /></button>
            } @else {
              <button type="button" class="btn btn-primary" (click)="toCheckout()" [disabled]="!selected() || holding()" [appBusy]="holding()" busyText="Processing…">
                <app-icon name="lock" [size]="16" /> {{ quote()?.balance ? 'Hold slot & checkout' : 'Hold slot & confirm' }}
              </button>
            }
          </div>
        </section>

        <aside class="sticky-side">
          <section class="card">
            <div class="card-header"><h2 class="card-title">Booking summary</h2></div>
            <div class="card-body">
              <dl class="kv stacked-kv">
                <dt>Location</dt><dd>{{ draft().locationId ? locations.name(draft().locationId) : '—' }}</dd>
                <dt>Workspace</dt><dd>{{ draft().type ? typeLabel() : '—' }}</dd>
                <dt>Date</dt><dd>{{ draft().date ? (draft().date | date: 'EEE, d MMM y') : '—' }}</dd>
                <dt>Time</dt><dd>{{ draft().startTime ? (draft().startTime | time12) + ' – ' + (draft().endTime | time12) : '—' }}</dd>
                <dt>Seats</dt><dd>{{ draft().seats }}</dd>
                <dt>Resource</dt><dd>{{ selected()?.name ?? '—' }}</dd>
              </dl>
              @if (quote(); as q) {
                <hr />
                <div class="summary-line"><span>{{ q.unitLabel }}{{ draft().seats > 1 && (draft().type === 'HOT_DESK' || draft().type === 'DEDICATED_DESK') ? ' × ' + draft().seats + ' seats' : '' }}</span><span class="tabular">{{ q.subtotal | inr }}</span></div>
                <div class="summary-line"><span>GST ({{ gstPct }}%)</span><span class="tabular">{{ q.tax | inr }}</span></div>
                <div class="summary-line"><span>Price</span><span class="tabular fw-600">{{ q.total | inr }}</span></div>
                <div class="summary-line"><span>Membership credits</span><span class="tabular neg">−{{ q.creditsApplied | inr }}</span></div>
                <div class="summary-line total"><span>Balance to pay</span><span class="tabular">{{ q.balance | inr }}</span></div>
                @if (q.balance === 0) {
                  <p class="text-sm text-success mt-2 mb-0"><app-icon name="check-circle" [size]="14" /> Fully covered by credits. ₹0 due.</p>
                }
              }
            </div>
          </section>
          <p class="text-xs text-muted mt-3">The slot is locked for {{ lockMinutes }} minutes once you continue to checkout. If payment fails or the lock expires, the slot is released.</p>
        </aside>
      </div>
    </div>
  `,
  styles: `.stacked-kv { grid-template-columns: 90px 1fr; font-size: var(--fs-sm); }`,
})
export class BookingWizardComponent implements OnInit {
  readonly qLocation = input<string>(undefined, { alias: 'location' });
  readonly qType = input<string>(undefined, { alias: 'type' });
  readonly qDate = input<string>(undefined, { alias: 'date' });

  protected readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  private readonly engine = inject(BookingEngineService);
  private readonly acct = inject(MemberAccountService);
  private readonly checkout = inject(CheckoutService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly Math = Math;
  protected readonly lockMinutes = inject(SettingsService).settings().slotLockMinutes || LOCK_MINUTES;
  protected readonly gstPct = inject(SettingsService).settings().gstRate;

  protected readonly steps = ['Location', 'Workspace', 'Date', 'Time', 'Seats', 'Availability', 'Summary', 'Checkout', 'Confirmation'];
  protected readonly titles = ['Select location', 'Select workspace type', 'Select date', 'Select time', 'How many people?', 'Check availability', 'Review your booking', 'Checkout', 'Confirmation'];
  protected readonly types: { id: DeskType; label: string; desc: string; icon: string; unit: string }[] = [
    { id: 'HOT_DESK', label: 'Hot Desk', desc: 'Any open desk in the shared zone', icon: 'desk', unit: 'hour' },
    { id: 'DEDICATED_DESK', label: 'Dedicated Desk', desc: 'A fixed desk with locker for the day', icon: 'armchair', unit: 'day' },
    { id: 'PRIVATE_OFFICE', label: 'Private Office', desc: 'Lockable cabin for your team', icon: 'door', unit: 'day' },
    { id: 'MEETING_ROOM', label: 'Meeting Room', desc: 'Rooms with AV for 4–12 people', icon: 'users', unit: 'hour' },
  ];
  protected readonly today = todayIso();
  protected readonly maxDate = addDaysIso(todayIso(), 60);

  protected readonly step = signal(0);
  protected readonly maxReached = signal(0);
  protected readonly draft = signal<BookingDraft>({ seats: 1, date: todayIso() });
  protected readonly duration = signal(2);
  protected readonly useCredits = signal(true);
  protected readonly holding = signal(false);

  ngOnInit(): void {
    const loc = this.qLocation() ?? this.acct.member()?.locationId;
    const t = this.qType() as DeskType | undefined;
    this.draft.update((d) => ({ ...d, locationId: loc, type: t && this.types.some((x) => x.id === t) ? t : undefined, date: this.qDate() ?? d.date }));
    if (this.qLocation()) this.step.set(this.draft().type ? 2 : 1);
    this.maxReached.set(this.step());
  }

  protected readonly typeLabel = computed(() => (this.draft().type ? SPACE_TYPE_LABELS[this.draft().type!] : ''));
  protected readonly durations = computed(() => {
    const t = this.draft().type;
    if (t === 'DEDICATED_DESK' || t === 'PRIVATE_OFFICE')
      return [
        { value: 4, label: 'Half day (4 hours)' },
        { value: 9, label: 'Full day (9 hours)' },
      ];
    return [1, 2, 3, 4, 6, 9].map((h) => ({ value: h, label: h === 9 ? 'Full day (9 hours)' : `${h} hour${h > 1 ? 's' : ''}` }));
  });
  protected readonly slots = computed(() => this.engine.slots(this.draft(), this.duration()));
  protected readonly anySlot = computed(() => this.slots().some((s) => s.available));
  protected readonly maxSeats = computed(() => {
    const t = this.draft().type;
    if (!t || !this.draft().locationId) return 12;
    const caps = this.resources.byLocation(this.draft().locationId!).filter((r) => r.type === t).map((r) => r.capacity);
    return t === 'HOT_DESK' || t === 'DEDICATED_DESK' ? Math.min(8, caps.length) : Math.max(1, ...caps);
  });
  protected readonly mapResources = computed(() => (this.draft().locationId ? this.resources.byLocation(this.draft().locationId!) : []));
  protected readonly candidates = computed(() => this.engine.candidates(this.draft()));
  protected readonly busyIds = computed(() => {
    const d = this.draft();
    if (!d.locationId || !d.date || !d.startTime || !d.endTime) return [];
    const busy = this.engine.busyResourceIds(d.locationId, d.date, d.startTime, d.endTime);
    // resources too small for the group show as occupied
    const tooSmall = this.mapResources().filter((r) => r.type === d.type && (d.type === 'MEETING_ROOM' || d.type === 'PRIVATE_OFFICE') && r.capacity < d.seats).map((r) => r.id);
    return [...busy, ...tooSmall];
  });
  protected readonly availableCount = computed(() => this.candidates().filter((r) => !this.busyIds().includes(r.id) && r.status === 'ACTIVE' && !r.blocked).length);
  protected readonly selected = computed(() => this.resources.find(this.draft().resourceId));
  protected readonly quote = computed(() => {
    const r = this.selected();
    const d = this.draft();
    if (!r || !d.startTime || !d.endTime) return null;
    return this.engine.quote(r, d.startTime, d.endTime, d.seats, this.acct.memberId(), this.useCredits());
  });

  protected typeOffered(t: DeskType): boolean {
    const loc = this.locations.find(this.draft().locationId);
    return !loc || loc.spaceTypes.includes(t);
  }

  protected fromPrice(t: DeskType): number {
    const list = this.resources.byLocation(this.draft().locationId ?? '').filter((r) => r.type === t);
    return list.length ? Math.min(...list.map((r) => r.price)) : 0;
  }

  protected endFor(start: string): string {
    const h = Math.min(CLOSE_HOUR, Number(start.slice(0, 2)) + this.duration());
    return `${String(h).padStart(2, '0')}:00`;
  }

  protected patch(p: Partial<BookingDraft>): void {
    this.draft.update((d) => ({ ...d, ...p }));
  }

  protected pickResource(r: Resource): void {
    if (r.type !== this.draft().type) return;
    if (this.busyIds().includes(r.id) || r.blocked || r.status !== 'ACTIVE') {
      this.toast.warning('Not available', `${r.name} is occupied for this slot.`);
      return;
    }
    this.patch({ resourceId: r.id });
  }

  protected canNext(): boolean {
    const d = this.draft();
    switch (this.step()) {
      case 0:
        return !!d.locationId;
      case 1:
        return !!d.type;
      case 2:
        return !!d.date && d.date >= this.today;
      case 3:
        return !!d.startTime;
      case 4:
        return d.seats >= 1 && d.seats <= this.maxSeats();
      case 5:
        return !!d.resourceId;
      default:
        return true;
    }
  }

  protected next(): void {
    if (!this.canNext()) return;
    const n = Math.min(6, this.step() + 1);
    this.step.set(n);
    this.maxReached.update((m) => Math.max(m, n));
  }

  protected back(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected go(i: number): void {
    if (i <= this.maxReached() && i <= 6) this.step.set(i);
  }

  /** Step 8: lock the slot for 10 minutes and hand over to checkout. */
  protected toCheckout(): void {
    if (this.holding()) return;
    const r = this.selected();
    const d = this.draft();
    const q = this.quote();
    const member = this.acct.member();
    if (!r || !q || !member || !d.date || !d.startTime || !d.endTime) return;
    const lock = this.engine.acquireLock(r.id, d.date, d.startTime, d.endTime);
    if (!lock) {
      this.toast.error('Slot just got booked', 'Someone else reserved this slot. Please choose another.');
      this.patch({ resourceId: undefined });
      this.step.set(5);
      return;
    }
    this.checkout.start({
      kind: 'BOOKING',
      memberId: member.id,
      locationId: r.locationId,
      title: `${r.name} · ${d.date} ${d.startTime}–${d.endTime}`,
      lines: [{ description: `${r.name} (${q.unitLabel}${d.seats > 1 && (r.type === 'HOT_DESK' || r.type === 'DEDICATED_DESK') ? ' × ' + d.seats + ' seats' : ''})`, sac: '997212', qty: 1, rate: q.subtotal, amount: q.subtotal }],
      securityDeposit: 0,
      promoScope: 'BOOKINGS',
      allowReferral: false,
      creditsApplied: q.creditsApplied,
      payload: { resourceId: r.id, date: d.date, start: d.startTime, end: d.endTime, seats: d.seats, quote: q },
      lockExpiresAt: lock.expiresAt,
      returnUrl: '/member/bookings',
    });
    this.toast.info('Slot held for 10 minutes', `${r.name} is reserved for you while you check out.`);
    this.holding.set(true);
    this.router.navigateByUrl('/member/checkout').finally(() => this.holding.set(false));
  }
}

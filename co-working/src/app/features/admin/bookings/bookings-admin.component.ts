import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, downloadCsv, todayIso, todayStamp } from '../../../shared';
import { CalendarComponent, CalendarEvent } from '../../../shared/components/domain/calendar.component';
import { Booking, SPACE_TYPE_LABELS, TimelineEntry } from '../../../core/models';
import { BookingService, PaymentService } from '../../../core/services/data/transaction-data.service';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { CompanyService, MemberService } from '../../../core/services/data/people-data.service';
import { BookingEngineService, CLOSE_HOUR, OPEN_HOUR } from '../../../core/services/booking-engine.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

const STATUSES = ['CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

@Component({
  selector: 'app-bookings-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="All Bookings" [subtitle]="'Bookings at ' + ctx.label() + '.'" [breadcrumbs]="[{ label: 'Bookings' }, { label: 'All Bookings' }]">
        <button type="button" class="btn btn-secondary" (click)="export()"><app-icon name="download" [size]="16" /> Export CSV</button>
        <a class="btn btn-secondary" routerLink="/admin/bookings/calendar"><app-icon name="calendar" [size]="16" /> Calendar</a>
        @if (auth.can('bookings.create')) {
          <button type="button" class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" /> New booking</button>
        }
      </app-page-header>
      <div class="stat-grid mb-5">
        @for (s of statusStats(); track s.status) {
          <button type="button" class="card stat-card interactive text-left" style="border: 1px solid var(--border); cursor: pointer" [class.selected]="status() === s.status" (click)="status.set(status() === s.status ? '' : s.status)">
            <span class="stat-label">{{ s.status | humanize }}</span>
            <span class="stat-value">{{ s.count }}</span>
          </button>
        }
      </div>
      <app-data-table
        [rows]="filtered()"
        [columns]="cols"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!status() || !!resource() || !!payment() || !!from() || !!to()"
        (clearFilters)="status.set(''); resource.set(''); payment.set(''); from.set(''); to.set('')"
        [defaultSort]="{ key: 'date', dir: 'desc' }"
        searchPlaceholder="Search booking, member or company"
        emptyTitle="No bookings found."
        emptyIcon="calendar"
        [rowClickable]="true"
        (rowClick)="router.navigate(['/admin/bookings', $event.id])"
        caption="All bookings"
      >
        <ng-container filters>
          <select class="select" aria-label="Resource" [ngModel]="resource()" (ngModelChange)="resource.set($event)">
            <option value="">All resources</option>
            @for (r of scopedResources(); track r.id) {
              <option [value]="r.id">{{ r.name }} · {{ locations.shortName(r.locationId) }}</option>
            }
          </select>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <select class="select" aria-label="Payment status" [ngModel]="payment()" (ngModelChange)="payment.set($event)">
            <option value="">All payments</option>
            @for (s of ['PAID', 'PENDING', 'FAILED', 'REFUNDED', 'NOT_REQUIRED']; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <input class="input" type="date" aria-label="From date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
          <input class="input" type="date" aria-label="To date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
        </ng-container>
        <ng-template appCell="actions" let-row>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/bookings', row.id]" aria-label="View"><app-icon name="eye" [size]="16" /></a>
          @if (auth.can('bookings.edit') && (row.status === 'CONFIRMED' || row.status === 'PENDING')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm text-danger" (click)="cancel(row)" aria-label="Cancel"><app-icon name="x-circle" [size]="16" /></button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [open]="newOpen()" title="New booking" subtitle="Book on behalf of a member. Credits are applied first; any balance is collected at the front desk." size="lg" (closed)="newOpen.set(false)">
      <form id="nb-form" [formGroup]="nb" (ngSubmit)="create()" class="form-grid" novalidate>
        <div class="field span-2">
          <label class="label" for="nbm">Member <span class="req">*</span></label>
          <select id="nbm" class="select" formControlName="memberId">
            <option value="">Select member</option>
            @for (m of activeMembers(); track m.id) {
              <option [value]="m.id">{{ m.firstName }} {{ m.lastName }} · {{ companies.name(m.companyId) }}</option>
            }
          </select>
          <app-field-error [control]="nb.controls.memberId" label="Member" />
        </div>
        <div class="field span-2">
          <label class="label" for="nbr">Resource <span class="req">*</span></label>
          <select id="nbr" class="select" formControlName="resourceId">
            <option value="">Select resource</option>
            @for (r of scopedResources(); track r.id) {
              <option [value]="r.id">{{ r.name }} ({{ typeLabels[r.type] }}) · {{ locations.shortName(r.locationId) }}</option>
            }
          </select>
          <app-field-error [control]="nb.controls.resourceId" label="Resource" />
        </div>
        <div class="field">
          <label class="label" for="nbd">Date <span class="req">*</span></label>
          <input id="nbd" class="input" type="date" [min]="today" formControlName="date" />
          <app-field-error [control]="nb.controls.date" label="Date" />
        </div>
        <div class="field">
          <label class="label" for="nbs">Seats / attendees <span class="req">*</span></label>
          <input id="nbs" class="input" type="number" min="1" formControlName="seats" />
        </div>
        <div class="field">
          <label class="label" for="nbst">Start time <span class="req">*</span></label>
          <input id="nbst" class="input" type="time" step="1800" formControlName="start" />
        </div>
        <div class="field">
          <label class="label" for="nbet">End time <span class="req">*</span></label>
          <input id="nbet" class="input" type="time" step="1800" formControlName="end" />
          @if (nb.errors?.['timeRange']) {
            <span class="field-error">End time must be after start time.</span>
          }
        </div>
        @if (newConflict()) {
          <div class="alert alert-danger span-all"><app-icon name="alert" /><div class="alert-body">This resource is not available for the selected time. Choose another slot.</div></div>
        } @else if (newQuote(); as q) {
          <div class="alert alert-info span-all"><app-icon name="info" /><div class="alert-body">Total {{ q.total | inr }} incl. GST · credits {{ q.creditsApplied | inr }} · balance {{ q.balance | inr }}</div></div>
        }
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="newOpen.set(false)">Cancel</button>
        <button type="submit" form="nb-form" class="btn btn-primary" [disabled]="nb.invalid || newConflict()">Create booking</button>
      </div>
    </app-modal>
  `,
})
export class BookingsAdminComponent {
  private readonly bookings = inject(BookingService);
  private readonly resources = inject(ResourceService);
  protected readonly locations = inject(LocationService);
  private readonly members = inject(MemberService);
  protected readonly companies = inject(CompanyService);
  private readonly engine = inject(BookingEngineService);
  protected readonly ctx = inject(LocationContextService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly loader = createLoader(() => this.bookings.listScoped());
  protected readonly statuses = STATUSES;
  protected readonly typeLabels = SPACE_TYPE_LABELS;
  protected readonly today = todayIso();
  protected readonly status = signal('');
  protected readonly resource = signal('');
  protected readonly payment = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly newOpen = signal(false);
  private readonly nbTick = signal(0);

  protected readonly scopedResources = computed(() => this.resources.scoped().filter((r) => r.status === 'ACTIVE'));
  protected readonly activeMembers = computed(() => this.members.scoped().filter((m) => m.status === 'ACTIVE'));
  protected readonly filtered = computed(() =>
    this.bookings
      .scoped()
      .filter(
        (b) =>
          (!this.status() || b.status === this.status()) &&
          (!this.resource() || b.resourceId === this.resource()) &&
          (!this.payment() || b.paymentStatus === this.payment()) &&
          (!this.from() || b.date >= this.from()) &&
          (!this.to() || b.date <= this.to()),
      ),
  );
  protected readonly statusStats = computed(() => STATUSES.map((s) => ({ status: s, count: this.bookings.scoped().filter((b) => b.status === s).length })));

  protected readonly cols: Column<Booking>[] = [
    { key: 'id', label: 'Booking ID', primary: true },
    { key: 'member', label: 'Member', value: (b) => this.members.fullName(b.memberId) },
    { key: 'company', label: 'Company', value: (b) => this.companies.find(b.companyId)?.name ?? '—', hideMobile: true },
    { key: 'location', label: 'Location', value: (b) => this.locations.shortName(b.locationId), hideMobile: true },
    { key: 'resource', label: 'Resource', value: (b) => this.resources.name(b.resourceId) },
    { key: 'date', label: 'Date', type: 'date', sortValue: (b) => b.date + b.startTime },
    { key: 'startTime', label: 'Start Time' },
    { key: 'endTime', label: 'End Time', hideMobile: true },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'paymentStatus', label: 'Payment Status', type: 'status', hideMobile: true },
  ];

  protected readonly nb = this.fb.nonNullable.group(
    {
      memberId: ['', Validators.required],
      resourceId: ['', Validators.required],
      date: [todayIso(), Validators.required],
      start: ['10:00', Validators.required],
      end: ['11:00', Validators.required],
      seats: [1, [Validators.required, Validators.min(1)]],
    },
    {
      validators: (g) => {
        const s = g.get('start')?.value;
        const e = g.get('end')?.value;
        return s && e && e <= s ? { timeRange: true } : null;
      },
    },
  );

  constructor() {
    this.nb.valueChanges.subscribe(() => this.nbTick.update((t) => t + 1));
  }

  protected readonly newConflict = computed(() => {
    this.nbTick();
    const v = this.nb.getRawValue();
    const r = this.resources.find(v.resourceId);
    if (!r || !v.date || !v.start || !v.end || v.end <= v.start) return false;
    return !this.engine.isAvailable(r, v.date, v.start, v.end);
  });
  protected readonly newQuote = computed(() => {
    this.nbTick();
    const v = this.nb.getRawValue();
    const r = this.resources.find(v.resourceId);
    if (!r || !v.start || !v.end || v.end <= v.start) return null;
    return this.engine.quote(r, v.start, v.end, v.seats, v.memberId || undefined);
  });

  protected openNew(): void {
    this.nb.reset({ memberId: '', resourceId: '', date: todayIso(), start: '10:00', end: '11:00', seats: 1 });
    this.newOpen.set(true);
  }

  protected create(): void {
    const q = this.newQuote();
    if (this.nb.invalid || !q || this.newConflict()) return this.nb.markAllAsTouched();
    const v = this.nb.getRawValue();
    const b = this.engine.confirm({ memberId: v.memberId, resourceId: v.resourceId, date: v.date, start: v.start, end: v.end, seats: v.seats, quote: q, method: q.balance ? undefined : 'CREDITS', notes: 'Booked by staff' });
    if (q.balance > 0) this.bookings.updateSync(b.id, { paymentStatus: 'PENDING' });
    this.audit.record('CREATE', 'Bookings', 'Booking', b.id, `Created booking for ${this.members.fullName(v.memberId)} – ${this.resources.name(v.resourceId)}`);
    this.newOpen.set(false);
    this.toast.success('Booking created', `${b.id} now appears in the list.`);
  }

  protected async cancel(b: Booking): Promise<void> {
    const reason = await this.confirm.prompt({ title: `Cancel ${b.id}?`, message: 'Credits are restored and any payment is refunded.', confirmText: 'Cancel booking', tone: 'danger', input: { label: 'Reason', required: true } });
    if (reason === null) return;
    this.engine.cancel(b.id, reason);
    this.audit.record('STATUS_CHANGE', 'Bookings', 'Booking', b.id, `Cancelled booking: ${reason}`);
    this.toast.success('Booking cancelled', b.id);
  }

  protected export(): void {
    downloadCsv(`bookings-${todayStamp()}`, this.filtered(), [
      { label: 'Booking ID', value: (b) => b.id },
      { label: 'Member', value: (b) => this.members.fullName(b.memberId) },
      { label: 'Company', value: (b) => this.companies.find(b.companyId)?.name ?? '' },
      { label: 'Location', value: (b) => this.locations.name(b.locationId) },
      { label: 'Resource', value: (b) => this.resources.name(b.resourceId) },
      { label: 'Date', value: (b) => b.date },
      { label: 'Start', value: (b) => b.startTime },
      { label: 'End', value: (b) => b.endTime },
      { label: 'Amount', value: (b) => b.amount },
      { label: 'Status', value: (b) => b.status },
      { label: 'Payment', value: (b) => b.paymentStatus },
    ]);
    this.toast.success('Export ready');
  }
}

@Component({
  selector: 'app-booking-admin-detail',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (booking(); as b) {
        <app-page-header [title]="'Booking ' + b.id" [subtitle]="resources.name(b.resourceId) + ' · ' + locations.name(b.locationId)" [breadcrumbs]="[{ label: 'Bookings', link: '/admin/bookings' }, { label: b.id }]">
          <app-status-badge badge [status]="b.status" />
          @if (auth.can('bookings.edit')) {
            @if (b.status === 'PENDING') {
              <button type="button" class="btn btn-success" (click)="confirmBooking()"><app-icon name="check" [size]="16" /> Confirm</button>
            }
            @if (b.paymentStatus === 'PENDING') {
              <button type="button" class="btn btn-secondary" (click)="markPaid()"><app-icon name="rupee" [size]="16" /> Mark paid at desk</button>
            }
            @if (b.status === 'CONFIRMED' && b.date <= today) {
              <button type="button" class="btn btn-secondary" (click)="complete()">Mark completed</button>
            }
            @if (b.status === 'CONFIRMED' || b.status === 'PENDING') {
              <button type="button" class="btn btn-danger" (click)="cancel()">Cancel booking</button>
            }
          }
        </app-page-header>
        <div class="split">
          <section class="card">
            <div class="card-header"><h2 class="card-title">Details</h2></div>
            <div class="card-body">
              <div class="kv-grid">
                <div class="kv-item"><div class="k">Member</div><div class="v"><a [routerLink]="['/admin/members', b.memberId]">{{ members.fullName(b.memberId) }}</a></div></div>
                <div class="kv-item"><div class="k">Company</div><div class="v">{{ companies.find(b.companyId)?.name ?? '—' }}</div></div>
                <div class="kv-item"><div class="k">Resource</div><div class="v"><a [routerLink]="['/admin/resources', b.resourceId]">{{ resources.name(b.resourceId) }}</a></div></div>
                <div class="kv-item"><div class="k">Date</div><div class="v">{{ b.date | date: 'EEE, d MMM y' }}</div></div>
                <div class="kv-item"><div class="k">Time</div><div class="v">{{ b.startTime | time12 }} – {{ b.endTime | time12 }}</div></div>
                <div class="kv-item"><div class="k">Seats</div><div class="v">{{ b.seats }}</div></div>
                <div class="kv-item"><div class="k">Amount</div><div class="v">{{ b.amount | inr }}</div></div>
                <div class="kv-item"><div class="k">Credits used</div><div class="v">{{ b.creditsUsed | inr }}</div></div>
                <div class="kv-item"><div class="k">Balance</div><div class="v">{{ b.balanceDue | inr }}</div></div>
                <div class="kv-item"><div class="k">Payment</div><div class="v"><app-status-badge [status]="b.paymentStatus" /></div></div>
                <div class="kv-item"><div class="k">Created</div><div class="v">{{ b.createdAt | date: 'd MMM y, h:mm a' }}</div></div>
                <div class="kv-item"><div class="k">Notes</div><div class="v">{{ b.notes ?? '—' }}</div></div>
              </div>
              @if (b.cancelReason) {
                <div class="alert alert-warning mt-4"><app-icon name="info" /><div class="alert-body">Cancelled {{ b.cancelledAt | date: 'd MMM, h:mm a' }}: {{ b.cancelReason }}</div></div>
              }
            </div>
          </section>
          <section class="card">
            <div class="card-header"><h2 class="card-title">Activity</h2></div>
            <div class="card-body"><app-timeline [items]="timeline()" /></div>
          </section>
        </div>
      } @else {
        <div class="card"><app-empty-state icon="calendar" title="Booking not found"><a class="btn btn-secondary" routerLink="/admin/bookings">Back to bookings</a></app-empty-state></div>
      }
    </div>
  `,
})
export class BookingAdminDetailComponent {
  readonly id = input.required<string>();
  private readonly bookings = inject(BookingService);
  private readonly payments = inject(PaymentService);
  protected readonly resources = inject(ResourceService);
  protected readonly locations = inject(LocationService);
  protected readonly members = inject(MemberService);
  protected readonly companies = inject(CompanyService);
  private readonly engine = inject(BookingEngineService);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly today = todayIso();
  protected readonly booking = computed(() => this.bookings.find(this.id()));
  protected readonly timeline = computed(() => {
    const b = this.booking();
    if (!b) return [];
    const t: TimelineEntry[] = [{ id: 't1', title: 'Booking created', description: `${this.members.fullName(b.memberId)} booked ${this.resources.name(b.resourceId)}`, at: b.createdAt, tone: 'info', icon: 'plus' }];
    if (b.creditsUsed) t.push({ id: 't2', title: 'Credits applied', description: `₹${b.creditsUsed.toLocaleString('en-IN')} deducted from membership credits`, at: b.createdAt, tone: 'primary', icon: 'wallet' });
    if (b.paymentId) {
      const p = this.payments.find(b.paymentId);
      if (p) t.push({ id: 't3', title: `Payment ${p.status.toLowerCase()}`, description: `${p.id} · ₹${p.amount.toLocaleString('en-IN')} via ${p.method}`, at: p.date, tone: p.status === 'SUCCESS' ? 'success' : 'danger', icon: 'credit-card' });
    }
    if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') t.push({ id: 't4', title: 'Confirmation sent', description: 'Email, push and SMS with calendar invite', at: b.createdAt, tone: 'success', icon: 'mail' });
    if (b.cancelledAt) t.push({ id: 't5', title: 'Cancelled', description: b.cancelReason, at: b.cancelledAt, tone: 'danger', icon: 'x' });
    return t.sort((a, z) => z.at.localeCompare(a.at));
  });

  protected confirmBooking(): void {
    const b = this.booking()!;
    this.bookings.updateSync(b.id, { status: 'CONFIRMED' });
    this.audit.record('STATUS_CHANGE', 'Bookings', 'Booking', b.id, 'Confirmed pending booking');
    this.toast.success('Booking confirmed');
  }

  protected markPaid(): void {
    const b = this.booking()!;
    this.bookings.updateSync(b.id, { paymentStatus: 'PAID', status: b.status === 'PENDING' ? 'CONFIRMED' : b.status });
    if (b.paymentId) this.payments.updateSync(b.paymentId, { status: 'SUCCESS' });
    this.audit.record('UPDATE', 'Bookings', 'Booking', b.id, 'Payment collected at front desk');
    this.toast.success('Payment recorded');
  }

  protected complete(): void {
    const b = this.booking()!;
    this.bookings.updateSync(b.id, { status: 'COMPLETED' });
    this.toast.success('Booking completed');
  }

  protected async cancel(): Promise<void> {
    const b = this.booking()!;
    const reason = await this.confirm.prompt({ title: `Cancel ${b.id}?`, message: 'Credits are restored and any payment is refunded.', confirmText: 'Cancel booking', tone: 'danger', input: { label: 'Reason', required: true } });
    if (reason === null) return;
    this.engine.cancel(b.id, reason);
    this.audit.record('STATUS_CHANGE', 'Bookings', 'Booking', b.id, `Cancelled: ${reason}`);
    this.toast.success('Booking cancelled');
  }
}

@Component({
  selector: 'app-booking-calendar',
  imports: [...SHARED, CalendarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Booking Calendar" subtitle="Day, week and month view of bookings." [breadcrumbs]="[{ label: 'Bookings', link: '/admin/bookings' }, { label: 'Calendar' }]" />
      <section class="card">
        <div class="toolbar">
          <select class="select" aria-label="Location" [ngModel]="loc()" (ngModelChange)="loc.set($event); res.set('')">
            <option value="">All locations in scope</option>
            @for (l of locations.scoped(); track l.id) {
              <option [value]="l.id">{{ l.name }}</option>
            }
          </select>
          <select class="select" aria-label="Resource" [ngModel]="res()" (ngModelChange)="res.set($event)">
            <option value="">All resources</option>
            @for (r of resourceOptions(); track r.id) {
              <option [value]="r.id">{{ r.name }}</option>
            }
          </select>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <span class="spacer"></span>
          <span class="text-sm text-muted">{{ events().length }} bookings</span>
        </div>
        <div class="card-body">
          @if (loader.status() === 'loading') {
            <app-loading-state variant="detail" />
          } @else if (loader.status() === 'error') {
            <app-error-state (retry)="loader.load()" />
          } @else {
            <app-calendar [events]="events()" [view]="'week'" (eventClick)="router.navigate(['/admin/bookings', $event.id])" />
          }
        </div>
      </section>
    </div>
  `,
})
export class BookingCalendarComponent {
  private readonly bookings = inject(BookingService);
  private readonly resources = inject(ResourceService);
  protected readonly locations = inject(LocationService);
  private readonly members = inject(MemberService);
  protected readonly router = inject(Router);
  protected readonly loader = createLoader(() => this.bookings.listScoped());
  protected readonly statuses = STATUSES;
  protected readonly loc = signal('');
  protected readonly res = signal('');
  protected readonly status = signal('');
  protected readonly resourceOptions = computed(() => this.resources.scoped().filter((r) => !this.loc() || r.locationId === this.loc()));
  protected readonly events = computed<CalendarEvent[]>(() =>
    this.bookings
      .scoped()
      .filter((b) => (!this.loc() || b.locationId === this.loc()) && (!this.res() || b.resourceId === this.res()) && (!this.status() || b.status === this.status()))
      .map((b) => ({ id: b.id, date: b.date, start: b.startTime, end: b.endTime, title: this.resources.name(b.resourceId), subtitle: this.members.fullName(b.memberId), status: b.status })),
  );
}

@Component({
  selector: 'app-availability',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Availability" subtitle="Real-time availability by resource and hour." [breadcrumbs]="[{ label: 'Bookings', link: '/admin/bookings' }, { label: 'Availability' }]" />
      <section class="card">
        <div class="toolbar">
          <select class="select" aria-label="Location" [ngModel]="loc()" (ngModelChange)="loc.set($event)">
            @for (l of locations.scoped(); track l.id) {
              <option [value]="l.id">{{ l.name }}</option>
            }
          </select>
          <input class="input" type="date" aria-label="Date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
          <select class="select" aria-label="Type" [ngModel]="type()" (ngModelChange)="type.set($event)">
            <option value="">All types</option>
            @for (t of types; track t) {
              <option [value]="t">{{ typeLabels[t] }}</option>
            }
          </select>
          <span class="spacer"></span>
          <span class="text-sm text-muted">Occupancy {{ occupancy() }}%</span>
        </div>
        <div class="card-body" style="overflow-x: auto">
          <div class="avail-grid" [style.grid-template-columns]="'180px repeat(' + hours.length + ', minmax(34px, 1fr))'">
            <span></span>
            @for (h of hours; track h) {
              <span class="avail-hour">{{ h }}</span>
            }
            @for (row of grid(); track row.id) {
              <span class="avail-label" [attr.title]="row.name">{{ row.name }}</span>
              @for (c of row.cells; track $index) {
                <span class="avail-cell" [class.busy]="c === 'busy'" [class.closed]="c === 'closed'" [attr.title]="row.name + ' ' + hours[$index] + ':00 ' + c"></span>
              }
            }
          </div>
          <div class="fm-legend mt-4">
            <span><span class="fm-swatch" style="background: var(--success-50); border-color: var(--success-100)"></span>Available</span>
            <span><span class="fm-swatch" style="background: var(--avail-busy-bg); border-color: var(--avail-busy-border)"></span>Booked</span>
            <span><span class="fm-swatch" style="background: var(--surface-sunken); border-color: var(--border)"></span>Unavailable</span>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class AvailabilityComponent {
  protected readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  private readonly engine = inject(BookingEngineService);
  private readonly ctx = inject(LocationContextService);
  protected readonly typeLabels = SPACE_TYPE_LABELS;
  protected readonly types = ['HOT_DESK', 'DEDICATED_DESK', 'PRIVATE_OFFICE', 'MEETING_ROOM'] as const;
  protected readonly hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
  protected readonly loc = signal(this.ctx.singleLocationId() ?? this.locations.scoped()[0]?.id ?? '');
  protected readonly date = signal(todayIso());
  protected readonly type = signal('');
  protected readonly grid = computed(() => {
    const rs = this.resources.byLocation(this.loc()).filter((r) => !this.type() || r.type === this.type());
    const busyByHour = this.hours.map((h) => new Set(this.engine.busyResourceIds(this.loc(), this.date(), `${String(h).padStart(2, '0')}:00`, `${String(h + 1).padStart(2, '0')}:00`)));
    return rs.map((r) => ({
      id: r.id,
      name: r.name,
      cells: this.hours.map((_, i) => (r.status !== 'ACTIVE' || r.blocked ? 'closed' : busyByHour[i].has(r.id) ? 'busy' : 'free')),
    }));
  });
  protected readonly occupancy = computed(() => {
    const cells = this.grid().flatMap((r) => r.cells).filter((c) => c !== 'closed');
    return cells.length ? Math.round((cells.filter((c) => c === 'busy').length / cells.length) * 100) : 0;
  });
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, todayIso } from '../../../shared';
import { Booking, Visitor } from '../../../core/models';
import { VisitorService } from '../../../core/services/data/operations-data.service';
import { BookingService } from '../../../core/services/data/transaction-data.service';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { OperationsService, ScanResult } from '../../../core/services/operations.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { GlobalSearchService, SearchGroup } from '../../../core/services/search.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

/** Front desk dashboard (§27) with the visitor check-in flow (§13 / flow 10). */
@Component({
  selector: 'app-front-desk',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Front Desk" [subtitle]="'Today at ' + ctx.label() + ' · ' + (today | date: 'EEEE, d MMMM')" [breadcrumbs]="[{ label: 'Front Desk' }]">
        <button type="button" class="btn btn-secondary" (click)="searchOpen.set(true)"><app-icon name="search" [size]="16" /> Search member / booking</button>
        <button type="button" class="btn btn-primary" (click)="openCheckIn()"><app-icon name="scan" [size]="16" /> Visitor check-in</button>
      </app-page-header>

      <div class="stat-grid mb-5">
        <app-stat-card label="Today's bookings" [value]="todayBookings().length" icon="calendar" />
        <app-stat-card label="Today's visitors" [value]="todayVisitors().length" icon="users" tone="info" />
        <app-stat-card label="Expected" [value]="byStatus('EXPECTED').length" icon="clock" tone="warning" />
        <app-stat-card label="Checked in" [value]="byStatus('CHECKED_IN').length" icon="log-in" tone="success" />
        <app-stat-card label="Checked out" [value]="byStatus('CHECKED_OUT').length" icon="logout" tone="neutral" />
      </div>

      <section class="card mb-5">
        <div class="card-header"><h2 class="card-title">Quick actions</h2></div>
        <div class="card-body btn-group">
          <button type="button" class="btn btn-secondary" (click)="openCheckIn()"><app-icon name="log-in" [size]="16" /> Visitor Check-in</button>
          <button type="button" class="btn btn-secondary" (click)="tab.set('inside')"><app-icon name="logout" [size]="16" /> Visitor Check-out</button>
          <button type="button" class="btn btn-secondary" (click)="searchOpen.set(true)"><app-icon name="user" [size]="16" /> Search Member</button>
          <button type="button" class="btn btn-secondary" (click)="searchOpen.set(true)"><app-icon name="calendar" [size]="16" /> Search Booking</button>
          <a class="btn btn-secondary" routerLink="/admin/access"><app-icon name="shield" [size]="16" /> Member verification</a>
          <a class="btn btn-secondary" routerLink="/admin/support"><app-icon name="support" [size]="16" /> Support</a>
        </div>
      </section>

      <app-tabs [tabs]="tabs()" [(value)]="tab" label="Front desk lists" />
      <div class="mt-4">
        @switch (tab()) {
          @case ('bookings') {
            <app-data-table [rows]="todayBookings()" [columns]="bookingCols" [status]="loader.status()" (retry)="loader.load()" [defaultSort]="{ key: 'startTime', dir: 'asc' }" emptyTitle="No bookings found." emptyMessage="No bookings today at this location." [rowClickable]="true" (rowClick)="router.navigate(['/admin/bookings', $event.id])" caption="Today's bookings" />
          }
          @default {
            <app-data-table [rows]="visitorRows()" [columns]="visitorCols" [status]="loader.status()" (retry)="loader.load()" [defaultSort]="{ key: 'visitTime', dir: 'asc' }" emptyTitle="No visitors found." emptyIcon="user-plus" caption="Visitors">
              <ng-template appCell="actions" let-row>
                @if (row.status === 'EXPECTED') {
                  <button type="button" class="btn btn-primary btn-sm" (click)="openCheckIn(row)">Check in</button>
                } @else if (row.status === 'CHECKED_IN') {
                  <button type="button" class="btn btn-secondary btn-sm" (click)="checkOut(row)">Check out</button>
                }
              </ng-template>
            </app-data-table>
          }
        }
      </div>
    </div>

    <!-- Visitor check-in wizard: scan → verify → photo → notify host → check-in -->
    <app-modal [open]="ciOpen()" title="Visitor check-in" [subtitle]="'Step ' + (ciStep() + 1) + ' of 4'" size="md" (closed)="ciOpen.set(false)">
      <div class="stepper mb-4">
        @for (s of ciSteps; track s; let i = $index) {
          <span class="step" [class.active]="ciStep() === i" [class.done]="ciStep() > i"><span class="num">{{ i + 1 }}</span>{{ s }}</span>
          @if (i < ciSteps.length - 1) {
            <span class="step-sep"></span>
          }
        }
      </div>
      @switch (ciStep()) {
        @case (0) {
          <p class="text-muted">Scan the visitor’s QR pass or enter the pass code.</p>
          <div class="scan-box"><app-icon name="scan" [size]="48" /><span class="text-sm text-muted">Camera preview (mock)</span></div>
          <div class="row-sm mt-4">
            <label class="sr-only" for="pc">Pass code</label>
            <input id="pc" class="input mono" [ngModel]="code()" (ngModelChange)="code.set($event)" placeholder="OFV-XXXXXX" style="text-transform: uppercase" />
            <button type="button" class="btn btn-primary" [disabled]="!code().trim()" (click)="verify()">Verify</button>
          </div>
          @if (expectedToday().length) {
            <div class="field-hint mt-2">Demo: tap an expected pass to scan it.</div>
            <div class="tag-list mt-2">
              @for (v of expectedToday().slice(0, 4); track v.id) {
                <button type="button" class="tag" style="border: 0; cursor: pointer" (click)="code.set(v.passCode); verify()">{{ v.passCode }} · {{ v.name }}</button>
              }
            </div>
          }
          @if (scan() && !scan()!.valid) {
            <div class="alert alert-danger mt-4"><app-icon name="x-circle" /><div class="alert-body"><div class="alert-title">Verification failed</div>{{ scan()!.reason }}</div></div>
          }
        }
        @case (1) {
          @if (current(); as v) {
            <div class="alert alert-success mb-4"><app-icon name="check-circle" /><div class="alert-body">Pass verified.</div></div>
            <dl class="kv">
              <dt>Visitor</dt><dd>{{ v.name }}</dd>
              <dt>Company</dt><dd>{{ v.company ?? '—' }}</dd>
              <dt>Host</dt><dd>{{ members.fullName(v.hostMemberId) }}</dd>
              <dt>Purpose</dt><dd>{{ v.purpose }}</dd>
              <dt>Expected</dt><dd>{{ v.visitTime | time12 }}</dd>
              <dt>ID check</dt><dd><label class="check"><input type="checkbox" [checked]="idChecked()" (change)="idChecked.set(!idChecked())" /> Government ID verified</label></dd>
            </dl>
          }
        }
        @case (2) {
          <div class="scan-box" [class.captured]="photo()">
            @if (photo()) {
              <app-avatar [name]="current()?.name ?? 'V'" [size]="96" />
              <span class="text-sm text-success fw-500">Photo captured</span>
            } @else {
              <app-icon name="camera" [size]="48" />
              <span class="text-sm text-muted">Webcam preview (mock)</span>
            }
          </div>
          <div class="row-sm mt-4" style="justify-content: center">
            <button type="button" class="btn btn-secondary" (click)="photo.set(!photo())"><app-icon name="camera" [size]="16" /> {{ photo() ? 'Retake' : 'Capture photo' }}</button>
          </div>
        }
        @case (3) {
          <app-success-state title="Ready to check in" [message]="'We will notify ' + members.fullName(current()?.hostMemberId) + ' by push and SMS that ' + current()?.name + ' has arrived.'" />
        }
      }
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="ciStep() === 0 ? ciOpen.set(false) : ciStep.set(ciStep() - 1)">{{ ciStep() === 0 ? 'Cancel' : 'Back' }}</button>
        @if (ciStep() === 1) {
          <button type="button" class="btn btn-primary" [disabled]="!idChecked()" (click)="ciStep.set(2)">Continue</button>
        } @else if (ciStep() === 2) {
          <button type="button" class="btn btn-primary" [disabled]="!photo()" (click)="ciStep.set(3)">Continue</button>
        } @else if (ciStep() === 3) {
          <button type="button" class="btn btn-success" (click)="completeCheckIn()"><app-icon name="check" [size]="16" /> Notify host & check in</button>
        }
      </div>
    </app-modal>

    <app-modal [open]="searchOpen()" title="Search member or booking" (closed)="searchOpen.set(false)">
      <div class="input-icon">
        <app-icon name="search" [size]="16" />
        <input class="input" [ngModel]="term()" (ngModelChange)="onTerm($event)" placeholder="Name, mobile, member ID or booking ID" aria-label="Search" />
      </div>
      <div class="mt-4">
        @for (g of results(); track g.category) {
          <div class="menu-label">{{ g.category }}</div>
          @for (h of g.hits; track h.id) {
            <a class="menu-item" [routerLink]="h.link" (click)="searchOpen.set(false)"><app-icon [name]="h.icon" [size]="16" /><span class="min-0"><span class="d-block fw-500 truncate">{{ h.title }}</span><span class="d-block text-xs text-muted truncate">{{ h.subtitle }}</span></span></a>
          }
        } @empty {
          @if (term().length > 1) {
            <p class="text-muted text-sm">No matches.</p>
          }
        }
      </div>
    </app-modal>
  `,
  styles: `.scan-box { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 200px; border: 2px dashed var(--border-strong); border-radius: 8px; background: var(--surface-alt); color: var(--text-muted); } .scan-box.captured { border-style: solid; border-color: var(--success); background: var(--success-50); }`,
})
export class FrontDeskComponent {
  private readonly visitors = inject(VisitorService);
  private readonly bookings = inject(BookingService);
  private readonly resources = inject(ResourceService);
  private readonly locations = inject(LocationService);
  protected readonly members = inject(MemberService);
  private readonly ops = inject(OperationsService);
  private readonly search = inject(GlobalSearchService);
  protected readonly ctx = inject(LocationContextService);
  protected readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly loader = createLoader(() => this.visitors.listScoped());
  protected readonly today = todayIso();
  protected readonly tab = signal('expected');
  protected readonly ciSteps = ['Scan QR', 'Verify', 'Photo', 'Notify & check in'];
  protected readonly ciOpen = signal(false);
  protected readonly ciStep = signal(0);
  protected readonly code = signal('');
  protected readonly scan = signal<ScanResult | null>(null);
  protected readonly current = signal<Visitor | null>(null);
  protected readonly idChecked = signal(false);
  protected readonly photo = signal(false);
  protected readonly searchOpen = signal(false);
  protected readonly term = signal('');
  protected readonly results = signal<SearchGroup[]>([]);

  constructor() {
    this.ops.expirePasses();
  }

  protected readonly todayVisitors = computed(() => this.visitors.scoped().filter((v) => v.visitDate === this.today));
  protected readonly expectedToday = computed(() => this.byStatus('EXPECTED'));
  protected readonly todayBookings = computed(() => this.bookings.scoped().filter((b) => b.date === this.today && b.status !== 'CANCELLED'));
  protected byStatus(s: Visitor['status']): Visitor[] {
    return this.todayVisitors().filter((v) => v.status === s);
  }
  protected readonly visitorRows = computed(() => {
    switch (this.tab()) {
      case 'expected':
        return this.byStatus('EXPECTED');
      case 'inside':
        return this.byStatus('CHECKED_IN');
      case 'out':
        return this.byStatus('CHECKED_OUT');
      default:
        return this.todayVisitors();
    }
  });
  protected readonly tabs = computed(() => [
    { id: 'expected', label: 'Expected visitors', count: this.byStatus('EXPECTED').length },
    { id: 'inside', label: 'Checked in', count: this.byStatus('CHECKED_IN').length },
    { id: 'out', label: 'Checked out', count: this.byStatus('CHECKED_OUT').length },
    { id: 'bookings', label: "Today's bookings", count: this.todayBookings().length },
  ]);
  protected readonly visitorCols: Column<Visitor>[] = [
    { key: 'name', label: 'Visitor', primary: true },
    { key: 'host', label: 'Host', value: (v) => this.members.fullName(v.hostMemberId) },
    { key: 'visitTime', label: 'Time' },
    { key: 'purpose', label: 'Purpose', hideMobile: true },
    { key: 'passCode', label: 'Pass', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly bookingCols: Column<Booking>[] = [
    { key: 'id', label: 'Booking', primary: true },
    { key: 'member', label: 'Member', value: (b) => this.members.fullName(b.memberId) },
    { key: 'resource', label: 'Resource', value: (b) => this.resources.name(b.resourceId) },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    { key: 'location', label: 'Location', value: (b) => this.locations.shortName(b.locationId), hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected openCheckIn(v?: Visitor): void {
    this.ciStep.set(0);
    this.scan.set(null);
    this.current.set(null);
    this.idChecked.set(false);
    this.photo.set(false);
    this.code.set(v?.passCode ?? '');
    this.ciOpen.set(true);
    if (v) this.verify();
  }

  protected verify(): void {
    const v0 = this.visitors.items().find((x) => x.passCode.toUpperCase() === this.code().trim().toUpperCase());
    const res = this.ops.scan(this.code(), v0?.locationId ?? this.ctx.singleLocationId() ?? '', 'Reception');
    this.scan.set(res);
    if (res.valid && res.visitor) {
      this.current.set(res.visitor);
      this.ciStep.set(1);
    }
  }

  protected completeCheckIn(): void {
    const v = this.current();
    if (!v) return;
    this.ops.checkIn(v.id, this.photo());
    this.audit.record('CREATE', 'Visitors', 'Visitor', v.id, `Checked in visitor ${v.name}`);
    this.ciOpen.set(false);
    this.toast.success('Visitor checked in', `${this.members.fullName(v.hostMemberId)} has been notified.`);
  }

  protected async checkOut(v: Visitor): Promise<void> {
    const ok = await this.confirm.confirm({ title: `Check out ${v.name}?`, message: 'The visitor pass will expire immediately.', confirmText: 'Check out' });
    if (!ok) return;
    this.ops.checkOut(v.id);
    this.audit.record('UPDATE', 'Visitors', 'Visitor', v.id, `Checked out visitor ${v.name}`);
    this.toast.success('Visitor checked out', 'Pass expired.');
  }

  protected onTerm(v: string): void {
    this.term.set(v);
    this.results.set(this.search.searchSync(v, 6).filter((g) => g.category === 'Members' || g.category === 'Bookings'));
  }
}

@Component({
  selector: 'app-visitors-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Visitors" subtitle="All visitor passes across your locations." [breadcrumbs]="[{ label: 'Members' }, { label: 'Visitors' }]">
        <a class="btn btn-primary" routerLink="/admin/front-desk"><app-icon name="scan" [size]="16" /> Open front desk</a>
      </app-page-header>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!status() || !!date()" (clearFilters)="status.set(''); date.set('')" [defaultSort]="{ key: 'visitDate', dir: 'desc' }" searchPlaceholder="Search visitor, host or pass" emptyTitle="No visitors found." emptyIcon="user-plus" caption="Visitors">
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of ['EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED']; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <input class="input" type="date" aria-label="Date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
        </ng-container>
        <ng-template appCell="actions" let-row>
          @if (row.status === 'CHECKED_IN') {
            <button type="button" class="btn btn-secondary btn-sm" (click)="checkOut(row)">Check out</button>
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class VisitorsAdminComponent {
  private readonly visitors = inject(VisitorService);
  private readonly members = inject(MemberService);
  private readonly locations = inject(LocationService);
  private readonly ops = inject(OperationsService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.visitors.listScoped());
  protected readonly status = signal('');
  protected readonly date = signal('');
  protected readonly filtered = computed(() => this.visitors.scoped().filter((v) => (!this.status() || v.status === this.status()) && (!this.date() || v.visitDate === this.date())));
  protected readonly cols: Column<Visitor>[] = [
    { key: 'name', label: 'Visitor', primary: true },
    { key: 'host', label: 'Host', value: (v) => this.members.fullName(v.hostMemberId) },
    { key: 'location', label: 'Location', value: (v) => this.locations.shortName(v.locationId), hideMobile: true },
    { key: 'visitDate', label: 'Date', type: 'date' },
    { key: 'visitTime', label: 'Time' },
    { key: 'purpose', label: 'Purpose', hideMobile: true },
    { key: 'checkInAt', label: 'Checked in', type: 'datetime', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected checkOut(v: Visitor): void {
    this.ops.checkOut(v.id);
    this.toast.success('Visitor checked out');
  }
}

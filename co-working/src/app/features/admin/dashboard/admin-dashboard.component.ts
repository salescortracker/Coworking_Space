import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, todayIso } from '../../../shared';
import { FrontDeskComponent } from '../operations/front-desk.component';
import { Booking, LEAD_STATUS_LABELS, Lead, PAYMENT_TYPE_LABELS, Payment, Ticket } from '../../../core/models';
import { ReportService, DateRange } from '../../../core/services/report.service';
import { BookingService, InvoiceService, PaymentService, RefundService } from '../../../core/services/data/transaction-data.service';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { LeadService } from '../../../core/services/data/engagement-data.service';
import { TicketService, VisitorService } from '../../../core/services/data/operations-data.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { AuthService } from '../../../core/services/auth.service';

/** Super Admin dashboard (§18). */
@Component({
  selector: 'app-super-dashboard',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header [title]="'Welcome back, ' + firstName()" [subtitle]="'Operations overview · ' + ctx.label()">
        <label class="sr-only" for="dr">Date range</label>
        <select id="dr" class="select" style="width: auto" [ngModel]="rangeDays()" (ngModelChange)="rangeDays.set(+$event)">
          <option [value]="6">Last 7 days</option>
          <option [value]="29">Last 30 days</option>
          <option [value]="89">Last 90 days</option>
        </select>
        <a class="btn btn-secondary" routerLink="/admin/reports"><app-icon name="chart" [size]="16" /> Reports</a>
      </app-page-header>
      @if (loader.status() === 'loading') {
        <app-loading-state variant="stats" [rows]="8" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else {
        <div class="stat-grid">
          <app-stat-card label="Total Locations" [value]="locations.scoped().length" icon="building" link="/admin/locations" />
          <app-stat-card label="Total Members" [value]="members.scoped().length" icon="users" tone="info" link="/admin/members" />
          <app-stat-card label="Active Members" [value]="activeMembers()" icon="user-check" tone="success" [trend]="reports.activeMembersTrend()" />
          <app-stat-card label="Today's Bookings" [value]="todays().length" icon="calendar" tone="primary" link="/admin/bookings" />
          <app-stat-card label="Occupancy %" [value]="reports.occupancyNow() + '%'" icon="layers" tone="warning" link="/admin/reports/occupancy" />
          <app-stat-card label="Monthly Revenue" [value]="reports.monthRevenue() | compactInr" icon="trending-up" tone="success" [trend]="reports.revenueTrend()" link="/admin/reports/revenue" />
          <app-stat-card label="Outstanding Dues" [value]="reports.outstanding() | compactInr" icon="alert" tone="danger" link="/admin/finance/dues" />
          <app-stat-card label="New Leads" [value]="newLeads()" icon="target" tone="info" link="/admin/leads" />
        </div>
        <div class="grid grid-2 mt-5">
          <app-chart-card title="Occupancy trend" [subtitle]="'Average busy share of desks and rooms · ' + ctx.label()">
            <app-line-chart [labels]="occ().labels" [series]="[{ name: 'Occupancy', data: occ().values }]" suffix="%" [maxValue]="100" ariaLabel="Occupancy trend" />
          </app-chart-card>
          <app-chart-card title="Revenue trend" subtitle="Successful collections by month">
            <app-bar-chart [labels]="rev().labels" [series]="[{ name: 'Revenue', data: rev().values }]" prefix="₹" ariaLabel="Revenue trend" />
          </app-chart-card>
          <app-chart-card title="Bookings by workspace type">
            <app-bar-chart [labels]="byType().labels" [series]="[{ name: 'Bookings', data: byType().values, color: 'var(--chart-2)' }]" ariaLabel="Bookings by workspace type" />
          </app-chart-card>
          <app-chart-card title="Membership distribution">
            <app-donut-chart [data]="reports.membershipDistribution()" centerLabel="Members" ariaLabel="Membership distribution" />
          </app-chart-card>
          <app-chart-card title="New vs churned members">
            <app-bar-chart [labels]="churn().labels" [series]="[{ name: 'New', data: churn().newM, color: 'var(--chart-1)' }, { name: 'Churned', data: churn().churn, color: 'var(--chart-5)' }]" ariaLabel="New versus churned members" />
          </app-chart-card>
          <app-chart-card title="Lead conversion funnel">
            <app-funnel-chart [data]="reports.leadFunnel(range())" />
          </app-chart-card>
        </div>
        <div class="grid grid-2 mt-5">
          <section class="card">
            <div class="card-header"><h2 class="card-title">Today's bookings</h2><a class="btn btn-ghost btn-sm" routerLink="/admin/bookings/calendar">Calendar</a></div>
            <app-data-table [rows]="todays()" [columns]="bookingCols" [searchable]="false" [initialPageSize]="5" [defaultSort]="{ key: 'startTime', dir: 'asc' }" emptyTitle="No bookings found." [rowClickable]="true" (rowClick)="router.navigate(['/admin/bookings', $event.id])" caption="Today's bookings" />
          </section>
          <section class="card">
            <div class="card-header"><h2 class="card-title">Recent payments</h2><a class="btn btn-ghost btn-sm" routerLink="/admin/finance/payments">All</a></div>
            <app-data-table [rows]="recentPayments()" [columns]="payCols" [searchable]="false" [paginate]="false" emptyTitle="No payments found." caption="Recent payments" />
          </section>
          <section class="card">
            <div class="card-header"><h2 class="card-title">Recent leads</h2><a class="btn btn-ghost btn-sm" routerLink="/admin/leads">All</a></div>
            <app-data-table [rows]="recentLeads()" [columns]="leadCols" [searchable]="false" [paginate]="false" emptyTitle="No leads found." [rowClickable]="true" (rowClick)="router.navigate(['/admin/leads', $event.id])" caption="Recent leads" />
          </section>
          <section class="card">
            <div class="card-header"><h2 class="card-title">Pending tickets</h2><a class="btn btn-ghost btn-sm" routerLink="/admin/support">All</a></div>
            <app-data-table [rows]="pendingTickets()" [columns]="ticketCols" [searchable]="false" [paginate]="false" emptyTitle="No pending tickets" [rowClickable]="true" (rowClick)="router.navigate(['/admin/support', $event.id])" caption="Pending tickets" />
          </section>
        </div>
      }
    </div>
  `,
})
export class SuperDashboardComponent {
  protected readonly reports = inject(ReportService);
  protected readonly locations = inject(LocationService);
  protected readonly members = inject(MemberService);
  private readonly bookings = inject(BookingService);
  private readonly payments = inject(PaymentService);
  private readonly resources = inject(ResourceService);
  private readonly leads = inject(LeadService);
  private readonly tickets = inject(TicketService);
  protected readonly ctx = inject(LocationContextService);
  private readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly loader = createLoader(() => this.bookings.listScoped());
  protected readonly rangeDays = signal(29);
  protected readonly range = computed<DateRange>(() => this.reports.defaultRange(this.rangeDays()));
  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly activeMembers = computed(() => this.members.scoped().filter((m) => m.status === 'ACTIVE').length);
  protected readonly todays = computed(() => this.bookings.scoped().filter((b) => b.date === todayIso() && b.status !== 'CANCELLED'));
  protected readonly newLeads = computed(() => this.leads.scoped().filter((l) => l.status === 'NEW').length);
  protected readonly occ = computed(() => this.reports.occupancyByDay(this.range(), Math.max(1, Math.round(this.rangeDays() / 12))));
  protected readonly rev = computed(() => this.reports.revenueByMonth(6));
  protected readonly byType = computed(() => {
    const d = this.reports.bookingsByType(this.range());
    return { labels: d.map((x) => x.label), values: d.map((x) => x.value) };
  });
  protected readonly churn = computed(() => this.reports.newVsChurn(6));
  protected readonly recentPayments = computed(() => [...this.payments.scoped()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5));
  protected readonly recentLeads = computed(() => [...this.leads.scoped()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5));
  protected readonly pendingTickets = computed(() => this.tickets.scoped().filter((t) => t.status !== 'RESOLVED').slice(0, 5));
  protected readonly bookingCols: Column<Booking>[] = [
    { key: 'startTime', label: 'Time', value: (b) => `${b.startTime}–${b.endTime}` },
    { key: 'resource', label: 'Resource', value: (b) => this.resources.name(b.resourceId), primary: true },
    { key: 'member', label: 'Member', value: (b) => this.members.fullName(b.memberId) },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly payCols: Column<Payment>[] = [
    { key: 'member', label: 'Member', value: (p) => this.members.fullName(p.memberId), primary: true },
    { key: 'type', label: 'Type', value: (p) => PAYMENT_TYPE_LABELS[p.type], hideMobile: true },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly leadCols: Column<Lead>[] = [
    { key: 'name', label: 'Lead', primary: true },
    { key: 'requirement', label: 'Requirement', hideMobile: true },
    { key: 'status', label: 'Status', value: (l) => LEAD_STATUS_LABELS[l.status] },
    { key: 'createdAt', label: 'Created', type: 'date' },
  ];
  protected readonly ticketCols: Column<Ticket>[] = [
    { key: 'subject', label: 'Ticket', primary: true },
    { key: 'priority', label: 'Priority', type: 'status' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
}

/** Location Manager dashboard (§29) – only assigned locations. */
@Component({
  selector: 'app-manager-dashboard',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header [title]="'Location dashboard'" [subtitle]="ctx.label() + ' · assigned: ' + assigned()" />
      <div class="stat-grid">
        <app-stat-card label="Location occupancy" [value]="reports.occupancyNow() + '%'" icon="layers" tone="warning" link="/admin/floor-maps" />
        <app-stat-card label="Today's bookings" [value]="todays()" icon="calendar" link="/admin/bookings" />
        <app-stat-card label="Members" [value]="members.scoped().length" icon="users" tone="info" link="/admin/members" />
        <app-stat-card label="Visitors today" [value]="reports.todaysVisitors()" icon="user-plus" tone="primary" link="/admin/members/visitors" />
        <app-stat-card label="Resources" [value]="resources.scoped().length" icon="desk" link="/admin/resources" />
        <app-stat-card label="Open tickets" [value]="reports.openTickets()" icon="support" tone="danger" link="/admin/support" />
        <app-stat-card label="Revenue (month)" [value]="reports.monthRevenue() | compactInr" icon="trending-up" tone="success" />
      </div>
      <div class="grid grid-2 mt-5">
        <app-chart-card title="Occupancy by location" subtitle="Last 30 days, 11am snapshot">
          <app-bar-chart [labels]="occLoc().labels" [series]="[{ name: 'Occupancy', data: occLoc().values }]" suffix="%" />
        </app-chart-card>
        <app-chart-card title="Bookings by workspace type" subtitle="Last 30 days">
          <app-donut-chart [data]="reports.bookingsByType(range)" centerLabel="Bookings" />
        </app-chart-card>
      </div>
      <div class="grid grid-3 mt-5">
        @for (q of quick; track q.label) {
          <a class="card interactive card-body row" [routerLink]="q.link" style="color: inherit; text-decoration: none">
            <span class="stat-icon tone-primary"><app-icon [name]="q.icon" [size]="18" /></span><span class="fw-500">{{ q.label }}</span>
          </a>
        }
      </div>
    </div>
  `,
})
export class ManagerDashboardComponent {
  protected readonly reports = inject(ReportService);
  protected readonly members = inject(MemberService);
  protected readonly resources = inject(ResourceService);
  private readonly bookings = inject(BookingService);
  protected readonly ctx = inject(LocationContextService);
  protected readonly range = this.reports.defaultRange(29);
  protected readonly assigned = computed(() => this.ctx.allowedLocations().map((l) => l.name.replace('Officera ', '')).join(', '));
  protected readonly todays = computed(() => this.bookings.scoped().filter((b) => b.date === todayIso() && b.status !== 'CANCELLED').length);
  protected readonly occLoc = computed(() => {
    const d = this.reports.occupancyByLocation(this.range);
    return { labels: d.map((x) => x.label), values: d.map((x) => x.value) };
  });
  protected readonly quick = [
    { label: 'Floor map', icon: 'map', link: '/admin/floor-maps' },
    { label: 'Booking calendar', icon: 'calendar', link: '/admin/bookings/calendar' },
    { label: 'Front desk', icon: 'monitor', link: '/admin/front-desk' },
    { label: 'Leads', icon: 'target', link: '/admin/leads' },
    { label: 'Tickets', icon: 'support', link: '/admin/support' },
    { label: 'Reports', icon: 'chart', link: '/admin/reports' },
  ];
}

/** Finance dashboard (§28). */
@Component({
  selector: 'app-finance-dashboard',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Finance dashboard" [subtitle]="ctx.label()">
        <a class="btn btn-secondary" routerLink="/admin/finance/export"><app-icon name="download" [size]="16" /> Accounting export</a>
      </app-page-header>
      <div class="stat-grid">
        <app-stat-card label="Today's Collection" [value]="today() | inr" icon="rupee" tone="success" link="/admin/finance/payments" />
        <app-stat-card label="Monthly Revenue" [value]="reports.monthRevenue() | compactInr" icon="trending-up" tone="primary" />
        <app-stat-card label="Pending Payments" [value]="count('PENDING')" icon="clock" tone="warning" link="/admin/finance/payments" />
        <app-stat-card label="Failed Payments" [value]="count('FAILED')" icon="x-circle" tone="danger" link="/admin/finance/payments" />
        <app-stat-card label="Outstanding Dues" [value]="reports.outstanding() | compactInr" icon="alert" tone="danger" link="/admin/finance/dues" />
        <app-stat-card label="Refunds" [value]="refundsOpen()" icon="refund" tone="info" hint="Awaiting action" link="/admin/finance/refunds" />
      </div>
      <div class="grid grid-2 mt-5">
        <app-chart-card title="Revenue trend"><app-bar-chart [labels]="rev().labels" [series]="[{ name: 'Revenue', data: rev().values }]" prefix="₹" /></app-chart-card>
        <app-chart-card title="Revenue by plan (MRR)"><app-donut-chart [data]="reports.revenueByPlan()" centerLabel="MRR" /></app-chart-card>
      </div>
    </div>
  `,
})
export class FinanceDashboardComponent {
  protected readonly reports = inject(ReportService);
  private readonly payments = inject(PaymentService);
  private readonly refunds = inject(RefundService);
  protected readonly ctx = inject(LocationContextService);
  protected readonly rev = computed(() => this.reports.revenueByMonth(6));
  protected readonly today = computed(() => this.payments.scoped().filter((p) => p.status === 'SUCCESS' && p.date.slice(0, 10) === todayIso()).reduce((a, p) => a + p.amount, 0));
  protected readonly refundsOpen = computed(() => this.refunds.scoped().filter((r) => r.status === 'REQUESTED' || r.status === 'APPROVED').length);
  protected count(s: string): number {
    return this.payments.scoped().filter((p) => p.status === s).length;
  }
}

/** Routes /admin/dashboard to the right dashboard for the signed-in role. */
@Component({
  selector: 'app-admin-dashboard',
  imports: [SuperDashboardComponent, ManagerDashboardComponent, FinanceDashboardComponent, FrontDeskComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (auth.role()) {
      @case ('LOCATION_MANAGER') {
        <app-manager-dashboard />
      }
      @case ('FINANCE') {
        <app-finance-dashboard />
      }
      @case ('FRONT_DESK') {
        <app-front-desk />
      }
      @default {
        <app-super-dashboard />
      }
    }
  `,
})
export class AdminDashboardComponent {
  protected readonly auth = inject(AuthService);
}

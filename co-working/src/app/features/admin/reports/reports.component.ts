import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Column, SHARED, downloadCsv, printAsPdf, todayIso } from '../../../shared';
import { ReportService, DateRange } from '../../../core/services/report.service';
import { BookingService, InvoiceService, PaymentService } from '../../../core/services/data/transaction-data.service';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { PlanService, SubscriptionService } from '../../../core/services/data/membership-data.service';
import { LeadService } from '../../../core/services/data/engagement-data.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { AuditService, ToastService } from '../../../core/services/ui.service';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, PAYMENT_TYPE_LABELS, SPACE_TYPE_LABELS } from '../../../core/models';

export const REPORTS = [
  { id: 'occupancy', title: 'Occupancy Report', desc: 'Busy share of desks and rooms by day and location.', icon: 'layers' },
  { id: 'revenue', title: 'Revenue Report', desc: 'Collections by month, plan and payment type.', icon: 'trending-up' },
  { id: 'membership', title: 'Membership Report', desc: 'Active subscriptions by plan and status.', icon: 'membership' },
  { id: 'churn', title: 'Churn Report', desc: 'New versus churned members and cancellation reasons.', icon: 'trending-down' },
  { id: 'dues', title: 'Outstanding Dues Report', desc: 'Unpaid and overdue invoices with ageing.', icon: 'alert' },
  { id: 'bookings', title: 'Booking Report', desc: 'Bookings by workspace type, status and location.', icon: 'calendar' },
  { id: 'top-rooms', title: 'Top Rooms Report', desc: 'Most booked resources by bookings, hours and revenue.', icon: 'star' },
  { id: 'leads', title: 'Lead Report', desc: 'Leads by source, status and owner.', icon: 'target' },
  { id: 'lead-conversion', title: 'Lead Conversion Report', desc: 'Funnel from enquiry to member by source.', icon: 'funnel' },
] as const;

type Row = Record<string, string | number>;
interface ReportModel {
  cards: { label: string; value: string | number; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' }[];
  chart?: { kind: 'bar' | 'line' | 'donut' | 'funnel'; labels?: string[]; series?: { name: string; data: number[]; color?: string }[]; data?: { label: string; value: number; color?: string }[]; prefix?: string; suffix?: string };
  columns: Column<Row>[];
  rows: Row[];
}

@Component({
  selector: 'app-reports-index',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Reports" subtitle="Every report supports date and location filters and exports to CSV and PDF." [breadcrumbs]="[{ label: 'Reports' }]" />
      <div class="grid grid-3">
        @for (r of reports; track r.id) {
          <a class="card interactive card-body stack-sm" [routerLink]="['/admin/reports', r.id]" style="color: inherit; text-decoration: none">
            <span class="stat-icon tone-primary"><app-icon [name]="r.icon" [size]="18" /></span>
            <span class="fw-600 text-md">{{ r.title }}</span>
            <span class="text-sm text-muted">{{ r.desc }}</span>
          </a>
        }
      </div>
    </div>
  `,
})
export class ReportsIndexComponent {
  protected readonly reports = REPORTS;
}

@Component({
  selector: 'app-report',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header [title]="meta()?.title ?? 'Report'" [subtitle]="(meta()?.desc ?? '') + ' · ' + ctx.label()" [breadcrumbs]="[{ label: 'Reports', link: '/admin/reports' }, { label: meta()?.title ?? '' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        <button type="button" class="btn btn-secondary" (click)="pdf()"><app-icon name="printer" [size]="16" /> PDF</button>
      </app-page-header>
      <section class="card mb-5 no-print">
        <div class="toolbar">
          <label class="text-sm text-muted" for="rf">From</label>
          <input id="rf" class="input" type="date" [max]="to()" [ngModel]="from()" (ngModelChange)="from.set($event)" />
          <label class="text-sm text-muted" for="rt">To</label>
          <input id="rt" class="input" type="date" [min]="from()" [max]="today" [ngModel]="to()" (ngModelChange)="to.set($event)" />
          <label class="sr-only" for="rl">Location</label>
          <select id="rl" class="select" [ngModel]="ctx.value()" (ngModelChange)="ctx.select($event)">
            @for (o of ctx.options(); track o.value) {
              <option [value]="o.value">{{ o.label }}</option>
            }
          </select>
          <span class="spacer"></span>
          <div class="segmented">
            @for (p of presets; track p.days) {
              <button type="button" (click)="preset(p.days)">{{ p.label }}</button>
            }
          </div>
        </div>
      </section>
      @if (!meta()) {
        <div class="card"><app-empty-state icon="chart" title="Report not found"><a routerLink="/admin/reports" class="btn btn-secondary">All reports</a></app-empty-state></div>
      } @else {
        @let m = model();
        <div class="stat-grid mb-5">
          @for (c of m.cards; track c.label) {
            <app-stat-card [label]="c.label" [value]="c.value" [tone]="c.tone ?? 'primary'" />
          }
        </div>
        @if (m.chart; as ch) {
          <app-chart-card [title]="meta()!.title" subtitle="For the selected period and location" class="d-block mb-5">
            @switch (ch.kind) {
              @case ('bar') {
                <app-bar-chart [labels]="ch.labels!" [series]="ch.series!" [prefix]="ch.prefix ?? ''" [suffix]="ch.suffix ?? ''" />
              }
              @case ('line') {
                <app-line-chart [labels]="ch.labels!" [series]="ch.series!" [prefix]="ch.prefix ?? ''" [suffix]="ch.suffix ?? ''" />
              }
              @case ('donut') {
                <app-donut-chart [data]="ch.data!" />
              }
              @case ('funnel') {
                <app-funnel-chart [data]="ch.data!" />
              }
            }
          </app-chart-card>
        }
        <app-data-table [rows]="m.rows" [columns]="m.columns" [trackBy]="null" searchPlaceholder="Search report rows" emptyTitle="No data for this period" emptyMessage="Try a wider date range or another location." emptyIcon="chart" [caption]="meta()!.title" />
      }
    </div>
  `,
})
export class ReportComponent {
  readonly type = input.required<string>();
  private readonly reports = inject(ReportService);
  private readonly bookings = inject(BookingService);
  private readonly payments = inject(PaymentService);
  private readonly invoices = inject(InvoiceService);
  private readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  private readonly members = inject(MemberService);
  private readonly plans = inject(PlanService);
  private readonly subs = inject(SubscriptionService);
  private readonly leads = inject(LeadService);
  protected readonly ctx = inject(LocationContextService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly today = todayIso();
  protected readonly from = signal(this.reports.defaultRange(29).from);
  protected readonly to = signal(todayIso());
  protected readonly presets = [
    { label: '7d', days: 6 },
    { label: '30d', days: 29 },
    { label: '90d', days: 89 },
  ];
  protected readonly meta = computed(() => REPORTS.find((r) => r.id === this.type()));
  private readonly range = computed<DateRange>(() => ({ from: this.from(), to: this.to() }));

  protected preset(d: number): void {
    const r = this.reports.defaultRange(d);
    this.from.set(r.from);
    this.to.set(r.to);
  }

  protected readonly model = computed<ReportModel>(() => {
    const r = this.range();
    const inR = (d: string) => this.reports.inRange(d, r);
    const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
    switch (this.type()) {
      case 'occupancy': {
        const days = Math.round((new Date(r.to).getTime() - new Date(r.from).getTime()) / 86400000) + 1;
        const occ = this.reports.occupancyByDay(r, Math.max(1, Math.round(days / 15)));
        const byLoc = this.reports.occupancyByLocation(r);
        const avg = occ.values.length ? Math.round(occ.values.reduce((a, b) => a + b, 0) / occ.values.length) : 0;
        return {
          cards: [
            { label: 'Average occupancy', value: avg + '%' },
            { label: 'Peak day', value: Math.max(0, ...occ.values) + '%', tone: 'warning' },
            { label: 'Lowest day', value: Math.min(100, ...occ.values) + '%', tone: 'info' },
            { label: 'Active resources', value: this.resources.scoped().filter((x) => x.status === 'ACTIVE').length, tone: 'neutral' },
          ],
          chart: { kind: 'line', labels: occ.labels, series: [{ name: 'Occupancy', data: occ.values }], suffix: '%' },
          columns: [{ key: 'location', label: 'Location', primary: true }, { key: 'occupancy', label: 'Occupancy %', type: 'number' }, { key: 'resources', label: 'Resources', type: 'number' }, { key: 'bookings', label: 'Bookings', type: 'number' }],
          rows: byLoc.map((x) => {
            const l = this.locations.scoped().find((y) => y.name.endsWith(x.label));
            return { location: x.label, occupancy: x.value, resources: l ? this.resources.byLocation(l.id).length : 0, bookings: l ? this.bookings.items().filter((b) => b.locationId === l.id && inR(b.date)).length : 0 };
          }),
        };
      }
      case 'revenue': {
        const ok = this.payments.scoped().filter((p) => p.status === 'SUCCESS' && inR(p.date));
        const total = ok.reduce((a, p) => a + p.amount, 0);
        const trend = this.reports.revenueByMonth(6);
        const types = Object.keys(PAYMENT_TYPE_LABELS) as (keyof typeof PAYMENT_TYPE_LABELS)[];
        return {
          cards: [
            { label: 'Collected', value: inr(total), tone: 'success' },
            { label: 'Payments', value: ok.length },
            { label: 'Average ticket', value: inr(ok.length ? total / ok.length : 0), tone: 'info' },
            { label: 'MRR (active plans)', value: inr(this.reports.revenueByPlan().reduce((a, x) => a + x.value, 0)), tone: 'primary' },
          ],
          chart: { kind: 'bar', labels: trend.labels, series: [{ name: 'Revenue', data: trend.values }], prefix: '₹' },
          columns: [{ key: 'type', label: 'Revenue type', primary: true }, { key: 'count', label: 'Payments', type: 'number' }, { key: 'amount', label: 'Amount', type: 'currency' }, { key: 'share', label: 'Share %', type: 'number' }],
          rows: [
            ...types.map((t) => {
              const a = ok.filter((p) => p.type === t).reduce((s, p) => s + p.amount, 0);
              return { type: PAYMENT_TYPE_LABELS[t], count: ok.filter((p) => p.type === t).length, amount: a, share: total ? Math.round((a / total) * 100) : 0 };
            }),
            ...this.reports.revenueByPlan().map((p) => ({ type: `Plan MRR – ${p.label}`, count: '—', amount: p.value, share: '—' })),
          ],
        };
      }
      case 'membership': {
        const subs = this.subs.scoped();
        const dist = this.reports.membershipDistribution();
        return {
          cards: [
            { label: 'Active', value: subs.filter((s) => s.status === 'ACTIVE').length, tone: 'success' },
            { label: 'Paused', value: subs.filter((s) => s.status === 'PAUSED').length, tone: 'warning' },
            { label: 'Overdue / suspended', value: subs.filter((s) => s.status === 'OVERDUE' || s.status === 'SUSPENDED').length, tone: 'danger' },
            { label: 'New this period', value: subs.filter((s) => inR(s.createdAt)).length, tone: 'info' },
          ],
          chart: { kind: 'donut', data: dist },
          columns: [{ key: 'plan', label: 'Plan', primary: true }, { key: 'active', label: 'Active', type: 'number' }, { key: 'paused', label: 'Paused', type: 'number' }, { key: 'overdue', label: 'Overdue', type: 'number' }, { key: 'mrr', label: 'MRR', type: 'currency' }],
          rows: this.plans.items().map((p) => {
            const ps = subs.filter((s) => s.planId === p.id);
            return { plan: p.name, active: ps.filter((s) => s.status === 'ACTIVE').length, paused: ps.filter((s) => s.status === 'PAUSED').length, overdue: ps.filter((s) => s.status === 'OVERDUE' || s.status === 'SUSPENDED').length, mrr: ps.filter((s) => s.status === 'ACTIVE').reduce((a, s) => a + s.price, 0) };
          }),
        };
      }
      case 'churn': {
        const nc = this.reports.newVsChurn(6);
        const lost = this.subs.scoped().filter((s) => s.status === 'CANCELLED' || s.status === 'EXPIRED' || !!s.cancelAt);
        return {
          cards: [
            { label: 'Churn rate', value: this.reports.churnRate() + '%', tone: 'danger' },
            { label: 'New members (6 mo)', value: nc.newM.reduce((a, b) => a + b, 0), tone: 'success' },
            { label: 'Churned (6 mo)', value: nc.churn.reduce((a, b) => a + b, 0), tone: 'warning' },
            { label: 'Scheduled cancellations', value: this.subs.scoped().filter((s) => !!s.cancelAt && s.status === 'ACTIVE').length, tone: 'neutral' },
          ],
          chart: { kind: 'bar', labels: nc.labels, series: [{ name: 'New', data: nc.newM }, { name: 'Churned', data: nc.churn, color: 'var(--chart-5)' }] },
          columns: [{ key: 'member', label: 'Member', primary: true }, { key: 'plan', label: 'Plan' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'end', label: 'End date', type: 'date' }, { key: 'reason', label: 'Reason' }],
          rows: lost.map((s) => ({ member: this.members.fullName(s.memberId), plan: this.plans.name(s.planId), status: s.status, end: s.cancelAt ?? s.endDate, reason: s.cancelReason ?? (s.status === 'EXPIRED' ? 'Not renewed' : '—') })),
        };
      }
      case 'dues': {
        const due = this.invoices.scoped().filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE');
        const age = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000));
        const b = [
          { label: '0–7 days', min: 0, max: 7 },
          { label: '8–30 days', min: 8, max: 30 },
          { label: '31–60 days', min: 31, max: 60 },
          { label: '60+ days', min: 61, max: 99999 },
        ].map((x) => ({ label: x.label, value: due.filter((i) => age(i.dueDate) >= x.min && age(i.dueDate) <= x.max).reduce((a, i) => a + i.total - i.amountPaid, 0) }));
        return {
          cards: [
            { label: 'Outstanding', value: inr(this.reports.outstanding()), tone: 'danger' },
            { label: 'Invoices', value: due.length },
            { label: 'Members with dues', value: new Set(due.map((i) => i.memberId)).size, tone: 'warning' },
            { label: 'Oldest (days)', value: Math.max(0, ...due.map((i) => age(i.dueDate))), tone: 'neutral' },
          ],
          chart: { kind: 'bar', labels: b.map((x) => x.label), series: [{ name: 'Outstanding', data: b.map((x) => x.value), color: 'var(--chart-5)' }], prefix: '₹' },
          columns: [{ key: 'invoice', label: 'Invoice', primary: true }, { key: 'member', label: 'Member' }, { key: 'due', label: 'Due date', type: 'date' }, { key: 'age', label: 'Days overdue', type: 'number' }, { key: 'amount', label: 'Amount due', type: 'currency' }],
          rows: due.map((i) => ({ invoice: i.number, member: this.members.fullName(i.memberId), due: i.dueDate, age: age(i.dueDate), amount: i.total - i.amountPaid })),
        };
      }
      case 'bookings': {
        const bs = this.bookings.scoped().filter((b) => inR(b.date));
        const byType = this.reports.bookingsByType(r);
        return {
          cards: [
            { label: 'Bookings', value: bs.length },
            { label: 'Confirmed / completed', value: bs.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED').length, tone: 'success' },
            { label: 'Cancelled', value: bs.filter((b) => b.status === 'CANCELLED').length, tone: 'danger' },
            { label: 'Booking value', value: inr(bs.filter((b) => b.status !== 'CANCELLED').reduce((a, b) => a + b.amount, 0)), tone: 'info' },
          ],
          chart: { kind: 'bar', labels: byType.map((x) => x.label), series: [{ name: 'Bookings', data: byType.map((x) => x.value), color: 'var(--chart-2)' }] },
          columns: [{ key: 'id', label: 'Booking', primary: true }, { key: 'date', label: 'Date', type: 'date' }, { key: 'member', label: 'Member' }, { key: 'resource', label: 'Resource' }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', type: 'currency' }, { key: 'status', label: 'Status', type: 'status' }],
          rows: bs.map((b) => {
            const res = this.resources.find(b.resourceId);
            return { id: b.id, date: b.date, member: this.members.fullName(b.memberId), resource: res?.name ?? '—', type: res ? SPACE_TYPE_LABELS[res.type] : '—', amount: b.amount, status: b.status };
          }),
        };
      }
      case 'top-rooms': {
        const top = this.reports.topRooms(r, 15);
        return {
          cards: [
            { label: 'Most booked', value: top[0]?.name ?? '—' },
            { label: 'Bookings (top 15)', value: top.reduce((a, t) => a + t.bookings, 0), tone: 'info' },
            { label: 'Hours booked', value: top.reduce((a, t) => a + t.hours, 0), tone: 'warning' },
            { label: 'Revenue (top 15)', value: inr(top.reduce((a, t) => a + t.revenue, 0)), tone: 'success' },
          ],
          chart: { kind: 'bar', labels: top.slice(0, 8).map((t) => t.name.replace('Hot Desk ', 'HD ').replace('Dedicated Desk ', 'DD ')), series: [{ name: 'Bookings', data: top.slice(0, 8).map((t) => t.bookings) }] },
          columns: [{ key: 'name', label: 'Resource', primary: true }, { key: 'location', label: 'Location' }, { key: 'bookings', label: 'Bookings', type: 'number' }, { key: 'hours', label: 'Hours', type: 'number' }, { key: 'revenue', label: 'Revenue', type: 'currency' }],
          rows: top.map(({ id, ...rest }) => ({ ...rest, rid: id })),
        };
      }
      case 'leads': {
        const ls = this.leads.scoped().filter((l) => inR(l.createdAt));
        const sources = Object.keys(LEAD_SOURCE_LABELS) as (keyof typeof LEAD_SOURCE_LABELS)[];
        return {
          cards: [
            { label: 'Leads', value: ls.length },
            { label: 'New', value: ls.filter((l) => l.status === 'NEW').length, tone: 'info' },
            { label: 'Converted', value: ls.filter((l) => l.status === 'CONVERTED').length, tone: 'success' },
            { label: 'Lost', value: ls.filter((l) => l.status === 'LOST').length, tone: 'danger' },
          ],
          chart: { kind: 'donut', data: sources.map((s) => ({ label: LEAD_SOURCE_LABELS[s], value: ls.filter((l) => l.source === s).length })).filter((x) => x.value) },
          columns: [{ key: 'id', label: 'Lead', primary: true }, { key: 'name', label: 'Name' }, { key: 'source', label: 'Source' }, { key: 'location', label: 'Location' }, { key: 'status', label: 'Status' }, { key: 'created', label: 'Created', type: 'date' }],
          rows: ls.map((l) => ({ id: l.id, name: l.name, source: LEAD_SOURCE_LABELS[l.source], location: this.locations.shortName(l.locationId), status: LEAD_STATUS_LABELS[l.status], created: l.createdAt.slice(0, 10) })),
        };
      }
      default: {
        const ls = this.leads.scoped().filter((l) => inR(l.createdAt));
        const conv = ls.filter((l) => l.status === 'CONVERTED').length;
        const sources = Object.keys(LEAD_SOURCE_LABELS) as (keyof typeof LEAD_SOURCE_LABELS)[];
        return {
          cards: [
            { label: 'Enquiries', value: ls.length },
            { label: 'Converted', value: conv, tone: 'success' },
            { label: 'Conversion rate', value: (ls.length ? Math.round((conv / ls.length) * 1000) / 10 : 0) + '%', tone: 'primary' },
            { label: 'Tours done', value: ls.filter((l) => l.status === 'TOUR_DONE' || l.status === 'CONVERTED').length, tone: 'warning' },
          ],
          chart: { kind: 'funnel', data: this.reports.leadFunnel(r) },
          columns: [{ key: 'source', label: 'Source', primary: true }, { key: 'leads', label: 'Leads', type: 'number' }, { key: 'tours', label: 'Tours', type: 'number' }, { key: 'converted', label: 'Converted', type: 'number' }, { key: 'rate', label: 'Conversion %', type: 'number' }],
          rows: sources.map((s) => {
            const x = ls.filter((l) => l.source === s);
            const c = x.filter((l) => l.status === 'CONVERTED').length;
            return { source: LEAD_SOURCE_LABELS[s], leads: x.length, tours: x.filter((l) => ['TOUR_SCHEDULED', 'TOUR_DONE', 'CONVERTED'].includes(l.status)).length, converted: c, rate: x.length ? Math.round((c / x.length) * 100) : 0 };
          }),
        };
      }
    }
  });

  protected csv(): void {
    const m = this.model();
    downloadCsv(`${this.type()}-report-${this.from()}-to-${this.to()}`, m.rows, m.columns.map((c) => ({ label: c.label, value: (r: Row) => r[c.key] })));
    this.audit.record('EXPORT', 'Reports', 'Report', this.type(), `Exported ${this.meta()?.title} (CSV)`);
    this.toast.success('CSV exported');
  }

  protected pdf(): void {
    this.audit.record('EXPORT', 'Reports', 'Report', this.type(), `Exported ${this.meta()?.title} (PDF)`);
    printAsPdf();
  }
}

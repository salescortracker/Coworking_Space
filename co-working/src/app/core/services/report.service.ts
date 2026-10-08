import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { LocationContextService } from './location-context.service';
import { Booking, Lead, Plan, Subscription } from '../models';
import { BookingService, InvoiceService, PaymentService } from './data/transaction-data.service';
import { LocationService, ResourceService } from './data/workspace-data.service';
import { MemberService } from './data/people-data.service';
import { PlanService, SubscriptionService } from './data/membership-data.service';
import { LeadService } from './data/engagement-data.service';
import { TicketService, VisitorService } from './data/operations-data.service';
import { BookingEngineService } from './booking-engine.service';

export interface DateRange {
  from: string;
  to: string;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function days(r: DateRange): string[] {
  const out: string[] = [];
  const d = new Date(r.from + 'T12:00:00');
  const end = new Date(r.to + 'T12:00:00');
  while (d <= end && out.length < 400) {
    out.push(iso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** KPI figures calculated by the API (POST /api/Dashboard/GetSummary). */
export interface DashboardSummary {
  totalMembers: number;
  activeMembers: number;
  activeSubscriptions: number;
  todaysBookings: number;
  todaysVisitors: number;
  openTickets: number;
  newLeads: number;
  monthRevenue: number;
  outstanding: number;
  outstandingInvoices: number;
  failedPayments: number;
  churnRate: number;
  occupancyNow: number;
}

/**
 * Aggregations behind the dashboards and reports. Headline KPIs come from the API's dashboard endpoint
 * (calculated in the database for the selected locations); charts are built from the records loaded from
 * the API, so the global location selector drives every number. No figure is invented.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly bookings = inject(BookingService);
  private readonly payments = inject(PaymentService);
  private readonly invoices = inject(InvoiceService);
  private readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  private readonly members = inject(MemberService);
  private readonly plans = inject(PlanService);
  private readonly subs = inject(SubscriptionService);
  private readonly leads = inject(LeadService);
  private readonly tickets = inject(TicketService);
  private readonly visitors = inject(VisitorService);
  private readonly engine = inject(BookingEngineService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly ctx = inject(LocationContextService);

  /** Latest server-side KPIs for the selected locations (null until loaded or for non-staff users). */
  readonly summary = signal<DashboardSummary | null>(null);
  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Refresh the server KPIs when the location selection changes or the underlying records change.
    effect(() => {
      const locationIds = this.ctx.selectedIds();
      const staff = this.auth.isStaff() && this.auth.can('dashboard.view');
      this.payments.items();
      this.invoices.items();
      this.tickets.items();
      this.visitors.items();
      this.subs.items();
      this.bookings.items();
      untracked(() => {
        clearTimeout(this.refreshTimer);
        if (!staff) {
          this.summary.set(null);
          return;
        }
        this.refreshTimer = setTimeout(() => {
          this.api.post<DashboardSummary>('Dashboard/GetSummary', { locationIds }, { spinner: 'none' }).subscribe({
            next: (s) => this.summary.set(s),
            error: () => this.summary.set(null),
          });
        }, 400);
      });
    });
  }

  defaultRange(daysBack = 29): DateRange {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - daysBack);
    return { from: iso(from), to: iso(to) };
  }

  inRange(dateIso: string, r: DateRange): boolean {
    const d = dateIso.slice(0, 10);
    return d >= r.from && d <= r.to;
  }

  /** Occupancy % per day: share of active resource-hours (9am–6pm) that are busy. */
  occupancyByDay(r: DateRange, step = 1): { labels: string[]; values: number[] } {
    const locs = this.locations.scoped().map((l) => l.id);
    const res = this.resources.items().filter((x) => locs.includes(x.locationId) && x.status === 'ACTIVE');
    const ds = days(r).filter((_, i, a) => i % step === 0 || i === a.length - 1);
    const values = ds.map((d) => {
      let busy = 0;
      let total = 0;
      for (const loc of locs) {
        const locRes = res.filter((x) => x.locationId === loc);
        for (const h of [10, 13, 16]) {
          const b = new Set(this.engine.busyResourceIds(loc, d, `${h}:00`, `${h + 1}:00`));
          total += locRes.length;
          busy += locRes.filter((x) => b.has(x.id)).length;
        }
      }
      return total ? Math.round((busy / total) * 100) : 0;
    });
    return { labels: ds.map((d) => new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })), values };
  }

  occupancyNow(): number {
    const server = this.summary();
    if (server) return server.occupancyNow;
    const today = iso(new Date());
    const v = this.occupancyByDay({ from: today, to: today }).values;
    return v[0] ?? 0;
  }

  occupancyByLocation(r: DateRange): { label: string; value: number }[] {
    return this.locations.scoped().map((l) => {
      const ds = days(r).filter((_, i) => i % 3 === 0);
      const res = this.resources.byLocation(l.id).filter((x) => x.status === 'ACTIVE');
      let busy = 0;
      let total = 0;
      ds.forEach((d) => {
        const b = new Set(this.engine.busyResourceIds(l.id, d, '11:00', '12:00'));
        total += res.length;
        busy += res.filter((x) => b.has(x.id)).length;
      });
      return { label: l.name.replace('Officera ', ''), value: total ? Math.round((busy / total) * 100) : 0 };
    });
  }

  /** Last N months of successful collections (actual payments only). */
  revenueByMonth(months = 6): { labels: string[]; values: number[] } {
    const keys: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) keys.push(iso(new Date(now.getFullYear(), now.getMonth() - i, 15)).slice(0, 7));
    const ok = this.payments.scoped().filter((p) => p.status === 'SUCCESS');
    return {
      labels: keys.map((k) => new Date(k + '-15T12:00:00').toLocaleDateString('en-IN', { month: 'short' })),
      values: keys.map((k) => Math.round(ok.filter((p) => p.date.slice(0, 7) === k).reduce((a, p) => a + p.amount, 0))),
    };
  }

  revenueByPlan(): { label: string; value: number }[] {
    const subs = this.subs.scoped().filter((s) => s.status === 'ACTIVE');
    return this.plans
      .items()
      .map((p) => ({ label: p.name, value: subs.filter((s) => s.planId === p.id).reduce((a, s) => a + s.price, 0) }))
      .filter((x) => x.value > 0);
  }

  bookingsByType(r: DateRange): { label: string; value: number }[] {
    const b = this.bookings.scoped().filter((x) => this.inRange(x.date, r) && x.status !== 'CANCELLED');
    const labels: Record<string, string> = { HOT_DESK: 'Hot Desk', DEDICATED_DESK: 'Dedicated Desk', PRIVATE_OFFICE: 'Private Office', MEETING_ROOM: 'Meeting Room' };
    return Object.keys(labels).map((t) => ({ label: labels[t], value: b.filter((x) => this.resources.find(x.resourceId)?.type === t).length }));
  }

  membershipDistribution(): { label: string; value: number }[] {
    const subs = this.subs.scoped().filter((s) => ['ACTIVE', 'OVERDUE', 'PAUSED'].includes(s.status));
    return this.plans
      .items()
      .map((p: Plan) => ({ label: p.name, value: subs.filter((s) => s.planId === p.id).length }))
      .filter((x) => x.value > 0);
  }

  /** New vs churned members per month. */
  newVsChurn(months = 6): { labels: string[]; newM: number[]; churn: number[] } {
    const now = new Date();
    const keys: string[] = [];
    for (let i = months - 1; i >= 0; i--) keys.push(iso(new Date(now.getFullYear(), now.getMonth() - i, 15)).slice(0, 7));
    const ms = this.members.scoped();
    const churned = this.subs.scoped().filter((s) => s.status === 'CANCELLED' || s.status === 'EXPIRED');
    const newM = keys.map((k) => ms.filter((m) => m.joinDate.slice(0, 7) === k).length);
    const churn = keys.map((k) => churned.filter((s) => (s.cancelAt ?? s.endDate).slice(0, 7) === k).length);
    return { labels: keys.map((k) => new Date(k + '-15T12:00:00').toLocaleDateString('en-IN', { month: 'short' })), newM, churn };
  }

  leadFunnel(r?: DateRange): { label: string; value: number; color?: string }[] {
    const ls = this.leads.scoped().filter((l) => !r || this.inRange(l.createdAt, r));
    const reached = (s: Lead['status'][]) => ls.filter((l) => s.includes(l.status)).length;
    return [
      { label: 'Enquiries', value: ls.length },
      { label: 'Contacted', value: reached(['CONTACTED', 'TOUR_SCHEDULED', 'TOUR_DONE', 'CONVERTED']) },
      { label: 'Tours', value: reached(['TOUR_SCHEDULED', 'TOUR_DONE', 'CONVERTED']) },
      { label: 'Converted', value: reached(['CONVERTED']), color: 'var(--success)' },
    ];
  }

  topRooms(r: DateRange, limit = 10): { id: string; name: string; location: string; bookings: number; hours: number; revenue: number }[] {
    const b = this.bookings.scoped().filter((x) => this.inRange(x.date, r) && x.status !== 'CANCELLED');
    const map = new Map<string, { bookings: number; hours: number; revenue: number }>();
    b.forEach((x: Booking) => {
      const e = map.get(x.resourceId) ?? { bookings: 0, hours: 0, revenue: 0 };
      e.bookings++;
      e.hours += this.engine.hours(x.startTime, x.endTime);
      e.revenue += x.amount;
      map.set(x.resourceId, e);
    });
    return [...map.entries()]
      .map(([id, v]) => ({ id, name: this.resources.name(id), location: this.locations.shortName(this.resources.find(id)?.locationId), ...v }))
      .sort((a, z) => z.bookings - a.bookings || z.revenue - a.revenue)
      .slice(0, limit);
  }

  churnRate(): number {
    const server = this.summary();
    if (server) return server.churnRate;
    const s = this.subs.scoped();
    const lost = s.filter((x: Subscription) => x.status === 'CANCELLED' || x.status === 'EXPIRED' || !!x.cancelAt).length;
    return s.length ? Math.round((lost / s.length) * 1000) / 10 : 0;
  }

  outstanding(): number {
    const server = this.summary();
    if (server) return server.outstanding;
    return this.invoices.scoped().filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE').reduce((a, i) => a + i.total - i.amountPaid, 0);
  }

  monthRevenue(): number {
    const server = this.summary();
    if (server) return server.monthRevenue;
    const k = iso(new Date()).slice(0, 7);
    return this.payments.scoped().filter((p) => p.status === 'SUCCESS' && p.date.slice(0, 7) === k).reduce((a, p) => a + p.amount, 0);
  }

  openTickets(): number {
    const server = this.summary();
    if (server) return server.openTickets;
    return this.tickets.scoped().filter((t) => t.status !== 'RESOLVED').length;
  }

  todaysVisitors(): number {
    const server = this.summary();
    if (server) return server.todaysVisitors;
    const t = iso(new Date());
    return this.visitors.scoped().filter((v) => v.visitDate === t).length;
  }

  /** Month-over-month change of successful collections in %, or null when last month had none. */
  revenueTrend(): number | null {
    const now = new Date();
    const thisKey = iso(now).slice(0, 7);
    const lastKey = iso(new Date(now.getFullYear(), now.getMonth() - 1, 15)).slice(0, 7);
    const ok = this.payments.scoped().filter((p) => p.status === 'SUCCESS');
    const sum = (k: string) => ok.filter((p) => p.date.slice(0, 7) === k).reduce((a, p) => a + p.amount, 0);
    const last = sum(lastKey);
    return last > 0 ? Math.round(((sum(thisKey) - last) / last) * 1000) / 10 : null;
  }

  /** Growth of active members since the start of this month in %, or null when there were none. */
  activeMembersTrend(): number | null {
    const monthStart = iso(new Date()).slice(0, 7) + '-01';
    const active = this.members.scoped().filter((m) => m.status === 'ACTIVE');
    const before = active.filter((m) => m.joinDate < monthStart).length;
    return before > 0 ? Math.round(((active.length - before) / before) * 1000) / 10 : null;
  }
}
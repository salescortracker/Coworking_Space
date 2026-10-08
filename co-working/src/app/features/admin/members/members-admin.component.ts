import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, downloadCsv, emailValidator, mobileValidator, todayStamp } from '../../../shared';
import { Booking, Company, Member, Payment, Ticket, Visitor, AccessLog, PAYMENT_TYPE_LABELS, TimelineEntry } from '../../../core/models';
import { CompanyService, MemberService, UserService } from '../../../core/services/data/people-data.service';
import { LocationService, ResourceService } from '../../../core/services/data/workspace-data.service';
import { PlanService, SubscriptionService } from '../../../core/services/data/membership-data.service';
import { BookingService, PaymentService } from '../../../core/services/data/transaction-data.service';
import { AccessLogService, TicketService, VisitorService } from '../../../core/services/data/operations-data.service';
import { MemberAccountService, accessStateFor } from '../../../core/services/member-account.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-members-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Members" subtitle="Everyone with an Officera membership account." [breadcrumbs]="[{ label: 'Members' }, { label: 'Members' }]">
        <button type="button" class="btn btn-secondary" (click)="export()"><app-icon name="download" [size]="16" /> Export CSV</button>
        @if (auth.can('members.create')) {
          <a class="btn btn-primary" routerLink="/admin/members/new"><app-icon name="user-plus" [size]="16" /> Add member</a>
        }
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Total members" [value]="members.scoped().length" icon="users" />
        <app-stat-card label="Active" [value]="count('ACTIVE')" icon="check-circle" tone="success" />
        <app-stat-card label="Suspended" [value]="count('SUSPENDED')" icon="lock" tone="danger" />
        <app-stat-card label="Pending" [value]="count('PENDING')" icon="clock" tone="warning" hint="Awaiting plan / payment" />
      </div>
      <app-data-table
        [rows]="filtered()"
        [columns]="cols"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!status() || !!plan()"
        (clearFilters)="status.set(''); plan.set('')"
        searchPlaceholder="Search name, email, mobile or ID"
        emptyTitle="No members found"
        emptyIcon="users"
        [rowClickable]="true"
        (rowClick)="router.navigate(['/admin/members', $event.id])"
        caption="Members"
      >
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'PENDING']; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <select class="select" aria-label="Membership" [ngModel]="plan()" (ngModelChange)="plan.set($event)">
            <option value="">All memberships</option>
            @for (p of plans.items(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </ng-container>
        <ng-template appCell="name" let-row>
          <div class="row-sm">
            <app-avatar [name]="row.firstName + ' ' + row.lastName" [size]="30" />
            <div class="min-0"><span class="cell-primary d-block">{{ row.firstName }} {{ row.lastName }}</span><span class="cell-sub">{{ row.designation }}</span></div>
          </div>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/members', row.id]" aria-label="View"><app-icon name="eye" [size]="16" /></a>
          @if (auth.can('members.edit')) {
            <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/members', row.id, 'edit']" aria-label="Edit"><app-icon name="edit" [size]="16" /></a>
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class MembersAdminComponent {
  protected readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  private readonly locations = inject(LocationService);
  protected readonly plans = inject(PlanService);
  private readonly subs = inject(SubscriptionService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.members.listScoped());
  protected readonly status = signal('');
  protected readonly plan = signal('');
  protected readonly filtered = computed(() =>
    this.members.scoped().filter((m) => (!this.status() || m.status === this.status()) && (!this.plan() || this.subs.forMember(m.id)?.planId === this.plan())),
  );
  protected count(s: string): number {
    return this.members.scoped().filter((m) => m.status === s).length;
  }
  protected readonly cols: Column<Member>[] = [
    { key: 'id', label: 'Member ID' },
    { key: 'name', label: 'Name', value: (m) => `${m.firstName} ${m.lastName}`, primary: true },
    { key: 'company', label: 'Company', value: (m) => this.companies.find(m.companyId)?.name ?? 'Individual' },
    { key: 'email', label: 'Email', hideMobile: true },
    { key: 'mobile', label: 'Mobile', hideMobile: true },
    { key: 'membership', label: 'Membership', value: (m) => this.plans.find(this.subs.forMember(m.id)?.planId)?.name ?? '—' },
    { key: 'location', label: 'Location', value: (m) => this.locations.shortName(m.locationId), hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'joinDate', label: 'Join Date', type: 'date', hideMobile: true },
  ];

  protected export(): void {
    downloadCsv(`members-${todayStamp()}`, this.filtered(), [
      { label: 'Member ID', value: (m) => m.id },
      { label: 'Name', value: (m) => `${m.firstName} ${m.lastName}` },
      { label: 'Company', value: (m) => this.companies.find(m.companyId)?.name ?? '' },
      { label: 'Email', value: (m) => m.email },
      { label: 'Mobile', value: (m) => m.mobile },
      { label: 'Location', value: (m) => this.locations.name(m.locationId) },
      { label: 'Status', value: (m) => m.status },
      { label: 'Join date', value: (m) => m.joinDate },
    ]);
    this.toast.success('Export ready');
  }
}

/** Member detail with every related record (tabs per spec §24). */
@Component({
  selector: 'app-member-admin-detail',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (member(); as m) {
        <app-page-header [title]="m.firstName + ' ' + m.lastName" [subtitle]="m.id + ' · ' + (company()?.name ?? 'Individual') + ' · ' + locations.name(m.locationId)" [breadcrumbs]="[{ label: 'Members', link: '/admin/members' }, { label: m.firstName + ' ' + m.lastName }]">
          <app-status-badge badge [status]="m.status" />
          @if (auth.can('members.edit')) {
            <button type="button" class="btn btn-secondary" (click)="resetPassword(m)"><app-icon name="key" [size]="16" /> Reset password</button>
            @if (m.status === 'ACTIVE') {
              <button type="button" class="btn btn-danger" (click)="setStatus(m, 'SUSPENDED')"><app-icon name="lock" [size]="16" /> Suspend</button>
            } @else {
              <button type="button" class="btn btn-success" (click)="setStatus(m, 'ACTIVE')"><app-icon name="check" [size]="16" /> Activate</button>
            }
            <a class="btn btn-primary" [routerLink]="['/admin/members', m.id, 'edit']"><app-icon name="edit" [size]="16" /> Edit</a>
          }
        </app-page-header>
        <app-tabs [tabs]="tabs()" [(value)]="tab" label="Member sections" />
        <div class="mt-5">
          @switch (tab()) {
            @case ('profile') {
              <div class="split">
                <section class="card card-body">
                  <div class="row mb-4">
                    <app-avatar [name]="m.firstName + ' ' + m.lastName" [size]="64" />
                    <div>
                      <div class="text-lg fw-600">{{ m.firstName }} {{ m.lastName }}</div>
                      <div class="text-muted">{{ m.designation || 'No designation' }}</div>
                    </div>
                  </div>
                  <div class="kv-grid">
                    <div class="kv-item"><div class="k">Email</div><div class="v">{{ m.email }}</div></div>
                    <div class="kv-item"><div class="k">Mobile</div><div class="v">{{ m.mobile | mobile }}</div></div>
                    <div class="kv-item"><div class="k">Home location</div><div class="v">{{ locations.name(m.locationId) }}</div></div>
                    <div class="kv-item"><div class="k">Joined</div><div class="v">{{ m.joinDate | date: 'd MMM y' }}</div></div>
                    <div class="kv-item"><div class="k">Directory</div><div class="v">{{ m.directoryVisible ? 'Visible' : 'Hidden' }}</div></div>
                    <div class="kv-item"><div class="k">Login</div><div class="v">{{ hasLogin() ? 'Enabled' : 'Not created' }}</div></div>
                    @if (m.leadId) {
                      <div class="kv-item"><div class="k">Converted from</div><div class="v"><a [routerLink]="['/admin/leads', m.leadId]">{{ m.leadId }}</a></div></div>
                    }
                  </div>
                  @if (m.bio) {
                    <p class="text-secondary mt-4 mb-0">{{ m.bio }}</p>
                  }
                </section>
                <div class="stat-grid" style="grid-template-columns: 1fr 1fr">
                  <app-stat-card label="Bookings" [value]="bookings().length" icon="calendar" />
                  <app-stat-card label="Total paid" [value]="paid() | inr" icon="rupee" tone="success" />
                  <app-stat-card label="Visitors" [value]="visitors().length" icon="user-plus" tone="info" />
                  <app-stat-card label="Open tickets" [value]="openTickets()" icon="support" tone="warning" />
                </div>
              </div>
            }
            @case ('company') {
              @if (company(); as c) {
                <section class="card card-body">
                  <div class="kv-grid">
                    <div class="kv-item"><div class="k">Company</div><div class="v">{{ c.name }}</div></div>
                    <div class="kv-item"><div class="k">GSTIN</div><div class="v mono">{{ c.gstin || '—' }}</div></div>
                    <div class="kv-item"><div class="k">State</div><div class="v">{{ c.state }}</div></div>
                    <div class="kv-item"><div class="k">Industry</div><div class="v">{{ c.industry || '—' }}</div></div>
                    <div class="kv-item"><div class="k">Size</div><div class="v">{{ c.size }}</div></div>
                    <div class="kv-item"><div class="k">Billing address</div><div class="v">{{ c.billingAddress }}</div></div>
                  </div>
                  <a class="btn btn-secondary btn-sm mt-4" routerLink="/admin/members/companies" [queryParams]="{ id: c.id }">Open company</a>
                </section>
              } @else {
                <div class="card"><app-empty-state icon="briefcase" title="Individual member" message="No company is linked to this member." /></div>
              }
            }
            @case ('membership') {
              @if (sub(); as s) {
                <section class="card card-body">
                  <div class="row-between mb-4"><h3 class="card-title">{{ plans.name(s.planId) }}</h3><div class="row-sm"><app-status-badge [status]="s.status" /><span class="text-sm text-muted">Access</span><app-status-badge [status]="accessState()" /></div></div>
                  <div class="kv-grid">
                    <div class="kv-item"><div class="k">Cycle</div><div class="v">{{ s.startDate | date: 'd MMM' }} – {{ s.endDate | date: 'd MMM y' }}</div></div>
                    <div class="kv-item"><div class="k">Price</div><div class="v">{{ s.price | inr }}</div></div>
                    <div class="kv-item"><div class="k">Credits</div><div class="v">{{ s.creditsTotal - s.creditsUsed | inr }} left</div></div>
                    <div class="kv-item"><div class="k">Room hours</div><div class="v">{{ s.roomHoursTotal - s.roomHoursUsed }} left</div></div>
                    <div class="kv-item"><div class="k">Guest passes</div><div class="v">{{ s.guestPassesTotal - s.guestPassesUsed }} left</div></div>
                    <div class="kv-item"><div class="k">Deposit</div><div class="v">{{ s.securityDeposit | inr }}</div></div>
                  </div>
                  <a class="btn btn-secondary btn-sm mt-4" routerLink="/admin/membership/subscriptions">Manage in Subscriptions</a>
                </section>
              } @else {
                <div class="card"><app-empty-state icon="membership" title="No membership" message="Assign a plan to activate access and credits."><a class="btn btn-primary btn-sm" [routerLink]="['/admin/members', m.id, 'edit']" [queryParams]="{ step: 'plan' }">Assign plan</a></app-empty-state></div>
              }
            }
            @case ('bookings') {
              <app-data-table [rows]="bookings()" [columns]="bookingCols" [defaultSort]="{ key: 'date', dir: 'desc' }" emptyTitle="No bookings found." [rowClickable]="true" (rowClick)="router.navigate(['/admin/bookings', $event.id])" caption="Member bookings" />
            }
            @case ('payments') {
              <app-data-table [rows]="payments()" [columns]="paymentCols" [defaultSort]="{ key: 'date', dir: 'desc' }" emptyTitle="No payments found." caption="Member payments" />
            }
            @case ('visitors') {
              <app-data-table [rows]="visitors()" [columns]="visitorCols" [defaultSort]="{ key: 'visitDate', dir: 'desc' }" emptyTitle="No visitors found." caption="Member visitors" />
            }
            @case ('tickets') {
              <app-data-table [rows]="tickets()" [columns]="ticketCols" emptyTitle="No tickets" [rowClickable]="true" (rowClick)="router.navigate(['/admin/support', $event.id])" caption="Member tickets" />
            }
            @case ('access') {
              <app-data-table [rows]="accessLogs()" [columns]="logCols" emptyTitle="No access logs" caption="Access logs" />
            }
            @case ('activity') {
              <section class="card card-body"><app-timeline [items]="activity()" /></section>
            }
          }
        </div>
      } @else {
        <div class="card"><app-empty-state icon="users" title="Member not found"><a class="btn btn-secondary" routerLink="/admin/members">Back to members</a></app-empty-state></div>
      }
    </div>
  `,
})
export class MemberAdminDetailComponent {
  readonly id = input.required<string>();
  private readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  private readonly users = inject(UserService);
  protected readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  protected readonly plans = inject(PlanService);
  private readonly subs = inject(SubscriptionService);
  private readonly bookingSvc = inject(BookingService);
  private readonly paymentSvc = inject(PaymentService);
  private readonly visitorSvc = inject(VisitorService);
  private readonly ticketSvc = inject(TicketService);
  private readonly logSvc = inject(AccessLogService);
  private readonly acct = inject(MemberAccountService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  protected readonly tab = signal('profile');
  protected readonly member = computed(() => this.members.find(this.id()));
  protected readonly company = computed(() => this.companies.find(this.member()?.companyId));
  protected readonly sub = computed(() => {
    this.subs.items();
    return this.subs.forMember(this.id());
  });
  protected readonly accessState = computed(() => accessStateFor(this.sub()));
  protected readonly hasLogin = computed(() => this.users.items().some((u) => u.memberId === this.id()));
  protected readonly bookings = computed(() => this.bookingSvc.forMember(this.id()));
  protected readonly payments = computed(() => this.paymentSvc.forMember(this.id()));
  protected readonly visitors = computed(() => this.visitorSvc.items().filter((v) => v.hostMemberId === this.id()));
  protected readonly tickets = computed(() => this.ticketSvc.items().filter((t) => t.memberId === this.id()));
  protected readonly accessLogs = computed(() => this.logSvc.items().filter((l) => l.personId === this.id()));
  protected readonly paid = computed(() => this.payments().filter((p) => p.status === 'SUCCESS').reduce((a, p) => a + p.amount, 0));
  protected readonly openTickets = computed(() => this.tickets().filter((t) => t.status !== 'RESOLVED').length);
  protected readonly tabs = computed(() => [
    { id: 'profile', label: 'Profile' },
    { id: 'company', label: 'Company' },
    { id: 'membership', label: 'Membership' },
    { id: 'bookings', label: 'Bookings', count: this.bookings().length },
    { id: 'payments', label: 'Payments', count: this.payments().length },
    { id: 'visitors', label: 'Visitors', count: this.visitors().length },
    { id: 'tickets', label: 'Tickets', count: this.tickets().length },
    { id: 'access', label: 'Access Logs', count: this.accessLogs().length },
    { id: 'activity', label: 'Activity' },
  ]);
  protected readonly activity = computed<TimelineEntry[]>(() => {
    const items: TimelineEntry[] = [];
    const m = this.member();
    if (!m) return items;
    items.push({ id: 'a0', title: 'Member account created', at: m.createdAt, tone: 'info', icon: 'user-plus' });
    this.bookings().slice(-5).forEach((b) => items.push({ id: 'b' + b.id, title: `Booking ${b.status.toLowerCase()}`, description: `${this.resources.name(b.resourceId)} · ${b.date}`, at: b.createdAt, tone: 'primary', icon: 'calendar' }));
    this.payments().slice(0, 5).forEach((p) => items.push({ id: 'p' + p.id, title: `Payment ${p.status.toLowerCase()}`, description: `${p.description} · ₹${p.amount.toLocaleString('en-IN')}`, at: p.date, tone: p.status === 'SUCCESS' ? 'success' : 'danger', icon: 'credit-card' }));
    this.tickets().slice(0, 3).forEach((t) => items.push({ id: 't' + t.id, title: `Ticket ${t.id}`, description: t.subject, at: t.createdAt, tone: 'warning', icon: 'support' }));
    return items.sort((a, b) => b.at.localeCompare(a.at));
  });

  protected readonly bookingCols: Column<Booking>[] = [
    { key: 'id', label: 'Booking ID', primary: true },
    { key: 'resource', label: 'Resource', value: (b) => this.resources.name(b.resourceId) },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'time', label: 'Time', value: (b) => `${b.startTime}–${b.endTime}` },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly paymentCols: Column<Payment>[] = [
    { key: 'id', label: 'Payment ID', primary: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'type', label: 'Type', value: (p) => PAYMENT_TYPE_LABELS[p.type] },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'method', label: 'Method' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly visitorCols: Column<Visitor>[] = [
    { key: 'name', label: 'Visitor', primary: true },
    { key: 'visitDate', label: 'Date', type: 'date' },
    { key: 'visitTime', label: 'Time' },
    { key: 'purpose', label: 'Purpose', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly ticketCols: Column<Ticket>[] = [
    { key: 'id', label: 'Ticket', primary: true },
    { key: 'subject', label: 'Subject' },
    { key: 'category', label: 'Category', hideMobile: true },
    { key: 'createdAt', label: 'Created', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly logCols: Column<AccessLog>[] = [
    { key: 'at', label: 'Date & time', type: 'datetime' },
    { key: 'door', label: 'Door' },
    { key: 'direction', label: 'Direction', type: 'status' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'reason', label: 'Reason', hideMobile: true },
  ];

  protected async setStatus(m: Member, status: Member['status']): Promise<void> {
    const ok = await this.confirm.confirm({
      title: status === 'SUSPENDED' ? `Suspend ${m.firstName}?` : `Activate ${m.firstName}?`,
      message: status === 'SUSPENDED' ? 'Door access and bookings will be blocked until the member is reactivated.' : 'The member’s access will be restored.',
      confirmText: status === 'SUSPENDED' ? 'Suspend member' : 'Activate member',
      tone: status === 'SUSPENDED' ? 'danger' : 'primary',
    });
    if (!ok) return;
    this.members.updateSync(m.id, { status });
    const s = this.sub();
    if (s && ['ACTIVE', 'SUSPENDED', 'OVERDUE'].includes(s.status)) this.acct.setStatus(s.id, status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
    this.audit.record('STATUS_CHANGE', 'Members', 'Member', m.id, `${status === 'SUSPENDED' ? 'Suspended' : 'Activated'} ${m.firstName} ${m.lastName}`);
    this.toast.success(status === 'SUSPENDED' ? 'Member suspended' : 'Member activated');
  }

  protected async resetPassword(m: Member): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Send password reset?', message: `A reset link and OTP will be sent to ${m.email} and ${m.mobile}.`, confirmText: 'Send reset' });
    if (!ok) return;
    this.audit.record('UPDATE', 'Members', 'Member', m.id, 'Password reset link sent');
    this.toast.success('Reset link sent', m.email);
  }
}

@Component({
  selector: 'app-companies',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Companies" subtitle="Organisations with members at Officera." [breadcrumbs]="[{ label: 'Members' }, { label: 'Companies' }]">
        @if (auth.can('members.create')) {
          <button type="button" class="btn btn-primary" (click)="open()"><app-icon name="plus" [size]="16" /> Add company</button>
        }
      </app-page-header>
      <app-data-table [rows]="companies.scoped()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" searchPlaceholder="Search company or GSTIN" emptyTitle="No companies" emptyIcon="briefcase" [rowClickable]="true" (rowClick)="selected.set($event)" caption="Companies" />
    </div>
    <app-drawer [open]="!!selected()" [title]="selected()?.name ?? ''" [subtitle]="selected()?.gstin ?? ''" (closed)="selected.set(null)">
      @if (selected(); as c) {
        <dl class="kv">
          <dt>Industry</dt><dd>{{ c.industry || '—' }}</dd>
          <dt>Size</dt><dd>{{ c.size }}</dd>
          <dt>State</dt><dd>{{ c.state }}</dd>
          <dt>Billing address</dt><dd>{{ c.billingAddress }}</dd>
          <dt>Home centre</dt><dd>{{ locations.name(c.locationId) }}</dd>
          <dt>Website</dt><dd>{{ c.website || '—' }}</dd>
        </dl>
        <h4 class="section-title mt-5">Members</h4>
        <ul class="list-plain">
          @for (m of membersOf(c); track m.id) {
            <li class="list-row"><a [routerLink]="['/admin/members', m.id]">{{ m.firstName }} {{ m.lastName }}</a><app-status-badge [status]="m.status" /></li>
          } @empty {
            <li class="text-muted text-sm">No members yet.</li>
          }
        </ul>
      }
      <div footer><button type="button" class="btn btn-primary" (click)="open(selected()!)">Edit company</button></div>
    </app-drawer>
    <app-modal [open]="formOpen()" [title]="editing() ? 'Edit company' : 'Add company'" (closed)="formOpen.set(false)">
      <form id="co-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
        <div class="field span-2"><label class="label" for="con">Company name <span class="req">*</span></label><input id="con" class="input" formControlName="name" /><app-field-error [control]="form.controls.name" label="Company name" /></div>
        <div class="field"><label class="label" for="cog">GSTIN</label><input id="cog" class="input" formControlName="gstin" style="text-transform: uppercase" /><app-field-error [control]="form.controls.gstin" label="GSTIN" /></div>
        <div class="field"><label class="label" for="cos">State <span class="req">*</span></label><input id="cos" class="input" formControlName="state" /></div>
        <div class="field"><label class="label" for="coi">Industry</label><input id="coi" class="input" formControlName="industry" /></div>
        <div class="field"><label class="label" for="cosz">Size</label><select id="cosz" class="select" formControlName="size"><option>1–10</option><option>11–50</option><option>51–200</option><option>200+</option></select></div>
        <div class="field span-2"><label class="label" for="coa">Billing address <span class="req">*</span></label><textarea id="coa" class="textarea" rows="2" formControlName="billingAddress"></textarea><app-field-error [control]="form.controls.billingAddress" label="Billing address" /></div>
        <div class="field span-2"><label class="label" for="col">Home centre</label><select id="col" class="select" formControlName="locationId">@for (l of locations.scoped(); track l.id) {<option [value]="l.id">{{ l.name }}</option>}</select></div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancel</button>
        <button type="submit" form="co-form" class="btn btn-primary" [disabled]="form.invalid">Save</button>
      </div>
    </app-modal>
  `,
})
export class CompaniesComponent {
  protected readonly companies = inject(CompanyService);
  private readonly members = inject(MemberService);
  protected readonly locations = inject(LocationService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.companies.listScoped());
  protected readonly selected = signal<Company | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Company | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    gstin: ['', Validators.pattern(/^\d{2}[A-Za-z]{5}\d{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/)],
    state: ['', Validators.required],
    industry: [''],
    size: ['1–10'],
    billingAddress: ['', Validators.required],
    locationId: [''],
  });
  protected readonly cols: Column<Company>[] = [
    { key: 'name', label: 'Company', primary: true },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'industry', label: 'Industry', hideMobile: true },
    { key: 'state', label: 'State', hideMobile: true },
    { key: 'members', label: 'Members', type: 'number', value: (c) => this.membersOf(c).length },
    { key: 'location', label: 'Centre', value: (c) => this.locations.shortName(c.locationId) },
  ];
  protected membersOf(c: Company): Member[] {
    return this.members.items().filter((m) => m.companyId === c.id);
  }
  protected open(c?: Company): void {
    this.editing.set(c ?? null);
    this.form.reset(c ? { ...c } : { name: '', gstin: '', state: '', industry: '', size: '1–10', billingAddress: '', locationId: this.locations.scoped()[0]?.id ?? '' });
    this.formOpen.set(true);
  }
  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = { ...this.form.getRawValue(), gstin: this.form.controls.gstin.value.toUpperCase() };
    if (this.editing()) {
      const c = this.companies.updateSync(this.editing()!.id, v);
      this.selected.set(c);
    } else this.companies.createSync({ ...v, website: '' });
    this.audit.record(this.editing() ? 'UPDATE' : 'CREATE', 'Members', 'Company', v.name, `${this.editing() ? 'Updated' : 'Created'} company ${v.name}`);
    this.formOpen.set(false);
    this.toast.success('Company saved', v.name);
  }
}

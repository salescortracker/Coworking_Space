import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Column, ExportColumn, SHARED, createLoader, downloadCsv, monthKey, monthLabel, printAsPdf, todayIso, todayStamp } from '../../../shared';
import { CreditNote, Invoice, PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, Payment, Refund } from '../../../core/models';
import { CreditNoteService, InvoiceService, PaymentService, RefundService } from '../../../core/services/data/transaction-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { SubscriptionService } from '../../../core/services/data/membership-data.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { NotificationCenterService } from '../../../core/services/notification.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';
import { IntegrationService } from '../../../core/services/integration.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ReportService } from '../../../core/services/report.service';

const PAY_EXPORT: (m: MemberService, l: LocationService) => ExportColumn<Payment>[] = (m, l) => [
  { label: 'Payment ID', value: (p) => p.id },
  { label: 'Date', value: (p) => p.date.slice(0, 10) },
  { label: 'Member', value: (p) => m.fullName(p.memberId) },
  { label: 'Location', value: (p) => l.name(p.locationId) },
  { label: 'Type', value: (p) => PAYMENT_TYPE_LABELS[p.type] },
  { label: 'Amount', value: (p) => p.amount },
  { label: 'Method', value: (p) => PAYMENT_METHOD_LABELS[p.method] },
  { label: 'Status', value: (p) => p.status },
  { label: 'Invoice', value: (p) => p.invoiceId ?? '' },
  { label: 'Gateway ref', value: (p) => p.gatewayRef },
];

/** Finance overview (§25 dashboard): revenue, paid, pending, failed, refunded, outstanding. */
@Component({
  selector: 'app-finance-overview',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Finance" [subtitle]="'Collections and receivables for ' + ctx.label() + '.'" [breadcrumbs]="[{ label: 'Finance' }, { label: 'Overview' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        <button type="button" class="btn btn-secondary" (click)="pdf()"><app-icon name="printer" [size]="16" /> PDF</button>
      </app-page-header>
      @if (loader.status() === 'loading') {
        <app-loading-state variant="stats" [rows]="6" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else {
        <div class="stat-grid">
          <app-stat-card label="Revenue (this month)" [value]="stats().revenue | compactInr" icon="trending-up" [trend]="reports.revenueTrend()" link="/admin/reports/revenue" />
          <app-stat-card label="Paid" [value]="stats().paid | compactInr" icon="check-circle" tone="success" [hint]="stats().paidCount + ' payments'" link="/admin/finance/payments" [query]="{ status: 'SUCCESS' }" />
          <app-stat-card label="Pending" [value]="stats().pending | compactInr" icon="clock" tone="warning" [hint]="stats().pendingCount + ' payments'" link="/admin/finance/payments" [query]="{ status: 'PENDING' }" />
          <app-stat-card label="Failed" [value]="stats().failed | compactInr" icon="x-circle" tone="danger" [hint]="stats().failedCount + ' payments'" link="/admin/finance/payments" [query]="{ status: 'FAILED' }" />
          <app-stat-card label="Refunded" [value]="stats().refunded | compactInr" icon="refund" tone="info" link="/admin/finance/refunds" />
          <app-stat-card label="Outstanding" [value]="stats().outstanding | compactInr" icon="alert" tone="danger" [hint]="stats().outstandingCount + ' invoices'" link="/admin/finance/dues" />
        </div>
        <div class="grid grid-2 mt-5">
          <app-chart-card title="Revenue trend" subtitle="Successful collections, last 6 months">
            <app-bar-chart [labels]="trend().labels" [series]="trend().series" prefix="₹" ariaLabel="Revenue by month" />
          </app-chart-card>
          <app-chart-card title="Payment methods" subtitle="Share of successful payments">
            <app-donut-chart [data]="methods()" centerLabel="Payments" ariaLabel="Payment methods" />
          </app-chart-card>
        </div>
        <section class="card mt-5">
          <div class="card-header"><h2 class="card-title">Recent payments</h2><a routerLink="/admin/finance/payments" class="btn btn-ghost btn-sm">View all</a></div>
          <app-data-table [rows]="recent()" [columns]="cols" [searchable]="false" [paginate]="false" caption="Recent payments" />
        </section>
      }
    </div>
  `,
})
export class FinanceOverviewComponent {
  private readonly payments = inject(PaymentService);
  private readonly invoices = inject(InvoiceService);
  private readonly refunds = inject(RefundService);
  private readonly members = inject(MemberService);
  private readonly locations = inject(LocationService);
  protected readonly ctx = inject(LocationContextService);
  private readonly toast = inject(ToastService);
  protected readonly reports = inject(ReportService);
  protected readonly loader = createLoader(() => this.payments.listScoped());

  protected readonly stats = computed(() => {
    const p = this.payments.scoped();
    const month = todayIso().slice(0, 7);
    const sum = (list: Payment[]) => list.reduce((a, x) => a + x.amount, 0);
    const ok = p.filter((x) => x.status === 'SUCCESS');
    const pend = p.filter((x) => x.status === 'PENDING');
    const fail = p.filter((x) => x.status === 'FAILED');
    const outstanding = this.invoices.scoped().filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE');
    return {
      revenue: sum(ok.filter((x) => x.date.slice(0, 7) === month)),
      paid: sum(ok),
      paidCount: ok.length,
      pending: sum(pend),
      pendingCount: pend.length,
      failed: sum(fail),
      failedCount: fail.length,
      refunded: this.refunds.scoped().reduce((a, r) => a + r.amount, 0),
      outstanding: outstanding.reduce((a, i) => a + i.total - i.amountPaid, 0),
      outstandingCount: outstanding.length,
    };
  });

  protected readonly trend = computed(() => {
    const months: string[] = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) months.push(new Date(d.getFullYear(), d.getMonth() - i, 15).toISOString().slice(0, 7));
    const ok = this.payments.scoped().filter((p) => p.status === 'SUCCESS');
    const data = months.map((m) => Math.round(ok.filter((p) => monthKey(p.date) === m).reduce((a, p) => a + p.amount, 0)));
    return { labels: months.map(monthLabel), series: [{ name: 'Revenue', data }] };
  });

  protected readonly methods = computed(() => {
    const ok = this.payments.scoped().filter((p) => p.status === 'SUCCESS');
    return (['UPI', 'CARD', 'NET_BANKING', 'CREDITS'] as const).map((m) => ({ label: PAYMENT_METHOD_LABELS[m], value: ok.filter((p) => p.method === m).length })).filter((x) => x.value);
  });

  protected readonly recent = computed(() => [...this.payments.scoped()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6));
  protected readonly cols: Column<Payment>[] = [
    { key: 'id', label: 'Payment ID', primary: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'member', label: 'Member', value: (p) => this.members.fullName(p.memberId) },
    { key: 'type', label: 'Type', value: (p) => PAYMENT_TYPE_LABELS[p.type], hideMobile: true },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected csv(): void {
    downloadCsv(`finance-payments-${todayStamp()}`, this.payments.scoped(), PAY_EXPORT(this.members, this.locations));
    this.toast.success('CSV exported');
  }
  protected pdf(): void {
    printAsPdf();
  }
}

@Component({
  selector: 'app-finance-payments',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Payments" subtitle="All gateway and manual payments." [breadcrumbs]="[{ label: 'Finance', link: '/admin/finance' }, { label: 'Payments' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        <button type="button" class="btn btn-secondary" (click)="pdf()"><app-icon name="printer" [size]="16" /> PDF</button>
      </app-page-header>
      <app-data-table
        [rows]="filtered()"
        [columns]="cols"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!status() || !!type() || !!method() || !!from()"
        (clearFilters)="status.set(''); type.set(''); method.set(''); from.set('')"
        [defaultSort]="{ key: 'date', dir: 'desc' }"
        searchPlaceholder="Search payment ID, member or reference"
        emptyTitle="No payments found."
        emptyIcon="credit-card"
        [rowClickable]="true"
        (rowClick)="selected.set($event)"
        caption="Payments"
      >
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of ['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED']; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <select class="select" aria-label="Type" [ngModel]="type()" (ngModelChange)="type.set($event)">
            <option value="">All types</option>
            @for (t of typeKeys; track t) {
              <option [value]="t">{{ typeLabels[t] }}</option>
            }
          </select>
          <select class="select" aria-label="Method" [ngModel]="method()" (ngModelChange)="method.set($event)">
            <option value="">All methods</option>
            @for (m of ['UPI', 'CARD', 'NET_BANKING', 'CREDITS']; track m) {
              <option [value]="m">{{ m | humanize }}</option>
            }
          </select>
          <input class="input" type="date" aria-label="From date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
        </ng-container>
        <ng-template appCell="invoice" let-row>
          @if (row.invoiceId) {
            <a [routerLink]="['/admin/finance/invoices', row.invoiceId]" (click)="$event.stopPropagation()">View</a>
          } @else {
            <span class="text-muted">—</span>
          }
        </ng-template>
        <ng-template appCell="actions" let-row>
          @if (row.status === 'PENDING' && auth.can('payments.create')) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="markReceived(row)">Mark received</button>
          }
          @if (row.status === 'SUCCESS' && auth.can('refunds.approve')) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="refund(row)">Refund</button>
          }
        </ng-template>
      </app-data-table>
    </div>
    <app-drawer [open]="!!selected()" [title]="selected()?.id ?? ''" [subtitle]="selected()?.description ?? ''" (closed)="selected.set(null)">
      @if (selected(); as p) {
        <dl class="kv">
          <dt>Member</dt><dd><a [routerLink]="['/admin/members', p.memberId]">{{ members.fullName(p.memberId) }}</a></dd>
          <dt>Date</dt><dd>{{ p.date | date: 'd MMM y, h:mm a' }}</dd>
          <dt>Type</dt><dd>{{ typeLabels[p.type] }}</dd>
          <dt>Amount</dt><dd>{{ p.amount | inr }}</dd>
          <dt>Method</dt><dd>{{ methodLabels[p.method] }}</dd>
          <dt>Status</dt><dd><app-status-badge [status]="p.status" /></dd>
          <dt>Gateway ref</dt><dd class="mono">{{ p.gatewayRef }}</dd>
          <dt>Retries</dt><dd>{{ p.retryCount }}</dd>
          @if (p.failureReason) {
            <dt>Failure</dt><dd class="text-danger">{{ p.failureReason }}</dd>
          }
          <dt>Location</dt><dd>{{ locations.name(p.locationId) }}</dd>
        </dl>
      }
      <div footer>
        @if (selected()?.invoiceId) {
          <a class="btn btn-primary" [routerLink]="['/admin/finance/invoices', selected()!.invoiceId]">View invoice</a>
        }
      </div>
    </app-drawer>
  `,
})
export class FinancePaymentsComponent {
  private readonly payments = inject(PaymentService);
  private readonly refunds = inject(RefundService);
  protected readonly members = inject(MemberService);
  protected readonly locations = inject(LocationService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.payments.listScoped());
  protected readonly typeLabels = PAYMENT_TYPE_LABELS;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly typeKeys = Object.keys(PAYMENT_TYPE_LABELS) as (keyof typeof PAYMENT_TYPE_LABELS)[];
  protected readonly status = signal(typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('status') ?? '' : '');
  protected readonly type = signal('');
  protected readonly method = signal('');
  protected readonly from = signal('');
  protected readonly selected = signal<Payment | null>(null);
  protected readonly filtered = computed(() =>
    this.payments.scoped().filter((p) => (!this.status() || p.status === this.status()) && (!this.type() || p.type === this.type()) && (!this.method() || p.method === this.method()) && (!this.from() || p.date.slice(0, 10) >= this.from())),
  );
  protected readonly cols: Column<Payment>[] = [
    { key: 'id', label: 'Payment ID', primary: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'member', label: 'Member', value: (p) => this.members.fullName(p.memberId) },
    { key: 'type', label: 'Type', value: (p) => PAYMENT_TYPE_LABELS[p.type] },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'method', label: 'Method', value: (p) => PAYMENT_METHOD_LABELS[p.method], hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'invoice', label: 'Invoice', sortable: false, hideMobile: true },
  ];

  protected markReceived(p: Payment): void {
    this.payments.updateSync(p.id, { status: 'SUCCESS' });
    this.audit.record('UPDATE', 'Finance', 'Payment', p.id, 'Marked pending payment as received');
    this.toast.success('Payment marked as received', p.id);
  }

  protected async refund(p: Payment): Promise<void> {
    const reason = await this.confirm.prompt({ title: `Refund ${p.id}?`, message: `Raise a refund request for ₹${p.amount.toLocaleString('en-IN')}. It goes to the Refunds queue for approval.`, confirmText: 'Raise refund', tone: 'warning', input: { label: 'Reason', required: true } });
    if (reason === null) return;
    this.refunds.createSync({ paymentId: p.id, memberId: p.memberId, locationId: p.locationId, amount: p.amount, reason, status: 'REQUESTED', requestedAt: new Date().toISOString() });
    this.audit.record('CREATE', 'Finance', 'Refund', p.id, `Refund requested: ${reason}`);
    this.toast.success('Refund requested', 'See Finance → Refunds.');
  }

  protected csv(): void {
    downloadCsv(`payments-${todayStamp()}`, this.filtered(), PAY_EXPORT(this.members, this.locations));
    this.audit.record('EXPORT', 'Finance', 'Payments', 'CSV', `Exported ${this.filtered().length} payments`);
    this.toast.success('CSV exported');
  }
  protected pdf(): void {
    printAsPdf();
  }
}

@Component({
  selector: 'app-finance-invoices',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Invoices" subtitle="GST tax invoices (SAC 997212)." [breadcrumbs]="[{ label: 'Finance', link: '/admin/finance' }, { label: 'Invoices' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        <button type="button" class="btn btn-secondary" (click)="pdf()"><app-icon name="printer" [size]="16" /> PDF</button>
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Invoiced" [value]="totals().total | compactInr" icon="receipt" />
        <app-stat-card label="Taxable value" [value]="totals().subtotal | compactInr" icon="file-text" tone="info" />
        <app-stat-card label="GST collected" [value]="totals().tax | compactInr" icon="percent" tone="warning" [hint]="'CGST+SGST ' + (totals().cs | compactInr) + ' · IGST ' + (totals().igst | compactInr)" />
        <app-stat-card label="Unpaid" [value]="totals().unpaid | compactInr" icon="alert" tone="danger" />
      </div>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!status() || !!supply()" (clearFilters)="status.set(''); supply.set('')" [defaultSort]="{ key: 'date', dir: 'desc' }" searchPlaceholder="Search invoice number, customer or GSTIN" emptyTitle="No invoices found" emptyIcon="receipt" [rowClickable]="true" (rowClick)="router.navigate(['/admin/finance/invoices', $event.id])" caption="Invoices">
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of ['PAID', 'UNPAID', 'OVERDUE', 'CANCELLED']; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <select class="select" aria-label="Supply type" [ngModel]="supply()" (ngModelChange)="supply.set($event)">
            <option value="">Intra & inter-state</option>
            <option value="intra">Intra-state (CGST+SGST)</option>
            <option value="inter">Inter-state (IGST)</option>
          </select>
        </ng-container>
        <ng-template appCell="actions" let-row>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/finance/invoices', row.id]" aria-label="View"><app-icon name="eye" [size]="16" /></a>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/finance/invoices', row.id]" [queryParams]="{ print: 1 }" aria-label="Download PDF"><app-icon name="download" [size]="16" /></a>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class FinanceInvoicesComponent {
  private readonly invoices = inject(InvoiceService);
  protected readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.invoices.listScoped());
  protected readonly status = signal('');
  protected readonly supply = signal('');
  protected readonly filtered = computed(() => this.invoices.scoped().filter((i) => (!this.status() || i.status === this.status()) && (!this.supply() || (this.supply() === 'intra') === i.intraState)));
  protected readonly totals = computed(() => {
    const l = this.filtered();
    const sum = (f: (i: Invoice) => number) => l.reduce((a, i) => a + f(i), 0);
    return { total: sum((i) => i.total), subtotal: sum((i) => i.subtotal), tax: sum((i) => i.tax), cs: sum((i) => i.cgst + i.sgst), igst: sum((i) => i.igst), unpaid: sum((i) => (i.status === 'PAID' ? 0 : i.total - i.amountPaid)) };
  });
  protected readonly cols: Column<Invoice>[] = [
    { key: 'number', label: 'Invoice No.', primary: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'customer', label: 'Customer', value: (i) => i.companyName ?? i.customerName },
    { key: 'customerGstin', label: 'GSTIN', hideMobile: true },
    { key: 'subtotal', label: 'Taxable', type: 'currency', hideMobile: true },
    { key: 'tax', label: 'GST', type: 'currency', hideMobile: true },
    { key: 'total', label: 'Total', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected csv(): void {
    downloadCsv(`invoices-${todayStamp()}`, this.filtered(), [
      { label: 'Invoice No', value: (i) => i.number },
      { label: 'Date', value: (i) => i.date },
      { label: 'Customer', value: (i) => i.companyName ?? i.customerName },
      { label: 'GSTIN', value: (i) => i.customerGstin ?? '' },
      { label: 'Place of supply', value: (i) => i.placeOfSupply },
      { label: 'SAC', value: () => '997212' },
      { label: 'Taxable', value: (i) => i.subtotal },
      { label: 'CGST', value: (i) => i.cgst },
      { label: 'SGST', value: (i) => i.sgst },
      { label: 'IGST', value: (i) => i.igst },
      { label: 'Total', value: (i) => i.total },
      { label: 'Status', value: (i) => i.status },
    ]);
    this.audit.record('EXPORT', 'Finance', 'Invoices', 'CSV', `Exported ${this.filtered().length} invoices`);
    this.toast.success('CSV exported');
  }
  protected pdf(): void {
    printAsPdf();
  }
}

@Component({
  selector: 'app-finance-refunds',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Refunds" subtitle="Approve and process refunds for cancellations and deposits." [breadcrumbs]="[{ label: 'Finance', link: '/admin/finance' }, { label: 'Refunds' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
      </app-page-header>
      <div class="stat-grid mb-5">
        @for (s of ['REQUESTED', 'APPROVED', 'PROCESSED', 'REJECTED']; track s) {
          <app-stat-card [label]="s | humanize" [value]="count(s)" icon="refund" [tone]="s === 'REQUESTED' ? 'warning' : s === 'REJECTED' ? 'danger' : s === 'PROCESSED' ? 'success' : 'info'" />
        }
      </div>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!status()" (clearFilters)="status.set('')" [defaultSort]="{ key: 'requestedAt', dir: 'desc' }" emptyTitle="No refunds" emptyIcon="refund" caption="Refunds">
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of ['REQUESTED', 'APPROVED', 'PROCESSED', 'REJECTED']; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
        </ng-container>
        <ng-template appCell="actions" let-row>
          @if (auth.can('refunds.approve')) {
            @if (row.status === 'REQUESTED') {
              <button type="button" class="btn btn-success btn-sm" (click)="set(row, 'APPROVED')">Approve</button>
              <button type="button" class="btn btn-ghost btn-sm text-danger" (click)="reject(row)">Reject</button>
            } @else if (row.status === 'APPROVED') {
              <button type="button" class="btn btn-primary btn-sm" (click)="set(row, 'PROCESSED')">Process</button>
            }
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class FinanceRefundsComponent {
  private readonly refunds = inject(RefundService);
  private readonly members = inject(MemberService);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  private readonly notify = inject(NotificationCenterService);
  protected readonly loader = createLoader(() => this.refunds.listScoped());
  protected readonly status = signal('');
  protected readonly filtered = computed(() => this.refunds.scoped().filter((r) => !this.status() || r.status === this.status()));
  protected count(s: string): number {
    return this.refunds.scoped().filter((r) => r.status === s).length;
  }
  protected readonly cols: Column<Refund>[] = [
    { key: 'id', label: 'Refund ID', primary: true },
    { key: 'member', label: 'Member', value: (r) => this.members.fullName(r.memberId) },
    { key: 'paymentId', label: 'Payment', hideMobile: true },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'reason', label: 'Reason', hideMobile: true },
    { key: 'requestedAt', label: 'Requested', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected async set(r: Refund, status: Refund['status']): Promise<void> {
    const ok = await this.confirm.confirm({ title: status === 'APPROVED' ? 'Approve refund?' : 'Process refund?', message: `₹${r.amount.toLocaleString('en-IN')} to ${this.members.fullName(r.memberId)}${status === 'PROCESSED' ? ' will be sent to the original payment method.' : '.'}`, confirmText: status === 'APPROVED' ? 'Approve' : 'Process refund' });
    if (!ok) return;
    this.refunds.updateSync(r.id, { status, processedAt: status === 'PROCESSED' ? new Date().toISOString() : r.processedAt });
    if (status === 'PROCESSED') this.notify.dispatch({ event: 'Refund Processed', audience: 'MEMBER', memberId: r.memberId, category: 'PAYMENT', title: 'Refund processed', message: `₹${r.amount.toLocaleString('en-IN')} has been refunded. It may take 5–7 working days to reflect.`, link: '/member/payments', locationId: r.locationId });
    this.audit.record('APPROVE', 'Finance', 'Refund', r.id, `Refund ${status.toLowerCase()}`);
    this.toast.success(`Refund ${status.toLowerCase()}`, r.id);
  }
  protected async reject(r: Refund): Promise<void> {
    const reason = await this.confirm.prompt({ title: 'Reject refund?', message: 'The member will be notified with your reason.', confirmText: 'Reject', tone: 'danger', input: { label: 'Reason', required: true } });
    if (reason === null) return;
    this.refunds.updateSync(r.id, { status: 'REJECTED', reason: `${r.reason} · Rejected: ${reason}` });
    this.audit.record('APPROVE', 'Finance', 'Refund', r.id, `Refund rejected: ${reason}`);
    this.toast.info('Refund rejected');
  }
  protected csv(): void {
    downloadCsv(`refunds-${todayStamp()}`, this.filtered(), [
      { label: 'Refund ID', value: (r) => r.id },
      { label: 'Member', value: (r) => this.members.fullName(r.memberId) },
      { label: 'Payment', value: (r) => r.paymentId },
      { label: 'Amount', value: (r) => r.amount },
      { label: 'Status', value: (r) => r.status },
      { label: 'Reason', value: (r) => r.reason },
    ]);
  }
}

@Component({
  selector: 'app-credit-notes',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Credit Notes" subtitle="GST credit notes issued against invoices." [breadcrumbs]="[{ label: 'Finance', link: '/admin/finance' }, { label: 'Credit Notes' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        @if (auth.can('invoices.create')) {
          <button type="button" class="btn btn-primary" (click)="open()"><app-icon name="plus" [size]="16" /> Issue credit note</button>
        }
      </app-page-header>
      <app-data-table [rows]="notes.scoped()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [defaultSort]="{ key: 'date', dir: 'desc' }" searchPlaceholder="Search credit note or invoice" emptyTitle="No credit notes" emptyIcon="file-text" caption="Credit notes">
        <ng-template appCell="invoice" let-row>
          <a [routerLink]="['/admin/finance/invoices', row.invoiceId]">{{ invoiceNumber(row.invoiceId) }}</a>
        </ng-template>
        <ng-template appCell="actions" let-row>
          @if (row.status === 'ISSUED' && auth.can('invoices.edit')) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="setStatus(row, 'APPLIED')">Mark applied</button>
            <button type="button" class="btn btn-ghost btn-sm text-danger" (click)="setStatus(row, 'VOID')">Void</button>
          }
        </ng-template>
      </app-data-table>
    </div>
    <app-modal [open]="formOpen()" title="Issue credit note" (closed)="formOpen.set(false)">
      <form id="cn-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
        <div class="field span-2">
          <label class="label" for="cni">Against invoice <span class="req">*</span></label>
          <select id="cni" class="select" formControlName="invoiceId">
            <option value="">Select invoice</option>
            @for (i of paidInvoices(); track i.id) {
              <option [value]="i.id">{{ i.number }} · {{ i.companyName ?? i.customerName }} · ₹{{ i.total }}</option>
            }
          </select>
          <app-field-error [control]="form.controls.invoiceId" label="Invoice" />
        </div>
        <div class="field">
          <label class="label" for="cna">Amount (₹) <span class="req">*</span></label>
          <input id="cna" class="input" type="number" min="1" formControlName="amount" />
          <app-field-error [control]="form.controls.amount" label="Amount" />
        </div>
        <div class="field">
          <label class="label" for="cnd">Date <span class="req">*</span></label>
          <input id="cnd" class="input" type="date" formControlName="date" />
        </div>
        <div class="field span-2">
          <label class="label" for="cnr">Reason <span class="req">*</span></label>
          <input id="cnr" class="input" formControlName="reason" />
          <app-field-error [control]="form.controls.reason" label="Reason" />
        </div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancel</button>
        <button type="submit" form="cn-form" class="btn btn-primary" [disabled]="form.invalid">Issue</button>
      </div>
    </app-modal>
  `,
})
export class CreditNotesComponent {
  protected readonly notes = inject(CreditNoteService);
  private readonly invoices = inject(InvoiceService);
  private readonly members = inject(MemberService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.notes.listScoped());
  protected readonly formOpen = signal(false);
  protected readonly paidInvoices = computed(() => this.invoices.scoped().filter((i) => i.status === 'PAID').slice(0, 80));
  protected readonly form = this.fb.nonNullable.group({ invoiceId: ['', Validators.required], amount: [0, [Validators.required, Validators.min(1)]], date: [todayIso(), Validators.required], reason: ['', Validators.required] });
  protected readonly cols: Column<CreditNote>[] = [
    { key: 'number', label: 'Credit note', primary: true },
    { key: 'invoice', label: 'Invoice', value: (c) => this.invoiceNumber(c.invoiceId) },
    { key: 'member', label: 'Member', value: (c) => this.members.fullName(c.memberId) },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'reason', label: 'Reason', hideMobile: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected invoiceNumber(id: string): string {
    return this.invoices.find(id)?.number ?? id;
  }
  protected open(): void {
    this.form.reset({ invoiceId: '', amount: 0, date: todayIso(), reason: '' });
    this.form.controls.invoiceId.valueChanges.subscribe((id) => {
      const inv = this.invoices.find(id);
      if (inv) this.form.controls.amount.setValue(inv.total, { emitEvent: false });
    });
    this.formOpen.set(true);
  }
  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const inv = this.invoices.find(v.invoiceId)!;
    if (v.amount > inv.total) {
      this.form.controls.amount.setErrors({ server: 'Amount cannot exceed the invoice total.' });
      return;
    }
    const cn = this.notes.createSync({ number: `OFC/CN/${String(this.notes.items().length + 1).padStart(4, '0')}`, invoiceId: inv.id, memberId: inv.memberId, locationId: inv.locationId, amount: v.amount, reason: v.reason, date: v.date, status: 'ISSUED' });
    this.audit.record('CREATE', 'Finance', 'Credit Note', cn.id, `Issued ${cn.number} against ${inv.number}`);
    this.formOpen.set(false);
    this.toast.success('Credit note issued', cn.number);
  }
  protected setStatus(c: CreditNote, status: CreditNote['status']): void {
    this.notes.updateSync(c.id, { status });
    this.toast.success(`Credit note ${status.toLowerCase()}`);
  }
  protected csv(): void {
    downloadCsv(`credit-notes-${todayStamp()}`, this.notes.scoped(), [
      { label: 'Number', value: (c) => c.number },
      { label: 'Invoice', value: (c) => this.invoiceNumber(c.invoiceId) },
      { label: 'Amount', value: (c) => c.amount },
      { label: 'Date', value: (c) => c.date },
      { label: 'Status', value: (c) => c.status },
    ]);
  }
}

@Component({
  selector: 'app-outstanding-dues',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Outstanding Dues" subtitle="Unpaid and overdue invoices with recurring retry status." [breadcrumbs]="[{ label: 'Finance', link: '/admin/finance' }, { label: 'Outstanding Dues' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        <button type="button" class="btn btn-primary" (click)="remindAll()" [disabled]="!rows().length"><app-icon name="send" [size]="16" /> Send reminders</button>
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Total outstanding" [value]="total() | inr" icon="alert" tone="danger" />
        @for (b of buckets(); track b.label) {
          <app-stat-card [label]="b.label" [value]="b.amount | inr" icon="clock" [tone]="b.tone" [hint]="b.count + ' invoices'" />
        }
      </div>
      <app-data-table [rows]="rows()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [defaultSort]="{ key: 'age', dir: 'desc' }" searchPlaceholder="Search member or invoice" emptyTitle="No outstanding dues" emptyMessage="Every invoice is paid." emptyIcon="check-circle" caption="Outstanding dues">
        <ng-template appCell="actions" let-row>
          <button type="button" class="btn btn-ghost btn-sm" (click)="remind(row)"><app-icon name="send" [size]="14" /> Remind</button>
          @if (auth.can('dues.edit')) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="markPaid(row)">Record payment</button>
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class OutstandingDuesComponent {
  private readonly invoices = inject(InvoiceService);
  private readonly members = inject(MemberService);
  private readonly subs = inject(SubscriptionService);
  private readonly acct = inject(MemberAccountService);
  private readonly notify = inject(NotificationCenterService);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.invoices.listScoped());
  protected readonly rows = computed(() => this.invoices.scoped().filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE'));
  protected readonly total = computed(() => this.rows().reduce((a, i) => a + i.total - i.amountPaid, 0));
  private age(i: Invoice): number {
    return Math.max(0, Math.floor((Date.now() - new Date(i.dueDate + 'T12:00:00').getTime()) / 86400000));
  }
  protected readonly buckets = computed(() => {
    const b = [
      { label: '0–7 days', min: 0, max: 7, tone: 'warning' as const },
      { label: '8–30 days', min: 8, max: 30, tone: 'danger' as const },
      { label: '30+ days', min: 31, max: 9999, tone: 'danger' as const },
    ];
    return b.map((x) => {
      const list = this.rows().filter((i) => this.age(i) >= x.min && this.age(i) <= x.max);
      return { ...x, count: list.length, amount: list.reduce((a, i) => a + i.total - i.amountPaid, 0) };
    });
  });
  protected readonly cols: Column<Invoice>[] = [
    { key: 'number', label: 'Invoice', primary: true },
    { key: 'member', label: 'Member', value: (i) => this.members.fullName(i.memberId) },
    { key: 'company', label: 'Company', value: (i) => i.companyName ?? '—', hideMobile: true },
    { key: 'dueDate', label: 'Due date', type: 'date' },
    { key: 'age', label: 'Days overdue', type: 'number', value: (i) => this.age(i) },
    { key: 'retries', label: 'Retries', value: (i) => `${this.subs.forMember(i.memberId)?.paymentRetries ?? 0}/3`, hideMobile: true },
    { key: 'due', label: 'Amount due', type: 'currency', value: (i) => i.total - i.amountPaid },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected remind(i: Invoice): void {
    this.notify.dispatch({ event: 'Payment Reminder', audience: 'MEMBER', memberId: i.memberId, category: 'PAYMENT', title: 'Payment reminder', message: `Invoice ${i.number} of ₹${i.total.toLocaleString('en-IN')} is overdue. Pay now to avoid suspension.`, link: '/member/payments', locationId: i.locationId, channels: ['EMAIL', 'SMS'] });
    this.toast.success('Reminder sent', `${this.members.fullName(i.memberId)} · ${i.number}`);
  }
  protected remindAll(): void {
    this.rows().forEach((i) => this.notify.dispatch({ event: 'Payment Reminder', audience: 'MEMBER', memberId: i.memberId, category: 'PAYMENT', title: 'Payment reminder', message: `Invoice ${i.number} is overdue.`, locationId: i.locationId, channels: ['EMAIL', 'SMS'] }));
    this.audit.record('UPDATE', 'Finance', 'Dues', 'ALL', `Sent ${this.rows().length} payment reminders`);
    this.toast.success('Reminders sent', `${this.rows().length} members notified by email and SMS.`);
  }
  protected async markPaid(i: Invoice): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Record payment?', message: `Mark ${i.number} (₹${i.total.toLocaleString('en-IN')}) as paid. If the member’s plan is overdue or suspended it will be reactivated and access restored.`, confirmText: 'Record payment' });
    if (!ok) return;
    this.acct.settleDues(i.memberId, [i.id], 'MANUAL');
    this.audit.record('UPDATE', 'Finance', 'Invoice', i.id, 'Manual payment recorded; dues cleared');
    this.toast.success('Payment recorded', 'Subscription active and access restored.');
  }
  protected csv(): void {
    downloadCsv(`outstanding-dues-${todayStamp()}`, this.rows(), [
      { label: 'Invoice', value: (i) => i.number },
      { label: 'Member', value: (i) => this.members.fullName(i.memberId) },
      { label: 'Due date', value: (i) => i.dueDate },
      { label: 'Days overdue', value: (i) => this.age(i) },
      { label: 'Amount due', value: (i) => i.total - i.amountPaid },
    ]);
  }
}

@Component({
  selector: 'app-accounting-export',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header title="Accounting Export" subtitle="Export sales, receipts, refunds and credit notes for your accounting system." [breadcrumbs]="[{ label: 'Finance', link: '/admin/finance' }, { label: 'Accounting Export' }]" />
      <section class="card card-body mb-4 row-between row-wrap">
        <div>
          <div class="label">Connected accounting software</div>
          @if (accounting(); as a) {
            <div class="row-sm mt-1"><span class="fw-600">{{ integrations.activeLabel('ACCOUNTING') }}</span><app-status-badge [status]="a.status" /></div>
          } @else {
            <div class="text-muted mt-1">None active – use file export below.</div>
          }
        </div>
        <div class="btn-group">
          @if (auth.role() === 'SUPER_ADMIN') {
            <a class="btn btn-ghost btn-sm" routerLink="/admin/integrations/ACCOUNTING">Configure</a>
          }
          <button type="button" class="btn btn-secondary btn-sm" [disabled]="!integrations.isAvailable('ACCOUNTING') || syncing()" (click)="sync()" [appBusy]="syncing()" busyText="Syncing…">
            Sync now
          </button>
        </div>
      </section>
      <section class="card">
        <div class="card-body">
          <div class="form-grid">
            <div class="field"><label class="label" for="ef">From <span class="req">*</span></label><input id="ef" class="input" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" /></div>
            <div class="field"><label class="label" for="et">To <span class="req">*</span></label><input id="et" class="input" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" /></div>
            <div class="field span-2">
              <label class="label" for="efmt">Format</label>
              <select id="efmt" class="select" [ngModel]="format()" (ngModelChange)="format.set($event)">
                <option value="csv">Generic CSV</option>
                <option value="tally">Tally Prime (CSV vouchers)</option>
                <option value="zoho">Zoho Books (CSV)</option>
                <option value="pdf">PDF summary</option>
              </select>
            </div>
            <div class="field span-2">
              <span class="label">Include</span>
              <div class="chip-select">
                @for (s of sections; track s.id) {
                  <label><input type="checkbox" [checked]="include().includes(s.id)" (change)="toggle(s.id)" />{{ s.label }}</label>
                }
              </div>
            </div>
          </div>
          @if (from() > to()) {
            <div class="alert alert-danger mt-4"><app-icon name="alert" /><div class="alert-body">“From” must be before “To”.</div></div>
          }
          <div class="kv-grid mt-5">
            <div class="kv-item"><div class="k">Invoices</div><div class="v">{{ preview().invoices }}</div></div>
            <div class="kv-item"><div class="k">Receipts</div><div class="v">{{ preview().payments }}</div></div>
            <div class="kv-item"><div class="k">Refunds</div><div class="v">{{ preview().refunds }}</div></div>
            <div class="kv-item"><div class="k">Credit notes</div><div class="v">{{ preview().notes }}</div></div>
          </div>
        </div>
        <div class="card-footer">
          <span class="text-sm text-muted">Location scope: {{ ctx.label() }}</span>
          <button type="button" class="btn btn-primary" (click)="run()" [disabled]="from() > to() || !include().length || !auth.can('accounting.export')"><app-icon name="download" [size]="16" /> Export</button>
        </div>
      </section>
      <section class="card mt-5">
        <div class="card-header"><h2 class="card-title">Export history</h2></div>
        <ul class="list-plain card-body" style="padding-top: 4px; padding-bottom: 4px">
          @for (h of history(); track h.at) {
            <li class="list-row"><span><span class="fw-500 uppercase">{{ h.format }}</span> · {{ h.from }} → {{ h.to }} · {{ h.rows }} rows</span><span class="text-xs text-muted">{{ h.at | ago }}</span></li>
          } @empty {
            <li class="text-muted text-sm" style="padding: 12px 0">No exports yet.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class AccountingExportComponent {
  private readonly invoices = inject(InvoiceService);
  private readonly payments = inject(PaymentService);
  private readonly refunds = inject(RefundService);
  private readonly notes = inject(CreditNoteService);
  private readonly members = inject(MemberService);
  protected readonly ctx = inject(LocationContextService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly sections = [
    { id: 'invoices', label: 'Sales invoices' },
    { id: 'payments', label: 'Receipts' },
    { id: 'refunds', label: 'Refunds' },
    { id: 'notes', label: 'Credit notes' },
  ];
  protected readonly from = signal(todayIso().slice(0, 8) + '01');
  protected readonly to = signal(todayIso());
  protected readonly format = signal('csv');
  protected readonly include = signal(['invoices', 'payments', 'refunds', 'notes']);
  protected readonly history = signal<{ at: string; format: string; from: string; to: string; rows: number }[]>([]);
  protected readonly integrations = inject(IntegrationService);
  protected readonly accounting = computed(() => this.integrations.activeFor('ACCOUNTING'));
  protected readonly syncing = signal(false);
  private readonly spinner = inject(SpinnerService);

  /** Mock: production calls POST /api/accounting/sync, which pushes vouchers server-side. */
  protected sync(): void {
    if (this.syncing()) return; // ignore repeat clicks while running
    this.syncing.set(true);
    this.spinner.after(1200, () => {
      this.syncing.set(false);
      const p = this.preview();
      const label = this.integrations.activeLabel('ACCOUNTING');
      this.history.update((h) => [{ at: new Date().toISOString(), format: `sync → ${label}`, from: this.from(), to: this.to(), rows: p.invoices + p.payments + p.refunds + p.notes }, ...h]);
      this.audit.record('EXPORT', 'Finance', 'Accounting', 'SYNC', `Synced vouchers to ${label}`);
      this.toast.success('Sync complete', `${p.invoices + p.payments + p.refunds + p.notes} vouchers sent to ${label}.`);
    }, { message: 'Syncing with accounting software…' });
  }
  private inRange = (d: string) => d.slice(0, 10) >= this.from() && d.slice(0, 10) <= this.to();
  protected readonly preview = computed(() => ({
    invoices: this.invoices.scoped().filter((i) => this.inRange(i.date)).length,
    payments: this.payments.scoped().filter((p) => p.status === 'SUCCESS' && this.inRange(p.date)).length,
    refunds: this.refunds.scoped().filter((r) => this.inRange(r.requestedAt)).length,
    notes: this.notes.scoped().filter((n) => this.inRange(n.date)).length,
  }));
  protected toggle(id: string): void {
    this.include.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }
  protected run(): void {
    if (this.format() === 'pdf') {
      printAsPdf();
    } else {
      type Row = { voucher: string; date: string; number: string; party: string; ledger: string; debit: number; credit: number; gst: number };
      const rows: Row[] = [];
      const inc = this.include();
      if (inc.includes('invoices'))
        this.invoices.scoped().filter((i) => this.inRange(i.date)).forEach((i) => rows.push({ voucher: 'Sales', date: i.date, number: i.number, party: i.companyName ?? i.customerName, ledger: 'Coworking Services (997212)', debit: i.total, credit: 0, gst: i.tax }));
      if (inc.includes('payments'))
        this.payments.scoped().filter((p) => p.status === 'SUCCESS' && this.inRange(p.date)).forEach((p) => rows.push({ voucher: 'Receipt', date: p.date.slice(0, 10), number: p.id, party: this.members.fullName(p.memberId), ledger: `Bank – ${p.method}`, debit: 0, credit: p.amount, gst: 0 }));
      if (inc.includes('refunds'))
        this.refunds.scoped().filter((r) => this.inRange(r.requestedAt)).forEach((r) => rows.push({ voucher: 'Payment', date: r.requestedAt.slice(0, 10), number: r.id, party: this.members.fullName(r.memberId), ledger: 'Refunds', debit: r.amount, credit: 0, gst: 0 }));
      if (inc.includes('notes'))
        this.notes.scoped().filter((n) => this.inRange(n.date)).forEach((n) => rows.push({ voucher: 'Credit Note', date: n.date, number: n.number, party: this.members.fullName(n.memberId), ledger: 'Sales Returns', debit: 0, credit: n.amount, gst: 0 }));
      downloadCsv(`${this.format()}-export-${this.from()}-to-${this.to()}`, rows, [
        { label: this.format() === 'tally' ? 'Voucher Type' : 'Type', value: (r) => r.voucher },
        { label: 'Date', value: (r) => r.date },
        { label: this.format() === 'zoho' ? 'Reference#' : 'Voucher No', value: (r) => r.number },
        { label: 'Party', value: (r) => r.party },
        { label: 'Ledger', value: (r) => r.ledger },
        { label: 'Debit', value: (r) => r.debit },
        { label: 'Credit', value: (r) => r.credit },
        { label: 'GST', value: (r) => r.gst },
      ]);
      this.history.update((h) => [{ at: new Date().toISOString(), format: this.format(), from: this.from(), to: this.to(), rows: rows.length }, ...h]);
    }
    this.audit.record('EXPORT', 'Finance', 'Accounting', this.format(), `Accounting export ${this.from()} – ${this.to()}`);
    this.toast.success('Export ready', 'The file has been downloaded.');
  }
}

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader } from '../../../shared';
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, Payment, Refund } from '../../../core/models';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { PaymentService, RefundService } from '../../../core/services/data/transaction-data.service';
import { CheckoutService } from '../../../core/services/checkout.service';
import { ToastService } from '../../../core/services/ui.service';

interface SavedMethod {
  id: string;
  type: 'UPI' | 'CARD' | 'NET_BANKING';
  label: string;
  detail: string;
  primary: boolean;
}

@Component({
  selector: 'app-member-payments',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Payments" subtitle="Payment history, refunds and saved payment methods." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Payments' }]">
        <a class="btn btn-secondary" routerLink="/member/invoices"><app-icon name="receipt" [size]="16" /> Invoices</a>
      </app-page-header>

      @if (acct.outstandingAmount() > 0) {
        <div class="alert alert-danger mb-4">
          <app-icon name="alert" />
          <div class="alert-body">
            <div class="alert-title">Outstanding dues: {{ acct.outstandingAmount() | inr }}</div>
            {{ acct.outstandingInvoices().length }} unpaid invoice{{ acct.outstandingInvoices().length > 1 ? 's' : '' }}. Clear your dues to keep door access active.
            <div class="alert-actions"><button type="button" class="btn btn-danger btn-sm" (click)="payDues()">Pay now</button></div>
          </div>
        </div>
      }

      <div class="stat-grid mb-5">
        <app-stat-card label="Total Paid" [value]="stats().paid | inr" icon="check-circle" tone="success" [hint]="stats().paidCount + ' payments'" />
        <app-stat-card label="Pending" [value]="stats().pending | inr" icon="clock" tone="warning" [hint]="stats().pendingCount + ' payments'" />
        <app-stat-card label="Failed" [value]="stats().failed | inr" icon="x-circle" tone="danger" [hint]="stats().failedCount + ' payments'" />
        <app-stat-card label="Refunds" [value]="stats().refunds | inr" icon="refund" tone="info" [hint]="refunds().length + ' refunds'" />
      </div>

      <app-tabs [tabs]="tabs()" [(value)]="tab" label="Payment sections" />
      <div class="mt-4">
        @switch (tab()) {
          @case ('history') {
            <app-data-table
              [rows]="filtered()"
              [columns]="cols"
              [status]="loader.status()"
              (retry)="loader.load()"
              [hasFilters]="true"
              [filtersActive]="!!status() || !!type()"
              (clearFilters)="status.set(''); type.set('')"
              [defaultSort]="{ key: 'date', dir: 'desc' }"
              searchPlaceholder="Search payment ID or description"
              emptyTitle="No payments found."
              emptyIcon="credit-card"
              caption="Payment history"
            >
              <ng-container filters>
                <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
                  <option value="">All statuses</option>
                  <option value="SUCCESS">Success</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
                <select class="select" aria-label="Type" [ngModel]="type()" (ngModelChange)="type.set($event)">
                  <option value="">All types</option>
                  @for (t of typeKeys; track t) {
                    <option [value]="t">{{ typeLabels[t] }}</option>
                  }
                </select>
              </ng-container>
              <ng-template appCell="invoice" let-row>
                @if (row.invoiceId) {
                  <a [routerLink]="['/member/invoices', row.invoiceId]">View</a>
                } @else {
                  <span class="text-muted">—</span>
                }
              </ng-template>
              <ng-template appCell="actions" let-row>
                @if (row.status === 'FAILED') {
                  <button type="button" class="btn btn-secondary btn-sm" (click)="retry(row)"><app-icon name="refresh" [size]="14" /> Retry</button>
                } @else if (row.invoiceId) {
                  <a class="btn btn-ghost btn-sm" [routerLink]="['/member/invoices', row.invoiceId]"><app-icon name="download" [size]="14" /> Invoice</a>
                }
              </ng-template>
            </app-data-table>
          }
          @case ('refunds') {
            <app-data-table [rows]="refunds()" [columns]="refundCols" emptyTitle="No refunds" emptyIcon="refund" caption="Refunds" />
          }
          @case ('methods') {
            <div class="grid grid-3">
              @for (m of methods(); track m.id) {
                <article class="card card-body">
                  <div class="row-between">
                    <span class="stat-icon tone-primary"><app-icon [name]="m.type === 'CARD' ? 'credit-card' : m.type === 'UPI' ? 'zap' : 'building'" [size]="18" /></span>
                    @if (m.primary) {
                      <span class="badge badge-success">Default</span>
                    }
                  </div>
                  <div class="fw-600 mt-3">{{ m.label }}</div>
                  <div class="text-sm text-muted mono">{{ m.detail }}</div>
                  <div class="row-sm mt-4">
                    @if (!m.primary) {
                      <button type="button" class="btn btn-secondary btn-sm" (click)="makePrimary(m.id)">Make default</button>
                    }
                    <button type="button" class="btn btn-ghost btn-sm text-danger" (click)="removeMethod(m.id)">Remove</button>
                  </div>
                </article>
              }
              <button type="button" class="card card-body add-method" (click)="addOpen.set(true)">
                <app-icon name="plus" [size]="22" />
                <span class="fw-500">Add payment method</span>
                <span class="text-xs text-muted">UPI, card or net banking</span>
              </button>
            </div>
          }
        }
      </div>
    </div>

    <app-modal [open]="addOpen()" title="Add payment method" size="sm" (closed)="addOpen.set(false)">
      <div class="stack">
        <div class="segmented" role="radiogroup" aria-label="Method type">
          @for (t of methodTypes; track t) {
            <button type="button" [class.active]="newType() === t" (click)="newType.set(t)">{{ methodLabels[t] }}</button>
          }
        </div>
        <div class="field">
          <label class="label" for="nm">{{ newType() === 'UPI' ? 'UPI ID' : newType() === 'CARD' ? 'Last 4 digits of card' : 'Bank name' }} <span class="req">*</span></label>
          <input id="nm" class="input" [ngModel]="newDetail()" (ngModelChange)="newDetail.set($event)" [placeholder]="newType() === 'UPI' ? 'name@bank' : newType() === 'CARD' ? '4242' : 'HDFC Bank'" />
          @if (newDetail() && !validNew()) {
            <span class="field-error">{{ newType() === 'UPI' ? 'Enter a valid UPI ID.' : newType() === 'CARD' ? 'Enter exactly 4 digits.' : 'Enter a bank name.' }}</span>
          }
        </div>
      </div>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="addOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="!validNew()" (click)="addMethod()">Save method</button>
      </div>
    </app-modal>
  `,
  styles: `.add-method { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-style: dashed; color: var(--primary); cursor: pointer; min-height: 160px; }`,
})
export class MemberPaymentsComponent implements OnInit {
  readonly pay = input<string>();
  protected readonly acct = inject(MemberAccountService);
  private readonly payments = inject(PaymentService);
  private readonly refundSvc = inject(RefundService);
  private readonly checkout = inject(CheckoutService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loader = createLoader(() => this.payments.list());
  protected readonly typeLabels = PAYMENT_TYPE_LABELS;
  protected readonly typeKeys = Object.keys(PAYMENT_TYPE_LABELS) as (keyof typeof PAYMENT_TYPE_LABELS)[];
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly methodTypes: SavedMethod['type'][] = ['UPI', 'CARD', 'NET_BANKING'];
  protected readonly tab = signal('history');
  protected readonly status = signal('');
  protected readonly type = signal('');
  protected readonly addOpen = signal(false);
  protected readonly newType = signal<SavedMethod['type']>('UPI');
  protected readonly newDetail = signal('');
  protected readonly methods = signal<SavedMethod[]>([
    { id: 'm1', type: 'UPI', label: 'UPI', detail: 'aarav@okhdfcbank', primary: true },
    { id: 'm2', type: 'CARD', label: 'HDFC Visa credit card', detail: '•••• 4821 · exp 08/28', primary: false },
  ]);

  protected readonly mine = computed(() => this.payments.forMember(this.acct.memberId()));
  protected readonly refunds = computed(() => this.refundSvc.items().filter((r) => r.memberId === this.acct.memberId()));
  protected readonly filtered = computed(() => this.mine().filter((p) => (!this.status() || p.status === this.status()) && (!this.type() || p.type === this.type())));
  protected readonly stats = computed(() => {
    const sum = (s: string) => this.mine().filter((p) => p.status === s);
    return {
      paid: sum('SUCCESS').reduce((a, p) => a + p.amount, 0),
      paidCount: sum('SUCCESS').length,
      pending: sum('PENDING').reduce((a, p) => a + p.amount, 0),
      pendingCount: sum('PENDING').length,
      failed: sum('FAILED').reduce((a, p) => a + p.amount, 0),
      failedCount: sum('FAILED').length,
      refunds: this.refunds().reduce((a, r) => a + r.amount, 0),
    };
  });
  protected readonly tabs = computed(() => [
    { id: 'history', label: 'Payment history', count: this.mine().length },
    { id: 'refunds', label: 'Refunds', count: this.refunds().length },
    { id: 'methods', label: 'Payment methods' },
  ]);

  protected readonly cols: Column<Payment>[] = [
    { key: 'id', label: 'Payment ID', primary: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'type', label: 'Type', value: (p) => PAYMENT_TYPE_LABELS[p.type] },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'method', label: 'Method', value: (p) => PAYMENT_METHOD_LABELS[p.method], hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'invoice', label: 'Invoice', sortable: false },
  ];
  protected readonly refundCols: Column<Refund>[] = [
    { key: 'id', label: 'Refund ID', primary: true },
    { key: 'paymentId', label: 'Payment' },
    { key: 'amount', label: 'Amount', type: 'currency' },
    { key: 'reason', label: 'Reason', hideMobile: true },
    { key: 'requestedAt', label: 'Requested', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  ngOnInit(): void {
    if (this.pay() === 'dues') queueMicrotask(() => this.payDues());
  }

  protected validNew(): boolean {
    const v = this.newDetail().trim();
    if (this.newType() === 'UPI') return /^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(v);
    if (this.newType() === 'CARD') return /^\d{4}$/.test(v);
    return v.length > 2;
  }

  protected addMethod(): void {
    const t = this.newType();
    const d = this.newDetail().trim();
    this.methods.update((m) => [...m, { id: `m${Date.now()}`, type: t, label: t === 'CARD' ? 'Card' : t === 'UPI' ? 'UPI' : d, detail: t === 'CARD' ? `•••• ${d}` : d, primary: m.length === 0 }]);
    this.addOpen.set(false);
    this.newDetail.set('');
    this.toast.success('Payment method saved');
  }

  protected makePrimary(id: string): void {
    this.methods.update((m) => m.map((x) => ({ ...x, primary: x.id === id })));
  }

  protected removeMethod(id: string): void {
    this.methods.update((m) => m.filter((x) => x.id !== id));
    this.toast.info('Payment method removed');
  }

  protected payDues(): void {
    const member = this.acct.member();
    const invoices = this.acct.outstandingInvoices();
    if (!member || !invoices.length) return;
    const sub = this.acct.subscription();
    this.checkout.start({
      kind: 'DUES',
      memberId: member.id,
      locationId: member.locationId,
      title: 'Outstanding dues',
      lines: invoices.map((i) => ({ description: `${i.number} – ${i.lines[0]?.description ?? 'Invoice'}`, sac: '997212', qty: 1, rate: i.subtotal, amount: i.subtotal })),
      securityDeposit: 0,
      promoScope: null,
      allowReferral: false,
      creditsApplied: 0,
      payload: { invoiceIds: invoices.map((i) => i.id), subscriptionId: sub?.id },
      returnUrl: '/member/payments',
    });
    this.router.navigateByUrl('/member/checkout');
  }

  protected retry(p: Payment): void {
    if (p.type === 'BOOKING') {
      this.router.navigateByUrl('/member/bookings/new');
      return;
    }
    this.payDues();
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, printAsPdf } from '../../../shared';
import { InvoiceViewComponent } from '../../../shared/components/domain/domain-cards.component';
import { Invoice } from '../../../core/models';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { InvoiceService } from '../../../core/services/data/transaction-data.service';
import { NotificationCenterService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-member-invoices',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Invoices" subtitle="GST-compliant tax invoices for your memberships and bookings." [breadcrumbs]="[{ label: 'Payments', link: '/member/payments' }, { label: 'Invoices' }]" />
      <app-data-table
        [rows]="filtered()"
        [columns]="cols"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!status()"
        (clearFilters)="status.set('')"
        [defaultSort]="{ key: 'date', dir: 'desc' }"
        searchPlaceholder="Search invoice number"
        emptyTitle="No invoices yet"
        emptyIcon="receipt"
        [rowClickable]="true"
        (rowClick)="router.navigate(['/member/invoices', $event.id])"
        caption="Invoices"
      >
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </ng-container>
        <ng-template appCell="actions" let-row>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/member/invoices', row.id]" aria-label="View invoice"><app-icon name="eye" [size]="16" /></a>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/member/invoices', row.id]" [queryParams]="{ print: 1 }" aria-label="Download PDF"><app-icon name="download" [size]="16" /></a>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class MemberInvoicesComponent {
  private readonly acct = inject(MemberAccountService);
  private readonly invoices = inject(InvoiceService);
  protected readonly router = inject(Router);
  protected readonly loader = createLoader(() => this.invoices.list());
  protected readonly status = signal('');
  protected readonly filtered = computed(() => this.invoices.forMember(this.acct.memberId()).filter((i) => !this.status() || i.status === this.status()));
  protected readonly cols: Column<Invoice>[] = [
    { key: 'number', label: 'Invoice No.', primary: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'desc', label: 'Description', value: (i) => i.lines[0]?.description, hideMobile: true },
    { key: 'subtotal', label: 'Subtotal', type: 'currency', hideMobile: true },
    { key: 'tax', label: 'GST', type: 'currency', hideMobile: true },
    { key: 'total', label: 'Total', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
}

/** Invoice detail shared by member and finance consoles. */
@Component({
  selector: 'app-invoice-detail',
  imports: [...SHARED, InvoiceViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow" style="max-width: 1000px">
      @if (invoice(); as inv) {
        <app-page-header [title]="'Invoice ' + inv.number" [subtitle]="inv.customerName + (inv.companyName ? ' · ' + inv.companyName : '')" [breadcrumbs]="[{ label: 'Invoices', link: backLink() }, { label: inv.number }]">
          <app-status-badge badge [status]="inv.status" />
          <button type="button" class="btn btn-secondary" (click)="email(inv)"><app-icon name="mail" [size]="16" /> Email</button>
          <button type="button" class="btn btn-primary" (click)="pdf()"><app-icon name="download" [size]="16" /> Download PDF</button>
        </app-page-header>
        @if (inv.emailedAt) {
          <p class="text-sm text-muted no-print">Last emailed {{ inv.emailedAt | ago }}.</p>
        }
        <app-invoice-view [invoice]="inv" />
      } @else {
        <div class="card"><app-empty-state icon="receipt" title="Invoice not found"><a class="btn btn-secondary" [routerLink]="backLink()">Back to invoices</a></app-empty-state></div>
      }
    </div>
  `,
})
export class InvoiceDetailComponent {
  readonly id = input.required<string>();
  readonly print = input<string>();
  private readonly invoices = inject(InvoiceService);
  private readonly notify = inject(NotificationCenterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly invoice = computed(() => this.invoices.find(this.id()));
  protected readonly backLink = computed(() => (this.auth.isMember() ? '/member/invoices' : '/admin/finance/invoices'));

  constructor() {
    queueMicrotask(() => {
      if (this.print()) setTimeout(() => printAsPdf(), 400);
    });
  }

  protected pdf(): void {
    this.toast.info('Preparing PDF', 'Choose “Save as PDF” in the print dialog.');
    setTimeout(() => printAsPdf(), 300);
  }

  protected email(inv: Invoice): void {
    this.invoices.updateSync(inv.id, { emailedAt: new Date().toISOString() });
    this.notify.dispatch({ event: 'Payment Success', audience: 'STAFF', category: 'PAYMENT', title: 'Invoice emailed', message: `${inv.number} emailed to ${inv.customerName}.`, locationId: inv.locationId, channels: ['EMAIL'] });
    this.toast.success('Invoice emailed', `${inv.number} was sent to the billing email on file.`);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Column, SHARED, createLoader, downloadCsv, todayStamp } from '../../../shared';
import { CreditTransaction, Promotion, Subscription } from '../../../core/models';
import { CreditTransactionService, PlanService, PromotionService, SubscriptionService } from '../../../core/services/data/membership-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { InvoiceService } from '../../../core/services/data/transaction-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { MemberAccountService, accessStateFor } from '../../../core/services/member-account.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-subscriptions',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Subscriptions" subtitle="Every member plan with renewal, retry and access state." [breadcrumbs]="[{ label: 'Membership' }, { label: 'Subscriptions' }]">
        <button type="button" class="btn btn-secondary" (click)="export()"><app-icon name="download" [size]="16" /> Export CSV</button>
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Active" [value]="count('ACTIVE')" icon="check-circle" tone="success" />
        <app-stat-card label="Overdue" [value]="count('OVERDUE')" icon="alert" tone="danger" hint="In grace period" />
        <app-stat-card label="Paused" [value]="count('PAUSED')" icon="pause" tone="warning" />
        <app-stat-card label="Suspended" [value]="count('SUSPENDED')" icon="lock" tone="danger" />
        <app-stat-card label="Cancelling" [value]="cancelling()" icon="x-circle" tone="neutral" hint="At end of cycle" />
      </div>
      <app-data-table
        [rows]="filtered()"
        [columns]="cols"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!status() || !!plan()"
        (clearFilters)="status.set(''); plan.set('')"
        searchPlaceholder="Search member or subscription ID"
        emptyTitle="No subscriptions found"
        [rowClickable]="true"
        (rowClick)="selected.set($event)"
        caption="Subscriptions"
      >
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ s | humanize }}</option>
            }
          </select>
          <select class="select" aria-label="Plan" [ngModel]="plan()" (ngModelChange)="plan.set($event)">
            <option value="">All plans</option>
            @for (p of plans.items(); track p.id) {
              <option [value]="p.id">{{ p.name }}</option>
            }
          </select>
        </ng-container>
        <ng-template appCell="access" let-row>
          <app-status-badge [status]="access(row)" />
        </ng-template>
      </app-data-table>
    </div>

    <app-drawer [open]="!!selected()" [title]="selected() ? members.fullName(selected()!.memberId) : ''" [subtitle]="selected() ? selected()!.id + ' · ' + plans.name(selected()!.planId) : ''" (closed)="selected.set(null)">
      @if (current(); as s) {
        <div class="row-sm mb-4"><app-status-badge [status]="s.status" /><span class="text-sm text-muted">Access: </span><app-status-badge [status]="access(s)" /></div>
        <dl class="kv">
          <dt>Plan</dt><dd>{{ plans.name(s.planId) }}</dd>
          <dt>Location</dt><dd>{{ locations.name(s.locationId) }}</dd>
          <dt>Cycle</dt><dd>{{ s.startDate | date: 'd MMM' }} – {{ s.endDate | date: 'd MMM y' }} ({{ s.billingCycle | humanize }})</dd>
          <dt>Price</dt><dd>{{ s.price | inr }} + GST</dd>
          <dt>Credits</dt><dd>{{ s.creditsUsed | inr }} used of {{ s.creditsTotal | inr }}</dd>
          <dt>Room hours</dt><dd>{{ s.roomHoursUsed }} / {{ s.roomHoursTotal }}</dd>
          <dt>Guest passes</dt><dd>{{ s.guestPassesUsed }} / {{ s.guestPassesTotal }}</dd>
          <dt>Deposit</dt><dd>{{ s.securityDeposit | inr }}</dd>
          <dt>Auto-renew</dt><dd>{{ s.autoRenew ? 'On' : 'Off' }}{{ s.cancelAt ? ' · cancels ' + s.cancelAt : '' }}</dd>
          <dt>Payment retries</dt><dd>{{ s.paymentRetries }} of 3 (day 1, 3, 7){{ s.graceUntil ? ' · grace until ' + s.graceUntil : '' }}</dd>
          @if (s.pausedUntil) {
            <dt>Paused until</dt><dd>{{ s.pausedUntil }}</dd>
          }
        </dl>
        @if (auth.can('subscriptions.edit')) {
          <h4 class="section-title mt-5">Recurring billing simulation</h4>
          <p class="text-sm text-muted">Retries run on day 1, 3 and 7. After the last retry and the grace period, the plan is suspended and door access revoked.</p>
          <div class="btn-group">
            <button type="button" class="btn btn-secondary btn-sm" (click)="failRetry(s)" [disabled]="s.status === 'CANCELLED' || s.status === 'EXPIRED'"><app-icon name="x-circle" [size]="14" /> Record failed retry</button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="markPaid(s)" [disabled]="s.status !== 'OVERDUE' && s.status !== 'SUSPENDED'"><app-icon name="check-circle" [size]="14" /> Mark dues paid</button>
          </div>
        }
      }
      <div footer class="btn-group">
        @if (current(); as s) {
          @if (auth.can('subscriptions.edit')) {
            @if (s.status === 'ACTIVE') {
              <button type="button" class="btn btn-secondary" (click)="pause(s)">Pause</button>
              <button type="button" class="btn btn-danger" (click)="setStatus(s, 'SUSPENDED')">Suspend</button>
            } @else if (s.status === 'PAUSED') {
              <button type="button" class="btn btn-primary" (click)="resume(s)">Resume</button>
            } @else if (s.status === 'SUSPENDED' || s.status === 'OVERDUE') {
              <button type="button" class="btn btn-primary" (click)="setStatus(s, 'ACTIVE')">Activate</button>
            }
          }
          <a class="btn btn-secondary" [routerLink]="['/admin/members', s.memberId]">Open member</a>
        }
      </div>
    </app-drawer>
  `,
})
export class SubscriptionsComponent {
  private readonly subs = inject(SubscriptionService);
  protected readonly plans = inject(PlanService);
  protected readonly members = inject(MemberService);
  protected readonly locations = inject(LocationService);
  private readonly acct = inject(MemberAccountService);
  private readonly invoices = inject(InvoiceService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly audit = inject(AuditService);

  protected readonly loader = createLoader(() => this.subs.listScoped());
  protected readonly statuses = ['ACTIVE', 'OVERDUE', 'PAUSED', 'SUSPENDED', 'CANCELLED', 'EXPIRED'];
  protected readonly status = signal('');
  protected readonly plan = signal('');
  protected readonly selected = signal<Subscription | null>(null);
  protected readonly current = computed(() => this.subs.find(this.selected()?.id));
  protected readonly filtered = computed(() => this.subs.scoped().filter((s) => (!this.status() || s.status === this.status()) && (!this.plan() || s.planId === this.plan())));
  protected readonly cancelling = computed(() => this.subs.scoped().filter((s) => !!s.cancelAt && s.status === 'ACTIVE').length);
  protected count(st: string): number {
    return this.subs.scoped().filter((s) => s.status === st).length;
  }
  protected access(s: Subscription): string {
    return accessStateFor(s);
  }

  protected readonly cols: Column<Subscription>[] = [
    { key: 'id', label: 'Subscription', primary: true },
    { key: 'member', label: 'Member', value: (s) => this.members.fullName(s.memberId) },
    { key: 'plan', label: 'Plan', value: (s) => this.plans.name(s.planId) },
    { key: 'location', label: 'Location', value: (s) => this.locations.shortName(s.locationId), hideMobile: true },
    { key: 'endDate', label: 'Renews / ends', type: 'date' },
    { key: 'price', label: 'Price', type: 'currency', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'access', label: 'Access', sortable: false },
  ];

  protected failRetry(s: Subscription): void {
    const u = this.acct.recordRetryFailure(s.id);
    this.audit.record('STATUS_CHANGE', 'Membership', 'Subscription', s.id, `Recurring payment retry ${u.paymentRetries} failed`);
    this.toast.warning(`Retry ${u.paymentRetries} failed`, u.status === 'SUSPENDED' ? 'Plan suspended and door access revoked.' : u.graceUntil ? `Grace period until ${u.graceUntil}.` : 'Next retry scheduled.');
  }

  protected markPaid(s: Subscription): void {
    const inv = this.invoices.forMember(s.memberId).filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE');
    this.acct.settleDues(s.memberId, inv.map((i) => i.id), 'MANUAL');
    this.audit.record('UPDATE', 'Membership', 'Subscription', s.id, 'Dues settled manually; access restored');
    this.toast.success('Dues settled', 'Subscription active and access restored.');
  }

  protected async pause(s: Subscription): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Pause subscription?', message: 'The member’s access will be suspended for 30 days.', confirmText: 'Pause', tone: 'warning' });
    if (!ok) return;
    const until = new Date();
    until.setDate(until.getDate() + 30);
    this.acct.pause(s.id, until.toLocaleDateString('en-CA'));
    this.audit.record('STATUS_CHANGE', 'Membership', 'Subscription', s.id, 'Paused subscription');
    this.toast.success('Subscription paused');
  }

  protected resume(s: Subscription): void {
    this.acct.resume(s.id);
    this.audit.record('STATUS_CHANGE', 'Membership', 'Subscription', s.id, 'Resumed subscription');
    this.toast.success('Subscription resumed');
  }

  protected async setStatus(s: Subscription, status: Subscription['status']): Promise<void> {
    const ok = await this.confirm.confirm({
      title: status === 'SUSPENDED' ? 'Suspend subscription?' : 'Activate subscription?',
      message: status === 'SUSPENDED' ? 'Door access will be revoked immediately.' : 'Access will be restored immediately.',
      confirmText: status === 'SUSPENDED' ? 'Suspend' : 'Activate',
      tone: status === 'SUSPENDED' ? 'danger' : 'primary',
    });
    if (!ok) return;
    this.acct.setStatus(s.id, status);
    this.audit.record('STATUS_CHANGE', 'Membership', 'Subscription', s.id, `Set status to ${status}`);
    this.toast.success(`Subscription ${status.toLowerCase()}`);
  }

  protected export(): void {
    downloadCsv(`subscriptions-${todayStamp()}`, this.filtered(), [
      { label: 'ID', value: (s) => s.id },
      { label: 'Member', value: (s) => this.members.fullName(s.memberId) },
      { label: 'Plan', value: (s) => this.plans.name(s.planId) },
      { label: 'Status', value: (s) => s.status },
      { label: 'Start', value: (s) => s.startDate },
      { label: 'End', value: (s) => s.endDate },
      { label: 'Price', value: (s) => s.price },
    ]);
  }
}

@Component({
  selector: 'app-credits',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Credits" subtitle="Booking credits allocated, used and adjusted across members." [breadcrumbs]="[{ label: 'Membership' }, { label: 'Credits' }]">
        @if (auth.can('subscriptions.edit')) {
          <button type="button" class="btn btn-primary" (click)="openAdjust()"><app-icon name="plus" [size]="16" /> Adjust credits</button>
        }
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Allocated this cycle" [value]="totals().allocated | inr" icon="wallet" />
        <app-stat-card label="Used" [value]="totals().used | inr" icon="calendar" tone="info" />
        <app-stat-card label="Refunded" [value]="totals().refunded | inr" icon="refund" tone="success" />
        <app-stat-card label="Adjustments" [value]="totals().adjusted | inr" icon="sliders" tone="warning" />
      </div>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!type()" (clearFilters)="type.set('')" [defaultSort]="{ key: 'date', dir: 'desc' }" searchPlaceholder="Search member or reference" emptyTitle="No credit activity" caption="Credit ledger">
        <ng-container filters>
          <select class="select" aria-label="Type" [ngModel]="type()" (ngModelChange)="type.set($event)">
            <option value="">All types</option>
            @for (t of ['ALLOCATED', 'USED', 'REFUNDED', 'ADJUSTED', 'EXPIRED']; track t) {
              <option [value]="t">{{ t | humanize }}</option>
            }
          </select>
        </ng-container>
        <ng-template appCell="amount" let-row>
          <span class="tabular fw-600" [class.text-success]="row.amount > 0" [class.text-danger]="row.amount < 0">{{ row.amount > 0 ? '+' : '' }}{{ row.amount | inr }}</span>
        </ng-template>
      </app-data-table>
    </div>
    <app-modal [open]="adjustOpen()" title="Adjust credits" subtitle="Add goodwill credits or correct a balance." (closed)="adjustOpen.set(false)">
      <form id="adj-form" [formGroup]="form" (ngSubmit)="adjust()" class="form-grid" novalidate>
        <div class="field span-2">
          <label class="label" for="am">Member <span class="req">*</span></label>
          <select id="am" class="select" formControlName="memberId">
            <option value="">Select member</option>
            @for (m of activeMembers(); track m.id) {
              <option [value]="m.id">{{ m.firstName }} {{ m.lastName }} ({{ m.id }})</option>
            }
          </select>
          <app-field-error [control]="form.controls.memberId" label="Member" />
        </div>
        <div class="field">
          <label class="label" for="aa">Amount (₹) <span class="req">*</span></label>
          <input id="aa" class="input" type="number" formControlName="amount" />
          <span class="field-hint">Use a negative number to deduct.</span>
          <app-field-error [control]="form.controls.amount" label="Amount" />
        </div>
        <div class="field">
          <label class="label" for="ar">Reference</label>
          <input id="ar" class="input" formControlName="reference" placeholder="TKT-6001" />
        </div>
        <div class="field span-2">
          <label class="label" for="an">Note <span class="req">*</span></label>
          <input id="an" class="input" formControlName="note" placeholder="Goodwill for AC downtime" />
          <app-field-error [control]="form.controls.note" label="Note" />
        </div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="adjustOpen.set(false)">Cancel</button>
        <button type="submit" form="adj-form" class="btn btn-primary" [disabled]="form.invalid">Save adjustment</button>
      </div>
    </app-modal>
  `,
})
export class CreditsComponent {
  private readonly credits = inject(CreditTransactionService);
  private readonly subs = inject(SubscriptionService);
  private readonly members = inject(MemberService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.credits.list());
  protected readonly type = signal('');
  protected readonly adjustOpen = signal(false);
  private readonly scopedMemberIds = computed(() => new Set(this.members.scoped().map((m) => m.id)));
  protected readonly activeMembers = computed(() => this.members.scoped().filter((m) => m.status === 'ACTIVE'));
  protected readonly rows = computed(() => this.credits.items().filter((c) => this.scopedMemberIds().has(c.memberId)));
  protected readonly filtered = computed(() => this.rows().filter((c) => !this.type() || c.type === this.type()));
  protected readonly totals = computed(() => {
    const sum = (t: string) => Math.abs(this.rows().filter((c) => c.type === t).reduce((a, c) => a + c.amount, 0));
    return { allocated: sum('ALLOCATED'), used: sum('USED'), refunded: sum('REFUNDED'), adjusted: sum('ADJUSTED') };
  });
  protected readonly form = this.fb.nonNullable.group({
    memberId: ['', Validators.required],
    amount: [500, [Validators.required, Validators.pattern(/^-?\d+$/)]],
    reference: [''],
    note: ['', Validators.required],
  });
  protected readonly cols: Column<CreditTransaction>[] = [
    { key: 'date', label: 'Date', type: 'datetime' },
    { key: 'member', label: 'Member', value: (c) => this.members.fullName(c.memberId), primary: true },
    { key: 'type', label: 'Type', value: (c) => c.type, type: 'status' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'reference', label: 'Reference', hideMobile: true },
    { key: 'note', label: 'Note', hideMobile: true },
  ];

  protected openAdjust(): void {
    this.form.reset({ memberId: '', amount: 500, reference: '', note: '' });
    this.adjustOpen.set(true);
  }

  protected adjust(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const amount = Number(v.amount);
    const c = this.credits.createSync({ memberId: v.memberId, date: new Date().toISOString(), type: 'ADJUSTED', amount, reference: v.reference || 'Manual', note: v.note });
    const sub = this.subs.forMember(v.memberId);
    if (sub) this.subs.updateSync(sub.id, { creditsTotal: Math.max(0, sub.creditsTotal + amount) });
    this.audit.record('UPDATE', 'Membership', 'Credits', c.id, `Adjusted credits by ₹${amount} for ${this.members.fullName(v.memberId)}`);
    this.adjustOpen.set(false);
    this.toast.success('Credits adjusted', `${amount > 0 ? '+' : ''}₹${amount} for ${this.members.fullName(v.memberId)}`);
  }
}

@Component({
  selector: 'app-promotions',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Promotions" subtitle="Promo codes for plans and bookings." [breadcrumbs]="[{ label: 'Membership' }, { label: 'Promotions' }]">
        @if (auth.can('plans.create')) {
          <button type="button" class="btn btn-primary" (click)="open()"><app-icon name="plus" [size]="16" /> Create promo code</button>
        }
      </app-page-header>
      <app-data-table [rows]="promos.items()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" searchPlaceholder="Search code" emptyTitle="No promotions" emptyIcon="tag" caption="Promotions">
        <ng-template appCell="code" let-row>
          <code class="qr-code-text" style="margin: 0">{{ row.code }}</code>
          <span class="cell-sub">{{ row.description }}</span>
        </ng-template>
        <ng-template appCell="usage" let-row>
          <div style="min-width: 110px">
            <div class="text-xs mb-1">{{ row.used }} / {{ row.usageLimit }}</div>
            <div class="progress"><span [style.width.%]="(row.used / row.usageLimit) * 100"></span></div>
          </div>
        </ng-template>
        <ng-template appCell="actions" let-row>
          @if (auth.can('plans.edit')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="open(row)" aria-label="Edit"><app-icon name="edit" [size]="16" /></button>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="toggle(row)" [attr.aria-label]="row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'"><app-icon [name]="row.status === 'ACTIVE' ? 'pause' : 'play'" [size]="16" /></button>
          }
          @if (auth.can('plans.delete')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm text-danger" (click)="remove(row)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
          }
        </ng-template>
      </app-data-table>
    </div>
    <app-modal [open]="formOpen()" [title]="editing() ? 'Edit promo code' : 'Create promo code'" (closed)="formOpen.set(false)">
      <form id="promo-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
        <div class="field">
          <label class="label" for="pcd">Promo code <span class="req">*</span></label>
          <input id="pcd" class="input" formControlName="code" style="text-transform: uppercase" />
          <app-field-error [control]="form.controls.code" label="Promo code" />
        </div>
        <div class="field">
          <label class="label" for="pap">Applies to</label>
          <select id="pap" class="select" formControlName="appliesTo">
            <option value="ALL">Plans & bookings</option>
            <option value="PLANS">Plans</option>
            <option value="BOOKINGS">Bookings</option>
          </select>
        </div>
        <div class="field span-2">
          <label class="label" for="pdsc">Description <span class="req">*</span></label>
          <input id="pdsc" class="input" formControlName="description" />
          <app-field-error [control]="form.controls.description" label="Description" />
        </div>
        <div class="field">
          <label class="label" for="pdt">Discount type</label>
          <select id="pdt" class="select" formControlName="discountType">
            <option value="PERCENT">Percentage (%)</option>
            <option value="FLAT">Flat amount (₹)</option>
          </select>
        </div>
        <div class="field">
          <label class="label" for="pdv">Discount <span class="req">*</span></label>
          <input id="pdv" class="input" type="number" min="1" formControlName="discount" />
          <app-field-error [control]="form.controls.discount" label="Discount" />
        </div>
        <div class="field">
          <label class="label" for="pex">Expiry <span class="req">*</span></label>
          <input id="pex" class="input" type="date" formControlName="expiry" />
          <app-field-error [control]="form.controls.expiry" label="Expiry" />
        </div>
        <div class="field">
          <label class="label" for="pul">Usage limit <span class="req">*</span></label>
          <input id="pul" class="input" type="number" min="1" formControlName="usageLimit" />
          <app-field-error [control]="form.controls.usageLimit" label="Usage limit" />
        </div>
        <div class="field">
          <label class="label" for="pstat">Status</label>
          <select id="pstat" class="select" formControlName="status">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancel</button>
        <button type="submit" form="promo-form" class="btn btn-primary" [disabled]="form.invalid">Save</button>
      </div>
    </app-modal>
  `,
})
export class PromotionsComponent {
  protected readonly promos = inject(PromotionService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.promos.list());
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Promotion | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{4,16}$/)]],
    description: ['', Validators.required],
    discountType: ['PERCENT' as Promotion['discountType']],
    discount: [10, [Validators.required, Validators.min(1)]],
    expiry: ['', Validators.required],
    usageLimit: [100, [Validators.required, Validators.min(1)]],
    status: ['ACTIVE' as Promotion['status']],
    appliesTo: ['ALL' as Promotion['appliesTo']],
  });
  protected readonly cols: Column<Promotion>[] = [
    { key: 'code', label: 'Promo Code', primary: true },
    { key: 'discount', label: 'Discount', value: (p) => (p.discountType === 'PERCENT' ? `${p.discount}%` : `₹${p.discount.toLocaleString('en-IN')}`) },
    { key: 'appliesTo', label: 'Applies to', value: (p) => (p.appliesTo === 'ALL' ? 'Plans & bookings' : p.appliesTo === 'PLANS' ? 'Plans' : 'Bookings'), hideMobile: true },
    { key: 'expiry', label: 'Expiry', type: 'date' },
    { key: 'usage', label: 'Usage Limit', sortValue: (p) => p.used / p.usageLimit },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected open(p?: Promotion): void {
    this.editing.set(p ?? null);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    this.form.reset(p ? { ...p } : { code: '', description: '', discountType: 'PERCENT', discount: 10, expiry: d.toLocaleDateString('en-CA'), usageLimit: 100, status: 'ACTIVE', appliesTo: 'ALL' });
    this.formOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = { ...this.form.getRawValue(), code: this.form.controls.code.value.toUpperCase() };
    const dup = this.promos.items().find((p) => p.code === v.code && p.id !== this.editing()?.id);
    if (dup) {
      this.form.controls.code.setErrors({ server: 'This code already exists.' });
      return;
    }
    if (this.editing()) this.promos.updateSync(this.editing()!.id, v);
    else this.promos.createSync({ ...v, used: 0 });
    this.audit.record(this.editing() ? 'UPDATE' : 'CREATE', 'Plans', 'Promotion', v.code, `${this.editing() ? 'Updated' : 'Created'} promo ${v.code}`);
    this.formOpen.set(false);
    this.toast.success('Promo code saved', v.code);
  }

  protected toggle(p: Promotion): void {
    this.promos.updateSync(p.id, { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
    this.toast.success(p.status === 'ACTIVE' ? 'Promo deactivated' : 'Promo activated', p.code);
  }

  protected async remove(p: Promotion): Promise<void> {
    const ok = await this.confirm.confirm({ title: `Delete ${p.code}?`, message: 'Members will no longer be able to use this code. This cannot be undone.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    this.promos.remove(p.id).subscribe(() => {
      this.audit.record('DELETE', 'Plans', 'Promotion', p.id, `Deleted promo ${p.code}`);
      this.toast.success('Promo code deleted');
    });
  }
}

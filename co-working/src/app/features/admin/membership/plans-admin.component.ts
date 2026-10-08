import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader } from '../../../shared';
import { PlanCardComponent } from '../../../shared/components/domain/domain-cards.component';
import { BILLING_CYCLE_LABELS, BillingCycle, PLAN_TYPE_LABELS, Plan, PlanType, Subscription } from '../../../core/models';
import { PlanService, SubscriptionService } from '../../../core/services/data/membership-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-plans-admin',
  imports: [...SHARED, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Membership Plans" subtitle="Create plans and publish them to members and the website." [breadcrumbs]="[{ label: 'Membership' }, { label: 'Plans' }]">
        <div class="segmented" role="radiogroup" aria-label="View">
          <button type="button" [class.active]="view() === 'table'" (click)="view.set('table')"><app-icon name="list" [size]="14" /> Table</button>
          <button type="button" [class.active]="view() === 'cards'" (click)="view.set('cards')"><app-icon name="grid" [size]="14" /> Cards</button>
        </div>
        @if (auth.can('plans.create')) {
          <a class="btn btn-primary" routerLink="/admin/membership/plans/new"><app-icon name="plus" [size]="16" /> Create plan</a>
        }
      </app-page-header>

      @if (view() === 'cards') {
        @if (loader.status() === 'loading') {
          <app-loading-state variant="cards" [rows]="4" />
        } @else {
          <div class="grid grid-auto" style="padding-top: 10px">
            @for (p of plans.items(); track p.id) {
              <div class="stack-sm">
                <app-plan-card [plan]="p" cta="View plan" (choose)="router.navigate(['/admin/membership/plans', p.id])" />
                <div class="row-between text-sm"><app-status-badge [status]="p.status" /><span class="text-muted">{{ subscriberCount(p.id) }} active subscribers</span></div>
              </div>
            }
          </div>
        }
      } @else {
        <app-data-table
          [rows]="filtered()"
          [columns]="cols"
          [status]="loader.status()"
          (retry)="loader.load()"
          [hasFilters]="true"
          [filtersActive]="!!status()"
          (clearFilters)="status.set('')"
          searchPlaceholder="Search plans"
          emptyTitle="No plans yet"
          [rowClickable]="true"
          (rowClick)="router.navigate(['/admin/membership/plans', $event.id])"
          caption="Plans"
        >
          <ng-container filters>
            <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </ng-container>
          <ng-template appCell="actions" let-row>
            <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/membership/plans', row.id]" aria-label="View"><app-icon name="eye" [size]="16" /></a>
            @if (auth.can('plans.edit')) {
              <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/membership/plans', row.id, 'edit']" aria-label="Edit"><app-icon name="edit" [size]="16" /></a>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="toggle(row)" [attr.aria-label]="row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'"><app-icon [name]="row.status === 'ACTIVE' ? 'pause' : 'play'" [size]="16" /></button>
            }
          </ng-template>
        </app-data-table>
      }
    </div>
  `,
})
export class PlansAdminComponent {
  protected readonly plans = inject(PlanService);
  private readonly subs = inject(SubscriptionService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.plans.list());
  protected readonly view = signal<'table' | 'cards'>('table');
  protected readonly status = signal('');
  protected readonly filtered = computed(() => this.plans.items().filter((p) => !this.status() || p.status === this.status()));
  private readonly counts = computed(() => {
    const m: Record<string, number> = {};
    this.subs.items().filter((s) => s.status === 'ACTIVE').forEach((s) => (m[s.planId] = (m[s.planId] ?? 0) + 1));
    return m;
  });

  protected subscriberCount(id: string): number {
    return this.counts()[id] ?? 0;
  }

  protected readonly cols: Column<Plan>[] = [
    { key: 'name', label: 'Plan', primary: true },
    { key: 'type', label: 'Type', value: (p) => PLAN_TYPE_LABELS[p.type] },
    { key: 'price', label: 'Price', type: 'currency' },
    { key: 'billingCycle', label: 'Billing', value: (p) => BILLING_CYCLE_LABELS[p.billingCycle] },
    { key: 'roomHours', label: 'Room hrs', type: 'number', hideMobile: true },
    { key: 'guestPasses', label: 'Guest passes', type: 'number', hideMobile: true },
    { key: 'credits', label: 'Credits', type: 'currency', hideMobile: true },
    { key: 'securityDeposit', label: 'Deposit', type: 'currency', hideMobile: true },
    { key: 'subs', label: 'Subscribers', type: 'number', value: (p) => this.subscriberCount(p.id) },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected async toggle(p: Plan): Promise<void> {
    const deactivate = p.status === 'ACTIVE';
    const ok = await this.confirm.confirm({
      title: deactivate ? `Deactivate ${p.name}?` : `Publish ${p.name}?`,
      message: deactivate ? 'Members will no longer be able to subscribe. Existing subscribers are not affected.' : 'The plan will be visible to members and on the website.',
      confirmText: deactivate ? 'Deactivate' : 'Publish',
      tone: deactivate ? 'danger' : 'primary',
    });
    if (!ok) return;
    this.plans.updateSync(p.id, { status: deactivate ? 'INACTIVE' : 'ACTIVE' });
    this.audit.record('STATUS_CHANGE', 'Plans', 'Plan', p.id, `${deactivate ? 'Deactivated' : 'Published'} ${p.name}`);
    this.toast.success(deactivate ? 'Plan deactivated' : 'Plan published');
  }
}

/** Create / edit plan (flow 6: plan name, type, price, cycle, room hours, guest passes, deposit → publish). */
@Component({
  selector: 'app-plan-form',
  imports: [...SHARED, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header [title]="isEdit() ? 'Edit plan' : 'Create plan'" [breadcrumbs]="[{ label: 'Plans', link: '/admin/membership/plans' }, { label: isEdit() ? 'Edit' : 'New' }]" />
      <div class="split">
        <form class="card card-body" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="form-grid">
            <div class="field span-2">
              <label class="label" for="pn">Plan name <span class="req">*</span></label>
              <input id="pn" class="input" formControlName="name" />
              <app-field-error [control]="form.controls.name" label="Plan name" />
            </div>
            <div class="field">
              <label class="label" for="pt">Plan type <span class="req">*</span></label>
              <select id="pt" class="select" formControlName="type">
                @for (t of typeKeys; track t) {
                  <option [value]="t">{{ typeLabels[t] }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="label" for="pc">Billing cycle <span class="req">*</span></label>
              <select id="pc" class="select" formControlName="billingCycle">
                @for (c of cycleKeys; track c) {
                  <option [value]="c">{{ cycleLabels[c] }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="label" for="pp">Price (₹, excl. GST) <span class="req">*</span></label>
              <input id="pp" class="input" type="number" min="0" formControlName="price" />
              <app-field-error [control]="form.controls.price" label="Price" />
            </div>
            <div class="field">
              <label class="label" for="pd">Security deposit (₹) <span class="req">*</span></label>
              <input id="pd" class="input" type="number" min="0" formControlName="securityDeposit" />
              <app-field-error [control]="form.controls.securityDeposit" label="Security deposit" />
            </div>
            <div class="field">
              <label class="label" for="prh">Room hours <span class="req">*</span></label>
              <input id="prh" class="input" type="number" min="0" formControlName="roomHours" />
              <app-field-error [control]="form.controls.roomHours" label="Room hours" />
            </div>
            <div class="field">
              <label class="label" for="pgp">Guest passes <span class="req">*</span></label>
              <input id="pgp" class="input" type="number" min="0" formControlName="guestPasses" />
              <app-field-error [control]="form.controls.guestPasses" label="Guest passes" />
            </div>
            <div class="field">
              <label class="label" for="pcr">Credits (₹) <span class="req">*</span></label>
              <input id="pcr" class="input" type="number" min="0" formControlName="credits" />
              <app-field-error [control]="form.controls.credits" label="Credits" />
            </div>
            <div class="field">
              <label class="label" for="pah">Access hours <span class="req">*</span></label>
              <input id="pah" class="input" formControlName="accessHours" />
            </div>
            <div class="field span-2">
              <label class="label" for="pde">Description <span class="req">*</span></label>
              <textarea id="pde" class="textarea" rows="2" formControlName="description"></textarea>
              <app-field-error [control]="form.controls.description" label="Description" />
            </div>
            <div class="field span-2">
              <label class="label" for="pbe">Benefits (one per line)</label>
              <textarea id="pbe" class="textarea" rows="4" formControlName="benefits"></textarea>
            </div>
            <div class="field">
              <label class="label" for="pst">Status</label>
              <select id="pst" class="select" formControlName="status">
                <option value="ACTIVE">Active (published)</option>
                <option value="INACTIVE">Inactive (draft)</option>
              </select>
            </div>
            <div class="field" style="justify-content: flex-end">
              <label class="check"><input type="checkbox" formControlName="popular" /> Highlight as “Most popular”</label>
            </div>
          </div>
          <div class="form-actions">
            <a class="btn btn-secondary" routerLink="/admin/membership/plans">Cancel</a>
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid">{{ isEdit() ? 'Save plan' : form.controls.status.value === 'ACTIVE' ? 'Create & publish' : 'Save as draft' }}</button>
          </div>
        </form>
        <aside class="sticky-side">
          <div class="eyebrow mb-2">Live preview</div>
          <app-plan-card [plan]="preview()" cta="Subscribe" />
        </aside>
      </div>
    </div>
  `,
})
export class PlanFormComponent implements OnInit {
  readonly id = input<string>();
  private readonly fb = inject(FormBuilder);
  private readonly plans = inject(PlanService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly typeLabels = PLAN_TYPE_LABELS;
  protected readonly typeKeys = Object.keys(PLAN_TYPE_LABELS) as PlanType[];
  protected readonly cycleLabels = BILLING_CYCLE_LABELS;
  protected readonly cycleKeys = Object.keys(BILLING_CYCLE_LABELS) as BillingCycle[];
  protected readonly isEdit = computed(() => !!this.id());
  private readonly tick = signal(0);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    type: ['HOT_DESK' as PlanType, Validators.required],
    billingCycle: ['MONTHLY' as BillingCycle, Validators.required],
    price: [6999, [Validators.required, Validators.min(0)]],
    securityDeposit: [5000, [Validators.required, Validators.min(0)]],
    roomHours: [6, [Validators.required, Validators.min(0)]],
    guestPasses: [2, [Validators.required, Validators.min(0)]],
    credits: [1000, [Validators.required, Validators.min(0)]],
    accessHours: ['8:00 AM – 9:00 PM, Mon–Sat', Validators.required],
    description: ['', Validators.required],
    benefits: ['Any open hot desk\nHigh-speed Wi-Fi\nCommunity events'],
    status: ['ACTIVE' as Plan['status']],
    popular: [false],
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.tick.update((t) => t + 1));
  }

  ngOnInit(): void {
    const p = this.plans.find(this.id());
    if (p) this.form.patchValue({ ...p, benefits: p.benefits.join('\n'), popular: !!p.popular });
  }

  protected readonly preview = computed<Plan>(() => {
    this.tick();
    const v = this.form.getRawValue();
    return { ...v, id: 'preview', benefits: v.benefits.split('\n').map((b) => b.trim()).filter(Boolean), subscribers: 0, name: v.name || 'Plan name', description: v.description || 'Plan description' };
  });

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const data = { ...v, benefits: v.benefits.split('\n').map((b) => b.trim()).filter(Boolean) };
    if (this.isEdit()) {
      this.plans.updateSync(this.id()!, data);
      this.audit.record('UPDATE', 'Plans', 'Plan', this.id()!, `Updated plan ${v.name}`);
      this.toast.success('Plan saved', v.name);
      this.router.navigate(['/admin/membership/plans', this.id()]);
    } else {
      const p = this.plans.createSync({ ...data, subscribers: 0 });
      this.audit.record('CREATE', 'Plans', 'Plan', p.id, `Created plan ${p.name}`);
      this.toast.success(p.status === 'ACTIVE' ? 'Plan published' : 'Plan saved as draft', `${p.name} now appears in the plan list.`);
      this.router.navigate(['/admin/membership/plans', p.id]);
    }
  }
}

@Component({
  selector: 'app-plan-detail',
  imports: [...SHARED, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (plan(); as p) {
        <app-page-header [title]="p.name" [subtitle]="typeLabels[p.type] + ' · ' + cycleLabels[p.billingCycle]" [breadcrumbs]="[{ label: 'Plans', link: '/admin/membership/plans' }, { label: p.name }]">
          <app-status-badge badge [status]="p.status" />
          @if (auth.can('plans.edit')) {
            <button type="button" class="btn btn-secondary" (click)="toggle()">{{ p.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}</button>
            <a class="btn btn-primary" [routerLink]="['/admin/membership/plans', p.id, 'edit']"><app-icon name="edit" [size]="16" /> Edit</a>
          }
        </app-page-header>
        <div class="split-rev">
          <app-plan-card [plan]="p" cta="Preview only" [disabled]="true" />
          <div class="stack">
            <div class="stat-grid">
              <app-stat-card label="Active subscribers" [value]="active().length" icon="users" />
              <app-stat-card label="Monthly recurring" [value]="mrr() | inr" icon="rupee" tone="success" />
              <app-stat-card label="Paused / overdue" [value]="atRisk()" icon="alert" tone="warning" />
            </div>
            <app-data-table [rows]="subscriptions()" [columns]="cols" searchPlaceholder="Search subscribers" emptyTitle="No subscribers yet" [rowClickable]="true" (rowClick)="router.navigate(['/admin/members', $event.memberId])" caption="Subscribers" />
          </div>
        </div>
      } @else {
        <div class="card"><app-empty-state icon="membership" title="Plan not found"><a class="btn btn-secondary" routerLink="/admin/membership/plans">Back to plans</a></app-empty-state></div>
      }
    </div>
  `,
})
export class PlanDetailComponent {
  readonly id = input.required<string>();
  private readonly plans = inject(PlanService);
  private readonly subs = inject(SubscriptionService);
  private readonly members = inject(MemberService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly typeLabels = PLAN_TYPE_LABELS;
  protected readonly cycleLabels = BILLING_CYCLE_LABELS;
  protected readonly plan = computed(() => this.plans.find(this.id()));
  protected readonly subscriptions = computed(() => this.subs.scoped().filter((s) => s.planId === this.id()));
  protected readonly active = computed(() => this.subscriptions().filter((s) => s.status === 'ACTIVE'));
  protected readonly atRisk = computed(() => this.subscriptions().filter((s) => ['PAUSED', 'OVERDUE', 'SUSPENDED'].includes(s.status)).length);
  protected readonly mrr = computed(() => this.active().reduce((a, s) => a + (s.billingCycle === 'QUARTERLY' ? s.price / 3 : s.billingCycle === 'DAILY' ? 0 : s.price), 0));
  protected readonly cols: Column<Subscription>[] = [
    { key: 'member', label: 'Member', value: (s) => this.members.fullName(s.memberId), primary: true },
    { key: 'startDate', label: 'Start', type: 'date' },
    { key: 'endDate', label: 'End', type: 'date' },
    { key: 'price', label: 'Price', type: 'currency' },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected toggle(): void {
    const p = this.plan()!;
    this.plans.updateSync(p.id, { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
    this.audit.record('STATUS_CHANGE', 'Plans', 'Plan', p.id, `${p.status === 'ACTIVE' ? 'Deactivated' : 'Activated'} ${p.name}`);
    this.toast.success(p.status === 'ACTIVE' ? 'Plan deactivated' : 'Plan activated');
  }
}

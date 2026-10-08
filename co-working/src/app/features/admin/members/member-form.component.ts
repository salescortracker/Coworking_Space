import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SHARED, emailValidator, gstinValidator, mobileValidator, todayIso } from '../../../shared';
import { PlanCardComponent } from '../../../shared/components/domain/domain-cards.component';
import { Member, PaymentMethod, Plan, TimelineEntry } from '../../../core/models';
import { CompanyService, MemberService } from '../../../core/services/data/people-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { PlanService, SubscriptionService } from '../../../core/services/data/membership-data.service';
import { LeadService } from '../../../core/services/data/engagement-data.service';
import { MemberAccountService, cycleDays } from '../../../core/services/member-account.service';
import { CheckoutService } from '../../../core/services/checkout.service';
import { NotificationCenterService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ToastService } from '../../../core/services/ui.service';
import { SettingsService } from '../../../core/services/settings.service';

/**
 * Create member wizard. Also the landing point of lead conversion (flow 3 / §6):
 * Lead → Converted → Create Member → Membership selection → Subscription → Member login.
 */
@Component({
  selector: 'app-member-form',
  imports: [...SHARED, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        [title]="isEdit() ? 'Edit member' : lead() ? 'Convert lead to member' : 'Add member'"
        [subtitle]="lead() ? 'Lead ' + lead()!.id + ' · ' + lead()!.requirement : isEdit() ? '' : 'Create the member, choose a membership and activate the subscription.'"
        [breadcrumbs]="lead() ? [{ label: 'Leads', link: '/admin/leads' }, { label: lead()!.id, link: '/admin/leads/' + lead()!.id }, { label: 'Convert' }] : [{ label: 'Members', link: '/admin/members' }, { label: isEdit() ? 'Edit' : 'New' }]"
      />
      @if (!isEdit()) {
        <div class="card card-body mb-4" style="padding: 12px 16px">
          <ol class="stepper list-plain" style="padding: 0; margin: 0">
            @for (s of steps(); track s; let i = $index) {
              <li class="step" [class.active]="step() === i" [class.done]="step() > i">
                <span class="num">
                  @if (step() > i) {
                    <app-icon name="check" [size]="12" />
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                {{ s }}
              </li>
              @if (i < steps().length - 1) {
                <li class="step-sep" aria-hidden="true"></li>
              }
            }
          </ol>
        </div>
      }

      @switch (step()) {
        @case (0) {
          <form class="card" [formGroup]="form" (ngSubmit)="saveDetails()" novalidate>
            <div class="card-header"><h2 class="card-title">Member details</h2></div>
            <div class="card-body">
              <div class="form-grid">
                <div class="field"><label class="label" for="mf">First name <span class="req">*</span></label><input id="mf" class="input" formControlName="firstName" /><app-field-error [control]="form.controls.firstName" label="First name" /></div>
                <div class="field"><label class="label" for="ml">Last name <span class="req">*</span></label><input id="ml" class="input" formControlName="lastName" /><app-field-error [control]="form.controls.lastName" label="Last name" /></div>
                <div class="field"><label class="label" for="me">Email <span class="req">*</span></label><input id="me" class="input" type="email" formControlName="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
                <div class="field"><label class="label" for="mm">Mobile <span class="req">*</span></label><input id="mm" class="input" maxlength="10" formControlName="mobile" /><app-field-error [control]="form.controls.mobile" label="Mobile" /></div>
                <div class="field"><label class="label" for="md">Designation</label><input id="md" class="input" formControlName="designation" /></div>
                <div class="field">
                  <label class="label" for="mloc">Home location <span class="req">*</span></label>
                  <select id="mloc" class="select" formControlName="locationId">
                    @for (l of locations.scoped(); track l.id) {
                      <option [value]="l.id">{{ l.name }}</option>
                    }
                  </select>
                </div>
                <div class="field span-2">
                  <label class="label" for="mco">Company</label>
                  <select id="mco" class="select" formControlName="companyId">
                    <option value="">Individual (no company)</option>
                    <option value="__new">+ Add a new company</option>
                    @for (c of companies.scoped(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </div>
                @if (form.controls.companyId.value === '__new') {
                  <div class="field"><label class="label" for="mcn">Company name <span class="req">*</span></label><input id="mcn" class="input" formControlName="companyName" /><app-field-error [control]="form.controls.companyName" label="Company name" /></div>
                  <div class="field"><label class="label" for="mcg">GSTIN</label><input id="mcg" class="input" formControlName="gstin" style="text-transform: uppercase" /><app-field-error [control]="form.controls.gstin" label="GSTIN" /></div>
                }
                <div class="field">
                  <label class="label" for="mst">Status</label>
                  <select id="mst" class="select" formControlName="status">
                    <option value="PENDING">Pending (until plan is paid)</option>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div class="field" style="justify-content: flex-end"><label class="check"><input type="checkbox" formControlName="directoryVisible" /> Show in member directory</label></div>
              </div>
            </div>
            <div class="card-footer">
              <a class="btn btn-secondary" [routerLink]="isEdit() ? ['/admin/members', id()] : lead() ? ['/admin/leads', lead()!.id] : '/admin/members'">Cancel</a>
              <button type="submit" class="btn btn-primary" [disabled]="form.invalid">{{ isEdit() ? 'Save changes' : 'Create member & continue' }}</button>
            </div>
          </form>
        }
        @case (1) {
          <div class="row-between mb-4 row-wrap">
            <p class="text-muted mb-0">Choose a membership for {{ created()?.firstName }}. You can also skip and assign later.</p>
            <button type="button" class="btn btn-ghost" (click)="finish(false)">Skip for now</button>
          </div>
          <div class="grid grid-4" style="padding-top: 10px">
            @for (p of plans.published(); track p.id) {
              <app-plan-card [plan]="p" [cta]="selectedPlan()?.id === p.id ? 'Selected' : 'Select plan'" [current]="false" (choose)="selectedPlan.set($event); step.set(2)" />
            }
          </div>
        }
        @case (2) {
          @if (selectedPlan(); as p) {
            <div class="split">
              <section class="card">
                <div class="card-header"><h2 class="card-title">Subscription & payment</h2></div>
                <div class="card-body stack">
                  <div class="segmented" role="radiogroup" aria-label="Payment collection">
                    <button type="button" [class.active]="collect() === 'now'" (click)="collect.set('now')">Collect payment now</button>
                    <button type="button" [class.active]="collect() === 'link'" (click)="collect.set('link')">Send payment link</button>
                  </div>
                  @if (collect() === 'now') {
                    <div class="field" style="max-width: 280px">
                      <label class="label" for="pm">Payment method</label>
                      <select id="pm" class="select" [ngModel]="method()" (ngModelChange)="method.set($event)">
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card (POS)</option>
                        <option value="NET_BANKING">Bank transfer / Net banking</option>
                      </select>
                    </div>
                    <p class="text-sm text-muted mb-0">The subscription is activated immediately, a GST invoice is generated and emailed, credits are allocated and a QR credential is issued.</p>
                  } @else {
                    <p class="text-sm text-muted mb-0">The member receives an SMS and email with a secure payment link. The subscription activates automatically after payment.</p>
                  }
                </div>
                <div class="card-footer">
                  <button type="button" class="btn btn-secondary" (click)="step.set(1)"><app-icon name="arrow-left" [size]="16" /> Change plan</button>
                  <button type="button" class="btn btn-primary" (click)="subscribe()">{{ collect() === 'now' ? 'Record payment & activate' : 'Send payment link' }}</button>
                </div>
              </section>
              <aside class="card">
                <div class="card-header"><h2 class="card-title">{{ p.name }}</h2></div>
                <div class="card-body">
                  <div class="summary-line"><span>Plan price</span><span>{{ p.price | inr }}</span></div>
                  <div class="summary-line"><span>GST ({{ gstPct }}%)</span><span>{{ p.price * gst | inr }}</span></div>
                  <div class="summary-line"><span>Security deposit</span><span>{{ p.securityDeposit | inr }}</span></div>
                  <div class="summary-line total"><span>Total</span><span>{{ p.price * (1 + gst) + p.securityDeposit | inr }}</span></div>
                </div>
              </aside>
            </div>
          }
        }
        @case (3) {
          <section class="card">
            <app-success-state [title]="lead() ? 'Lead converted to member' : 'Member created'" [message]="doneMessage()">
              <dl details class="kv" style="max-width: 420px; margin: 8px auto 0; text-align: left; padding: 12px 16px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 8px">
                <dt>Member ID</dt><dd class="mono">{{ created()?.id }}</dd>
                <dt>Login email</dt><dd>{{ created()?.email }}</dd>
                <dt>Temporary password</dt><dd class="mono">Welcome&#64;123</dd>
                <dt>Membership</dt><dd>{{ selectedPlan()?.name ?? 'Not assigned' }}</dd>
              </dl>
              <a class="btn btn-primary" [routerLink]="['/admin/members', created()?.id]">Open member profile</a>
              <a class="btn btn-secondary" routerLink="/admin/members">Back to members</a>
            </app-success-state>
          </section>
        }
      }
    </div>
  `,
})
export class MemberFormComponent implements OnInit {
  readonly id = input<string>();
  readonly leadId = input<string>();
  readonly stepParam = input<string>(undefined, { alias: 'step' });
  private readonly fb = inject(FormBuilder);
  private readonly members = inject(MemberService);
  protected readonly companies = inject(CompanyService);
  protected readonly locations = inject(LocationService);
  protected readonly plans = inject(PlanService);
  private readonly subs = inject(SubscriptionService);
  private readonly leads = inject(LeadService);
  private readonly acct = inject(MemberAccountService);
  private readonly checkout = inject(CheckoutService);
  private readonly notify = inject(NotificationCenterService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);

  /** GST rate from Settings → Business rules (database). */
  protected readonly gst = inject(SettingsService).gstFraction();
  protected readonly gstPct = inject(SettingsService).settings().gstRate;
  protected readonly isEdit = computed(() => !!this.id() && this.stepParam() !== 'plan');
  protected readonly lead = computed(() => this.leads.find(this.leadId()));
  protected readonly steps = computed(() => (this.lead() ? ['Create member', 'Membership selection', 'Subscription', 'Member login'] : ['Member details', 'Membership selection', 'Subscription', 'Done']));
  protected readonly step = signal(0);
  protected readonly created = signal<Member | null>(null);
  protected readonly selectedPlan = signal<Plan | null>(null);
  protected readonly collect = signal<'now' | 'link'>('now');
  protected readonly method = signal<PaymentMethod>('UPI');

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, emailValidator]],
    mobile: ['', [Validators.required, mobileValidator]],
    designation: [''],
    locationId: ['', Validators.required],
    companyId: [''],
    companyName: [''],
    gstin: ['', gstinValidator],
    status: ['PENDING' as Member['status']],
    directoryVisible: [true],
  });

  constructor() {
    this.form.controls.companyId.valueChanges.subscribe((v) => {
      this.form.controls.companyName.setValidators(v === '__new' ? [Validators.required] : []);
      this.form.controls.companyName.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    const m = this.members.find(this.id());
    if (m && this.stepParam() === 'plan') {
      this.created.set(m);
      this.step.set(1);
      return;
    }
    if (m) {
      this.form.patchValue({ ...m, companyId: m.companyId ?? '' });
      return;
    }
    this.form.patchValue({ locationId: this.locations.scoped()[0]?.id ?? '' });
    const l = this.lead();
    if (l) {
      const [first, ...rest] = l.name.split(' ');
      this.form.patchValue({ firstName: first, lastName: rest.join(' ') || '-', email: l.email ?? '', mobile: l.mobile, locationId: l.locationId });
    }
  }

  protected doneMessage(): string {
    const p = this.selectedPlan();
    const base = `${this.created()?.firstName} can now sign in to the member portal. Login details were sent by email and SMS.`;
    if (!p) return base;
    return this.collect() === 'now' ? `${base} The ${p.name} subscription is active with credits and QR access.` : `${base} A payment link for ${p.name} was sent; the subscription activates after payment.`;
  }

  protected saveDetails(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    let companyId: string | undefined = v.companyId || undefined;
    if (v.companyId === '__new') {
      companyId = this.companies.createSync({ name: v.companyName, gstin: v.gstin.toUpperCase(), billingAddress: '', state: this.locations.find(v.locationId)?.state ?? '', industry: '', size: '1–10', website: '', locationId: v.locationId }).id;
    }
    const data = { firstName: v.firstName, lastName: v.lastName, email: v.email, mobile: v.mobile, designation: v.designation, locationId: v.locationId, companyId, status: v.status, directoryVisible: v.directoryVisible };
    if (this.isEdit()) {
      this.members.updateSync(this.id()!, data);
      this.audit.record('UPDATE', 'Members', 'Member', this.id()!, `Updated ${v.firstName} ${v.lastName}`);
      this.toast.success('Member saved');
      this.router.navigate(['/admin/members', this.id()]);
      return;
    }
    const dup = this.members.items().find((m) => m.email.toLowerCase() === v.email.toLowerCase());
    if (dup) {
      this.form.controls.email.setErrors({ server: `A member with this email already exists (${dup.id}).` });
      this.form.controls.email.markAsTouched();
      return;
    }
    const m = this.members.createSync({ ...data, joinDate: todayIso(), bio: '', skills: [], leadId: this.lead()?.id, createdAt: new Date().toISOString(), profileCompleted: false });
    this.auth.createMemberLogin(m);
    const l = this.lead();
    if (l) {
      const activity: TimelineEntry = { id: `LA-${Date.now()}`, title: 'Converted to member', description: `Member ${m.id} created by ${this.auth.user()?.name}`, at: new Date().toISOString(), tone: 'success', icon: 'user-check' };
      this.leads.updateSync(l.id, { status: 'CONVERTED', memberId: m.id, updatedAt: new Date().toISOString(), activities: [...l.activities, activity] });
      this.audit.record('STATUS_CHANGE', 'Leads', 'Lead', l.id, `Converted lead to member ${m.id}`);
    }
    this.audit.record('CREATE', 'Members', 'Member', m.id, `Created member ${m.firstName} ${m.lastName}`);
    this.toast.success('Member created', `${m.firstName} ${m.lastName} now appears in the member list.`);
    this.created.set(m);
    this.step.set(1);
  }

  protected subscribe(): void {
    const m = this.created();
    const p = this.selectedPlan();
    if (!m || !p) return;
    if (this.collect() === 'now') {
      const session = { kind: 'SUBSCRIPTION' as const, memberId: m.id, locationId: m.locationId, title: `${p.name} membership`, lines: [{ description: `${p.name} – ${p.billingCycle.toLowerCase()} plan`, sac: '997212', qty: 1, rate: p.price, amount: p.price }], securityDeposit: p.securityDeposit, promoScope: null, allowReferral: false, creditsApplied: 0, payload: { planId: p.id }, returnUrl: '', createdAt: Date.now() };
      this.checkout.record(session, this.checkout.totals(session), this.method(), 'SUCCESS');
      this.acct.activateSubscription(m.id, p.id, m.locationId);
      this.audit.record('CREATE', 'Membership', 'Subscription', m.id, `Activated ${p.name} for ${m.firstName} ${m.lastName}`);
    } else {
      const end = new Date();
      end.setDate(end.getDate() + cycleDays(p.billingCycle));
      this.subs.createSync({ memberId: m.id, planId: p.id, locationId: m.locationId, status: 'PENDING_PAYMENT', startDate: todayIso(), endDate: end.toLocaleDateString('en-CA'), billingCycle: p.billingCycle, price: p.price, roomHoursTotal: p.roomHours, roomHoursUsed: 0, guestPassesTotal: p.guestPasses, guestPassesUsed: 0, creditsTotal: p.credits, creditsUsed: 0, securityDeposit: p.securityDeposit, autoRenew: true, paymentRetries: 0, createdAt: new Date().toISOString() });
      this.notify.dispatch({ event: 'Payment Link', audience: 'MEMBER', memberId: m.id, category: 'PAYMENT', title: 'Complete your membership payment', message: `Pay for your ${p.name} plan to activate access.`, link: '/member/membership/plans', recipient: m.email, locationId: m.locationId, channels: ['EMAIL', 'SMS'] });
    }
    this.toast.success(this.collect() === 'now' ? 'Subscription active' : 'Payment link sent');
    this.finish(true);
  }

  protected finish(_withPlan: boolean): void {
    if (!_withPlan) this.selectedPlan.set(null);
    this.step.set(3);
  }
}

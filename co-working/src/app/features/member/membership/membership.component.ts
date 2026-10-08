import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED, addDaysIso, todayIso } from '../../../shared';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { CreditTransactionService, PlanService } from '../../../core/services/data/membership-data.service';
import { ConfirmService, ToastService } from '../../../core/services/ui.service';
import { Plan } from '../../../core/models';
import { LocationService } from '../../../core/services/data/workspace-data.service';

@Component({
  selector: 'app-membership',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Membership" subtitle="Your plan, credits and allowances." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Membership' }]">
        <a class="btn btn-secondary" routerLink="/member/membership/plans"><app-icon name="layers" [size]="16" /> View all plans</a>
      </app-page-header>

      @if (acct.subscription(); as s) {
        @if (s.cancelAt) {
          <div class="alert alert-warning mb-4">
            <app-icon name="alert" />
            <div class="alert-body">
              <div class="alert-title">Cancellation scheduled</div>
              Your plan ends on {{ s.cancelAt | date: 'd MMM y' }} and will not renew. Access and credits remain until then.
              <div class="alert-actions"><button type="button" class="btn btn-secondary btn-sm" (click)="undoCancel()">Keep my plan</button></div>
            </div>
          </div>
        }
        @if (s.scheduledChange; as sc) {
          <div class="alert alert-info mb-4">
            <app-icon name="calendar" />
            <div class="alert-body">
              Downgrade to <strong>{{ plans.name(sc.planId) }}</strong> is scheduled for {{ sc.effective | date: 'd MMM y' }}.
              <div class="alert-actions"><button type="button" class="btn btn-secondary btn-sm" (click)="cancelSchedule()">Cancel downgrade</button></div>
            </div>
          </div>
        }
        @if (s.status === 'OVERDUE' || s.status === 'SUSPENDED') {
          <div class="alert alert-danger mb-4">
            <app-icon name="alert" />
            <div class="alert-body">
              <div class="alert-title">{{ s.status === 'OVERDUE' ? 'Payment overdue' : 'Membership suspended' }}</div>
              Renewal payment failed after {{ s.paymentRetries }} of 3 retries (day 1, 3 and 7).
              {{ s.status === 'OVERDUE' ? 'Access continues until your grace period ends on ' + (s.graceUntil | date: 'd MMM') + '.' : 'Door access has been revoked until dues are cleared.' }}
              <div class="alert-actions"><a class="btn btn-danger btn-sm" routerLink="/member/payments" [queryParams]="{ pay: 'dues' }">Pay {{ acct.outstandingAmount() | inr }} now</a></div>
            </div>
          </div>
        }

        <div class="split">
          <section class="card">
            <div class="card-header">
              <div>
                <div class="eyebrow">Current plan</div>
                <h2 class="text-xl fw-700 mt-1">{{ plans.name(s.planId) }}</h2>
              </div>
              <app-status-badge [status]="s.status" />
            </div>
            <div class="card-body">
              <div class="kv-grid">
                <div class="kv-item"><div class="k">Plan name</div><div class="v">{{ plans.name(s.planId) }}</div></div>
                <div class="kv-item"><div class="k">Status</div><div class="v">{{ s.status | humanize }}</div></div>
                <div class="kv-item"><div class="k">Start date</div><div class="v">{{ s.startDate | date: 'd MMM y' }}</div></div>
                <div class="kv-item"><div class="k">End date</div><div class="v">{{ s.endDate | date: 'd MMM y' }}</div></div>
                <div class="kv-item"><div class="k">Billing cycle</div><div class="v">{{ s.billingCycle | humanize }}</div></div>
                <div class="kv-item"><div class="k">Price</div><div class="v">{{ s.price | inr }} + GST</div></div>
                <div class="kv-item"><div class="k">Room hours</div><div class="v">{{ s.roomHoursTotal - s.roomHoursUsed }} of {{ s.roomHoursTotal }} left</div></div>
                <div class="kv-item"><div class="k">Guest passes</div><div class="v">{{ s.guestPassesTotal - s.guestPassesUsed }} of {{ s.guestPassesTotal }} left</div></div>
                <div class="kv-item"><div class="k">Credits</div><div class="v">{{ s.creditsTotal - s.creditsUsed | inr }} of {{ s.creditsTotal | inr }}</div></div>
                <div class="kv-item"><div class="k">Security deposit</div><div class="v">{{ s.securityDeposit | inr }} (refundable)</div></div>
                <div class="kv-item"><div class="k">Auto-renew</div><div class="v">{{ s.autoRenew ? 'On' : 'Off' }}</div></div>
                <div class="kv-item"><div class="k">Home centre</div><div class="v">{{ locations.name(s.locationId) }}</div></div>
              </div>
            </div>
            <div class="card-footer">
              <span class="text-sm text-muted">Changes are prorated to the day.</span>
              <div class="btn-group">
                @if (s.status === 'PAUSED') {
                  <button type="button" class="btn btn-primary btn-sm" (click)="resume()"><app-icon name="play" [size]="14" /> Resume</button>
                } @else if (s.status === 'ACTIVE') {
                  <a class="btn btn-primary btn-sm" routerLink="/member/membership/plans" [queryParams]="{ mode: 'upgrade' }"><app-icon name="trending-up" [size]="14" /> Upgrade</a>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="openDowngrade()"><app-icon name="trending-down" [size]="14" /> Downgrade</button>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="pauseOpen.set(true)"><app-icon name="pause" [size]="14" /> Pause</button>
                }
                @if (!s.cancelAt && (s.status === 'ACTIVE' || s.status === 'PAUSED')) {
                  <button type="button" class="btn btn-ghost btn-sm text-danger" (click)="cancel()"><app-icon name="x-circle" [size]="14" /> Cancel</button>
                }
              </div>
            </div>
          </section>

          <div class="stack">
            <section class="card card-body">
              <h3 class="section-title">This cycle</h3>
              <div class="stack-sm">
                <div class="row-between text-sm"><span>Credits</span><span class="fw-600">{{ s.creditsUsed | inr }} used</span></div>
                <div class="progress"><span [style.width.%]="pct(s.creditsUsed, s.creditsTotal)"></span></div>
                <div class="row-between text-sm mt-3"><span>Meeting-room hours</span><span class="fw-600">{{ s.roomHoursUsed }} used</span></div>
                <div class="progress success"><span [style.width.%]="pct(s.roomHoursUsed, s.roomHoursTotal)"></span></div>
                <div class="row-between text-sm mt-3"><span>Guest passes</span><span class="fw-600">{{ s.guestPassesUsed }} used</span></div>
                <div class="progress warning"><span [style.width.%]="pct(s.guestPassesUsed, s.guestPassesTotal)"></span></div>
              </div>
            </section>
            <section class="card">
              <div class="card-header"><h3 class="card-title">Credit history</h3></div>
              <ul class="list-plain card-body" style="padding-top: 4px; padding-bottom: 4px; max-height: 300px; overflow-y: auto">
                @for (c of ledger(); track c.id) {
                  <li class="list-row">
                    <div class="min-0">
                      <div class="fw-500 text-sm truncate">{{ c.note }}</div>
                      <div class="text-xs text-muted">{{ c.date | date: 'd MMM y' }} · {{ c.type | humanize }}</div>
                    </div>
                    <span class="tabular fw-600" [class.text-success]="c.amount > 0" [class.text-danger]="c.amount < 0">{{ c.amount > 0 ? '+' : '' }}{{ c.amount | inr }}</span>
                  </li>
                } @empty {
                  <li class="text-sm text-muted" style="padding: 12px 0">No credit activity yet.</li>
                }
              </ul>
            </section>
          </div>
        </div>
      } @else {
        <div class="card">
          <app-empty-state icon="membership" title="You don’t have a membership yet" message="Pick a plan to activate door access, booking credits, meeting-room hours and guest passes.">
            <a class="btn btn-primary" routerLink="/member/membership/plans">Choose a plan</a>
          </app-empty-state>
        </div>
      }
    </div>

    <app-modal [open]="pauseOpen()" title="Pause membership" subtitle="Pausing suspends door access and billing until the date you choose." size="sm" (closed)="pauseOpen.set(false)">
      <div class="field">
        <label class="label" for="pause-until">Pause until <span class="req">*</span></label>
        <input id="pause-until" class="input" type="date" [min]="minPause" [max]="maxPause" [ngModel]="pauseUntil()" (ngModelChange)="pauseUntil.set($event)" />
        <span class="field-hint">You can pause for up to 60 days.</span>
        @if (pauseUntil() && (pauseUntil() < minPause || pauseUntil() > maxPause)) {
          <span class="field-error">Choose a date between {{ minPause }} and {{ maxPause }}.</span>
        }
      </div>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="pauseOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="!pauseUntil() || pauseUntil() < minPause || pauseUntil() > maxPause" (click)="pause()">Pause membership</button>
      </div>
    </app-modal>

    <app-modal [open]="downOpen()" title="Downgrade plan" subtitle="Downgrades take effect at the end of your current cycle." (closed)="downOpen.set(false)">
      <div class="choice-grid">
        @for (p of lowerPlans(); track p.id) {
          <button type="button" class="choice" [class.selected]="downPlan() === p.id" (click)="downPlan.set(p.id)">
            <span class="choice-icon"><app-icon name="membership" /></span>
            <span>
              <span class="choice-title d-block">{{ p.name }}</span>
              <span class="choice-desc d-block">{{ p.price | inr }} / {{ p.billingCycle | humanize }}</span>
            </span>
          </button>
        } @empty {
          <p class="text-muted">You are already on the lowest plan.</p>
        }
      </div>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="downOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="!downPlan()" (click)="downgrade()">Schedule downgrade</button>
      </div>
    </app-modal>
  `,
})
export class MembershipComponent {
  protected readonly acct = inject(MemberAccountService);
  protected readonly plans = inject(PlanService);
  private readonly credits = inject(CreditTransactionService);
  protected readonly locations = inject(LocationService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly pauseOpen = signal(false);
  protected readonly pauseUntil = signal(addDaysIso(todayIso(), 14));
  protected readonly minPause = addDaysIso(todayIso(), 1);
  protected readonly maxPause = addDaysIso(todayIso(), 60);
  protected readonly downOpen = signal(false);
  protected readonly downPlan = signal<string | null>(null);

  protected readonly ledger = computed(() => (this.acct.memberId() ? this.credits.forMember(this.acct.memberId()!) : []));
  protected readonly lowerPlans = computed<Plan[]>(() => {
    const s = this.acct.subscription();
    return this.plans.published().filter((p) => s && p.price < s.price && p.billingCycle !== 'DAILY');
  });

  protected pct(a: number, b: number): number {
    return b ? Math.min(100, Math.round((a / b) * 100)) : 0;
  }

  protected openDowngrade(): void {
    this.downPlan.set(null);
    this.downOpen.set(true);
  }

  protected downgrade(): void {
    const s = this.acct.subscription();
    if (!s || !this.downPlan()) return;
    this.acct.scheduleDowngrade(s.id, this.downPlan()!);
    this.downOpen.set(false);
    this.toast.success('Downgrade scheduled', `Effective ${s.endDate}.`);
  }

  protected cancelSchedule(): void {
    const s = this.acct.subscription();
    if (s) this.acct.cancelScheduledChange(s.id);
    this.toast.info('Downgrade cancelled');
  }

  protected pause(): void {
    const s = this.acct.subscription();
    if (!s) return;
    this.acct.pause(s.id, this.pauseUntil());
    this.pauseOpen.set(false);
    this.toast.warning('Membership paused', 'Door access is suspended until you resume.');
  }

  protected resume(): void {
    const s = this.acct.subscription();
    if (!s) return;
    this.acct.resume(s.id);
    this.toast.success('Membership resumed', 'Access has been restored.');
  }

  protected async cancel(): Promise<void> {
    const s = this.acct.subscription();
    if (!s) return;
    const reason = await this.confirm.prompt({
      title: 'Cancel membership?',
      message: `Your plan will end on ${s.endDate} and won’t renew. You keep access and credits until then. Your security deposit is refunded within 7 working days after exit.`,
      confirmText: 'Cancel membership',
      cancelText: 'Keep plan',
      tone: 'danger',
      input: { label: 'Why are you leaving?', placeholder: 'Moving offices, budget, remote work…', required: true },
    });
    if (reason === null) return;
    this.acct.cancel(s.id, reason);
    this.toast.info('Cancellation scheduled', `Your plan ends on ${s.endDate}.`);
  }

  protected undoCancel(): void {
    const s = this.acct.subscription();
    if (s) this.acct.undoCancel(s.id);
    this.toast.success('Your plan will continue to renew');
  }
}

import { SettingsService } from '../../../core/services/settings.service';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED, createLoader } from '../../../shared';
import { PlanCardComponent } from '../../../shared/components/domain/domain-cards.component';
import { Plan } from '../../../core/models';
import { PlanService } from '../../../core/services/data/membership-data.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { CheckoutService } from '../../../core/services/checkout.service';
import { ToastService } from '../../../core/services/ui.service';

/** Member plan catalogue → subscribe (new) or upgrade (prorated) via the generic checkout. */
@Component({
  selector: 'app-member-plans',
  imports: [...SHARED, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header
        [title]="mode() === 'upgrade' ? 'Upgrade your plan' : 'Membership plans'"
        [subtitle]="mode() === 'upgrade' ? 'Upgrades start today. You only pay the prorated difference for the rest of this cycle.' : 'Flexible plans for individuals and teams. Prices exclude ' + gstPct + '% GST.'"
        [breadcrumbs]="[{ label: 'Membership', link: '/member/membership' }, { label: 'Plans' }]"
      />
      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="4" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else {
        <div class="grid grid-4 plans-grid">
          @for (p of visible(); track p.id) {
            <app-plan-card [plan]="p" [current]="isCurrent(p)" [disabled]="isDisabled(p)" [cta]="ctaFor(p)" (choose)="choose($event)" />
          }
        </div>
        <section class="card card-body mt-5">
          <h2 class="section-title">Good to know</h2>
          <ul class="check-list">
            <li><app-icon name="check" [size]="16" /> Credits are used first when you book; any balance is charged at checkout.</li>
            <li><app-icon name="check" [size]="16" /> Upgrades are immediate and prorated; downgrades apply from your next cycle.</li>
            <li><app-icon name="check" [size]="16" /> Pause for up to 60 days. Door access is suspended while paused.</li>
            <li><app-icon name="check" [size]="16" /> Security deposits are refundable within 7 working days after you exit.</li>
          </ul>
        </section>
      }
    </div>
  `,
  styles: `.plans-grid { align-items: stretch; padding-top: 10px; } @media (max-width: 1199px) { .plans-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } } @media (max-width: 767px) { .plans-grid { grid-template-columns: minmax(0, 1fr); } }`,
})
export class MemberPlansComponent {
  /** GST rate from Settings → Business rules (database). */
  protected readonly gstPct = inject(SettingsService).settings().gstRate;
  readonly mode = input<'upgrade' | ''>('');
  private readonly plans = inject(PlanService);
  private readonly acct = inject(MemberAccountService);
  private readonly checkout = inject(CheckoutService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loader = createLoader(() => this.plans.list());
  protected readonly visible = computed(() => this.plans.published().filter((p) => p.billingCycle !== 'QUARTERLY' || this.mode() !== 'upgrade'));
  private readonly activeSub = computed(() => {
    const s = this.acct.subscription();
    return s && ['ACTIVE', 'PAUSED', 'OVERDUE'].includes(s.status) ? s : undefined;
  });

  protected isCurrent(p: Plan): boolean {
    return this.activeSub()?.planId === p.id;
  }

  protected isDisabled(p: Plan): boolean {
    const s = this.activeSub();
    if (!s) return false;
    if (s.status !== 'ACTIVE') return true;
    return this.mode() === 'upgrade' && p.price <= s.price;
  }

  protected ctaFor(p: Plan): string {
    const s = this.activeSub();
    if (!s) return p.type === 'DAY_PASS' ? 'Buy day pass' : 'Subscribe';
    if (p.price > s.price) return 'Upgrade';
    if (p.price < s.price) return 'Downgrade';
    return 'Switch';
  }

  protected choose(p: Plan): void {
    const member = this.acct.member();
    if (!member) return;
    const s = this.activeSub();
    if (s && p.price < s.price) {
      this.toast.info('Downgrades start next cycle', 'Use Downgrade on your membership page to schedule it.');
      this.router.navigateByUrl('/member/membership');
      return;
    }
    if (s && p.price > s.price) {
      const { remainingDays, amount } = this.acct.prorate(s, p);
      const depositTopUp = Math.max(0, p.securityDeposit - s.securityDeposit);
      this.checkout.start({
        kind: 'UPGRADE',
        memberId: member.id,
        locationId: member.locationId,
        title: `Upgrade to ${p.name}`,
        lines: [{ description: `Prorated upgrade: ${this.acct.plan()?.name} → ${p.name} (${remainingDays} days)`, sac: '997212', qty: 1, rate: amount, amount }],
        securityDeposit: depositTopUp,
        promoScope: null,
        allowReferral: true,
        creditsApplied: 0,
        payload: { planId: p.id, subscriptionId: s.id },
        returnUrl: '/member/membership',
      });
    } else {
      this.checkout.start({
        kind: p.type === 'DAY_PASS' ? 'DAY_PASS' : 'SUBSCRIPTION',
        memberId: member.id,
        locationId: member.locationId,
        title: `${p.name} membership`,
        lines: [{ description: `${p.name} – ${p.billingCycle.toLowerCase()} plan`, sac: '997212', qty: 1, rate: p.price, amount: p.price }],
        securityDeposit: p.securityDeposit,
        promoScope: 'PLANS',
        allowReferral: true,
        creditsApplied: 0,
        payload: { planId: p.id },
        returnUrl: '/member/membership',
      });
    }
    this.router.navigateByUrl('/member/checkout');
  }
}

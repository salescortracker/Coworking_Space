import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SHARED, createLoader, todayIso } from '../../../shared';
import { BookingCardComponent } from '../../../shared/components/domain/domain-cards.component';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { BookingService, PaymentService } from '../../../core/services/data/transaction-data.service';
import { ResourceService } from '../../../core/services/data/workspace-data.service';
import { NotificationCenterService } from '../../../core/services/notification.service';
import { PAYMENT_TYPE_LABELS } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-member-dashboard',
  imports: [...SHARED, BookingCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header [title]="'Good ' + greeting() + ', ' + firstName()" subtitle="Here’s what’s happening with your workspace today.">
        <a class="btn btn-secondary" routerLink="/member/visitors/new"><app-icon name="user-plus" [size]="16" /> Invite visitor</a>
        <a class="btn btn-primary" routerLink="/member/bookings/new"><app-icon name="plus" [size]="16" /> Book workspace</a>
      </app-page-header>

      @if (loader.status() === 'loading') {
        <app-loading-state variant="stats" [rows]="6" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else {
        <div class="stack-sm mb-5">
          @if (!acct.plan()) {
            <div class="alert alert-info">
              <app-icon name="info" />
              <div class="alert-body">
                <div class="alert-title">Activate a membership</div>
                Choose a plan to unlock door access, booking credits, meeting-room hours and guest passes.
                <div class="alert-actions"><a class="btn btn-primary btn-sm" routerLink="/member/membership/plans">View plans</a></div>
              </div>
            </div>
          }
          @if (acct.accessState() === 'OVERDUE' || acct.outstandingAmount() > 0) {
            <div class="alert alert-danger">
              <app-icon name="alert" />
              <div class="alert-body">
                <div class="alert-title">Payment overdue · {{ acct.outstandingAmount() | inr }}</div>
                Your last renewal payment failed. Pay now to avoid suspension of door access.
                <div class="alert-actions"><a class="btn btn-danger btn-sm" routerLink="/member/payments" [queryParams]="{ pay: 'dues' }">Pay now</a></div>
              </div>
            </div>
          }
          @if (acct.accessState() === 'SUSPENDED') {
            <div class="alert alert-warning">
              <app-icon name="pause" />
              <div class="alert-body">
                <div class="alert-title">Membership {{ acct.subscription()?.status === 'PAUSED' ? 'paused' : 'suspended' }}</div>
                Door access is disabled{{ acct.subscription()?.pausedUntil ? ' until ' + acct.subscription()?.pausedUntil : '' }}.
                <div class="alert-actions"><a class="btn btn-secondary btn-sm" routerLink="/member/membership">Manage membership</a></div>
              </div>
            </div>
          }
          @if (acct.plan() && acct.daysToRenewal() !== null && acct.daysToRenewal()! <= 7 && acct.daysToRenewal()! >= 0 && !acct.subscription()?.cancelAt) {
            <div class="alert alert-info">
              <app-icon name="calendar" />
              <div class="alert-body">Your {{ acct.plan()?.name }} plan renews in {{ acct.daysToRenewal() }} day{{ acct.daysToRenewal() === 1 ? '' : 's' }} ({{ acct.subscription()?.endDate | date: 'd MMM' }}).</div>
            </div>
          }
        </div>

        <div class="stat-grid">
          <app-stat-card label="Active Membership" [value]="acct.plan()?.name ?? 'None'" icon="membership" [hint]="acct.subscription() ? (acct.subscription()!.status | humanize) : 'Choose a plan'" link="/member/membership" />
          <app-stat-card label="Upcoming Booking" [value]="nextBooking() ? (nextBooking()!.date | date: 'd MMM') + ' · ' + nextBooking()!.startTime : 'None'" icon="calendar" tone="info" [hint]="nextBooking() ? resources.name(nextBooking()!.resourceId) : 'Book a desk or room'" [link]="nextBooking() ? '/member/bookings/' + nextBooking()!.id : '/member/bookings/new'" />
          <app-stat-card label="Remaining Credits" [value]="acct.creditsRemaining() | inr" icon="wallet" tone="success" [hint]="'of ' + ((acct.subscription()?.creditsTotal ?? 0) | inr)" link="/member/membership" />
          <app-stat-card label="Room Hours" [value]="acct.roomHoursRemaining() + ' hrs'" icon="clock" tone="warning" [hint]="'of ' + (acct.subscription()?.roomHoursTotal ?? 0) + ' this cycle'" />
          <app-stat-card label="Guest Passes" [value]="acct.guestPassesRemaining()" icon="user-plus" tone="primary" [hint]="'of ' + (acct.subscription()?.guestPassesTotal ?? 0) + ' this cycle'" link="/member/visitors" />
          <app-stat-card label="Outstanding Amount" [value]="acct.outstandingAmount() | inr" icon="receipt" [tone]="acct.outstandingAmount() > 0 ? 'danger' : 'neutral'" [hint]="acct.outstandingAmount() > 0 ? 'Payment due' : 'All settled'" link="/member/payments" />
        </div>

        <section class="card mt-5">
          <div class="card-header"><h2 class="card-title">Quick actions</h2></div>
          <div class="card-body quick-actions">
            @for (q of quick; track q.label) {
              <a class="quick" [routerLink]="q.link" [queryParams]="q.query ?? null">
                <span class="stat-icon tone-{{ q.tone }}"><app-icon [name]="q.icon" [size]="20" /></span>
                <span class="fw-500">{{ q.label }}</span>
              </a>
            }
          </div>
        </section>

        <div class="split mt-5">
          <div class="stack">
            <section class="card">
              <div class="card-header">
                <h2 class="card-title">Upcoming bookings</h2>
                <a routerLink="/member/bookings" class="btn btn-ghost btn-sm">View all</a>
              </div>
              @for (b of upcoming(); track b.id) {
                <app-booking-card [booking]="b" [link]="['/member/bookings', b.id]" />
              } @empty {
                <app-empty-state [compact]="true" icon="calendar" title="No upcoming bookings" message="Reserve a desk or meeting room in a few taps.">
                  <a routerLink="/member/bookings/new" class="btn btn-primary btn-sm">Book now</a>
                </app-empty-state>
              }
            </section>
            <section class="card">
              <div class="card-header">
                <h2 class="card-title">Recent payments</h2>
                <a routerLink="/member/payments" class="btn btn-ghost btn-sm">View all</a>
              </div>
              <div class="card-body flush">
                @if (recentPayments().length) {
                  <table class="table responsive">
                    <thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      @for (p of recentPayments(); track p.id) {
                        <tr>
                          <td data-label="Date">{{ p.date | date: 'd MMM y' }}</td>
                          <td data-label="Description"><span class="cell-primary">{{ p.description }}</span><span class="cell-sub">{{ typeLabels[p.type] }}</span></td>
                          <td data-label="Amount" class="num">{{ p.amount | inr }}</td>
                          <td data-label="Status"><app-status-badge [status]="p.status" /></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <app-empty-state [compact]="true" icon="credit-card" title="No payments found." />
                }
              </div>
            </section>
          </div>
          <div class="stack">
            <section class="card">
              <div class="card-header">
                <h2 class="card-title">Membership status</h2>
                @if (acct.subscription(); as s) {
                  <app-status-badge [status]="s.status" />
                }
              </div>
              <div class="card-body">
                @if (acct.subscription(); as s) {
                  <div class="fw-600 text-md">{{ acct.plan()?.name ?? 'No active plan' }}</div>
                  <div class="text-sm text-muted mb-4">{{ s.startDate | date: 'd MMM' }} – {{ s.endDate | date: 'd MMM y' }} · {{ s.billingCycle | humanize }}</div>
                  <div class="stack-sm">
                    <div class="row-between text-sm"><span>Credits used</span><span>{{ s.creditsUsed | inr }} / {{ s.creditsTotal | inr }}</span></div>
                    <div class="progress"><span [style.width.%]="pct(s.creditsUsed, s.creditsTotal)"></span></div>
                    <div class="row-between text-sm mt-2"><span>Room hours used</span><span>{{ s.roomHoursUsed }} / {{ s.roomHoursTotal }}</span></div>
                    <div class="progress success"><span [style.width.%]="pct(s.roomHoursUsed, s.roomHoursTotal)"></span></div>
                    <div class="row-between text-sm mt-2"><span>Guest passes used</span><span>{{ s.guestPassesUsed }} / {{ s.guestPassesTotal }}</span></div>
                    <div class="progress warning"><span [style.width.%]="pct(s.guestPassesUsed, s.guestPassesTotal)"></span></div>
                  </div>
                } @else {
                  <app-empty-state [compact]="true" icon="membership" title="No membership yet"><a routerLink="/member/membership/plans" class="btn btn-primary btn-sm">Choose a plan</a></app-empty-state>
                }
              </div>
              <div class="card-footer">
                <a routerLink="/member/access" class="btn btn-ghost btn-sm"><app-icon name="qr" [size]="16" /> Access QR</a>
                <a routerLink="/member/membership" class="btn btn-secondary btn-sm">Manage</a>
              </div>
            </section>
            <section class="card">
              <div class="card-header">
                <h2 class="card-title">Notifications</h2>
                <a routerLink="/member/notifications" class="btn btn-ghost btn-sm">View all</a>
              </div>
              <ul class="list-plain card-body" style="padding-top: 4px; padding-bottom: 4px">
                @for (n of notifications(); track n.id) {
                  <li class="list-row">
                    <div class="min-0">
                      <div class="fw-500 text-sm" [class.text-primary]="!n.read">{{ n.title }}</div>
                      <div class="text-xs text-muted truncate">{{ n.message }}</div>
                    </div>
                    <span class="text-xs text-muted nowrap">{{ n.at | ago }}</span>
                  </li>
                } @empty {
                  <li class="text-muted text-sm" style="padding: 12px 0">You’re all caught up.</li>
                }
              </ul>
            </section>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .quick-actions { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .quick { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 8px; border: 1px solid var(--border); border-radius: 8px; color: var(--text); text-decoration: none; text-align: center; }
    .quick:hover { border-color: var(--primary-200); background: var(--primary-50); text-decoration: none; color: var(--text); }
    @media (max-width: 767px) { .quick-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  `,
})
export class MemberDashboardComponent {
  protected readonly acct = inject(MemberAccountService);
  private readonly bookings = inject(BookingService);
  private readonly payments = inject(PaymentService);
  protected readonly resources = inject(ResourceService);
  private readonly center = inject(NotificationCenterService);
  private readonly auth = inject(AuthService);
  protected readonly typeLabels = PAYMENT_TYPE_LABELS;

  protected readonly loader = createLoader(() => this.bookings.list());
  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  });
  protected readonly upcoming = computed(() => {
    const t = todayIso();
    return this.bookings
      .forMember(this.acct.memberId())
      .filter((b) => b.date >= t && (b.status === 'CONFIRMED' || b.status === 'PENDING'))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
      .slice(0, 4);
  });
  protected readonly nextBooking = computed(() => this.upcoming()[0]);
  protected readonly recentPayments = computed(() => this.payments.forMember(this.acct.memberId()).slice(0, 5));
  protected readonly notifications = computed(() => this.center.mine().slice(0, 5));

  protected readonly quick = [
    { label: 'Book Workspace', icon: 'calendar', link: '/member/bookings/new', tone: 'primary' },
    { label: 'Invite Visitor', icon: 'user-plus', link: '/member/visitors/new', tone: 'info' },
    { label: 'Raise Ticket', icon: 'support', link: '/member/support/new', tone: 'warning' },
    { label: 'View QR', icon: 'qr', link: '/member/access', tone: 'success' },
    { label: 'Upgrade Plan', icon: 'trending-up', link: '/member/membership/plans', tone: 'primary', query: { mode: 'upgrade' } },
  ];

  protected pct(used: number, total: number): number {
    return total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  }
}

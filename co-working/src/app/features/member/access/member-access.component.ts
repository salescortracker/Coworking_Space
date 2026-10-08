import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SHARED } from '../../../shared';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { AccessCredentialService, AccessLogService } from '../../../core/services/data/operations-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { OperationsService, ScanResult } from '../../../core/services/operations.service';

/** Member Access / QR (§14, flow 9). States: ACTIVE, EXPIRED, SUSPENDED, OVERDUE. */
@Component({
  selector: 'app-member-access',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Access / QR" subtitle="Scan this code at the turnstile or reception." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Access / QR' }]" />

      @switch (state()) {
        @case ('EXPIRED') {
          <div class="alert alert-warning mb-4">
            <app-icon name="alert" />
            <div class="alert-body">
              <div class="alert-title">Your membership has expired</div>
              Renew your plan to reactivate door access, credits and guest passes.
              <div class="alert-actions"><a class="btn btn-primary btn-sm" routerLink="/member/membership/plans">Renew membership</a></div>
            </div>
          </div>
        }
        @case ('OVERDUE') {
          <div class="alert alert-danger mb-4">
            <app-icon name="alert" />
            <div class="alert-body">
              <div class="alert-title">Payment overdue</div>
              Access stays active until your grace period ends on {{ acct.subscription()?.graceUntil | date: 'd MMM' }}. After that it will be revoked automatically.
              <div class="alert-actions"><a class="btn btn-danger btn-sm" routerLink="/member/payments" [queryParams]="{ pay: 'dues' }">Pay {{ acct.outstandingAmount() | inr }}</a></div>
            </div>
          </div>
        }
        @case ('SUSPENDED') {
          <div class="alert alert-danger mb-4">
            <app-icon name="lock" />
            <div class="alert-body">
              <div class="alert-title">Access suspended</div>
              {{ acct.subscription()?.status === 'PAUSED' ? 'Your membership is paused until ' + acct.subscription()?.pausedUntil + '.' : 'Your plan was suspended after unsuccessful payment retries.' }}
              <div class="alert-actions">
                @if (acct.subscription()?.status === 'PAUSED') {
                  <a class="btn btn-primary btn-sm" routerLink="/member/membership">Resume membership</a>
                } @else {
                  <a class="btn btn-danger btn-sm" routerLink="/member/payments" [queryParams]="{ pay: 'dues' }">Pay dues to restore access</a>
                }
              </div>
            </div>
          </div>
        }
      }

      <div class="split-rev">
        <section class="card card-body" style="display: flex; flex-direction: column; align-items: center; gap: 16px">
          <span class="access-indicator tone-{{ tone() }}"><span class="pulse"></span> {{ state() }}</span>
          <app-qr-card [value]="credential()?.code ?? 'NO-CREDENTIAL'" [title]="acct.member() ? acct.member()!.firstName + ' ' + acct.member()!.lastName : ''" [subtitle]="acct.plan()?.name ?? 'No active plan'" caption="Member access" [active]="state() === 'ACTIVE' || state() === 'OVERDUE'" [inactiveText]="state() === 'EXPIRED' ? 'Expired' : 'Suspended'" [size]="190" />
          <button type="button" class="btn btn-secondary btn-sm" (click)="simulate()"><app-icon name="scan" [size]="14" /> Demo: scan at turnstile</button>
          @if (scan(); as s) {
            <div class="alert w-100" [class.alert-success]="s.valid" [class.alert-danger]="!s.valid" role="status">
              <app-icon [name]="s.valid ? 'unlock' : 'lock'" />
              <div class="alert-body">
                <div class="alert-title">{{ s.valid ? 'Door opened · entry logged' : 'Access denied' }}</div>
                <ul class="list-plain text-sm">
                  @for (c of s.checks; track c.label) {
                    <li><app-icon [name]="c.ok ? 'check' : 'x'" [size]="12" /> {{ c.label }}</li>
                  }
                </ul>
              </div>
            </div>
          }
        </section>
        <div class="stack">
          <section class="card">
            <div class="card-header"><h2 class="card-title">Access details</h2></div>
            <div class="card-body">
              <div class="kv-grid">
                <div class="kv-item"><div class="k">Current status</div><div class="v"><app-status-badge [status]="state()" /></div></div>
                <div class="kv-item"><div class="k">Active plan</div><div class="v">{{ acct.plan()?.name ?? 'None' }}</div></div>
                <div class="kv-item"><div class="k">Access hours</div><div class="v">{{ acct.plan()?.accessHours ?? '—' }}</div></div>
                <div class="kv-item"><div class="k">Location</div><div class="v">{{ locations.name(acct.member()?.locationId) }}</div></div>
                <div class="kv-item"><div class="k">Credential</div><div class="v mono">{{ credential()?.code ?? '—' }}</div></div>
                <div class="kv-item"><div class="k">Valid until</div><div class="v">{{ acct.subscription()?.endDate | date: 'd MMM y' }}</div></div>
              </div>
              <h3 class="section-title mt-5">Doors you can use</h3>
              <ul class="check-list">
                @for (d of doors; track d) {
                  <li><app-icon [name]="state() === 'ACTIVE' || state() === 'OVERDUE' ? 'check' : 'x'" [size]="16" /> {{ d }}</li>
                }
              </ul>
            </div>
          </section>
          <section class="card">
            <div class="card-header"><h2 class="card-title">Recent entries</h2></div>
            <ul class="list-plain card-body" style="padding-top: 4px; padding-bottom: 4px">
              @for (l of recent(); track l.id) {
                <li class="list-row">
                  <span><span class="fw-500">{{ l.direction === 'IN' ? 'Entry' : 'Exit' }}</span> · {{ l.door }}<span class="d-block text-xs text-muted">{{ l.at | date: 'd MMM, h:mm a' }}{{ l.reason ? ' · ' + l.reason : '' }}</span></span>
                  <app-status-badge [status]="l.status" />
                </li>
              } @empty {
                <li class="text-muted text-sm" style="padding: 12px 0">No entries yet.</li>
              }
            </ul>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class MemberAccessComponent {
  protected readonly acct = inject(MemberAccountService);
  private readonly creds = inject(AccessCredentialService);
  private readonly logs = inject(AccessLogService);
  protected readonly locations = inject(LocationService);
  private readonly ops = inject(OperationsService);
  protected readonly doors = ['Main Entrance', 'Lobby Turnstiles', 'Floor 4 Door', 'Parking Gate'];
  protected readonly scan = signal<ScanResult | null>(null);
  protected readonly state = this.acct.accessState;
  protected readonly tone = computed(() => ({ ACTIVE: 'success', OVERDUE: 'warning', SUSPENDED: 'danger', EXPIRED: 'neutral' })[this.state()]);
  protected readonly credential = computed(() => this.creds.items().find((c) => c.holderId === this.acct.memberId()));
  protected readonly recent = computed(() => this.logs.items().filter((l) => l.personId === this.acct.memberId()).slice(0, 6));

  protected simulate(): void {
    const c = this.credential();
    const m = this.acct.member();
    if (!c || !m) return;
    this.scan.set(this.ops.scan(c.code, m.locationId, 'Lobby Turnstile 1'));
  }
}

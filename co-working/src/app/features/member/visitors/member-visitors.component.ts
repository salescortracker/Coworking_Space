import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, emailValidator, futureDateValidator, mobileValidator, todayIso } from '../../../shared';
import { TimelineEntry, Visitor } from '../../../core/models';
import { VisitorService } from '../../../core/services/data/operations-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { MemberService } from '../../../core/services/data/people-data.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { OperationsService } from '../../../core/services/operations.service';
import { ConfirmService, ToastService } from '../../../core/services/ui.service';
import { SpinnerService } from '../../../core/services/spinner.service';

@Component({
  selector: 'app-member-visitors',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="My Visitors" subtitle="Invite guests and share their QR visitor pass." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Visitors' }]">
        <a class="btn btn-primary" routerLink="/member/visitors/new"><app-icon name="user-plus" [size]="16" /> Add visitor</a>
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Guest passes left" [value]="acct.guestPassesRemaining()" icon="ticket" [hint]="'of ' + (acct.subscription()?.guestPassesTotal ?? 0) + ' this cycle'" />
        <app-stat-card label="Upcoming visitors" [value]="upcoming().length" icon="calendar" tone="info" />
        <app-stat-card label="Visitors this month" [value]="thisMonth()" icon="users" tone="success" />
      </div>
      <app-tabs [tabs]="tabs()" [(value)]="tab" label="Visitor lists" />
      <div class="mt-4">
        <app-data-table
          [rows]="tab() === 'upcoming' ? upcoming() : past()"
          [columns]="cols"
          [status]="loader.status()"
          (retry)="loader.load()"
          [defaultSort]="{ key: 'visitDate', dir: tab() === 'upcoming' ? 'asc' : 'desc' }"
          searchPlaceholder="Search visitor"
          emptyTitle="No visitors found."
          [emptyMessage]="tab() === 'upcoming' ? 'Invite a guest and they’ll receive a QR pass by SMS and email.' : ''"
          emptyIcon="user-plus"
          [rowClickable]="true"
          (rowClick)="router.navigate(['/member/visitors', $event.id])"
          caption="Visitors"
        >
          <a empty-action class="btn btn-primary btn-sm" routerLink="/member/visitors/new">Add visitor</a>
          <ng-template appCell="name" let-row>
            <span class="cell-primary d-block">{{ row.name }}</span>
            <span class="cell-sub">{{ row.company ?? row.mobile }}</span>
          </ng-template>
        </app-data-table>
      </div>
    </div>
  `,
})
export class MemberVisitorsComponent {
  protected readonly acct = inject(MemberAccountService);
  private readonly visitors = inject(VisitorService);
  private readonly locations = inject(LocationService);
  protected readonly router = inject(Router);
  protected readonly loader = createLoader(() => this.visitors.list());
  protected readonly tab = signal('upcoming');
  private readonly mine = computed(() => this.visitors.items().filter((v) => v.hostMemberId === this.acct.memberId()));
  protected readonly upcoming = computed(() => this.mine().filter((v) => v.visitDate >= todayIso() && (v.status === 'EXPECTED' || v.status === 'CHECKED_IN')));
  protected readonly past = computed(() => this.mine().filter((v) => !this.upcoming().includes(v)));
  protected readonly thisMonth = computed(() => this.mine().filter((v) => v.visitDate.slice(0, 7) === todayIso().slice(0, 7)).length);
  protected readonly tabs = computed(() => [
    { id: 'upcoming', label: 'Upcoming Visitors', count: this.upcoming().length },
    { id: 'past', label: 'Past Visitors', count: this.past().length },
  ]);
  protected readonly cols: Column<Visitor>[] = [
    { key: 'name', label: 'Visitor', primary: true },
    { key: 'visitDate', label: 'Date', type: 'date', sortValue: (v) => v.visitDate + v.visitTime },
    { key: 'visitTime', label: 'Time' },
    { key: 'purpose', label: 'Purpose', hideMobile: true },
    { key: 'location', label: 'Location', value: (v) => this.locations.shortName(v.locationId), hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];
}

@Component({
  selector: 'app-visitor-form',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header title="Add visitor" subtitle="Your visitor receives a QR pass by SMS and email." [breadcrumbs]="[{ label: 'Visitors', link: '/member/visitors' }, { label: 'Add visitor' }]" />
      @if (acct.guestPassesRemaining() === 0 && acct.subscription()) {
        <div class="alert alert-warning mb-4"><app-icon name="alert" /><div class="alert-body">You’ve used all guest passes this cycle. Extra visitors may be charged at the front desk.</div></div>
      }
      <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="card-body form-grid">
          <div class="field span-2"><label class="label" for="vn">Visitor name <span class="req">*</span></label><input id="vn" class="input" formControlName="name" autocomplete="off" /><app-field-error [control]="form.controls.name" label="Visitor name" /></div>
          <div class="field"><label class="label" for="vm">Mobile <span class="req">*</span></label><input id="vm" class="input" inputmode="numeric" maxlength="10" formControlName="mobile" autocomplete="off" /><app-field-error [control]="form.controls.mobile" label="Mobile" /></div>
          <div class="field"><label class="label" for="ve">Email <span class="req">*</span></label><input id="ve" class="input" type="email" formControlName="email" autocomplete="off" /><app-field-error [control]="form.controls.email" label="Email" /></div>
          <div class="field"><label class="label" for="vc">Company</label><input id="vc" class="input" formControlName="company" /></div>
          <div class="field">
            <label class="label" for="vl">Location <span class="req">*</span></label>
            <select id="vl" class="select" formControlName="locationId">
              @for (l of locations.active(); track l.id) {
                <option [value]="l.id">{{ l.name }}</option>
              }
            </select>
          </div>
          <div class="field"><label class="label" for="vd">Visit date <span class="req">*</span></label><input id="vd" class="input" type="date" [min]="today" formControlName="visitDate" /><app-field-error [control]="form.controls.visitDate" label="Visit date" /></div>
          <div class="field"><label class="label" for="vt">Visit time <span class="req">*</span></label><input id="vt" class="input" type="time" min="07:00" max="21:00" formControlName="visitTime" /><app-field-error [control]="form.controls.visitTime" label="Visit time" /></div>
          <div class="field span-2">
            <label class="label" for="vp">Purpose <span class="req">*</span></label>
            <select id="vp" class="select" formControlName="purpose">
              <option value="">Select purpose</option>
              @for (p of purposes; track p) {
                <option [value]="p">{{ p }}</option>
              }
            </select>
            <app-field-error [control]="form.controls.purpose" label="Purpose" />
          </div>
        </div>
        <div class="card-footer">
          <a class="btn btn-secondary" routerLink="/member/visitors">Cancel</a>
          <button type="submit" class="btn btn-primary" [disabled]="form.invalid || busy()" [appBusy]="busy()" busyText="Saving…">
            Save & send pass
          </button>
        </div>
      </form>
    </div>
  `,
})
export class VisitorFormComponent {
  protected readonly acct = inject(MemberAccountService);
  protected readonly locations = inject(LocationService);
  private readonly ops = inject(OperationsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly today = todayIso();
  protected readonly busy = signal(false);
  private readonly spinner = inject(SpinnerService);
  protected readonly purposes = ['Client meeting', 'Interview', 'Partnership discussion', 'Vendor demo', 'Investor meeting', 'Delivery', 'Team workshop', 'Personal'];
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    mobile: ['', [Validators.required, mobileValidator]],
    email: ['', [Validators.required, emailValidator]],
    company: [''],
    locationId: [this.acct.member()?.locationId ?? '', Validators.required],
    visitDate: [todayIso(), [Validators.required, futureDateValidator]],
    visitTime: ['11:00', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    purpose: ['', Validators.required],
  });

  protected save(): void {
    const m = this.acct.member();
    if (this.form.invalid || !m) return this.form.markAllAsTouched();
    if (this.busy()) return; // ignore repeat clicks while running
    this.busy.set(true);
    this.spinner.after(
      400,
      () => {
        try {
          const v = this.ops.createVisitor({ ...this.form.getRawValue(), company: this.form.controls.company.value || undefined, hostMemberId: m.id });
          this.toast.success('Visitor pass created', `QR pass sent to ${v.name} by SMS and email.`);
          this.router.navigate(['/member/visitors', v.id], { queryParams: { created: 1 } });
        } finally {
          this.busy.set(false);
        }
      },
      { message: 'Generating visitor pass…' },
    );
  }
}

@Component({
  selector: 'app-visitor-detail',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (visitor(); as v) {
        <app-page-header [title]="v.name" [subtitle]="v.purpose + ' · ' + locations.name(v.locationId)" [breadcrumbs]="[{ label: 'Visitors', link: '/member/visitors' }, { label: v.name }]">
          <app-status-badge badge [status]="v.status" />
          @if (v.status === 'EXPECTED') {
            <button type="button" class="btn btn-secondary" (click)="resend(v)"><app-icon name="send" [size]="16" /> Resend pass</button>
            <button type="button" class="btn btn-danger" (click)="cancel(v)">Cancel visit</button>
          }
        </app-page-header>
        @if (created()) {
          <div class="alert alert-success mb-4"><app-icon name="check-circle" /><div class="alert-body">Pass generated and sent to {{ v.mobile | mobile }} and {{ v.email }}.</div></div>
        }
        <div class="split-rev">
          <section class="card card-body" style="display: flex; justify-content: center">
            <app-qr-card [value]="v.passCode" [title]="v.name" [subtitle]="(v.visitDate | date: 'EEE, d MMM') + ' · ' + (v.visitTime | time12)" caption="Visitor pass" [active]="v.status === 'EXPECTED' || v.status === 'CHECKED_IN'" [inactiveText]="v.status === 'CHECKED_OUT' ? 'Pass expired' : (v.status | humanize)" />
          </section>
          <section class="card">
            <div class="card-header"><h2 class="card-title">Visit details</h2></div>
            <div class="card-body">
              <div class="kv-grid">
                <div class="kv-item"><div class="k">Visitor</div><div class="v">{{ v.name }}</div></div>
                <div class="kv-item"><div class="k">Company</div><div class="v">{{ v.company ?? '—' }}</div></div>
                <div class="kv-item"><div class="k">Mobile</div><div class="v">{{ v.mobile | mobile }}</div></div>
                <div class="kv-item"><div class="k">Email</div><div class="v">{{ v.email }}</div></div>
                <div class="kv-item"><div class="k">Host</div><div class="v">{{ members.fullName(v.hostMemberId) }}</div></div>
                <div class="kv-item"><div class="k">Date</div><div class="v">{{ v.visitDate | date: 'd MMM y' }}</div></div>
                <div class="kv-item"><div class="k">Time</div><div class="v">{{ v.visitTime | time12 }}</div></div>
                <div class="kv-item"><div class="k">Status</div><div class="v"><app-status-badge [status]="v.status" /></div></div>
                <div class="kv-item"><div class="k">Checked in</div><div class="v">{{ v.checkInAt ? (v.checkInAt | date: 'h:mm a') : '—' }}</div></div>
                <div class="kv-item"><div class="k">Checked out</div><div class="v">{{ v.checkOutAt ? (v.checkOutAt | date: 'h:mm a') : '—' }}</div></div>
              </div>
              <h3 class="section-title mt-5">Visitor journey</h3>
              <app-timeline [items]="journey()" />
            </div>
          </section>
        </div>
      } @else {
        <div class="card"><app-empty-state icon="user-plus" title="Visitor not found"><a class="btn btn-secondary" routerLink="/member/visitors">Back to visitors</a></app-empty-state></div>
      }
    </div>
  `,
})
export class VisitorDetailComponent {
  readonly id = input.required<string>();
  readonly createdParam = input<string>(undefined, { alias: 'created' });
  private readonly visitors = inject(VisitorService);
  protected readonly locations = inject(LocationService);
  protected readonly members = inject(MemberService);
  private readonly ops = inject(OperationsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly visitor = computed(() => this.visitors.find(this.id()));
  protected readonly created = computed(() => !!this.createdParam());
  protected readonly journey = computed(() => {
    const v = this.visitor();
    if (!v) return [];
    const steps: TimelineEntry[] = [{ id: 'j1', title: 'Pass generated', description: 'QR pass sent by SMS and email', at: v.createdAt, tone: 'info', icon: 'qr' }];
    if (v.checkInAt) {
      steps.push({ id: 'j2', title: 'QR scanned & verified', description: 'At front desk', at: v.checkInAt, tone: 'primary', icon: 'scan' });
      if (v.photoCaptured) steps.push({ id: 'j3', title: 'Photo captured', description: 'Visitor photo saved to visit record', at: v.checkInAt, tone: 'primary', icon: 'camera' });
      steps.push({ id: 'j4', title: 'Host notified · Checked in', description: `${this.members.fullName(v.hostMemberId)} notified`, at: v.checkInAt, tone: 'success', icon: 'check' });
    }
    if (v.checkOutAt) steps.push({ id: 'j5', title: 'Checked out · Pass expired', at: v.checkOutAt, tone: 'neutral', icon: 'logout' });
    if (v.status === 'EXPIRED') steps.push({ id: 'j6', title: 'Pass expired (no show)', at: v.visitDate + 'T23:59:00', tone: 'neutral', icon: 'clock' });
    if (v.status === 'CANCELLED') steps.push({ id: 'j7', title: 'Visit cancelled', at: v.createdAt, tone: 'danger', icon: 'x' });
    return steps.reverse();
  });

  protected resend(v: Visitor): void {
    this.toast.success('Pass re-sent', `${v.name} will receive the QR pass again.`);
  }

  protected async cancel(v: Visitor): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Cancel this visit?', message: `${v.name}’s pass will be deactivated.`, confirmText: 'Cancel visit', cancelText: 'Keep', tone: 'danger' });
    if (!ok) return;
    this.ops.cancelVisitor(v.id);
    this.toast.info('Visit cancelled');
  }
}

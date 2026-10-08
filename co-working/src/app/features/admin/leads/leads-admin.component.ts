import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader, downloadCsv, emailValidator, mobileValidator, todayIso, todayStamp } from '../../../shared';
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, Lead, LeadSource, LeadStatus } from '../../../core/models';
import { LeadService } from '../../../core/services/data/engagement-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { UserService } from '../../../core/services/data/people-data.service';
import { LeadCaptureService } from '../../../core/services/lead-capture.service';
import { LocationContextService } from '../../../core/services/location-context.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

const PIPELINE: LeadStatus[] = ['NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'TOUR_DONE', 'CONVERTED', 'LOST'];

/** Lead dashboard + list (§6). */
@Component({
  selector: 'app-leads-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Leads" [subtitle]="'Enquiries from the website, walk-ins and referrals · ' + ctx.label()" [breadcrumbs]="[{ label: 'Leads' }, { label: 'Leads' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
        @if (auth.can('leads.create')) {
          <button type="button" class="btn btn-primary" (click)="newOpen.set(true)"><app-icon name="plus" [size]="16" /> Add lead</button>
        }
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Total Leads" [value]="rows().length" icon="target" />
        <app-stat-card label="New Leads" [value]="count('NEW')" icon="inbox" tone="info" />
        <app-stat-card label="Contacted" [value]="count('CONTACTED')" icon="phone" tone="primary" />
        <app-stat-card label="Tours" [value]="count('TOUR_SCHEDULED') + count('TOUR_DONE')" icon="calendar" tone="warning" />
        <app-stat-card label="Converted" [value]="count('CONVERTED')" icon="user-check" tone="success" />
        <app-stat-card label="Lost" [value]="count('LOST')" icon="x-circle" tone="danger" />
        <app-stat-card label="Conversion Rate" [value]="rate() + '%'" icon="percent" tone="success" />
      </div>
      <div class="grid grid-2 mb-5">
        <app-chart-card title="Lead conversion funnel" subtitle="From enquiry to member">
          <app-funnel-chart [data]="funnel()" />
        </app-chart-card>
        <app-chart-card title="Leads by source">
          <app-donut-chart [data]="bySource()" centerLabel="Leads" />
        </app-chart-card>
      </div>
      <app-data-table
        [rows]="filtered()"
        [columns]="cols"
        [status]="loader.status()"
        (retry)="loader.load()"
        [hasFilters]="true"
        [filtersActive]="!!status() || !!source() || !!owner()"
        (clearFilters)="status.set(''); source.set(''); owner.set('')"
        [defaultSort]="{ key: 'createdAt', dir: 'desc' }"
        searchPlaceholder="Search name, mobile, email or ID"
        emptyTitle="No leads found."
        emptyIcon="target"
        [rowClickable]="true"
        (rowClick)="router.navigate(['/admin/leads', $event.id])"
        caption="Leads"
      >
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            @for (s of pipeline; track s) {
              <option [value]="s">{{ statusLabels[s] }}</option>
            }
          </select>
          <select class="select" aria-label="Source" [ngModel]="source()" (ngModelChange)="source.set($event)">
            <option value="">All sources</option>
            @for (s of sourceKeys; track s) {
              <option [value]="s">{{ sourceLabels[s] }}</option>
            }
          </select>
          <select class="select" aria-label="Owner" [ngModel]="owner()" (ngModelChange)="owner.set($event)">
            <option value="">Any owner</option>
            <option value="__none">Unassigned</option>
            @for (u of owners(); track u.id) {
              <option [value]="u.id">{{ u.name }}</option>
            }
          </select>
        </ng-container>
        <ng-template appCell="status" let-row><app-status-badge [status]="row.status" [label]="labelFor(row.status)" /></ng-template>
        <ng-template appCell="actions" let-row>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/admin/leads', row.id]" aria-label="View"><app-icon name="eye" [size]="16" /></a>
          @if (row.status !== 'CONVERTED' && row.status !== 'LOST' && auth.can('members.create')) {
            <a class="btn btn-ghost btn-sm" routerLink="/admin/members/new" [queryParams]="{ leadId: row.id }">Convert</a>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [open]="newOpen()" title="Add lead" subtitle="For walk-ins, phone enquiries and referrals." (closed)="newOpen.set(false)">
      <form id="lead-form" [formGroup]="form" (ngSubmit)="create()" class="form-grid" novalidate>
        <div class="field"><label class="label" for="ln">Name <span class="req">*</span></label><input id="ln" class="input" formControlName="name" /><app-field-error [control]="form.controls.name" label="Name" /></div>
        <div class="field"><label class="label" for="lm">Mobile <span class="req">*</span></label><input id="lm" class="input" maxlength="10" formControlName="mobile" /><app-field-error [control]="form.controls.mobile" label="Mobile" /></div>
        <div class="field"><label class="label" for="le">Email</label><input id="le" class="input" formControlName="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
        <div class="field"><label class="label" for="ls">Source</label><select id="ls" class="select" formControlName="source">@for (s of sourceKeys; track s) {<option [value]="s">{{ sourceLabels[s] }}</option>}</select></div>
        <div class="field"><label class="label" for="lloc">Location</label><select id="lloc" class="select" formControlName="locationId">@for (l of locations.scoped(); track l.id) {<option [value]="l.id">{{ l.name }}</option>}</select></div>
        <div class="field"><label class="label" for="lf">Follow-up date</label><input id="lf" class="input" type="date" formControlName="followUpDate" /></div>
        <div class="field span-2"><label class="label" for="lr">Requirement <span class="req">*</span></label><input id="lr" class="input" formControlName="requirement" /><app-field-error [control]="form.controls.requirement" label="Requirement" /></div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="newOpen.set(false)">Cancel</button>
        <button type="submit" form="lead-form" class="btn btn-primary" [disabled]="form.invalid">Create lead</button>
      </div>
    </app-modal>
  `,
})
export class LeadsAdminComponent {
  private readonly leads = inject(LeadService);
  protected readonly locations = inject(LocationService);
  private readonly users = inject(UserService);
  private readonly capture = inject(LeadCaptureService);
  protected readonly ctx = inject(LocationContextService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.leads.listScoped());
  protected readonly pipeline = PIPELINE;
  protected readonly statusLabels = LEAD_STATUS_LABELS;
  protected readonly sourceLabels = LEAD_SOURCE_LABELS;
  protected readonly sourceKeys = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[];
  protected readonly status = signal('');
  protected readonly source = signal('');
  protected readonly owner = signal('');
  protected readonly newOpen = signal(false);
  protected readonly rows = computed(() => this.leads.scoped());
  protected readonly owners = computed(() => this.users.items().filter((u) => u.role === 'LOCATION_MANAGER' || u.role === 'SUPER_ADMIN'));
  protected readonly filtered = computed(() => this.rows().filter((l) => (!this.status() || l.status === this.status()) && (!this.source() || l.source === this.source()) && (!this.owner() || (this.owner() === '__none' ? !l.ownerId : l.ownerId === this.owner()))));
  protected count(s: LeadStatus): number {
    return this.rows().filter((l) => l.status === s).length;
  }
  protected labelFor(s: LeadStatus): string {
    return LEAD_STATUS_LABELS[s];
  }
  protected readonly rate = computed(() => (this.rows().length ? Math.round((this.count('CONVERTED') / this.rows().length) * 1000) / 10 : 0));
  protected readonly funnel = computed(() => {
    const r = this.rows();
    const reached = (s: LeadStatus[]) => r.filter((l) => s.includes(l.status)).length;
    return [
      { label: 'Enquiries', value: r.length },
      { label: 'Contacted', value: reached(['CONTACTED', 'TOUR_SCHEDULED', 'TOUR_DONE', 'CONVERTED']) },
      { label: 'Tour scheduled', value: reached(['TOUR_SCHEDULED', 'TOUR_DONE', 'CONVERTED']) },
      { label: 'Tour done', value: reached(['TOUR_DONE', 'CONVERTED']) },
      { label: 'Converted', value: reached(['CONVERTED']), color: 'var(--success)' },
    ];
  });
  protected readonly bySource = computed(() => this.sourceKeys.map((s) => ({ label: LEAD_SOURCE_LABELS[s], value: this.rows().filter((l) => l.source === s).length })).filter((x) => x.value));
  protected readonly cols: Column<Lead>[] = [
    { key: 'id', label: 'Lead ID' },
    { key: 'name', label: 'Name', primary: true },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email', hideMobile: true },
    { key: 'source', label: 'Source', value: (l) => LEAD_SOURCE_LABELS[l.source] },
    { key: 'location', label: 'Location', value: (l) => this.locations.shortName(l.locationId), hideMobile: true },
    { key: 'requirement', label: 'Requirement', hideMobile: true },
    { key: 'status', label: 'Status', sortValue: (l) => PIPELINE.indexOf(l.status) },
    { key: 'owner', label: 'Owner', value: (l) => this.users.name(l.ownerId), hideMobile: true },
    { key: 'followUpDate', label: 'Follow-up', type: 'date' },
    { key: 'createdAt', label: 'Created', type: 'date' },
  ];
  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    mobile: ['', [Validators.required, mobileValidator]],
    email: ['', emailValidator],
    source: ['WALK_IN' as LeadSource],
    locationId: [this.locations.scoped()[0]?.id ?? ''],
    followUpDate: [todayIso()],
    requirement: ['', Validators.required],
  });
  protected create(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const l = this.capture.capture(v.source, { name: v.name, mobile: v.mobile, email: v.email || undefined, locationId: v.locationId, requirement: v.requirement, preferredDate: v.followUpDate });
    this.capture.assign(l.id, this.auth.user()!.id);
    this.audit.record('CREATE', 'Leads', 'Lead', l.id, `Created lead ${l.name}`);
    this.form.reset({ name: '', mobile: '', email: '', source: 'WALK_IN', locationId: v.locationId, followUpDate: todayIso(), requirement: '' });
    this.newOpen.set(false);
    this.toast.success('Lead created', `${l.id} now appears in the list.`);
  }
  protected csv(): void {
    downloadCsv(`leads-${todayStamp()}`, this.filtered(), [
      { label: 'Lead ID', value: (l) => l.id },
      { label: 'Name', value: (l) => l.name },
      { label: 'Mobile', value: (l) => l.mobile },
      { label: 'Email', value: (l) => l.email ?? '' },
      { label: 'Source', value: (l) => LEAD_SOURCE_LABELS[l.source] },
      { label: 'Location', value: (l) => this.locations.name(l.locationId) },
      { label: 'Requirement', value: (l) => l.requirement },
      { label: 'Status', value: (l) => LEAD_STATUS_LABELS[l.status] },
      { label: 'Owner', value: (l) => this.users.name(l.ownerId) },
      { label: 'Follow-up', value: (l) => l.followUpDate ?? '' },
      { label: 'Created', value: (l) => l.createdAt.slice(0, 10) },
    ]);
  }
}

/** Lead details: info, activity timeline, notes, comments, follow-up, owner, status, convert. */
@Component({
  selector: 'app-lead-detail',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (lead(); as l) {
        <app-page-header [title]="l.name" [subtitle]="l.id + ' · ' + sourceLabels[l.source] + ' · ' + locations.name(l.locationId)" [breadcrumbs]="[{ label: 'Leads', link: '/admin/leads' }, { label: l.name }]">
          <app-status-badge badge [status]="l.status" [label]="statusLabels[l.status]" />
          @if (l.mobileVerified) {
            <span badge class="badge badge-success">Mobile verified</span>
          }
          @if (l.status === 'CONVERTED' && l.memberId) {
            <a class="btn btn-secondary" [routerLink]="['/admin/members', l.memberId]"><app-icon name="user" [size]="16" /> View member</a>
          } @else if (l.status !== 'LOST' && auth.can('members.create')) {
            <a class="btn btn-success" routerLink="/admin/members/new" [queryParams]="{ leadId: l.id }"><app-icon name="user-check" [size]="16" /> Convert to member</a>
          }
        </app-page-header>

        <section class="card card-body mb-4">
          <div class="stepper" aria-label="Lead pipeline">
            @for (s of stages; track s; let i = $index) {
              <button type="button" class="step" style="background: none; border: 0" [class.active]="l.status === s" [class.done]="stageIndex() > i && l.status !== 'LOST'" [disabled]="!auth.can('leads.edit') || l.status === 'CONVERTED'" (click)="setStatus(s)">
                <span class="num">{{ i + 1 }}</span>{{ statusLabels[s] }}
              </button>
              @if (i < stages.length - 1) {
                <span class="step-sep"></span>
              }
            }
            <span class="step-sep"></span>
            <button type="button" class="step" style="background: none; border: 0" [class.active]="l.status === 'LOST'" [disabled]="!auth.can('leads.edit') || l.status === 'CONVERTED'" (click)="markLost()"><span class="num" style="color: var(--danger)">×</span>Lost</button>
          </div>
        </section>

        <div class="split">
          <div class="stack">
            <section class="card">
              <div class="card-header"><h2 class="card-title">Lead information</h2></div>
              <div class="card-body kv-grid">
                <div class="kv-item"><div class="k">Mobile</div><div class="v">{{ l.mobile | mobile }}</div></div>
                <div class="kv-item"><div class="k">Email</div><div class="v">{{ l.email ?? '—' }}</div></div>
                <div class="kv-item"><div class="k">Source</div><div class="v">{{ sourceLabels[l.source] }}</div></div>
                <div class="kv-item"><div class="k">Location</div><div class="v">{{ locations.name(l.locationId) }}</div></div>
                <div class="kv-item"><div class="k">Requirement</div><div class="v">{{ l.requirement }}</div></div>
                <div class="kv-item"><div class="k">Space type</div><div class="v">{{ l.spaceType ?? '—' }}</div></div>
                <div class="kv-item"><div class="k">Seats / visitors</div><div class="v">{{ l.seats ?? l.visitors ?? '—' }}</div></div>
                <div class="kv-item"><div class="k">Preferred</div><div class="v">{{ l.preferredDate ? (l.preferredDate | date: 'd MMM') : '—' }} {{ l.preferredTime ? (l.preferredTime | time12) : '' }}</div></div>
                <div class="kv-item"><div class="k">Created</div><div class="v">{{ l.createdAt | date: 'd MMM y, h:mm a' }}</div></div>
                @if (l.lostReason) {
                  <div class="kv-item"><div class="k">Lost reason</div><div class="v text-danger">{{ l.lostReason }}</div></div>
                }
              </div>
            </section>
            <section class="card">
              <div class="card-header">
                <app-tabs [tabs]="[{ id: 'notes', label: 'Notes', count: l.notes.length }, { id: 'comments', label: 'Comments', count: l.comments.length }]" [(value)]="noteTab" label="Notes and comments" />
              </div>
              <div class="card-body">
                @for (c of noteTab() === 'notes' ? l.notes : l.comments; track c.id) {
                  <div class="comment">
                    <app-avatar [name]="c.author" [size]="28" />
                    <div><div class="comment-meta"><strong>{{ c.author }}</strong><span class="text-xs text-muted">{{ c.at | ago }}</span></div><div class="comment-text">{{ c.text }}</div></div>
                  </div>
                } @empty {
                  <p class="text-muted text-sm">No {{ noteTab() }} yet.</p>
                }
                <div class="row-sm mt-3">
                  <input class="input" [attr.aria-label]="'Add ' + noteTab()" [placeholder]="noteTab() === 'notes' ? 'Add a private note…' : 'Add a comment for the team…'" [ngModel]="text()" (ngModelChange)="text.set($event)" (keydown.enter)="add()" />
                  <button type="button" class="btn btn-primary" [disabled]="!text().trim()" (click)="add()">Add</button>
                </div>
              </div>
            </section>
          </div>
          <div class="stack">
            <section class="card card-body stack">
              <div class="field">
                <label class="label" for="lo">Assign owner</label>
                <select id="lo" class="select" [ngModel]="l.ownerId ?? ''" (ngModelChange)="assign($event)" [disabled]="!auth.can('leads.edit')">
                  <option value="" disabled>Unassigned</option>
                  @for (u of owners(); track u.id) {
                    <option [value]="u.id">{{ u.name }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label class="label" for="lst">Change status</label>
                <select id="lst" class="select" [ngModel]="l.status" (ngModelChange)="$event === 'LOST' ? markLost() : setStatus($event)" [disabled]="!auth.can('leads.edit') || l.status === 'CONVERTED'">
                  @for (s of all; track s) {
                    <option [value]="s" [disabled]="s === 'CONVERTED'">{{ statusLabels[s] }}</option>
                  }
                </select>
                <span class="field-hint">Use “Convert to member” to mark as Converted.</span>
              </div>
              <div class="field">
                <label class="label" for="lfu">Follow-up date</label>
                <div class="row-sm">
                  <input id="lfu" class="input" type="date" [min]="today" [ngModel]="follow()" (ngModelChange)="follow.set($event)" />
                  <button type="button" class="btn btn-secondary" [disabled]="!follow()" (click)="setFollowUp()">Set</button>
                </div>
                @if (l.followUpDate) {
                  <span class="field-hint">Current: {{ l.followUpDate | date: 'EEE, d MMM' }}{{ l.followUpDate < today ? ' (overdue)' : '' }}</span>
                }
              </div>
              <div class="btn-group">
                <a class="btn btn-secondary btn-sm" [href]="'tel:' + l.mobile"><app-icon name="phone" [size]="14" /> Call</a>
                @if (l.email) {
                  <a class="btn btn-secondary btn-sm" [href]="'mailto:' + l.email"><app-icon name="mail" [size]="14" /> Email</a>
                }
              </div>
            </section>
            <section class="card">
              <div class="card-header"><h2 class="card-title">Activity timeline</h2></div>
              <div class="card-body"><app-timeline [items]="timeline()" /></div>
            </section>
          </div>
        </div>
      } @else {
        <div class="card"><app-empty-state icon="target" title="Lead not found"><a class="btn btn-secondary" routerLink="/admin/leads">Back to leads</a></app-empty-state></div>
      }
    </div>
  `,
})
export class LeadDetailComponent {
  readonly id = input.required<string>();
  private readonly leads = inject(LeadService);
  protected readonly locations = inject(LocationService);
  private readonly users = inject(UserService);
  private readonly capture = inject(LeadCaptureService);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly statusLabels = LEAD_STATUS_LABELS;
  protected readonly sourceLabels = LEAD_SOURCE_LABELS;
  protected readonly stages: LeadStatus[] = ['NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'TOUR_DONE', 'CONVERTED'];
  protected readonly all = PIPELINE;
  protected readonly today = todayIso();
  protected readonly noteTab = signal('notes');
  protected readonly text = signal('');
  protected readonly follow = signal('');
  protected readonly lead = computed(() => this.leads.find(this.id()));
  protected readonly stageIndex = computed(() => this.stages.indexOf(this.lead()?.status ?? 'NEW'));
  protected readonly timeline = computed(() => [...(this.lead()?.activities ?? [])].reverse());
  protected readonly owners = computed(() => this.users.items().filter((u) => (u.role === 'LOCATION_MANAGER' || u.role === 'SUPER_ADMIN') && u.status === 'ACTIVE'));

  protected setStatus(s: LeadStatus): void {
    if (s === 'CONVERTED') return;
    this.capture.setStatus(this.id(), s);
    this.audit.record('STATUS_CHANGE', 'Leads', 'Lead', this.id(), `Changed lead status to ${LEAD_STATUS_LABELS[s]}`);
    this.toast.success('Status updated', LEAD_STATUS_LABELS[s]);
  }
  protected async markLost(): Promise<void> {
    const reason = await this.confirm.prompt({ title: 'Mark lead as lost?', message: 'Record why this lead did not convert.', confirmText: 'Mark lost', tone: 'danger', input: { label: 'Reason', placeholder: 'Budget, location, chose competitor…', required: true } });
    if (reason === null) return;
    this.capture.setStatus(this.id(), 'LOST', reason);
    this.toast.info('Lead marked lost');
  }
  protected assign(userId: string): void {
    this.capture.assign(this.id(), userId);
    this.toast.success('Owner assigned', this.users.name(userId));
  }
  protected setFollowUp(): void {
    this.capture.followUp(this.id(), this.follow());
    this.follow.set('');
    this.toast.success('Follow-up scheduled');
  }
  protected add(): void {
    if (!this.text().trim()) return;
    this.capture.addNote(this.id(), this.text().trim(), this.noteTab() === 'notes' ? 'notes' : 'comments');
    this.text.set('');
  }
}

@Component({
  selector: 'app-follow-ups',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Follow-ups" subtitle="Leads with follow-ups due." [breadcrumbs]="[{ label: 'Leads', link: '/admin/leads' }, { label: 'Follow-ups' }]" />
      <app-tabs [tabs]="tabs()" [(value)]="tab" label="Follow-up buckets" />
      <div class="mt-4">
        <app-data-table [rows]="rows()" [columns]="cols" [defaultSort]="{ key: 'followUpDate', dir: 'asc' }" emptyTitle="No follow-ups" emptyMessage="Nothing due in this bucket." emptyIcon="calendar" [rowClickable]="true" (rowClick)="router.navigate(['/admin/leads', $event.id])" caption="Follow-ups">
          <ng-template appCell="actions" let-row>
            <button type="button" class="btn btn-ghost btn-sm" (click)="done(row)">Mark contacted</button>
          </ng-template>
        </app-data-table>
      </div>
    </div>
  `,
})
export class FollowUpsComponent {
  private readonly leads = inject(LeadService);
  private readonly users = inject(UserService);
  private readonly capture = inject(LeadCaptureService);
  protected readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly tab = signal('today');
  private readonly open = computed(() => this.leads.scoped().filter((l) => l.followUpDate && l.status !== 'CONVERTED' && l.status !== 'LOST'));
  private readonly groups = computed(() => {
    const t = todayIso();
    return { overdue: this.open().filter((l) => l.followUpDate! < t), today: this.open().filter((l) => l.followUpDate === t), upcoming: this.open().filter((l) => l.followUpDate! > t) } as Record<string, Lead[]>;
  });
  protected readonly rows = computed(() => this.groups()[this.tab()]);
  protected readonly tabs = computed(() => [
    { id: 'overdue', label: 'Overdue', count: this.groups()['overdue'].length },
    { id: 'today', label: 'Due today', count: this.groups()['today'].length },
    { id: 'upcoming', label: 'Upcoming', count: this.groups()['upcoming'].length },
  ]);
  protected readonly cols: Column<Lead>[] = [
    { key: 'name', label: 'Lead', primary: true },
    { key: 'mobile', label: 'Mobile' },
    { key: 'requirement', label: 'Requirement', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'owner', label: 'Owner', value: (l) => this.users.name(l.ownerId) },
    { key: 'followUpDate', label: 'Follow-up', type: 'date' },
  ];
  protected done(l: Lead): void {
    this.capture.setStatus(l.id, l.status === 'NEW' ? 'CONTACTED' : l.status);
    this.capture.followUp(l.id, new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA'));
    this.toast.success('Follow-up logged', 'Next follow-up in 3 days.');
  }
}

/** Conversion pipeline board (Lead → Converted → Member). */
@Component({
  selector: 'app-lead-conversion',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Conversion" subtitle="Pipeline from enquiry to member. Move cards by changing status on the lead." [breadcrumbs]="[{ label: 'Leads', link: '/admin/leads' }, { label: 'Conversion' }]" />
      <div class="board">
        @for (col of columns(); track col.status) {
          <section class="board-col" [attr.aria-label]="col.label">
            <header class="row-between"><span class="fw-600">{{ col.label }}</span><span class="badge badge-neutral no-dot">{{ col.items.length }}</span></header>
            @for (l of col.items.slice(0, 12); track l.id) {
              <a class="card card-body board-card" [routerLink]="['/admin/leads', l.id]">
                <div class="fw-500">{{ l.name }}</div>
                <div class="text-xs text-muted">{{ l.requirement }}</div>
                <div class="row-between mt-2 text-xs"><span class="tag">{{ sourceLabels[l.source] }}</span><span class="text-muted">{{ l.createdAt | ago }}</span></div>
              </a>
            } @empty {
              <p class="text-sm text-muted">No leads</p>
            }
            @if (col.items.length > 12) {
              <a class="btn btn-ghost btn-sm" routerLink="/admin/leads">+{{ col.items.length - 12 }} more</a>
            }
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    .board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(240px, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 8px; }
    .board-col { background: var(--surface-sunken); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 300px; }
    .board-card { padding: 12px; color: inherit; text-decoration: none; }
    .board-card:hover { border-color: var(--primary-200); text-decoration: none; color: inherit; }
  `,
})
export class LeadConversionComponent {
  private readonly leads = inject(LeadService);
  protected readonly sourceLabels = LEAD_SOURCE_LABELS;
  protected readonly columns = computed(() => PIPELINE.map((s) => ({ status: s, label: LEAD_STATUS_LABELS[s], items: this.leads.scoped().filter((l) => l.status === s) })));
}

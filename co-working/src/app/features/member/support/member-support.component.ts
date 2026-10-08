import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader } from '../../../shared';
import { Attachment, TICKET_CATEGORIES, Ticket, TicketPriority } from '../../../core/models';
import { TicketService } from '../../../core/services/data/operations-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { UserService } from '../../../core/services/data/people-data.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { OperationsService } from '../../../core/services/operations.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-member-support',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Support Tickets" subtitle="Report an issue and track it until it’s resolved." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Support' }]">
        <a class="btn btn-primary" routerLink="/member/support/new"><app-icon name="plus" [size]="16" /> Raise ticket</a>
      </app-page-header>
      <app-tabs [tabs]="tabs()" [(value)]="tab" label="Ticket status" />
      <div class="mt-4">
        <app-data-table [rows]="rows()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [defaultSort]="{ key: 'createdAt', dir: 'desc' }" searchPlaceholder="Search tickets" emptyTitle="No tickets" emptyMessage="Everything working? Great. If not, raise a ticket." emptyIcon="support" [rowClickable]="true" (rowClick)="router.navigate(['/member/support', $event.id])" caption="Support tickets">
          <a empty-action class="btn btn-primary btn-sm" routerLink="/member/support/new">Raise ticket</a>
        </app-data-table>
      </div>
    </div>
  `,
})
export class MemberSupportComponent {
  private readonly tickets = inject(TicketService);
  private readonly acct = inject(MemberAccountService);
  protected readonly router = inject(Router);
  protected readonly loader = createLoader(() => this.tickets.list());
  protected readonly tab = signal('ALL');
  private readonly mine = computed(() => this.tickets.items().filter((t) => t.memberId === this.acct.memberId()));
  protected readonly rows = computed(() => this.mine().filter((t) => this.tab() === 'ALL' || t.status === this.tab()));
  protected readonly tabs = computed(() => [
    { id: 'ALL', label: 'All', count: this.mine().length },
    { id: 'OPEN', label: 'Open', count: this.mine().filter((t) => t.status === 'OPEN').length },
    { id: 'IN_PROGRESS', label: 'In Progress', count: this.mine().filter((t) => t.status === 'IN_PROGRESS').length },
    { id: 'RESOLVED', label: 'Resolved', count: this.mine().filter((t) => t.status === 'RESOLVED').length },
  ]);
  protected readonly cols: Column<Ticket>[] = [
    { key: 'id', label: 'Ticket ID', primary: true },
    { key: 'subject', label: 'Subject' },
    { key: 'category', label: 'Category', hideMobile: true },
    { key: 'priority', label: 'Priority', type: 'status', hideMobile: true },
    { key: 'createdAt', label: 'Created', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
}

@Component({
  selector: 'app-ticket-form',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header title="Raise a ticket" subtitle="Our team responds within a few hours. Unresolved tickets are escalated after 24 hours." [breadcrumbs]="[{ label: 'Support', link: '/member/support' }, { label: 'New ticket' }]" />
      <form class="card" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="card-body form-grid">
          <div class="field">
            <label class="label" for="tc">Category <span class="req">*</span></label>
            <select id="tc" class="select" formControlName="category">
              <option value="">Select category</option>
              @for (c of categories; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
            <app-field-error [control]="form.controls.category" label="Category" />
          </div>
          <div class="field">
            <label class="label" for="tl">Location <span class="req">*</span></label>
            <select id="tl" class="select" formControlName="locationId">
              @for (l of locations.active(); track l.id) {
                <option [value]="l.id">{{ l.name }}</option>
              }
            </select>
          </div>
          <div class="field span-2"><label class="label" for="ts">Subject <span class="req">*</span></label><input id="ts" class="input" formControlName="subject" maxlength="100" /><app-field-error [control]="form.controls.subject" label="Subject" /></div>
          <div class="field span-2">
            <label class="label" for="td">Description <span class="req">*</span></label>
            <textarea id="td" class="textarea" rows="5" formControlName="description" placeholder="What happened, where, and since when?"></textarea>
            <span class="field-hint">{{ form.controls.description.value.length }}/1000</span>
            <app-field-error [control]="form.controls.description" label="Description" />
          </div>
          <div class="field span-2">
            <span class="label">Priority <span class="req">*</span></span>
            <div class="segmented" role="radiogroup" aria-label="Priority">
              @for (p of priorities; track p) {
                <button type="button" role="radio" [attr.aria-checked]="form.controls.priority.value === p" [class.active]="form.controls.priority.value === p" (click)="form.controls.priority.setValue(p)">{{ p | humanize }}</button>
              }
            </div>
          </div>
          <div class="field span-2">
            <span class="label">Photo attachment</span>
            <app-file-upload accept="image/*,.pdf" hint="Add a photo of the issue (optional)" (filesChange)="files.set($event)" />
          </div>
        </div>
        <div class="card-footer">
          <a class="btn btn-secondary" routerLink="/member/support">Cancel</a>
          <button type="submit" class="btn btn-primary" [disabled]="form.invalid">Submit ticket</button>
        </div>
      </form>
    </div>
  `,
})
export class TicketFormComponent {
  private readonly acct = inject(MemberAccountService);
  protected readonly locations = inject(LocationService);
  private readonly ops = inject(OperationsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly categories = TICKET_CATEGORIES;
  protected readonly priorities: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  protected readonly files = signal<Attachment[]>([]);
  protected readonly form = this.fb.nonNullable.group({
    category: ['', Validators.required],
    locationId: [this.acct.member()?.locationId ?? '', Validators.required],
    subject: ['', [Validators.required, Validators.minLength(5)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    priority: ['MEDIUM' as TicketPriority, Validators.required],
  });

  protected save(): void {
    const m = this.acct.member();
    if (this.form.invalid || !m) return this.form.markAllAsTouched();
    const t = this.ops.createTicket({ ...this.form.getRawValue(), memberId: m.id, attachments: this.files() });
    this.toast.success('Ticket raised', `${t.id} is open. We’ll keep you posted.`);
    this.router.navigate(['/member/support', t.id]);
  }
}

/** Ticket detail shared by member and staff views. */
@Component({
  selector: 'app-ticket-detail',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (ticket(); as t) {
        <app-page-header [title]="t.subject" [subtitle]="t.id + ' · ' + t.category + ' · ' + locations.name(t.locationId)" [breadcrumbs]="[{ label: 'Support', link: base() }, { label: t.id }]">
          <app-status-badge badge [status]="t.status" />
          <app-status-badge badge [status]="t.priority" />
          @if (t.escalated) {
            <span badge class="badge badge-danger">Escalated</span>
          }
          @if (isStaff()) {
            @if (auth.can('support.edit')) {
              <select class="select" style="width: auto" aria-label="Assign staff" [ngModel]="t.assignedTo ?? ''" (ngModelChange)="assign($event)">
                <option value="" disabled>Assign staff…</option>
                @for (u of staff(); track u.id) {
                  <option [value]="u.id">{{ u.name }}</option>
                }
              </select>
              <select class="select" style="width: auto" aria-label="Change status" [ngModel]="t.status" (ngModelChange)="setStatus($event)">
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
              </select>
              @if (!t.escalated && t.status !== 'RESOLVED') {
                <button type="button" class="btn btn-danger" (click)="escalate()"><app-icon name="alert" [size]="16" /> Escalate</button>
              }
            }
          } @else if (t.status === 'RESOLVED') {
            <button type="button" class="btn btn-secondary" (click)="setStatus('OPEN')">Reopen</button>
          }
        </app-page-header>

        @if (t.status !== 'RESOLVED') {
          <div class="alert mb-4" [class.alert-danger]="sla() <= 0" [class.alert-warning]="sla() > 0 && sla() < 6" [class.alert-info]="sla() >= 6">
            <app-icon name="clock" />
            <div class="alert-body">
              @if (sla() > 0) {
                {{ sla() | number: '1.0-0' }} hour{{ sla() >= 1.5 ? 's' : '' }} left before automatic escalation (24-hour SLA).
              } @else {
                Open for {{ -sla() + 24 | number: '1.0-0' }} hours, past the 24-hour SLA. {{ t.escalated ? 'Escalated to ' + t.escalatedTo + '.' : 'Will be escalated automatically.' }}
              }
            </div>
          </div>
        }

        <div class="split">
          <div class="stack">
            <section class="card card-body">
              <h2 class="section-title">Description</h2>
              <p class="text-secondary" style="white-space: pre-wrap">{{ t.description }}</p>
              @if (t.attachments.length) {
                <h3 class="section-title mt-4">Attachments</h3>
                <ul class="file-list">
                  @for (a of t.attachments; track a.id) {
                    <li><app-icon [name]="a.type.startsWith('image') ? 'image' : 'file-text'" [size]="16" /><span class="flex-1 truncate">{{ a.name }}</span><span class="text-xs text-muted">{{ a.size / 1000 | number: '1.0-0' }} KB</span></li>
                  }
                </ul>
              }
            </section>
            <section class="card">
              <div class="card-header"><h2 class="card-title">Comments</h2><span class="badge badge-neutral no-dot">{{ t.comments.length }}</span></div>
              <div class="card-body">
                @for (c of t.comments; track c.id) {
                  <div class="comment">
                    <app-avatar [name]="c.author" [size]="32" />
                    <div class="flex-1 min-0">
                      <div class="comment-meta"><strong>{{ c.author }}</strong><span class="tag">{{ c.authorRole }}</span><span class="text-xs text-muted">{{ c.at | ago }}</span></div>
                      <div class="comment-text">{{ c.text }}</div>
                    </div>
                  </div>
                } @empty {
                  <p class="text-muted text-sm">No comments yet.</p>
                }
                <div class="field mt-4">
                  <label class="label" for="cmt">Add a comment</label>
                  <textarea id="cmt" class="textarea" rows="3" [ngModel]="comment()" (ngModelChange)="comment.set($event)" placeholder="Write an update…"></textarea>
                </div>
                <div class="row-between mt-2">
                  <app-file-upload [multiple]="false" hint="" (filesChange)="files.set($event)" style="flex: 1; max-width: 360px" />
                  <button type="button" class="btn btn-primary" [disabled]="!comment().trim()" (click)="addComment()"><app-icon name="send" [size]="16" /> Post</button>
                </div>
              </div>
            </section>
          </div>
          <div class="stack">
            <section class="card">
              <div class="card-header"><h2 class="card-title">Details</h2></div>
              <div class="card-body">
                <dl class="kv">
                  <dt>Ticket ID</dt><dd class="mono">{{ t.id }}</dd>
                  <dt>Created</dt><dd>{{ t.createdAt | date: 'd MMM y, h:mm a' }}</dd>
                  <dt>Category</dt><dd>{{ t.category }}</dd>
                  <dt>Priority</dt><dd><app-status-badge [status]="t.priority" /></dd>
                  <dt>Assigned staff</dt><dd>{{ t.assignedTo ? users.name(t.assignedTo) : 'Unassigned' }}</dd>
                  <dt>Raised by</dt><dd>{{ memberName() }}</dd>
                  <dt>Last update</dt><dd>{{ t.updatedAt | ago }}</dd>
                  @if (t.resolvedAt) {
                    <dt>Resolved</dt><dd>{{ t.resolvedAt | date: 'd MMM, h:mm a' }}</dd>
                  }
                </dl>
              </div>
            </section>
            <section class="card">
              <div class="card-header"><h2 class="card-title">Timeline</h2></div>
              <div class="card-body"><app-timeline [items]="timeline()" /></div>
            </section>
          </div>
        </div>
      } @else {
        <div class="card"><app-empty-state icon="support" title="Ticket not found"><a class="btn btn-secondary" [routerLink]="base()">Back to tickets</a></app-empty-state></div>
      }
    </div>
  `,
})
export class TicketDetailComponent {
  readonly id = input.required<string>();
  private readonly tickets = inject(TicketService);
  protected readonly locations = inject(LocationService);
  protected readonly users = inject(UserService);
  private readonly ops = inject(OperationsService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly members = inject(MemberAccountService);
  protected readonly comment = signal('');
  protected readonly files = signal<Attachment[]>([]);
  protected readonly ticket = computed(() => this.tickets.find(this.id()));
  protected readonly isStaff = computed(() => this.auth.isStaff());
  protected readonly base = computed(() => (this.isStaff() ? '/admin/support' : '/member/support'));
  protected readonly staff = computed(() => this.users.items().filter((u) => u.status === 'ACTIVE' && (u.role === 'LOCATION_MANAGER' || u.role === 'FRONT_DESK' || u.role === 'SUPER_ADMIN')));
  protected readonly sla = computed(() => {
    const t = this.ticket();
    return t ? this.ops.slaRemaining(t) : 24;
  });
  protected readonly timeline = computed(() => [...(this.ticket()?.timeline ?? [])].reverse());
  protected readonly memberName = computed(() => {
    const t = this.ticket();
    return t ? this.users.items().find((u) => u.memberId === t.memberId)?.name ?? t.memberId : '';
  });

  protected assign(userId: string): void {
    if (!userId) return;
    this.ops.assign(this.id(), userId);
    this.toast.success('Ticket assigned', this.users.name(userId));
  }

  protected setStatus(status: Ticket['status']): void {
    this.ops.setStatus(this.id(), status);
    this.toast.success(`Ticket ${status === 'RESOLVED' ? 'resolved' : status === 'OPEN' ? 'reopened' : 'in progress'}`);
  }

  protected escalate(): void {
    this.ops.escalate(this.id());
    this.toast.warning('Ticket escalated', 'The location manager has been notified.');
  }

  protected addComment(): void {
    this.ops.comment(this.id(), this.comment().trim(), this.files());
    this.comment.set('');
    this.files.set([]);
    this.toast.success('Comment posted');
  }
}

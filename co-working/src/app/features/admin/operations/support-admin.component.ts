import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Column, SHARED, createLoader } from '../../../shared';
import { TICKET_CATEGORIES, Ticket } from '../../../core/models';
import { TicketService } from '../../../core/services/data/operations-data.service';
import { MemberService, UserService } from '../../../core/services/data/people-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { OperationsService } from '../../../core/services/operations.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/ui.service';

/** Ticket dashboard (§15 admin) with 24-hour escalation indicator; also used for Escalations. */
@Component({
  selector: 'app-tickets-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header [title]="escalationsOnly() ? 'Escalations' : 'Support Tickets'" [subtitle]="escalationsOnly() ? 'Tickets unresolved after 24 hours, escalated to managers.' : 'Assign, update and resolve member issues.'" [breadcrumbs]="[{ label: 'Support' }, { label: escalationsOnly() ? 'Escalations' : 'Tickets' }]">
        <button type="button" class="btn btn-secondary" (click)="runEscalation()"><app-icon name="refresh" [size]="16" /> Run 24h escalation check</button>
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Open" [value]="count('OPEN')" icon="inbox" tone="warning" />
        <app-stat-card label="In progress" [value]="count('IN_PROGRESS')" icon="clock" tone="info" />
        <app-stat-card label="Resolved" [value]="count('RESOLVED')" icon="check-circle" tone="success" />
        <app-stat-card label="Escalated" [value]="escalated()" icon="alert" tone="danger" link="/admin/support/escalations" />
        <app-stat-card label="Breaching SLA" [value]="breaching()" icon="flag" tone="danger" hint="Over 24h, unresolved" />
      </div>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!status() || !!category() || !!priority() || !!assignee()" (clearFilters)="status.set(''); category.set(''); priority.set(''); assignee.set('')" [defaultSort]="{ key: 'createdAt', dir: 'desc' }" searchPlaceholder="Search ticket, subject or member" emptyTitle="No tickets" emptyIcon="support" [rowClickable]="true" (rowClick)="router.navigate(['/admin/support', $event.id])" caption="Support tickets">
        <ng-container filters>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <select class="select" aria-label="Category" [ngModel]="category()" (ngModelChange)="category.set($event)">
            <option value="">All categories</option>
            @for (c of categories; track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
          <select class="select" aria-label="Priority" [ngModel]="priority()" (ngModelChange)="priority.set($event)">
            <option value="">All priorities</option>
            @for (p of ['LOW', 'MEDIUM', 'HIGH', 'URGENT']; track p) {
              <option [value]="p">{{ p | humanize }}</option>
            }
          </select>
          <select class="select" aria-label="Assignee" [ngModel]="assignee()" (ngModelChange)="assignee.set($event)">
            <option value="">Anyone</option>
            <option value="__none">Unassigned</option>
            @for (u of staff(); track u.id) {
              <option [value]="u.id">{{ u.name }}</option>
            }
          </select>
        </ng-container>
        <ng-template appCell="sla" let-row>
          @if (row.status === 'RESOLVED') {
            <span class="text-muted text-sm">—</span>
          } @else if (ops.slaRemaining(row) > 0) {
            <span class="badge" [class.badge-warning]="ops.slaRemaining(row) < 6" [class.badge-info]="ops.slaRemaining(row) >= 6">{{ ops.slaRemaining(row) | number: '1.0-0' }}h left</span>
          } @else {
            <span class="badge badge-danger">{{ row.escalated ? 'Escalated' : 'Overdue' }} · {{ ops.hoursOpen(row) | number: '1.0-0' }}h</span>
          }
        </ng-template>
        <ng-template appCell="actions" let-row>
          @if (auth.can('support.edit')) {
            <app-dropdown width="200px">
              <button trigger type="button" class="btn btn-ghost btn-icon btn-sm" [attr.aria-label]="'Actions for ' + row.id"><app-icon name="more" [size]="16" /></button>
              @for (u of staff(); track u.id) {
                <button type="button" class="menu-item" (click)="assign(row, u.id)"><app-icon name="user" [size]="14" /> Assign to {{ u.name }}</button>
              }
              <div class="menu-sep"></div>
              <button type="button" class="menu-item" (click)="setStatus(row, 'IN_PROGRESS')">Mark in progress</button>
              <button type="button" class="menu-item" (click)="setStatus(row, 'RESOLVED')">Mark resolved</button>
              @if (!row.escalated) {
                <button type="button" class="menu-item danger" (click)="escalate(row)">Escalate</button>
              }
            </app-dropdown>
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class TicketsAdminComponent {
  readonly view = input<string>();
  private readonly tickets = inject(TicketService);
  private readonly members = inject(MemberService);
  private readonly users = inject(UserService);
  private readonly locations = inject(LocationService);
  protected readonly ops = inject(OperationsService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.tickets.listScoped());
  protected readonly categories = TICKET_CATEGORIES;

  constructor() {
    // Flow 11: tickets unresolved for 24h are escalated when the dashboard opens (a backend job in production).
    this.ops.autoEscalate();
  }
  protected readonly status = signal('');
  protected readonly category = signal('');
  protected readonly priority = signal('');
  protected readonly assignee = signal('');
  protected readonly escalationsOnly = computed(() => this.router.url.includes('escalations'));
  protected readonly staff = computed(() => this.users.items().filter((u) => u.status === 'ACTIVE' && (u.role === 'LOCATION_MANAGER' || u.role === 'FRONT_DESK')));
  protected readonly filtered = computed(() =>
    this.tickets
      .scoped()
      .filter((t) => !this.escalationsOnly() || t.escalated || (t.status !== 'RESOLVED' && this.ops.slaRemaining(t) <= 0))
      .filter((t) => (!this.status() || t.status === this.status()) && (!this.category() || t.category === this.category()) && (!this.priority() || t.priority === this.priority()) && (!this.assignee() || (this.assignee() === '__none' ? !t.assignedTo : t.assignedTo === this.assignee()))),
  );
  protected count(s: string): number {
    return this.tickets.scoped().filter((t) => t.status === s).length;
  }
  protected readonly escalated = computed(() => this.tickets.scoped().filter((t) => t.escalated && t.status !== 'RESOLVED').length);
  protected readonly breaching = computed(() => this.tickets.scoped().filter((t) => t.status !== 'RESOLVED' && this.ops.slaRemaining(t) <= 0).length);
  protected readonly cols: Column<Ticket>[] = [
    { key: 'id', label: 'Ticket', primary: true },
    { key: 'subject', label: 'Subject' },
    { key: 'member', label: 'Member', value: (t) => this.members.fullName(t.memberId), hideMobile: true },
    { key: 'location', label: 'Location', value: (t) => this.locations.shortName(t.locationId), hideMobile: true },
    { key: 'priority', label: 'Priority', type: 'status' },
    { key: 'assignee', label: 'Assigned', value: (t) => this.users.name(t.assignedTo), hideMobile: true },
    { key: 'createdAt', label: 'Created', type: 'datetime' },
    { key: 'sla', label: '24h SLA', sortValue: (t) => this.ops.slaRemaining(t) },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected assign(t: Ticket, userId: string): void {
    this.ops.assign(t.id, userId);
    this.toast.success('Ticket assigned', `${t.id} → ${this.users.name(userId)}`);
  }
  protected setStatus(t: Ticket, s: Ticket['status']): void {
    this.ops.setStatus(t.id, s);
    this.toast.success('Status updated', `${t.id} is ${s.replace('_', ' ').toLowerCase()}`);
  }
  protected escalate(t: Ticket): void {
    this.ops.escalate(t.id);
    this.toast.warning('Ticket escalated', t.id);
  }
  protected runEscalation(): void {
    const n = this.ops.autoEscalate();
    this.toast.info(n ? `${n} ticket${n > 1 ? 's' : ''} escalated` : 'Nothing to escalate', 'Tickets unresolved after 24 hours are escalated to the location manager.');
  }
}

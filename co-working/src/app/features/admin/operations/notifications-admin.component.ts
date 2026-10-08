import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Column, SHARED, createLoader, downloadCsv, todayStamp } from '../../../shared';
import { NotificationChannel, NotificationLog, NotificationTemplate } from '../../../core/models';
import { NotificationLogService, NotificationTemplateService } from '../../../core/services/data/operations-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-notification-templates',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Notification Templates" subtitle="Email, SMS and push templates used by the notification service." [breadcrumbs]="[{ label: 'Notifications' }, { label: 'Templates' }]">
        @if (auth.can('notifications.edit')) {
          <button type="button" class="btn btn-primary" (click)="open()"><app-icon name="plus" [size]="16" /> New template</button>
        }
      </app-page-header>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!channel()" (clearFilters)="channel.set('')" searchPlaceholder="Search template or event" emptyTitle="No templates" emptyIcon="mail" caption="Notification templates">
        <ng-container filters>
          <select class="select" aria-label="Channel" [ngModel]="channel()" (ngModelChange)="channel.set($event)">
            <option value="">All channels</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="PUSH">Push</option>
          </select>
        </ng-container>
        <ng-template appCell="channel" let-row>
          <span class="tag"><app-icon [name]="row.channel === 'EMAIL' ? 'mail' : row.channel === 'SMS' ? 'phone' : 'bell'" [size]="12" /> {{ row.channel | humanize }}</span>
        </ng-template>
        <ng-template appCell="message" let-row><span class="text-sm truncate d-block" style="max-width: 320px">{{ row.message }}</span></ng-template>
        <ng-template appCell="actions" let-row>
          @if (auth.can('notifications.edit')) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="open(row)"><app-icon name="edit" [size]="14" /> Edit</button>
          }
        </ng-template>
      </app-data-table>
    </div>
    <app-modal [open]="formOpen()" [title]="editing() ? 'Edit template' : 'New template'" size="lg" (closed)="formOpen.set(false)">
      <div class="split">
        <form id="tpl-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
          <div class="field span-2"><label class="label" for="tn">Template name <span class="req">*</span></label><input id="tn" class="input" formControlName="name" /><app-field-error [control]="form.controls.name" label="Template name" /></div>
          <div class="field"><label class="label" for="te">Event <span class="req">*</span></label><input id="te" class="input" formControlName="event" list="tpl-events" /><datalist id="tpl-events">@for (e of events; track e) {<option [value]="e"></option>}</datalist><app-field-error [control]="form.controls.event" label="Event" /></div>
          <div class="field"><label class="label" for="tch">Channel <span class="req">*</span></label><select id="tch" class="select" formControlName="channel"><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="PUSH">Push</option></select></div>
          @if (form.controls.channel.value !== 'SMS') {
            <div class="field span-2"><label class="label" for="tsu">Subject <span class="req">*</span></label><input id="tsu" class="input" formControlName="subject" /><app-field-error [control]="form.controls.subject" label="Subject" /></div>
          }
          <div class="field span-2">
            <label class="label" for="tm">Message <span class="req">*</span></label>
            <textarea id="tm" class="textarea" rows="5" formControlName="message"></textarea>
            <span class="field-hint">Variables: {{ '{{name}} {{date}} {{time}} {{resource}} {{location}} {{amount}}' }}@if (form.controls.channel.value === 'SMS') { · {{ form.controls.message.value.length }}/160 }</span>
            <app-field-error [control]="form.controls.message" label="Message" />
          </div>
          <div class="field"><label class="label" for="tst">Status</label><select id="tst" class="select" formControlName="status"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
        </form>
        <aside>
          <div class="eyebrow mb-2">Preview</div>
          <div class="card card-body">
            @if (form.controls.channel.value !== 'SMS') {
              <div class="fw-600 mb-2">{{ render(form.controls.subject.value) }}</div>
            }
            <div class="text-sm text-secondary" style="white-space: pre-wrap">{{ render(form.controls.message.value) }}</div>
          </div>
        </aside>
      </div>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancel</button>
        <button type="submit" form="tpl-form" class="btn btn-primary" [disabled]="form.invalid">Save template</button>
      </div>
    </app-modal>
  `,
})
export class NotificationTemplatesComponent {
  private readonly templates = inject(NotificationTemplateService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.templates.list());
  protected readonly channel = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<NotificationTemplate | null>(null);
  protected readonly events = ['Booking Confirmed', 'Booking Reminder (1 hour)', 'Renewal Reminder (7 days)', 'Payment Success', 'Payment Failure', 'Visitor Arrival', 'Ticket Update', 'Tour Confirmation', 'OTP Verification'];
  protected readonly filtered = computed(() => this.templates.items().filter((t) => !this.channel() || t.channel === this.channel()));
  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    event: ['', Validators.required],
    channel: ['EMAIL' as NotificationChannel, Validators.required],
    subject: [''],
    message: ['', [Validators.required, Validators.maxLength(1000)]],
    status: ['ACTIVE' as NotificationTemplate['status']],
  });
  protected readonly cols: Column<NotificationTemplate>[] = [
    { key: 'name', label: 'Template Name', primary: true },
    { key: 'event', label: 'Event', hideMobile: true },
    { key: 'channel', label: 'Channel' },
    { key: 'subject', label: 'Subject', hideMobile: true },
    { key: 'message', label: 'Message', sortable: false, hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  constructor() {
    this.form.controls.channel.valueChanges.subscribe((c) => {
      this.form.controls.subject.setValidators(c === 'SMS' ? [] : [Validators.required]);
      this.form.controls.message.setValidators(c === 'SMS' ? [Validators.required, Validators.maxLength(160)] : [Validators.required, Validators.maxLength(1000)]);
      this.form.controls.subject.updateValueAndValidity();
      this.form.controls.message.updateValueAndValidity();
    });
  }

  protected render(s: string): string {
    const vars: Record<string, string> = { name: 'Aarav', date: '12 Oct', time: '11:00 AM', resource: 'Boardroom', location: 'HITEC City', amount: '₹1,008', bookingId: 'BKG-3171', plan: 'Dedicated Desk', invoiceNumber: 'OFC/26-27/00274', visitor: 'Neha Rao', ticketId: 'TKT-6001', status: 'In Progress', otp: '123456', passCode: 'OFV-8KQ2LZ' };
    return (s || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  }

  protected open(t?: NotificationTemplate): void {
    this.editing.set(t ?? null);
    this.form.reset(t ? { ...t } : { name: '', event: '', channel: 'EMAIL', subject: '', message: '', status: 'ACTIVE' });
    this.formOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = { ...this.form.getRawValue(), updatedAt: new Date().toISOString() };
    if (this.editing()) this.templates.updateSync(this.editing()!.id, v);
    else this.templates.createSync(v);
    this.audit.record(this.editing() ? 'UPDATE' : 'CREATE', 'Notifications', 'Template', v.name, `${this.editing() ? 'Updated' : 'Created'} template ${v.name}`);
    this.formOpen.set(false);
    this.toast.success('Template saved', v.name);
  }
}

@Component({
  selector: 'app-notification-logs',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Notification Logs" subtitle="Delivery log of every email, SMS and push notification." [breadcrumbs]="[{ label: 'Notifications' }, { label: 'Logs' }]">
        <button type="button" class="btn btn-secondary" (click)="csv()"><app-icon name="download" [size]="16" /> CSV</button>
      </app-page-header>
      <div class="stat-grid mb-5">
        <app-stat-card label="Delivered" [value]="count('DELIVERED')" icon="check-circle" tone="success" />
        <app-stat-card label="Queued" [value]="count('QUEUED')" icon="clock" tone="warning" />
        <app-stat-card label="Failed" [value]="count('FAILED')" icon="x-circle" tone="danger" />
      </div>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!channel() || !!status()" (clearFilters)="channel.set(''); status.set('')" [defaultSort]="{ key: 'at', dir: 'desc' }" searchPlaceholder="Search event, template or recipient" emptyTitle="No notification logs" caption="Notification logs">
        <ng-container filters>
          <select class="select" aria-label="Channel" [ngModel]="channel()" (ngModelChange)="channel.set($event)">
            <option value="">All channels</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="PUSH">Push</option>
          </select>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
            <option value="">All statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="QUEUED">Queued</option>
            <option value="FAILED">Failed</option>
          </select>
        </ng-container>
        <ng-template appCell="actions" let-row>
          @if (row.status === 'FAILED') {
            <button type="button" class="btn btn-ghost btn-sm" (click)="resend(row)"><app-icon name="refresh" [size]="14" /> Resend</button>
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class NotificationLogsComponent {
  private readonly logs = inject(NotificationLogService);
  private readonly locations = inject(LocationService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.logs.listScoped());
  protected readonly channel = signal('');
  protected readonly status = signal('');
  protected readonly filtered = computed(() => this.logs.scoped().filter((l) => (!this.channel() || l.channel === this.channel()) && (!this.status() || l.status === this.status())));
  protected count(s: string): number {
    return this.logs.scoped().filter((l) => l.status === s).length;
  }
  protected readonly cols: Column<NotificationLog>[] = [
    { key: 'at', label: 'Sent at', type: 'datetime' },
    { key: 'event', label: 'Event', primary: true },
    { key: 'templateName', label: 'Template', hideMobile: true },
    { key: 'channel', label: 'Channel', value: (l) => l.channel },
    { key: 'recipient', label: 'Recipient' },
    { key: 'provider', label: 'Provider', value: (l) => l.provider ?? '—', hideMobile: true },
    { key: 'location', label: 'Location', value: (l) => this.locations.shortName(l.locationId), hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected resend(l: NotificationLog): void {
    this.logs.updateSync(l.id, { status: 'DELIVERED', at: new Date().toISOString() });
    this.toast.success('Notification re-sent', l.recipient);
  }
  protected csv(): void {
    downloadCsv(`notification-logs-${todayStamp()}`, this.filtered(), [
      { label: 'Sent at', value: (l) => l.at },
      { label: 'Event', value: (l) => l.event },
      { label: 'Template', value: (l) => l.templateName },
      { label: 'Channel', value: (l) => l.channel },
      { label: 'Recipient', value: (l) => l.recipient },
      { label: 'Status', value: (l) => l.status },
    ]);
  }
}

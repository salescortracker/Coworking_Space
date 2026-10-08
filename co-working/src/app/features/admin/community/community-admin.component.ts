import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Column, SHARED, createLoader, futureDateValidator, todayIso } from '../../../shared';
import { CommunityEvent, Member, Perk, Post } from '../../../core/models';
import { EventService, PerkService, PostService } from '../../../core/services/data/engagement-data.service';
import { CompanyService, MemberService } from '../../../core/services/data/people-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { NotificationCenterService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-posts-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Community Posts" subtitle="Publish announcements and moderate member posts." [breadcrumbs]="[{ label: 'Community' }, { label: 'Posts' }]">
        @if (auth.can('community.create')) {
          <button type="button" class="btn btn-primary" (click)="annOpen.set(true)"><app-icon name="megaphone" [size]="16" /> New announcement</button>
        }
      </app-page-header>
      <app-data-table [rows]="filtered()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [hasFilters]="true" [filtersActive]="!!type() || !!status()" (clearFilters)="type.set(''); status.set('')" [defaultSort]="{ key: 'at', dir: 'desc' }" searchPlaceholder="Search posts" emptyTitle="No posts" emptyIcon="message" caption="Community posts">
        <ng-container filters>
          <select class="select" aria-label="Type" [ngModel]="type()" (ngModelChange)="type.set($event)"><option value="">All types</option><option value="POST">Posts</option><option value="ANNOUNCEMENT">Announcements</option></select>
          <select class="select" aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="">All statuses</option><option value="PUBLISHED">Published</option><option value="HIDDEN">Hidden</option></select>
        </ng-container>
        <ng-template appCell="content" let-row><span class="d-block truncate" style="max-width: 360px">{{ row.content }}</span></ng-template>
        <ng-template appCell="actions" let-row>
          @if (auth.can('community.edit')) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="pin(row)">{{ row.pinned ? 'Unpin' : 'Pin' }}</button>
            <button type="button" class="btn btn-ghost btn-sm" (click)="toggle(row)">{{ row.status === 'PUBLISHED' ? 'Hide' : 'Publish' }}</button>
          }
          @if (auth.can('community.delete')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm text-danger" (click)="remove(row)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
          }
        </ng-template>
      </app-data-table>
    </div>
    <app-modal [open]="annOpen()" title="New announcement" subtitle="Sent to all members as a pinned post and push notification." (closed)="annOpen.set(false)">
      <div class="field">
        <label class="label" for="ann">Announcement <span class="req">*</span></label>
        <textarea id="ann" class="textarea" rows="4" maxlength="500" [ngModel]="ann()" (ngModelChange)="ann.set($event)"></textarea>
        <span class="field-hint">{{ ann().length }}/500</span>
      </div>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="annOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="ann().trim().length < 5" (click)="announce()">Publish</button>
      </div>
    </app-modal>
  `,
})
export class PostsAdminComponent {
  private readonly posts = inject(PostService);
  private readonly notify = inject(NotificationCenterService);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.posts.list());
  protected readonly type = signal('');
  protected readonly status = signal('');
  protected readonly annOpen = signal(false);
  protected readonly ann = signal('');
  protected readonly filtered = computed(() => this.posts.items().filter((p) => (!this.type() || p.type === this.type()) && (!this.status() || p.status === this.status())));
  protected readonly cols: Column<Post>[] = [
    { key: 'authorName', label: 'Author', primary: true },
    { key: 'type', label: 'Type', value: (p) => (p.type === 'ANNOUNCEMENT' ? 'Announcement' : 'Member post') },
    { key: 'content', label: 'Content', sortable: false },
    { key: 'likes', label: 'Likes', type: 'number', hideMobile: true },
    { key: 'comments', label: 'Comments', type: 'number', value: (p) => p.comments.length, hideMobile: true },
    { key: 'at', label: 'Posted', type: 'datetime' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected announce(): void {
    this.posts.createSync({ authorName: 'Officera Community Team', authorRole: 'Announcement', type: 'ANNOUNCEMENT', content: this.ann().trim(), at: new Date().toISOString(), likes: 0, likedBy: [], comments: [], status: 'PUBLISHED', pinned: true });
    this.notify.dispatch({ event: 'Announcement', audience: 'MEMBER', category: 'SYSTEM', title: 'New announcement', message: this.ann().trim().slice(0, 120), link: '/member/community', channels: ['PUSH'] });
    this.audit.record('CREATE', 'Community', 'Post', 'ANN', 'Published announcement');
    this.ann.set('');
    this.annOpen.set(false);
    this.toast.success('Announcement published');
  }
  protected pin(p: Post): void {
    this.posts.updateSync(p.id, { pinned: !p.pinned });
  }
  protected toggle(p: Post): void {
    this.posts.updateSync(p.id, { status: p.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED' });
    this.audit.record('STATUS_CHANGE', 'Community', 'Post', p.id, `${p.status === 'PUBLISHED' ? 'Hid' : 'Published'} post`);
    this.toast.success(p.status === 'PUBLISHED' ? 'Post hidden' : 'Post published');
  }
  protected async remove(p: Post): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Delete post?', message: 'The post and its comments will be permanently removed.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    this.posts.remove(p.id).subscribe(() => {
      this.audit.record('DELETE', 'Community', 'Post', p.id, 'Removed community post');
      this.toast.success('Post deleted');
    });
  }
}

@Component({
  selector: 'app-events-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Events" subtitle="Create and publish community events." [breadcrumbs]="[{ label: 'Community' }, { label: 'Events' }]">
        @if (auth.can('community.create')) {
          <button type="button" class="btn btn-primary" (click)="open()"><app-icon name="plus" [size]="16" /> Create event</button>
        }
      </app-page-header>
      <app-data-table [rows]="events.scoped()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [defaultSort]="{ key: 'date', dir: 'desc' }" searchPlaceholder="Search events" emptyTitle="No events" emptyIcon="star" caption="Events">
        <ng-template appCell="actions" let-row>
          @if (auth.can('community.edit')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="open(row)" aria-label="Edit"><app-icon name="edit" [size]="16" /></button>
            @if (row.status !== 'CANCELLED') {
              <button type="button" class="btn btn-ghost btn-sm text-danger" (click)="cancel(row)">Cancel</button>
            }
          }
        </ng-template>
      </app-data-table>
    </div>
    <app-modal [open]="formOpen()" [title]="editing() ? 'Edit event' : 'Create event'" size="lg" (closed)="formOpen.set(false)">
      <form id="ev-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
        <div class="field span-2"><label class="label" for="et">Title <span class="req">*</span></label><input id="et" class="input" formControlName="title" /><app-field-error [control]="form.controls.title" label="Title" /></div>
        <div class="field"><label class="label" for="ec">Category</label><select id="ec" class="select" formControlName="category">@for (c of ['Networking', 'Workshop', 'Social', 'Showcase', 'Wellness', 'Tech Talk']; track c) {<option [value]="c">{{ c }}</option>}</select></div>
        <div class="field"><label class="label" for="eh">Host <span class="req">*</span></label><input id="eh" class="input" formControlName="host" /></div>
        <div class="field"><label class="label" for="ed">Date <span class="req">*</span></label><input id="ed" class="input" type="date" formControlName="date" /><app-field-error [control]="form.controls.date" label="Date" /></div>
        <div class="field"><label class="label" for="ecap">Capacity <span class="req">*</span></label><input id="ecap" class="input" type="number" min="1" formControlName="capacity" /><app-field-error [control]="form.controls.capacity" label="Capacity" /></div>
        <div class="field"><label class="label" for="es">Start time <span class="req">*</span></label><input id="es" class="input" type="time" formControlName="startTime" /></div>
        <div class="field"><label class="label" for="ee">End time <span class="req">*</span></label><input id="ee" class="input" type="time" formControlName="endTime" />@if (form.errors?.['timeRange']) {<span class="field-error">End time must be after start time.</span>}</div>
        <div class="field"><label class="label" for="el">Location <span class="req">*</span></label><select id="el" class="select" formControlName="locationId">@for (l of locations.scoped(); track l.id) {<option [value]="l.id">{{ l.name }}</option>}</select></div>
        <div class="field"><label class="label" for="ev">Venue <span class="req">*</span></label><input id="ev" class="input" formControlName="venue" /></div>
        <div class="field span-2"><label class="label" for="edesc">Description <span class="req">*</span></label><textarea id="edesc" class="textarea" rows="3" formControlName="description"></textarea><app-field-error [control]="form.controls.description" label="Description" /></div>
        <div class="field"><label class="label" for="est">Status</label><select id="est" class="select" formControlName="status"><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option></select></div>
        <div class="field" style="justify-content: flex-end"><label class="check"><input type="checkbox" formControlName="isPublic" /> Show on public website</label></div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancel</button>
        <button type="submit" form="ev-form" class="btn btn-primary" [disabled]="form.invalid">Save event</button>
      </div>
    </app-modal>
  `,
})
export class EventsAdminComponent {
  protected readonly events = inject(EventService);
  protected readonly locations = inject(LocationService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.events.listScoped());
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<CommunityEvent | null>(null);
  protected readonly form = this.fb.nonNullable.group(
    {
      title: ['', Validators.required],
      category: ['Networking'],
      host: ['Officera Community', Validators.required],
      date: [todayIso(), [Validators.required, futureDateValidator]],
      startTime: ['17:00', Validators.required],
      endTime: ['18:30', Validators.required],
      locationId: ['', Validators.required],
      venue: ['Lounge', Validators.required],
      capacity: [40, [Validators.required, Validators.min(1)]],
      description: ['', Validators.required],
      status: ['PUBLISHED' as CommunityEvent['status']],
      isPublic: [true],
    },
    { validators: (g) => (g.get('endTime')?.value <= g.get('startTime')?.value ? { timeRange: true } : null) },
  );
  protected readonly cols: Column<CommunityEvent>[] = [
    { key: 'title', label: 'Event', primary: true },
    { key: 'category', label: 'Category', hideMobile: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'time', label: 'Time', value: (e) => `${e.startTime}–${e.endTime}` },
    { key: 'location', label: 'Location', value: (e) => this.locations.shortName(e.locationId), hideMobile: true },
    { key: 'rsvps', label: 'RSVPs', value: (e) => `${e.attendees.length}/${e.capacity}` },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected open(e?: CommunityEvent): void {
    this.editing.set(e ?? null);
    this.form.reset(e ? { ...e } : { title: '', category: 'Networking', host: 'Officera Community', date: todayIso(), startTime: '17:00', endTime: '18:30', locationId: this.locations.scoped()[0]?.id ?? '', venue: 'Lounge', capacity: 40, description: '', status: 'PUBLISHED', isPublic: true });
    this.formOpen.set(true);
  }
  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.editing()) this.events.updateSync(this.editing()!.id, v);
    else this.events.createSync({ ...v, attendees: [], imageSeed: 61 + Math.floor(Math.random() * 7) });
    this.audit.record(this.editing() ? 'UPDATE' : 'CREATE', 'Community', 'Event', v.title, `${this.editing() ? 'Updated' : 'Created'} event ${v.title}`);
    this.formOpen.set(false);
    this.toast.success('Event saved', v.title);
  }
  protected async cancel(e: CommunityEvent): Promise<void> {
    const ok = await this.confirm.confirm({ title: `Cancel ${e.title}?`, message: `${e.attendees.length} attendees will be notified.`, confirmText: 'Cancel event', tone: 'danger' });
    if (!ok) return;
    this.events.updateSync(e.id, { status: 'CANCELLED' });
    this.toast.success('Event cancelled');
  }
}

@Component({
  selector: 'app-directory-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Member Directory" subtitle="Control who appears in the member directory." [breadcrumbs]="[{ label: 'Community' }, { label: 'Directory' }]" />
      <div class="stat-grid mb-5">
        <app-stat-card label="Visible profiles" [value]="visibleCount()" icon="eye" tone="success" />
        <app-stat-card label="Hidden profiles" [value]="members.scoped().length - visibleCount()" icon="eye-off" tone="neutral" />
      </div>
      <app-data-table [rows]="members.scoped()" [columns]="cols" searchPlaceholder="Search members" emptyTitle="No members" caption="Directory visibility">
        <ng-template appCell="visible" let-row>
          <label class="switch">
            <input type="checkbox" [checked]="row.directoryVisible" [disabled]="!auth.can('community.edit')" (change)="toggle(row)" [attr.aria-label]="'Directory visibility for ' + row.firstName" />
            <span class="track"></span>
            <span class="text-sm">{{ row.directoryVisible ? 'Visible' : 'Hidden' }}</span>
          </label>
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class DirectoryAdminComponent {
  protected readonly members = inject(MemberService);
  private readonly companies = inject(CompanyService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly visibleCount = computed(() => this.members.scoped().filter((m) => m.directoryVisible).length);
  protected readonly cols: Column<Member>[] = [
    { key: 'name', label: 'Member', value: (m) => `${m.firstName} ${m.lastName}`, primary: true },
    { key: 'company', label: 'Company', value: (m) => this.companies.find(m.companyId)?.name ?? '—' },
    { key: 'designation', label: 'Designation', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status', hideMobile: true },
    { key: 'visible', label: 'Visibility', sortValue: (m) => Number(m.directoryVisible) },
  ];
  protected toggle(m: Member): void {
    this.members.updateSync(m.id, { directoryVisible: !m.directoryVisible });
    this.toast.success(m.directoryVisible ? 'Profile hidden' : 'Profile visible', `${m.firstName} ${m.lastName}`);
  }
}

@Component({
  selector: 'app-perks-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Partner Perks" subtitle="Offers from partners available to members." [breadcrumbs]="[{ label: 'Community' }, { label: 'Partner Perks' }]">
        @if (auth.can('community.create')) {
          <button type="button" class="btn btn-primary" (click)="open()"><app-icon name="plus" [size]="16" /> Add perk</button>
        }
      </app-page-header>
      <app-data-table [rows]="perks.items()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" searchPlaceholder="Search partner or code" emptyTitle="No perks" emptyIcon="gift" caption="Partner perks">
        <ng-template appCell="actions" let-row>
          @if (auth.can('community.edit')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="open(row)" aria-label="Edit"><app-icon name="edit" [size]="16" /></button>
            <button type="button" class="btn btn-ghost btn-sm" (click)="toggle(row)">{{ row.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}</button>
          }
        </ng-template>
      </app-data-table>
    </div>
    <app-modal [open]="formOpen()" [title]="editing() ? 'Edit perk' : 'Add perk'" (closed)="formOpen.set(false)">
      <form id="pk-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
        <div class="field"><label class="label" for="pp">Partner <span class="req">*</span></label><input id="pp" class="input" formControlName="partner" /><app-field-error [control]="form.controls.partner" label="Partner" /></div>
        <div class="field"><label class="label" for="pc">Category</label><input id="pc" class="input" formControlName="category" /></div>
        <div class="field span-2"><label class="label" for="po">Offer <span class="req">*</span></label><input id="po" class="input" formControlName="offer" /><app-field-error [control]="form.controls.offer" label="Offer" /></div>
        <div class="field"><label class="label" for="pd">Discount <span class="req">*</span></label><input id="pd" class="input" formControlName="discount" /></div>
        <div class="field"><label class="label" for="pcode">Code <span class="req">*</span></label><input id="pcode" class="input" formControlName="code" style="text-transform: uppercase" /><app-field-error [control]="form.controls.code" label="Code" /></div>
        <div class="field"><label class="label" for="pe">Expiry <span class="req">*</span></label><input id="pe" class="input" type="date" formControlName="expiry" /><app-field-error [control]="form.controls.expiry" label="Expiry" /></div>
        <div class="field"><label class="label" for="pst">Status</label><select id="pst" class="select" formControlName="status"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
        <div class="field span-2"><label class="label" for="pde">Description</label><textarea id="pde" class="textarea" rows="2" formControlName="description"></textarea></div>
        <div class="field span-2"><label class="label" for="pt">Terms</label><input id="pt" class="input" formControlName="terms" /></div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancel</button>
        <button type="submit" form="pk-form" class="btn btn-primary" [disabled]="form.invalid">Save</button>
      </div>
    </app-modal>
  `,
})
export class PerksAdminComponent {
  protected readonly perks = inject(PerkService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.perks.list());
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Perk | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    partner: ['', Validators.required],
    category: ['Software'],
    offer: ['', Validators.required],
    discount: ['', Validators.required],
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{3,20}$/)]],
    expiry: [todayIso(), [Validators.required, futureDateValidator]],
    status: ['ACTIVE' as Perk['status']],
    description: [''],
    terms: [''],
  });
  protected readonly cols: Column<Perk>[] = [
    { key: 'partner', label: 'Partner', primary: true },
    { key: 'offer', label: 'Offer' },
    { key: 'discount', label: 'Discount', hideMobile: true },
    { key: 'code', label: 'Code' },
    { key: 'expiry', label: 'Expiry', type: 'date' },
    { key: 'redemptions', label: 'Redeemed', type: 'number', hideMobile: true },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected open(p?: Perk): void {
    this.editing.set(p ?? null);
    this.form.reset(p ? { ...p } : { partner: '', category: 'Software', offer: '', discount: '', code: '', expiry: todayIso(), status: 'ACTIVE', description: '', terms: '' });
    this.formOpen.set(true);
  }
  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = { ...this.form.getRawValue(), code: this.form.controls.code.value.toUpperCase() };
    if (this.editing()) this.perks.updateSync(this.editing()!.id, v);
    else this.perks.createSync({ ...v, redemptions: 0 });
    this.formOpen.set(false);
    this.toast.success('Perk saved', v.partner);
  }
  protected toggle(p: Perk): void {
    this.perks.updateSync(p.id, { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
    this.toast.success(p.status === 'ACTIVE' ? 'Perk deactivated' : 'Perk activated');
  }
}

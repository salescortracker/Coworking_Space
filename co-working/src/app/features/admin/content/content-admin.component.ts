import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, Validators } from '@angular/forms';
import { Column, SHARED, createLoader, todayIso } from '../../../shared';
import { Attachment, BlogPost, GalleryItem } from '../../../core/models';
import { BlogService, GalleryService, HomepageContentService } from '../../../core/services/data/engagement-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuditService, ConfirmService, ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-blog-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Blog" subtitle="Articles published on the public website." [breadcrumbs]="[{ label: 'Marketing / Content' }, { label: 'Blog' }]">
        @if (auth.can('content.create')) {
          <button type="button" class="btn btn-primary" (click)="open()"><app-icon name="plus" [size]="16" /> New article</button>
        }
      </app-page-header>
      <app-data-table [rows]="blog.items()" [columns]="cols" [status]="loader.status()" (retry)="loader.load()" [defaultSort]="{ key: 'publishedAt', dir: 'desc' }" searchPlaceholder="Search articles" emptyTitle="No articles" emptyIcon="file-text" caption="Blog posts">
        <ng-template appCell="actions" let-row>
          <a class="btn btn-ghost btn-icon btn-sm" [routerLink]="['/blog', row.id]" target="_blank" aria-label="Preview"><app-icon name="external" [size]="16" /></a>
          @if (auth.can('content.edit')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="open(row)" aria-label="Edit"><app-icon name="edit" [size]="16" /></button>
          }
          @if (auth.can('content.delete')) {
            <button type="button" class="btn btn-ghost btn-icon btn-sm text-danger" (click)="remove(row)" aria-label="Delete"><app-icon name="trash" [size]="16" /></button>
          }
        </ng-template>
      </app-data-table>
    </div>
    <app-modal [open]="formOpen()" [title]="editing() ? 'Edit article' : 'New article'" size="lg" (closed)="formOpen.set(false)">
      <form id="blog-form" [formGroup]="form" (ngSubmit)="save()" class="form-grid" novalidate>
        <div class="field span-2"><label class="label" for="bt">Title <span class="req">*</span></label><input id="bt" class="input" formControlName="title" /><app-field-error [control]="form.controls.title" label="Title" /></div>
        <div class="field"><label class="label" for="bc">Category</label><input id="bc" class="input" formControlName="category" /></div>
        <div class="field"><label class="label" for="ba">Author <span class="req">*</span></label><input id="ba" class="input" formControlName="author" /></div>
        <div class="field"><label class="label" for="bp">Publish date <span class="req">*</span></label><input id="bp" class="input" type="date" formControlName="publishedAt" /></div>
        <div class="field"><label class="label" for="bs">Status</label><select id="bs" class="select" formControlName="status"><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option></select></div>
        <div class="field span-2"><label class="label" for="be">Excerpt <span class="req">*</span></label><input id="be" class="input" formControlName="excerpt" /><app-field-error [control]="form.controls.excerpt" label="Excerpt" /></div>
        <div class="field span-2"><label class="label" for="bb">Body <span class="req">*</span></label><textarea id="bb" class="textarea" rows="8" formControlName="body" placeholder="Separate paragraphs with a blank line"></textarea><app-field-error [control]="form.controls.body" label="Body" /></div>
        <div class="field span-2"><span class="label">Cover image</span><app-file-upload accept="image/*" [multiple]="false" (filesChange)="cover.set($event[0]?.url ?? null)" /></div>
      </form>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancel</button>
        <button type="submit" form="blog-form" class="btn btn-primary" [disabled]="form.invalid">Save</button>
      </div>
    </app-modal>
  `,
})
export class BlogAdminComponent {
  protected readonly blog = inject(BlogService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  protected readonly loader = createLoader(() => this.blog.list());
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<BlogPost | null>(null);
  /** Cover image uploaded for the article being edited. */
  protected readonly cover = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    category: ['Guides'],
    author: ['Officera Team', Validators.required],
    publishedAt: [todayIso(), Validators.required],
    status: ['DRAFT' as BlogPost['status']],
    excerpt: ['', Validators.required],
    body: ['', [Validators.required, Validators.minLength(20)]],
  });
  protected readonly cols: Column<BlogPost>[] = [
    { key: 'title', label: 'Title', primary: true },
    { key: 'category', label: 'Category', hideMobile: true },
    { key: 'author', label: 'Author', hideMobile: true },
    { key: 'publishedAt', label: 'Publish date', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected open(p?: BlogPost): void {
    this.editing.set(p ?? null);
    this.form.reset(p ? { ...p, body: p.body.join('\n\n') } : { title: '', category: 'Guides', author: 'Officera Team', publishedAt: todayIso(), status: 'DRAFT', excerpt: '', body: '' });
    this.formOpen.set(true);
  }
  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const body = v.body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const data = { ...v, body, readMinutes: Math.max(1, Math.round(v.body.split(/\s+/).length / 200)) };
    const cover = this.cover();
    if (this.editing()) this.blog.updateSync(this.editing()!.id, cover ? { ...data, imageSeed: cover } : data);
    else this.blog.createSync({ ...data, imageSeed: cover ?? 71 + Math.floor(Math.random() * 5) });
    this.cover.set(null);
    this.audit.record(this.editing() ? 'UPDATE' : 'CREATE', 'Content', 'Blog', v.title, `${this.editing() ? 'Updated' : 'Created'} article`);
    this.formOpen.set(false);
    this.toast.success(v.status === 'PUBLISHED' ? 'Article published' : 'Draft saved', v.title);
  }
  protected async remove(p: BlogPost): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Delete article?', message: `“${p.title}” will be removed from the website.`, confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    this.blog.remove(p.id).subscribe(() => this.toast.success('Article deleted'));
  }
}

@Component({
  selector: 'app-gallery-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Gallery" subtitle="Photos shown on the public gallery and location pages." [breadcrumbs]="[{ label: 'Marketing / Content' }, { label: 'Gallery' }]">
        @if (auth.can('content.create')) {
          <button type="button" class="btn btn-primary" (click)="uploadOpen.set(true)"><app-icon name="upload" [size]="16" /> Upload photos</button>
        }
      </app-page-header>
      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="6" />
      } @else {
        <div class="grid grid-auto-sm">
          @for (g of gallery.scoped(); track g.id) {
            <article class="card" style="overflow: hidden">
              <app-workspace-image [seed]="g.seed" style="height: 140px" />
              <div class="card-body" style="padding: 10px 12px">
                <div class="row-between"><span class="fw-500 truncate">{{ g.title }}</span><app-status-badge [status]="g.status" /></div>
                <div class="text-xs text-muted">{{ locations.shortName(g.locationId) }} · {{ g.category }}</div>
                @if (auth.can('content.edit')) {
                  <div class="row-sm mt-2">
                    <button type="button" class="btn btn-ghost btn-sm" (click)="toggle(g)">{{ g.status === 'PUBLISHED' ? 'Hide' : 'Publish' }}</button>
                    <button type="button" class="btn btn-ghost btn-sm text-danger" (click)="remove(g)">Delete</button>
                  </div>
                }
              </div>
            </article>
          } @empty {
            <div style="grid-column: 1 / -1"><app-empty-state icon="image" title="No photos yet" /></div>
          }
        </div>
      }
    </div>
    <app-modal [open]="uploadOpen()" title="Upload photos" (closed)="uploadOpen.set(false)">
      <div class="form-grid">
        <div class="field span-2"><label class="label" for="gt">Title <span class="req">*</span></label><input id="gt" class="input" [ngModel]="title()" (ngModelChange)="title.set($event)" /></div>
        <div class="field"><label class="label" for="gl">Location</label><select id="gl" class="select" [ngModel]="loc()" (ngModelChange)="loc.set($event)">@for (l of locations.scoped(); track l.id) {<option [value]="l.id">{{ l.name }}</option>}</select></div>
        <div class="field"><label class="label" for="gc">Category</label><select id="gc" class="select" [ngModel]="cat()" (ngModelChange)="cat.set($event)">@for (c of cats; track c) {<option [value]="c">{{ c }}</option>}</select></div>
        <div class="field span-2"><app-file-upload accept="image/*" (filesChange)="onFiles($event)" /></div>
      </div>
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="uploadOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="!title().trim() || !count()" (click)="upload()">Upload {{ count() || '' }}</button>
      </div>
    </app-modal>
  `,
})
export class GalleryAdminComponent {
  protected readonly gallery = inject(GalleryService);
  protected readonly locations = inject(LocationService);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.gallery.listScoped());
  protected readonly cats: GalleryItem['category'][] = ['Workspace', 'Meeting Rooms', 'Events', 'Amenities'];
  protected readonly uploadOpen = signal(false);
  protected readonly title = signal('');
  protected readonly loc = signal(this.locations.scoped()[0]?.id ?? '');
  protected readonly cat = signal<GalleryItem['category']>('Workspace');
  protected readonly count = signal(0);
  /** Images stored by the API (POST /api/File/Upload); each becomes a gallery item. */
  private readonly files = signal<Attachment[]>([]);
  protected onFiles(files: Attachment[]): void {
    this.files.set(files.filter((f) => !!f.url));
    this.count.set(this.files().length);
  }
  protected upload(): void {
    const files = this.files();
    files.forEach((f, i) => this.gallery.createSync({ title: files.length > 1 ? `${this.title()} ${i + 1}` : this.title(), locationId: this.loc(), category: this.cat(), seed: f.url!, status: 'PUBLISHED' }));
    this.files.set([]);
    this.toast.success('Photos uploaded', `${this.count()} added to the gallery.`);
    this.uploadOpen.set(false);
    this.title.set('');
    this.count.set(0);
  }
  protected toggle(g: GalleryItem): void {
    this.gallery.updateSync(g.id, { status: g.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED' });
  }
  protected async remove(g: GalleryItem): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Delete photo?', message: g.title, confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    this.gallery.remove(g.id).subscribe(() => this.toast.success('Photo deleted'));
  }
}

@Component({
  selector: 'app-homepage-admin',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header title="Homepage Content" subtitle="Hero, announcement bar, stats and testimonials on the public homepage." [breadcrumbs]="[{ label: 'Marketing / Content' }, { label: 'Homepage' }]">
        <a class="btn btn-secondary" routerLink="/" target="_blank"><app-icon name="external" [size]="16" /> View homepage</a>
      </app-page-header>
      <form [formGroup]="form" (ngSubmit)="save()" novalidate class="stack">
        <section class="card card-body form-grid">
          <h2 class="form-section-title span-all">Hero</h2>
          <div class="field span-2"><label class="label" for="ht">Title <span class="req">*</span></label><input id="ht" class="input" formControlName="heroTitle" /><app-field-error [control]="form.controls.heroTitle" label="Title" /></div>
          <div class="field span-2"><label class="label" for="hs">Subtitle <span class="req">*</span></label><textarea id="hs" class="textarea" rows="2" formControlName="heroSubtitle"></textarea></div>
        </section>
        <section class="card card-body form-grid">
          <h2 class="form-section-title span-all">Announcement bar</h2>
          <div class="field span-2"><label class="label" for="an">Text</label><input id="an" class="input" formControlName="announcement" /></div>
          <label class="switch span-2"><input type="checkbox" formControlName="showAnnouncement" /><span class="track"></span><span>Show announcement bar</span></label>
        </section>
        <section class="card card-body">
          <h2 class="form-section-title">Stats</h2>
          <div formArrayName="stats" class="form-grid">
            @for (s of stats.controls; track $index; let i = $index) {
              <div class="row-sm" [formGroupName]="i">
                <input class="input" formControlName="value" [attr.aria-label]="'Stat ' + (i + 1) + ' value'" style="max-width: 120px" />
                <input class="input" formControlName="label" [attr.aria-label]="'Stat ' + (i + 1) + ' label'" />
              </div>
            }
          </div>
        </section>
        <section class="card card-body">
          <h2 class="form-section-title">Testimonials</h2>
          <div formArrayName="testimonials" class="stack">
            @for (t of testimonials.controls; track $index; let i = $index) {
              <div class="form-grid" [formGroupName]="i">
                <div class="field span-2"><label class="label" [for]="'tq' + i">Quote</label><textarea [id]="'tq' + i" class="textarea" rows="2" formControlName="quote"></textarea></div>
                <div class="field"><label class="label" [for]="'tn' + i">Name</label><input [id]="'tn' + i" class="input" formControlName="name" /></div>
                <div class="field"><label class="label" [for]="'tr' + i">Role</label><input [id]="'tr' + i" class="input" formControlName="role" /></div>
              </div>
            }
          </div>
        </section>
        <div class="form-actions"><button type="submit" class="btn btn-primary" [disabled]="form.invalid || form.pristine || !auth.can('content.edit')">Publish changes</button></div>
      </form>
    </div>
  `,
})
export class HomepageAdminComponent {
  private readonly content = inject(HomepageContentService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly audit = inject(AuditService);
  private readonly c = this.content.content();
  protected readonly form = this.fb.nonNullable.group({
    heroTitle: [this.c.heroTitle, Validators.required],
    heroSubtitle: [this.c.heroSubtitle, Validators.required],
    announcement: [this.c.announcement],
    showAnnouncement: [this.c.showAnnouncement],
    stats: this.fb.array(this.c.stats.map((s) => this.fb.nonNullable.group({ label: [s.label, Validators.required], value: [s.value, Validators.required] }))),
    testimonials: this.fb.array(this.c.testimonials.map((t) => this.fb.nonNullable.group({ quote: [t.quote, Validators.required], name: [t.name, Validators.required], role: [t.role] }))),
  });
  protected get stats(): FormArray {
    return this.form.controls.stats;
  }
  protected get testimonials(): FormArray {
    return this.form.controls.testimonials;
  }
  protected save(): void {
    if (this.form.invalid) return;
    this.content.save({ ...this.content.content(), ...this.form.getRawValue() }).subscribe(() => {
      this.form.markAsPristine();
      this.audit.record('UPDATE', 'Content', 'Homepage', 'HOME', 'Published homepage changes');
      this.toast.success('Homepage updated', 'Changes are live on the website.');
    });
  }
}

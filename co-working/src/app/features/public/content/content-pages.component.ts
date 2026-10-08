import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { SHARED, createLoader, emailValidator, mobileValidator, todayIso } from '../../../shared';
import { BlogService, EventService, GalleryService, HomepageContentService } from '../../../core/services/data/engagement-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { LeadCaptureService } from '../../../core/services/lead-capture.service';
import { ToastService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-public-events',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      <app-page-header title="Events" subtitle="Open community events at Officera centres. Members get priority access." [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Events' }]" />
      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="3" />
      } @else {
        <div class="grid grid-3">
          @for (e of list(); track e.id) {
            <article class="card">
              <app-workspace-image [seed]="e.imageSeed" style="height: 150px" />
              <div class="card-body stack-sm">
                <span class="tag" style="align-self: flex-start">{{ e.category }}</span>
                <h2 class="text-md fw-600">{{ e.title }}</h2>
                <div class="text-sm text-muted"><app-icon name="calendar" [size]="13" /> {{ e.date | date: 'EEE, d MMM' }} · {{ e.startTime | time12 }}</div>
                <div class="text-sm text-muted"><app-icon name="map-pin" [size]="13" /> {{ e.venue }}, {{ locations.name(e.locationId) }}</div>
                <p class="text-sm text-secondary mb-0">{{ e.description }}</p>
              </div>
              <div class="card-footer"><span class="text-xs text-muted">Hosted by {{ e.host }}</span><a class="btn btn-primary btn-sm" routerLink="/register">RSVP as member</a></div>
            </article>
          } @empty {
            <div class="card" style="grid-column: 1 / -1"><app-empty-state icon="star" title="No upcoming public events" /></div>
          }
        </div>
      }
    </div>
  `,
})
export class PublicEventsComponent {
  private readonly events = inject(EventService);
  protected readonly locations = inject(LocationService);
  protected readonly loader = createLoader(() => this.events.list());
  protected readonly list = computed(() => this.events.items().filter((e) => e.isPublic && e.status === 'PUBLISHED' && e.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date)));
}

@Component({
  selector: 'app-blog-list',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      <app-page-header title="Blog" subtitle="Guides, news and ideas for better work." [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Blog' }]">
        <select class="select" style="width: auto" aria-label="Category" [ngModel]="cat()" (ngModelChange)="cat.set($event)">
          <option value="">All topics</option>
          @for (c of categories(); track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
      </app-page-header>
      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="3" />
      } @else {
        <div class="grid grid-3">
          @for (p of list(); track p.id) {
            <a class="card interactive" [routerLink]="['/blog', p.id]" style="color: inherit; text-decoration: none; overflow: hidden">
              <app-workspace-image [seed]="p.imageSeed" style="height: 160px" />
              <div class="card-body stack-sm">
                <span class="eyebrow">{{ p.category }}</span>
                <h2 class="text-md fw-600">{{ p.title }}</h2>
                <p class="text-sm text-secondary mb-0">{{ p.excerpt }}</p>
                <span class="text-xs text-muted">{{ p.author }} · {{ p.publishedAt | date: 'd MMM y' }} · {{ p.readMinutes }} min read</span>
              </div>
            </a>
          } @empty {
            <div class="card" style="grid-column: 1 / -1"><app-empty-state icon="file-text" title="No articles yet" /></div>
          }
        </div>
      }
    </div>
  `,
})
export class BlogListComponent {
  private readonly blog = inject(BlogService);
  protected readonly loader = createLoader(() => this.blog.list());
  protected readonly cat = signal('');
  private readonly published = computed(() => this.blog.items().filter((b) => b.status === 'PUBLISHED' && b.publishedAt <= todayIso()).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
  protected readonly categories = computed(() => [...new Set(this.published().map((b) => b.category))]);
  protected readonly list = computed(() => this.published().filter((b) => !this.cat() || b.category === this.cat()));
}

@Component({
  selector: 'app-blog-post',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="max-width: 820px; padding-top: 24px; padding-bottom: 48px">
      @if (post(); as p) {
        <app-page-header [title]="p.title" [subtitle]="p.author + ' · ' + (p.publishedAt | date: 'd MMM y') + ' · ' + p.readMinutes + ' min read'" [breadcrumbs]="[{ label: 'Blog', link: '/blog' }, { label: p.category }]" />
        <app-workspace-image [seed]="p.imageSeed" style="height: 280px; border-radius: 8px" />
        <article class="blog-body mt-5">
          <p class="fw-500">{{ p.excerpt }}</p>
          @for (para of p.body; track $index) {
            <p>{{ para }}</p>
          }
        </article>
        <div class="cta-band mt-6"><div><h2>Find your workspace</h2></div><a class="btn btn-secondary" routerLink="/search">Search workspaces</a></div>
      } @else {
        <div class="card"><app-empty-state icon="file-text" title="Article not found"><a routerLink="/blog" class="btn btn-secondary">Back to blog</a></app-empty-state></div>
      }
    </div>
  `,
})
export class BlogPostComponent {
  readonly id = input.required<string>();
  private readonly blog = inject(BlogService);
  protected readonly post = computed(() => this.blog.find(this.id()));
}

@Component({
  selector: 'app-gallery',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      <app-page-header title="Gallery" subtitle="A look inside Officera centres." [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Gallery' }]">
        <div class="segmented">
          <button type="button" [class.active]="!cat()" (click)="cat.set('')">All</button>
          @for (c of cats; track c) {
            <button type="button" [class.active]="cat() === c" (click)="cat.set(c)">{{ c }}</button>
          }
        </div>
      </app-page-header>
      <div class="grid grid-auto">
        @for (g of list(); track g.id) {
          <button type="button" class="card" style="padding: 0; overflow: hidden; text-align: left; border: 1px solid var(--border); cursor: zoom-in" (click)="view.set(g.id)">
            <app-workspace-image [seed]="g.seed" [alt]="g.title" style="height: 190px" />
            <div class="card-body" style="padding: 10px 14px"><div class="fw-500">{{ g.title }}</div><div class="text-xs text-muted">{{ locations.shortName(g.locationId) }} · {{ g.category }}</div></div>
          </button>
        }
      </div>
    </div>
    <app-modal [open]="!!view()" [title]="current()?.title ?? ''" [subtitle]="current() ? locations.name(current()!.locationId) : ''" size="lg" (closed)="view.set(null)">
      @if (current(); as g) {
        <app-workspace-image [seed]="g.seed" [alt]="g.title" style="height: 420px; border-radius: 8px" />
      }
    </app-modal>
  `,
})
export class GalleryComponent {
  private readonly gallery = inject(GalleryService);
  protected readonly locations = inject(LocationService);
  protected readonly cats = ['Workspace', 'Meeting Rooms', 'Events', 'Amenities'];
  protected readonly cat = signal('');
  protected readonly view = signal<string | null>(null);
  protected readonly list = computed(() => this.gallery.items().filter((g) => g.status === 'PUBLISHED' && (!this.cat() || g.category === this.cat())));
  protected readonly current = computed(() => this.gallery.find(this.view() ?? undefined));
}

@Component({
  selector: 'app-about',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      <app-page-header title="About Officera" subtitle="Smart Workspaces. Simple Management." [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'About' }]" />
      <div class="split">
        <div class="blog-body">
          <p>Officera runs premium coworking centres across Hyderabad, Bangalore and Chennai for freelancers, startups and enterprise teams.</p>
          <p>Every part of the workspace — booking a desk, inviting a guest, opening the door, paying an invoice — happens in one app, so teams spend their time on work, not admin.</p>
          <div class="stat-grid mt-5">
            @for (s of content.content().stats; track s.label) {
              <app-stat-card [label]="s.label" [value]="s.value" />
            }
          </div>
          <h2 class="section-title mt-6" id="terms">Terms of Service</h2>
          <p>Memberships renew automatically and can be paused or cancelled from the member portal. Bookings follow each resource’s cancellation rules. (Summary for the mockup.)</p>
          <h2 class="section-title mt-5" id="privacy">Privacy Policy</h2>
          <p>We use your contact details only to manage your membership, bookings and visitor passes, and never sell your data. (Summary for the mockup.)</p>
        </div>
        <app-workspace-image [seed]="2" style="height: 360px; border-radius: 8px" />
      </div>
    </div>
  `,
})
export class AboutComponent {
  protected readonly content = inject(HomepageContentService);
}

@Component({
  selector: 'app-contact',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-container" style="padding-top: 24px; padding-bottom: 48px">
      <app-page-header title="Contact us" subtitle="We usually reply within one working day." [breadcrumbs]="[{ label: 'Home', link: '/' }, { label: 'Contact' }]" />
      <div class="split">
        @if (sent()) {
          <section class="card"><app-success-state title="Message sent" message="Thanks for reaching out. Our team will get back to you shortly."><a routerLink="/" class="btn btn-primary">Back to home</a></app-success-state></section>
        } @else {
          <form class="card card-body form-grid" [formGroup]="form" (ngSubmit)="send()" novalidate>
            <div class="field"><label class="label" for="cn">Name <span class="req">*</span></label><input id="cn" class="input" formControlName="name" /><app-field-error [control]="form.controls.name" label="Name" /></div>
            <div class="field"><label class="label" for="ce">Email <span class="req">*</span></label><input id="ce" class="input" type="email" formControlName="email" /><app-field-error [control]="form.controls.email" label="Email" /></div>
            <div class="field"><label class="label" for="cm">Mobile <span class="req">*</span></label><input id="cm" class="input" maxlength="10" formControlName="mobile" /><app-field-error [control]="form.controls.mobile" label="Mobile" /></div>
            <div class="field"><label class="label" for="cl">Centre</label><select id="cl" class="select" formControlName="locationId">@for (l of locations.active(); track l.id) {<option [value]="l.id">{{ l.name }}</option>}</select></div>
            <div class="field span-2"><label class="label" for="cmsg">Message <span class="req">*</span></label><textarea id="cmsg" class="textarea" rows="5" formControlName="message"></textarea><app-field-error [control]="form.controls.message" label="Message" /></div>
            <div class="span-all"><button type="submit" class="btn btn-primary" [disabled]="form.invalid">Send message</button></div>
          </form>
        }
        <aside class="stack">
          @for (l of locations.active(); track l.id) {
            <div class="card card-body">
              <div class="fw-600">{{ l.name }}</div>
              <div class="text-sm text-muted">{{ l.address }}, {{ l.city }}</div>
              <div class="text-sm mt-1"><a [href]="'tel:' + l.phone">{{ l.phone }}</a> · <a [href]="'mailto:' + l.email">{{ l.email }}</a></div>
            </div>
          }
        </aside>
      </div>
    </div>
  `,
})
export class ContactComponent {
  protected readonly locations = inject(LocationService);
  private readonly capture = inject(LeadCaptureService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly sent = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, emailValidator]],
    mobile: ['', [Validators.required, mobileValidator]],
    locationId: [''],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });
  protected send(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    this.capture.submitEnquiry('WEBSITE', { name: v.name, mobile: v.mobile, email: v.email, locationId: v.locationId || (this.locations.active()[0]?.id ?? ''), requirement: v.message.slice(0, 120) }).subscribe({
      next: () => {
        this.sent.set(true);
        this.toast.success('Message sent');
      },
      error: (e: { message: string }) => this.toast.error('Message not sent', e.message),
    });
  }
}

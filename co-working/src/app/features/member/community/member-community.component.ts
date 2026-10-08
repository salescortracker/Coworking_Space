import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { SHARED, createLoader, todayIso } from '../../../shared';
import { CommunityEvent, Perk, Post } from '../../../core/models';
import { EventService, PerkService, PostService } from '../../../core/services/data/engagement-data.service';
import { CompanyService, MemberService } from '../../../core/services/data/people-data.service';
import { LocationService } from '../../../core/services/data/workspace-data.service';
import { MemberAccountService } from '../../../core/services/member-account.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService, ToastService } from '../../../core/services/ui.service';

/** Community feed: posts, announcements, likes, comments. */
@Component({
  selector: 'app-community-feed',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow" style="max-width: 1100px">
      <app-page-header title="Community" subtitle="Announcements and posts from members across Officera." [breadcrumbs]="[{ label: 'Dashboard', link: '/member/dashboard' }, { label: 'Community' }]" />
      <div class="split">
        <div class="stack">
          <section class="card card-body">
            <div class="row row-start">
              <app-avatar [name]="auth.user()?.name ?? 'Me'" [size]="40" />
              <div class="flex-1">
                <label class="sr-only" for="np">Write a post</label>
                <textarea id="np" class="textarea" rows="3" maxlength="500" placeholder="Share an update, ask for a recommendation or announce a hiring need…" [ngModel]="draft()" (ngModelChange)="draft.set($event)"></textarea>
                <div class="row-between mt-2">
                  <span class="text-xs text-muted">{{ draft().length }}/500 · visible to members at all centres</span>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="draft().trim().length < 3" (click)="publish()"><app-icon name="send" [size]="14" /> Post</button>
                </div>
              </div>
            </div>
          </section>
          <div class="segmented" role="radiogroup" aria-label="Feed filter">
            @for (f of filters; track f.id) {
              <button type="button" [class.active]="filter() === f.id" (click)="filter.set(f.id)">{{ f.label }}</button>
            }
          </div>
          @if (loader.status() === 'loading') {
            <app-loading-state variant="cards" [rows]="3" />
          } @else if (loader.status() === 'error') {
            <div class="card"><app-error-state (retry)="loader.load()" /></div>
          } @else {
            @for (p of feed(); track p.id) {
              <article class="card post" [class.announcement]="p.type === 'ANNOUNCEMENT'">
                <div class="card-body">
                  <div class="row row-start">
                    <app-avatar [name]="p.authorName" [size]="40" />
                    <div class="flex-1 min-0">
                      <div class="row-sm row-wrap">
                        <strong>{{ p.authorName }}</strong>
                        @if (p.type === 'ANNOUNCEMENT') {
                          <span class="badge badge-primary"><app-icon name="megaphone" [size]="10" /> Announcement</span>
                        }
                        @if (p.pinned) {
                          <span class="tag">Pinned</span>
                        }
                      </div>
                      <div class="text-xs text-muted">{{ p.authorRole }} · {{ p.at | ago }}{{ p.locationId ? ' · ' + locations.shortName(p.locationId) : '' }}</div>
                    </div>
                    @if (p.authorMemberId && p.authorMemberId === acct.memberId()) {
                      <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="remove(p)" aria-label="Delete post"><app-icon name="trash" [size]="14" /></button>
                    }
                  </div>
                  <p class="mt-3 mb-0" style="white-space: pre-wrap">{{ p.content }}</p>
                </div>
                <div class="post-actions">
                  <button type="button" class="btn btn-ghost btn-sm" [class.liked]="liked(p)" (click)="toggleLike(p)" [attr.aria-pressed]="liked(p)"><app-icon name="heart" [size]="16" /> {{ p.likes }}</button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="openComments.set(openComments() === p.id ? null : p.id)"><app-icon name="message" [size]="16" /> {{ p.comments.length }}</button>
                </div>
                @if (openComments() === p.id) {
                  <div class="card-body" style="border-top: 1px solid var(--border)">
                    @for (c of p.comments; track c.id) {
                      <div class="comment">
                        <app-avatar [name]="c.author" [size]="28" />
                        <div><div class="comment-meta"><strong>{{ c.author }}</strong><span class="text-xs text-muted">{{ c.at | ago }}</span></div><div class="comment-text">{{ c.text }}</div></div>
                      </div>
                    }
                    <div class="row-sm mt-3">
                      <input class="input" aria-label="Write a comment" placeholder="Write a comment…" [ngModel]="comment()" (ngModelChange)="comment.set($event)" (keydown.enter)="addComment(p)" />
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="!comment().trim()" (click)="addComment(p)">Reply</button>
                    </div>
                  </div>
                }
              </article>
            } @empty {
              <div class="card"><app-empty-state icon="message" title="No posts yet" message="Be the first to share something with the community." /></div>
            }
          }
        </div>
        <aside class="stack">
          <section class="card">
            <div class="card-header"><h2 class="card-title">Upcoming events</h2><a routerLink="/member/events" class="btn btn-ghost btn-sm">All</a></div>
            <ul class="list-plain card-body" style="padding-top: 4px; padding-bottom: 4px">
              @for (e of events(); track e.id) {
                <li class="list-row">
                  <span class="min-0"><span class="d-block fw-500 truncate">{{ e.title }}</span><span class="text-xs text-muted">{{ e.date | date: 'EEE d MMM' }} · {{ e.startTime | time12 }}</span></span>
                  <a class="btn btn-secondary btn-sm" routerLink="/member/events" [queryParams]="{ id: e.id }">View</a>
                </li>
              }
            </ul>
          </section>
          <section class="card card-body">
            <h2 class="section-title">Community guidelines</h2>
            <ul class="check-list text-sm">
              <li><app-icon name="check" [size]="14" /> Be respectful and constructive.</li>
              <li><app-icon name="check" [size]="14" /> No spam or unsolicited promotions.</li>
              <li><app-icon name="check" [size]="14" /> Use Partner Perks for offers.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  `,
  styles: `
    .post.announcement { border-left: 3px solid var(--primary); }
    .post-actions { display: flex; gap: 4px; padding: 4px 12px 8px; }
    .post-actions .liked { color: var(--danger); }
  `,
})
export class CommunityFeedComponent {
  private readonly posts = inject(PostService);
  private readonly eventSvc = inject(EventService);
  protected readonly locations = inject(LocationService);
  protected readonly acct = inject(MemberAccountService);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.posts.list());
  protected readonly draft = signal('');
  protected readonly comment = signal('');
  protected readonly openComments = signal<string | null>(null);
  protected readonly filter = signal('all');
  protected readonly filters = [
    { id: 'all', label: 'All' },
    { id: 'ANNOUNCEMENT', label: 'Announcements' },
    { id: 'POST', label: 'Member posts' },
    { id: 'mine', label: 'My centre' },
  ];
  protected readonly feed = computed(() =>
    this.posts
      .items()
      .filter((p) => p.status === 'PUBLISHED')
      .filter((p) => this.filter() === 'all' || (this.filter() === 'mine' ? !p.locationId || p.locationId === this.acct.member()?.locationId : p.type === this.filter()))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at)),
  );
  protected readonly events = computed(() => this.eventSvc.items().filter((e) => e.status === 'PUBLISHED' && e.date >= todayIso()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4));

  protected liked(p: Post): boolean {
    return !!this.acct.memberId() && p.likedBy.includes(this.acct.memberId()!);
  }
  protected toggleLike(p: Post): void {
    const me = this.acct.memberId();
    if (!me) return;
    const on = p.likedBy.includes(me);
    this.posts.updateSync(p.id, { likedBy: on ? p.likedBy.filter((x) => x !== me) : [...p.likedBy, me], likes: p.likes + (on ? -1 : 1) });
  }
  protected publish(): void {
    const m = this.acct.member();
    if (!m) return;
    this.posts.createSync({ authorName: `${m.firstName} ${m.lastName}`, authorRole: m.designation || 'Member', authorMemberId: m.id, type: 'POST', content: this.draft().trim(), at: new Date().toISOString(), likes: 0, likedBy: [], comments: [], locationId: m.locationId, status: 'PUBLISHED' });
    this.draft.set('');
    this.toast.success('Posted to the community');
  }
  protected addComment(p: Post): void {
    const text = this.comment().trim();
    if (!text) return;
    this.posts.updateSync(p.id, { comments: [...p.comments, { id: `PC-${Date.now()}`, author: this.auth.user()?.name ?? 'Member', text, at: new Date().toISOString() }] });
    this.comment.set('');
  }
  protected async remove(p: Post): Promise<void> {
    const ok = await this.confirm.confirm({ title: 'Delete post?', message: 'This post and its comments will be removed.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    this.posts.remove(p.id).subscribe(() => this.toast.success('Post deleted'));
  }
}

@Component({
  selector: 'app-member-events',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Events" subtitle="Workshops, meetups and socials across Officera centres." [breadcrumbs]="[{ label: 'Community', link: '/member/community' }, { label: 'Events' }]">
        <div class="segmented" role="radiogroup" aria-label="Event filter">
          <button type="button" [class.active]="scope() === 'upcoming'" (click)="scope.set('upcoming')">Upcoming</button>
          <button type="button" [class.active]="scope() === 'going'" (click)="scope.set('going')">Going</button>
          <button type="button" [class.active]="scope() === 'past'" (click)="scope.set('past')">Past</button>
        </div>
      </app-page-header>
      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="3" />
      } @else if (loader.status() === 'error') {
        <div class="card"><app-error-state (retry)="loader.load()" /></div>
      } @else {
        <div class="grid grid-auto">
          @for (e of list(); track e.id) {
            <article class="card event-card" [class.selected]="highlight() === e.id">
              <app-workspace-image [seed]="e.imageSeed" style="height: 140px" />
              <div class="card-body stack-sm">
                <div class="row-between"><span class="tag">{{ e.category }}</span>@if (isGoing(e)) {<span class="badge badge-success">Going</span>}</div>
                <h3 class="text-md fw-600">{{ e.title }}</h3>
                <div class="text-sm text-muted"><app-icon name="calendar" [size]="13" /> {{ e.date | date: 'EEE, d MMM y' }} · {{ e.startTime | time12 }} – {{ e.endTime | time12 }}</div>
                <div class="text-sm text-muted"><app-icon name="map-pin" [size]="13" /> {{ e.venue }}, {{ locations.shortName(e.locationId) }}</div>
                <p class="text-sm text-secondary mb-0">{{ e.description }}</p>
                <div class="row-between mt-2">
                  <span class="text-xs text-muted">{{ e.attendees.length + baseCount(e) }} / {{ e.capacity }} attending · by {{ e.host }}</span>
                </div>
                <div class="progress"><span [style.width.%]="((e.attendees.length + baseCount(e)) / e.capacity) * 100"></span></div>
              </div>
              <div class="card-footer">
                @if (e.date < today) {
                  <span class="text-sm text-muted">Event ended</span>
                } @else if (isGoing(e)) {
                  <button type="button" class="btn btn-secondary btn-sm" (click)="rsvp(e)">Cancel RSVP</button>
                } @else {
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="e.attendees.length + baseCount(e) >= e.capacity" (click)="rsvp(e)">{{ e.attendees.length + baseCount(e) >= e.capacity ? 'Full' : 'RSVP' }}</button>
                }
              </div>
            </article>
          } @empty {
            <div class="card" style="grid-column: 1 / -1"><app-empty-state icon="star" title="No events here" message="Check back soon for workshops and meetups." /></div>
          }
        </div>
      }
    </div>
  `,
})
export class MemberEventsComponent {
  readonly id = input<string>();
  private readonly events = inject(EventService);
  protected readonly locations = inject(LocationService);
  private readonly acct = inject(MemberAccountService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.events.list());
  protected readonly today = todayIso();
  protected readonly scope = signal('upcoming');
  protected readonly highlight = computed(() => this.id());
  protected readonly list = computed(() => {
    const pub = this.events.items().filter((e) => e.status === 'PUBLISHED').sort((a, b) => a.date.localeCompare(b.date));
    if (this.scope() === 'past') return pub.filter((e) => e.date < this.today).reverse();
    if (this.scope() === 'going') return pub.filter((e) => this.isGoing(e));
    return pub.filter((e) => e.date >= this.today);
  });
  protected baseCount(e: CommunityEvent): number {
    return Math.floor(e.capacity * 0.4);
  }
  protected isGoing(e: CommunityEvent): boolean {
    return !!this.acct.memberId() && e.attendees.includes(this.acct.memberId()!);
  }
  protected rsvp(e: CommunityEvent): void {
    const me = this.acct.memberId();
    if (!me) return;
    const going = this.isGoing(e);
    this.events.updateSync(e.id, { attendees: going ? e.attendees.filter((x) => x !== me) : [...e.attendees, me] });
    this.toast.success(going ? 'RSVP cancelled' : 'You’re going!', going ? e.title : `${e.title} has been added to your calendar.`);
  }
}

/** Member directory: only profiles marked visible are listed. Includes own visibility control. */
@Component({
  selector: 'app-member-directory',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Member Directory" subtitle="Find and connect with other members. Only profiles set to visible appear here." [breadcrumbs]="[{ label: 'Community', link: '/member/community' }, { label: 'Directory' }]" />
      <section class="card card-body mb-4 row-between row-wrap">
        <div>
          <div class="fw-600">Your profile visibility</div>
          <div class="text-sm text-muted">{{ acct.member()?.directoryVisible ? 'Other members can see your name, company, designation and skills.' : 'You are hidden from the directory.' }}</div>
        </div>
        <label class="switch">
          <input type="checkbox" [checked]="acct.member()?.directoryVisible" (change)="toggleVisibility()" />
          <span class="track"></span>
          <span>{{ acct.member()?.directoryVisible ? 'Visible' : 'Hidden' }}</span>
        </label>
      </section>
      <section class="card">
        <div class="toolbar">
          <div class="input-icon search"><app-icon name="search" [size]="16" /><input class="input" type="search" aria-label="Search members" placeholder="Search name, company or skill" [ngModel]="q()" (ngModelChange)="q.set($event)" /></div>
          <select class="select" aria-label="Location" [ngModel]="loc()" (ngModelChange)="loc.set($event)">
            <option value="">All centres</option>
            @for (l of locations.active(); track l.id) {
              <option [value]="l.id">{{ l.name }}</option>
            }
          </select>
          <span class="spacer"></span>
          <span class="text-sm text-muted">{{ list().length }} members</span>
        </div>
        <div class="card-body">
          @if (loader.status() === 'loading') {
            <app-loading-state variant="cards" [rows]="6" />
          } @else {
            <div class="grid grid-auto-sm">
              @for (m of list(); track m.id) {
                <article class="card card-body text-center dir-card">
                  <app-avatar [name]="m.firstName + ' ' + m.lastName" [size]="64" />
                  <div class="fw-600 mt-2">{{ m.firstName }} {{ m.lastName }}</div>
                  <div class="text-sm text-muted">{{ m.designation }}</div>
                  <div class="text-sm">{{ companies.find(m.companyId)?.name ?? 'Independent' }}</div>
                  <div class="tag-list mt-2" style="justify-content: center">
                    @for (s of m.skills; track s) {
                      <span class="tag">{{ s }}</span>
                    }
                  </div>
                  <a class="btn btn-secondary btn-sm mt-3" [href]="'mailto:' + m.email"><app-icon name="mail" [size]="14" /> Connect</a>
                </article>
              } @empty {
                <div style="grid-column: 1 / -1"><app-empty-state icon="users" title="No members match" message="Try another name, skill or centre." /></div>
              }
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: `.dir-card { display: flex; flex-direction: column; align-items: center; }`,
})
export class MemberDirectoryComponent {
  private readonly members = inject(MemberService);
  protected readonly companies = inject(CompanyService);
  protected readonly locations = inject(LocationService);
  protected readonly acct = inject(MemberAccountService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.members.list());
  protected readonly q = signal('');
  protected readonly loc = signal('');
  protected readonly list = computed(() => {
    const q = this.q().toLowerCase().trim();
    return this.members
      .items()
      .filter((m) => m.directoryVisible && m.status === 'ACTIVE' && m.id !== this.acct.memberId())
      .filter((m) => !this.loc() || m.locationId === this.loc())
      .filter((m) => !q || `${m.firstName} ${m.lastName} ${m.designation} ${this.companies.find(m.companyId)?.name ?? ''} ${m.skills.join(' ')}`.toLowerCase().includes(q));
  });
  protected toggleVisibility(): void {
    const m = this.acct.member();
    if (!m) return;
    this.members.updateSync(m.id, { directoryVisible: !m.directoryVisible });
    this.toast.success(m.directoryVisible ? 'Hidden from directory' : 'Visible in directory');
  }
}

@Component({
  selector: 'app-member-perks',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-page-header title="Partner Perks" subtitle="Exclusive offers from Officera partners." [breadcrumbs]="[{ label: 'Community', link: '/member/community' }, { label: 'Partner Perks' }]">
        <select class="select" style="width: auto" aria-label="Category" [ngModel]="cat()" (ngModelChange)="cat.set($event)">
          <option value="">All categories</option>
          @for (c of categories(); track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
      </app-page-header>
      @if (loader.status() === 'loading') {
        <app-loading-state variant="cards" [rows]="3" />
      } @else {
        <div class="grid grid-auto">
          @for (p of list(); track p.id) {
            <article class="card">
              <div class="card-body stack-sm">
                <div class="row-between">
                  <app-avatar [name]="p.partner" [size]="40" />
                  <span class="badge badge-success no-dot">{{ p.discount }}</span>
                </div>
                <div class="fw-600 text-md">{{ p.partner }}</div>
                <div class="text-secondary">{{ p.offer }}</div>
                <div class="text-xs text-muted">{{ p.category }} · Expires {{ p.expiry | date: 'd MMM y' }}</div>
              </div>
              <div class="card-footer"><span></span><button type="button" class="btn btn-primary btn-sm" (click)="view.set(p)">View offer</button></div>
            </article>
          } @empty {
            <div class="card" style="grid-column: 1 / -1"><app-empty-state icon="gift" title="No active perks" /></div>
          }
        </div>
      }
    </div>
    <app-modal [open]="!!view()" [title]="view()?.partner ?? ''" [subtitle]="view()?.offer ?? ''" size="sm" (closed)="view.set(null)">
      @if (view(); as p) {
        <p>{{ p.description }}</p>
        <div class="text-center card card-body" style="background: var(--surface-alt)">
          <div class="text-xs text-muted mb-1">Your code</div>
          <code class="text-xl fw-700" style="letter-spacing: 0.1em">{{ p.code }}</code>
        </div>
        <p class="text-sm text-muted mt-3 mb-0">{{ p.terms }} Valid until {{ p.expiry | date: 'd MMM y' }}.</p>
      }
      <div footer class="btn-group">
        <button type="button" class="btn btn-secondary" (click)="view.set(null)">Close</button>
        <button type="button" class="btn btn-primary" (click)="copy()"><app-icon name="copy" [size]="16" /> Copy code</button>
      </div>
    </app-modal>
  `,
})
export class MemberPerksComponent {
  private readonly perks = inject(PerkService);
  private readonly toast = inject(ToastService);
  protected readonly loader = createLoader(() => this.perks.list());
  protected readonly cat = signal('');
  protected readonly view = signal<Perk | null>(null);
  private readonly active = computed(() => this.perks.items().filter((p) => p.status === 'ACTIVE' && p.expiry >= todayIso()));
  protected readonly categories = computed(() => [...new Set(this.active().map((p) => p.category))]);
  protected readonly list = computed(() => this.active().filter((p) => !this.cat() || p.category === this.cat()));
  protected copy(): void {
    const p = this.view();
    if (!p) return;
    navigator.clipboard?.writeText(p.code).catch(() => undefined);
    this.perks.updateSync(p.id, { redemptions: p.redemptions + 1 });
    this.toast.success('Code copied', p.code);
  }
}

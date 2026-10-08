import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SHARED, createLoader } from '../../shared';
import { AppNotification, NotificationCategory } from '../../core/models';
import { NotificationCenterService } from '../../core/services/notification.service';
import { NotificationDataService } from '../../core/services/data/operations-data.service';
import { AuthService } from '../../core/services/auth.service';

const CATEGORIES: { id: NotificationCategory; label: string; icon: string }[] = [
  { id: 'BOOKING', label: 'Booking', icon: 'calendar' },
  { id: 'PAYMENT', label: 'Payment', icon: 'credit-card' },
  { id: 'MEMBERSHIP', label: 'Membership', icon: 'membership' },
  { id: 'VISITOR', label: 'Visitor', icon: 'user-plus' },
  { id: 'SUPPORT', label: 'Support', icon: 'support' },
  { id: 'SYSTEM', label: 'System', icon: 'info' },
];

/** Notification center (§31) used by both member portal and console. */
@Component({
  selector: 'app-notification-center',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <app-page-header title="Notifications" [subtitle]="center.unreadCount() + ' unread'" [breadcrumbs]="[{ label: 'Notifications' }]">
        <button type="button" class="btn btn-secondary" (click)="center.markAllRead()" [disabled]="center.unreadCount() === 0"><app-icon name="check" [size]="16" /> Mark all as read</button>
      </app-page-header>
      <section class="card">
        <div class="toolbar">
          <div class="segmented" role="radiogroup" aria-label="Read state">
            @for (s of states; track s.id) {
              <button type="button" [class.active]="state() === s.id" (click)="state.set(s.id)">{{ s.label }}</button>
            }
          </div>
          <select class="select" aria-label="Category" [ngModel]="category()" (ngModelChange)="category.set($event)">
            <option value="">All categories</option>
            @for (c of categories; track c.id) {
              <option [value]="c.id">{{ c.label }}</option>
            }
          </select>
        </div>
        @if (loader.status() === 'loading') {
          <app-loading-state [rows]="5" />
        } @else if (loader.status() === 'error') {
          <app-error-state (retry)="loader.load()" />
        } @else {
          <ul class="list-plain">
            @for (n of filtered(); track n.id) {
              <li class="notif-row" [class.unread]="!n.read">
                <span class="notif-icon cat-{{ n.category.toLowerCase() }}"><app-icon [name]="icon(n.category)" [size]="16" /></span>
                <button type="button" class="notif-main" (click)="open(n)">
                  <span class="row-sm"><span class="fw-600">{{ n.title }}</span><span class="tag">{{ n.category | humanize }}</span></span>
                  <span class="d-block text-secondary text-sm">{{ n.message }}</span>
                  <span class="d-block text-xs text-muted">{{ n.at | ago }} · {{ n.at | date: 'd MMM, h:mm a' }}</span>
                </button>
                <button type="button" class="btn btn-ghost btn-sm nowrap" (click)="toggle(n)">{{ n.read ? 'Mark unread' : 'Mark read' }}</button>
              </li>
            } @empty {
              <li><app-empty-state icon="bell" title="No notifications" message="You’re all caught up." /></li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: `
    .notif-row { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .notif-row:last-child { border-bottom: 0; }
    .notif-row.unread { background: var(--primary-50); }
    .notif-main { flex: 1; min-width: 0; text-align: left; background: none; border: 0; padding: 0; color: inherit; }
  `,
})
export class NotificationCenterComponent {
  protected readonly center = inject(NotificationCenterService);
  private readonly data = inject(NotificationDataService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly loader = createLoader(() => this.data.list());
  protected readonly categories = CATEGORIES;
  protected readonly states = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'read', label: 'Read' },
  ];
  protected readonly state = signal('all');
  protected readonly category = signal('');
  protected readonly filtered = computed(() =>
    this.center.mine().filter((n) => (this.state() === 'all' || (this.state() === 'unread') === !n.read) && (!this.category() || n.category === this.category())),
  );

  protected icon(c: NotificationCategory): string {
    return CATEGORIES.find((x) => x.id === c)?.icon ?? 'bell';
  }

  protected toggle(n: AppNotification): void {
    if (n.read) this.center.markUnread(n.id);
    else this.center.markRead(n.id);
  }

  protected open(n: AppNotification): void {
    this.center.markRead(n.id);
    if (n.link) this.router.navigateByUrl(n.link);
  }
}

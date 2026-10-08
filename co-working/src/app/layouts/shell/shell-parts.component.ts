import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AvatarComponent } from '../../shared/components/basics/basics.component';
import { DropdownComponent } from '../../shared/components/nav/nav.component';
import { RelativeTimePipe } from '../../shared/pipes/format.pipes';
import { NavItem } from '../../core/config/navigation';
import { AuthService } from '../../core/services/auth.service';
import { NotificationCenterService } from '../../core/services/notification.service';
import { GlobalSearchService, SearchGroup } from '../../core/services/search.service';
import { LocationContextService } from '../../core/services/location-context.service';
import { ThemeService } from '../../core/services/theme.service';
import { ROLE_LABELS } from '../../core/models';

/** Light / Dark switch shown in every header (admin, member, public, sign-in). */
@Component({
  selector: 'app-theme-toggle',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="theme-toggle"
      role="switch"
      [attr.aria-checked]="theme.isDark()"
      [attr.aria-label]="theme.isDark() ? 'Dark mode on. Switch to Light Mode' : 'Light mode on. Switch to Dark Mode'"
      [title]="theme.isDark() ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
      (click)="theme.toggleTheme()"
    >
      <app-icon [name]="theme.isDark() ? 'moon' : 'sun'" [size]="17" />
      <span class="theme-toggle-text">{{ theme.isDark() ? 'Dark' : 'Light' }}</span>
    </button>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
}

/** Brand mark used in every shell. */
@Component({
  selector: 'app-logo',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="logo" [routerLink]="link()" [class.inverse]="inverse()" aria-label="Officera home">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" [attr.fill]="inverse() ? '#ffffff' : 'var(--primary-solid)'" />
        <rect x="7" y="7" width="8" height="8" rx="1.5" [attr.fill]="inverse() ? 'var(--primary-solid)' : '#fff'" />
        <rect x="17" y="7" width="8" height="8" rx="1.5" [attr.fill]="inverse() ? 'var(--primary-solid)' : '#fff'" opacity="0.65" />
        <rect x="7" y="17" width="8" height="8" rx="1.5" [attr.fill]="inverse() ? 'var(--primary-solid)' : '#fff'" opacity="0.65" />
        <circle cx="21" cy="21" r="4" [attr.fill]="inverse() ? 'var(--primary-solid)' : '#fff'" />
      </svg>
      @if (!compact()) {
        <span class="logo-text">OFFICERA</span>
      }
    </a>
  `,
})
export class LogoComponent {
  readonly link = input('/');
  readonly inverse = input(false);
  readonly compact = input(false);
}

/** Sidebar navigation with collapsible groups, permission filtering and icon-only mode. */
@Component({
  selector: 'app-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="side-nav" [class.collapsed]="collapsed()" [attr.aria-label]="label()">
      <ul class="list-plain">
        @for (item of visible(); track item.label) {
          @if (item.children?.length) {
            <li class="nav-group" [class.open]="isOpen(item)">
              <button
                type="button"
                class="nav-link nav-group-btn"
                [class.has-active]="groupActive(item)"
                [attr.aria-expanded]="isOpen(item)"
                [attr.title]="collapsed() ? item.label : null"
                (click)="toggle(item)"
              >
                <app-icon [name]="item.icon ?? 'layers'" [size]="18" />
                <span class="nav-text">{{ item.label }}</span>
                <app-icon class="nav-caret" name="chevron-down" [size]="14" />
              </button>
              @if (isOpen(item) && !collapsed()) {
                <ul class="list-plain nav-sub">
                  @for (child of item.children; track child.label) {
                    <li>
                      <a
                        class="nav-link nav-sublink"
                        [routerLink]="child.link"
                        routerLinkActive="active"
                        [routerLinkActiveOptions]="{ exact: !!child.exact }"
                        (click)="navigate.emit()"
                        >{{ child.label }}</a
                      >
                    </li>
                  }
                </ul>
              }
            </li>
          } @else {
            <li>
              <a
                class="nav-link"
                [routerLink]="item.link"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: !!item.exact }"
                [attr.title]="collapsed() ? item.label : null"
                (click)="navigate.emit()"
              >
                <app-icon [name]="item.icon ?? 'layers'" [size]="18" />
                <span class="nav-text">{{ item.label }}</span>
              </a>
            </li>
          }
        }
      </ul>
    </nav>
  `,
})
export class SidebarNavComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly items = input.required<NavItem[]>();
  readonly collapsed = input(false);
  readonly label = input('Main navigation');
  readonly navigate = output<void>();
  /** In collapsed mode clicking a group expands the sidebar. */
  readonly expandRequest = output<void>();

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  private readonly manual = signal<Record<string, boolean>>({});

  protected readonly visible = computed(() => {
    const can = (i: NavItem) => !i.permission || this.auth.can(i.permission);
    return this.items()
      .map((i) => (i.children ? { ...i, children: i.children.filter(can) } : i))
      .filter((i) => (i.children ? i.children.length > 0 : can(i)));
  });

  protected groupActive(item: NavItem): boolean {
    const url = this.url().split('?')[0];
    return !!item.children?.some((c) => c.link && (url === c.link || url.startsWith(c.link + '/')));
  }

  protected isOpen(item: NavItem): boolean {
    const m = this.manual()[item.label];
    return m ?? this.groupActive(item);
  }

  protected toggle(item: NavItem): void {
    if (this.collapsed()) {
      this.expandRequest.emit();
      this.manual.update((s) => ({ ...s, [item.label]: true }));
      return;
    }
    this.manual.update((s) => ({ ...s, [item.label]: !this.isOpen(item) }));
  }
}

/** Notification bell with unread count, recent list, mark-as-read and view-all. */
@Component({
  selector: 'app-notification-bell',
  imports: [DropdownComponent, IconComponent, RelativeTimePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dropdown width="360px" [autoClose]="false" #dd>
      <button trigger type="button" class="btn btn-ghost btn-icon topbar-btn" [attr.aria-label]="'Notifications, ' + center.unreadCount() + ' unread'">
        <app-icon name="bell" [size]="20" />
        @if (center.unreadCount() > 0) {
          <span class="count-pill bell-count">{{ center.unreadCount() > 9 ? '9+' : center.unreadCount() }}</span>
        }
      </button>
      <div class="notif-menu">
        <div class="row-between notif-head">
          <span class="fw-600">Notifications</span>
          <button type="button" class="btn btn-link text-sm" [disabled]="center.unreadCount() === 0" (click)="center.markAllRead()">Mark all as read</button>
        </div>
        <ul class="list-plain notif-list">
          @for (n of recent(); track n.id) {
            <li>
              <a class="notif-item" [class.unread]="!n.read" [routerLink]="n.link ?? viewAll()" (click)="center.markRead(n.id); dd.close()">
                <span class="notif-icon cat-{{ n.category.toLowerCase() }}"><app-icon [name]="icon(n.category)" [size]="15" /></span>
                <span class="flex-1">
                  <span class="notif-title">{{ n.title }}</span>
                  <span class="notif-msg">{{ n.message }}</span>
                  <span class="notif-time">{{ n.at | ago }}</span>
                </span>
                @if (!n.read) {
                  <span class="dot" style="background: var(--primary)" aria-label="Unread"></span>
                }
              </a>
            </li>
          } @empty {
            <li class="text-muted text-sm" style="padding: 24px; text-align: center">You’re all caught up.</li>
          }
        </ul>
        <a class="notif-foot" [routerLink]="viewAll()" (click)="dd.close()">View all notifications</a>
      </div>
    </app-dropdown>
  `,
})
export class NotificationBellComponent {
  protected readonly center = inject(NotificationCenterService);
  readonly viewAll = input('/member/notifications');
  protected readonly recent = computed(() => this.center.mine().slice(0, 6));
  protected icon(cat: string): string {
    return ({ BOOKING: 'calendar', PAYMENT: 'credit-card', MEMBERSHIP: 'membership', VISITOR: 'user-plus', SUPPORT: 'support', SYSTEM: 'info' } as Record<string, string>)[cat] ?? 'bell';
  }
}

/** Top-right profile dropdown. */
@Component({
  selector: 'app-profile-menu',
  imports: [DropdownComponent, IconComponent, AvatarComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dropdown width="240px">
      <button trigger type="button" class="profile-btn" aria-label="Open profile menu">
        <app-avatar [name]="auth.user()?.name ?? 'User'" [size]="32" />
        <span class="profile-meta hide-mobile">
          <span class="profile-name">{{ auth.user()?.name }}</span>
          <span class="profile-role">{{ roleLabel() }}</span>
        </span>
        <app-icon class="hide-mobile" name="chevron-down" [size]="14" />
      </button>
      <div class="menu-label">{{ auth.user()?.email }}</div>
      <a class="menu-item" [routerLink]="base() + '/profile'"><app-icon name="user" [size]="16" /> My Profile</a>
      <a class="menu-item" [routerLink]="settingsLink()"><app-icon name="settings" [size]="16" /> Settings</a>
      <a class="menu-item" [routerLink]="base() + '/notifications'"><app-icon name="bell" [size]="16" /> Notifications</a>
      <a class="menu-item" [routerLink]="base() + '/profile'" [queryParams]="{ tab: 'security' }"><app-icon name="lock" [size]="16" /> Change Password</a>
      <div class="menu-sep"></div>
      <button type="button" class="menu-item danger" (click)="auth.logout()"><app-icon name="logout" [size]="16" /> Logout</button>
    </app-dropdown>
  `,
})
export class ProfileMenuComponent {
  protected readonly auth = inject(AuthService);
  protected readonly base = computed(() => (this.auth.isMember() ? '/member' : '/admin'));
  protected readonly settingsLink = computed(() =>
    this.auth.isMember() ? '/member/profile' : this.auth.can('settings.view') ? '/admin/administration/settings' : '/admin/profile',
  );
  protected readonly roleLabel = computed(() => {
    const r = this.auth.role();
    return r ? ROLE_LABELS[r] : '';
  });
}

/** Global console search with categorised results. */
@Component({
  selector: 'app-global-search',
  imports: [FormsModule, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'global-search', '(document:click)': 'onDoc($event)', '(document:keydown)': 'onKey($event)' },
  template: `
    <div class="input-icon">
      <app-icon name="search" [size]="16" />
      <label class="sr-only" for="global-search">Search members, bookings, invoices…</label>
      <input
        #box
        id="global-search"
        class="input"
        type="search"
        autocomplete="off"
        placeholder="Search members, bookings, invoices…"
        [ngModel]="term()"
        (ngModelChange)="onTerm($event)"
        (focus)="open.set(true)"
        role="combobox"
        aria-controls="global-search-results"
        [attr.aria-expanded]="open() && term().length > 1"
      />
      <kbd class="kbd hide-mobile">/</kbd>
    </div>
    @if (open() && term().length > 1) {
      <div class="search-results menu" id="global-search-results" role="listbox">
        @for (g of results(); track g.category) {
          <div class="menu-label">{{ g.category }}</div>
          @for (h of g.hits; track h.id) {
            <a class="menu-item" [routerLink]="h.link" (click)="close()" role="option">
              <app-icon [name]="h.icon" [size]="16" />
              <span class="flex-1 min-0">
                <span class="d-block truncate fw-500">{{ h.title }}</span>
                <span class="d-block truncate text-xs text-muted">{{ h.subtitle }}</span>
              </span>
            </a>
          }
        } @empty {
          <div class="text-muted text-sm" style="padding: 16px">No matches for “{{ term() }}”.</div>
        }
      </div>
    }
  `,
})
export class GlobalSearchComponent {
  private readonly search = inject(GlobalSearchService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  protected readonly term = signal('');
  protected readonly open = signal(false);
  protected readonly results = signal<SearchGroup[]>([]);

  protected onTerm(v: string): void {
    this.term.set(v);
    this.open.set(true);
    this.results.set(this.search.searchSync(v));
  }

  protected close(): void {
    this.open.set(false);
    this.term.set('');
  }

  protected onDoc(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      e.preventDefault();
      this.box()?.nativeElement.focus();
    }
    if (e.key === 'Escape') this.open.set(false);
  }
}

/** Global location selector for the console (multi-location support). */
@Component({
  selector: 'app-location-selector',
  imports: [IconComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="location-select">
      <app-icon name="map-pin" [size]="16" />
      <label class="sr-only" for="loc-select">Location</label>
      <select id="loc-select" class="select" [ngModel]="ctx.value()" (ngModelChange)="ctx.select($event)">
        @for (o of ctx.options(); track o.value) {
          <option [value]="o.value">{{ o.indent ? '   ' : '' }}{{ o.label }}</option>
        }
      </select>
    </div>
  `,
})
export class LocationSelectorComponent {
  protected readonly ctx = inject(LocationContextService);
}

import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '../shared/components/icon/icon.component';
import { AvatarComponent } from '../shared/components/basics/basics.component';
import { LogoComponent, NotificationBellComponent, ProfileMenuComponent, SidebarNavComponent, ThemeToggleComponent } from './shell/shell-parts.component';
import { MEMBER_BOTTOM_NAV, MEMBER_NAV } from '../core/config/navigation';
import { AuthService } from '../core/services/auth.service';
import { MemberAccountService } from '../core/services/member-account.service';

/** Member portal shell: sidebar on desktop, drawer + bottom navigation on mobile. */
@Component({
  selector: 'app-member-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AvatarComponent, LogoComponent, SidebarNavComponent, NotificationBellComponent, ProfileMenuComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="shell member-shell" [class.drawer-open]="drawerOpen()" [class.sidebar-collapsed]="collapsed()">
      <header class="topbar">
        <button type="button" class="btn btn-ghost btn-icon topbar-btn menu-toggle" (click)="toggleSidebar()" aria-label="Toggle navigation">
          <app-icon name="menu" [size]="20" />
        </button>
        <app-logo link="/member/dashboard" />
        <span class="spacer"></span>
        <app-theme-toggle />
        <a routerLink="/member/bookings/new" class="btn btn-primary btn-sm hide-mobile"><app-icon name="plus" [size]="16" /> Book Workspace</a>
        <app-notification-bell viewAll="/member/notifications" />
        <app-profile-menu />
      </header>

      <aside class="sidebar light" aria-label="Member navigation">
        <div class="sidebar-head show-drawer">
          <app-logo link="/member/dashboard" />
          <button type="button" class="btn btn-ghost btn-icon btn-sm sidebar-close" (click)="drawerOpen.set(false)" aria-label="Close navigation">
            <app-icon name="x" />
          </button>
        </div>
        @if (!collapsed() || drawerOpen()) {
          <div class="member-card">
            <app-avatar [name]="auth.user()?.name ?? 'Member'" [size]="36" />
            <div class="min-0">
              <div class="fw-600 truncate">{{ auth.user()?.name }}</div>
              <div class="text-xs text-muted truncate">{{ planName() }}</div>
            </div>
          </div>
        }
        <app-sidebar-nav [items]="nav" [collapsed]="collapsed() && !drawerOpen()" label="Member navigation" (navigate)="drawerOpen.set(false)" />
        <button type="button" class="sidebar-collapse hide-mobile" (click)="collapsed.set(!collapsed())" [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
          <app-icon [name]="collapsed() ? 'chevron-right' : 'chevron-left'" [size]="16" />
          @if (!collapsed()) {
            <span>Collapse</span>
          }
        </button>
      </aside>
      <div class="drawer-scrim" (click)="drawerOpen.set(false)"></div>

      <main id="main" class="shell-main" tabindex="-1">
        <router-outlet />
      </main>

      <nav class="bottom-nav" aria-label="Quick navigation">
        @for (item of bottomNav; track item.link) {
          <a [routerLink]="item.link" routerLinkActive="active">
            <app-icon [name]="item.icon!" [size]="20" />
            <span>{{ item.label }}</span>
          </a>
        }
        <button type="button" (click)="drawerOpen.set(true)">
          <app-icon name="menu" [size]="20" />
          <span>More</span>
        </button>
      </nav>
    </div>
  `,
})
export class MemberLayoutComponent {
  protected readonly auth = inject(AuthService);
  private readonly account = inject(MemberAccountService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly nav = MEMBER_NAV;
  protected readonly bottomNav = MEMBER_BOTTOM_NAV;
  protected readonly drawerOpen = signal(false);
  protected readonly collapsed = signal(false);
  protected readonly planName = computed(() => this.account.plan()?.name ?? 'No active plan');

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.drawerOpen.set(false));
  }

  protected toggleSidebar(): void {
    if (this.isBrowser && window.innerWidth < 1024) this.drawerOpen.update((o) => !o);
    else this.collapsed.update((c) => !c);
  }
}

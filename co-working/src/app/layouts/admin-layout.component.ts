import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '../shared/components/icon/icon.component';
import { DropdownComponent } from '../shared/components/nav/nav.component';
import { ModalComponent } from '../shared/components/overlay/overlay.component';
import {
  GlobalSearchComponent,
  LocationSelectorComponent,
  LogoComponent,
  NotificationBellComponent,
  ProfileMenuComponent,
  SidebarNavComponent,
  ThemeToggleComponent,
} from './shell/shell-parts.component';
import { ADMIN_NAV } from '../core/config/navigation';
import { AuthService } from '../core/services/auth.service';
import { LocationContextService } from '../core/services/location-context.service';
import { ROLE_LABELS } from '../core/models';

/** Operator / admin console shell: top bar, permission-aware sidebar, location context. */
@Component({
  selector: 'app-admin-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    IconComponent,
    DropdownComponent,
    ModalComponent,
    LogoComponent,
    SidebarNavComponent,
    NotificationBellComponent,
    ProfileMenuComponent,
    GlobalSearchComponent,
    LocationSelectorComponent,
    ThemeToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="shell admin-shell" [class.sidebar-collapsed]="collapsed()" [class.drawer-open]="drawerOpen()">
      <header class="topbar">
        <button type="button" class="btn btn-ghost btn-icon topbar-btn menu-toggle" (click)="toggleSidebar()" aria-label="Toggle navigation">
          <app-icon name="menu" [size]="20" />
        </button>
        <app-logo link="/admin/dashboard" />
        <app-location-selector class="hide-mobile" />
        <app-global-search class="topbar-search" [class.mobile-open]="mobileSearch()" />
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost btn-icon topbar-btn show-mobile-flex" (click)="mobileSearch.set(!mobileSearch())" aria-label="Search">
          <app-icon name="search" [size]="20" />
        </button>
        <app-theme-toggle />
        <app-dropdown width="260px">
          <button trigger type="button" class="btn btn-ghost btn-icon topbar-btn" aria-label="Help">
            <app-icon name="help" [size]="20" />
          </button>
          <div class="menu-label">Help</div>
          <button type="button" class="menu-item" (click)="helpOpen.set(true)"><app-icon name="info" [size]="16" /> Using the console</button>
          <button type="button" class="menu-item" (click)="shortcutsOpen.set(true)"><app-icon name="zap" [size]="16" /> Keyboard shortcuts</button>
          <a class="menu-item" routerLink="/admin/support"><app-icon name="support" [size]="16" /> Support tickets</a>
          <a class="menu-item" routerLink="/" target="_blank"><app-icon name="external" [size]="16" /> Open public website</a>
        </app-dropdown>
        <app-notification-bell viewAll="/admin/notifications" />
        <app-profile-menu />
      </header>

      <aside class="sidebar" aria-label="Console navigation">
        <div class="sidebar-head show-drawer">
          <app-logo link="/admin/dashboard" [inverse]="true" />
          <button type="button" class="btn btn-ghost btn-icon btn-sm sidebar-close" (click)="drawerOpen.set(false)" aria-label="Close navigation">
            <app-icon name="x" />
          </button>
        </div>
        <div class="sidebar-loc show-drawer">
          <app-location-selector />
        </div>
        <div class="sidebar-role">
          <span class="role-chip">{{ roleLabel() }}</span>
          @if (!collapsed()) {
            <span class="role-loc truncate">{{ ctx.label() }}</span>
          }
        </div>
        <app-sidebar-nav [items]="nav" [collapsed]="collapsed() && !drawerOpen()" label="Console navigation" (navigate)="drawerOpen.set(false)" (expandRequest)="collapsed.set(false)" />
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
    </div>

    <app-modal [open]="helpOpen()" title="Using the Officera console" (closed)="helpOpen.set(false)">
      <ul class="check-list">
        <li><app-icon name="check" [size]="16" /> Use the location selector in the top bar to switch every dashboard, list and report between centres.</li>
        <li><app-icon name="check" [size]="16" /> The sidebar only shows modules your role is allowed to use.</li>
        <li><app-icon name="check" [size]="16" /> Global search finds members, bookings, locations, resources, leads, tickets and invoices.</li>
        <li><app-icon name="check" [size]="16" /> All data is stored in the Officera database. Use Administration → Settings → Demo controls to simulate slow or failing requests.</li>
      </ul>
      <div footer><button type="button" class="btn btn-primary" (click)="helpOpen.set(false)">Got it</button></div>
    </app-modal>

    <app-modal [open]="shortcutsOpen()" title="Keyboard shortcuts" size="sm" (closed)="shortcutsOpen.set(false)">
      <dl class="kv">
        <dt><kbd class="kbd">/</kbd></dt>
        <dd>Focus global search</dd>
        <dt><kbd class="kbd">Esc</kbd></dt>
        <dd>Close menus, dialogs and drawers</dd>
        <dt><kbd class="kbd">Tab</kbd></dt>
        <dd>Move between controls</dd>
        <dt><kbd class="kbd">← →</kbd></dt>
        <dd>Switch tabs when a tab is focused</dd>
      </dl>
      <div footer><button type="button" class="btn btn-secondary" (click)="shortcutsOpen.set(false)">Close</button></div>
    </app-modal>
  `,
})
export class AdminLayoutComponent {
  private readonly auth = inject(AuthService);
  protected readonly ctx = inject(LocationContextService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly nav = ADMIN_NAV;
  protected readonly collapsed = signal(false);
  protected readonly drawerOpen = signal(false);
  protected readonly mobileSearch = signal(false);
  protected readonly helpOpen = signal(false);
  protected readonly shortcutsOpen = signal(false);
  protected readonly roleLabel = computed(() => (this.auth.role() ? ROLE_LABELS[this.auth.role()!] : ''));

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.drawerOpen.set(false);
        this.mobileSearch.set(false);
        if (this.isBrowser) document.getElementById('main')?.scrollTo?.({ top: 0 });
      });
  }

  protected toggleSidebar(): void {
    if (this.isBrowser && window.innerWidth < 1024) this.drawerOpen.update((o) => !o);
    else this.collapsed.update((c) => !c);
  }
}

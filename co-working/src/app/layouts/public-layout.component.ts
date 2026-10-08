import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LogoComponent, ThemeToggleComponent } from './shell/shell-parts.component';
import { IconComponent } from '../shared/components/icon/icon.component';
import { PUBLIC_NAV } from '../core/config/navigation';
import { AuthService } from '../core/services/auth.service';
import { HomepageContentService } from '../core/services/data/engagement-data.service';
import { LocationService } from '../core/services/data/workspace-data.service';
import { SettingsService } from '../core/services/settings.service';

/** Public marketing website shell. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent, IconComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    @if (content.content().showAnnouncement) {
      <div class="announce">
        <app-icon name="megaphone" [size]="14" /> {{ content.content().announcement }}
        <a routerLink="/blog">Read more</a>
      </div>
    }
    <header class="site-header" [class.open]="menuOpen()">
      <div class="site-container site-header-inner">
        <app-logo link="/" />
        <nav class="site-nav" aria-label="Main">
          @for (item of nav; track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active">{{ item.label }}</a>
          }
        </nav>
        <div class="site-actions">
          <app-theme-toggle />
          @if (auth.isAuthenticated()) {
            <a class="btn btn-secondary btn-sm" [routerLink]="auth.homeUrl()">Go to dashboard</a>
          } @else {
            <a class="btn btn-ghost btn-sm" routerLink="/login">Login</a>
          }
          <a class="btn btn-primary btn-sm" routerLink="/book-now">Book Now</a>
          <button type="button" class="btn btn-ghost btn-icon site-burger" (click)="menuOpen.set(!menuOpen())" [attr.aria-expanded]="menuOpen()" aria-label="Menu">
            <app-icon [name]="menuOpen() ? 'x' : 'menu'" [size]="22" />
          </button>
        </div>
      </div>
      @if (menuOpen()) {
        <nav class="site-mobile-nav" aria-label="Mobile">
          @for (item of nav; track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active">{{ item.label }}</a>
          }
          <div class="row-sm mt-3">
            <a class="btn btn-secondary flex-1" [routerLink]="auth.isAuthenticated() ? auth.homeUrl() : '/login'">{{ auth.isAuthenticated() ? 'Dashboard' : 'Login' }}</a>
            <a class="btn btn-primary flex-1" routerLink="/register">Get Started</a>
          </div>
        </nav>
      }
    </header>

    <main id="main" tabindex="-1" class="site-main">
      <router-outlet />
    </main>

    <footer class="site-footer">
      <div class="site-container footer-grid">
        <div class="stack-sm">
          <app-logo link="/" [inverse]="true" />
          <p class="text-sm">Smart Workspaces. Simple Management.</p>
          <p class="text-xs">Premium coworking across Hyderabad, Bangalore and Chennai.</p>
        </div>
        <div>
          <h4>Workspaces</h4>
          <a routerLink="/search" [queryParams]="{ type: 'HOT_DESK' }">Hot Desks</a>
          <a routerLink="/search" [queryParams]="{ type: 'DEDICATED_DESK' }">Dedicated Desks</a>
          <a routerLink="/search" [queryParams]="{ type: 'PRIVATE_OFFICE' }">Private Offices</a>
          <a routerLink="/search" [queryParams]="{ type: 'MEETING_ROOM' }">Meeting Rooms</a>
          <a routerLink="/search" [queryParams]="{ type: 'DAY_PASS' }">Day Pass</a>
        </div>
        <div>
          <h4>Locations</h4>
          @for (l of locations.active(); track l.id) {
            <a [routerLink]="['/locations', l.id]">{{ l.name.replace('Officera ', '') }}, {{ l.city }}</a>
          }
        </div>
        <div>
          <h4>Company</h4>
          <a routerLink="/about">About</a>
          <a routerLink="/events">Events</a>
          <a routerLink="/blog">Blog</a>
          <a routerLink="/gallery">Gallery</a>
          <a routerLink="/contact">Contact</a>
        </div>
        <div>
          <h4>Talk to us</h4>
          <a routerLink="/request-callback">Request a callback</a>
          <a routerLink="/schedule-tour">Schedule a tour</a>
          @if (org.settings().supplier.email) {
            <a [href]="'mailto:' + org.settings().supplier.email">{{ org.settings().supplier.email }}</a>
          }
          @if (org.settings().supplier.phone) {
            <a [href]="'tel:' + org.settings().supplier.phone.replace(' ', '')">{{ org.settings().supplier.phone }}</a>
          }
        </div>
      </div>
      <div class="site-container footer-bottom">
        <span>© {{ year }} Officera Workspaces Pvt Ltd</span>
        @if (org.settings().supplier.gstin) {
          <span>GSTIN {{ org.settings().supplier.gstin }}</span>
        }
      </div>
    </footer>
  `,
})
export class PublicLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly content = inject(HomepageContentService);
  protected readonly locations = inject(LocationService);
  /** Organisation contact and GST details from Settings (database). */
  protected readonly org = inject(SettingsService);
  protected readonly nav = PUBLIC_NAV;
  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.menuOpen.set(false);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
      });
  }
}

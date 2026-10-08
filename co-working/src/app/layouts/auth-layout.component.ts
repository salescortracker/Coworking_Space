import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LocationService } from '../core/services/data/workspace-data.service';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LogoComponent, ThemeToggleComponent } from './shell/shell-parts.component';
import { IconComponent } from '../shared/components/icon/icon.component';
import { WorkspaceImageComponent } from '../shared/components/visuals/visuals.component';

/** Split-screen layout for login, registration, OTP and password reset. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, LogoComponent, IconComponent, WorkspaceImageComponent, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-shell">
      <aside class="auth-aside" aria-hidden="true">
        <app-logo [inverse]="true" />
        <div class="auth-aside-body">
          <h2>Smart Workspaces. Simple Management.</h2>
          <p>Book desks and rooms, manage memberships, invite guests and pay GST-ready invoices from one place.</p>
          <ul class="auth-points">
            <li><app-icon name="check-circle" [size]="18" /> Real-time availability across {{ centres() === 1 ? 'our centre' : centres() + ' centres' }}</li>
            <li><app-icon name="check-circle" [size]="18" /> QR access for members and visitors</li>
            <li><app-icon name="check-circle" [size]="18" /> Automatic GST invoices and credits</li>
          </ul>
        </div>
        <app-workspace-image class="auth-art" [seed]="3" sizes="480px" />
      </aside>
      <main class="auth-main" id="main">
        <div class="auth-top">
          <a routerLink="/" class="btn btn-ghost btn-sm"><app-icon name="arrow-left" [size]="16" /> Back to website</a>
          <app-theme-toggle />
        </div>
        <div class="auth-card">
          <router-outlet />
        </div>
        <p class="auth-foot text-xs text-muted">© {{ year }} Officera Workspaces Pvt Ltd</p>
      </main>
    </div>
  `,
})
export class AuthLayoutComponent {
  protected readonly year = new Date().getFullYear();
  /** Number of active centres, from the API. */
  private readonly locations = inject(LocationService);
  protected readonly centres = computed(() => this.locations.active().length);
}

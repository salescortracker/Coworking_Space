import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../shared/components/states/states.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page" style="min-height: 70vh; display: flex; align-items: center; justify-content: center">
      <app-empty-state icon="map" title="Page not found" message="The page you’re looking for doesn’t exist or has moved.">
        <a routerLink="/" class="btn btn-secondary">Go to website</a>
        @if (auth.isAuthenticated()) {
          <a [routerLink]="auth.homeUrl()" class="btn btn-primary">Go to dashboard</a>
        }
      </app-empty-state>
    </div>
  `,
})
export class NotFoundComponent {
  protected readonly auth = inject(AuthService);
}

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="card">
        <app-empty-state icon="lock" title="You don’t have access to this page" message="Your role doesn’t include this module. Ask a Super Admin to update your permissions.">
          <a routerLink="/admin/dashboard" class="btn btn-primary">Back to dashboard</a>
        </app-empty-state>
      </div>
    </div>
  `,
})
export class ForbiddenComponent {}

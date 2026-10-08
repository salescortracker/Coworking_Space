import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** Skeleton placeholder shown while a page's data is loading. */
@Component({
  selector: 'app-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loading-state" role="status" aria-live="polite" [attr.aria-label]="label()">
      @switch (variant()) {
        @case ('cards') {
          <div class="grid grid-auto">
            @for (i of rowsArr(); track i) {
              <div class="card card-body stack-sm">
                <div class="skeleton" style="height: 120px"></div>
                <div class="skeleton" style="height: 14px; width: 70%"></div>
                <div class="skeleton" style="height: 12px; width: 45%"></div>
              </div>
            }
          </div>
        }
        @case ('stats') {
          <div class="stat-grid">
            @for (i of rowsArr(); track i) {
              <div class="card card-body stack-sm">
                <div class="skeleton" style="height: 12px; width: 50%"></div>
                <div class="skeleton" style="height: 26px; width: 65%"></div>
              </div>
            }
          </div>
        }
        @case ('detail') {
          <div class="stack">
            <div class="skeleton" style="height: 28px; width: 40%"></div>
            <div class="skeleton" style="height: 14px; width: 60%"></div>
            <div class="skeleton" style="height: 220px"></div>
          </div>
        }
        @default {
          <div class="stack-sm" style="padding: 16px">
            @for (i of rowsArr(); track i) {
              <div class="row">
                <div class="skeleton" style="height: 14px; width: 18%"></div>
                <div class="skeleton" style="height: 14px; flex: 1"></div>
                <div class="skeleton hide-mobile" style="height: 14px; width: 14%"></div>
                <div class="skeleton hide-mobile" style="height: 14px; width: 10%"></div>
              </div>
            }
          </div>
        }
      }
      <span class="sr-only">{{ label() }}</span>
    </div>
  `,
})
export class LoadingStateComponent {
  readonly variant = input<'table' | 'cards' | 'stats' | 'detail'>('table');
  readonly rows = input(6);
  readonly label = input('Loading…');
  protected rowsArr = () => Array.from({ length: this.rows() }, (_, i) => i);
}

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" [class.compact]="compact()">
      <div class="empty-icon"><app-icon [name]="icon()" [size]="compact() ? 22 : 28" /></div>
      <h3 class="empty-title">{{ title() }}</h3>
      @if (message()) {
        <p class="empty-msg">{{ message() }}</p>
      }
      <div class="empty-actions"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('Nothing here yet');
  readonly message = input('');
  readonly compact = input(false);
}

@Component({
  selector: 'app-error-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state error" role="alert">
      <div class="empty-icon"><app-icon name="alert" [size]="28" /></div>
      <h3 class="empty-title">{{ title() }}</h3>
      <p class="empty-msg">{{ message() }}</p>
      <div class="empty-actions">
        <button type="button" class="btn btn-secondary" (click)="retry.emit()">
          <app-icon name="refresh" [size]="16" /> Try again
        </button>
      </div>
    </div>
  `,
})
export class ErrorStateComponent {
  readonly title = input('We couldn’t load this page');
  readonly message = input('Something went wrong while fetching data. Please try again.');
  readonly retry = output<void>();
}

/** Inline success panel shown after a completed workflow. */
@Component({
  selector: 'app-success-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state success" role="status">
      <div class="empty-icon"><app-icon name="check-circle" [size]="32" /></div>
      <h3 class="empty-title">{{ title() }}</h3>
      @if (message()) {
        <p class="empty-msg">{{ message() }}</p>
      }
      <ng-content select="[details]" />
      <div class="empty-actions"><ng-content /></div>
    </div>
  `,
})
export class SuccessStateComponent {
  readonly title = input.required<string>();
  readonly message = input('');
}

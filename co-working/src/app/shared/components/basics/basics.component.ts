import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { statusLabel, statusTone } from '../../utils/status';
import { AVATAR_COLORS } from '../../../core/config/ui-constants';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge badge-{{ tone() }}">{{ text() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string | null | undefined>();
  readonly label = input<string>('');
  protected readonly tone = computed(() => statusTone(this.status()));
  protected readonly text = computed(() => this.label() || statusLabel(this.status()));
}

export interface Crumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol>
        @for (c of items(); track $index; let last = $last) {
          <li>
            @if (c.link && !last) {
              <a [routerLink]="c.link">{{ c.label }}</a>
            } @else {
              <span [attr.aria-current]="last ? 'page' : null">{{ c.label }}</span>
            }
            @if (!last) {
              <app-icon name="chevron-right" [size]="14" />
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbComponent {
  readonly items = input<Crumb[]>([]);
}

@Component({
  selector: 'app-page-header',
  imports: [BreadcrumbComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (breadcrumbs().length) {
      <app-breadcrumb [items]="breadcrumbs()" />
    }
    <header class="page-header">
      <div class="flex-1">
        <div class="row-sm row-wrap">
          <h1 class="page-title">{{ title() }}</h1>
          <ng-content select="[badge]" />
        </div>
        @if (subtitle()) {
          <p class="page-subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-actions"><ng-content /></div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly breadcrumbs = input<Crumb[]>([]);
}

@Component({
  selector: 'app-stat-card',
  imports: [IconComponent, RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #body>
      <div class="stat-top">
        <span class="stat-label">{{ label() }}</span>
        @if (icon()) {
          <span class="stat-icon tone-{{ tone() }}"><app-icon [name]="icon()" [size]="18" /></span>
        }
      </div>
      <div class="stat-value">{{ value() }}</div>
      @if (hint() || trend() !== null) {
        <div class="stat-foot">
          @if (trend() !== null) {
            <span class="trend" [class.up]="trend()! >= 0" [class.down]="trend()! < 0">
              <app-icon [name]="trend()! >= 0 ? 'trending-up' : 'trending-down'" [size]="14" />
              {{ trend()! >= 0 ? '+' : '' }}{{ trend() }}%
            </span>
          }
          <span class="text-muted">{{ hint() }}</span>
        </div>
      }
    </ng-template>
    @if (link()) {
      <a class="stat-card card interactive" [routerLink]="link()" [queryParams]="query()">
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else {
      <div class="stat-card card">
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input('');
  readonly tone = input<'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>('primary');
  readonly hint = input('');
  readonly trend = input<number | null>(null);
  readonly link = input<string | null>(null);
  readonly query = input<Record<string, string> | null>(null);
}

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="avatar"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.38"
      [style.background]="color()"
      [attr.title]="name()"
      role="img"
      [attr.aria-label]="name()"
      >{{ initials() }}</span
    >
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(32);
  protected readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join(''),
  );
  protected readonly color = computed(() => {
    let h = 0;
    for (const ch of this.name()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  });
}

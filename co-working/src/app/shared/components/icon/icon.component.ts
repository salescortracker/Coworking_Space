import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS } from './icons';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-icon', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      focusable="false"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 0; } svg { display: block; }`,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(18);
  readonly stroke = input(1.8);
  readonly label = input<string>('');
  protected readonly paths = computed(() => ICONS[this.name()] ?? ICONS['info']);
}

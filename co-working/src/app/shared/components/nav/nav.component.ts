import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: string;
  link?: string;
}

/** Accessible tab list. Works with a bound value (in-page tabs) or router links. */
@Component({
  selector: 'app-tabs',
  imports: [IconComponent, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()" (keydown)="onKey($event)">
      @for (t of tabs(); track t.id) {
        @if (t.link) {
          <a class="tab" [routerLink]="t.link" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" role="tab">
            @if (t.icon) {
              <app-icon [name]="t.icon" [size]="16" />
            }
            {{ t.label }}
            @if (t.count !== undefined) {
              <span class="count">{{ t.count }}</span>
            }
          </a>
        } @else {
          <button
            type="button"
            class="tab"
            role="tab"
            [class.active]="value() === t.id"
            [attr.aria-selected]="value() === t.id"
            [attr.tabindex]="value() === t.id ? 0 : -1"
            (click)="value.set(t.id)"
          >
            @if (t.icon) {
              <app-icon [name]="t.icon" [size]="16" />
            }
            {{ t.label }}
            @if (t.count !== undefined) {
              <span class="count">{{ t.count }}</span>
            }
          </button>
        }
      }
    </div>
  `,
})
export class TabsComponent {
  readonly tabs = input.required<TabItem[]>();
  readonly value = model<string>('');
  readonly label = input('Sections');

  protected onKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const list = this.tabs().filter((t) => !t.link);
    const idx = list.findIndex((t) => t.id === this.value());
    if (idx < 0) return;
    const next = list[(idx + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
    this.value.set(next.id);
    queueMicrotask(() => ((e.currentTarget as HTMLElement)?.querySelector('.tab.active') as HTMLElement | null)?.focus());
  }
}

/** Click-to-open dropdown with outside-click and Escape handling. */
@Component({
  selector: 'app-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dropdown',
    '(document:click)': 'onDoc($event)',
    '(document:keydown.escape)': 'close()',
  },
  template: `
    <div class="dropdown-trigger" (click)="toggle()"><ng-content select="[trigger]" /></div>
    @if (open()) {
      <div class="menu" [class.menu-right]="align() === 'right'" [style.min-width]="width()" role="menu" (click)="autoClose() && close()">
        <ng-content />
      </div>
    }
  `,
})
export class DropdownComponent {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly align = input<'left' | 'right'>('right');
  readonly width = input('220px');
  readonly autoClose = input(true);
  readonly opened = output<boolean>();
  readonly open = signal(false);

  toggle(): void {
    this.open.update((o) => !o);
    this.opened.emit(this.open());
  }

  close(): void {
    if (this.open()) {
      this.open.set(false);
      this.opened.emit(false);
    }
  }

  protected onDoc(e: MouseEvent): void {
    if (this.open() && !this.el.nativeElement.contains(e.target as Node)) this.close();
  }
}

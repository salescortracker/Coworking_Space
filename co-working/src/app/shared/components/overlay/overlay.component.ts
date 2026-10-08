import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { ConfirmService, ToastService } from '../../../core/services/ui.service';

let uid = 0;

function lockScroll(lock: boolean): void {
  if (typeof document === 'undefined') return;
  const count = Number(document.body.dataset['lock'] ?? 0) + (lock ? 1 : -1);
  document.body.dataset['lock'] = String(Math.max(count, 0));
  document.body.style.overflow = count > 0 ? 'hidden' : '';
}

function focusFirst(host: HTMLElement): void {
  const el = host.querySelector<HTMLElement>('[autofocus], input:not([type=hidden]), select, textarea, button:not(.overlay-close)');
  (el ?? host.querySelector<HTMLElement>('.overlay-panel'))?.focus();
}

/** Generic modal dialog used for forms and details. Fits small screens as a bottom sheet. */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEsc()' },
  template: `
    @if (open()) {
      <div class="overlay-backdrop" (click)="dismissible() && closed.emit()"></div>
      <div
        class="overlay-panel modal modal-{{ size() }}"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="id + '-title'"
        tabindex="-1"
      >
        <div class="modal-header">
          <div>
            <h2 class="modal-title" [id]="id + '-title'">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="modal-subtitle">{{ subtitle() }}</p>
            }
          </div>
          <button type="button" class="btn btn-ghost btn-icon btn-sm overlay-close" (click)="closed.emit()" aria-label="Close dialog">
            <app-icon name="x" />
          </button>
        </div>
        <div class="modal-body"><ng-content /></div>
        <div class="modal-footer"><ng-content select="[footer]" /></div>
      </div>
    }
  `,
})
export class ModalComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly dismissible = input(true);
  readonly closed = output<void>();
  protected readonly id = `modal-${++uid}`;
  private wasOpen = false;

  constructor() {
    afterRenderEffect(() => {
      const o = this.open();
      untracked(() => {
        if (o && !this.wasOpen) {
          lockScroll(true);
          focusFirst(this.host.nativeElement);
        } else if (!o && this.wasOpen) lockScroll(false);
        this.wasOpen = o;
      });
    });
  }

  protected onEsc(): void {
    if (this.open() && this.dismissible()) this.closed.emit();
  }

  ngOnDestroy(): void {
    if (this.wasOpen) lockScroll(false);
  }
}

/** Slide-in side panel for details and quick edits. */
@Component({
  selector: 'app-drawer',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="overlay-backdrop" (click)="closed.emit()"></div>
      <aside class="overlay-panel drawer" [style.--drawer-w]="width()" role="dialog" aria-modal="true" [attr.aria-label]="title()" tabindex="-1">
        <div class="modal-header">
          <div>
            <h2 class="modal-title">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="modal-subtitle">{{ subtitle() }}</p>
            }
          </div>
          <button type="button" class="btn btn-ghost btn-icon btn-sm overlay-close" (click)="closed.emit()" aria-label="Close panel">
            <app-icon name="x" />
          </button>
        </div>
        <div class="drawer-body"><ng-content /></div>
        <div class="modal-footer"><ng-content select="[footer]" /></div>
      </aside>
    }
  `,
})
export class DrawerComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly width = input('480px');
  readonly closed = output<void>();
  private wasOpen = false;

  constructor() {
    afterRenderEffect(() => {
      const o = this.open();
      untracked(() => {
        if (o && !this.wasOpen) {
          lockScroll(true);
          this.host.nativeElement.querySelector<HTMLElement>('.overlay-panel')?.focus();
        } else if (!o && this.wasOpen) lockScroll(false);
        this.wasOpen = o;
      });
    });
  }

  ngOnDestroy(): void {
    if (this.wasOpen) lockScroll(false);
  }
}

/** Renders the single active confirmation dialog from ConfirmService. */
@Component({
  selector: 'app-confirm-host',
  imports: [ModalComponent, IconComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.current(); as req) {
      <app-modal [open]="true" [title]="req.title" size="sm" (closed)="answer(false)">
        <div class="confirm-body">
          <span class="confirm-icon tone-{{ req.tone ?? 'primary' }}">
            <app-icon [name]="req.tone === 'danger' ? 'alert' : req.tone === 'warning' ? 'alert' : 'help'" [size]="22" />
          </span>
          <div class="flex-1">
            <p class="mb-0">{{ req.message }}</p>
            @if (req.input; as inp) {
              <div class="field mt-4">
                <label class="label" for="confirm-input">{{ inp.label }} @if (inp.required) {<span class="req">*</span>}</label>
                <textarea id="confirm-input" class="textarea" rows="3" [placeholder]="inp.placeholder ?? ''" [(ngModel)]="value"></textarea>
              </div>
            }
          </div>
        </div>
        <div footer class="btn-group">
          <button type="button" class="btn btn-secondary" (click)="answer(false)">{{ req.cancelText ?? 'Cancel' }}</button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="req.tone === 'danger'"
            [class.btn-primary]="req.tone !== 'danger'"
            [disabled]="!!req.input?.required && !value().trim()"
            (click)="answer(true)"
          >
            {{ req.confirmText ?? 'Confirm' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class ConfirmHostComponent {
  protected readonly svc = inject(ConfirmService);
  protected readonly value = signal('');

  protected answer(confirmed: boolean): void {
    const req = this.svc.current();
    const v = this.value();
    this.value.set('');
    req?.resolve({ confirmed, value: v });
  }
}

@Component({
  selector: 'app-toast-host',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (t of svc.toasts(); track t.id) {
        <div class="toast toast-{{ t.type }}" role="status">
          <app-icon [name]="icons[t.type]" [size]="18" />
          <div class="flex-1">
            <div class="toast-title">{{ t.title }}</div>
            @if (t.message) {
              <div class="toast-msg">{{ t.message }}</div>
            }
          </div>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="svc.dismiss(t.id)" aria-label="Dismiss notification">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly svc = inject(ToastService);
  protected readonly icons = { success: 'check-circle', error: 'x-circle', warning: 'alert', info: 'info' } as const;
}

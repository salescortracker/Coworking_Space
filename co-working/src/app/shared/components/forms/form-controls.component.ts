import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { errorMessage } from '../../utils/validators';
import { Attachment } from '../../../core/models';
import { IntegrationService } from '../../../core/services/integration.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/ui.service';

/**
 * Displays the first validation error for a control once it is touched.
 * Uses default change detection so it reacts to blur / submit in zoneless mode.
 */
@Component({
  selector: 'app-field-error',
  imports: [IconComponent],
  template: `
    @if (visible()) {
      <span class="field-error" role="alert" [id]="id()"><app-icon name="alert" [size]="12" />{{ message() }}</span>
    }
  `,
})
export class FieldErrorComponent {
  readonly control = input.required<AbstractControl | null | undefined>();
  readonly label = input('This field');
  readonly id = input<string | null>(null);
  /** Also show group-level errors (e.g. password mismatch) by key. */
  readonly groupErrors = input<Record<string, unknown> | null>(null);

  visible(): boolean {
    const c = this.control();
    if (!c || !(c.touched || c.dirty)) return false;
    return !!c.errors || !!this.groupErrors();
  }

  message(): string {
    const c = this.control();
    return errorMessage(c?.errors ?? (this.groupErrors() as never), this.label());
  }
}

/** Six-box one-time-password input. Works with reactive forms. */
@Component({
  selector: 'app-otp-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OtpInputComponent), multi: true }],
  template: `
    <div class="otp" role="group" [attr.aria-label]="label()">
      @for (i of slots; track i) {
        <input
          #box
          class="input otp-box"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="1"
          [attr.aria-label]="'Digit ' + (i + 1)"
          [value]="digits()[i] ?? ''"
          [disabled]="disabled()"
          [class.filled]="!!digits()[i]"
          [class.invalid]="invalid()"
          (input)="onInput(i, $event)"
          (keydown)="onKey(i, $event)"
          (paste)="onPaste($event)"
          (blur)="onTouched()"
        />
      }
    </div>
  `,
})
export class OtpInputComponent implements ControlValueAccessor {
  readonly length = input(6);
  readonly label = input('One-time password');
  readonly invalid = input(false);
  readonly completed = output<string>();
  protected readonly slots = [0, 1, 2, 3, 4, 5];
  protected readonly digits = signal<string[]>([]);
  protected readonly disabled = signal(false);
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.digits.set((v ?? '').split('').slice(0, 6));
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  protected onInput(i: number, e: Event): void {
    const el = e.target as HTMLInputElement;
    const ch = el.value.replace(/\D/g, '').slice(-1);
    el.value = ch;
    const next = [...this.digits()];
    next[i] = ch;
    this.update(next);
    if (ch && i < 5) this.boxes()[i + 1]?.nativeElement.focus();
  }

  protected onKey(i: number, e: KeyboardEvent): void {
    if (e.key === 'Backspace' && !this.digits()[i] && i > 0) this.boxes()[i - 1]?.nativeElement.focus();
    if (e.key === 'ArrowLeft' && i > 0) this.boxes()[i - 1]?.nativeElement.focus();
    if (e.key === 'ArrowRight' && i < 5) this.boxes()[i + 1]?.nativeElement.focus();
  }

  protected onPaste(e: ClipboardEvent): void {
    const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    this.update(text.split(''));
    this.boxes()[Math.min(text.length, 5)]?.nativeElement.focus();
  }

  private update(next: string[]): void {
    this.digits.set(next);
    const v = next.join('');
    this.onChange(v);
    if (v.length === 6 && !next.includes('')) this.completed.emit(v);
  }
}

/**
 * File upload: each picked file is sent to POST /api/File/Upload (validated and stored under wwwroot/uploads on
 * the server) and the emitted attachments carry the stored file URL.
 */
@Component({
  selector: 'app-file-upload',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dropzone"
      [class.dragging]="dragging()"
      (dragover)="$event.preventDefault(); dragging.set(true)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      <app-icon name="upload" [size]="22" />
      <div>
        <label class="btn-link fw-500" [for]="inputId">Choose files</label>
        <span class="text-muted"> or drag and drop</span>
      </div>
      <div class="field-hint">{{ hint() }}</div>
      <div class="field-hint">{{ storage() ? 'Stored securely in ' + storage() : 'Stored securely on the Officera server' }}</div>
      <input [id]="inputId" type="file" class="sr-only" [accept]="accept()" [multiple]="multiple()" (change)="onPick($event)" />
    </div>
    @if (files().length) {
      <ul class="file-list">
        @for (f of files(); track f.id) {
          <li>
            <app-icon [name]="f.type.startsWith('image') ? 'image' : 'file-text'" [size]="16" />
            <span class="flex-1 truncate">{{ f.name }}</span>
            <span class="text-muted text-xs">{{ size(f.size) }}</span>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="remove(f.id)" [attr.aria-label]="'Remove ' + f.name">
              <app-icon name="x" [size]="14" />
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class FileUploadComponent {
  private static seq = 0;
  protected readonly inputId = `file-${++FileUploadComponent.seq}`;
  readonly accept = input('image/*,.pdf');
  readonly multiple = input(true);
  readonly hint = input('PNG, JPG or PDF up to 5 MB');
  /** Server folder: images | documents | profiles | attachments (defaults from accept). */
  readonly category = input<'images' | 'documents' | 'profiles' | 'attachments' | ''>('');
  readonly filesChange = output<Attachment[]>();
  protected readonly files = signal<Attachment[]>([]);
  protected readonly dragging = signal(false);
  private readonly integrations = inject(IntegrationService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  /** Active Cloud storage provider from Configuration / Integrations. */
  protected readonly storage = computed(() => (this.integrations.isAvailable('STORAGE') ? this.integrations.activeLabel('STORAGE') : null));

  protected onPick(e: Event): void {
    const list = (e.target as HTMLInputElement).files;
    if (list) this.add(Array.from(list));
    (e.target as HTMLInputElement).value = '';
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    if (e.dataTransfer?.files) this.add(Array.from(e.dataTransfer.files));
  }

  private add(list: File[]): void {
    const picked = this.multiple() ? list : list.slice(0, 1);
    if (!picked.length) return;
    const accept = this.accept();
    const category = this.category() || (accept.includes('pdf') ? 'attachments' : accept.startsWith('image') ? 'images' : 'attachments');
    this.api.upload(picked, category).subscribe({
      next: (uploaded) => {
        const next = this.multiple() ? [...this.files(), ...uploaded] : uploaded.slice(0, 1);
        this.files.set(next);
        this.filesChange.emit(next);
      },
      error: (e: { message: string }) => this.toast.error('Upload failed', e.message),
    });
  }

  protected remove(id: string): void {
    const next = this.files().filter((f) => f.id !== id);
    this.files.set(next);
    this.filesChange.emit(next);
  }

  protected size(bytes: number): string {
    return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
  }

  reset(): void {
    this.files.set([]);
  }
}

/** Time slot picker: renders a grid of selectable times (used as Time Picker). */
@Component({
  selector: 'app-time-slots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slot-grid" role="radiogroup" [attr.aria-label]="label()">
      @for (s of slots(); track s.time) {
        <button
          type="button"
          role="radio"
          class="slot"
          [class.selected]="value() === s.time"
          [disabled]="!s.available"
          [attr.aria-checked]="value() === s.time"
          (click)="pick.emit(s.time)"
        >
          {{ fmt(s.time) }}
        </button>
      }
    </div>
  `,
})
export class TimeSlotsComponent {
  readonly slots = input.required<{ time: string; available: boolean }[]>();
  readonly value = input<string | null | undefined>(null);
  readonly label = input('Available time slots');
  readonly pick = output<string>();
  protected fmt(t: string): string {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }
}

/** Horizontal date strip used by booking and visitor flows (Date Picker). */
@Component({
  selector: 'app-date-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="date-strip" role="radiogroup" aria-label="Choose a date">
      @for (d of days(); track d.iso) {
        <button
          type="button"
          role="radio"
          class="date-chip"
          [class.selected]="value() === d.iso"
          [disabled]="d.closed"
          [attr.aria-checked]="value() === d.iso"
          [attr.aria-label]="d.full"
          (click)="pick.emit(d.iso)"
        >
          <span class="dow">{{ d.dow }}</span>
          <span class="dom">{{ d.dom }}</span>
          <span class="mon">{{ d.mon }}</span>
        </button>
      }
    </div>
  `,
})
export class DateStripComponent {
  readonly count = input(14);
  readonly value = input<string | null | undefined>(null);
  readonly closedDays = input<number[]>([]);
  readonly pick = output<string>();
  protected readonly days = computed(() =>
    Array.from({ length: this.count() }, (_, i) => {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        iso,
        dow: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
        dom: d.getDate(),
        mon: d.toLocaleDateString('en-IN', { month: 'short' }),
        full: d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
        closed: this.closedDays().includes(d.getDay()),
      };
    }),
  );
}

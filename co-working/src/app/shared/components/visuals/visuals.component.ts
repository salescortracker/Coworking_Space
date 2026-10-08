import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { TimelineEntry } from '../../../core/models';
import { photoSrcset, photoUrl, workspacePhoto } from '../../../core/config/workspace-photos';
import { RelativeTimePipe } from '../../pipes/format.pipes';
import { ApiService } from '../../../core/services/api.service';

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Visual mock QR code: deterministic module pattern derived from the payload,
 * with finder patterns so it reads as a QR. It is not scannable by design.
 */
@Component({
  selector: 'app-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 29 29" shape-rendering="crispEdges" role="img" [attr.aria-label]="'QR code for ' + value()" [class.dimmed]="dimmed()">
      <rect width="29" height="29" fill="#fff" />
      @for (m of modules(); track $index) {
        <rect [attr.x]="m[0]" [attr.y]="m[1]" width="1" height="1" fill="#111827" />
      }
      @for (f of finders; track $index) {
        <rect [attr.x]="f[0]" [attr.y]="f[1]" width="7" height="7" fill="#111827" />
        <rect [attr.x]="f[0] + 1" [attr.y]="f[1] + 1" width="5" height="5" fill="#fff" />
        <rect [attr.x]="f[0] + 2" [attr.y]="f[1] + 2" width="3" height="3" fill="#111827" />
      }
    </svg>
  `,
  styles: `svg { display: block; border-radius: 4px; } svg.dimmed { opacity: 0.25; filter: grayscale(1); }`,
})
export class QrCodeComponent {
  readonly value = input.required<string>();
  readonly size = input(160);
  readonly dimmed = input(false);
  protected readonly finders = [
    [1, 1],
    [21, 1],
    [1, 21],
  ];
  protected readonly modules = computed(() => {
    let seed = hash(this.value());
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    const out: [number, number][] = [];
    const inFinder = (x: number, y: number) => (x < 9 && y < 9) || (x > 19 && y < 9) || (x < 9 && y > 19);
    for (let y = 1; y < 28; y++) {
      for (let x = 1; x < 28; x++) {
        if (inFinder(x, y)) continue;
        if (y === 7 && x > 8 && x < 20) {
          if (x % 2 === 0) out.push([x, y]);
          continue;
        }
        if (rnd() > 0.52) out.push([x, y]);
      }
    }
    return out;
  });
}

/** QR card used for member access and visitor passes. */
@Component({
  selector: 'app-qr-card',
  imports: [QrCodeComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qr-card" [class.inactive]="!active()">
      <div class="qr-card-head">
        <span class="row-sm"><app-icon name="logo" [size]="16" /> OFFICERA</span>
        <span class="text-xs">{{ caption() }}</span>
      </div>
      <div class="qr-card-body">
        <app-qr-code [value]="value()" [size]="size()" [dimmed]="!active()" />
        @if (!active()) {
          <div class="qr-overlay"><app-icon name="lock" [size]="20" /> {{ inactiveText() }}</div>
        }
      </div>
      <div class="qr-card-foot">
        <div class="fw-600">{{ title() }}</div>
        <div class="text-sm text-muted">{{ subtitle() }}</div>
        <code class="qr-code-text">{{ value() }}</code>
      </div>
    </div>
  `,
})
export class QrCardComponent {
  readonly value = input.required<string>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly caption = input('Access pass');
  readonly active = input(true);
  readonly inactiveText = input('Access disabled');
  readonly size = input(168);
}

const SCENES = [
  { wall: '#e9edf6', floor: '#c9cfdc', accent: '#3140b0', wood: '#b88a5a' },
  { wall: '#eef3ef', floor: '#cbd5cc', accent: '#1aa39a', wood: '#a57a4f' },
  { wall: '#f4efe8', floor: '#d8cfc2', accent: '#c4661f', wood: '#8b6542' },
  { wall: '#ecebf5', floor: '#cfcbe0', accent: '#7a4fc4', wood: '#9c7b58' },
  { wall: '#eef1f4', floor: '#cdd3da', accent: '#4b6584', wood: '#b38b62' },
];

/**
 * Workspace photo for a location, resource, event, blog post or gallery item.
 * The seed comes from the mock data and is resolved to a real photograph by the central
 * catalogue (core/config/workspace-photos.ts). The image fills its box (object-fit: cover), so
 * existing sizes and aspect ratios are kept; it is responsive (srcset), lazy-loaded unless
 * `priority` is set, and falls back to a generated illustration if the photo cannot load.
 */
@Component({
  selector: 'app-workspace-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ws-img' },
  template: `
    @if (!failed()) {
      <img
        class="ws-photo"
        [src]="src()"
        [attr.srcset]="srcset() || null"
        [sizes]="sizes()"
        [alt]="altText()"
        width="1200"
        height="800"
        [attr.loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : null"
        decoding="async"
        (error)="failed.set(true)"
      />
    } @else {
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" role="img" [attr.aria-label]="altText()">
      <rect width="320" height="200" [attr.fill]="s().wall" />
      <rect y="138" width="320" height="62" [attr.fill]="s().floor" />
      <!-- windows -->
      @for (w of windows(); track $index) {
        <rect [attr.x]="w" y="22" width="54" height="78" rx="2" fill="#fff" opacity="0.85" />
        <rect [attr.x]="w + 26" y="22" width="2" height="78" [attr.fill]="s().floor" />
        <rect [attr.x]="w" y="58" width="54" height="2" [attr.fill]="s().floor" />
      }
      <!-- plant -->
      <rect [attr.x]="plantX()" y="112" width="18" height="26" rx="2" [attr.fill]="s().wood" />
      <ellipse [attr.cx]="plantX() + 9" cy="102" rx="16" ry="18" fill="#3f7d58" opacity="0.9" />
      <!-- desks -->
      @for (d of desks(); track $index) {
        <rect [attr.x]="d" y="120" width="70" height="6" rx="1" [attr.fill]="s().wood" />
        <rect [attr.x]="d + 6" y="126" width="3" height="26" fill="#4a4f5c" />
        <rect [attr.x]="d + 61" y="126" width="3" height="26" fill="#4a4f5c" />
        <rect [attr.x]="d + 22" y="96" width="28" height="20" rx="2" fill="#2b3040" />
        <rect [attr.x]="d + 34" y="116" width="4" height="4" fill="#2b3040" />
        <rect [attr.x]="d + 18" y="132" width="26" height="22" rx="5" [attr.fill]="s().accent" opacity="0.85" />
      }
      <!-- pendant lights -->
      @for (l of lights(); track $index) {
        <line [attr.x1]="l" y1="0" [attr.x2]="l" y2="14" stroke="#4a4f5c" stroke-width="1" />
        <path [attr.d]="'M' + (l - 9) + ' 22 L' + (l + 9) + ' 22 L' + (l + 5) + ' 14 L' + (l - 5) + ' 14 Z'" fill="#2b3040" />
      }
    </svg>
    }
  `,
})
export class WorkspaceImageComponent {
  /** Photo catalogue seed, or the URL of an image uploaded through the API. */
  readonly seed = input<number | string>(1);
  /** Overrides the catalogue's alt text when the context is more specific (e.g. a location name). */
  readonly alt = input('');
  /** Optional place name prefixed to the catalogue alt text, e.g. "Officera HITEC City – Meeting room…". */
  readonly place = input('');
  /** Load immediately (above-the-fold hero); everything else is lazy-loaded. */
  readonly priority = input(false);
  /** Rendered width hint for picking the right srcset candidate. */
  readonly sizes = input('(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 600px');
  protected readonly failed = signal(false);
  private readonly api = inject(ApiService);
  private readonly uploaded = computed(() => (typeof this.seed() === 'string' && /^(\/|https?:)/.test(String(this.seed())) ? String(this.seed()) : null));
  /** Numeric seed (uploaded images use a stable hash, only for the fallback illustration). */
  private readonly num = computed(() => {
    const s = this.seed();
    if (typeof s === 'number') return s;
    const n = Number(s);
    if (!Number.isNaN(n)) return n;
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 1000;
  });
  protected readonly photo = computed(() => workspacePhoto(this.num()));
  protected readonly altText = computed(() => this.alt() || (this.place() ? `${this.place()} – ${this.photo().alt}` : this.photo().alt));
  protected readonly src = computed(() => (this.uploaded() ? this.api.fileUrl(this.uploaded()) : photoUrl(this.photo(), 800)));
  protected readonly srcset = computed(() => (this.uploaded() ? '' : photoSrcset(this.photo())));

  constructor() {
    // A new seed (e.g. list re-ordered, photo removed) gets a fresh attempt at loading.
    effect(() => {
      this.seed();
      this.failed.set(false);
    });
  }
  protected readonly s = computed(() => SCENES[Math.abs(this.num()) % SCENES.length]);
  protected readonly windows = computed(() => {
    const n = 2 + (this.num() % 3);
    return Array.from({ length: n }, (_, i) => 20 + i * (280 / n));
  });
  protected readonly desks = computed(() => (this.num() % 2 ? [40, 190] : [24, 120, 216]));
  protected readonly plantX = computed(() => (this.num() % 2 ? 140 : 292));
  protected readonly lights = computed(() => (this.num() % 3 === 0 ? [80, 160, 240] : [100, 220]));
}

/** Vertical timeline for activity history (tickets, leads, bookings). */
@Component({
  selector: 'app-timeline',
  imports: [IconComponent, DatePipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length === 0) {
      <p class="text-muted text-sm">No activity yet.</p>
    }
    <ol class="timeline">
      @for (e of items(); track e.id) {
        <li>
          <span class="tl-dot tone-{{ e.tone ?? 'neutral' }}"><app-icon [name]="e.icon ?? 'activity'" [size]="13" /></span>
          <div class="tl-body">
            <div class="row-between row-start">
              <span class="fw-500">{{ e.title }}</span>
              <time class="text-xs text-muted nowrap" [attr.datetime]="e.at" [attr.title]="e.at | date: 'd MMM y, h:mm a'">{{ e.at | ago }}</time>
            </div>
            @if (e.description) {
              <div class="text-sm text-secondary">{{ e.description }}</div>
            }
            @if (e.actor) {
              <div class="text-xs text-muted">by {{ e.actor }}</div>
            }
          </div>
        </li>
      }
    </ol>
  `,
})
export class TimelineComponent {
  readonly items = input.required<TimelineEntry[]>();
}

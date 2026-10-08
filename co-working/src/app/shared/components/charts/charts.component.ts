import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  DestroyRef,
} from '@angular/core';

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * exp;
}

function shortNum(v: number, prefix = ''): string {
  const a = Math.abs(v);
  if (a >= 1e7) return `${prefix}${(v / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${prefix}${(v / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${prefix}${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${prefix}${Math.round(v * 10) / 10}`;
}

/** Tracks the rendered width of the host so charts redraw crisply at any size. */
abstract class ResponsiveChart {
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly width = signal(560);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      this.width.set(Math.max(240, el.clientWidth || 560));
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver((entries) => {
        const w = Math.round(entries[0].contentRect.width);
        if (w > 0 && Math.abs(w - this.width()) > 2) this.width.set(Math.max(240, w));
      });
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }
}

@Component({
  selector: 'app-chart-legend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="chart-legend">
      @for (item of items(); track item.name; let i = $index) {
        <li><span class="dot" [style.background]="item.color || palette[i % palette.length]"></span>{{ item.name }}</li>
      }
    </ul>
  `,
})
export class ChartLegendComponent {
  readonly items = input.required<{ name: string; color?: string }[]>();
  protected readonly palette = PALETTE;
}

/** Vertical bar chart. Multiple series render grouped (or stacked). */
@Component({
  selector: 'app-bar-chart',
  imports: [ChartLegendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'chart-host' },
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" role="img" [attr.aria-label]="ariaLabel()" class="chart-svg">
      @for (t of ticks(); track t.v) {
        <line class="grid-line" [attr.x1]="pad.l" [attr.x2]="width() - pad.r" [attr.y1]="t.y" [attr.y2]="t.y" />
        <text class="axis-label" [attr.x]="pad.l - 8" [attr.y]="t.y + 4" text-anchor="end">{{ t.label }}</text>
      }
      @for (b of bars(); track $index) {
        <rect class="bar" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" [attr.fill]="b.color" rx="2">
          <title>{{ b.title }}</title>
        </rect>
      }
      @for (l of xLabels(); track $index) {
        <text class="axis-label" [attr.x]="l.x" [attr.y]="height() - 8" text-anchor="middle">{{ l.text }}</text>
      }
    </svg>
    @if (series().length > 1) {
      <app-chart-legend [items]="series()" />
    }
  `,
})
export class BarChartComponent extends ResponsiveChart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();
  readonly height = input(240);
  readonly stacked = input(false);
  readonly prefix = input('');
  readonly suffix = input('');
  readonly ariaLabel = input('Bar chart');
  protected readonly pad = { l: 48, r: 12, t: 12, b: 28 };

  private readonly max = computed(() => {
    const s = this.series();
    const vals = this.stacked()
      ? this.labels().map((_, i) => s.reduce((sum, x) => sum + (x.data[i] ?? 0), 0))
      : s.flatMap((x) => x.data);
    return niceMax(Math.max(0, ...vals));
  });

  protected readonly ticks = computed(() => {
    const max = this.max();
    const h = this.height() - this.pad.t - this.pad.b;
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: f, y: this.pad.t + h - f * h, label: shortNum(max * f, this.prefix()) + (f ? this.suffix() : '') }));
  });

  protected readonly bars = computed(() => {
    const labels = this.labels();
    const s = this.series();
    const innerW = this.width() - this.pad.l - this.pad.r;
    const innerH = this.height() - this.pad.t - this.pad.b;
    const band = innerW / Math.max(1, labels.length);
    const groupW = band * 0.68;
    const max = this.max();
    const out: { x: number; y: number; w: number; h: number; color: string; title: string }[] = [];
    labels.forEach((label, i) => {
      const x0 = this.pad.l + i * band + (band - groupW) / 2;
      let stackY = this.pad.t + innerH;
      s.forEach((ser, si) => {
        const v = ser.data[i] ?? 0;
        const h = (v / max) * innerH;
        const color = ser.color ?? PALETTE[si % PALETTE.length];
        const title = `${label} · ${ser.name}: ${this.prefix()}${v.toLocaleString('en-IN')}${this.suffix()}`;
        if (this.stacked()) {
          stackY -= h;
          out.push({ x: x0, y: stackY, w: groupW, h: Math.max(h, 0), color, title });
        } else {
          const w = groupW / s.length;
          out.push({ x: x0 + si * w + (s.length > 1 ? 1 : 0), y: this.pad.t + innerH - h, w: Math.max(2, w - (s.length > 1 ? 2 : 0)), h: Math.max(h, 0), color, title });
        }
      });
    });
    return out;
  });

  protected readonly xLabels = computed(() => {
    const labels = this.labels();
    const innerW = this.width() - this.pad.l - this.pad.r;
    const band = innerW / Math.max(1, labels.length);
    const every = Math.ceil(labels.length / Math.max(1, Math.floor(innerW / 56)));
    return labels.map((text, i) => ({ text: i % every === 0 ? text : '', x: this.pad.l + i * band + band / 2 }));
  });
}

/** Line / area chart for trends. */
@Component({
  selector: 'app-line-chart',
  imports: [ChartLegendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'chart-host' },
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" role="img" [attr.aria-label]="ariaLabel()" class="chart-svg">
      @for (t of ticks(); track t.v) {
        <line class="grid-line" [attr.x1]="pad.l" [attr.x2]="width() - pad.r" [attr.y1]="t.y" [attr.y2]="t.y" />
        <text class="axis-label" [attr.x]="pad.l - 8" [attr.y]="t.y + 4" text-anchor="end">{{ t.label }}</text>
      }
      @for (p of paths(); track p.name) {
        @if (area()) {
          <path [attr.d]="p.area" [attr.fill]="p.color" opacity="0.08" />
        }
        <path [attr.d]="p.line" fill="none" [attr.stroke]="p.color" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" />
        @for (pt of p.points; track $index) {
          <circle class="pt" [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5" [attr.fill]="p.color">
            <title>{{ pt.title }}</title>
          </circle>
        }
      }
      @for (l of xLabels(); track $index) {
        <text class="axis-label" [attr.x]="l.x" [attr.y]="height() - 8" text-anchor="middle">{{ l.text }}</text>
      }
    </svg>
    @if (series().length > 1) {
      <app-chart-legend [items]="series()" />
    }
  `,
})
export class LineChartComponent extends ResponsiveChart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();
  readonly height = input(240);
  readonly area = input(true);
  readonly prefix = input('');
  readonly suffix = input('');
  readonly maxValue = input<number | null>(null);
  readonly ariaLabel = input('Line chart');
  protected readonly pad = { l: 48, r: 16, t: 12, b: 28 };

  private readonly max = computed(() => this.maxValue() ?? niceMax(Math.max(0, ...this.series().flatMap((s) => s.data))));

  protected readonly ticks = computed(() => {
    const max = this.max();
    const h = this.height() - this.pad.t - this.pad.b;
    return [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: f, y: this.pad.t + h - f * h, label: shortNum(max * f, this.prefix()) + (f ? this.suffix() : '') }));
  });

  protected readonly paths = computed(() => {
    const labels = this.labels();
    const innerW = this.width() - this.pad.l - this.pad.r;
    const innerH = this.height() - this.pad.t - this.pad.b;
    const step = innerW / Math.max(1, labels.length - 1);
    const max = this.max();
    return this.series().map((s, si) => {
      const color = s.color ?? PALETTE[si % PALETTE.length];
      const points = s.data.map((v, i) => ({
        x: this.pad.l + i * step,
        y: this.pad.t + innerH - (v / max) * innerH,
        title: `${labels[i]} · ${s.name}: ${this.prefix()}${v.toLocaleString('en-IN')}${this.suffix()}`,
      }));
      const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      const base = this.pad.t + innerH;
      const area = points.length ? `${line} L${points[points.length - 1].x} ${base} L${points[0].x} ${base} Z` : '';
      return { name: s.name, color, points, line, area };
    });
  });

  protected readonly xLabels = computed(() => {
    const labels = this.labels();
    const innerW = this.width() - this.pad.l - this.pad.r;
    const step = innerW / Math.max(1, labels.length - 1);
    const every = Math.ceil(labels.length / Math.max(1, Math.floor(innerW / 56)));
    return labels.map((text, i) => ({ text: i % every === 0 ? text : '', x: this.pad.l + i * step }));
  });
}

/** Donut chart with legend and centre total. */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-wrap">
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 120 120" role="img" [attr.aria-label]="ariaLabel()">
        <circle cx="60" cy="60" r="44" fill="none" stroke="var(--surface-sunken)" stroke-width="16" />
        @for (s of segments(); track s.label) {
          <circle
            class="seg"
            cx="60"
            cy="60"
            r="44"
            fill="none"
            [attr.stroke]="s.color"
            stroke-width="16"
            [attr.stroke-dasharray]="s.dash"
            [attr.stroke-dashoffset]="s.offset"
            transform="rotate(-90 60 60)"
          >
            <title>{{ s.label }}: {{ s.value.toLocaleString('en-IN') }} ({{ s.pct }}%)</title>
          </circle>
        }
        <text x="60" y="57" text-anchor="middle" class="donut-total">{{ centerValue() || total().toLocaleString('en-IN') }}</text>
        <text x="60" y="73" text-anchor="middle" class="donut-caption">{{ centerLabel() }}</text>
      </svg>
      <ul class="donut-legend">
        @for (s of segments(); track s.label) {
          <li>
            <span class="dot" [style.background]="s.color"></span>
            <span class="flex-1">{{ s.label }}</span>
            <span class="tabular fw-600">{{ s.value.toLocaleString('en-IN') }}</span>
            <span class="text-muted tabular pct">{{ s.pct }}%</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class DonutChartComponent {
  readonly data = input.required<ChartDatum[]>();
  readonly size = input(160);
  readonly centerLabel = input('Total');
  readonly centerValue = input('');
  readonly ariaLabel = input('Donut chart');
  protected readonly total = computed(() => this.data().reduce((s, d) => s + d.value, 0));
  protected readonly segments = computed(() => {
    const C = 2 * Math.PI * 44;
    const total = this.total() || 1;
    let acc = 0;
    return this.data().map((d, i) => {
      const len = (d.value / total) * C;
      const seg = { label: d.label, value: d.value, color: d.color ?? PALETTE[i % PALETTE.length], dash: `${Math.max(len - 1, 0)} ${C}`, offset: -acc, pct: Math.round((d.value / total) * 1000) / 10 };
      acc += len;
      return seg;
    });
  });
}

/** Horizontal funnel (lead conversion). */
@Component({
  selector: 'app-funnel-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="funnel" [attr.aria-label]="ariaLabel()">
      @for (s of stages(); track s.label; let i = $index) {
        <li>
          <div class="funnel-meta">
            <span class="fw-500">{{ s.label }}</span>
            <span class="tabular"
              ><strong>{{ s.value.toLocaleString('en-IN') }}</strong>
              @if (i > 0) {
                <span class="text-muted text-xs"> · {{ s.rate }}% of previous</span>
              }
            </span>
          </div>
          <div class="funnel-track"><span [style.width.%]="s.pct" [style.background]="s.color"></span></div>
        </li>
      }
    </ol>
  `,
})
export class FunnelChartComponent {
  readonly data = input.required<ChartDatum[]>();
  readonly ariaLabel = input('Conversion funnel');
  protected readonly stages = computed(() => {
    const d = this.data();
    const max = Math.max(1, ...d.map((x) => x.value));
    return d.map((x, i) => ({
      ...x,
      pct: Math.max(2, (x.value / max) * 100),
      rate: i > 0 && d[i - 1].value ? Math.round((x.value / d[i - 1].value) * 100) : 100,
      color: x.color ?? PALETTE[0],
    }));
  });
}

/** Card wrapper for charts with title, subtitle and optional actions. */
@Component({
  selector: 'app-chart-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card chart-card">
      <div class="card-header">
        <div>
          <h3 class="card-title">{{ title() }}</h3>
          @if (subtitle()) {
            <div class="card-subtitle">{{ subtitle() }}</div>
          }
        </div>
        <ng-content select="[actions]" />
      </div>
      <div class="card-body"><ng-content /></div>
    </section>
  `,
})
export class ChartCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}

/** Tiny inline trend line for stat cards and tables. */
@Component({
  selector: 'app-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" aria-hidden="true">
      <path [attr.d]="path()" fill="none" [attr.stroke]="color()" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
})
export class SparklineComponent {
  readonly data = input.required<number[]>();
  readonly width = input(96);
  readonly height = input(28);
  readonly color = input('var(--primary)');
  protected readonly path = computed(() => {
    const d = this.data();
    const max = Math.max(...d);
    const min = Math.min(...d);
    const range = max - min || 1;
    const step = this.width() / Math.max(1, d.length - 1);
    return d.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${(this.height() - 2 - ((v - min) / range) * (this.height() - 4)).toFixed(1)}`).join(' ');
  });
}

export const CHART_COMPONENTS = [BarChartComponent, LineChartComponent, DonutChartComponent, FunnelChartComponent, ChartCardComponent, ChartLegendComponent, SparklineComponent] as const;

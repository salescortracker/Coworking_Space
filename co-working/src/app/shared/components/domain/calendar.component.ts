import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { addDaysIso, isoDate, startOfWeek, todayIso } from '../../utils/dates';

export interface CalendarEvent {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  subtitle?: string;
  status: string;
}

const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);

/** Day / Week / Month calendar used by member and admin booking calendars. */
@Component({
  selector: 'app-calendar',
  imports: [DatePipe, TitleCasePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row-between row-wrap mb-4">
      <div class="row-sm">
        <button type="button" class="btn btn-secondary btn-sm" (click)="anchor.set(today)">Today</button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="shift(-1)" aria-label="Previous"><app-icon name="chevron-left" /></button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" (click)="shift(1)" aria-label="Next"><app-icon name="chevron-right" /></button>
        <h3 class="text-md fw-600" aria-live="polite">{{ heading() }}</h3>
      </div>
      <div class="segmented" role="radiogroup" aria-label="Calendar view">
        @for (v of views; track v) {
          <button type="button" role="radio" [attr.aria-checked]="view() === v" [class.active]="view() === v" (click)="view.set(v)">{{ v | titlecase }}</button>
        }
      </div>
    </div>

    @switch (view()) {
      @case ('month') {
        <div class="cal">
          <div class="cal-head">
            @for (d of dow; track d) {
              <div>{{ d }}</div>
            }
          </div>
          <div class="cal-grid">
            @for (c of monthCells(); track c.iso) {
              <div class="cal-cell" [class.muted]="!c.inMonth" [class.today]="c.iso === today">
                <button type="button" class="cal-day btn-link" style="background: none; border: 0; padding: 0; align-self: flex-start" (click)="anchor.set(c.iso); view.set('day')">{{ c.day }}</button>
                @for (e of c.events.slice(0, 3); track e.id) {
                  <button type="button" class="cal-event {{ e.status }}" [attr.title]="e.start + ' ' + e.title" (click)="eventClick.emit(e)">{{ e.start }} {{ e.title }}</button>
                }
                @if (c.events.length > 3) {
                  <button type="button" class="cal-more btn-link" style="background: none; border: 0; padding: 0; text-align: left" (click)="anchor.set(c.iso); view.set('day')">+{{ c.events.length - 3 }} more</button>
                }
              </div>
            }
          </div>
        </div>
      }
      @case ('week') {
        <div class="cal" style="overflow-x: auto">
          <div class="week-grid">
            <div class="time-col">
              <div class="day-col-head">&nbsp;</div>
              @for (h of hours; track h) {
                <div class="time-slot-label">{{ h }}:00</div>
              }
            </div>
            @for (d of weekDays(); track d.iso) {
              <div class="day-col">
                <div class="day-col-head" [class.today]="d.iso === today">{{ d.iso | date: 'EEE d' }}</div>
                <div style="position: relative">
                  @for (h of hours; track h) {
                    <div class="hour"></div>
                  }
                  @for (e of d.events; track e.id) {
                    <button type="button" class="block-event {{ e.status }}" [style.top.px]="top(e.start)" [style.height.px]="height(e.start, e.end)" (click)="eventClick.emit(e)" [attr.title]="e.title">
                      <strong>{{ e.start }}</strong> {{ e.title }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
      @case ('day') {
        <div class="cal">
          <div class="day-grid">
            <div class="time-col">
              <div class="day-col-head">&nbsp;</div>
              @for (h of hours; track h) {
                <div class="time-slot-label">{{ h }}:00</div>
              }
            </div>
            <div class="day-col" style="border-right: 0">
              <div class="day-col-head" [class.today]="anchor() === today">{{ anchor() | date: 'EEEE, d MMMM' }} · {{ dayEvents().length }} booking{{ dayEvents().length === 1 ? '' : 's' }}</div>
              <div style="position: relative">
                @for (h of hours; track h) {
                  <div class="hour"></div>
                }
                @for (e of dayLayout(); track e.ev.id) {
                  <button
                    type="button"
                    class="block-event {{ e.ev.status }}"
                    [style.top.px]="top(e.ev.start)"
                    [style.height.px]="height(e.ev.start, e.ev.end)"
                    [style.left]="'calc(' + e.col * (100 / e.cols) + '% + 3px)'"
                    [style.width]="'calc(' + 100 / e.cols + '% - 6px)'"
                    style="right: auto"
                    (click)="eventClick.emit(e.ev)"
                  >
                    <strong>{{ e.ev.start }}–{{ e.ev.end }}</strong> {{ e.ev.title }}
                    @if (e.ev.subtitle) {
                      <span class="d-block">{{ e.ev.subtitle }}</span>
                    }
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: `:host { display: block; }`,
})
export class CalendarComponent {
  readonly events = input.required<CalendarEvent[]>();
  readonly view = model<'month' | 'week' | 'day'>('month');
  readonly anchor = model<string>(todayIso());
  readonly eventClick = output<CalendarEvent>();

  protected readonly views = ['day', 'week', 'month'] as const;
  protected readonly dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly hours = HOURS;
  protected readonly today = todayIso();

  private readonly byDate = computed(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of this.events()) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    m.forEach((l) => l.sort((a, b) => a.start.localeCompare(b.start)));
    return m;
  });

  protected readonly heading = computed(() => {
    const a = new Date(this.anchor() + 'T12:00:00');
    if (this.view() === 'month') return a.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (this.view() === 'day') return a.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const s = startOfWeek(this.anchor());
    const e = addDaysIso(s, 6);
    return `${new Date(s + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(e + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  });

  protected readonly monthCells = computed(() => {
    const a = new Date(this.anchor() + 'T12:00:00');
    const first = isoDate(new Date(a.getFullYear(), a.getMonth(), 1, 12));
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const iso = addDaysIso(start, i);
      return { iso, day: Number(iso.slice(8)), inMonth: Number(iso.slice(5, 7)) === a.getMonth() + 1, events: this.byDate().get(iso) ?? [] };
    });
  });

  protected readonly weekDays = computed(() => {
    const s = startOfWeek(this.anchor());
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDaysIso(s, i);
      return { iso, events: this.byDate().get(iso) ?? [] };
    });
  });

  protected readonly dayEvents = computed(() => this.byDate().get(this.anchor()) ?? []);

  /** Simple column layout so overlapping bookings sit side by side. */
  protected readonly dayLayout = computed(() => {
    const evs = this.dayEvents();
    const cols: string[] = [];
    const placed = evs.map((ev) => {
      let col = cols.findIndex((end) => end <= ev.start);
      if (col === -1) {
        cols.push(ev.end);
        col = cols.length - 1;
      } else cols[col] = ev.end;
      return { ev, col };
    });
    const n = Math.max(1, Math.min(cols.length, 6));
    return placed.map((p) => ({ ...p, col: Math.min(p.col, n - 1), cols: n }));
  });

  protected shift(dir: number): void {
    const v = this.view();
    if (v === 'day') this.anchor.set(addDaysIso(this.anchor(), dir));
    else if (v === 'week') this.anchor.set(addDaysIso(this.anchor(), 7 * dir));
    else {
      const a = new Date(this.anchor() + 'T12:00:00');
      this.anchor.set(isoDate(new Date(a.getFullYear(), a.getMonth() + dir, 1, 12)));
    }
  }

  protected top(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return Math.max(0, (h - 8) * 48 + (m / 60) * 48);
  }

  protected height(s: string, e: string): number {
    return Math.max(22, this.top(e) - this.top(s) - 2);
  }
}

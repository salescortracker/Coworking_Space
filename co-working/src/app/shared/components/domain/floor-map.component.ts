import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Resource } from '../../../core/models';

export type FloorState = 'AVAILABLE' | 'BOOKED' | 'SELECTED' | 'BLOCKED' | 'MAINTENANCE';

/**
 * Mock floor plan. Resources are positioned from their stored percent coordinates,
 * so the map works without any backend geometry service.
 */
@Component({
  selector: 'app-floor-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="floor-map-wrap">
      <div class="floor-map" role="group" [attr.aria-label]="label()">
        <div class="fm-zone" style="left: 2%; top: 3%; width: 51%; height: 39%"><span class="fm-zone-label">Open zone · Hot desks</span></div>
        <div class="fm-zone" style="left: 2%; top: 45%; width: 51%; height: 52%"><span class="fm-zone-label">Focus zone · Dedicated</span></div>
        <div class="fm-zone" style="left: 55%; top: 3%; width: 44%; height: 40%"><span class="fm-zone-label">Private wing</span></div>
        <div class="fm-zone" style="left: 55%; top: 47%; width: 44%; height: 30%"><span class="fm-zone-label">Meeting wing</span></div>
        <div class="fm-landmark" style="left: 56%; top: 81%; width: 14%; height: 14%">Pantry</div>
        <div class="fm-landmark" style="left: 72%; top: 81%; width: 12%; height: 14%">Lounge</div>
        <div class="fm-landmark" style="left: 86%; top: 81%; width: 12%; height: 14%">Reception</div>
        @for (r of placed(); track r.res.id) {
          <button
            type="button"
            class="fm-item {{ r.state }}"
            [style.left.%]="r.res.map.x"
            [style.top.%]="r.res.map.y"
            [style.width.%]="r.res.map.w"
            [style.height.%]="r.res.map.h"
            [disabled]="r.state === 'BLOCKED' && !allowBlockedClick()"
            [attr.aria-label]="r.res.name + ', ' + r.state.toLowerCase() + (r.res.capacity > 1 ? ', ' + r.res.capacity + ' seats' : '')"
            [attr.aria-pressed]="r.state === 'SELECTED'"
            [attr.title]="r.res.name + ' · ' + r.state.toLowerCase()"
            (click)="pick.emit(r.res)"
          >
            <span>{{ short(r.res) }}</span>
            @if (r.res.capacity > 1) {
              <span class="cap">{{ r.res.capacity }} seats</span>
            }
          </button>
        }
      </div>
    </div>
    @if (showLegend()) {
      <div class="fm-legend mt-3" aria-label="Legend">
        <span><span class="fm-swatch" style="background: var(--fm-available-bg); border-color: var(--fm-available-border)"></span>Available</span>
        <span><span class="fm-swatch" style="background: var(--fm-booked-bg); border-color: var(--fm-booked-border)"></span>Booked / Occupied</span>
        <span><span class="fm-swatch" style="background: var(--primary-solid); border-color: var(--primary-solid-active)"></span>Selected</span>
        <span><span class="fm-swatch" style="background: var(--fm-blocked-b); border-color: var(--fm-blocked-border)"></span>Blocked</span>
        <span><span class="fm-swatch" style="background: var(--warning-50); border-color: var(--fm-maintenance-border)"></span>Maintenance</span>
      </div>
    }
  `,
})
export class FloorMapComponent {
  readonly resources = input.required<Resource[]>();
  /** Resource ids currently booked for the chosen slot. */
  readonly bookedIds = input<string[]>([]);
  readonly selectedId = input<string | null | undefined>(null);
  /** Only resources of these types can be selected; others render as blocked. */
  readonly selectableTypes = input<string[] | null>(null);
  readonly allowBlockedClick = input(false);
  readonly showLegend = input(true);
  readonly label = input('Floor map');
  readonly pick = output<Resource>();

  protected readonly placed = computed(() => {
    const booked = new Set(this.bookedIds());
    const types = this.selectableTypes();
    return this.resources().map((res) => {
      let state: FloorState = 'AVAILABLE';
      if (res.blocked || res.status === 'INACTIVE') state = 'BLOCKED';
      else if (res.status === 'MAINTENANCE') state = 'MAINTENANCE';
      else if (types && !types.includes(res.type)) state = 'BLOCKED';
      else if (res.id === this.selectedId()) state = 'SELECTED';
      else if (booked.has(res.id)) state = 'BOOKED';
      return { res, state };
    });
  });

  protected short(r: Resource): string {
    if (r.type === 'HOT_DESK') return r.code.split('-').slice(-2).join('-');
    if (r.type === 'DEDICATED_DESK') return r.code.split('-').slice(-2).join('-');
    return r.name.split(' – ')[0];
  }
}

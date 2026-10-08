import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { LocationService } from './data/workspace-data.service';
import { ClientStoreService } from './client-store.service';

export interface LocationOption {
  value: string;
  label: string;
  group?: string;
  indent?: boolean;
}

const KEY = 'officera:ui:location';

/**
 * Global multi-location context for the operator console.
 * Selection values: 'ALL', 'city:<City>' or a location id.
 * Every data service filters its `scoped` list through `matcher()`, so components never
 * implement location filtering themselves.
 */
@Injectable({ providedIn: 'root' })
export class LocationContextService {
  private readonly db = inject(ClientStoreService);
  private readonly auth = inject(AuthService);
  private readonly locations = inject(LocationService);

  private readonly selection = signal<string>(this.db.read<string>(KEY) ?? 'ALL');

  /** Locations the signed-in staff user may operate (location managers are restricted). */
  readonly allowedLocations = computed(() => {
    const user = this.auth.user();
    const all = this.locations.items();
    if (!user || user.role === 'MEMBER' || user.locationIds.length === 0) return all;
    return all.filter((l) => user.locationIds.includes(l.id));
  });

  readonly isRestricted = computed(() => {
    const u = this.auth.user();
    return !!u && u.role !== 'MEMBER' && u.locationIds.length > 0;
  });

  readonly options = computed<LocationOption[]>(() => {
    const allowed = this.allowedLocations();
    const opts: LocationOption[] = [
      { value: 'ALL', label: this.isRestricted() ? 'All my locations' : 'All Locations' },
    ];
    const cities = [...new Set(allowed.map((l) => l.city))];
    for (const city of cities) {
      const inCity = allowed.filter((l) => l.city === city);
      if (inCity.length > 1) opts.push({ value: `city:${city}`, label: city, group: city });
      for (const l of inCity) {
        opts.push({ value: l.id, label: inCity.length > 1 ? l.name.replace('Officera ', '') : `${city} – ${l.name.replace('Officera ', '')}`, group: city, indent: inCity.length > 1 });
      }
    }
    return opts;
  });

  /** Current selection, falling back to ALL if it is not permitted for this user. */
  readonly value = computed(() => {
    const v = this.selection();
    return this.options().some((o) => o.value === v) ? v : 'ALL';
  });

  readonly selectedIds = computed<string[]>(() => {
    const v = this.value();
    const allowed = this.allowedLocations();
    if (v === 'ALL') return allowed.map((l) => l.id);
    if (v.startsWith('city:')) return allowed.filter((l) => l.city === v.slice(5)).map((l) => l.id);
    return [v];
  });

  readonly label = computed(() => {
    const v = this.value();
    const opt = this.options().find((o) => o.value === v);
    if (!opt) return 'All Locations';
    if (v.startsWith('city:')) return `${opt.label} (all centres)`;
    if (v === 'ALL') return opt.label;
    return this.locations.find(v)?.name ?? opt.label;
  });

  /** True when one single location is selected. */
  readonly singleLocationId = computed(() => (this.selectedIds().length === 1 ? this.selectedIds()[0] : null));

  readonly matcher = computed(() => {
    const ids = new Set(this.selectedIds());
    return (locationId: string | undefined) => !locationId || ids.has(locationId);
  });

  select(value: string): void {
    this.selection.set(value);
    this.db.write(KEY, value);
  }
}

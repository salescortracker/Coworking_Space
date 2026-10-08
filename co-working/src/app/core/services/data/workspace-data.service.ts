import { Injectable, computed } from '@angular/core';
import { Location, Resource } from '../../models';
import { ApiCollection } from '../api-collection';

@Injectable({ providedIn: 'root' })
export class LocationService extends ApiCollection<Location> {
  constructor() {
    super('Location', 'LOC', (l) => l.id);
  }

  readonly active = computed(() => this.items().filter((l) => l.status === 'ACTIVE'));
  readonly cities = computed(() => [...new Set(this.items().map((l) => l.city))].sort());

  name(id: string | undefined): string {
    return this.find(id)?.name ?? '—';
  }

  shortName(id: string | undefined): string {
    return this.find(id)?.name.replace('Officera ', '') ?? '—';
  }
}

@Injectable({ providedIn: 'root' })
export class ResourceService extends ApiCollection<Resource> {
  constructor() {
    super('Resource', 'RES', (r) => r.locationId);
  }

  byLocation(locationId: string): Resource[] {
    return this.items().filter((r) => r.locationId === locationId);
  }

  name(id: string | undefined): string {
    return this.find(id)?.name ?? '—';
  }
}

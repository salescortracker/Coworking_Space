import { Injectable, inject } from '@angular/core';
import { Location, SpaceType } from '../models';
import { LocationService, ResourceService } from './data/workspace-data.service';
import { PlanService } from './data/membership-data.service';
import { BookingEngineService } from './booking-engine.service';

export interface Offering {
  location: Location;
  type: SpaceType | null;
  price: number;
  unit: string;
  capacity: number;
  available: boolean;
}

export interface SearchCriteria {
  city?: string;
  locationId?: string;
  type?: SpaceType | '';
  date?: string;
  seats?: number;
  maxPrice?: number;
  minRating?: number;
  amenities?: string[];
  sort?: 'price-asc' | 'price-desc' | 'distance' | 'rating';
}

/** Public marketplace view over locations/resources/plans (flow 2 search & discovery). */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly locations = inject(LocationService);
  private readonly resources = inject(ResourceService);
  private readonly plans = inject(PlanService);
  private readonly engine = inject(BookingEngineService);

  offering(loc: Location, type: SpaceType | null, date?: string, seats = 1): Offering {
    if (type === 'DAY_PASS') {
      const p = this.plans.published().find((x) => x.type === 'DAY_PASS');
      return { location: loc, type, price: p?.price ?? loc.startingPrice, unit: 'day', capacity: loc.totalSeats, available: loc.spaceTypes.includes('DAY_PASS') };
    }
    const rs = this.resources.byLocation(loc.id).filter((r) => r.status === 'ACTIVE' && (!type || r.type === type));
    if (!rs.length) return { location: loc, type, price: loc.startingPrice, unit: 'day', capacity: 0, available: false };
    const cheapest = rs.reduce((a, b) => (a.price <= b.price ? a : b));
    const capacity = type === 'HOT_DESK' || type === 'DEDICATED_DESK' ? rs.length : Math.max(...rs.map((r) => r.capacity));
    let available = true;
    if (date) {
      const busy = new Set(this.engine.busyResourceIds(loc.id, date, '10:00', '12:00'));
      available = rs.some((r) => !busy.has(r.id) && r.capacity >= (type === 'MEETING_ROOM' || type === 'PRIVATE_OFFICE' ? seats : 1));
    }
    return { location: loc, type, price: type ? cheapest.price : loc.startingPrice, unit: type ? cheapest.priceUnit : 'day', capacity, available: available && capacity >= (type === 'HOT_DESK' || type === 'DEDICATED_DESK' ? seats : 1) };
  }

  search(c: SearchCriteria): Offering[] {
    let list = this.locations.active();
    if (c.city) list = list.filter((l) => l.city === c.city);
    if (c.locationId) list = list.filter((l) => l.id === c.locationId);
    if (c.type) list = list.filter((l) => l.spaceTypes.includes(c.type as SpaceType));
    if (c.minRating) list = list.filter((l) => l.rating >= c.minRating!);
    if (c.amenities?.length) list = list.filter((l) => c.amenities!.every((a) => l.amenities.includes(a)));
    let out = list.map((l) => this.offering(l, (c.type as SpaceType) || null, c.date, c.seats ?? 1));
    if (c.maxPrice) out = out.filter((o) => o.price <= c.maxPrice!);
    if (c.seats && c.seats > 1) out = out.filter((o) => o.capacity >= c.seats! || o.type === 'DAY_PASS');
    switch (c.sort) {
      case 'price-asc':
        out.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        out.sort((a, b) => b.price - a.price);
        break;
      case 'distance':
        out.sort((a, b) => a.location.distanceKm - b.location.distanceKm);
        break;
      default:
        out.sort((a, b) => b.location.rating - a.location.rating);
    }
    return out;
  }
}

import { InjectionToken, Signal } from '@angular/core';

/**
 * Provides the global location filter to data services without a circular import.
 * Bound to LocationContextService.matcher in app.config.ts.
 */
export const LOCATION_MATCHER = new InjectionToken<Signal<(locationId: string | undefined) => boolean>>('LOCATION_MATCHER');

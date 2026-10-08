import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/auth.guards';

export const LOCATION_ROUTES: Routes = [
  { path: '', title: 'Locations · Officera', loadComponent: () => import('./locations-list.component').then((m) => m.LocationsListComponent) },
  { path: 'new', title: 'Add location · Officera', canMatch: [roleGuard], data: { permission: 'locations.create' }, loadComponent: () => import('./location-form.component').then((m) => m.LocationFormComponent) },
  { path: ':id/edit', title: 'Edit location · Officera', canMatch: [roleGuard], data: { permission: 'locations.edit' }, loadComponent: () => import('./location-form.component').then((m) => m.LocationFormComponent) },
  { path: ':id', title: 'Location · Officera', loadComponent: () => import('./location-detail.component').then((m) => m.LocationDetailComponent) },
];

export const RESOURCE_ROUTES: Routes = [
  { path: '', title: 'Resources · Officera', loadComponent: () => import('./resources-list.component').then((m) => m.ResourcesListComponent) },
  { path: 'new', title: 'Add resource · Officera', canMatch: [roleGuard], data: { permission: 'resources.create' }, loadComponent: () => import('./resource-form.component').then((m) => m.ResourceFormComponent) },
  { path: ':id/edit', title: 'Edit resource · Officera', canMatch: [roleGuard], data: { permission: 'resources.edit' }, loadComponent: () => import('./resource-form.component').then((m) => m.ResourceFormComponent) },
  { path: ':id', title: 'Resource · Officera', loadComponent: () => import('./resource-detail.component').then((m) => m.ResourceDetailComponent) },
];

export const FLOOR_MAP_ROUTES: Routes = [
  { path: '', title: 'Floor maps · Officera', loadComponent: () => import('./floor-maps.component').then((m) => m.FloorMapsComponent) },
];

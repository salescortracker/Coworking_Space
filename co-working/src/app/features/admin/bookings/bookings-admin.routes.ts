import { Routes } from '@angular/router';

export const BOOKINGS_ADMIN_ROUTES: Routes = [
  { path: '', title: 'Bookings · Officera', loadComponent: () => import('./bookings-admin.component').then((m) => m.BookingsAdminComponent) },
  { path: 'calendar', title: 'Booking calendar · Officera', loadComponent: () => import('./bookings-admin.component').then((m) => m.BookingCalendarComponent) },
  { path: 'availability', title: 'Availability · Officera', loadComponent: () => import('./bookings-admin.component').then((m) => m.AvailabilityComponent) },
  { path: ':id', title: 'Booking · Officera', loadComponent: () => import('./bookings-admin.component').then((m) => m.BookingAdminDetailComponent) },
];

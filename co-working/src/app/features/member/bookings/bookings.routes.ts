import { Routes } from '@angular/router';

export const BOOKING_ROUTES: Routes = [
  { path: '', title: 'My bookings · Officera', loadComponent: () => import('./member-bookings.component').then((m) => m.MemberBookingsComponent) },
  { path: 'new', title: 'Book a workspace · Officera', loadComponent: () => import('./booking-wizard.component').then((m) => m.BookingWizardComponent) },
  { path: ':id', title: 'Booking · Officera', loadComponent: () => import('./member-bookings.component').then((m) => m.MemberBookingDetailComponent) },
];

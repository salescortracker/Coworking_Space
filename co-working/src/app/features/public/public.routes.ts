import { Routes } from '@angular/router';

/** Public website modules: Home, Search, Locations, Leads, Content (each lazy). */
export const PUBLIC_ROUTES: Routes = [
  { path: '', pathMatch: 'full', title: 'Officera – Find Your Perfect Workspace', loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent) },
  { path: 'search', title: 'Search workspaces · Officera', loadComponent: () => import('./discovery/discovery.component').then((m) => m.SearchComponent) },
  { path: 'locations', title: 'Locations · Officera', loadComponent: () => import('./discovery/discovery.component').then((m) => m.LocationsPublicComponent) },
  { path: 'locations/:id', title: 'Location · Officera', loadComponent: () => import('./discovery/discovery.component').then((m) => m.LocationPublicComponent) },
  { path: 'membership', title: 'Membership plans · Officera', loadComponent: () => import('./discovery/discovery.component').then((m) => m.MembershipPublicComponent) },
  { path: 'book-now', title: 'Book Now · Officera', data: { mode: 'BOOK_NOW' }, loadComponent: () => import('./leads/enquiry.component').then((m) => m.EnquiryComponent) },
  { path: 'request-callback', title: 'Request a callback · Officera', data: { mode: 'CALLBACK' }, loadComponent: () => import('./leads/enquiry.component').then((m) => m.EnquiryComponent) },
  { path: 'schedule-tour', title: 'Schedule a tour · Officera', data: { mode: 'TOUR' }, loadComponent: () => import('./leads/enquiry.component').then((m) => m.EnquiryComponent) },
  { path: 'events', title: 'Events · Officera', loadComponent: () => import('./content/content-pages.component').then((m) => m.PublicEventsComponent) },
  { path: 'blog', title: 'Blog · Officera', loadComponent: () => import('./content/content-pages.component').then((m) => m.BlogListComponent) },
  { path: 'blog/:id', title: 'Blog · Officera', loadComponent: () => import('./content/content-pages.component').then((m) => m.BlogPostComponent) },
  { path: 'gallery', title: 'Gallery · Officera', loadComponent: () => import('./content/content-pages.component').then((m) => m.GalleryComponent) },
  { path: 'about', title: 'About · Officera', loadComponent: () => import('./content/content-pages.component').then((m) => m.AboutComponent) },
  { path: 'contact', title: 'Contact · Officera', loadComponent: () => import('./content/content-pages.component').then((m) => m.ContactComponent) },
];

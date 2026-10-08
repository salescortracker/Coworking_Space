import { Routes } from '@angular/router';

export const MEMBER_VISITOR_ROUTES: Routes = [
  { path: '', title: 'Visitors · Officera', loadComponent: () => import('./visitors/member-visitors.component').then((m) => m.MemberVisitorsComponent) },
  { path: 'new', title: 'Add visitor · Officera', loadComponent: () => import('./visitors/member-visitors.component').then((m) => m.VisitorFormComponent) },
  { path: ':id', title: 'Visitor · Officera', loadComponent: () => import('./visitors/member-visitors.component').then((m) => m.VisitorDetailComponent) },
];

export const MEMBER_SUPPORT_ROUTES: Routes = [
  { path: '', title: 'Support · Officera', loadComponent: () => import('./support/member-support.component').then((m) => m.MemberSupportComponent) },
  { path: 'new', title: 'Raise ticket · Officera', loadComponent: () => import('./support/member-support.component').then((m) => m.TicketFormComponent) },
  { path: ':id', title: 'Ticket · Officera', loadComponent: () => import('./support/member-support.component').then((m) => m.TicketDetailComponent) },
];

import { Routes } from '@angular/router';

export const PAYMENT_ROUTES: Routes = [
  { path: 'payments', title: 'Payments · Officera', loadComponent: () => import('./member-payments.component').then((m) => m.MemberPaymentsComponent) },
  { path: 'payments/result', title: 'Payment result · Officera', loadComponent: () => import('./payment-result.component').then((m) => m.PaymentResultComponent) },
  { path: 'checkout', title: 'Checkout · Officera', loadComponent: () => import('./checkout.component').then((m) => m.CheckoutComponent) },
  { path: 'invoices', title: 'Invoices · Officera', loadComponent: () => import('./member-invoices.component').then((m) => m.MemberInvoicesComponent) },
  { path: 'invoices/:id', title: 'Invoice · Officera', loadComponent: () => import('./member-invoices.component').then((m) => m.InvoiceDetailComponent) },
];

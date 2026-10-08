import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/guards/auth.guards';

export const FINANCE_ADMIN_ROUTES: Routes = [
  { path: '', title: 'Finance · Officera', loadComponent: () => import('./finance-admin.component').then((m) => m.FinanceOverviewComponent) },
  { path: 'payments', title: 'Payments · Officera', loadComponent: () => import('./finance-admin.component').then((m) => m.FinancePaymentsComponent) },
  { path: 'invoices', title: 'Invoices · Officera', canMatch: [roleGuard], data: { permission: 'invoices.view' }, loadComponent: () => import('./finance-admin.component').then((m) => m.FinanceInvoicesComponent) },
  { path: 'invoices/:id', title: 'Invoice · Officera', canMatch: [roleGuard], data: { permission: 'invoices.view' }, loadComponent: () => import('../../member/payments/member-invoices.component').then((m) => m.InvoiceDetailComponent) },
  { path: 'refunds', title: 'Refunds · Officera', canMatch: [roleGuard], data: { permission: 'refunds.view' }, loadComponent: () => import('./finance-admin.component').then((m) => m.FinanceRefundsComponent) },
  { path: 'credit-notes', title: 'Credit notes · Officera', canMatch: [roleGuard], data: { permission: 'invoices.view' }, loadComponent: () => import('./finance-admin.component').then((m) => m.CreditNotesComponent) },
  { path: 'dues', title: 'Outstanding dues · Officera', canMatch: [roleGuard], data: { permission: 'dues.view' }, loadComponent: () => import('./finance-admin.component').then((m) => m.OutstandingDuesComponent) },
  { path: 'export', title: 'Accounting export · Officera', canMatch: [roleGuard], data: { permission: 'accounting.view' }, loadComponent: () => import('./finance-admin.component').then((m) => m.AccountingExportComponent) },
];

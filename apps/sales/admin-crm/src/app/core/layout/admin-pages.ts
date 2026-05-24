import { Routes } from '@angular/router';
import { ShellRoutePlaceholderComponent } from './shell-route-placeholder.component';

export type AdminPageId =
  | 'overview'
  | 'leads'
  | 'followups'
  | 'employees'
  | 'reports'
  | 'company'
  | 'support'
  | 'emp_dashboard'
  | 'settings'
  | 'invoice'
  | 'client_onboarding'
  | 'invoice_settings'
  | 'quotation'
  | 'remarks_filter'
  | 'crm_clients'
  | 'crm_sla'
  | 'crm_nda'
  | 'crm_amc'
  | 'crm_payments'
  | 'crm_tickets'
  | 'crm_projects';

export const ADMIN_PAGES: readonly AdminPageId[] = [
  'overview',
  'leads',
  'followups',
  'employees',
  'reports',
  'company',
  'support',
  'emp_dashboard',
  'settings',
  'invoice',
  'client_onboarding',
  'invoice_settings',
  'quotation',
  'remarks_filter',
  'crm_clients',
  'crm_sla',
  'crm_nda',
  'crm_amc',
  'crm_payments',
  'crm_tickets',
  'crm_projects',
];

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...ADMIN_PAGES.map((page) => ({ path: page, component: ShellRoutePlaceholderComponent, data: { page } })),
  { path: '**', redirectTo: 'overview' },
];

import { Routes } from '@angular/router';
import { ShellRoutePlaceholderComponent } from './shell-route-placeholder.component';

export type EmployeePageId =
  | 'overview'
  | 'leads'
  | 'followups'
  | 'interested'
  | 'dnp'
  | 'converted'
  | 'favourite'
  | 'today-calls'
  | 'invoices'
  | 'quotations';

export const EMPLOYEE_PAGES: readonly EmployeePageId[] = [
  'overview',
  'leads',
  'followups',
  'interested',
  'dnp',
  'converted',
  'favourite',
  'today-calls',
  'invoices',
  'quotations',
];

export const EMPLOYEE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...EMPLOYEE_PAGES.map((page) => ({ path: page, component: ShellRoutePlaceholderComponent, data: { page } })),
  { path: '**', redirectTo: 'overview' },
];

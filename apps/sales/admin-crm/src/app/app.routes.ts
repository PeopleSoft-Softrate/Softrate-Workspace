import { Routes } from '@angular/router';
import { AdminWorkspaceComponent } from './features/admin-workspace/admin-workspace.component';
import { PublicInvoiceComponent } from './features/invoices/presentation/public-invoice/public-invoice.component';

export const routes: Routes = [
  { path: '', component: AdminWorkspaceComponent },
  { path: 'invoice/:publicToken', component: PublicInvoiceComponent },
  { path: '**', redirectTo: '' },
];

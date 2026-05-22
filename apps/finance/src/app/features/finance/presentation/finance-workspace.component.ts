import { NgFor, NgIf } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StatusSelectComponent } from '../../../shared/ui/status-select.component';
import { BankingViewComponent } from './banking/banking-view.component';
import { DashboardViewComponent } from './dashboard/dashboard-view.component';
import { ExpensesViewComponent } from './expenses/expenses-view.component';
import { PayablesViewComponent } from './payables/payables-view.component';
import { PayrollViewComponent } from './payroll/payroll-view.component';
import { AmcRenewalsViewComponent } from './receivables/amc-renewals/amc-renewals-view.component';
import { InvoicesViewComponent } from './receivables/invoices/invoices-view.component';
import { ReceivablesPlaceholderViewComponent } from './receivables/receivables-placeholder-view.component';
import { ReportsViewComponent } from './reports/reports-view.component';
import { SettingsViewComponent } from './settings/settings-view.component';
import { TaxViewComponent } from './tax/tax-view.component';
import { FinanceWorkspaceViewModel } from './finance-workspace.viewmodel';

@Component({
  selector: 'app-finance-workspace',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    FormsModule,
    StatusSelectComponent,
    BankingViewComponent,
    DashboardViewComponent,
    ExpensesViewComponent,
    PayablesViewComponent,
    PayrollViewComponent,
    ReceivablesPlaceholderViewComponent,
    ReportsViewComponent,
    SettingsViewComponent,
    TaxViewComponent,
    InvoicesViewComponent,
    AmcRenewalsViewComponent,
  ],
  providers: [FinanceWorkspaceViewModel],
  templateUrl: './finance-workspace.component.html',
  styleUrl: './finance-workspace.component.css',
})
export class FinanceWorkspaceComponent implements OnInit {
  constructor(readonly vm: FinanceWorkspaceViewModel) {}

  ngOnInit(): void {
    this.vm.loadActive();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.vm.profileMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    this.vm.profileMenuOpen = false;
    this.vm.sidebarOpen = false;
    this.vm.closeDetail();
  }
}

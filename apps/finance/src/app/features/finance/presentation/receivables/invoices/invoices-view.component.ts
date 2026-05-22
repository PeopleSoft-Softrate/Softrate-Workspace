import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { clientName, formatDate, formatMoney, paymentStatus } from '../../../domain/finance-formatters';
import { FinanceAnalyticsItem, FinanceRecord } from '../../../domain/finance-record.model';

@Component({
  selector: 'app-finance-invoices-view',
  standalone: true,
  imports: [NgFor, NgIf, EmptyStateComponent],
  templateUrl: './invoices-view.component.html',
  styleUrl: './invoices-view.component.css',
})
export class InvoicesViewComponent {
  @Input() rows: FinanceRecord[] = [];
  @Input() analytics: FinanceAnalyticsItem[] = [];
  @Output() openRecord = new EventEmitter<FinanceRecord>();

  clientName = clientName;
  formatDate = formatDate;
  formatMoney = formatMoney;
  paymentStatus = paymentStatus;

  outstanding(record: FinanceRecord): string {
    return formatMoney(record.balanceAmount || record.outstandingAmount || 0);
  }
}

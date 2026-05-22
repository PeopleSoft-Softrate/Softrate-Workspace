import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { clientName, formatDate, formatMoney, paymentStatus } from '../../../domain/finance-formatters';
import { FinanceAnalyticsItem, FinanceRecord } from '../../../domain/finance-record.model';

@Component({
  selector: 'app-finance-amc-renewals-view',
  standalone: true,
  imports: [NgFor, NgIf, EmptyStateComponent],
  templateUrl: './amc-renewals-view.component.html',
  styleUrl: './amc-renewals-view.component.css',
})
export class AmcRenewalsViewComponent {
  @Input() rows: FinanceRecord[] = [];
  @Input() analytics: FinanceAnalyticsItem[] = [];
  @Output() openRecord = new EventEmitter<FinanceRecord>();

  clientName = clientName;
  formatDate = formatDate;
  formatMoney = formatMoney;
  paymentStatus = paymentStatus;

  amount(record: FinanceRecord): string {
    return formatMoney(record.totalAmount || record.annualFee || 0);
  }

  outstanding(record: FinanceRecord): string {
    return formatMoney(record.balanceAmount || record.outstandingAmount || 0);
  }
}

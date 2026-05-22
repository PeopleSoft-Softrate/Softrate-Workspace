import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { FinanceAnalyticsItem, FinanceRecord } from '../../domain/finance-record.model';
import { formatDate, formatMoney } from '../../domain/finance-formatters';
import { IntegrationPlaceholderComponent } from '../integration-placeholder/integration-placeholder.component';

@Component({
  selector: 'app-finance-expenses-view',
  standalone: true,
  imports: [NgFor, NgIf, EmptyStateComponent, IntegrationPlaceholderComponent],
  templateUrl: './expenses-view.component.html',
  styleUrl: './expenses-view.component.css',
})
export class ExpensesViewComponent {
  @Input() title = 'Expenses to be integrated.';
  @Input() integrated = false;
  @Input() rows: FinanceRecord[] = [];
  @Input() analytics: FinanceAnalyticsItem[] = [];
  @Input() approvingClaimId = '';
  @Output() openRecord = new EventEmitter<FinanceRecord>();
  @Output() approveClaim = new EventEmitter<FinanceRecord>();

  formatMoney = formatMoney;
  formatDate = formatDate;

  employeeName(row: FinanceRecord): string {
    return String(row.employeeName || row['requesterName'] || 'Employee');
  }

  requesterMeta(row: FinanceRecord): string {
    return String(row.requesterId || '-');
  }

  claimAmount(row: FinanceRecord): string {
    return formatMoney(row.amount || row.totalAmount || 0);
  }

  financeStatus(row: FinanceRecord): string {
    return String(row.status || row.approvalStage || 'Pending Finance Approval');
  }

  hrStatus(row: FinanceRecord): string {
    return String(row.hrStatus || '-');
  }

  isApproved(row: FinanceRecord): boolean {
    return row.isFinanceTeamApprove === true || row.status === 'Finance Verified';
  }

  rowId(row: FinanceRecord): string {
    return String(row.id || row['_id'] || row['sourceId'] || '');
  }

  isApproving(row: FinanceRecord): boolean {
    return this.approvingClaimId === this.rowId(row);
  }

  approve(event: MouseEvent, row: FinanceRecord): void {
    event.stopPropagation();
    if (!this.isApproved(row) && !this.isApproving(row)) {
      this.approveClaim.emit(row);
    }
  }

  trackById = (_: number, row: FinanceRecord): string => this.rowId(row);
}

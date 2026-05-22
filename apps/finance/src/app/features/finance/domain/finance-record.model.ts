export interface FinanceQuery {
  companyCode: string;
  from?: string;
  to?: string;
}

export interface FinanceListResponse<T = FinanceRecord> {
  success: boolean;
  view?: string;
  items?: T[];
  analytics?: Record<string, number>;
}

export interface FinanceRecord {
  _id?: string;
  id?: string;
  source?: string;
  sourceId?: string;
  stream?: string;
  clientName?: string;
  clientCompanyName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string | null;
  domainName?: string;
  renewalDate?: string | null;
  totalAmount?: number;
  annualFee?: number;
  paidAmount?: number;
  balanceAmount?: number;
  outstandingAmount?: number;
  paymentStatus?: string;
  status?: string;
  paidAt?: string | null;
  owner?: string;
  notes?: string;
  claimNumber?: string;
  employeeName?: string;
  requesterName?: string;
  requesterId?: string;
  department?: string;
  category?: string;
  description?: string;
  expenseDate?: string | null;
  amount?: number;
  isFinanceTeamApprove?: boolean;
  managerStatus?: string;
  hrStatus?: string;
  approvalStage?: string;
  financeApprovedAt?: string | null;
  financeApprovedBy?: string;
  [key: string]: unknown;
}

export interface FinanceAnalyticsItem {
  label: string;
  value: string;
}

export interface FinanceDetailItem {
  label: string;
  value: string;
}

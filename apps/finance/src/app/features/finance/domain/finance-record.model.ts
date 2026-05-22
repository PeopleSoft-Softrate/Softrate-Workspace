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
  id?: string;
  source?: string;
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

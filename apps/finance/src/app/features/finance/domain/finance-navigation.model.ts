export type FinanceGroupId =
  | 'dashboard'
  | 'receivables'
  | 'payables'
  | 'expenses'
  | 'payroll'
  | 'tax'
  | 'banking'
  | 'reports'
  | 'settings';

export interface FinanceNavItem {
  id: string;
  label: string;
  icon: string;
}

export interface FinanceNavGroup {
  id: FinanceGroupId;
  label: string;
  children: FinanceNavItem[];
}

export const FINANCE_NAV_GROUPS: FinanceNavGroup[] = [
  { id: 'dashboard', label: 'Dashboard', children: [{ id: 'dashboard', label: 'Dashboard', icon: 'M4 5h7v7H4z M13 5h7v7h-7z M4 14h7v5H4z M13 14h7v5h-7z' }] },
  {
    id: 'receivables',
    label: 'Receivables',
    children: [
      { id: 'invoices', label: 'Invoices', icon: 'M6 3h8l4 4v14H6z M14 3v5h5 M8 12h8 M8 16h6' },
      { id: 'payments-received', label: 'Payments Received', icon: 'M3 7h18v11H3z M3 10h18 M7 15h4' },
      { id: 'amc-renewals', label: 'AMC Renewals', icon: 'M4 19V5 M4 19h16 M7 15l4-4 3 3 5-6' },
    ],
  },
  {
    id: 'payables',
    label: 'Payables',
    children: [
      { id: 'vendor-bills', label: 'Vendor Bills', icon: 'M7 3h10v18H7z M9 8h6 M9 12h6 M9 16h4' },
      { id: 'purchase-orders', label: 'Purchase Orders', icon: 'M6 6h15l-2 8H8z M6 6l-1-3H2 M9 20a1 1 0 1 0 0-2 M18 20a1 1 0 1 0 0-2' },
      { id: 'vendor-payments', label: 'Vendor Payments', icon: 'M12 3v18 M17 7H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6' },
      { id: 'subscription-payments', label: 'Subscription Payments', icon: 'M4 7a8 8 0 0 1 13-3l3 3 M20 17a8 8 0 0 1-13 3l-3-3' },
    ],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    children: [
      { id: 'employee-claims', label: 'Employee Claims', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8' },
      { id: 'company-expenses', label: 'Company Expenses', icon: 'M4 21V5a2 2 0 0 1 2-2h10l4 4v14 M14 3v6h6 M8 13h8' },
      { id: 'reimbursements', label: 'Reimbursements', icon: 'M4 12a8 8 0 0 1 13.66-5.66L20 8 M20 4v4h-4 M20 12a8 8 0 0 1-13.66 5.66L4 16 M4 20v-4h4' },
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll',
    children: [
      { id: 'payroll-runs', label: 'Payroll Runs', icon: 'M4 7h16 M4 12h16 M4 17h16' },
      { id: 'salary-processing', label: 'Salary Processing', icon: 'M12 2v20 M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7' },
      { id: 'payslips', label: 'Payslips', icon: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3' },
    ],
  },
  {
    id: 'tax',
    label: 'Tax',
    children: [
      { id: 'gst', label: 'GST', icon: 'M4 19l16-14 M7 7h.01 M17 17h.01' },
      { id: 'tds', label: 'TDS', icon: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z' },
      { id: 'tax-reports', label: 'Tax Reports', icon: 'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5' },
    ],
  },
  {
    id: 'banking',
    label: 'Banking',
    children: [
      { id: 'cash-flow', label: 'Cash Flow', icon: 'M3 17l6-6 4 4 8-8 M3 21h18' },
      { id: 'bank-reconciliation', label: 'Bank Reconciliation', icon: 'M3 10l9-6 9 6 M5 10v9 M9 10v9 M15 10v9 M19 10v9 M3 19h18' },
      { id: 'payment-matching', label: 'Payment Matching', icon: 'M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    children: [
      { id: 'profit-loss', label: 'Profit & Loss', icon: 'M4 19V5 M8 17V9 M12 17V7 M16 17v-5 M20 17V4' },
      { id: 'balance-sheet', label: 'Balance Sheet', icon: 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5' },
      { id: 'cash-flow', label: 'Cash Flow', icon: 'M3 17l6-6 4 4 8-8 M3 21h18' },
      { id: 'receivables-aging', label: 'Receivables Aging', icon: 'M12 8v5l3 2 M21 12a9 9 0 1 1-9-9' },
      { id: 'payables-aging', label: 'Payables Aging', icon: 'M12 8v5l-3 2 M3 12a9 9 0 1 0 9-9' },
      { id: 'project-profitability', label: 'Project Profitability', icon: 'M4 4h16v16H4z M8 14l3-3 2 2 4-5' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    children: [
      { id: 'tax-settings', label: 'Tax Settings', icon: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z' },
      { id: 'invoice-templates', label: 'Invoice Templates', icon: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3' },
      { id: 'payment-terms', label: 'Payment Terms', icon: 'M4 7h16v10H4z M8 11h8 M8 15h4' },
      { id: 'approval-rules', label: 'Approval Rules', icon: 'M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0' },
      { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: 'M4 19V5 M8 17V9 M12 17V7 M16 17v-5 M20 17V4' },
    ],
  },
];

export function isIntegratedFinanceView(groupId: FinanceGroupId, viewId: string): boolean {
  return groupId === 'receivables' && ['invoices', 'amc-renewals'].includes(viewId);
}

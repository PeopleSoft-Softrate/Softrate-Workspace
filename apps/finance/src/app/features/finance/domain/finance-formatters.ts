import { FinanceDetailItem, FinanceRecord } from './finance-record.model';

export function formatMoney(value: number | string | undefined | null): string {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(number);
}

export function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function titleize(value: string): string {
  return String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function moneyOrCount(value: number, key: string): string {
  return /claims?$/i.test(key) || (/count|due|overdue|runs|submitted|verified|paid$/i.test(key) && Math.abs(value) < 1000)
    ? String(value)
    : formatMoney(value);
}

export function clientName(record: FinanceRecord | undefined): string {
  return record?.clientName || record?.clientCompanyName || 'Finance record';
}

export function paymentStatus(record: FinanceRecord | undefined): string {
  return record?.paymentStatus || record?.status || '-';
}

export function financeAmount(record: FinanceRecord | undefined): string {
  const amount = record?.totalAmount ?? record?.annualFee ?? record?.paidAmount ?? record?.outstandingAmount ?? record?.balanceAmount;
  return typeof amount === 'number' ? formatMoney(amount) : '-';
}

export function invoiceDetailRows(record: FinanceRecord | undefined): FinanceDetailItem[] {
  if (!record) return [];
  return [
    { label: 'Client Name', value: clientName(record) },
    { label: 'Invoice No', value: record.invoiceNumber || '-' },
    { label: 'Invoice Date', value: formatDate(record.invoiceDate) },
    { label: 'Due Date', value: formatDate(record.dueDate) },
    { label: 'Payment Status', value: paymentStatus(record) },
    { label: 'Invoice Amount', value: formatMoney(record.totalAmount || 0) },
    { label: 'Paid Amount', value: formatMoney(record.paidAmount || 0) },
    { label: 'Outstanding', value: formatMoney(record.balanceAmount || record.outstandingAmount || 0) },
    { label: 'Source', value: record.stream || record.source || '-' },
  ];
}

export function amcDetailRows(record: FinanceRecord | undefined): FinanceDetailItem[] {
  if (!record) return [];
  return [
    { label: 'Client Name', value: clientName(record) },
    { label: 'Domain', value: record.domainName || '-' },
    { label: 'Renewal Date', value: formatDate(record.renewalDate) },
    { label: 'Payment Status', value: paymentStatus(record) },
    { label: 'AMC Amount', value: formatMoney(record.totalAmount || record.annualFee || 0) },
    { label: 'Paid Amount', value: formatMoney(record.paidAmount || 0) },
    { label: 'Outstanding', value: formatMoney(record.balanceAmount || record.outstandingAmount || 0) },
    { label: 'Source', value: record.stream || record.source || '-' },
  ];
}

export function employeeClaimDetailRows(record: FinanceRecord | undefined): FinanceDetailItem[] {
  if (!record) return [];
  return [
    { label: 'Claim No', value: record.claimNumber || record.id || '-' },
    { label: 'Employee', value: record.employeeName || '-' },
    { label: 'Employee ID', value: record.requesterId || '-' },
    { label: 'Department', value: record.department || '-' },
    { label: 'Category', value: record.category || '-' },
    { label: 'Expense Date', value: formatDate(record.expenseDate) },
    { label: 'Claim Amount', value: formatMoney(record.amount || record.totalAmount || 0) },
    { label: 'Finance Status', value: paymentStatus(record) },
    { label: 'Approved By', value: record.financeApprovedBy || '-' },
    { label: 'Approved At', value: formatDate(record.financeApprovedAt) },
  ];
}

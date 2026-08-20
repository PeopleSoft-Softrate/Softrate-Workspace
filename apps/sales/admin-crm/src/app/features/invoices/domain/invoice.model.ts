export interface InvoiceRecord {
  id: string;
  leadCode?: string;
  invoiceNumber: string;
  clientId?: string;
  companyName: string;
  leadCompanyName?: string;
  contactName: string;
  contactNumber: string;
  total: number;
  invoiceDate: string;
  paymentStatus?: string;
  amountPaid?: number;
  balanceDue?: number;
  clientSnapshot?: any;
}

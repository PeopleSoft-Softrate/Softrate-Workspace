export interface InvoiceRecord {
  id: string;
  companyCode?: string;
  invoiceNumber: string;
  publicToken?: string;
  publicUrl?: string;
  companyName: string;
  contactName: string;
  contactNumber: string;
  directorEmailAddress?: string;
  employeeId?: string;
  employeeName?: string;
  total: number;
  invoiceDate: string;
  createdAt?: string;
  dueDate?: string;
  versionNo?: number;
  paymentStatus?: string;
  amountPaid?: number;
  balanceDue?: number;
  isInclusiveGst?: boolean;
  items?: Array<{
    name?: string;
    quantity?: number;
    rate?: number;
    total?: number;
    sacHsn?: string;
    taxable?: number;
    cgst?: number;
    sgst?: number;
  }>;
  subtotal?: number;
  gstPercentage?: number;
  cgst?: number;
  sgst?: number;
  gstAmount?: number;
  companySnapshot?: {
    name?: string;
    logo?: string;
    gstNumber?: string;
    registeredAddress?: string;
    phone?: string;
    email?: string;
    website?: string;
    footer?: string;
  };
  clientSnapshot?: {
    companyName?: string;
    contactName?: string;
    phone?: string;
    email?: string;
  };
}

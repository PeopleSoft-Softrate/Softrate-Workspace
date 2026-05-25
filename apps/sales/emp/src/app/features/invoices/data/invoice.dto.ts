export interface InvoiceDto {
  _id?: string;
  invoiceNumber?: string;
  publicToken?: string;
  publicUrl?: string;
  leadCompanyName?: string;
  contactName?: string;
  contactNumber?: string;
  directorEmailAddress?: string;
  employeePhone?: string;
  employeeName?: string;
  total?: number;
  invoiceDate?: string;
  createdAt?: string;
  dueDate?: string;
  versionNo?: number;
  paymentStatus?: string;
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

export interface QuotationDto {
  _id?: string;
  quotationNumber?: string;
  leadCompanyName?: string;
  contactName?: string;
  contactNumber?: string;
  directorEmailAddress?: string;
  total?: number;
  quotationDate?: string;
  createdAt?: string;
  versionNo?: number;
  kindNote?: string;
  items?: Array<{
    name?: string;
    quantity?: number;
    rate?: number;
    taxable?: number;
    gst?: number;
    total?: number;
  }>;
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  companySnapshot?: {
    name?: string;
    logo?: string;
    registeredAddress?: string;
    phone?: string;
    email?: string;
    website?: string;
    gstNumber?: string;
    footer?: string;
    bankDetails?: {
      bankName?: string;
      accountNumber?: string;
      ifscCode?: string;
      branchName?: string;
    };
  };
}

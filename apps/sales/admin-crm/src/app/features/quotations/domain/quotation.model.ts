export interface QuotationRecord {
  id: string;
  leadCode?: string;
  clientId?: string;
  quotationNumber: string;
  companyName: string;
  leadCompanyName?: string;
  contactName: string;
  contactNumber: string;
  total: number;
  quotationDate: string;
}

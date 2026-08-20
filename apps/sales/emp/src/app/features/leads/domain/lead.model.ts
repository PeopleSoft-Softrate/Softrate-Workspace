export interface Lead {
  id: string;
  leadId?: string;
  companyCode: string;
  assignedEmployeeId: string;
  companyName: string;
  contactName: string;
  contactNumber: string;
  status: string;
  setLabel: string;
  description: string;
  division: string;
  email: string;
  remarks: string[];
  isStarred: boolean;
  isFavourite: boolean;
  sheetOrder?: number;
  createdAt: string;
  updatedAt: string;
  dateOfIncorporation?: string;
  companyEmail?: string;
  authorisedCapital?: string;
  paidUpCapital?: string;
  companyType?: string;
  classOfCompany?: string;
  companyOrigin?: string;
  roc?: string;
  directorFirstName?: string;
  directorLastName?: string;
  directorMobileNumber?: string;
  directorEmailAddress?: string;
  cin?: string;
  totalObligationOfContribution?: string;
  addressType?: string;
  streetAddressLine1?: string;
  streetAddressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  mainDivisionNo?: string;
  companyCategory?: string;
  companySubcategory?: string;
  registrationNumber?: string;
}

export interface LeadCompany {
  name: string;
  count: number;
}

export type LeadDrawerSection = 'details' | 'history' | 'followup' | 'ai';

export interface LeadHistoryLog {
  action: string;
  createdAt?: string;
  timestamp?: string;
  changedBy?: string;
  oldValue?: string;
  newValue?: string;
  dealName?: string;
  details?: string;
  metadata?: {
    remark?: string;
    [key: string]: unknown;
  };
}

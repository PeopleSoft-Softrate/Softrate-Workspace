export interface Lead {
  id: string;
  companyCode: string;
  assignedEmployeePhone: string;
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
  details?: string;
  metadata?: {
    remark?: string;
    [key: string]: unknown;
  };
}

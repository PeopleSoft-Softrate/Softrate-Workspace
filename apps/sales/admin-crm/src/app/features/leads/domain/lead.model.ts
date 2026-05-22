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
  createdAt: string;
  updatedAt: string;
}

export interface LeadCompany {
  name: string;
  count: number;
}

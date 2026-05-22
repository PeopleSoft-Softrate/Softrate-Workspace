import { CompanyGroup } from '../../../shared/types/pagination';

export interface LeadDto {
  _id?: string;
  companyCode?: string;
  assignedEmployeePhone?: string;
  leadCompanyName?: string;
  contactName?: string;
  contactNumber?: string;
  status?: string;
  setLabel?: string;
  companyDescription?: string;
  mainDivisionDescription?: string;
  directorEmailAddress?: string;
  remarks?: string[] | string;
  isStarred?: boolean;
  isFavourite?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadListDto {
  success: boolean;
  items?: LeadDto[];
  leads?: LeadDto[];
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
  sets?: string[];
  companies?: CompanyGroup[];
  cache?: string;
  message?: string;
}

export interface LeadListQueryDto {
  setLabel?: string;
  search?: string;
  searchMode?: 'phone' | 'text';
  status?: string;
  company?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  paginated?: boolean;
  remark?: string;
  includeContacts?: boolean | string;
  contactPageSize?: number;
}

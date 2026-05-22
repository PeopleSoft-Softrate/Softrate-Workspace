import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Lead {
  _id?: string;
  companyCode: string;
  assignedEmployeePhone: string;
  leadCompanyName: string;
  contactName: string;
  contactNumber: string;
  status: string;
  setLabel?: string;
  companyDescription?: string;
  mainDivisionDescription?: string;
  directorEmailAddress?: string;
  remarks?: string[];
  isStarred?: boolean;
  isFavourite?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadListQuery {
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

export interface LeadListResponse {
  success: boolean;
  items: Lead[];
  leads: Lead[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sets: string[];
  companies: Array<{ name: string; count: number }>;
  cache?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LeadService {
  constructor(private api: ApiService) {}

  private buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      search.set(key, String(value));
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  }

  addSingleLead(lead: Partial<Lead>): Observable<any> {
    return this.api.post('/api/leads', lead);
  }

  addBulkLeads(leads: Partial<Lead>[], options?: { async?: boolean; originalFileName?: string; setLabel?: string }): Observable<any> {
    return this.api.post('/api/leads/bulk', { leads, ...(options || {}) });
  }

  getEmployeeLeads(companyCode: string, phone: string, setLabel?: string): Observable<any> {
    let url = `/api/leads/employee?companyCode=${encodeURIComponent(companyCode)}&phone=${encodeURIComponent(phone)}`;
    if (setLabel) url += `&setLabel=${encodeURIComponent(setLabel)}`;
    return this.api.get(url);
  }

  getEmployeeLeadPage(companyCode: string, phone: string, query: LeadListQuery = {}): Observable<LeadListResponse> {
    const url = `/api/leads/employee${this.buildQueryString({
      companyCode,
      phone,
      ...query,
    })}`;
    return this.api.get(url);
  }

  getAdminLeads(companyCode: string, setLabel?: string, remark?: string): Observable<any> {
    let url = `/api/leads/admin?companyCode=${encodeURIComponent(companyCode)}`;
    if (setLabel) url += `&setLabel=${encodeURIComponent(setLabel)}`;
    if (remark) url += `&remark=${encodeURIComponent(remark)}`;
    return this.api.get(url);
  }

  getAdminLeadPage(companyCode: string, query: LeadListQuery = {}): Observable<LeadListResponse> {
    const url = `/api/leads/admin${this.buildQueryString({
      companyCode,
      ...query,
    })}`;
    return this.api.get(url);
  }

  getEmployeeLeadCompanies(companyCode: string, phone: string, query: LeadListQuery = {}): Observable<any> {
    const url = `/api/leads/employee/companies${this.buildQueryString({
      companyCode,
      phone,
      ...query,
    })}`;
    return this.api.get(url);
  }

  getAdminLeadCompanies(companyCode: string, query: LeadListQuery = {}): Observable<any> {
    const url = `/api/leads/admin/companies${this.buildQueryString({
      companyCode,
      ...query,
    })}`;
    return this.api.get(url);
  }

  getAdminLeadSets(companyCode: string): Observable<any> {
    return this.api.get(`/api/leads/admin/sets?companyCode=${encodeURIComponent(companyCode)}`);
  }

  getLeadImportBatch(id: string): Observable<any> {
    return this.api.get(`/api/leads/import-batches/${id}`);
  }

  deleteLead(id: string): Observable<any> {
    return this.api.delete(`/api/leads/${id}`);
  }

  deleteLeadSet(companyCode: string, phone: string, setLabel: string): Observable<any> {
    return this.api.post('/api/leads/set/delete', { companyCode, phone, setLabel });
  }

  deleteAdminLeadSet(companyCode: string, setLabel: string): Observable<any> {
    return this.api.post('/api/leads/admin/delete-set', { companyCode, setLabel });
  }

  updateLeadFlags(id: string, flags: { isStarred?: boolean; isFavourite?: boolean }): Observable<any> {
    return this.api.patch(`/api/leads/${id}/flags`, flags);
  }

  updateLeadStatus(id: string, status: string): Observable<any> {
    return this.api.patch(`/api/leads/${id}/status`, { status });
  }

  addLeadRemark(id: string, remark: string): Observable<any> {
    return this.api.post(`/api/leads/${id}/remarks`, { remark });
  }

  deleteLeadRemark(id: string, index: number): Observable<any> {
    return this.api.delete(`/api/leads/${id}/remarks/${index}`);
  }

  getLeadHistory(companyCode: string, companyName?: string, contactNumber?: string): Observable<any> {
    let url = `/api/history?companyCode=${encodeURIComponent(companyCode)}`;
    if (companyName) {
      url += `&companyName=${encodeURIComponent(companyName)}`;
    }
    if (contactNumber) {
      url += `&contactNumber=${encodeURIComponent(contactNumber)}`;
    }
    return this.api.get(url);
  }
}

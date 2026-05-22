import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../api.service';
import { Lead, LeadCompany, LeadHistoryLog } from '../domain/lead.model';
import { LeadListDto, LeadListQueryDto } from './lead.dto';
import { mapLeadDto, mapLeadListDto } from './lead.mapper';

export interface LeadPage {
  items: Lead[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sets: string[];
  divisions: string[];
  companies: LeadCompany[];
}

export interface LeadCompanyPage {
  companies: LeadCompany[];
  contactsByCompany: Record<string, Lead[]>;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface LeadSetPage {
  sets: string[];
  items: Array<{ label: string; count: number }>;
}

export interface LeadDivisionPage {
  divisions: string[];
  items: Array<{ label: string; count: number }>;
}

@Injectable({ providedIn: 'root' })
export class EmployeeLeadsRepository {
  constructor(private api: ApiService) {}

  list(companyCode: string, phone: string, query: LeadListQueryDto): Observable<LeadPage> {
    const url = `/api/leads/employee${this.queryString({ companyCode, phone, ...query })}`;
    return this.api.get<LeadListDto>(url).pipe(map(mapLeadListDto));
  }

  listCompanies(companyCode: string, phone: string, query: LeadListQueryDto): Observable<LeadCompanyPage> {
    const url = `/api/leads/employee/companies${this.queryString({ companyCode, phone, ...query })}`;
    return this.api.get<any>(url).pipe(map((response) => ({
      companies: response?.companies || [],
      contactsByCompany: this.mapContactsByCompany(response?.contactsByCompany),
      page: Number(response?.page || 1),
      pageSize: Number(response?.pageSize || query.pageSize || 20),
      total: Number(response?.total || 0),
      hasMore: !!response?.hasMore,
    })));
  }

  listSets(companyCode: string, phone: string): Observable<LeadSetPage> {
    const url = `/api/leads/employee/sets${this.queryString({ companyCode, phone })}`;
    return this.api.get<any>(url).pipe(map((response) => ({
      sets: Array.isArray(response?.sets) ? response.sets : [],
      items: Array.isArray(response?.items) ? response.items : [],
    })));
  }

  listDivisions(companyCode: string, phone: string): Observable<LeadDivisionPage> {
    const url = `/api/leads/employee/divisions${this.queryString({ companyCode, phone })}`;
    return this.api.get<any>(url).pipe(map((response) => ({
      divisions: Array.isArray(response?.divisions) ? response.divisions : [],
      items: Array.isArray(response?.items) ? response.items : [],
    })));
  }

  updateStatus(leadId: string, status: string): Observable<Lead> {
    return this.api
      .patch<any>(`/api/leads/${leadId}/status`, { status })
      .pipe(map((response) => mapLeadDto(response.lead)));
  }

  updateFlags(leadId: string, flags: { isStarred?: boolean; isFavourite?: boolean }): Observable<Lead> {
    return this.api
      .patch<any>(`/api/leads/${leadId}/flags`, flags)
      .pipe(map((response) => mapLeadDto(response.lead)));
  }

  addRemark(leadId: string, remark: string): Observable<Lead> {
    return this.api
      .post<any>(`/api/leads/${leadId}/remarks`, { remark })
      .pipe(map((response) => mapLeadDto(response.lead)));
  }

  deleteRemark(leadId: string, remarkIndex: number): Observable<Lead> {
    return this.api
      .delete<any>(`/api/leads/${leadId}/remarks/${remarkIndex}`)
      .pipe(map((response) => mapLeadDto(response.lead)));
  }

  history(companyCode: string, companyName: string): Observable<LeadHistoryLog[]> {
    const url = `/api/history${this.queryString({ companyCode, companyName })}`;
    return this.api.get<any>(url).pipe(
      map((response) => Array.isArray(response?.logs) ? response.logs : []),
    );
  }

  private queryString(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      search.set(key, String(value));
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  }

  private mapContactsByCompany(raw: unknown): Record<string, Lead[]> {
    if (!raw || typeof raw !== 'object') return {};
    return Object.entries(raw as Record<string, unknown>).reduce<Record<string, Lead[]>>((mapped, [company, leads]) => {
      mapped[company] = Array.isArray(leads) ? leads.map((lead) => mapLeadDto(lead as any)) : [];
      return mapped;
    }, {});
  }
}

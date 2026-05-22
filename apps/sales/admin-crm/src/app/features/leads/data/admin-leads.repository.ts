import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LeadService } from '../../../services/lead.service';
import { LeadCompany, Lead } from '../domain/lead.model';
import { LeadListDto, LeadListQueryDto } from './lead.dto';
import { mapLeadListDto } from './lead.mapper';

export interface LeadPage {
  items: Lead[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sets: string[];
  companies: LeadCompany[];
}

export interface LeadCompanyPage {
  companies: LeadCompany[];
  contactsByCompany: Record<string, Lead[]>;
}

@Injectable({ providedIn: 'root' })
export class AdminLeadsRepository {
  constructor(private leadService: LeadService) {}

  list(companyCode: string, query: LeadListQueryDto): Observable<LeadPage> {
    return this.leadService
      .getAdminLeadPage(companyCode, query)
      .pipe(map((response) => mapLeadListDto(response as LeadListDto)));
  }

  listCompanies(companyCode: string, query: LeadListQueryDto): Observable<LeadCompanyPage> {
    return this.leadService.getAdminLeadCompanies(companyCode, query).pipe(
      map((response: any) => ({
        companies: response?.companies || [],
        contactsByCompany: this.mapContactsByCompany(response?.contactsByCompany),
      }))
    );
  }

  updateStatus(leadId: string, status: string): Observable<Lead> {
    return this.leadService
      .updateLeadStatus(leadId, status)
      .pipe(map((response: any) => mapLeadListDto({ success: true, items: [response.lead] }).items[0]));
  }

  private mapContactsByCompany(raw: unknown): Record<string, Lead[]> {
    if (!raw || typeof raw !== 'object') return {};
    return Object.entries(raw as Record<string, unknown>).reduce<Record<string, Lead[]>>((mapped, [company, leads]) => {
      mapped[company] = Array.isArray(leads)
        ? mapLeadListDto({ success: true, items: leads as any[] }).items
        : [];
      return mapped;
    }, {});
  }
}

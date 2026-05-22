import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CrmTicketAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface CrmTicketRemark {
  id: string;
  authorRole: 'client' | 'crm';
  authorName: string;
  authorEmail: string;
  message: string;
  attachments: CrmTicketAttachment[];
  createdAt: string;
}

export interface CrmTicket {
  id: string;
  _id?: string;
  companyCode: string;
  clientCompanyName: string;
  clientEmail: string;
  clientContactName: string;
  clientPhone: string;
  subject: string;
  category: 'Bug' | 'Feature Request' | 'Billing' | 'Support' | 'Change Request' | string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  description: string;
  relatedProjectService: string;
  attachments: CrmTicketAttachment[];
  status: 'Open' | 'In Progress' | 'Waiting on Client' | 'Resolved' | 'Closed' | string;
  remarks: CrmTicketRemark[];
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly baseUrl = environment.ticketApiBaseUrl || environment.crmApiBaseUrl;

  constructor(private http: HttpClient) {}

  getCrmTickets(params: {
    companyCode?: string;
    clientCompanyName?: string;
    search?: string;
    status?: string;
    priority?: string;
    category?: string;
  } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/tickets${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  getCrmTicket(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/tickets/${id}`, {
      headers: this.headers(),
    });
  }

  updateCrmTicketStatus(id: string, status: string): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/api/crm/tickets/${id}/status`, { status }, {
      headers: this.headers(),
    });
  }

  addCrmTicketRemark(id: string, message: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/tickets/${id}/remarks`, { message }, {
      headers: this.headers(),
    });
  }

  downloadCrmTicketAttachment(ticketId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/api/crm/tickets/${ticketId}/attachments/${attachmentId}`, {
      headers: this.headers(false),
      responseType: 'blob',
    });
  }

  private headers(json = true): HttpHeaders {
    const token = localStorage.getItem('tracecall_crm_token') || '';
    let headers = new HttpHeaders();
    if (json) headers = headers.set('Content-Type', 'application/json');
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  private query(params: Record<string, unknown>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === 'all') return;
      search.set(key, String(value));
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  }
}

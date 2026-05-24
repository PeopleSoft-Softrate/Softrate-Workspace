import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CrmLoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'crm_admin' | 'project_manager';
    companyName: string;
    companyCode?: string;
    crmCompanyCode?: string;
    salesCompanyCode?: string;
    adminCompanyCode?: string;
    teamSize?: string;
  };
}

export interface CrmClient {
  id: string;
  clientId?: string;
  companyCode: string;
  companyName: string;
  leadCompanyName: string;
  primaryContact: string;
  primaryPhone: string;
  primaryEmail: string;
  description: string;
  status: string;
  contacts: any[];
  contactCount: number;
  managers: string[];
  remarks: string[];
  latestUpdate: string;
  slaStatus: string;
  ndaStatus: string;
  amcStatus: string;
}

export interface CrmAmcRow {
  _id?: string;
  id?: string;
  companyCode?: string;
  clientId?: string;
  clientCompanyName: string;
  domainName?: string;
  hostingerDomainId?: string;
  hostingerStatus?: string;
  hostingerExpiresAt?: string;
  domainPurchaseDate?: string;
  renewalDate?: string;
  annualFee?: number;
  outstandingAmount?: number;
  owner?: string;
  paymentStatus?: 'Paid' | 'Unpaid' | string;
  status?: 'Paid' | 'Upcoming Renewals' | 'Unpaid' | 'Blocked' | 'Not Configured' | string;
  source?: 'manual' | 'hostinger' | string;
  daysUntilRenewal?: number | null;
  canManualBlock?: boolean;
  blocked?: boolean;
  blockedAt?: string;
  blockReason?: string;
}

export interface CrmAmcUpdatePayload {
  companyCode?: string;
  clientId?: string;
  clientCompanyName: string;
  domainName?: string;
  hostingerDomainId?: string;
  domainPurchaseDate?: string;
  renewalDate?: string;
  annualFee?: number;
  outstandingAmount?: number;
  paymentStatus?: 'Paid' | 'Unpaid' | string;
  status?: 'Paid' | 'Unpaid' | 'Blocked' | string;
  owner?: string;
  notes?: string;
  blockClient?: boolean;
  blockReason?: string;
}

export interface CrmHostingerDomain {
  domainName: string;
  hostingerDomainId?: string;
  hostingerStatus?: string;
  domainPurchaseDate?: string;
  hostingerRegisteredAt?: string;
  hostingerCreatedAt?: string;
  hostingerExpiresAt?: string;
  existingMapping?: CrmAmcRow | null;
  suggestions?: Array<{
    clientCompanyName: string;
    clientId?: string;
    companyCode?: string;
    primaryEmail?: string;
    score: number;
  }>;
  detailError?: string;
}

export interface CrmProjectRow {
  _id?: string;
  id?: string;
  companyCode?: string;
  clientId?: string;
  clientCompanyName: string;
  clientStatus?: string;
  projectManagerName?: string;
  projectManagerPhone?: string;
  projectManagerEmail?: string;
  projectManagerRole?: 'project_manager' | string;
  status?: 'Assigned' | 'In Progress' | 'On Hold' | 'Completed' | string;
  notes?: string;
  mappedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly baseUrl = environment.crmApiBaseUrl;

  constructor(private http: HttpClient) {}

  login(payload: { email: string; password: string }): Observable<CrmLoginResponse> {
    return this.http.post<CrmLoginResponse>(`${this.baseUrl}/api/crm/auth/login`, payload, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  getClients(params: { search?: string; companyCode?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/clients${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  updateClient(id: string, payload: Partial<CrmClient>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/api/crm/clients/${encodeURIComponent(id)}`, payload, {
      headers: this.headers(),
    });
  }

  getContracts(type: 'SLA' | 'NDA', params: { companyCode?: string; clientCompanyName?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/contracts${this.query({ ...params, type })}`, {
      headers: this.headers(),
    });
  }

  generateContract(payload: {
    type: 'SLA' | 'NDA';
    companyCode?: string;
    clientCompanyName: string;
    contactName?: string;
    contactEmail?: string;
    clientAddress?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    projectName?: string;
    projectDescription?: string;
    jurisdiction?: string;
    solicitationPeriod?: string;
    validityPeriod?: string;
    terminationNoticeDays?: string;
    noticeReceiptDays?: string;
    signatoryName?: string;
    signatoryTitle?: string;
    clientSignatoryTitle?: string;
    ndaTemplate?: any;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/contracts/generate`, payload, {
      headers: this.headers(),
    });
  }

  getNdaTemplate(params: { companyCode?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/nda-template${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  updateNdaTemplate(payload: { companyCode?: string; ndaTemplate: any }): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/api/crm/nda-template`, payload, {
      headers: this.headers(),
    });
  }

  getContractPdf(contractId: string, params: { companyCode?: string } = {}): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/api/crm/contracts/${encodeURIComponent(contractId)}/pdf${this.query(params)}`, {
      headers: this.headers(),
      responseType: 'blob',
    });
  }

  getAmc(params: { search?: string; companyCode?: string; view?: 'all' | 'paid' | 'unpaid' | 'upcoming' | 'blocked' } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/amc${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  updateAmc(payload: CrmAmcUpdatePayload): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/api/crm/amc`, payload, {
      headers: this.headers(),
    });
  }

  updateAmcStatus(payload: {
    id: string;
    paymentStatus: 'Paid' | 'Unpaid';
    outstandingAmount?: number;
  }): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/api/crm/amc/${payload.id}/status`, payload, {
      headers: this.headers(),
    });
  }

  removeAmcMapping(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/api/crm/amc/${id}`, {
      headers: this.headers(),
    });
  }

  blockAmcDomain(payload: {
    id: string;
    reason?: string;
  }): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/api/crm/amc/${payload.id}/block`, payload, {
      headers: this.headers(),
    });
  }

  getHostingerDomains(params: { companyCode?: string; search?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/amc/hostinger/domains${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  importHostingerDomains(payload: {
    companyCode?: string;
    autoMap?: boolean;
    mappings?: Array<{ domainName: string; clientId?: string; clientCompanyName: string; annualFee?: number; owner?: string }>;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/amc/hostinger/import`, payload, {
      headers: this.headers(),
    });
  }

  getPayments(params: { companyCode?: string; clientCompanyName?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/payments${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  generatePaidInvoice(payload: {
    companyCode?: string;
    clientCompanyName: string;
    amount: number;
    paidAmount?: number;
    paymentMode?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/payments/paid-invoice`, payload, {
      headers: this.headers(),
    });
  }

  getTickets(params: { companyCode?: string; clientCompanyName?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/tickets${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  createTicket(payload: {
    companyCode?: string;
    clientCompanyName: string;
    subject: string;
    query?: string;
    priority?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/tickets`, payload, {
      headers: this.headers(),
    });
  }

  getProjects(params: { companyCode?: string; status?: string } = {}): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/crm/projects${this.query(params)}`, {
      headers: this.headers(),
    });
  }

  mapProject(payload: {
    companyCode?: string;
    clientId: string;
    clientCompanyName: string;
    clientStatus?: string;
    projectManagerName: string;
    projectManagerPhone?: string;
    projectManagerEmail?: string;
    status?: string;
    notes?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/crm/projects/map`, payload, {
      headers: this.headers(),
    });
  }

  updateProjectStatus(payload: {
    id: string;
    status: string;
    notes?: string;
  }): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/api/crm/projects/${payload.id}/status`, payload, {
      headers: this.headers(),
    });
  }

  removeProjectMapping(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/api/crm/projects/${id}`, {
      headers: this.headers(),
    });
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('tracecall_crm_token') || '';
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  private query(params: Record<string, unknown>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        search.set(key, String(value));
      }
    });
    const value = search.toString();
    return value ? `?${value}` : '';
  }
}

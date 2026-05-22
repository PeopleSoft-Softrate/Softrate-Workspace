import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CallStats {
  incoming: number;
  outgoing: number;
  missed: number;
  rejected: number;
  incomingDuration: number;
  outgoingDuration: number;
  totalDuration: number;
  total: number;
  connected: number;
  incomingConnected: number;
  outgoingConnected: number;
}

export interface EmployeeCallStat {
  phone: string;
  name?: string;
  incoming: number;
  outgoing: number;
  missed: number;
  rejected: number;
  totalDuration: number;
  total: number;
  connected: number;
  incomingConnected: number;
  outgoingConnected: number;
}

@Injectable({ providedIn: 'root' })
export class CallLogService {
  constructor(private api: ApiService) {}

  private rangeParams(period: string, from?: string, to?: string): string {
    if (period === 'custom' && from) {
      return `from=${from}${to ? '&to=' + to : ''}`;
    }
    return `period=${period}`;
  }

  getSummary(companyCode: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/summary?companyCode=${encodeURIComponent(companyCode)}&${r}`);
  }

  getEmployeesStats(companyCode: string, period: string, from?: string, to?: string, filters?: any): Observable<any> {
    const r = this.rangeParams(period, from, to);
    let url = `/api/calllogs/employees?companyCode=${encodeURIComponent(companyCode)}&${r}`;
    if (filters) {
      if (filters.callType) url += `&callType=${encodeURIComponent(filters.callType)}`;
      if (filters.duration) url += `&duration=${encodeURIComponent(filters.duration)}`;
      if (filters.callTime) url += `&callTime=${encodeURIComponent(filters.callTime)}`;
    }
    return this.api.get(url);
  }

  getEmployeeStat(companyCode: string, phone: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/employee?companyCode=${encodeURIComponent(companyCode)}&phone=${encodeURIComponent(phone)}&${r}`);
  }

  getCallDetails(companyCode: string, phone: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/details?companyCode=${encodeURIComponent(companyCode)}&phone=${encodeURIComponent(phone)}&${r}`);
  }

  getTimeline(companyCode: string, period: string, from?: string, to?: string): Observable<any> {
    const r = this.rangeParams(period, from, to);
    return this.api.get(`/api/calllogs/timeline?companyCode=${encodeURIComponent(companyCode)}&${r}`);
  }

  getLeadCallCounts(companyCode: string): Observable<any> {
    return this.api.get(`/api/calllogs/lead-counts?companyCode=${encodeURIComponent(companyCode)}`);
  }
}

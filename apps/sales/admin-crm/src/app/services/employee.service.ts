import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Employee {
  _id?: string;
  name: string;
  countryCode?: string;
  mobile: string;
  companyCode: string;
  employeeCode?: string;
  tags?: string[];
  deviceModel?: string;
  appVersion?: string;
  lastCallTime?: string;
  lastSyncTime?: string;
  createdAt?: string;
}

export interface EmployeeResponse {
  success: boolean;
  message?: string;
  employee?: Employee;
  employees?: Employee[];
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  constructor(private api: ApiService) {}

  addEmployee(payload: { name: string; mobile: string; countryCode: string; companyCode: string }): Observable<EmployeeResponse> {
    return this.api.post<EmployeeResponse>('/api/employees', payload);
  }

  getEmployees(companyCode: string): Observable<EmployeeResponse> {
    return this.api.get<EmployeeResponse>(`/api/employees?companyCode=${companyCode}`);
  }

  updateEmployeeTags(employeeId: string, tags: string[], companyCode: string): Observable<EmployeeResponse> {
    return this.api.patch<EmployeeResponse>(`/api/employees/${employeeId}/tags`, { tags, companyCode });
  }

  updateEmployee(employeeId: string, payload: { name: string; mobile: string; countryCode?: string; tags: string[] }): Observable<EmployeeResponse> {
    return this.api.put<EmployeeResponse>(`/api/employees/${employeeId}`, payload);
  }
}

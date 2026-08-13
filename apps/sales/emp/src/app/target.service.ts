import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface EmployeeTargetData {
  employeeId: string;
  employeeName: string;
  targetAmount: number;
  achievedAmount: number;
}

export interface EmployeeMonthlyData {
  month: number;
  targetAmount: number;
  achievedAmount: number;
}

@Injectable({
  providedIn: 'root',
})
export class TargetService {
  private apiUrl = `${environment.apiBaseUrl}/api/targets`;

  constructor(private http: HttpClient) {}

  getAllTargets(companyCode: string, year: number, month: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}?companyCode=${companyCode}&year=${year}&month=${month}`);
  }

  getEmployeeTargets(companyCode: string, employeeId: string, year: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/employee/${employeeId}?companyCode=${companyCode}&year=${year}`);
  }

  setTarget(payload: { companyCode: string; employeeId: string; year: number; month: number; targetAmount: number }): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }
}

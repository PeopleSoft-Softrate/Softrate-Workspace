import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FinanceListResponse, FinanceQuery, FinanceRecord } from '../domain/finance-record.model';

@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  private readonly baseUrl = `${environment.financeApiBaseUrl}/api/finance`;

  constructor(private readonly http: HttpClient) {}

  receivables<T extends FinanceRecord = FinanceRecord>(view: string, query: FinanceQuery): Observable<FinanceListResponse<T>> {
    return this.http.get<FinanceListResponse<T>>(`${this.baseUrl}/receivables/${view}`, {
      params: this.params(query),
    });
  }

  private params(values: FinanceQuery): HttpParams {
    return Object.entries(values || {}).reduce((params, [key, value]) => {
      return value ? params.set(key, String(value)) : params;
    }, new HttpParams());
  }
}

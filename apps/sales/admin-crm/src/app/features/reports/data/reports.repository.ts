import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CallLogService } from '../../../services/calllog.service';
import { HISTORY_PAGE_SIZE } from '../../../core/config/pagination.config';
import { PageResult } from '../../../shared/types/pagination';
import { ReportRow } from '../domain/report.model';

export interface ReportQuery {
  companyCode: string;
  period: string;
  from?: string;
  to?: string;
  filters?: any;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class ReportsRepository {
  constructor(private callLogService: CallLogService) {}

  rows(query: ReportQuery): Observable<PageResult<ReportRow>> {
    const page = query.page || 1;
    const pageSize = query.pageSize || HISTORY_PAGE_SIZE;
    return this.callLogService
      .getEmployeesStats(query.companyCode, query.period, query.from, query.to, query.filters)
      .pipe(map((response: any) => {
        const allRows = (response?.employees || []).map((row: any, index: number) => ({
          id: row.phone || String(index),
          label: row.name || row.phone || 'Employee',
          value: Number(row.total || 0),
          period: query.period,
        }));
        const start = (page - 1) * pageSize;
        const items = allRows.slice(start, start + pageSize);
        return {
          items,
          page,
          pageSize,
          total: allRows.length,
          hasMore: start + pageSize < allRows.length,
        };
      }));
  }
}

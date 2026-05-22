import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { HISTORY_PAGE_SIZE } from '../../../core/config/pagination.config';
import { PageResult } from '../../../shared/types/pagination';
import { QuotationRecord } from '../domain/quotation.model';
import { QuotationDto } from './quotation.dto';
import { mapQuotationDto } from './quotation.mapper';

export interface QuotationHistoryQuery {
  companyCode: string;
  employeePhone?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class QuotationsRepository {
  constructor(private api: ApiService) {}

  history(query: QuotationHistoryQuery): Observable<PageResult<QuotationRecord>> {
    const params = new URLSearchParams();
    Object.entries({
      ...query,
      page: query.page || 1,
      pageSize: query.pageSize || HISTORY_PAGE_SIZE,
      paginated: true,
    }).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });

    return this.api.get<any>(`/api/quotations?${params.toString()}`).pipe(map((response) => ({
      items: (response?.items || response?.quotations || []).map((dto: QuotationDto) => mapQuotationDto(dto)),
      page: Number(response?.page || query.page || 1),
      pageSize: Number(response?.pageSize || query.pageSize || HISTORY_PAGE_SIZE),
      total: Number(response?.total || 0),
      hasMore: !!response?.hasMore,
    })));
  }
}

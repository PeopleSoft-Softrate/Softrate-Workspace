import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../api.service';
import { OPERATIONAL_PAGE_SIZE } from '../../../core/config/pagination.config';
import { PageResult } from '../../../shared/types/pagination';
import { InvoiceRecord } from '../domain/invoice.model';
import { InvoiceDto } from './invoice.dto';
import { mapInvoiceDto } from './invoice.mapper';

export interface InvoiceHistoryQuery {
  companyCode: string;
  employeePhone?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class InvoicesRepository {
  constructor(private api: ApiService) {}

  history(query: InvoiceHistoryQuery): Observable<PageResult<InvoiceRecord>> {
    const params = new URLSearchParams();
    Object.entries({ ...query, page: query.page || 1, pageSize: query.pageSize || OPERATIONAL_PAGE_SIZE, paginated: true })
      .forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });

    return this.api.get<any>(`/api/invoices?${params.toString()}`).pipe(map((response) => ({
      items: (response?.items || response?.invoices || []).map((dto: InvoiceDto) => mapInvoiceDto(dto)),
      page: Number(response?.page || query.page || 1),
      pageSize: Number(response?.pageSize || query.pageSize || OPERATIONAL_PAGE_SIZE),
      total: Number(response?.total || 0),
      hasMore: !!response?.hasMore,
    })));
  }
}

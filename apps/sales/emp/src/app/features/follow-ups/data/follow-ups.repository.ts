import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../api.service';
import { OPERATIONAL_PAGE_SIZE } from '../../../core/config/pagination.config';
import { PageResult } from '../../../shared/types/pagination';
import { FollowUp } from '../domain/follow-up.model';
import { FollowUpDto } from './follow-up.dto';
import { mapFollowUpDto } from './follow-up.mapper';

export interface FollowUpQuery {
  companyCode: string;
  phone: string;
  search?: string;
  filter?: 'all' | 'today' | 'custom';
  reminderDate?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class FollowUpsRepository {
  constructor(private api: ApiService) {}

  listForEmployee(companyCode: string, phone: string): Observable<FollowUp[]> {
    const params = new URLSearchParams({ companyCode, phone });
    return this.api.get<any>(`/api/bookmarks?${params.toString()}`).pipe(
      map((response) => (response?.bookmarks || []).map((dto: FollowUpDto) => mapFollowUpDto(dto)))
    );
  }

  list(query: FollowUpQuery): Observable<PageResult<FollowUp>> {
    const params = new URLSearchParams();
    Object.entries({
      ...query,
      page: query.page || 1,
      pageSize: query.pageSize || OPERATIONAL_PAGE_SIZE,
      paginated: true,
    }).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });

    return this.api.get<any>(`/api/bookmarks?${params.toString()}`).pipe(
      map((response) => {
        const items = (response?.items || response?.bookmarks || []).map((dto: FollowUpDto) => mapFollowUpDto(dto));
        return {
          items,
          page: Number(response?.page || query.page || 1),
          pageSize: Number(response?.pageSize || query.pageSize || OPERATIONAL_PAGE_SIZE),
          total: Number(response?.total || items.length || 0),
          hasMore: typeof response?.hasMore === 'boolean'
            ? response.hasMore
            : (Number(response?.total || items.length || 0) > Number(response?.pageSize || query.pageSize || OPERATIONAL_PAGE_SIZE)),
        };
      }),
    );
  }
}

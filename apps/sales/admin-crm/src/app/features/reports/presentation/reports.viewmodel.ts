import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HISTORY_PAGE_SIZE } from '../../../core/config/pagination.config';
import { ReportRow } from '../domain/report.model';
import { ReportQuery, ReportsRepository } from '../data/reports.repository';

export interface ReportsState {
  rows: ReportRow[];
  period: string;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsViewModel {
  private readonly stateSubject = new BehaviorSubject<ReportsState>({
    rows: [],
    period: 'today',
    page: 1,
    pageSize: HISTORY_PAGE_SIZE,
    total: 0,
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private repository: ReportsRepository) {}

  load(query: ReportQuery): void {
    this.patch({ loading: true, error: '', period: query.period, page: query.page || 1 });
    this.repository.rows(query).subscribe({
      next: (page) => this.patch({
        rows: page.items,
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        loading: false,
      }),
      error: () => this.patch({ loading: false, error: 'Failed to load reports.' }),
    });
  }

  private patch(partial: Partial<ReportsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}

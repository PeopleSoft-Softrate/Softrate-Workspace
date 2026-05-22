import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HISTORY_PAGE_SIZE } from '../../../core/config/pagination.config';
import { ReportRow } from '../domain/report.model';

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
}

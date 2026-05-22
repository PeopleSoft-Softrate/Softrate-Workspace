import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HISTORY_PAGE_SIZE } from '../../../core/config/pagination.config';
import { QuotationRecord } from '../domain/quotation.model';
import { QuotationHistoryQuery, QuotationsRepository } from '../data/quotations.repository';

export interface QuotationsState {
  history: QuotationRecord[];
  search: string;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class QuotationsViewModel {
  private readonly stateSubject = new BehaviorSubject<QuotationsState>({
    history: [],
    search: '',
    page: 1,
    pageSize: HISTORY_PAGE_SIZE,
    total: 0,
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private repository: QuotationsRepository) {}

  load(query: QuotationHistoryQuery): void {
    this.patch({ loading: true, error: '', page: query.page || 1 });
    this.repository.history(query).subscribe({
      next: (page) => this.patch({
        history: page.items,
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        loading: false,
      }),
      error: () => this.patch({ loading: false, error: 'Failed to load quotation history.' }),
    });
  }

  private patch(partial: Partial<QuotationsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}

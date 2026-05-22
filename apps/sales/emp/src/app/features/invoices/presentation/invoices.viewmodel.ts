import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HISTORY_PAGE_SIZE } from '../../../core/config/pagination.config';
import { InvoiceRecord } from '../domain/invoice.model';
import { InvoiceHistoryQuery, InvoicesRepository } from '../data/invoices.repository';

export interface InvoicesState {
  history: InvoiceRecord[];
  search: string;
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class InvoicesViewModel {
  private readonly stateSubject = new BehaviorSubject<InvoicesState>({
    history: [],
    search: '',
    page: 1,
    pageSize: HISTORY_PAGE_SIZE,
    total: 0,
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private repository: InvoicesRepository) {}

  load(query: InvoiceHistoryQuery): void {
    this.patch({ loading: true, error: '', page: query.page || 1 });
    this.repository.history(query).subscribe({
      next: (page) => this.patch({
        history: page.items,
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        loading: false,
      }),
      error: () => this.patch({ loading: false, error: 'Failed to load invoice history.' }),
    });
  }

  private patch(partial: Partial<InvoicesState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}

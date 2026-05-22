import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OPERATIONAL_PAGE_SIZE } from '../../../core/config/pagination.config';
import { FollowUp } from '../domain/follow-up.model';
import { FollowUpsRepository } from '../data/follow-ups.repository';

export interface FollowUpsState {
  items: FollowUp[];
  search: string;
  selectedCompany: string;
  pageSize: number;
  loading: boolean;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class FollowUpsViewModel {
  private readonly stateSubject = new BehaviorSubject<FollowUpsState>({
    items: [],
    search: '',
    selectedCompany: '',
    pageSize: OPERATIONAL_PAGE_SIZE,
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private repository: FollowUpsRepository) {}

  load(companyCode: string): void {
    this.patch({ loading: true, error: '' });
    this.repository.listForCompany(companyCode).subscribe({
      next: (items) => this.patch({ items, loading: false }),
      error: () => this.patch({ loading: false, error: 'Failed to load follow-ups.' }),
    });
  }

  private patch(partial: Partial<FollowUpsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}

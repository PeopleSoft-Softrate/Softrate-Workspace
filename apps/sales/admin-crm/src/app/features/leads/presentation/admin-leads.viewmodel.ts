import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, catchError, debounceTime, distinctUntilChanged, from, mergeMap, of, switchMap, tap } from 'rxjs';
import { OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../../core/config/pagination.config';
import { Lead, LeadCompany } from '../domain/lead.model';
import { AdminLeadsRepository } from '../data/admin-leads.repository';
import { LeadListQueryDto } from '../data/lead.dto';

export interface AdminLeadsState {
  companies: LeadCompany[];
  leads: Lead[];
  selectedCompany: string;
  search: string;
  status: string;
  setLabel: string;
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  empty: boolean;
  error: string;
}

const initialState: AdminLeadsState = {
  companies: [],
  leads: [],
  selectedCompany: '',
  search: '',
  status: '',
  setLabel: '',
  page: 1,
  hasMore: false,
  loading: false,
  loadingMore: false,
  empty: false,
  error: '',
};

@Injectable({ providedIn: 'root' })
export class AdminLeadsViewModel {
  private readonly stateSubject = new BehaviorSubject<AdminLeadsState>(initialState);
  readonly state$ = this.stateSubject.asObservable();
  private readonly searchSubject = new Subject<string>();
  private companyCode = '';
  private requestRun = 0;
  private readonly contactHydrationConcurrency = 12;

  constructor(private repository: AdminLeadsRepository) {
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      tap((search) => this.patch({ search })),
      switchMap(() => this.reloadCompaniesAndLeads())
    ).subscribe();
  }

  init(companyCode: string): void {
    this.companyCode = companyCode;
    this.reloadCompaniesAndLeads().subscribe();
  }

  setSearch(search: string): void {
    this.searchSubject.next(search.trim());
  }

  setFilter(filter: Pick<AdminLeadsState, 'status' | 'setLabel'>): void {
    this.patch({ ...filter });
    this.reloadCompaniesAndLeads().subscribe();
  }

  selectCompany(name: string): void {
    this.patch({ selectedCompany: name, leads: [], page: 1, hasMore: false });
    this.loadLeads(false).subscribe();
  }

  loadNextCompanyPage(): void {
    const state = this.stateSubject.value;
    if (state.loadingMore || !state.hasMore) return;
    this.loadLeads(true).subscribe();
  }

  updateStatus(lead: Lead, status: string): void {
    if (!lead.id) return;
    this.repository.updateStatus(lead.id, status).subscribe({
      next: (updated) => {
        const leads = this.stateSubject.value.leads.map((item) => item.id === lead.id ? updated : item);
        this.patch({ leads });
      },
      error: () => this.patch({ error: 'Failed to update lead status.' }),
    });
  }

  private reloadCompaniesAndLeads() {
    this.patch({ loading: true, error: '', page: 1, leads: [], hasMore: false });
    const run = ++this.requestRun;
    return this.repository.listCompanies(this.companyCode, this.queryFor(1, false)).pipe(
      tap({
        next: (result) => {
          if (run !== this.requestRun) return;
          const selectedCompany = result.companies[0]?.name || '';
          const hydratedLeads = this.flattenContactsByCompany(result.contactsByCompany);
          this.patch({
            companies: result.companies,
            selectedCompany,
            leads: hydratedLeads,
            page: 1,
            hasMore: false,
            loading: false,
            empty: !hydratedLeads.length,
          });
          if (!hydratedLeads.length) {
            this.hydrateCompanyContacts(result.companies, run, true);
          }
        },
        error: () => this.patch({ loading: false, error: 'Failed to load lead companies.' }),
      })
    );
  }

  private loadLeads(append: boolean, run = ++this.requestRun) {
    const state = this.stateSubject.value;
    const page = append ? state.page + 1 : 1;
    this.patch(append ? { loadingMore: true } : { loading: true, error: '' });

    return this.repository.list(this.companyCode, this.queryFor(page)).pipe(
      tap({
        next: (result) => {
          if (run !== this.requestRun) return;
          const selectedCompany = this.stateSubject.value.selectedCompany;
          const currentLeads = this.stateSubject.value.leads;
          const selectedLeads = append
            ? [
                ...currentLeads.filter((lead) => lead.companyName === selectedCompany),
                ...result.items,
              ]
            : result.items;
          const leads = selectedCompany
            ? this.mergeLeadItems(
                currentLeads.filter((lead) => lead.companyName !== selectedCompany),
                selectedLeads,
              )
            : (append ? [...currentLeads, ...result.items] : result.items);
          this.patch({
            leads,
            page: result.page,
            hasMore: result.hasMore,
            loading: false,
            loadingMore: false,
            empty: !leads.length,
          });
        },
        error: () => this.patch({ loading: false, loadingMore: false, error: 'Failed to load leads.' }),
      })
    );
  }

  private hydrateCompanyContacts(companies: LeadCompany[], run: number, replaceExisting: boolean): void {
    const selectedCompany = this.stateSubject.value.selectedCompany;
    const orderedCompanies = [
      ...companies.filter((company) => company.name === selectedCompany),
      ...companies.filter((company) => company.name !== selectedCompany),
    ].filter((company) => !!company.name);

    if (!orderedCompanies.length) {
      this.patch({ loading: false, empty: true });
      return;
    }

    if (replaceExisting) {
      this.patch({ leads: [], page: 1, hasMore: false, loading: true, empty: false });
    }

    from(orderedCompanies).pipe(
      mergeMap((company) => (
        this.repository.list(this.companyCode, this.queryForCompany(1, company.name)).pipe(
          catchError(() => of({
            items: [],
            page: 1,
            pageSize: OPERATIONAL_PAGE_SIZE,
            total: 0,
            hasMore: false,
            sets: [],
            companies: [],
          }))
        )
      ), this.contactHydrationConcurrency),
    ).subscribe({
      next: (result) => {
        if (run !== this.requestRun) return;
        const currentLeads = this.stateSubject.value.leads;
        const leads = this.mergeLeadItems(currentLeads, result.items);
        const selectedResult = result.items[0]?.companyName === selectedCompany;
        this.patch({
          leads,
          page: selectedResult ? result.page : this.stateSubject.value.page,
          hasMore: selectedResult ? result.hasMore : this.stateSubject.value.hasMore,
          loading: selectedResult ? false : this.stateSubject.value.loading,
          empty: !leads.length,
        });
      },
      complete: () => {
        if (run !== this.requestRun) return;
        this.patch({ loading: false, empty: !this.stateSubject.value.leads.length });
      },
    });
  }

  private queryFor(page: number, includeCompany = true): LeadListQueryDto {
    const state = this.stateSubject.value;
    return {
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      includeFacets: page === 1,
      includeContacts: !includeCompany && page === 1 ? 'true' : undefined,
      contactPageSize: !includeCompany && page === 1 ? OPERATIONAL_PAGE_SIZE : undefined,
      search: state.search,
      status: state.status,
      setLabel: state.setLabel,
      company: includeCompany ? state.selectedCompany : '',
    } as LeadListQueryDto;
  }

  private queryForCompany(page: number, company: string): LeadListQueryDto {
    return {
      ...this.queryFor(page, false),
      company,
      includeFacets: false,
    } as LeadListQueryDto;
  }

  private mergeLeadItems(existing: Lead[], incoming: Lead[]): Lead[] {
    const incomingCompanies = new Set(incoming.map((lead) => lead.companyName).filter(Boolean));
    const incomingIds = new Set(incoming.map((lead) => lead.id).filter(Boolean));
    const retained = existing.filter((lead) => {
      if (incomingIds.has(lead.id)) return false;
      return !incomingCompanies.has(lead.companyName);
    });
    return [...retained, ...incoming];
  }

  private flattenContactsByCompany(contactsByCompany: Record<string, Lead[]> | undefined): Lead[] {
    if (!contactsByCompany) return [];
    return Object.values(contactsByCompany).flat();
  }

  private patch(partial: Partial<AdminLeadsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}

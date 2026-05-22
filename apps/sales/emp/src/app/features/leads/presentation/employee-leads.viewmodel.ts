import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, catchError, firstValueFrom, forkJoin, from, mergeMap, Observable, of, switchMap, tap, debounceTime, distinctUntilChanged } from 'rxjs';
import { OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../../core/config/pagination.config';
import { DashboardCacheService } from '../../../core/cache/dashboard-cache.service';
import { Lead, LeadCompany, LeadDrawerSection, LeadHistoryLog } from '../domain/lead.model';
import { EmployeeLeadsRepository, LeadPage } from '../data/employee-leads.repository';
import { LeadListQueryDto } from '../data/lead.dto';

export interface EmployeeLeadsState {
  companies: LeadCompany[];
  leads: Lead[];
  sets: string[];
  divisions: string[];
  selectedCompany: string;
  selectedLeadId: string;
  drawerSection: LeadDrawerSection;
  historyLogs: LeadHistoryLog[];
  historyLoading: boolean;
  historyLeadId: string;
  search: string;
  status: string;
  statuses: string;
  isFavourite: boolean;
  updatedFrom: string;
  updatedTo: string;
  setLabel: string;
  division: string;
  page: number;
  hasMore: boolean;
  companyTotal: number;
  companyHasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  companyLoadingMore: boolean;
  empty: boolean;
  error: string;
}

const initialState: EmployeeLeadsState = {
  companies: [],
  leads: [],
  sets: [],
  divisions: [],
  selectedCompany: '',
  selectedLeadId: '',
  drawerSection: 'details',
  historyLogs: [],
  historyLoading: false,
  historyLeadId: '',
  search: '',
  status: '',
  statuses: '',
  isFavourite: false,
  updatedFrom: '',
  updatedTo: '',
  setLabel: '',
  division: '',
  page: 1,
  hasMore: false,
  companyTotal: 0,
  companyHasMore: false,
  loading: false,
  loadingMore: false,
  companyLoadingMore: false,
  empty: false,
  error: '',
};

interface LeadPageCacheEntry {
  savedAt: number;
  expiresAt: number;
  value: LeadPage;
}

interface LeadSectionCacheEntry {
  companyPage: number;
  savedAt: number;
  expiresAt: number;
  state: EmployeeLeadsState;
}

interface LeadRestoreResult {
  restored: boolean;
  refreshDue: boolean;
}

type LeadScopeFilter = Partial<Pick<EmployeeLeadsState, 'search' | 'status' | 'statuses' | 'isFavourite' | 'updatedFrom' | 'updatedTo' | 'setLabel' | 'division'>>;

@Injectable({ providedIn: 'root' })
export class EmployeeLeadsViewModel {
  private readonly stateSubject = new BehaviorSubject<EmployeeLeadsState>(initialState);
  readonly state$ = this.stateSubject.asObservable();
  private readonly searchSubject = new Subject<string>();
  private companyCode = '';
  private phone = '';
  private requestRun = 0;
  private activeScopeLoadSub?: Subscription;
  private companyPage = 1;
  private readonly contactHydrationConcurrency = 12;
  private readonly leadPageCacheTtlMs = 24 * 60 * 60 * 1000;
  private readonly leadPageRefreshAfterMs = 5 * 60 * 1000;
  private readonly persistentLeadPagePrefix = 'lead-page:v3|';
  private readonly persistentLeadSectionPrefix = 'lead-section:v3|';
  private readonly leadPageCache = new Map<string, LeadPageCacheEntry>();
  private readonly leadSectionCache = new Map<string, LeadSectionCacheEntry>();

  constructor(
    private repository: EmployeeLeadsRepository,
    private dashboardCache: DashboardCacheService,
  ) {
    this.searchSubject.pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      tap((search) => this.patch({ search })),
      switchMap(() => this.reloadCompaniesAndLeads())
    ).subscribe();
  }

  init(companyCode: string, phone: string): void {
    this.companyCode = companyCode;
    this.phone = phone;
    const restored = this.restoreStateIfCached(this.stateSubject.value, true);
    if (!restored.restored || restored.refreshDue) {
      this.reloadCompaniesAndLeads({
        allowCachedRestore: !restored.restored,
        silent: restored.restored,
        forceRefresh: restored.refreshDue,
      }).subscribe();
    }
  }

  loadScope(
    companyCode: string,
    phone: string,
    filter: LeadScopeFilter,
    options: { forceRefresh?: boolean } = {},
  ): void {
    this.cacheCurrentSection();
    this.companyCode = companyCode;
    this.phone = phone;
    const nextState = this.scopeState(filter);
    const restored = options.forceRefresh
      ? { restored: false, refreshDue: false }
      : this.restoreScopeIfCached(companyCode, phone, filter);
    if (!restored.restored || options.forceRefresh) {
      this.stateSubject.next(nextState);
    }
    if (!restored.restored || restored.refreshDue || options.forceRefresh) {
      this.activeScopeLoadSub?.unsubscribe();
      this.activeScopeLoadSub = this.reloadCompaniesAndLeads({
        allowCachedRestore: !restored.restored,
        silent: restored.restored,
        forceRefresh: restored.refreshDue || options.forceRefresh,
      }).subscribe();
    }
  }

  reset(): void {
    this.requestRun += 1;
    this.activeScopeLoadSub?.unsubscribe();
    this.activeScopeLoadSub = undefined;
    this.companyCode = '';
    this.phone = '';
    this.companyPage = 1;
    this.clearCache();
    this.stateSubject.next(initialState);
  }

  clearCache(): void {
    this.leadPageCache.clear();
    this.leadSectionCache.clear();
    this.dashboardCache.invalidate((key) => (
      key.startsWith(this.persistentLeadPagePrefix) || key.startsWith(this.persistentLeadSectionPrefix)
    ));
  }

  get snapshot(): EmployeeLeadsState {
    return this.stateSubject.value;
  }

  setSearch(search: string): void {
    this.searchSubject.next(search.trim());
  }

  setFilter(filter: LeadScopeFilter): void {
    this.cacheCurrentSection();
    this.patch({ ...filter });
    const restored = this.restoreStateIfCached(this.stateSubject.value, false);
    if (!restored.restored || restored.refreshDue) {
      this.reloadCompaniesAndLeads({
        allowCachedRestore: !restored.restored,
        silent: restored.restored,
        forceRefresh: restored.refreshDue,
      }).subscribe();
    }
  }

  setScope(filter: LeadScopeFilter): void {
    this.cacheCurrentSection();
    const nextState = this.scopeState(filter);
    const restored = this.restoreStateIfCached(nextState, true);
    if (!restored.restored) {
      this.stateSubject.next(nextState);
    }
    if (!restored.restored || restored.refreshDue) {
      this.reloadCompaniesAndLeads({
        allowCachedRestore: !restored.restored,
        silent: restored.restored,
        forceRefresh: restored.refreshDue,
      }).subscribe();
    }
  }

  hasCachedScope(companyCode: string, phone: string, filter: LeadScopeFilter): boolean {
    const previousCompanyCode = this.companyCode;
    const previousPhone = this.phone;
    this.companyCode = companyCode;
    this.phone = phone;
    const cached = this.getCachedSection(this.scopeState(filter));
    this.companyCode = previousCompanyCode;
    this.phone = previousPhone;
    return !!cached;
  }

  restoreScopeIfCached(companyCode: string, phone: string, filter: LeadScopeFilter): LeadRestoreResult {
    this.companyCode = companyCode;
    this.phone = phone;
    return this.restoreStateIfCached(this.scopeState(filter), true);
  }

  async prefetchScopes(companyCode: string, phone: string, filters: LeadScopeFilter[]): Promise<void> {
    if (!companyCode || !phone || !filters.length) return;
    this.companyCode = companyCode;
    this.phone = phone;

    for (const filter of filters) {
      await this.prefetchScope(filter);
    }
  }

  async getSetLabels(companyCode: string, phone: string): Promise<string[]> {
    if (!companyCode || !phone) return [];
    this.companyCode = companyCode;
    this.phone = phone;
    const cachedSets = this.stateSubject.value.sets;
    if (cachedSets.length) return cachedSets;

    try {
      const result = await firstValueFrom(this.repository.listSets(companyCode, phone));
      this.patch({ sets: result.sets });
      return result.sets;
    } catch {
      return [];
    }
  }

  async getLeadDivisions(companyCode: string, phone: string): Promise<string[]> {
    if (!companyCode || !phone) return [];
    this.companyCode = companyCode;
    this.phone = phone;
    const cachedDivisions = this.stateSubject.value.divisions;
    if (cachedDivisions.length) return cachedDivisions;

    try {
      const result = await firstValueFrom(this.repository.listDivisions(companyCode, phone));
      this.patch({ divisions: result.divisions });
      return result.divisions;
    } catch {
      return [];
    }
  }

  selectCompany(name: string): void {
    const cached = this.getCachedLeadPageEntry(this.queryForCompany(1, name));
    if (cached) {
      const leads = this.mergeLeadItems(this.stateSubject.value.leads, cached.value.items);
      this.patch({
        selectedCompany: name,
        selectedLeadId: '',
        leads,
        page: cached.value.page,
        hasMore: cached.value.hasMore,
        loading: false,
        empty: !leads.length,
      });
      this.cacheCurrentSection();
      this.patch({ selectedCompany: name, selectedLeadId: '' });
      if (this.isRefreshDue(cached)) {
        this.loadLeads(false, ++this.requestRun, { skipCache: true, silent: true }).subscribe();
      }
      return;
    }

    this.patch({ selectedCompany: name, selectedLeadId: '', page: 1, hasMore: false });
    this.loadLeads(false).subscribe();
  }

  selectLead(leadId: string): void {
    this.patch({ selectedLeadId: leadId, drawerSection: 'details' });
  }

  clearSelectedLead(): void {
    this.patch({ selectedLeadId: '', drawerSection: 'details', historyLogs: [], historyLoading: false, historyLeadId: '' });
  }

  openDetails(lead: Lead): void {
    if (!lead.id) return;
    this.patch({ selectedLeadId: lead.id, drawerSection: 'details' });
  }

  openAi(lead: Lead): void {
    if (!lead.id) return;
    this.patch({ selectedLeadId: lead.id, drawerSection: 'ai' });
  }

  openHistory(lead: Lead): void {
    if (!lead.id) return;
    this.patch({
      selectedLeadId: lead.id,
      drawerSection: 'history',
      historyLogs: [],
      historyLoading: true,
      historyLeadId: lead.id,
    });
    this.repository.history(lead.companyCode, lead.companyName).subscribe({
      next: (logs) => {
        this.patch({
          historyLoading: false,
          historyLogs: this.historyWithLegacyFallbacks(logs, lead),
        });
      },
      error: () => this.patch({ historyLoading: false }),
    });
  }

  loadNextCompanyPage(): void {
    const state = this.stateSubject.value;
    if (state.companyLoadingMore || !state.companyHasMore) return;
    this.patch({ companyLoadingMore: true });
    this.companyPage += 1;
    this.repository.listCompanies(this.companyCode, this.phone, this.queryFor(this.companyPage, false)).subscribe({
      next: (result) => {
        if (this.companyPage !== result.page) this.companyPage = result.page;
        const hydratedLeads = this.flattenContactsByCompany(result.contactsByCompany);
        this.cacheContactsByCompany(result.contactsByCompany, result.companies);
        const missingHydrationCompanies = this.companiesMissingHydratedContacts(
          result.companies,
          result.contactsByCompany,
        );
        this.patch({
          companyLoadingMore: false,
          companyTotal: result.total,
          companyHasMore: result.hasMore,
          companies: this.mergeCompanies(this.stateSubject.value.companies, result.companies),
          leads: this.mergeLeadItems(this.stateSubject.value.leads, hydratedLeads),
        });
        if (missingHydrationCompanies.length) {
          this.hydrateCompanyContacts(missingHydrationCompanies, this.requestRun, false);
        } else {
          this.cacheCurrentSection();
        }
      },
      error: () => {
        this.patch({ companyLoadingMore: false, error: 'Failed to load more companies.' });
      },
    });
  }

  loadNextContactPage(): void {
    const state = this.stateSubject.value;
    if (state.loadingMore || !state.hasMore) return;
    this.loadLeads(true).subscribe();
  }

  updateStatus(lead: Lead, status: string): void {
    if (!lead.id) return;
    this.repository.updateStatus(lead.id, status).subscribe({
      next: (updated) => this.replaceLead(updated),
      error: () => this.patch({ error: 'Failed to update lead status.' }),
    });
  }

  toggleFavourite(lead: Lead): void {
    if (!lead.id) return;
    this.repository.updateFlags(lead.id, { isFavourite: !lead.isFavourite }).subscribe({
      next: (updated) => this.replaceLead(updated),
      error: () => this.patch({ error: 'Failed to update favourite.' }),
    });
  }

  toggleStar(lead: Lead): void {
    if (!lead.id) return;
    this.repository.updateFlags(lead.id, { isStarred: !lead.isStarred }).subscribe({
      next: (updated) => this.replaceLead(updated),
      error: () => this.patch({ error: 'Failed to update star.' }),
    });
  }

  addRemark(lead: Lead, remark: string): void {
    if (!lead.id || !remark.trim()) return;
    this.repository.addRemark(lead.id, remark.trim()).subscribe({
      next: (updated) => this.replaceLead(updated),
      error: () => this.patch({ error: 'Failed to add remark.' }),
    });
  }

  deleteRemark(lead: Lead, remarkIndex: number): void {
    if (!lead.id || remarkIndex < 0) return;
    this.repository.deleteRemark(lead.id, remarkIndex).subscribe({
      next: (updated) => this.replaceLead(updated),
      error: () => this.patch({ error: 'Failed to delete remark.' }),
    });
  }

  reloadCompaniesAndLeads(options: { allowCachedRestore?: boolean; silent?: boolean; forceRefresh?: boolean } = {}): Observable<unknown> {
    const restored = options.allowCachedRestore
      ? this.restoreStateIfCached(this.stateSubject.value, true)
      : { restored: false, refreshDue: false };
    if (restored.restored && !options.forceRefresh && !restored.refreshDue) {
      return of(this.stateSubject.value);
    }
    const silent = !!options.silent || restored.restored;
    if (silent) {
      this.patch({ error: '' });
    } else {
      this.patch({ loading: true, error: '', page: 1, leads: [], hasMore: false });
    }
    const run = ++this.requestRun;
    this.companyPage = 1;
    const currentSets = this.stateSubject.value.sets;
    const currentDivisions = this.stateSubject.value.divisions;
    const sets$ = this.stateSubject.value.search && currentSets.length
      ? of({ sets: currentSets, items: [] })
      : this.repository.listSets(this.companyCode, this.phone);
    const divisions$ = this.stateSubject.value.search && currentDivisions.length
      ? of({ divisions: currentDivisions, items: [] })
      : this.repository.listDivisions(this.companyCode, this.phone);
    return forkJoin({
      sets: sets$,
      divisions: divisions$,
      companies: this.repository.listCompanies(this.companyCode, this.phone, this.queryFor(1, false)),
    }).pipe(
      tap({
        next: (result) => {
          if (run !== this.requestRun) return;
          const previousState = this.stateSubject.value;
          const selectedCompany = this.resolveSelectedCompany(previousState.selectedCompany, result.companies.companies);
          const hydratedLeads = this.flattenContactsByCompany(result.companies.contactsByCompany);
          this.cacheContactsByCompany(result.companies.contactsByCompany, result.companies.companies);
          const missingHydrationCompanies = this.companiesMissingHydratedContacts(
            result.companies.companies,
            result.companies.contactsByCompany,
          );
          const selectedCompanyLeads = hydratedLeads.filter((lead) => lead.companyName === selectedCompany);
          const selectedCompanyCount = result.companies.companies.find((company) => company.name === selectedCompany)?.count || 0;
          this.patch({
            sets: result.sets.sets,
            divisions: result.divisions.divisions,
            companies: result.companies.companies,
            companyTotal: result.companies.total,
            companyHasMore: result.companies.hasMore,
            companyLoadingMore: false,
            selectedCompany,
            leads: hydratedLeads,
            page: 1,
            hasMore: selectedCompanyLeads.length
              ? selectedCompanyLeads.length < selectedCompanyCount
              : false,
            loading: missingHydrationCompanies.length > 0 && !silent,
            empty: !hydratedLeads.length && !missingHydrationCompanies.length,
          });
          if (missingHydrationCompanies.length) {
            this.hydrateCompanyContacts(missingHydrationCompanies, run, !silent);
          } else {
            this.cacheCurrentSection();
          }
        },
        error: () => this.patch({ loading: false, error: 'Failed to load lead companies.' }),
      })
    );
  }

  private loadLeads(
    append: boolean,
    run = ++this.requestRun,
    options: { skipCache?: boolean; silent?: boolean } = {},
  ) {
    const state = this.stateSubject.value;
    const page = append ? state.page + 1 : 1;
    const query = this.queryFor(page);
    const cached = options.skipCache ? null : this.getCachedLeadPageEntry(query);
    if (cached) {
      this.applyLeadPage(cached.value, append);
      if (!this.isRefreshDue(cached)) {
        return of(cached.value);
      }
      options = { ...options, skipCache: true, silent: true };
    }

    if (append) {
      this.patch({ loadingMore: true });
    } else if (options.silent) {
      this.patch({ error: '' });
    } else {
      this.patch({ loading: true, error: '' });
    }

    return this.repository.list(this.companyCode, this.phone, query).pipe(
      tap({
        next: (result) => {
          if (run !== this.requestRun) return;
          this.setCachedLeadPage(query, result);
          this.applyLeadPage(result, append);
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
        this.repository.list(this.companyCode, this.phone, this.queryForCompany(1, company.name)).pipe(
          catchError(() => of({
            items: [],
            page: 1,
            pageSize: OPERATIONAL_PAGE_SIZE,
            total: 0,
            hasMore: false,
            sets: [],
            divisions: [],
            companies: [],
          }))
        )
      ), this.contactHydrationConcurrency),
    ).subscribe({
      next: (result) => {
        if (run !== this.requestRun) return;
        this.setCachedLeadPage(this.queryForCompany(result.page, result.items[0]?.companyName || ''), result);
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
        this.cacheCurrentSection();
      },
      complete: () => {
        if (run !== this.requestRun) return;
        this.patch({ loading: false, empty: !this.stateSubject.value.leads.length });
        this.cacheCurrentSection();
      },
      error: () => {
        if (run !== this.requestRun) return;
        this.patch({ loading: false, error: 'Failed to hydrate lead contacts.' });
      },
    });
  }

  private async prefetchScope(filter: LeadScopeFilter): Promise<void> {
    const state = this.scopeState(filter);
    const cached = this.getCachedSection(state);
    if (cached && !this.isRefreshDue(cached)) return;

    try {
      const result = await firstValueFrom(forkJoin({
        sets: this.repository.listSets(this.companyCode, this.phone),
        divisions: this.repository.listDivisions(this.companyCode, this.phone),
        companies: this.repository.listCompanies(this.companyCode, this.phone, this.queryForState(state, 1, false)),
      }));
      const selectedCompany = result.companies.companies[0]?.name || '';
      const hydratedLeads = this.flattenContactsByCompany(result.companies.contactsByCompany);
      this.cacheContactsByCompany(result.companies.contactsByCompany, result.companies.companies, state);
      const missingHydrationCompanies = this.companiesMissingHydratedContacts(
        result.companies.companies,
        result.companies.contactsByCompany,
      );
      const prefetchedLeads = missingHydrationCompanies.length
        ? await this.prefetchCompanyContactsForScope(state, missingHydrationCompanies, true)
        : [];
      const leads = this.mergeLeadItems(hydratedLeads, prefetchedLeads);
      const selectedCompanyLeads = leads.filter((lead) => lead.companyName === selectedCompany);
      const selectedCompanyCount = result.companies.companies.find((company) => company.name === selectedCompany)?.count || 0;
      this.cacheSectionState({
        ...state,
        sets: result.sets.sets,
        divisions: result.divisions.divisions,
        companies: result.companies.companies,
        companyTotal: result.companies.total,
        companyHasMore: result.companies.hasMore,
        selectedCompany,
        leads,
        page: 1,
        hasMore: selectedCompanyLeads.length
          ? selectedCompanyLeads.length < selectedCompanyCount
          : false,
        loading: false,
        loadingMore: false,
        companyLoadingMore: false,
        empty: !leads.length,
        error: '',
      }, 1);
    } catch {
      // Warmup is opportunistic; visible loads still handle errors normally.
    }
  }

  private async prefetchCompanyContacts(state: EmployeeLeadsState, company: string, refreshStale = false): Promise<LeadPage | null> {
    const query = this.queryForCompanyState(state, 1, company);
    const cached = this.getCachedLeadPageEntry(query);
    if (cached && (!refreshStale || !this.isRefreshDue(cached))) return cached.value;

    try {
      const result = await firstValueFrom(this.repository.list(this.companyCode, this.phone, query));
      this.setCachedLeadPage(query, result);
      return result;
    } catch {
      return null;
    }
  }

  private async prefetchCompanyContactsForScope(state: EmployeeLeadsState, companies: LeadCompany[], refreshStale = false): Promise<Lead[]> {
    const names = companies.map((company) => company.name).filter(Boolean);
    const leads: Lead[] = [];

    for (let index = 0; index < names.length; index += this.contactHydrationConcurrency) {
      const batch = names.slice(index, index + this.contactHydrationConcurrency);
      const pages = await Promise.all(batch.map((name) => this.prefetchCompanyContacts(state, name, refreshStale)));
      for (const page of pages) {
        if (page?.items.length) {
          leads.push(...page.items);
        }
      }
    }

    return leads;
  }

  private queryFor(page: number, includeCompany = true): LeadListQueryDto {
    return this.queryForState(this.stateSubject.value, page, includeCompany);
  }

  private queryForState(state: EmployeeLeadsState, page: number, includeCompany = true): LeadListQueryDto {
    const includeCompanyContacts = !includeCompany;
    return {
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      includeFacets: page === 1,
      includeContacts: includeCompanyContacts ? 'true' : undefined,
      contactPageSize: includeCompanyContacts ? OPERATIONAL_PAGE_SIZE : undefined,
      search: state.search,
      searchMode: state.search ? 'quick' : undefined,
      status: state.status,
      statuses: state.statuses,
      isFavourite: state.isFavourite || undefined,
      updatedFrom: state.updatedFrom,
      updatedTo: state.updatedTo,
      setLabel: state.setLabel,
      division: state.division,
      company: includeCompany ? state.selectedCompany : '',
    };
  }

  private queryForCompany(page: number, company: string): LeadListQueryDto {
    return this.queryForCompanyState(this.stateSubject.value, page, company);
  }

  private queryForCompanyState(state: EmployeeLeadsState, page: number, company: string): LeadListQueryDto {
    return {
      ...this.queryForState(state, page, false),
      company,
      includeFacets: false,
    };
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

  private mergeCompanies(existing: LeadCompany[], incoming: LeadCompany[]): LeadCompany[] {
    const byName = new Map(existing.map((company) => [company.name, company]));
    for (const company of incoming) {
      byName.set(company.name, company);
    }
    return Array.from(byName.values());
  }

  private flattenContactsByCompany(contactsByCompany: Record<string, Lead[]> | undefined): Lead[] {
    if (!contactsByCompany) return [];
    return Object.values(contactsByCompany).flat();
  }

  private companiesMissingHydratedContacts(companies: LeadCompany[], contactsByCompany: Record<string, Lead[]> | undefined): LeadCompany[] {
    return companies.filter((company) => (
      company.count > 0 && !(contactsByCompany?.[company.name]?.length)
    ));
  }

  private applyLeadPage(result: LeadPage, append: boolean): void {
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
    this.cacheCurrentSection();
  }

  private cacheContactsByCompany(contactsByCompany: Record<string, Lead[]> | undefined, companies: LeadCompany[], state = this.stateSubject.value): void {
    if (!contactsByCompany) return;
    const countsByCompany = new Map(companies.map((company) => [company.name, company.count]));
    for (const [companyName, contacts] of Object.entries(contactsByCompany)) {
      if (!companyName || !contacts.length) continue;
      const total = countsByCompany.get(companyName) || contacts.length;
      this.setCachedLeadPage(this.queryForCompanyState(state, 1, companyName), {
        items: contacts,
        page: 1,
        pageSize: OPERATIONAL_PAGE_SIZE,
        total,
        hasMore: contacts.length < total,
        sets: [],
        divisions: [],
        companies: [],
      });
    }
  }

  private leadPageCacheKey(query: LeadListQueryDto): string {
    return JSON.stringify({
      companyCode: this.companyCode,
      phone: this.phone,
      page: query.page || 1,
      pageSize: query.pageSize || OPERATIONAL_PAGE_SIZE,
      search: query.search || '',
      status: query.status || '',
      statuses: query.statuses || '',
      isFavourite: query.isFavourite || '',
      updatedFrom: query.updatedFrom || '',
      updatedTo: query.updatedTo || '',
      setLabel: query.setLabel || '',
      division: query.division || '',
      company: query.company || '',
      sort: query.sort || '',
    });
  }

  private getCachedLeadPage(query: LeadListQueryDto): LeadPage | null {
    return this.getCachedLeadPageEntry(query)?.value || null;
  }

  private getCachedLeadPageEntry(query: LeadListQueryDto): LeadPageCacheEntry | null {
    const key = this.leadPageCacheKey(query);
    const cached = this.leadPageCache.get(key);
    if (cached) {
      if (cached.expiresAt <= Date.now()) {
        this.leadPageCache.delete(key);
        this.dashboardCache.invalidate(`${this.persistentLeadPagePrefix}${key}`);
        return null;
      }
      return cached;
    }

    const persisted = this.dashboardCache.getEntry<LeadPage>(`${this.persistentLeadPagePrefix}${key}`);
    if (!persisted) return null;
    const entry: LeadPageCacheEntry = {
      savedAt: persisted.savedAt,
      expiresAt: persisted.expiresAt,
      value: persisted.data,
    };
    this.leadPageCache.set(key, entry);
    return entry;
  }

  private setCachedLeadPage(query: LeadListQueryDto, value: LeadPage): void {
    if (!query.company || !value.items.length) return;
    const key = this.leadPageCacheKey(query);
    const savedAt = Date.now();
    const entry: LeadPageCacheEntry = {
      savedAt,
      expiresAt: savedAt + this.leadPageCacheTtlMs,
      value,
    };
    this.leadPageCache.set(key, entry);
    this.dashboardCache.set(`${this.persistentLeadPagePrefix}${key}`, value, {
      ttlMs: this.leadPageCacheTtlMs,
    });
  }

  private sectionCacheKey(state: EmployeeLeadsState): string {
    return JSON.stringify({
      companyCode: this.companyCode,
      phone: this.phone,
      search: state.search || '',
      status: state.status || '',
      statuses: state.statuses || '',
      isFavourite: state.isFavourite || false,
      updatedFrom: state.updatedFrom || '',
      updatedTo: state.updatedTo || '',
      setLabel: state.setLabel || '',
      division: state.division || '',
    });
  }

  private getCachedSection(state: EmployeeLeadsState): LeadSectionCacheEntry | null {
    const key = this.sectionCacheKey(state);
    const cached = this.leadSectionCache.get(key);
    if (cached) {
      if (cached.expiresAt <= Date.now()) {
        this.leadSectionCache.delete(key);
        this.dashboardCache.invalidate(`${this.persistentLeadSectionPrefix}${key}`);
        return null;
      }
      if (!this.isHydratedSection(cached.state)) {
        this.leadSectionCache.delete(key);
        this.dashboardCache.invalidate(`${this.persistentLeadSectionPrefix}${key}`);
        return null;
      }
      return cached;
    }

    const persisted = this.dashboardCache.getEntry<LeadSectionCacheEntry>(`${this.persistentLeadSectionPrefix}${key}`);
    if (!persisted) return null;
    const entry: LeadSectionCacheEntry = {
      ...persisted.data,
      savedAt: persisted.data.savedAt || persisted.savedAt,
      expiresAt: persisted.data.expiresAt || persisted.expiresAt,
    };
    if (!this.isHydratedSection(entry.state)) {
      this.dashboardCache.invalidate(`${this.persistentLeadSectionPrefix}${key}`);
      return null;
    }
    this.leadSectionCache.set(key, entry);
    return entry;
  }

  private cacheCurrentSection(): void {
    const state = this.stateSubject.value;
    if (!this.companyCode || !this.phone || (!state.companies.length && !state.leads.length) || !this.isHydratedSection(state)) return;
    this.cacheSectionState(state, this.companyPage);
  }

  private cacheSectionState(state: EmployeeLeadsState, companyPage: number): void {
    if (!this.companyCode || !this.phone || (!state.companies.length && !state.leads.length) || !this.isHydratedSection(state)) return;
    const key = this.sectionCacheKey(state);
    const savedAt = Date.now();
    const entry: LeadSectionCacheEntry = {
      companyPage,
      savedAt,
      expiresAt: savedAt + this.leadPageCacheTtlMs,
      state: {
        ...state,
        companies: [...state.companies],
        leads: [...state.leads],
        sets: [...state.sets],
        divisions: [...state.divisions],
        historyLogs: [],
        historyLoading: false,
        historyLeadId: '',
        loading: false,
        loadingMore: false,
        companyLoadingMore: false,
        error: '',
      },
    };
    this.leadSectionCache.set(key, entry);
    this.dashboardCache.set(`${this.persistentLeadSectionPrefix}${key}`, entry, {
      ttlMs: this.leadPageCacheTtlMs,
    });
  }

  private restoreStateIfCached(state: EmployeeLeadsState, resetSelection: boolean): LeadRestoreResult {
    const cached = this.getCachedSection(state);
    if (!cached) return { restored: false, refreshDue: false };
    this.requestRun += 1;
    this.companyPage = cached.companyPage;
    this.stateSubject.next({
      ...cached.state,
      selectedCompany: resetSelection ? '' : cached.state.selectedCompany,
      selectedLeadId: resetSelection ? '' : cached.state.selectedLeadId,
      drawerSection: resetSelection ? 'details' : cached.state.drawerSection,
      historyLogs: [],
      historyLoading: false,
      historyLeadId: '',
      loading: false,
      loadingMore: false,
      companyLoadingMore: false,
      error: '',
    });
    return { restored: true, refreshDue: this.isRefreshDue(cached) };
  }

  private isHydratedSection(state: EmployeeLeadsState): boolean {
    if (!state.companies.length) return true;
    const hydratedCompanies = new Set(state.leads.map((lead) => lead.companyName).filter(Boolean));
    return state.companies.every((company) => company.count <= 0 || hydratedCompanies.has(company.name));
  }

  private isRefreshDue(cacheEntry: { savedAt: number }): boolean {
    return Date.now() - cacheEntry.savedAt >= this.leadPageRefreshAfterMs;
  }

  private scopeState(filter: LeadScopeFilter): EmployeeLeadsState {
    return {
      ...this.stateSubject.value,
      ...filter,
      companies: [],
      leads: [],
      selectedCompany: '',
      selectedLeadId: '',
      drawerSection: 'details',
      historyLogs: [],
      historyLoading: false,
      historyLeadId: '',
      page: 1,
      hasMore: false,
      companyTotal: 0,
      companyHasMore: false,
      loading: false,
      loadingMore: false,
      companyLoadingMore: false,
      error: '',
    };
  }

  private replaceLead(updated: Lead): void {
    const leads = this.stateSubject.value.leads.map((item) => item.id === updated.id ? updated : item);
    for (const [key, cached] of this.leadPageCache.entries()) {
      const index = cached.value.items.findIndex((item) => item.id === updated.id);
      if (index === -1) continue;
      const items = [...cached.value.items];
      items[index] = updated;
      this.leadPageCache.set(key, {
        ...cached,
        value: {
          ...cached.value,
          items,
        },
      });
      this.dashboardCache.set(`${this.persistentLeadPagePrefix}${key}`, {
        ...cached.value,
        items,
      }, {
        ttlMs: this.leadPageCacheTtlMs,
      });
    }
    this.patch({ leads });
    this.cacheCurrentSection();
  }

  private resolveSelectedCompany(selectedCompany: string, companies: LeadCompany[]): string {
    if (selectedCompany && companies.some((company) => company.name === selectedCompany)) {
      return selectedCompany;
    }
    return companies[0]?.name || '';
  }

  private historyWithLegacyFallbacks(logs: LeadHistoryLog[], lead: Lead): LeadHistoryLog[] {
    const historyLogs = [...logs];
    const hasCreated = historyLogs.some((log) => String(log.action || '').toLowerCase().includes('created'));
    if (!hasCreated && lead.createdAt) {
      historyLogs.push({
        action: 'Lead Created',
        createdAt: lead.createdAt,
        changedBy: 'System (Legacy)',
        newValue: lead.status || 'New',
      });
    }

    const loggedRemarks = new Set(
      historyLogs
        .filter((log) => log.action === 'Remark Added')
        .map((log) => log.newValue),
    );
    for (const remark of lead.remarks || []) {
      if (!remark || loggedRemarks.has(remark)) continue;
      historyLogs.push({
        action: 'Legacy Remark',
        createdAt: lead.createdAt,
        changedBy: 'System (Legacy)',
        metadata: { remark },
      });
    }

    return historyLogs.sort((a, b) => {
      const bTime = new Date(b.createdAt || b.timestamp || '').getTime();
      const aTime = new Date(a.createdAt || a.timestamp || '').getTime();
      return bTime - aTime;
    });
  }

  private patch(partial: Partial<EmployeeLeadsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}

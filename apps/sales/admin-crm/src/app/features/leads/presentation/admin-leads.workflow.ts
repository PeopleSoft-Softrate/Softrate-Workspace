import { Injectable } from '@angular/core';
import { catchError, from, mergeMap, of } from 'rxjs';
import { DashboardCacheService } from '../../../core/cache/dashboard-cache.service';
import { OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../../core/config/pagination.config';
import { LeadService, Lead } from '../../../services/lead.service';

interface AdminLeadCompanyCachePayload {
  companies: Array<{ name: string; count: number }>;
  leads: Lead[];
  page: number;
  hasMore: boolean;
  total: number;
}

interface AdminLeadContactCachePayload {
  leads: Lead[];
  page: number;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminLeadsWorkflow {
  constructor(
    private leadService: LeadService,
    private dashboardCache: DashboardCacheService
  ) {}

  resetAdminLeadDerivedCaches(vm: any): void {
    vm.leadMapCache = null;
    vm.lastAllLeadsRef = null;
    vm.lastAllLeadsRefForFiltered = null;
    vm.lastFilteredLeadsRefForUnique = null;
  }
    updateLeadStatus(vm: any, lead: Lead, status: string): void {
    if (!lead._id) return;
    vm.updatingLeadId = lead._id;
    this.leadService.updateLeadStatus(lead._id, status).subscribe({
      next: (res) => {
        if (res.success) {
          vm.invalidateAdminDashboardCaches();
          lead.status = status;
        }
        vm.updatingLeadId = null;
      },
      error: () => {
        vm.updatingLeadId = null;
        alert('Failed to update lead status.');
      }
    });
  }

  openWeCrmModal(vm: any, lead: Lead): void {
    if (!vm.weCrmUrl) {
      alert('WE CRM URL is not configured.');
      return;
    }

    vm.weCrmManagers = [];
    if (vm.weCrmCompanyId) {
      vm.weCrmManagersLoading = true;
      fetch(`${vm.weCrmUrl}/users/public/managers?company_id=${vm.weCrmCompanyId}`)
        .then(res => res.json())
        .then(data => {
          vm.weCrmManagers = data || [];
        })
        .catch(err => console.error('Failed to load WE CRM managers', err))
        .finally(() => {
          vm.weCrmManagersLoading = false;
        });
    }

    vm.weCrmClientData = {
      owner_name: lead.contactName || 'Client',
      company_name: lead.leadCompanyName || (lead as any).companyName || '',
      email: lead.directorEmailAddress || (lead as any).email || `client_${lead.contactNumber}@example.com`,
      phone: String(lead.contactNumber || ''),
      password: '',
      business_type: '',
      pan: '',
      gstin: '',
      address: (lead as any).address || '',
      created_by: '',
      _leadId: lead._id
    };
    vm.showWeCrmModal = true;
  }

  closeWeCrmModal(vm: any): void {
    vm.showWeCrmModal = false;
  }

  submitWeCrmClient(vm: any): void {
    vm.updatingLeadId = vm.weCrmClientData._leadId;
    const payload = {
      ...vm.weCrmClientData,
      role: 'customer',
      status: 'active',
      company_id: vm.weCrmCompanyId
    };

    fetch(`${vm.weCrmUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert('Successfully added to WE CRM!');
        vm.showWeCrmModal = false;
      } else {
        alert('Failed: ' + (data.message || 'Unknown error'));
      }
    })
    .catch((err) => {
      alert('Failed: ' + err.message);
    })
    .finally(() => {
      vm.updatingLeadId = null;
    });
  }

  addToWeCrm(vm: any, lead: Lead): void {
    if (!vm.weCrmUrl) {
      alert('WE CRM URL is not configured.');
      return;
    }
    
    // Disable button to prevent multiple clicks
    vm.updatingLeadId = lead._id;
    
    const payload = {
      email: lead.directorEmailAddress || (lead as any).email || `client_${lead.contactNumber}@example.com`,
      password: 'WeCrm@123',
      owner_name: lead.contactName || 'Client',
      phone: String(lead.contactNumber || ''),
      role: 'customer',
      company_name: lead.leadCompanyName || (lead as any).companyName || '',
      address: (lead as any).address || '',
      status: 'active'
    };

    fetch(`${vm.weCrmUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert('Successfully added to WE CRM!');
      } else {
        alert('Failed to add to WE CRM: ' + (data.message || 'Unknown error'));
      }
    })
    .catch((err) => {
      console.error('WE CRM Error:', err);
      alert('Network error when contacting WE CRM.');
    })
    .finally(() => {
      vm.updatingLeadId = null;
    });
  }

    fetchAdminLeads(vm: any, forceRefresh = false): void {
    if (!vm.dashboardCode) return;
    vm.adminLeadRequestRun++;
    vm.adminLeadCompanyPage = 1;
    vm.adminLeadCompanyHasMore = false;
    if (forceRefresh || !vm.restoreCachedAdminLeadCompanyPage(1)) {
      vm.adminLeadCompanies = [];
      vm.allLeads = [];
      vm.selectedLeadCompany = '';
      vm.allLeadsLoading = true;
    }
    vm.closeAdminLeadPanels();
    const setsKey = vm.adminLeadSetsCacheKey();
    const cachedSets = !forceRefresh ? this.dashboardCache.get<string[]>(setsKey) : null;
    if (cachedSets) vm.adminLeadSets = cachedSets;

    this.leadService.getAdminLeadSets(vm.dashboardCode).subscribe({
      next: (res: any) => {
        if (res?.success) {
          vm.adminLeadSets = res.sets || [];
          this.dashboardCache.set(setsKey, vm.adminLeadSets, { ttlMs: vm.adminDashboardCacheTtlMs });
        }
        vm.loadAdminLeadCompanies(false, forceRefresh);
      },
      error: () => {
        vm.allLeadsLoading = false;
        vm.adminLeadCompaniesLoading = false;
      }
    });
  }
    onAdminLeadSearchChange(vm: any): void {
    if (vm.adminLeadSearchTimer) clearTimeout(vm.adminLeadSearchTimer);
    vm.adminLeadSearchTimer = setTimeout(() => vm.fetchAdminLeads(), SEARCH_DEBOUNCE_MS);
  }
    loadAdminLeadCompanies(vm: any, append: boolean, forceRefresh = false): void {
    if (!vm.dashboardCode) return;
    if (append && (vm.adminLeadCompaniesLoading || !vm.adminLeadCompanyHasMore)) return;

    const run = vm.adminLeadRequestRun;
    const page = append ? vm.adminLeadCompanyPage + 1 : 1;
    if (!forceRefresh && vm.restoreCachedAdminLeadCompanyPage(page, append)) {
      if (!append) this.ensureSelectedCompanyContactsLoaded(vm);
      if (!vm.isAdminDashboardCacheRefreshDue(vm.adminLeadCompanyCacheKey(page))) return;
    }
    vm.adminLeadCompaniesLoading = true;

    this.leadService.getAdminLeadCompanies(vm.dashboardCode, {
      setLabel: vm.selectedAdminLeadSet || undefined,
      search: vm.leadSearchQuery || undefined,
      status: vm.adminLeadStatusFilter || undefined,
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      includeContacts: true,
      contactPageSize: OPERATIONAL_PAGE_SIZE,
    }).subscribe({
      next: (res: any) => {
        if (run !== vm.adminLeadRequestRun) return;
        vm.adminLeadCompaniesLoading = false;
        const companies = res?.companies || [];
        vm.adminLeadCompanies = append ? vm.mergeAdminLeadCompanies(vm.adminLeadCompanies, companies) : companies;
        vm.adminLeadCompanyPage = res?.page || page;
        vm.adminLeadCompanyHasMore = !!res?.hasMore;
        const hydratedLeads = vm.flattenAdminContactsByCompany(res?.contactsByCompany);
        if (hydratedLeads.length) {
          vm.mergeAdminHydratedLeads(hydratedLeads);
        }
        vm.adminLeadCompanyTotal = Number(res?.totalCompanies || res?.total || res?.count || vm.adminLeadCompanies.length) || vm.adminLeadCompanies.length;
        vm.allLeadsLoading = false;
        if (!append) {
          vm.selectedLeadCompany = vm.adminLeadCompanies[0]?.name || '';
          const selectedHydratedCount = hydratedLeads.filter((lead: Lead) => lead.leadCompanyName === vm.selectedLeadCompany).length;
          vm.adminLeadContactsPage = 1;
          vm.adminLeadContactsHasMore = selectedHydratedCount < (vm.adminLeadCompanies[0]?.count || 0);
          if (vm.selectedLeadCompany && !selectedHydratedCount) vm.loadAdminLeadContacts(false);
        }
        if (!hydratedLeads.length) {
          vm.prefetchAdminLeadContacts(companies, run, !append);
        }
        this.dashboardCache.set(vm.adminLeadCompanyCacheKey(page), {
          companies,
          leads: hydratedLeads,
          page: vm.adminLeadCompanyPage,
          hasMore: vm.adminLeadCompanyHasMore,
          total: vm.adminLeadCompanyTotal,
        } satisfies AdminLeadCompanyCachePayload, { ttlMs: vm.adminDashboardCacheTtlMs });
      },
      error: () => {
        vm.adminLeadCompaniesLoading = false;
        vm.allLeadsLoading = false;
      },
    });
  }
  private ensureSelectedCompanyContactsLoaded(vm: any): void {
    if (!vm.selectedLeadCompany) return;
    const selectedCompany = vm.adminLeadCompanies.find((company: { name: string; count: number }) => company.name === vm.selectedLeadCompany);
    const expectedCount = selectedCompany?.count || 0;
    if (expectedCount <= 0) return;
    if (vm.leadsInSelectedCompany.length > 0) return;
    vm.loadAdminLeadContacts(false, true);
  }
    loadAdminLeadContacts(vm: any, append: boolean, forceRefresh = false): void {
    if (!vm.dashboardCode || !vm.selectedLeadCompany) return;
    if (append && (vm.adminLeadContactsLoadingMore || !vm.adminLeadContactsHasMore)) return;

    const run = vm.adminLeadRequestRun;
    const page = append ? vm.adminLeadContactsPage + 1 : 1;
    if (!forceRefresh && vm.restoreCachedAdminLeadContactPage(page, append)) {
      if (!vm.isAdminDashboardCacheRefreshDue(vm.adminLeadContactCacheKey(page))) return;
    }
    if (append) vm.adminLeadContactsLoadingMore = true;
    else vm.allLeadsLoading = true;

    this.leadService.getAdminLeadPage(vm.dashboardCode, {
      setLabel: vm.selectedAdminLeadSet || undefined,
      search: vm.leadSearchQuery || undefined,
      status: vm.adminLeadStatusFilter || undefined,
      company: vm.selectedLeadCompany,
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      includeFacets: page === 1,
    } as any).subscribe({
      next: (res: any) => {
        if (run !== vm.adminLeadRequestRun) return;
        vm.allLeadsLoading = false;
        vm.adminLeadContactsLoadingMore = false;
        const leads = (res?.leads || res?.items || []).map((l: any) => vm.normalizeLead(l));
        const otherCompanyLeads = vm.allLeads.filter((lead: Lead) => lead.leadCompanyName !== vm.selectedLeadCompany);
        const selectedCompanyLeads = append ? [...vm.leadsInSelectedCompany, ...leads] : leads;
        vm.allLeads = [...otherCompanyLeads, ...selectedCompanyLeads];
        vm.adminLeadContactsPage = res?.page || page;
        vm.adminLeadContactsHasMore = !!res?.hasMore;
        this.dashboardCache.set(vm.adminLeadContactCacheKey(page), {
          leads,
          page: vm.adminLeadContactsPage,
          hasMore: vm.adminLeadContactsHasMore,
        } satisfies AdminLeadContactCachePayload, { ttlMs: vm.adminDashboardCacheTtlMs });
        vm.fetchLeadCallCounts();
      },
      error: () => {
        vm.allLeadsLoading = false;
        vm.adminLeadContactsLoadingMore = false;
      },
    });
  }
  prefetchAdminLeadContacts(vm: any, companies: Array<{ name: string; count: number }>,
    run: number,
    skipSelectedCompany: boolean,): void {
    if (!vm.dashboardCode) return;
    const selectedCompany = vm.selectedLeadCompany;
    const targetCompanies = companies
      .map((company) => company.name)
      .filter((company) => !!company && (!skipSelectedCompany || company !== selectedCompany));

    from(targetCompanies).pipe(
      mergeMap((company) => (
        this.leadService.getAdminLeadPage(vm.dashboardCode, {
          setLabel: vm.selectedAdminLeadSet || undefined,
          search: vm.leadSearchQuery || undefined,
          company,
          page: 1,
          pageSize: OPERATIONAL_PAGE_SIZE,
          paginated: true,
          includeFacets: false,
        } as any).pipe(
          catchError(() => of({ leads: [], items: [], company }))
        )
      ), vm.adminLeadHydrationConcurrency),
    ).subscribe({
      next: (res: any) => {
        if (run !== vm.adminLeadRequestRun) return;
        const leads = (res?.leads || res?.items || []).map((lead: any) => vm.normalizeLead(lead));
        if (!leads.length) return;
        vm.mergeAdminHydratedLeads(leads);
        const company = leads[0]?.leadCompanyName || res?.company;
        if (company) {
          this.dashboardCache.set(vm.adminLeadContactCacheKey(1, company), {
            leads,
            page: 1,
            hasMore: leads.length >= OPERATIONAL_PAGE_SIZE,
          } satisfies AdminLeadContactCachePayload, { ttlMs: vm.adminDashboardCacheTtlMs });
        }
      },
    });
  }
  flattenAdminContactsByCompany(vm: any, raw: unknown): Lead[] {
    if (!raw || typeof raw !== 'object') return [];
    return Object.values(raw as Record<string, unknown>).flatMap((leads) => (
      Array.isArray(leads) ? leads.map((lead: any) => vm.normalizeLead(lead)) : []
    ));
  }
  mergeAdminHydratedLeads(vm: any, leads: Lead[]): void {
    const hydratedCompanies = new Set(leads.map((lead: any) => lead.leadCompanyName).filter(Boolean));
    const hydratedIds = new Set(leads.map((lead: any) => lead._id).filter(Boolean));
    const otherLeads = vm.allLeads.filter((lead: Lead) => {
      if (hydratedIds.has(lead._id)) return false;
      return !hydratedCompanies.has(lead.leadCompanyName);
    });
    vm.allLeads = [...otherLeads, ...leads];
    vm.resetAdminLeadDerivedCaches();
  }
  upsertAdminHydratedLeadRecords(vm: any, leads: Lead[]): void {
    if (!leads.length) return;
    const byKey = new Map<string, Lead>();
    const leadKey = (lead: Lead): string => {
      const id = String(lead._id || '').trim();
      if (id) return `id:${id}`;
      return [
        'contact',
        String(lead.leadCompanyName || '').trim(),
        String(lead.contactNumber || '').trim(),
      ].join('|');
    };

    vm.allLeads.forEach((lead: Lead) => byKey.set(leadKey(lead), lead));
    leads.forEach((lead) => byKey.set(leadKey(lead), lead));
    vm.allLeads = Array.from(byKey.values());
    vm.resetAdminLeadDerivedCaches();
  }
  adminLeadSetsCacheKey(vm: any): string {
    return `${vm.adminLeadSetsCachePrefix}${vm.dashboardCode}`;
  }
  adminLeadCompanyCacheKey(vm: any, page: number): string {
    return [
      vm.adminLeadCompanyCachePrefix,
      vm.dashboardCode,
      vm.selectedAdminLeadSet || 'all',
      vm.adminLeadStatusFilter || 'all',
      vm.leadSearchQuery.trim().toLowerCase() || 'all',
      `page:${page}`,
    ].join('|');
  }
  adminLeadContactCacheKey(vm: any, page: number, company = vm.selectedLeadCompany): string {
    return [
      vm.adminLeadContactCachePrefix,
      vm.dashboardCode,
      vm.selectedAdminLeadSet || 'all',
      vm.adminLeadStatusFilter || 'all',
      vm.leadSearchQuery.trim().toLowerCase() || 'all',
      company || 'none',
      `page:${page}`,
    ].join('|');
  }
  restoreCachedAdminLeadCompanyPage(vm: any, page: number, append = false): boolean {
    const payload = this.dashboardCache.get<AdminLeadCompanyCachePayload>(vm.adminLeadCompanyCacheKey(page));
    if (!payload) return false;
    vm.adminLeadCompanies = append ? vm.mergeAdminLeadCompanies(vm.adminLeadCompanies, payload.companies) : payload.companies;
    vm.adminLeadCompanyPage = payload.page;
    vm.adminLeadCompanyHasMore = payload.hasMore;
    vm.adminLeadCompanyTotal = payload.total;
    if (payload.leads.length) vm.mergeAdminHydratedLeads(payload.leads);
    vm.allLeadsLoading = false;
    vm.adminLeadCompaniesLoading = false;
    if (!append && !vm.selectedLeadCompany) {
      vm.selectedLeadCompany = payload.companies[0]?.name || '';
      vm.adminLeadContactsPage = 1;
      vm.adminLeadContactsHasMore = (payload.leads || []).filter((lead) => lead.leadCompanyName === vm.selectedLeadCompany).length < (payload.companies[0]?.count || 0);
    }
    return true;
  }
  restoreCachedAdminLeadContactPage(vm: any, page: number, append = false): boolean {
    const payload = this.dashboardCache.get<AdminLeadContactCachePayload>(vm.adminLeadContactCacheKey(page));
    if (!payload) return false;
    const selectedCompany = vm.adminLeadCompanies.find((company: { name: string; count: number }) => company.name === vm.selectedLeadCompany);
    const expectedCount = selectedCompany?.count || 0;
    if (!append && expectedCount > 0 && (!payload.leads || payload.leads.length === 0)) return false;
    const otherCompanyLeads = vm.allLeads.filter((lead: Lead) => lead.leadCompanyName !== vm.selectedLeadCompany);
    const selectedCompanyLeads = append ? [...vm.leadsInSelectedCompany, ...payload.leads] : payload.leads;
    vm.allLeads = [...otherCompanyLeads, ...selectedCompanyLeads];
    vm.adminLeadContactsPage = payload.page;
    vm.adminLeadContactsHasMore = payload.hasMore;
    vm.allLeadsLoading = false;
    vm.adminLeadContactsLoadingMore = false;
    return true;
  }
  mergeAdminLeadCompanies(
    vm: any,
    existing: Array<{ name: string; count: number }>,
    incoming: Array<{ name: string; count: number }>,
  ): Array<{ name: string; count: number }> {
    const byName = new Map<string, { name: string; count: number }>();
    [...existing, ...incoming].forEach((company) => {
      if (!company?.name) return;
      byName.set(company.name, company);
    });
    return Array.from(byName.values());
  }

  isAdminDashboardCacheRefreshDue(vm: any, key: string): boolean {
    const metadata = this.dashboardCache.getMetadata(key);
    return !metadata || Date.now() - metadata.cachedAt >= vm.adminDashboardRefreshAfterMs;
  }
  invalidateAdminDashboardCaches(vm: any): void {
    this.dashboardCache.removeByPrefix(vm.adminLeadCompanyCachePrefix);
    this.dashboardCache.removeByPrefix(vm.adminLeadContactCachePrefix);
    this.dashboardCache.removeByPrefix(vm.adminLeadSetsCachePrefix);
    this.dashboardCache.removeByPrefix(vm.adminFollowupCompanyCachePrefix);
    if (vm.empLeadSetCachePrefix) this.dashboardCache.removeByPrefix(vm.empLeadSetCachePrefix);
    if (vm.empLeadCompanyCachePrefix) this.dashboardCache.removeByPrefix(vm.empLeadCompanyCachePrefix);
    if (vm.empLeadContactCachePrefix) this.dashboardCache.removeByPrefix(vm.empLeadContactCachePrefix);
    if (vm.empFollowupCachePrefix) this.dashboardCache.removeByPrefix(vm.empFollowupCachePrefix);
    if (vm.remarkLeadCompanyCachePrefix) this.dashboardCache.removeByPrefix(vm.remarkLeadCompanyCachePrefix);
    if (vm.remarkLeadContactCachePrefix) this.dashboardCache.removeByPrefix(vm.remarkLeadContactCachePrefix);
  }
}

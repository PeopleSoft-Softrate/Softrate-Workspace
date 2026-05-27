import { Injectable } from '@angular/core';
import { DashboardCacheService } from '../../../core/cache/dashboard-cache.service';
import { OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../../core/config/pagination.config';
import { BookmarkService, Bookmark } from '../../../services/bookmark.service';
import { CallLogService } from '../../../services/calllog.service';
import { EmployeeService, Employee } from '../../../services/employee.service';
import { LeadService, Lead } from '../../../services/lead.service';

interface EmployeeLeadCompanyCachePayload {
  companies: Array<{ name: string; count: number }>;
  leads: Lead[];
  page: number;
  hasMore: boolean;
  total: number;
}

interface EmployeeLeadContactCachePayload {
  leads: Lead[];
  page: number;
  hasMore: boolean;
}

interface EmployeeFollowupCachePayload {
  bookmarks: Bookmark[];
  page: number;
  hasMore: boolean;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AdminEmployeesWorkflow {
  constructor(
    private employeeService: EmployeeService,
    private callLogService: CallLogService,
    private leadService: LeadService,
    private bookmarkService: BookmarkService,
    private dashboardCache: DashboardCacheService,
  ) {}

  filteredEmployeesForTable(vm: any): Employee[] {
    const query = vm.employeeSearchQuery.trim().toLowerCase();
    if (!query) return vm.employees;
    return vm.employees.filter((emp: Employee) => {
      const tags = Array.isArray(emp.tags) ? emp.tags.join(' ') : '';
      return [
        emp.name,
        emp.mobile,
        tags,
        emp.lastCallTime,
        emp.lastSyncTime,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }

  filteredEmployeeCallRows(vm: any): any[] {
    return vm.employeeCallRows.filter((row: any) => {
      if (vm.filterTags && (!row.emp.tags || !row.emp.tags.includes(vm.filterTags))) return false;
      if (vm.filterEmployees && row.emp.mobile !== vm.filterEmployees) return false;
      return true;
    });
  }

  fetchEmployees(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.employeesLoading = true;
    vm.employeesError = '';
    this.employeeService.getEmployees(vm.dashboardCode).subscribe({
      next: (res: any) => {
        vm.employeesLoading = false;
        if (res.success && res.employees) {
          vm.employees = res.employees;

          if (vm.selectedPeriod !== 'custom') {
            const cache = vm.preloadedCache[vm.selectedPeriod];
            if (cache.employeesLoaded) {
              vm.mapEmployeeStats(cache.employees || []);
              vm.empCallLoading = false;
            }
          } else {
            vm.fetchEmployeeCallRows();
          }
        } else {
          vm.employeesError = res.message || 'Failed to load employees.';
        }
      },
      error: (err: any) => {
        vm.employeesLoading = false;
        vm.employeesError = err?.error?.message || 'Server error: Could not connect to the server. Please try again.';
      },
    });
  }

  fetchEmployeeCallRows(vm: any, forceRefresh = false): void {
    if (!vm.dashboardCode) return;

    if (!forceRefresh && vm.selectedPeriod !== 'custom') {
      const cache = vm.preloadedCache[vm.selectedPeriod];
      if (cache.employeesLoaded) {
        vm.mapEmployeeStats(cache.employees || []);
        vm.empCallLoading = false;
      } else {
        vm.empCallLoading = true;
      }
      return;
    }

    vm.empCallLoading = true;
    vm.empCallError = '';

    const filters = vm.dashTab === 'reports' ? {
      callType: vm.filterCallType,
      duration: vm.filterDuration,
      callTime: vm.filterCallTime,
    } : null;

    this.callLogService.getEmployeesStats(
      vm.dashboardCode,
      vm.selectedPeriod,
      vm.selectedPeriod === 'custom' ? vm.customFrom : undefined,
      vm.selectedPeriod === 'custom' ? (vm.customTo || undefined) : undefined,
      filters
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          vm.mapEmployeeStats(res.employees);
        } else {
          vm.empCallLoading = false;
          vm.empCallError = res.message || 'Failed to load call data.';
        }
      },
      error: (err: any) => {
        vm.empCallLoading = false;
        vm.empCallError = err?.error?.message || 'Server error: Could not load call statistics.';
      },
    });
  }

  syncAll(vm: any): void {
    vm.syncAllLoading = true;

    if (vm.selectedPeriod === 'custom') {
      vm.fetchSummary();
      vm.fetchEmployeeCallRows();
    } else {
      vm.fetchSummary(true);
      vm.fetchEmployeeCallRows(true);
    }
    vm.fetchEmployees();
    setTimeout(() => vm.syncAllLoading = false, 1500);
  }

  syncEmployee(vm: any): void {
    if (!vm.selectedEmployee) return;
    vm.syncEmpLoading = true;
    vm.openEmployee(vm.selectedEmployee);
    setTimeout(() => vm.syncEmpLoading = false, 1500);
  }

  openEmployee(vm: any, emp: Employee): void {
    vm.clearOverviewChartRetries?.();
    vm.destroyEmployeeCharts?.();
    vm.selectedEmployee = emp;
    vm.selectedEmpStats = null;
    vm.selectedEmpCalls = [];
    vm.selectedEmpLoading = true;
    vm.selectedEmpCallsLoading = true;
    vm.employeeChartType = 'line';
    vm.drilldownTab = 'stats';
    vm.dashTab = 'emp_dashboard';
    vm.selectedEmpLeadCompany = '';
    vm.selectedEmpFollowupCompany = '';
    vm.followupFilter = 'all';
    vm.followupSearch = '';
    vm.selectedFollowupDate = '';
    vm.empLeads = [];
    vm.empLeadCompanies = [];
    vm.empLeadCompanyPage = 1;
    vm.empLeadCompanyHasMore = false;
    vm.empLeadCompanyTotal = 0;
    vm.empLeadContactsPage = 1;
    vm.empLeadContactsHasMore = false;
    vm.empFollowupBookmarks = [];
    vm.empFollowupPage = 1;
    vm.empFollowupHasMore = false;
    vm.empFollowupTotal = 0;

    window.scrollTo({ top: 0, behavior: 'instant' });

    this.callLogService.getEmployeeStat(
      vm.dashboardCode,
      emp.mobile,
      vm.selectedPeriod,
      vm.selectedPeriod === 'custom' ? vm.customFrom : undefined,
      vm.selectedPeriod === 'custom' ? (vm.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        vm.selectedEmpLoading = false;
        if (res.success) vm.selectedEmpStats = res.stats;
      },
      error: () => { vm.selectedEmpLoading = false; },
    });

    this.callLogService.getCallDetails(
      vm.dashboardCode,
      emp.mobile,
      vm.selectedPeriod,
      vm.selectedPeriod === 'custom' ? vm.customFrom : undefined,
      vm.selectedPeriod === 'custom' ? (vm.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        vm.selectedEmpCallsLoading = false;
        if (res.success) {
          vm.selectedEmpCalls = res.calls;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              vm.renderChart();
              vm.renderEmpDonutChart();
            });
          });
        }
      },
      error: () => { vm.selectedEmpCallsLoading = false; },
    });

    vm.fetchEmpLeads();
    vm.fetchEmpFollowups();
  }

  selectEmployee(vm: any, emp: Employee): void {
    vm.openEmployee(emp);
  }

  openAddEmployee(vm: any): void {
    vm.isAddEmployeeOpen = true;
    vm.addEmployeeError = '';
    vm.newEmployee = { name: '', mobile: '', countryCode: '+91' };
    vm.updateScrollLock();
  }

  closeAddEmployee(vm: any): void {
    vm.isAddEmployeeOpen = false;
  }

  onAddEmployeeSubmit(vm: any, event: Event): void {
    event.preventDefault();
    vm.addEmployeeError = '';
    if (!vm.newEmployee.name || !vm.newEmployee.mobile) {
      vm.addEmployeeError = 'Name and mobile are required.';
      return;
    }
    if (vm.dashboardTeamSize > 0 && vm.employees.length >= vm.dashboardTeamSize) {
      vm.addEmployeeError = `Employee limit reached. Your current plan allows for a maximum of ${vm.dashboardTeamSize} employees. Please update your team size in settings if you need to add more.`;
      return;
    }

    vm.addEmployeeLoading = true;
    this.employeeService.addEmployee({ ...vm.newEmployee, companyCode: vm.dashboardCode }).subscribe({
      next: (res: any) => {
        vm.addEmployeeLoading = false;
        if (res.success && res.employee) {
          vm.employees.unshift(res.employee);
          vm.closeAddEmployee();
          vm.fetchEmployeeCallRows(true);
        } else {
          vm.addEmployeeError = res.message || 'Failed to add employee.';
        }
      },
      error: (err: any) => {
        vm.addEmployeeLoading = false;
        vm.addEmployeeError = err?.error?.message || 'Server error.';
      },
    });
  }

  openEditEmployee(vm: any, emp: Employee): void {
    vm.editingEmployee = { ...emp };
    vm.isEditEmployeeOpen = true;
    vm.editEmployeeError = '';
    vm.updateScrollLock();
  }

  closeEditEmployee(vm: any): void {
    vm.isEditEmployeeOpen = false;
    vm.editEmployeeError = '';
    vm.updateScrollLock();
  }

  onEditEmployeeSubmit(vm: any, event: Event): void {
    event.preventDefault();
    if (!vm.editingEmployee._id) return;
    vm.editEmployeeLoading = true;
    vm.editEmployeeError = '';

    this.employeeService.updateEmployee(vm.editingEmployee._id, {
      name: vm.editingEmployee.name,
      mobile: vm.editingEmployee.mobile,
      countryCode: vm.editingEmployee.countryCode,
      tags: vm.editingEmployee.tags,
    }).subscribe({
      next: (res: any) => {
        vm.editEmployeeLoading = false;
        if (res.success) {
          vm.fetchEmployees();
          vm.closeEditEmployee();
        } else {
          vm.editEmployeeError = res.message;
        }
      },
      error: (err: any) => {
        vm.editEmployeeLoading = false;
        vm.editEmployeeError = err?.error?.message || 'Error updating employee.';
      },
    });
  }

  toggleEditTag(vm: any, tag: string): void {
    const idx = vm.editingEmployee.tags.indexOf(tag);
    if (idx > -1) {
      vm.editingEmployee.tags.splice(idx, 1);
    } else {
      vm.editingEmployee.tags.push(tag);
    }
  }

  enableTagEdit(vm: any, emp: Employee): void {
    event?.stopPropagation();
    vm.editTagEmpId = emp._id!;
    vm.inlineTagValue = (emp.tags && emp.tags.length > 0) ? emp.tags[0] : '';
  }

  cancelTagEdit(vm: any, event: Event): void {
    event.stopPropagation();
    vm.editTagEmpId = null;
    vm.inlineTagValue = '';
    vm.showInlineDropdown = null;
  }

  focusTagInput(vm: any, emp: Employee): void {
    vm.showInlineDropdown = emp._id!;
  }

  blurTagInput(vm: any): void {
    setTimeout(() => {
      vm.showInlineDropdown = null;
    }, 200);
  }

  getFilteredTagOptions(vm: any): string[] {
    const val = (vm.inlineTagValue || '').toLowerCase();
    return vm.tagOptions.filter((tag: string) => tag.toLowerCase().includes(val));
  }

  saveInlineTag(vm: any, emp: Employee, event?: Event): void {
    if (event) event.stopPropagation();
    if (!vm.dashboardCode) return;

    const finalTag = vm.inlineTagValue.trim();
    if (!finalTag) {
      alert('Please enter a tag name to save.');
      return;
    }

    vm.savingTag = true;
    const tagsToSave = [finalTag];

    this.employeeService.updateEmployeeTags(emp._id!, tagsToSave, vm.dashboardCode).subscribe({
      next: (res: any) => {
        vm.savingTag = false;
        if (res.success) {
          emp.tags = res.employee.tags;

          if (finalTag && !vm.tagOptions.includes(finalTag)) {
            vm.tagOptions.push(finalTag);
          }

          vm.editTagEmpId = null;
        } else {
          alert('Failed to update tag: ' + (res.message || 'Unknown error'));
        }
      },
      error: () => {
        vm.savingTag = false;
        alert('Server error updating tags.');
      },
    });
  }

  openAllCallsModal(vm: any): void {
    vm.showAllCallsModal = true;
  }

  closeAllCallsModal(vm: any): void {
    vm.showAllCallsModal = false;
  }

  closeEmployee(vm: any): void {
    vm.selectedEmployee = null;
    vm.selectedEmpStats = null;
    vm.selectedEmpCalls = [];
    vm.drilldownTab = 'stats';
    vm.dashTab = 'employees';
    vm.empLeads = [];
    vm.empLeadCompanies = [];
    vm.empLeadCompanyPage = 1;
    vm.empLeadCompanyHasMore = false;
    vm.empLeadCompanyTotal = 0;
    vm.empLeadContactsPage = 1;
    vm.empLeadContactsHasMore = false;
    vm.leadSets = [];
    vm.selectedLeadSet = '';
    vm.newLeadSetLabel = '';
    vm.showAddLeadForm = false;
    vm.leadUploadStep = 'idle';
    vm.empLeadSearchQuery = '';
    vm.empLeadSetFilter = '';
    vm.empFollowupBookmarks = [];
    vm.empFollowupPage = 1;
    vm.empFollowupHasMore = false;
    vm.empFollowupTotal = 0;
    vm.followupUploadStep = 'idle';
    vm.destroyEmployeeCharts?.();
  }

  fetchEmpLeads(vm: any, forceRefresh = false): void {
    if (!vm.selectedEmployee || !vm.dashboardCode) return;

    vm.empLeadRequestRun++;
    vm.empLeadCompanyPage = 1;
    vm.empLeadCompanyHasMore = false;

    const setsKey = this.employeeLeadSetCacheKey(vm);
    const cachedSets = !forceRefresh ? this.dashboardCache.get<string[]>(setsKey) : null;
    if (cachedSets) vm.leadSets = cachedSets;

    if (forceRefresh || !this.restoreCachedEmployeeLeadCompanyPage(vm, 1)) {
      vm.empLeadCompanies = [];
      vm.empLeads = [];
      vm.selectedEmpLeadCompany = '';
      vm.empLeadsLoading = true;
    }

    this.leadService.getEmployeeLeadSets(vm.dashboardCode, vm.selectedEmployee.mobile).subscribe({
      next: (res: any) => {
        if (res?.success) {
          vm.leadSets = res.sets || [];
          this.dashboardCache.set(setsKey, vm.leadSets, { ttlMs: vm.adminDashboardCacheTtlMs });
        }
        this.loadEmployeeLeadCompanies(vm, false, forceRefresh);
      },
      error: () => {
        vm.empLeadsLoading = false;
        vm.empLeadCompaniesLoading = false;
      },
    });
  }

  onEmployeeLeadSearchChange(vm: any): void {
    if (vm.empLeadSearchTimer) clearTimeout(vm.empLeadSearchTimer);
    vm.empLeadSearchTimer = setTimeout(() => vm.fetchEmpLeads(), SEARCH_DEBOUNCE_MS);
  }

  onEmployeeLeadCompanyScroll(vm: any, event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
      this.loadEmployeeLeadCompanies(vm, true);
    }
  }

  onEmployeeLeadContactsScroll(vm: any, event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 120) {
      this.loadEmployeeLeadContacts(vm, true);
    }
  }

  private employeeLeadSetCacheKey(vm: any): string {
    return [
      vm.empLeadSetCachePrefix,
      vm.dashboardCode,
      vm.selectedEmployee?.mobile || 'all',
    ].join('|');
  }

  private employeeLeadCompanyCacheKey(vm: any, page: number): string {
    return [
      vm.empLeadCompanyCachePrefix,
      vm.dashboardCode,
      vm.selectedEmployee?.mobile || 'all',
      vm.selectedLeadSet || 'all',
      vm.empLeadSearchQuery.trim().toLowerCase() || 'all',
      `page:${page}`,
    ].join('|');
  }

  private employeeLeadContactCacheKey(vm: any, page: number, company = vm.selectedEmpLeadCompany): string {
    return [
      vm.empLeadContactCachePrefix,
      vm.dashboardCode,
      vm.selectedEmployee?.mobile || 'all',
      company || 'all',
      vm.selectedLeadSet || 'all',
      vm.empLeadSearchQuery.trim().toLowerCase() || 'all',
      `page:${page}`,
    ].join('|');
  }

  private restoreCachedEmployeeLeadCompanyPage(vm: any, page: number, append = false): boolean {
    const payload = this.dashboardCache.get<EmployeeLeadCompanyCachePayload>(this.employeeLeadCompanyCacheKey(vm, page));
    if (!payload) return false;

    const companies = payload.companies || [];
    vm.empLeadCompanies = append ? this.mergeEmployeeLeadCompanies(vm.empLeadCompanies, companies) : companies;
    vm.empLeads = append ? this.mergeEmployeeHydratedLeads(vm.empLeads, payload.leads || []) : (payload.leads || []);
    vm.empLeadCompanyPage = payload.page;
    vm.empLeadCompanyHasMore = payload.hasMore;
    vm.empLeadCompanyTotal = payload.total || vm.empLeadCompanies.length;
    vm.empLeadsLoading = false;
    vm.empLeadCompaniesLoading = false;

    if (!append) {
      const selectedStillVisible = vm.empLeadCompanies.some((company: { name: string; count: number }) => company.name === vm.selectedEmpLeadCompany);
      if (!selectedStillVisible) vm.selectedEmpLeadCompany = vm.empLeadCompanies[0]?.name || '';
      this.ensureSelectedEmployeeLeadContactsLoaded(vm);
    }

    return true;
  }

  private restoreCachedEmployeeLeadContactPage(vm: any, page: number, append = false): boolean {
    const payload = this.dashboardCache.get<EmployeeLeadContactCachePayload>(this.employeeLeadContactCacheKey(vm, page));
    if (!payload) return false;

    const otherCompanyLeads = vm.empLeads.filter((lead: Lead) => lead.leadCompanyName !== vm.selectedEmpLeadCompany);
    const selectedCompanyLeads = append
      ? [...this.leadsInSelectedEmpCompany(vm), ...(payload.leads || [])]
      : (payload.leads || []);

    vm.empLeads = [...otherCompanyLeads, ...selectedCompanyLeads];
    vm.empLeadContactsPage = payload.page;
    vm.empLeadContactsHasMore = payload.hasMore;
    vm.empLeadsLoading = false;
    vm.empLeadContactsLoadingMore = false;
    return true;
  }

  private ensureSelectedEmployeeLeadContactsLoaded(vm: any): void {
    if (!vm.selectedEmpLeadCompany) return;
    const selectedCompany = vm.empLeadCompanies.find((company: { name: string; count: number }) => company.name === vm.selectedEmpLeadCompany);
    const expectedCount = selectedCompany?.count || 0;
    if (expectedCount <= 0) return;
    if (this.leadsInSelectedEmpCompany(vm).length > 0) return;
    this.loadEmployeeLeadContacts(vm, false, true);
  }

  private loadEmployeeLeadCompanies(vm: any, append: boolean, forceRefresh = false): void {
    if (!vm.selectedEmployee || !vm.dashboardCode) return;
    if (append && (vm.empLeadCompaniesLoading || !vm.empLeadCompanyHasMore)) return;

    const run = vm.empLeadRequestRun;
    const page = append ? vm.empLeadCompanyPage + 1 : 1;
    if (!forceRefresh && this.restoreCachedEmployeeLeadCompanyPage(vm, page, append)) {
      if (!this.isCacheRefreshDue(vm, this.employeeLeadCompanyCacheKey(vm, page))) return;
    }

    vm.empLeadCompaniesLoading = true;

    this.leadService.getEmployeeLeadCompanies(vm.dashboardCode, vm.selectedEmployee.mobile, {
      setLabel: vm.selectedLeadSet || undefined,
      search: vm.empLeadSearchQuery || undefined,
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      includeContacts: true,
      contactPageSize: OPERATIONAL_PAGE_SIZE,
    }).subscribe({
      next: (res: any) => {
        if (run !== vm.empLeadRequestRun) return;

        const companies = res?.companies || [];
        const hydratedLeads = this.flattenEmployeeContactsByCompany(vm, res?.contactsByCompany);
        vm.empLeadCompanies = append ? this.mergeEmployeeLeadCompanies(vm.empLeadCompanies, companies) : companies;
        vm.empLeads = append ? this.mergeEmployeeHydratedLeads(vm.empLeads, hydratedLeads) : hydratedLeads;
        vm.empLeadCompanyPage = res?.page || page;
        vm.empLeadCompanyHasMore = !!res?.hasMore;
        vm.empLeadCompanyTotal = Number(res?.total || res?.count || vm.empLeadCompanies.length) || vm.empLeadCompanies.length;
        vm.empLeadsLoading = false;
        vm.empLeadCompaniesLoading = false;

        if (!append) {
          vm.selectedEmpLeadCompany = vm.empLeadCompanies[0]?.name || '';
          const selectedHydratedCount = hydratedLeads.filter((lead: Lead) => lead.leadCompanyName === vm.selectedEmpLeadCompany).length;
          vm.empLeadContactsPage = 1;
          vm.empLeadContactsHasMore = selectedHydratedCount < (vm.empLeadCompanies[0]?.count || 0);
          if (vm.selectedEmpLeadCompany && !selectedHydratedCount) this.loadEmployeeLeadContacts(vm, false);
        }

        this.dashboardCache.set(this.employeeLeadCompanyCacheKey(vm, page), {
          companies,
          leads: hydratedLeads,
          page: vm.empLeadCompanyPage,
          hasMore: vm.empLeadCompanyHasMore,
          total: vm.empLeadCompanyTotal,
        } satisfies EmployeeLeadCompanyCachePayload, { ttlMs: vm.adminDashboardCacheTtlMs });
      },
      error: () => {
        vm.empLeadsLoading = false;
        vm.empLeadCompaniesLoading = false;
      },
    });
  }

  private loadEmployeeLeadContacts(vm: any, append: boolean, forceRefresh = false): void {
    if (!vm.selectedEmployee || !vm.selectedEmpLeadCompany || !vm.dashboardCode) return;
    if (append && (vm.empLeadContactsLoadingMore || !vm.empLeadContactsHasMore)) return;

    const run = vm.empLeadRequestRun;
    const page = append ? vm.empLeadContactsPage + 1 : 1;
    if (!forceRefresh && this.restoreCachedEmployeeLeadContactPage(vm, page, append)) {
      if (!this.isCacheRefreshDue(vm, this.employeeLeadContactCacheKey(vm, page))) return;
    }

    if (append) vm.empLeadContactsLoadingMore = true;
    else vm.empLeadsLoading = true;

    this.leadService.getEmployeeLeadPage(vm.dashboardCode, vm.selectedEmployee.mobile, {
      setLabel: vm.selectedLeadSet || undefined,
      search: vm.empLeadSearchQuery || undefined,
      company: vm.selectedEmpLeadCompany,
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
    }).subscribe({
      next: (res: any) => {
        if (run !== vm.empLeadRequestRun) return;

        const leads = (res?.leads || res?.items || []).map((lead: any) => vm.normalizeLead(lead));
        const otherCompanyLeads = vm.empLeads.filter((lead: Lead) => lead.leadCompanyName !== vm.selectedEmpLeadCompany);
        const selectedCompanyLeads = append ? [...this.leadsInSelectedEmpCompany(vm), ...leads] : leads;

        vm.empLeads = [...otherCompanyLeads, ...selectedCompanyLeads];
        vm.empLeadContactsPage = res?.page || page;
        vm.empLeadContactsHasMore = !!res?.hasMore;
        vm.empLeadsLoading = false;
        vm.empLeadContactsLoadingMore = false;

        this.dashboardCache.set(this.employeeLeadContactCacheKey(vm, page), {
          leads,
          page: vm.empLeadContactsPage,
          hasMore: vm.empLeadContactsHasMore,
        } satisfies EmployeeLeadContactCachePayload, { ttlMs: vm.adminDashboardCacheTtlMs });
      },
      error: () => {
        vm.empLeadsLoading = false;
        vm.empLeadContactsLoadingMore = false;
      },
    });
  }

  empUniqueCompanies(vm: any): string[] {
    return (vm.empLeadCompanies || []).map((company: { name: string; count: number }) => company.name);
  }

  leadsInSelectedEmpCompany(vm: any): any[] {
    if (!vm.selectedEmpLeadCompany) return [];
    return vm.empLeads.filter((lead: Lead) => (lead.leadCompanyName || 'Unnamed Company') === vm.selectedEmpLeadCompany);
  }

  getEmpLeadsByCompany(vm: any, company: string): any[] {
    if (vm.lastFilteredEmpLeadsRefForCompany !== vm.filteredEmpLeads) {
      vm.empLeadsByCompanyCache = {};
      for (const lead of vm.filteredEmpLeads) {
        const companyName = lead.leadCompanyName || 'Unnamed Company';
        if (!vm.empLeadsByCompanyCache[companyName]) {
          vm.empLeadsByCompanyCache[companyName] = [];
        }
        vm.empLeadsByCompanyCache[companyName].push(lead);
      }
      vm.lastFilteredEmpLeadsRefForCompany = vm.filteredEmpLeads;
    }
    return vm.empLeadsByCompanyCache[company] || [];
  }

  selectEmpLeadCompany(vm: any, company: string): void {
    vm.selectedEmpLeadCompany = company;
    const currentCount = this.leadsInSelectedEmpCompany(vm).length;
    const expectedCount = this.getEmpLeadCompanyCount(vm, company);
    if (expectedCount > currentCount) {
      vm.empLeadContactsPage = 1;
      vm.empLeadContactsHasMore = true;
      this.loadEmployeeLeadContacts(vm, false);
    }
  }

  selectLeadSet(vm: any, set: string): void {
    vm.selectedLeadSet = set;
    vm.fetchEmpLeads();
  }

  deleteLeadSet(vm: any, setLabel: string): void {
    if (!confirm(`Delete ALL leads in set "${setLabel}"? This cannot be undone.`)) return;
    vm.deleteSetLoading = true;
    this.leadService.deleteLeadSet(vm.dashboardCode, vm.selectedEmployee!.mobile, setLabel).subscribe({
      next: (res: any) => {
        vm.deleteSetLoading = false;
        if (res.success) {
          if (vm.selectedLeadSet === setLabel) vm.selectedLeadSet = '';
          vm.fetchEmpLeads();
        }
      },
      error: () => { vm.deleteSetLoading = false; },
    });
  }

  getEmpLeadCompanyCount(vm: any, company: string): number {
    return vm.empLeadCompanies.find((item: { name: string; count: number }) => item.name === company)?.count
      || this.getEmpLeadsByCompany(vm, company).length;
  }

  fetchEmpFollowups(vm: any, forceRefresh = false): void {
    if (!vm.selectedEmployee || !vm.dashboardCode) return;
    const page = 1;

    if (forceRefresh || !this.restoreCachedEmployeeFollowupPage(vm, page)) {
      vm.empFollowupBookmarks = [];
      vm.empFollowupsLoading = true;
      vm.empFollowupPage = 1;
      vm.empFollowupHasMore = false;
      vm.empFollowupTotal = 0;
    }

    this.loadEmployeeFollowupPage(vm, page, { reset: true, forceRefresh });
  }

  onEmployeeFollowupFiltersChange(vm: any): void {
    if (vm.empFollowupSearchTimer) clearTimeout(vm.empFollowupSearchTimer);
    vm.empFollowupSearchTimer = setTimeout(() => vm.fetchEmpFollowups(), SEARCH_DEBOUNCE_MS);
  }

  onEmployeeFollowupScroll(vm: any, event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 120) {
      this.loadEmployeeFollowupPage(vm, vm.empFollowupPage + 1, { append: true, forceRefresh: true });
    }
  }

  selectedEmpBookmarks(vm: any): Bookmark[] {
    return vm.empFollowupBookmarks || [];
  }

  selectedEmpBookmarksFiltered(vm: any): Bookmark[] {
    const depsStr = JSON.stringify([
      vm.followupFilter,
      vm.selectedFollowupDate,
      vm.followupSearch,
    ]);

    if (
      vm.lastSelectedEmpBookmarksRefForFiltered !== vm.selectedEmpBookmarks
      || vm.selectedEmpBookmarksFilteredDepsStr !== depsStr
    ) {
      let list = vm.selectedEmpBookmarks;

      if (vm.followupFilter === 'today') {
        const today = new Date().toISOString().substring(0, 10);
        list = list.filter((bookmark: Bookmark) => bookmark.reminderDate && bookmark.reminderDate.substring(0, 10) === today);
      }

      if (vm.selectedFollowupDate) {
        list = list.filter((bookmark: Bookmark) => bookmark.reminderDate && bookmark.reminderDate.substring(0, 10) === vm.selectedFollowupDate);
      }

      if (vm.followupSearch) {
        const q = vm.followupSearch.toLowerCase();
        list = list.filter((bookmark: Bookmark) => (
          bookmark.contactName?.toLowerCase().includes(q) ||
          bookmark.contactNumber?.toLowerCase().includes(q) ||
          bookmark.companyName?.toLowerCase().includes(q) ||
          String(bookmark.description || '').toLowerCase().includes(q) ||
          (bookmark.remarks || []).some((remark: string) => remark.toLowerCase().includes(q))
        ));
      }

      vm.selectedEmpBookmarksFilteredCache = list;
      vm.lastSelectedEmpBookmarksRefForFiltered = vm.selectedEmpBookmarks;
      vm.selectedEmpBookmarksFilteredDepsStr = depsStr;
    }

    return vm.selectedEmpBookmarksFilteredCache;
  }

  selectedEmpBookmarksByCompany(vm: any): Bookmark[] {
    if (!vm.selectedEmpFollowupCompany) return [];
    const depsStr = vm.selectedEmpFollowupCompany;
    if (
      vm.lastSelectedEmpBookmarksFilteredRef !== vm.selectedEmpBookmarksFiltered
      || vm.selectedEmpBookmarksByCompanyDepsStr !== depsStr
    ) {
      vm.selectedEmpBookmarksByCompanyCache = vm.selectedEmpBookmarksFiltered.filter((bookmark: Bookmark) => (
        (bookmark.companyName || 'Unnamed Company') === vm.selectedEmpFollowupCompany
      ));
      vm.lastSelectedEmpBookmarksFilteredRef = vm.selectedEmpBookmarksFiltered;
      vm.selectedEmpBookmarksByCompanyDepsStr = depsStr;
    }
    return vm.selectedEmpBookmarksByCompanyCache;
  }

  groupedEmpBookmarks(vm: any): { company: string; count: number }[] {
    if (vm.lastGroupedEmpBookmarksRef !== vm.selectedEmpBookmarksFiltered) {
      const groups = new Map<string, number>();
      vm.selectedEmpBookmarksFiltered.forEach((bookmark: Bookmark) => {
        const company = bookmark.companyName || 'Unnamed Company';
        groups.set(company, (groups.get(company) || 0) + 1);
      });
      vm.groupedEmpBookmarksCache = Array.from(groups.entries())
        .map(([company, count]) => ({ company, count }))
        .sort((a, b) => a.company.localeCompare(b.company));
      vm.lastGroupedEmpBookmarksRef = vm.selectedEmpBookmarksFiltered;
    }
    return vm.groupedEmpBookmarksCache;
  }

  ensureSelectedEmpFollowupCompany(vm: any): void {
    const groups = vm.groupedEmpBookmarks;
    const selectedStillVisible = groups.some((group: { company: string; count: number }) => group.company === vm.selectedEmpFollowupCompany);
    if (!selectedStillVisible) vm.selectedEmpFollowupCompany = groups[0]?.company || '';
  }

  private employeeFollowupCacheKey(vm: any, page: number): string {
    return [
      vm.empFollowupCachePrefix,
      vm.dashboardCode,
      vm.selectedEmployee?.mobile || 'all',
      vm.followupFilter || 'all',
      vm.selectedFollowupDate || 'all',
      vm.followupSearch.trim().toLowerCase() || 'all',
      `page:${page}`,
    ].join('|');
  }

  private restoreCachedEmployeeFollowupPage(vm: any, page: number, append = false): boolean {
    const payload = this.dashboardCache.get<EmployeeFollowupCachePayload>(this.employeeFollowupCacheKey(vm, page));
    if (!payload) return false;
    this.applyEmployeeFollowupPayload(vm, payload, append);
    return true;
  }

  private applyEmployeeFollowupPayload(vm: any, payload: EmployeeFollowupCachePayload, append: boolean): void {
    vm.empFollowupBookmarks = append
      ? this.mergeEmployeeBookmarks(vm.empFollowupBookmarks, payload.bookmarks || [])
      : (payload.bookmarks || []);
    vm.empFollowupPage = payload.page;
    vm.empFollowupHasMore = payload.hasMore;
    vm.empFollowupTotal = payload.total || vm.empFollowupBookmarks.length;
    vm.empFollowupsLoading = false;
    vm.empFollowupLoadingMore = false;
    this.ensureSelectedEmpFollowupCompany(vm);
  }

  private loadEmployeeFollowupPage(
    vm: any,
    page: number,
    options: { append?: boolean; reset?: boolean; forceRefresh?: boolean } = {},
  ): void {
    if (!vm.selectedEmployee || !vm.dashboardCode) return;
    if (options.append && (vm.empFollowupLoadingMore || !vm.empFollowupHasMore)) return;

    if (!options.forceRefresh && this.restoreCachedEmployeeFollowupPage(vm, page, !!options.append)) {
      if (!this.isCacheRefreshDue(vm, this.employeeFollowupCacheKey(vm, page))) return;
    }

    if (options.append) vm.empFollowupLoadingMore = true;
    else vm.empFollowupsLoading = !vm.empFollowupBookmarks.length || !!options.reset;

    this.bookmarkService.getEmployeeBookmarkPage(vm.dashboardCode, vm.selectedEmployee.mobile, {
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      search: vm.followupSearch || undefined,
      filter: vm.followupFilter !== 'all' ? vm.followupFilter : undefined,
      reminderDate: vm.selectedFollowupDate || undefined,
    }).subscribe({
      next: (res: any) => {
        const payload: EmployeeFollowupCachePayload = {
          bookmarks: res?.bookmarks || res?.items || [],
          page: res?.page || page,
          hasMore: !!res?.hasMore,
          total: Number(res?.total || 0),
        };
        this.applyEmployeeFollowupPayload(vm, payload, !!options.append);
        this.dashboardCache.set(this.employeeFollowupCacheKey(vm, page), payload, { ttlMs: vm.adminDashboardCacheTtlMs });
      },
      error: () => {
        vm.empFollowupsLoading = false;
        vm.empFollowupLoadingMore = false;
      },
    });
  }

  private flattenEmployeeContactsByCompany(vm: any, raw: unknown): Lead[] {
    if (!raw || typeof raw !== 'object') return [];
    return Object.values(raw as Record<string, unknown>).flatMap((items) => (
      Array.isArray(items) ? items.map((lead) => vm.normalizeLead(lead)) : []
    ));
  }

  private mergeEmployeeHydratedLeads(existing: Lead[], incoming: Lead[]): Lead[] {
    const byKey = new Map<string, Lead>();
    const pickKey = (lead: Lead) => lead._id || `${lead.assignedEmployeePhone || ''}:${lead.leadCompanyName || ''}:${lead.contactNumber || ''}`;
    [...existing, ...incoming].forEach((lead) => {
      if (!lead) return;
      byKey.set(pickKey(lead), lead);
    });
    return Array.from(byKey.values());
  }

  private mergeEmployeeLeadCompanies(
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

  private mergeEmployeeBookmarks(existing: Bookmark[], incoming: Bookmark[]): Bookmark[] {
    const byKey = new Map<string, Bookmark>();
    [...existing, ...incoming].forEach((bookmark) => {
      if (!bookmark) return;
      const key = bookmark._id || `${bookmark.companyName || ''}:${bookmark.contactNumber || ''}:${bookmark.employeePhone || ''}`;
      byKey.set(key, bookmark);
    });
    return Array.from(byKey.values());
  }

  private isCacheRefreshDue(vm: any, key: string): boolean {
    const metadata = this.dashboardCache.getMetadata(key);
    return !metadata || Date.now() - metadata.cachedAt >= vm.adminDashboardRefreshAfterMs;
  }

  trackByCallId(vm: any, index: number, call: any): any {
    return call._id || call.timestamp || index;
  }

  trackByEmpId(vm: any, index: number, emp: Employee): any {
    return emp.mobile || emp._id || index;
  }
}

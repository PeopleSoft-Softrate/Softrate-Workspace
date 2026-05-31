import { Injectable } from '@angular/core';
import { catchError, from, mergeMap, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { DashboardCacheService } from '../../../core/cache/dashboard-cache.service';
import { OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../../core/config/pagination.config';
import { Employee } from '../../../services/employee.service';
import { LeadService, Lead } from '../../../services/lead.service';
import { BookmarkService, Bookmark } from '../../../services/bookmark.service';

interface AdminFollowupCompanyCachePayload {
  companies: Array<{ company: string; count: number }>;
  bookmarks: Bookmark[];
  page: number;
  hasMore: boolean;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AdminFollowupsWorkflow {
  constructor(
    private bookmarkService: BookmarkService,
    private leadService: LeadService,
    private dashboardCache: DashboardCacheService
  ) {}

  private cleanFollowupCompanyName(value: unknown): string {
    const company = String(value || '').trim();
    if (!company) return '';
    return /^(unnamed\s+company|unknown|n\/a|na|-|--|—)$/i.test(company) ? '' : company;
  }

  private companyNameForBookmark(vm: any, bookmark: Bookmark | null | undefined): string {
    if (!bookmark) return '';
    const directCompany = this.cleanFollowupCompanyName(bookmark.companyName);
    if (directCompany) return directCompany;
    return this.cleanFollowupCompanyName(vm.findLeadRecordForAdminBookmark(bookmark)?.leadCompanyName);
  }

  getFilteredEmployeesLocal(vm: any): Employee[] {
    if (!vm.followupEmpLocalSearch) return vm.employees;
    const q = vm.followupEmpLocalSearch.toLowerCase();
    return vm.employees.filter((employee: Employee) => employee.name.toLowerCase().includes(q));
  }

  getFilteredTagsLocal(vm: any): string[] {
    if (!vm.followupTagLocalSearch) return vm.tagOptions;
    const q = vm.followupTagLocalSearch.toLowerCase();
    return vm.tagOptions.filter((tag: string) => tag.toLowerCase().includes(q));
  }

  toggleFollowupCompanyTag(vm: any, tag: string): void {
    const idx = vm.followupSelectedCompanyTags.indexOf(tag);
    if (idx > -1) vm.followupSelectedCompanyTags.splice(idx, 1);
    else vm.followupSelectedCompanyTags.push(tag);
  }

  isFollowupCompanyTagSelected(vm: any, tag: string): boolean {
    return vm.followupSelectedCompanyTags.includes(tag);
  }

  toggleFollowupEmp(vm: any, phone: string): void {
    const idx = vm.followupSelectedEmps.indexOf(phone);
    if (idx > -1) vm.followupSelectedEmps.splice(idx, 1);
    else vm.followupSelectedEmps.push(phone);
  }

  isFollowupEmpSelected(vm: any, phone: string): boolean {
    return vm.followupSelectedEmps.includes(phone);
  }

  selectedEmpBookmarks(vm: any): Bookmark[] {
    if (!vm.selectedEmployee) return [];
    const depsStr = vm.selectedEmployee.mobile;
    if (vm.lastAllBookmarksRefForEmp !== vm.allBookmarks || vm.selectedEmpBookmarksDepsStr !== depsStr) {
      vm.selectedEmpBookmarksCache = vm.allBookmarks.filter((bookmark: Bookmark) => bookmark.employeePhone === vm.selectedEmployee!.mobile);
      vm.lastAllBookmarksRefForEmp = vm.allBookmarks;
      vm.selectedEmpBookmarksDepsStr = depsStr;
    }
    return vm.selectedEmpBookmarksCache;
  }

  selectedEmpBookmarksFiltered(vm: any): Bookmark[] {
    const depsStr = JSON.stringify([vm.followupFilter, vm.selectedFollowupDate, vm.followupSearch]);
    if (vm.lastSelectedEmpBookmarksRefForFiltered !== vm.selectedEmpBookmarks || vm.selectedEmpBookmarksFilteredDepsStr !== depsStr) {
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
          (bookmark.remarks && bookmark.remarks.some((remark: string) => remark.toLowerCase().includes(q)))
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
    if (vm.lastSelectedEmpBookmarksFilteredRef !== vm.selectedEmpBookmarksFiltered || vm.selectedEmpBookmarksByCompanyDepsStr !== depsStr) {
      vm.selectedEmpBookmarksByCompanyCache = vm.selectedEmpBookmarksFiltered.filter((bookmark: Bookmark) => (
        (bookmark.companyName || 'Unnamed Company') === vm.selectedEmpFollowupCompany
      ));
      vm.lastSelectedEmpBookmarksFilteredRef = vm.selectedEmpBookmarksFiltered;
      vm.selectedEmpBookmarksByCompanyDepsStr = depsStr;
    }
    return vm.selectedEmpBookmarksByCompanyCache;
  }

  todayFollowupCount(vm: any): number {
    const today = new Date().toISOString().substring(0, 10);
    return vm.selectedEmpBookmarks.filter((bookmark: Bookmark) => bookmark.reminderDate && bookmark.reminderDate.substring(0, 10) === today).length;
  }

  todayGlobalFollowupCount(vm: any): number {
    const today = new Date().toISOString().substring(0, 10);
    return vm.allBookmarks.filter((bookmark: Bookmark) => bookmark.reminderDate && bookmark.reminderDate.substring(0, 10) === today).length;
  }

  groupedEmpBookmarks(vm: any): { company: string; count: number }[] {
    if (vm.lastGroupedEmpBookmarksRef !== vm.selectedEmpBookmarksFiltered) {
      const groups: { [key: string]: number } = {};
      vm.selectedEmpBookmarksFiltered.forEach((bookmark: Bookmark) => {
        const company = bookmark.companyName || 'Unnamed Company';
        groups[company] = (groups[company] || 0) + 1;
      });
      vm.groupedEmpBookmarksCache = Object.keys(groups).map((company) => ({
        company,
        count: groups[company],
      })).sort((a, b) => a.company.localeCompare(b.company));
      vm.lastGroupedEmpBookmarksRef = vm.selectedEmpBookmarksFiltered;
    }
    return vm.groupedEmpBookmarksCache;
  }

  ensureSelectedEmpFollowupCompany(vm: any): void {
    if (!vm.selectedEmployee) return;
    const groups = vm.groupedEmpBookmarks;
    const selectedStillVisible = groups.some((group: { company: string; count: number }) => group.company === vm.selectedEmpFollowupCompany);
    if (!selectedStillVisible) {
      vm.selectedEmpFollowupCompany = groups[0]?.company || '';
    }
  }

  getMatchedLeadForAdminBookmark(vm: any, bookmark: Bookmark | null | undefined): Lead | null {
    if (!bookmark) return null;
    const matchedLead = vm.findLeadRecordForAdminBookmark(bookmark);

    if (matchedLead) return matchedLead;

    const companyName = this.cleanFollowupCompanyName(bookmark.companyName);
    if (!companyName) return null;

    return {
      _id: '',
      companyCode: bookmark.companyCode,
      assignedEmployeePhone: bookmark.employeePhone,
      leadCompanyName: companyName,
      contactName: bookmark.contactName,
      contactNumber: bookmark.contactNumber,
      status: 'Follow Up',
      setLabel: 'Old Leads',
      directorEmailAddress: '',
      remarks: [...(bookmark.remarks || [])],
    } as Lead;
  }

  followupDescriptionPreview(vm: any, bookmark: Bookmark): string {
    return String(bookmark.description || '').trim();
  }

  followupRemarkPreviewList(vm: any, bookmark: Bookmark): string[] {
    return [...(bookmark.remarks || [])].filter(Boolean).reverse();
  }

  openLeadFromAdminFollowup(vm: any, bookmark: Bookmark): void {
    const matchedLead = vm.getMatchedLeadForAdminBookmark(bookmark);
    const company = this.cleanFollowupCompanyName(matchedLead?.leadCompanyName || bookmark.companyName);
    if (!company) return;

    vm.dashTab = 'leads';
    vm.sidebarOpen = false;
    vm.leadSearchQuery = '';
    vm.adminLeadStatusFilter = '';
    vm.selectedLeadCompany = company;
    vm.closeAdminLeadPanels();
    if (!vm.adminLeadCompanies.some((item: { name: string; count: number }) => item.name === company)) {
      vm.adminLeadCompanies = [{ name: company, count: 0 }, ...vm.adminLeadCompanies];
    }
    vm.loadAdminLeadContacts(false);
  }

  filteredBookmarks(vm: any): Bookmark[] {
    const depsStr = JSON.stringify([vm.followupSelectedCompanyTags, vm.followupSelectedEmps, vm.followupSearchQuery]);
    if (vm.lastAllBookmarksRefForFiltered !== vm.allBookmarks || vm.filteredBookmarksDepsStr !== depsStr) {
      vm.filteredBookmarksCache = vm.allBookmarks.filter((bookmark: Bookmark) => {
        const employee = vm.employees.find((item: Employee) => item.mobile === bookmark.employeePhone);

        if (vm.followupSelectedCompanyTags.length > 0) {
          if (!employee || !employee.tags) return false;
          const matchesCompanyTag = vm.followupSelectedCompanyTags.every((tag: string) => employee.tags!.includes(tag));
          if (!matchesCompanyTag) return false;
        }

        if (vm.followupSelectedEmps.length > 0 && !vm.followupSelectedEmps.includes(bookmark.employeePhone)) {
          return false;
        }
        if (vm.followupSearchQuery) {
          const q = vm.followupSearchQuery.toLowerCase();
          return (
            bookmark.contactName?.toLowerCase().includes(q) ||
            bookmark.contactNumber?.toLowerCase().includes(q) ||
            bookmark.companyName?.toLowerCase().includes(q) ||
            bookmark.description?.toLowerCase().includes(q) ||
            (bookmark.remarks && bookmark.remarks.some((remark: string) => remark.toLowerCase().includes(q)))
          );
        }
        return true;
      });
      vm.lastAllBookmarksRefForFiltered = vm.allBookmarks;
      vm.filteredBookmarksDepsStr = depsStr;
    }
    return vm.filteredBookmarksCache;
  }

  filteredBookmarksFiltered(vm: any): Bookmark[] {
    const depsStr = JSON.stringify([vm.followupFilter, vm.selectedFollowupDate, vm.followupSearch]);
    if (vm.lastFilteredBookmarksRefForFiltered !== vm.filteredBookmarks || vm.filteredBookmarksFilteredDepsStr !== depsStr) {
      let list = vm.filteredBookmarks;

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
          (bookmark.remarks && bookmark.remarks.some((remark: string) => remark.toLowerCase().includes(q)))
        ));
      }
      vm.filteredBookmarksFilteredCache = list;
      vm.lastFilteredBookmarksRefForFiltered = vm.filteredBookmarks;
      vm.filteredBookmarksFilteredDepsStr = depsStr;
    }
    return vm.filteredBookmarksFilteredCache;
  }

  groupedAllBookmarks(vm: any): { company: string; count: number }[] {
    if (vm.dashTab === 'followups') return vm.adminFollowupCompanies;

    if (vm.lastFilteredBookmarksFilteredRefForGrouped !== vm.filteredBookmarksFiltered) {
      const groups: { [key: string]: number } = {};
      vm.filteredBookmarksFiltered.forEach((bookmark: Bookmark) => {
        const company = this.companyNameForBookmark(vm, bookmark);
        if (!company) return;
        groups[company] = (groups[company] || 0) + 1;
      });
      vm.groupedAllBookmarksCache = Object.keys(groups).map((company) => ({
        company,
        count: groups[company],
      })).sort((a, b) => a.company.localeCompare(b.company));
      vm.lastFilteredBookmarksFilteredRefForGrouped = vm.filteredBookmarksFiltered;
    }
    return vm.groupedAllBookmarksCache;
  }

  filteredBookmarksByGlobalCompany(vm: any): Bookmark[] {
    if (!vm.selectedGlobalFollowupCompany) return [];
    const depsStr = vm.selectedGlobalFollowupCompany;
    if (vm.lastFilteredBookmarksFilteredRefForGlobal !== vm.filteredBookmarksFiltered || vm.filteredBookmarksByGlobalCompanyDepsStr !== depsStr) {
      const selectedCompany = this.cleanFollowupCompanyName(vm.selectedGlobalFollowupCompany);
      vm.filteredBookmarksByGlobalCompanyCache = vm.filteredBookmarksFiltered.filter((bookmark: Bookmark) => (
        this.companyNameForBookmark(vm, bookmark) === selectedCompany
      ));
      vm.lastFilteredBookmarksFilteredRefForGlobal = vm.filteredBookmarksFiltered;
      vm.filteredBookmarksByGlobalCompanyDepsStr = depsStr;
    }
    return vm.filteredBookmarksByGlobalCompanyCache;
  }

  selectGlobalFollowupCompany(vm: any, company: string): void {
    const normalizedCompany = this.cleanFollowupCompanyName(company);
    vm.selectedGlobalFollowupCompany = normalizedCompany;
    vm.ensureAdminFollowupLeadHydration(normalizedCompany);
  }

  ensureAdminFollowupLeadHydration(vm: any, company: string): void {
    company = this.cleanFollowupCompanyName(company);
    if (!vm.dashboardCode || !company) return;

    const bookmarks = vm.filteredBookmarksFiltered.filter((bookmark: Bookmark) => (
      this.companyNameForBookmark(vm, bookmark) === company
    ));
    const bookmarksNeedingLeads = bookmarks.filter((bookmark: Bookmark) => !vm.findLeadRecordForAdminBookmark(bookmark));
    if (!bookmarksNeedingLeads.length) return;

    const missingPhones = Array.from(new Set(
      bookmarksNeedingLeads
        .map((bookmark: Bookmark) => String(bookmark.contactNumber || '').trim())
        .filter(Boolean)
    ));
    const hydrationKey = [
      company,
      missingPhones.join(',') || 'company',
      vm.followupFilter || 'all',
      vm.selectedFollowupDate || 'all',
      vm.followupSearch.trim().toLowerCase() || 'all',
    ].join('|');

    if (
      vm.adminFollowupLeadHydrationKeys.has(hydrationKey) ||
      vm.adminFollowupLeadHydrationLoadingKeys.has(hydrationKey)
    ) {
      return;
    }

    vm.adminFollowupLeadHydrationLoadingKeys.add(hydrationKey);
    const phoneQueries = missingPhones.length ? missingPhones : [''];

    from(phoneQueries).pipe(
      mergeMap((phone) => this.leadService.getAdminLeadPage(vm.dashboardCode, {
        company,
        search: phone || undefined,
        searchMode: phone ? 'phone' : undefined,
        page: 1,
        pageSize: phone ? 5 : OPERATIONAL_PAGE_SIZE,
        paginated: true,
        includeFacets: false,
      } as any).pipe(
        catchError(() => of({ leads: [], items: [] }))
      ), 4),
    ).subscribe({
      next: (res: any) => {
        const leads = (res?.leads || res?.items || [])
          .map((lead: any) => vm.normalizeLead(lead))
          .filter((lead: Lead) => String(lead.leadCompanyName || '').trim() === company);
        if (!leads.length) return;
        vm.upsertAdminHydratedLeadRecords(leads);
      },
      error: () => {
        vm.adminFollowupLeadHydrationLoadingKeys.delete(hydrationKey);
      },
      complete: () => {
        vm.adminFollowupLeadHydrationLoadingKeys.delete(hydrationKey);
        vm.adminFollowupLeadHydrationKeys.add(hydrationKey);
      },
    });
  }

  followupLastInteraction(vm: any, bookmark: Bookmark): string {
    const latestRemark = [...(bookmark.remarks || [])].filter(Boolean).slice(-1)[0];
    if (latestRemark) return latestRemark;
    if (bookmark.description) return bookmark.description;
    const date = bookmark.updatedAt || bookmark.createdAt || bookmark.reminderDate || '';
    return date ? `Updated ${vm.fmtDate(date)}` : 'No interaction recorded';
  }

  followupCompanyPreviewLine(vm: any, company: string): string {
    company = this.cleanFollowupCompanyName(company);
    const bookmark = vm.filteredBookmarksByGlobalCompany[0] || vm.filteredBookmarksFiltered.find((item: Bookmark) => this.companyNameForBookmark(vm, item) === company);
    if (!bookmark) return '';
    const matchedLead = vm.getMatchedLeadForAdminBookmark(bookmark);
    return String(
      matchedLead?.mainDivisionDescription ||
      matchedLead?.companyDescription ||
      bookmark.description ||
      [...(bookmark.remarks || [])].filter(Boolean).slice(-1)[0] ||
      ''
    ).trim();
  }

  openEditFollowupModal(vm: any, bookmark: Bookmark): void {
    vm.editingBookmarkId = bookmark._id;
    vm.followupLead = bookmark;
    vm.followupForm = {
      brochuresSent: !!bookmark.brochuresSent,
      techMeet: !!bookmark.techMeet,
      meetingRemarks: !!bookmark.meetingRemarks,
      quotationSent: !!bookmark.quotationSent,
      proposalSent: !!bookmark.proposalSent,
      whatsappGrp: !!bookmark.whatsappGrp,
      description: bookmark.description || '',
      remarks: [...(bookmark.remarks || [])],
      newRemark: '',
      reminderDate: bookmark.reminderDate ? bookmark.reminderDate.substring(0, 10) : '',
    };
    vm.showFollowupModal = true;
    vm.updateScrollLock();
  }

  openFollowupModal(vm: any, lead: Lead): void {
    vm.editingBookmarkId = null;
    vm.followupLead = lead;
    vm.followupForm = {
      brochuresSent: false,
      techMeet: false,
      meetingRemarks: false,
      quotationSent: false,
      proposalSent: false,
      whatsappGrp: false,
      description: '',
      remarks: [...(lead.remarks || [])],
      newRemark: '',
      reminderDate: '',
    };
    vm.showFollowupModal = true;
    vm.updateScrollLock();
  }

  closeFollowupModal(vm: any): void {
    vm.showFollowupModal = false;
    vm.editingBookmarkId = null;
    vm.followupLead = null;
    vm.updateScrollLock();
  }

  removeRemark(vm: any, index: number): void {
    vm.followupForm.remarks.splice(index, 1);
  }

  async saveFollowup(vm: any): Promise<void> {
    if (!vm.editingBookmarkId && !vm.followupLead) return;
    vm.followupSaving = true;

    try {
      const finalRemarks = [...vm.followupForm.remarks];
      if (vm.followupForm.newRemark.trim()) {
        finalRemarks.push(vm.followupForm.newRemark.trim());
      }

      const payload = {
        ...vm.followupForm,
        remarks: finalRemarks,
      };
      delete (payload as any).newRemark;

      if (vm.editingBookmarkId) {
        await this.bookmarkService.updateBookmark(vm.editingBookmarkId, payload).toPromise();
      } else {
        const lead = vm.followupLead as Lead;
        const companyName = this.cleanFollowupCompanyName(lead.leadCompanyName);
        if (!companyName) {
          alert('Cannot save follow-up without a valid company name.');
          return;
        }
        await this.bookmarkService.addBulkBookmarks([{
          ...payload,
          companyCode: lead.companyCode || vm.dashboardCode,
          employeePhone: lead.assignedEmployeePhone || vm.selectedEmployee?.mobile || '',
          contactNumber: lead.contactNumber || '',
          contactName: lead.contactName || 'Primary Contact',
          companyName,
        }]).toPromise();
      }

      vm.invalidateAdminDashboardCaches();
      vm.fetchCompanyBookmarks(true);

      vm.closeFollowupModal();
    } catch (err) {
      console.error('Error updating bookmark:', err);
      alert('Failed to update follow-up. Please try again.');
    } finally {
      vm.followupSaving = false;
    }
  }

  fetchCompanyBookmarks(vm: any, forceRefresh = false, append = false): void {
    if (!vm.dashboardCode) return;

    if (append && (vm.adminFollowupCompaniesLoading || !vm.adminFollowupCompanyHasMore)) return;
    vm.adminFollowupRequestRun++;
    const run = vm.adminFollowupRequestRun;
    const page = append ? vm.adminFollowupCompanyPage + 1 : 1;

    if (!forceRefresh && vm.restoreCachedAdminFollowupCompanyPage(page, append)) {
      vm.ensureSelectedEmpFollowupCompany();
      if (!vm.isAdminDashboardCacheRefreshDue(vm.adminFollowupCompanyCacheKey(page))) return;
    } else if (!append) {
      vm.allBookmarks = [];
      vm.adminFollowupCompanies = [];
      vm.selectedGlobalFollowupCompany = '';
    }

    vm.allBookmarksLoading = !append && !vm.allBookmarks.length;
    vm.adminFollowupCompaniesLoading = true;
    this.bookmarkService.getAllCompanyBookmarks(vm.dashboardCode, {
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      search: vm.followupSearch || undefined,
      filter: vm.followupFilter !== 'all' ? vm.followupFilter : undefined,
      reminderDate: vm.selectedFollowupDate || undefined,
    }).subscribe({
      next: (res: any) => {
        if (run !== vm.adminFollowupRequestRun) return;
        vm.allBookmarksLoading = false;
        vm.adminFollowupCompaniesLoading = false;
        if (res.success) {
          const payload: AdminFollowupCompanyCachePayload = {
            companies: this.normalizeAdminFollowupCompanies(vm, res.companies, res.bookmarks || []),
            bookmarks: res.bookmarks || [],
            page: res.page || page,
            hasMore: !!res.hasMore,
            total: Number(res.total || res.totalCompanies || 0),
          };
          vm.applyAdminFollowupPagePayload(payload, append);
          this.dashboardCache.set(vm.adminFollowupCompanyCacheKey(page), payload, { ttlMs: vm.adminDashboardCacheTtlMs });
          vm.fetchLeadCallCounts();
          vm.ensureSelectedEmpFollowupCompany();
        }
      },
      error: () => {
        vm.allBookmarksLoading = false;
        vm.adminFollowupCompaniesLoading = false;
      },
    });
  }

  onFollowupFiltersChange(vm: any): void {
    if (vm.followupSearchTimer) clearTimeout(vm.followupSearchTimer);
    vm.followupSearchTimer = setTimeout(() => vm.fetchCompanyBookmarks(), SEARCH_DEBOUNCE_MS);
  }

  onAdminFollowupSidebarScroll(vm: any, event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
      vm.fetchCompanyBookmarks(false, true);
    }
  }

  adminFollowupCompanyCacheKey(vm: any, page: number): string {
    return [
      vm.adminFollowupCompanyCachePrefix,
      vm.dashboardCode,
      vm.followupFilter || 'all',
      vm.selectedFollowupDate || 'all',
      vm.followupSearch.trim().toLowerCase() || 'all',
      `page:${page}`,
    ].join('|');
  }

  restoreCachedAdminFollowupCompanyPage(vm: any, page: number, append = false): boolean {
    const payload = this.dashboardCache.get<AdminFollowupCompanyCachePayload>(vm.adminFollowupCompanyCacheKey(page));
    if (!payload) return false;
    vm.applyAdminFollowupPagePayload(payload, append);
    vm.allBookmarksLoading = false;
    vm.adminFollowupCompaniesLoading = false;
    return true;
  }

  applyAdminFollowupPagePayload(vm: any, payload: AdminFollowupCompanyCachePayload, append: boolean): void {
    const bookmarks = this.normalizeAdminFollowupBookmarks(vm, payload.bookmarks || []);
    const companies = payload.companies?.length
      ? payload.companies
      : this.normalizeAdminFollowupCompanies(vm, undefined, bookmarks);

    vm.adminFollowupCompanies = append
      ? this.mergeAdminFollowupCompanies(vm, vm.adminFollowupCompanies, companies)
      : companies;
    vm.allBookmarks = append
      ? this.mergeBookmarks(vm, vm.allBookmarks, bookmarks)
      : bookmarks;
    vm.adminFollowupCompanyPage = payload.page;
    vm.adminFollowupCompanyHasMore = payload.hasMore;
    vm.adminFollowupCompanyTotal = payload.hasMore ? (payload.total || vm.adminFollowupCompanies.length) : vm.adminFollowupCompanies.length;
    if (!append) {
      const selectedStillVisible = vm.adminFollowupCompanies.some((company: { company: string; count: number }) => (
        company.company === vm.selectedGlobalFollowupCompany
      ));
      if (!selectedStillVisible) vm.selectedGlobalFollowupCompany = vm.adminFollowupCompanies[0]?.company || '';
    }
    if (vm.selectedGlobalFollowupCompany) {
      vm.ensureAdminFollowupLeadHydration(vm.selectedGlobalFollowupCompany);
    }
  }

  normalizeAdminFollowupCompanies(vm: any, rawCompanies: any[] | undefined, bookmarks: Bookmark[]): Array<{ company: string; count: number }> {
    if (Array.isArray(rawCompanies) && rawCompanies.length) {
      return rawCompanies
        .map((item: any) => ({
          company: this.cleanFollowupCompanyName(item.company || item.name),
          count: Number(item.count || 0),
        }))
        .filter((item) => item.company && item.count > 0);
    }

    const counts = new Map<string, number>();
    bookmarks.forEach((bookmark: Bookmark) => {
      const company = this.companyNameForBookmark(vm, bookmark);
      if (!company) return;
      counts.set(company, (counts.get(company) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => a.company.localeCompare(b.company));
  }

  private normalizeAdminFollowupBookmarks(vm: any, bookmarks: Bookmark[]): Bookmark[] {
    return (bookmarks || [])
      .map((bookmark: Bookmark) => ({
        ...bookmark,
        companyName: this.companyNameForBookmark(vm, bookmark),
      }))
      .filter((bookmark: Bookmark) => !!bookmark.companyName);
  }

  mergeAdminFollowupCompanies(
    vm: any,
    existing: Array<{ company: string; count: number }>,
    incoming: Array<{ company: string; count: number }>,
  ): Array<{ company: string; count: number }> {
    const byName = new Map<string, { company: string; count: number }>();
    [...existing, ...incoming].forEach((company) => {
      const companyName = this.cleanFollowupCompanyName(company?.company);
      if (!companyName) return;
      byName.set(companyName, { ...company, company: companyName });
    });
    return Array.from(byName.values());
  }

  mergeBookmarks(vm: any, existing: Bookmark[], incoming: Bookmark[]): Bookmark[] {
    const byKey = new Map<string, Bookmark>();
    [...existing, ...incoming].forEach((bookmark: Bookmark) => {
      const companyName = this.companyNameForBookmark(vm, bookmark);
      if (!companyName) return;
      const key = bookmark._id || `${bookmark.companyName || ''}:${bookmark.employeePhone || ''}:${bookmark.contactNumber || ''}`;
      byKey.set(key, { ...bookmark, companyName });
    });
    return Array.from(byKey.values());
  }

  deleteBookmark(vm: any, id: string): void {
    if (!id) return;
    if (!confirm('Are you sure you want to remove this follow-up?')) return;

    this.bookmarkService.deleteBookmark(id).subscribe({
      next: (res: any) => {
        if (res.success) {
          vm.invalidateAdminDashboardCaches();
          vm.allBookmarks = vm.allBookmarks.filter((bookmark: Bookmark) => bookmark._id !== id);
          vm.adminFollowupCompanies = vm.adminFollowupCompanies
            .map((company: { company: string; count: number }) => ({
              ...company,
              count: vm.allBookmarks.filter((bookmark: Bookmark) => (
                this.companyNameForBookmark(vm, bookmark) === company.company
              )).length,
            }))
            .filter((company: { company: string; count: number }) => company.count > 0);
        }
      },
    });
  }

  onFollowupExcelUpload(vm: any, event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    vm.followupUploadStep = 'mapping';
    vm.parsedExcelData = [];
    vm.excelHeaders = [];

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawJson.length < 2) {
          alert('Excel file is empty.');
          vm.followupUploadStep = 'idle';
          return;
        }

        vm.excelHeaders = rawJson[0].map((header: any) => header ? header.toString().trim() : '');
        vm.parsedExcelData = [];
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;
          const rowData: any = {};
          vm.excelHeaders.forEach((header: string, index: number) => {
            if (header) rowData[header] = row[index];
          });
          vm.parsedExcelData.push(rowData);
        }

        vm.followupColumnMapping.firstName = vm.excelHeaders.find((header: string) => (
          header.toLowerCase().includes('first name') ||
          header.toLowerCase().includes('firstname') ||
          header.toLowerCase() === 'name'
        )) || '';
        vm.followupColumnMapping.lastName = vm.excelHeaders.find((header: string) => (
          header.toLowerCase().includes('last name') ||
          header.toLowerCase().includes('lastname') ||
          header.toLowerCase() === 'surname'
        )) || '';
        vm.followupColumnMapping.contactNumber = vm.excelHeaders.find((header: string) => (
          header.toLowerCase().includes('number') ||
          header.toLowerCase().includes('phone')
        )) || '';
        vm.followupColumnMapping.companyName = vm.excelHeaders.find((header: string) => header.toLowerCase().includes('company')) || '';
        vm.followupColumnMapping.description = vm.excelHeaders.find((header: string) => (
          header.toLowerCase().includes('requirement') ||
          header.toLowerCase().includes('desc')
        )) || '';
        vm.followupColumnMapping.remarks = vm.excelHeaders.find((header: string) => (
          header.toLowerCase().includes('remark') ||
          header.toLowerCase().includes('history')
        )) || '';
        vm.followupColumnMapping.reminderDate = vm.excelHeaders.find((header: string) => (
          header.toLowerCase().includes('reminder') ||
          header.toLowerCase().includes('date')
        )) || '';
      } catch (err) {
        alert('Error parsing Excel.');
        vm.followupUploadStep = 'idle';
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null;
  }

  confirmFollowupMapping(vm: any): void {
    if (!vm.followupColumnMapping.contactNumber || !vm.selectedEmployee) {
      alert('Contact Number is required.');
      return;
    }

    vm.followupUploadStep = 'uploading';
    const mappedFollowups: any[] = vm.parsedExcelData.map((row: any) => {
      const contactNumber = row[vm.followupColumnMapping.contactNumber]?.toString().trim() || '';

      let contactName = '';
      if (vm.followupColumnMapping.firstName || vm.followupColumnMapping.lastName) {
        contactName = ((row[vm.followupColumnMapping.firstName] || '') + ' ' + (row[vm.followupColumnMapping.lastName] || '')).trim();
      }
      const companyName = this.cleanFollowupCompanyName(row[vm.followupColumnMapping.companyName]);
      const description = row[vm.followupColumnMapping.description]?.toString().trim() || '';
      const remark = row[vm.followupColumnMapping.remarks]?.toString().trim() || '';
      const reminderRaw = row[vm.followupColumnMapping.reminderDate];

      let reminderDate = null;
      if (reminderRaw) {
        reminderDate = reminderRaw;
      }

      const proposalSent = vm.followupColumnMapping.proposalSent ? (
        row[vm.followupColumnMapping.proposalSent]?.toString().toLowerCase().includes('sent')
      ) : false;
      const meetingDone = vm.followupColumnMapping.meetingRemarks ? (
        row[vm.followupColumnMapping.meetingRemarks]?.toString().toLowerCase().includes('done')
      ) : false;

      return {
        companyCode: vm.dashboardCode,
        employeePhone: vm.selectedEmployee!.mobile,
        contactNumber,
        contactName,
        companyName,
        description,
        remarks: remark ? [remark] : [],
        reminderDate,
        proposalSent,
        meetingRemarks: meetingDone,
      };
    }).filter((followup: any) => followup.contactNumber && followup.companyName);

    if (!mappedFollowups.length) {
      vm.followupUploadStep = 'idle';
      alert('No valid follow-ups found. Each row needs a contact number and company name.');
      return;
    }

    this.bookmarkService.addBulkBookmarks(mappedFollowups).subscribe({
      next: (res: any) => {
        vm.followupUploadStep = 'idle';
        if (res.success) {
          alert(`Imported ${res.count} interested clients!`);
          vm.invalidateAdminDashboardCaches();
          vm.fetchCompanyBookmarks(true);
        }
      },
      error: () => {
        vm.followupUploadStep = 'idle';
        alert('Error importing data.');
      },
    });
  }
}

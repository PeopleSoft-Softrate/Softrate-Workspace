import { Injectable } from '@angular/core';
import { finalize } from 'rxjs';
import { FinanceApiService } from '../data/finance-api.service';
import { amcDetailRows, employeeClaimDetailRows, invoiceDetailRows, moneyOrCount, paymentStatus, titleize } from '../domain/finance-formatters';
import { FINANCE_NAV_GROUPS, FinanceGroupId, FinanceNavGroup, isIntegratedFinanceView } from '../domain/finance-navigation.model';
import { FinanceAnalyticsItem, FinanceDetailItem, FinanceListResponse, FinanceQuery, FinanceRecord } from '../domain/finance-record.model';

const DEFAULT_FINANCE_COMPANY_CODE = 'STP-1603-2026';

@Injectable()
export class FinanceWorkspaceViewModel {
  companyCode = this.storedFinanceCompanyCode();
  dateFilterType: 'this-month' | 'last-30-days' | 'custom-month' = 'this-month';
  customMonth = '';
  customMonthPart = '';
  customYearPart = '';
  search = '';

  get yearOptions(): string[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => String(currentYear - i));
  }

  sidebarFeatureSearch = '';
  sidebarOpen = false;
  sidebarMinimized = false;
  financeFeatureOpen = true;
  profileMenuOpen = false;
  activeGroup: FinanceGroupId = 'receivables';
  activeView = 'invoices';
  statusFilter = this.defaultStatusForView(this.activeView);
  page = 1;
  pageSize = 20;
  loading = false;
  error = '';
  payload?: FinanceListResponse;
  selectedRecord?: FinanceRecord;
  showDetailDialog = false;
  approvingClaimId = '';

  readonly navGroups = FINANCE_NAV_GROUPS;
  get statusOptions(): string[] {
    switch (this.activeView) {
      case 'invoices':
        return ['All Status', 'Paid', 'Unpaid', 'Overdue', 'Partially Paid'];
      case 'employee-claims':
      case 'company-expenses':
        return ['All Status', 'Pending Finance Approval', 'Finance Verified', 'Submitted', 'Paid', 'Rejected'];
      case 'vendor-bills':
      case 'purchase-orders':
        return ['All Status', 'Pending', 'Paid', 'Overdue', 'Rejected'];
      case 'payroll-runs':
        return ['All Status', 'Draft', 'Processed', 'Paid'];
      default:
        return ['All Status', 'Paid', 'Unpaid', 'Pending', 'Overdue'];
    }
  }

  constructor(private readonly api: FinanceApiService) {}

  private toLocalIsoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get dateFrom(): string {
    const today = new Date();
    if (this.dateFilterType === 'this-month') {
      return this.toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (this.dateFilterType === 'last-30-days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return this.toLocalIsoDate(d);
    } else if (this.dateFilterType === 'custom-month' && this.customMonth) {
      const [year, month] = this.customMonth.split('-');
      if (year && month) {
        return this.toLocalIsoDate(new Date(Number(year), Number(month) - 1, 1));
      }
    }
    return '';
  }

  get totalPages(): number {
    return this.payload?.totalPages || 0;
  }

  get totalItems(): number {
    return this.payload?.totalItems || 0;
  }

  get dateTo(): string {
    const today = new Date();
    if (this.dateFilterType === 'this-month') {
      return this.toLocalIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    } else if (this.dateFilterType === 'last-30-days') {
      return this.toLocalIsoDate(today);
    } else if (this.dateFilterType === 'custom-month' && this.customMonth) {
      const [year, month] = this.customMonth.split('-');
      if (year && month) {
        return this.toLocalIsoDate(new Date(Number(year), Number(month), 0));
      }
    }
    return '';
  }

  private storedFinanceCompanyCode(): string {
    const financeCompanyCode = localStorage.getItem('financeCompanyCode')?.trim();
    if (financeCompanyCode) return financeCompanyCode;

    const crmUserCode = this.crmUserCompanyCode();
    if (crmUserCode) return crmUserCode;

    return localStorage.getItem('companyCode')?.trim() || DEFAULT_FINANCE_COMPANY_CODE;
  }


  private crmUserCompanyCode(): string {
    const rawUser = localStorage.getItem('tracecall_user');
    if (!rawUser) return '';

    try {
      const user = JSON.parse(rawUser);
      const companyName = String(user?.companyName || '').trim().toLowerCase();
      if (companyName.includes('softrate tech park')) return DEFAULT_FINANCE_COMPANY_CODE;
      return String(user?.salesCompanyCode || user?.adminCompanyCode || user?.companyCode || '').trim();
    } catch {
      return '';
    }
  }

  get activeNav(): FinanceNavGroup {
    return this.navGroups.find((item) => item.id === this.activeGroup) || this.navGroups[0];
  }

  get activeLabel(): string {
    return this.activeNav.children.find((item) => item.id === this.activeView)?.label || this.activeNav.label;
  }

  get isIntegratedView(): boolean {
    return isIntegratedFinanceView(this.activeGroup, this.activeView);
  }

  get placeholderMessage(): string {
    return `${this.activeLabel} to be integrated.`;
  }

  get filteredNavGroups(): FinanceNavGroup[] {
    const term = this.sidebarFeatureSearch.trim().toLowerCase();
    if (!term) return this.navGroups;

    return this.navGroups
      .map((group) => {
        const groupMatches = group.label.toLowerCase().includes(term);
        const children = group.children.filter((child) => groupMatches || child.label.toLowerCase().includes(term));
        return { ...group, children };
      })
      .filter((group) => group.children.length > 0);
  }

  get companyInitials(): string {
    const source = this.companyCode.trim() || 'Finance';
    return source
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'F';
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleSidebarMinimized(): void {
    this.sidebarMinimized = !this.sidebarMinimized;
  }

  toggleProfileMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  selectNav(group: FinanceNavGroup, view: string): void {
    this.activeGroup = group.id;
    this.activeView = view;
    this.search = '';
    this.page = 1;
    this.statusFilter = this.defaultStatusForView(view);
    this.sidebarOpen = false;
    this.loadActive();
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter = status;
    this.page = 1;
    this.loadActive();
  }

  onDateFilterChange(): void {
    if (this.dateFilterType !== 'custom-month') {
      this.customMonth = '';
    } else {
      const today = new Date();
      this.customMonthPart = String(today.getMonth() + 1).padStart(2, '0');
      this.customYearPart = String(today.getFullYear());
      this.customMonth = `${this.customYearPart}-${this.customMonthPart}`;
    }
    this.page = 1;
    this.loadActive();
  }

  onCustomMonthChange(): void {
    if (this.dateFilterType === 'custom-month') {
      if (this.customMonthPart && this.customYearPart) {
        this.customMonth = `${this.customYearPart}-${this.customMonthPart}`;
      }
      this.page = 1;
      this.loadActive();
    }
  }

  onSearchChange(): void {
    this.page = 1;
    this.loadActive();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.loadActive();
  }

  loadActive(): void {
    this.error = '';

    if (!this.isIntegratedView) {
      this.loading = false;
      return;
    }

    this.companyCode = this.companyCode.trim() || DEFAULT_FINANCE_COMPANY_CODE;

    if (!this.companyCode) {
      this.error = 'Enter a company code to sync finance data.';
      return;
    }

    localStorage.setItem('financeCompanyCode', this.companyCode.trim());

    this.loading = true;
    const query = this.activeQuery();
    const request = this.activeGroup === 'expenses'
      ? this.api.expenses(this.activeView, query)
      : this.api.receivables(this.activeView, query);

    request
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (response) => this.payload = response,
        error: (err) => this.error = err?.error?.message || 'Finance records could not be loaded.',
      });
  }

  approveEmployeeClaim(record: FinanceRecord): void {
    const claimId = String(record.id || record['_id'] || record['sourceId'] || '').trim();
    if (!claimId || this.approvingClaimId) return;

    this.error = '';
    this.approvingClaimId = claimId;
    this.api.approveEmployeeClaim(claimId, this.companyCode.trim())
      .pipe(finalize(() => this.approvingClaimId = ''))
      .subscribe({
        next: () => this.loadActive(),
        error: (err) => this.error = err?.error?.message || 'Employee claim could not be approved.',
      });
  }

  private defaultStatusForView(view = this.activeView): string {
    return 'All Status';
  }

  private activeQuery(): FinanceQuery {
    const query: FinanceQuery = {
      companyCode: this.companyCode.trim(),
      from: this.dateFrom,
      to: this.dateTo,
      page: this.page,
      limit: this.pageSize,
    };
    if (this.statusFilter !== 'All Status') {
      query.status = this.statusFilter;
    }
    const search = this.search.trim().toLowerCase();
    if (search) {
      query.search = search;
    }
    return query;
  }

  rows(): FinanceRecord[] {
    return this.payload?.items || [];
  }

  analytics(): FinanceAnalyticsItem[] {
    return Object.entries(this.payload?.analytics || {})
      .filter(([, value]) => typeof value === 'number')
      .map(([key, value]) => ({ label: titleize(key), value: moneyOrCount(value as number, key) }));
  }

  openDetail(record: FinanceRecord): void {
    this.selectedRecord = record;
    this.showDetailDialog = true;
  }

  closeDetail(): void {
    this.showDetailDialog = false;
    this.selectedRecord = undefined;
  }

  detailRows(): FinanceDetailItem[] {
    if (this.activeView === 'amc-renewals') return amcDetailRows(this.selectedRecord);
    if (this.activeView === 'employee-claims') return employeeClaimDetailRows(this.selectedRecord);
    return invoiceDetailRows(this.selectedRecord);
  }
}

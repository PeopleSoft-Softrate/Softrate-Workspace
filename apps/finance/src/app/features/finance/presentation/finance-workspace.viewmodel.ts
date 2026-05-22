import { Injectable } from '@angular/core';
import { finalize } from 'rxjs';
import { FinanceApiService } from '../data/finance-api.service';
import { amcDetailRows, invoiceDetailRows, moneyOrCount, paymentStatus, titleize } from '../domain/finance-formatters';
import { FINANCE_NAV_GROUPS, FinanceGroupId, FinanceNavGroup, isIntegratedFinanceView } from '../domain/finance-navigation.model';
import { FinanceAnalyticsItem, FinanceDetailItem, FinanceListResponse, FinanceRecord } from '../domain/finance-record.model';

const DEFAULT_FINANCE_COMPANY_CODE = 'STP-1603-2026';

@Injectable()
export class FinanceWorkspaceViewModel {
  companyCode = this.storedFinanceCompanyCode();
  dateFrom = '';
  dateTo = '';
  search = '';
  statusFilter = 'All Status';
  sidebarFeatureSearch = '';
  sidebarOpen = false;
  sidebarMinimized = false;
  financeFeatureOpen = true;
  profileMenuOpen = false;
  activeGroup: FinanceGroupId = 'receivables';
  activeView = 'invoices';
  loading = false;
  error = '';
  payload?: FinanceListResponse;
  selectedRecord?: FinanceRecord;
  showDetailDialog = false;

  readonly navGroups = FINANCE_NAV_GROUPS;
  readonly statusOptions = ['All Status', 'Paid', 'Unpaid', 'Overdue', 'Pending', 'Partially Paid'];

  constructor(private readonly api: FinanceApiService) {}

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
    this.statusFilter = 'All Status';
    this.sidebarOpen = false;
    this.loadActive();
  }

  loadActive(): void {
    this.error = '';
    this.payload = undefined;

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
    this.api.receivables(this.activeView, {
      companyCode: this.companyCode.trim(),
      from: this.dateFrom,
      to: this.dateTo,
    })
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (response) => this.payload = response,
        error: (err) => this.error = err?.error?.message || 'Finance records could not be loaded.',
      });
  }

  rows(): FinanceRecord[] {
    const rows = this.payload?.items || [];
    const search = this.search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !search || JSON.stringify(row || {}).toLowerCase().includes(search);
      const status = paymentStatus(row).toLowerCase();
      const matchesStatus = this.statusFilter === 'All Status' || status === this.statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
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
    return this.activeView === 'amc-renewals'
      ? amcDetailRows(this.selectedRecord)
      : invoiceDetailRows(this.selectedRecord);
  }
}

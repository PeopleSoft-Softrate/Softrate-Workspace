import { Component, ElementRef, HostListener, OnInit, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgIf, NgFor, DatePipe, DecimalPipe, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { firstValueFrom, Subscription } from 'rxjs';
import { RealtimeService, SSEEvent } from '../../realtime.service';
import { ApiService } from '../../api.service';
import { DashboardCacheService } from '../../core/cache/dashboard-cache.service';
import { OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../core/config/pagination.config';
import { AiBrief, AiBriefService } from '../../ai-brief.service';
import { numberToWords } from '../invoices/domain/invoice-formatters';
import {
  AiSuggestion,
  AiSuggestionScenario,
  AiSuggestionService,
} from '../../ai-suggestion.service';
import { EmployeePageId } from '../../core/layout/employee-pages';
import {
  EmployeeLeadsState,
  EmployeeLeadsViewModel,
} from '../leads/presentation/employee-leads.viewmodel';
import { InvoicesRepository } from '../invoices/data/invoices.repository';
import { QuotationsRepository } from '../quotations/data/quotations.repository';
import { EmployeeLeadCardComponent } from '../leads/presentation/employee-lead-card.component';
import { EmployeeLeadDetailComponent } from '../leads/presentation/employee-lead-detail.component';
import { Lead as EmployeeLeadModel, LeadDrawerSection, LeadHistoryLog } from '../leads/domain/lead.model';

type EmployeeLeadScope = Partial<Pick<EmployeeLeadsState, 'search' | 'status' | 'statuses' | 'isFavourite' | 'updatedFrom' | 'updatedTo' | 'setLabel' | 'division'>>;

interface Employee {
  _id: string;
  name: string;
  mobile: string;
  companyCode: string;
  countryCode?: string;
  profilePhoto?: string;
  tags?: string[];
  lastSyncTime?: string;
  lastCallTime?: string;
}

interface Lead {
  _id: string;
  companyCode: string;
  assignedEmployeePhone: string;
  leadCompanyName: string;
  contactName: string;
  contactNumber: string;
  status: string;
  setLabel: string;
  companyDescription?: string;
  mainDivisionDescription?: string;
  directorEmailAddress?: string;
  address?: string;
  remarks?: string[];
  isStarred?: boolean;
  isFavourite?: boolean;
  sheetOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Bookmark {
  _id: string;
  companyCode: string;
  employeePhone: string;
  contactNumber: string;
  contactName: string;
  companyName: string;
  description: string;
  remarks: string[];
  brochuresSent: boolean;
  techMeet: boolean;
  meetingRemarks: boolean;
  quotationSent: boolean;
  proposalSent: boolean;
  whatsappGrp: boolean;
  reminderDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface LeadCompanyFacet {
  name: string;
  count: number;
  clientId?: string;
  primaryContactName?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  address?: string;
  source?: string;
  sourceLeadIds?: string[];
  onboardedAt?: string;
  updatedAt?: string;
}

interface ClientRecord {
  _id: string;
  id?: string;
  companyCode: string;
  clientId: string;
  companyName: string;
  leadCompanyName?: string;
  primaryContact?: string;
  primaryContactName?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  address?: string;
  description?: string;
  status?: string;
  source?: string;
  sourceLeadIds?: string[];
  assignedEmployeePhones?: string[];
  onboardedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CachedLeadCompanyPage {
  companies: LeadCompanyFacet[];
  contactsByCompany: Record<string, Lead[]>;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

interface InvoiceRecord {
  _id: string;
  invoiceNumber: string;
  publicToken?: string;
  publicUrl?: string;
  clientId?: string;
  leadCompanyName: string;
  contactName: string;
  contactNumber: string;
  directorEmailAddress?: string;
  employeePhone?: string;
  employeeName?: string;
  total: number;
  invoiceDate: string;
  createdAt?: string;
  dueDate?: string;
  versionNo?: number;
  paymentStatus?: string;
  items?: Array<{ name: string; quantity: number; rate: number; total: number; sacHsn?: string; taxable?: number; cgst?: number; sgst?: number }>;
  subtotal?: number;
  gstPercentage?: number;
  cgst?: number;
  sgst?: number;
  gstAmount?: number;
  companySnapshot?: any;
  clientSnapshot?: any;
}

interface QuotationRecord {
  _id: string;
  quotationNumber: string;
  leadCompanyName: string;
  contactName: string;
  contactNumber: string;
  directorEmailAddress?: string;
  total: number;
  quotationDate: string;
  createdAt?: string;
  versionNo?: number;
  kindNote?: string;
  items?: Array<{ name: string; quantity: number; rate: number; total: number; taxable?: number; gst?: number; sacHsn?: string }>;
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  companySnapshot?: any;
}

interface CompanyFullViewNote {
  _id: string;
  text: string;
  createdAt?: string;
}

interface CompanyFullViewProfile {
  leadCompanyName: string;
  alternatePhone: string;
  alternateEmail: string;
  notes: CompanyFullViewNote[];
  updatedAt?: string;
  createdAt?: string;
}

type CompanyFullSection = 'overview' | 'followups' | 'remarks' | 'invoices' | 'quotations' | 'alternate' | 'notes';

interface CallStats {
  incoming: number;
  outgoing: number;
  missed: number;
  rejected: number;
  connected: number;
  totalDuration: number;
  incomingDuration: number;
  outgoingDuration: number;
  total: number;
}

type DrawerSection = LeadDrawerSection;
type OverviewPeriod = 'today' | 'yesterday' | 'lastweek';
const DEFAULT_QUOTATION_KIND_NOTE = 'We aim to provide the best software to automate your business with high quality at affordable cost.';
const DEFAULT_QUOTATION_TERMS = [
  'All rates quoted are valid for 14 days.',
  '40% payment should be done in advance.',
  'The remaining amount should be paid within 7 days of invoice.',
];

interface QuotationBankRow {
  label: string;
  value: string;
}

interface OverviewPeriodCache {
  stats: CallStats | null;
  timeline: any[];
  loaded: boolean;
}

interface LeadCollections {
  filteredLeads: Lead[];
  uniqueLeadCompanies: string[];
  interestedLeads: Lead[];
  uniqueInterestedCompanies: string[];
  dnpLeads: Lead[];
  uniqueDnpCompanies: string[];
  convertedLeads: Lead[];
  uniqueConvertedCompanies: string[];
  favouriteLeads: Lead[];
  uniqueFavouriteCompanies: string[];
  rawTodayModifiedLeads: Lead[];
  todayModifiedLeads: Lead[];
  todayStatusCounts: Record<string, number>;
  uniqueTodayModifiedCompanies: string[];
  overviewRecentLeads: Lead[];
  overviewTopCompanies: Array<{ name: string; count: number }>;
  leadCompanyCounts: Record<string, number>;
  todayUpdateCompanyCounts: Record<string, number>;
  totalLeadsCount: number;
  convertedLeadsCount: number;
  pendingLeadsCount: number;
}

interface FollowupCollections {
  filteredFollowups: Bookmark[];
  uniqueFollowupCompanies: string[];
  followupCompanyCounts: Record<string, number>;
  overviewUpcomingFollowups: Bookmark[];
  todayFollowupsCount: number;
}

interface WorkspaceState {
  activeLeadViewCompanies: string[];
  activeSelectedCompany: string;
  activeLeadRows: Lead[];
  currentSelectedLead: Lead | null;
  activeFollowupCompany: string;
  followupsInActiveCompany: Bookmark[];
  currentSelectedFollowup: Bookmark | null;
}

type OverviewTableKey = 'activity' | 'upcoming';

interface OverviewColumnResizeState {
  table: OverviewTableKey;
  columnIndex: number;
  startX: number;
  startWidths: number[];
  tableWidth: number;
}

interface CachedOverviewPeriodData {
  stats: CallStats | null;
  timeline: any[];
}

interface PagedViewState {
  page: number;
  hasMore: boolean;
  total: number;
  loadingMore: boolean;
}

interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

@Component({
  selector: 'app-employee-workspace',
  standalone: true,
  imports: [NgIf, NgFor, NgTemplateOutlet, FormsModule, DatePipe, DecimalPipe, UpperCasePipe, EmployeeLeadCardComponent, EmployeeLeadDetailComponent],
  templateUrl: './employee-workspace.component.html',
  styleUrl: './employee-workspace.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class EmployeeWorkspaceComponent implements OnInit, OnDestroy {
  @ViewChild('followupDetailPanel') private followupDetailPanel?: ElementRef<HTMLElement>;
  @ViewChild('followupDetailsSection') private followupDetailsSection?: ElementRef<HTMLElement>;
  @ViewChild('followupEditSection') private followupEditSection?: ElementRef<HTMLElement>;
  @ViewChild('followupHistorySection') private followupHistorySection?: ElementRef<HTMLElement>;
  @ViewChild('companyFullScrollContent') private companyFullScrollContent?: ElementRef<HTMLElement>;

  private sseSub?: Subscription;
  private leadVmSub?: Subscription;
  private followupScrollSyncLocked = false;
  private followupScrollUnlockHandle: ReturnType<typeof setTimeout> | null = null;

  // ── Auth ─────────────────────────────────────────────────────
  loggedIn = false;
  loginLoading = false;
  loginError = '';
  loginForm = { companyCode: '', mobile: '', countryCode: '+91' };

  employee: Employee | null = null;
  companyName = '';
  profileMenuOpen = false;
  readonly profilePhotoMaxFileSizeMb = 5;
  readonly profilePhotoOutputSize = 320;
  profilePhotoSaving = false;
  profilePhotoError = '';
  profilePhotoSuccess = '';
  profileEditorOpen = false;
  profileEditorImageSrc = '';
  profileEditorScale = 1;
  profileEditorMinScale = 1;
  profileEditorMaxScale = 3;
  profileEditorOffsetX = 0;
  profileEditorOffsetY = 0;
  private profileEditorDragging = false;
  private profileEditorDragStartX = 0;
  private profileEditorDragStartY = 0;
  private profileEditorStartOffsetX = 0;
  private profileEditorStartOffsetY = 0;
  showSplash = true;
  startupWarmupDone = false;
  private startupWarmupPromise: Promise<void> | null = null;
  private readonly startupSplashMinMs = 2200;
  private readonly startupSplashMaxMs = 12000;
  private startupSplashFallbackRef: any;
  private startupWarmupRunId = 0;

  // ── Dashboard tabs ────────────────────────────────────────────
  dashTab: EmployeePageId = 'overview';
  sidebarFeatureSearch = '';

  // ── Period ────────────────────────────────────────────────────
  selectedPeriod: OverviewPeriod = 'today';

  // ── Call Stats ────────────────────────────────────────────────
  callStats: CallStats | null = null;
  statsLoading = false;
  donutChart: Chart | null = null;
  timelineChart: Chart | null = null;
  timelineData: any[] = [];
  chartType: 'line' | 'bar' = 'line';
  private overviewPeriodCache: Record<OverviewPeriod, OverviewPeriodCache> = {
    today: { stats: null, timeline: [], loaded: false },
    yesterday: { stats: null, timeline: [], loaded: false },
    lastweek: { stats: null, timeline: [], loaded: false },
  };
  overviewActivityColumnWidths = [42, 20, 18, 20];
  overviewUpcomingColumnWidths = [52, 23, 25];
  private readonly overviewColumnMinWidths: Record<OverviewTableKey, number[]> = {
    activity: [240, 150, 140, 130],
    upcoming: [240, 160, 140],
  };
  private activeOverviewColumnResize: OverviewColumnResizeState | null = null;

  // ── Leads ─────────────────────────────────────────────────────
  allLeads: Lead[] = [];
  leads: Lead[] = [];
  leadsLoading = false;
  isSearching = false;
  private employeeScopedLeads: Lead[] = [];
  private _leadSearch = '';
  private _searchTimeout: any;
  private leadFetchRun = 0;
  private readonly leadPageSize = OPERATIONAL_PAGE_SIZE;
  private readonly leadCompanyPageSize = OPERATIONAL_PAGE_SIZE;
  private serverLeadSets: string[] = [];
  private serverLeadDivisions: string[] = [];
  employeeLeadCompanies: LeadCompanyFacet[] = [];
  employeeLeadCompanyTotal = 0;
  employeeLeadCompanyPage = 1;
  employeeLeadCompanyHasMore = false;
  employeeLeadCompaniesLoading = false;
  employeeLeadContactsPage = 1;
  employeeLeadContactsHasMore = false;
  employeeLeadContactsLoadingMore = false;

  todayCalls: any[] = [];
  todayCallsLoading = false;
  todayCallsLoadingMore = false;
  todayCallsPage = 1;
  todayCallsHasMore = false;
  todayCallsTotal = 0;
  private todayCallsLoaded = false;

  get leadSearch(): string {
    return this._leadSearch;
  }

  set leadSearch(val: string) {
    const previousTrimmed = this._leadSearch.trim();
    this._leadSearch = val;
    const trimmed = this._leadSearch.trim();
    const redirectFromOverview = !!this.employee && this.dashTab === 'overview' && !!trimmed;
    if (redirectFromOverview) {
      this.prepareGlobalLeadSearchContext();
    } else if (this.isLeadWorkspaceTab()) {
      this.resetActiveLeadSelectionForSearch(!!previousTrimmed && !trimmed);
    }
    this.isSearching = !!this.employee && previousTrimmed !== trimmed;
    if (this._searchTimeout) clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      if (trimmed !== this._leadSearch.trim()) return;
      if (!this.employee) {
        this.isSearching = false;
        this.workspaceStateCache = null;
        return;
      }

      if (redirectFromOverview || this.isLeadWorkspaceTab()) {
        if (redirectFromOverview) {
          this.prepareGlobalLeadSearchContext();
        }
        this.fetchLeads({ forceRefresh: !!trimmed });
      } else if (this.dashTab === 'followups') {
        this.fetchFollowups(true);
      } else if (this.dashTab === 'invoices') {
        this.invoiceSearch = trimmed;
        this.invoiceHistorySearch = trimmed;
        this.onInvoiceSearchChange();
        this.onInvoiceHistoryQueryChange();
      } else if (this.dashTab === 'client-onboarding') {
        this.clientOnboardingSearch = trimmed;
        this.onClientOnboardingSearchChange();
      } else if (this.dashTab === 'quotations') {
        this.quotationSearch = trimmed;
        this.quotationHistorySearch = trimmed;
        this.onQuotationSearchChange();
        this.onQuotationHistoryQueryChange();
      } else {
        this.isSearching = false;
        this.workspaceStateCache = null;
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  get globalSearchLoading(): boolean {
    return this.isSearching;
  }

  private finishGlobalSearchIfSettled(): void {
    if (!this.isSearching) return;
    const hasActiveLoad = this.leadsLoading ||
      this.employeeLeadCompaniesLoading ||
      this.employeeLeadContactsLoadingMore ||
      this.followupsLoading ||
      this.followupsLoadingMore ||
      this.todayCallsLoading ||
      this.invoiceEligibleLeadsLoading ||
      this.invoiceRecordsLoading ||
      this.clientOnboardingLoading ||
      this.quotationLeadsLoading ||
      this.quotationRecordsLoading;
    if (!hasActiveLoad) this.isSearching = false;
  }

  sidebarFeatureMatches(label: string): boolean {
    const query = this.sidebarFeatureSearch.trim().toLowerCase();
    return !query || label.toLowerCase().includes(query);
  }

  sidebarSectionHas(labels: string[]): boolean {
    return labels.some((label) => this.sidebarFeatureMatches(label));
  }

  private _selectedLeadCompany = '';
  tabSelections: Record<string, string> = {
    overview: '',
    leads: '',
    followups: '',
    interested: '',
    dnp: '',
    converted: '',
    favourite: '',
    'today-calls': '',
    invoices: '',
    'client-onboarding': '',
    quotations: ''
  };
  private leadSetSelections: Partial<Record<EmployeePageId, string>> = {
    leads: '',
    interested: '',
    dnp: '',
    converted: '',
    favourite: '',
    'today-calls': '',
  };
  private leadDivisionSelections: Partial<Record<EmployeePageId, string>> = {
    leads: '',
    interested: '',
    dnp: '',
    converted: '',
    favourite: '',
  };
  leadRemarksInputs: { [key: string]: string } = {};
  followupRemarkInputs: { [key: string]: string } = {};
  todayFilterStatus: string = 'All';
  historyFilterDate: string = this.todayInputDate;
  remarkPostingIds = new Set<string>();
  followupRemarkPostingIds = new Set<string>();
  productRemarks: string[] = [];
  followupRemarkMenuOpenId = '';
  private followupRemarkMenuCloseRef: ReturnType<typeof setTimeout> | null = null;
  companyFullRemarkMenuOpen = false;
  private companyFullRemarkMenuCloseRef: ReturnType<typeof setTimeout> | null = null;
  aiBrief: AiBrief | null = null;
  aiBriefLoading = false;
  aiBriefError = '';
  aiBriefCacheStatus: 'hit' | 'miss' | '' = '';
  aiBriefCompany = '';
  aiBriefLeadId = '';
  aiBriefOpenTarget = '';
  aiBriefFullViewOpen = false;
  companyFullViewOpen = false;
  companyFullActiveSection: CompanyFullSection = 'overview';
  private readonly companyFullBaseSections: Array<{ id: CompanyFullSection; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'followups', label: 'Followups' },
    { id: 'remarks', label: 'Remarks History' },
    { id: 'invoices', label: 'Invoice History' },
    { id: 'quotations', label: 'Quotation History' },
    { id: 'alternate', label: 'Alternate Info' },
    { id: 'notes', label: 'Notes' },
  ];
  companyFullLoading = false;
  companyFullProfileLoading = false;
  companyFullHistoryLoading = false;
  companyFullInvoiceLoading = false;
  companyFullQuotationLoading = false;
  companyFullFollowupLoading = false;
  companyFullSavingAlternateInfo = false;
  companyFullNoteSaving = false;
  companyFullRemarkSaving = false;
  companyFullFollowupSaving = false;
  companyFullProfileError = '';
  companyFullHistoryError = '';
  companyFullInvoiceError = '';
  companyFullQuotationError = '';
  companyFullRemarkError = '';
  companyFullFollowupError = '';
  companyFullProfile: CompanyFullViewProfile = {
    leadCompanyName: '',
    alternatePhone: '',
    alternateEmail: '',
    notes: [],
  };
  companyFullHistoryLogs: LeadHistoryLog[] = [];
  companyFullRemarksHistory: LeadHistoryLog[] = [];
  companyFullInvoiceItems: InvoiceRecord[] = [];
  companyFullQuotationItems: QuotationRecord[] = [];
  companyFullFollowups: Bookmark[] = [];
  companyFullAlternatePhone = '';
  companyFullAlternateEmail = '';
  companyFullRemarkDraft = '';
  companyFullNoteDraft = '';
  companyFullContextLead: Lead | null = null;
  companyFullFollowupForm = {
    brochuresSent: false,
    techMeet: false,
    meetingRemarks: false,
    quotationSent: false,
    proposalSent: false,
    whatsappGrp: false,
    description: '',
    newRemark: '',
    reminderDate: '',
  };
  companyRemarkLead: Lead | null = null;
  private aiBriefRequestSeq = 0;
  private aiBriefMemoryCache = new Map<
    string,
    {
      insight: AiBrief;
      cacheStatus: 'hit' | 'miss' | '';
      companyName: string;
      leadId: string;
    }
  >();

  get companyFullSections(): Array<{ id: CompanyFullSection; label: string }> {
    return this.companyFullBaseSections.filter((section) => (
      section.id !== 'followups' || this.companyFullHasFollowupSection()
    ));
  }
  detailAiSuggestion: AiSuggestion | null = null;
  detailAiSuggestionLoading = false;
  detailAiSuggestionError = '';
  detailAiSuggestionScenario: AiSuggestionScenario | '' = '';
  detailAiSuggestionGeneratedAt = '';
  private detailAiSuggestionRequestSeq = 0;
  modalAiSuggestion: AiSuggestion | null = null;
  modalAiSuggestionLoading = false;
  modalAiSuggestionError = '';
  modalAiSuggestionGeneratedAt = '';
  private modalAiSuggestionRequestSeq = 0;

  get selectedLeadCompany(): string {
    return this._selectedLeadCompany;
  }

  set selectedLeadCompany(value: string) {
    const nextValue = (value || '').trim();
    if (this._selectedLeadCompany === nextValue) return;

    this._selectedLeadCompany = nextValue;
    this.workspaceStateCache = null;

    if (!nextValue) {
      this.closeAiBriefPopup();
      this.resetAiBriefState();
      this.resetDetailAiSuggestionState();
      return;
    }

    this.resetAiForActiveSelection();
  }

  // ── History Modal ─────────────────────────────────────────────
  showHistoryModal = false;
  historyLogs: LeadHistoryLog[] = [];
  historyLoading = false;
  historyLead: Lead | null = null;
  drawerSection: DrawerSection = 'details';
  selectedLeadId = '';
  selectedFollowupId = '';
  private leadStateVersion = 0;
  private followupStateVersion = 0;
  private leadCollectionsCache: { key: string; value: LeadCollections } | null = null;
  private followupCollectionsCache: { key: string; value: FollowupCollections } | null = null;
  private workspaceStateCache: { key: string; value: WorkspaceState } | null = null;

  openHistory(lead: Lead): void {
    this.selectLeadRecord(lead, 'history');
    this.closeAiBriefPopup();
    this.loadHistoryForLead(lead);
  }

  private loadHistoryForLead(lead: Lead): void {
    this.historyLead = lead;
    this.historyLogs = [];
    this.historyLoading = true;
    this.showHistoryModal = true;
    this.employeeLeadsVm.openHistory(this.toEmployeeLeadModel(lead));
  }

  closeHistoryModal(): void {
    const lead = this.currentSelectedLead || this.historyLead;
    this.showHistoryModal = false;
    this.historyLead = null;
    this.historyLogs = [];
    if (this.drawerSection === 'history') this.drawerSection = 'details';
    if (lead) this.employeeLeadsVm.openDetails(this.toEmployeeLeadModel(lead));
  }

  addLeadRemark(lead: Lead): void {
    const remark = this.leadRemarksInputs[lead._id];
    if (!remark || !remark.trim() || this.remarkPostingIds.has(lead._id)) return;

    this.remarkPostingIds.add(lead._id);
    this.employeeLeadsVm.addRemark(this.toEmployeeLeadModel(lead), remark);
    this.leadRemarksInputs[lead._id] = '';
    setTimeout(() => this.remarkPostingIds.delete(lead._id), 400);
  }

  remarkDeletingIds = new Set<string>();

  deleteLeadRemark(lead: Lead, index: number): void {
    if (!confirm('Delete this remark?')) return;
    const key = `${lead._id}-${index}`;
    if (this.remarkDeletingIds.has(key)) return;
    this.remarkDeletingIds.add(key);
    this.employeeLeadsVm.deleteRemark(this.toEmployeeLeadModel(lead), index);
    setTimeout(() => this.remarkDeletingIds.delete(key), 400);
  }

  toggleFavourite(lead: Lead): void {
    this.invalidateInvoiceCaches();
    this.employeeLeadsVm.toggleFavourite(this.toEmployeeLeadModel(lead));
  }

  toggleStar(lead: Lead): void {
    this.employeeLeadsVm.toggleStar(this.toEmployeeLeadModel(lead));
  }

  // Helper to search across all fields of a lead ("complete data")
  private matchLead(l: Lead, q: string): boolean {
    if (!q) return true;
    const query = q.toLowerCase();
    return (
      (l.leadCompanyName || '').toLowerCase().includes(query) ||
      (l.contactName || '').toLowerCase().includes(query) ||
      (l.contactNumber || '').toLowerCase().includes(query) ||
      (l.companyDescription || '').toLowerCase().includes(query) ||
      (l.mainDivisionDescription || '').toLowerCase().includes(query) ||
      (l.directorEmailAddress || '').toLowerCase().includes(query) ||
      (l.status || '').toLowerCase().includes(query) ||
      (l.setLabel || '').toLowerCase().includes(query) ||
      (l.remarks || []).some(r => r.toLowerCase().includes(query))
    );
  }

  private matchBookmark(b: Bookmark, q: string): boolean {
    if (!q) return true;
    const query = q.toLowerCase();
    return (
      (b.companyName || '').toLowerCase().includes(query) ||
      (b.contactName || '').toLowerCase().includes(query) ||
      (b.contactNumber || '').toLowerCase().includes(query) ||
      (b.description || '').toLowerCase().includes(query) ||
      (b.remarks || []).some(r => r.toLowerCase().includes(query))
    );
  }

  leadStatusFilter = '';
  selectedFavouriteStatus: string = 'All';
  updatingLeadId = '';

  get selectedLeadSet(): string {
    return this.leadSetSelections[this.dashTab] || '';
  }

  set selectedLeadSet(value: string) {
    this.setLeadSetForTab(this.dashTab, value);
  }

  private setLeadSetForTab(tab: EmployeePageId, value: string): void {
    this.leadSetSelections[tab] = String(value || '').trim();
    this.leadCollectionsCache = null;
    this.workspaceStateCache = null;
  }

  private resetLeadSetSelections(): void {
    Object.keys(this.leadSetSelections).forEach((tab) => {
      this.leadSetSelections[tab as EmployeePageId] = '';
    });
    this.leadCollectionsCache = null;
    this.workspaceStateCache = null;
  }

  get availableLeadSets(): string[] {
    return Array.from(
      new Set(
        [
          ...this.serverLeadSets,
          ...this.allLeads.map((lead) => String(lead.setLabel || '').trim()),
        ].filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }

  get selectedLeadDivision(): string {
    return this.leadDivisionSelections[this.dashTab] || '';
  }

  set selectedLeadDivision(value: string) {
    this.setLeadDivisionForTab(this.dashTab, value);
  }

  private setLeadDivisionForTab(tab: EmployeePageId, value: string): void {
    if (!this.isLeadSegregationFilterTab(tab)) return;
    this.leadDivisionSelections[tab] = String(value || '').trim();
    this.leadCollectionsCache = null;
    this.workspaceStateCache = null;
  }

  private resetLeadDivisionSelections(): void {
    Object.keys(this.leadDivisionSelections).forEach((tab) => {
      this.leadDivisionSelections[tab as EmployeePageId] = '';
    });
    this.leadCollectionsCache = null;
    this.workspaceStateCache = null;
  }

  get availableLeadDivisions(): string[] {
    return Array.from(
      new Set(
        [
          ...this.serverLeadDivisions,
          ...this.allLeads.map((lead) => String(lead.mainDivisionDescription || '').trim()),
        ].filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }

  isLeadSegregationFilterTab(tab: EmployeePageId = this.dashTab): boolean {
    return ['leads', 'interested', 'dnp', 'converted', 'favourite'].includes(tab);
  }

  get uniqueLeadCompanies(): string[] {
    return this.getLeadCollections().uniqueLeadCompanies;
  }

  get leadsInSelectedCompany(): Lead[] {
    return this.rowsForCompany(this.filteredLeads, this.selectedLeadCompany);
  }

  selectLeadCompany(name: string): void {
    this.selectedLeadCompany = name;
    this.selectedLeadId = '';
    this.selectedFollowupId = '';
    this.drawerSection = 'details';
    this.showHistoryModal = false;
    this.tabSelections[this.dashTab] = name;
    if (this.employee && this.isLeadWorkspaceTab() && name) {
      this.fetchEmployeeLeadContacts(false);
    }
  }

  selectLeadRecord(lead: Lead, section: DrawerSection = 'details'): void {
    if (lead.leadCompanyName && this.selectedLeadCompany !== lead.leadCompanyName) {
      this.selectedLeadCompany = lead.leadCompanyName;
      this.tabSelections[this.dashTab] = lead.leadCompanyName;
    }
    this.selectedLeadId = lead._id;
    this.drawerSection = section;
    if (section === 'history') {
      this.employeeLeadsVm.openHistory(this.toEmployeeLeadModel(lead));
    } else if (section === 'ai') {
      this.employeeLeadsVm.openAi(this.toEmployeeLeadModel(lead));
    } else {
      this.employeeLeadsVm.openDetails(this.toEmployeeLeadModel(lead));
    }
  }

  closeLeadRecordView(): void {
    this.selectedLeadId = '';
    this.employeeLeadsVm.clearSelectedLead();
    this.drawerSection = 'details';
    this.showHistoryModal = false;
  }

  closeFollowupRecordView(): void {
    this.selectedFollowupId = '';
    this.selectedLeadId = '';
    this.employeeLeadsVm.clearSelectedLead();
    this.drawerSection = 'details';
    this.showHistoryModal = false;
    this.closeFollowupModal();
  }

  selectFollowupRecord(bookmark: Bookmark, section: DrawerSection = 'details'): void {
    if (bookmark.companyName && this.selectedLeadCompany !== bookmark.companyName) {
      this.selectedLeadCompany = bookmark.companyName;
      this.tabSelections[this.dashTab] = bookmark.companyName;
    }
    this.selectedFollowupId = bookmark._id;
    const matchedLead = this.getMatchedLeadForBookmark(bookmark);

    this.selectedLeadId = matchedLead?._id || '';
    this.drawerSection = section;
  }

  private buildDrawerLeadFromBookmark(bookmark: Bookmark): Lead {
    const matchingLead = this.getMatchedLeadForBookmark(bookmark);
    return {
      _id: matchingLead?._id || '',
      companyCode: bookmark.companyCode,
      assignedEmployeePhone: bookmark.employeePhone,
      leadCompanyName: bookmark.companyName,
      contactName: bookmark.contactName,
      contactNumber: bookmark.contactNumber,
      directorEmailAddress: matchingLead?.directorEmailAddress,
      companyDescription: matchingLead?.companyDescription,
      mainDivisionDescription: matchingLead?.mainDivisionDescription,
      status: matchingLead?.status || 'Follow Up',
      setLabel: matchingLead?.setLabel || '',
      isFavourite: matchingLead?.isFavourite,
      isStarred: matchingLead?.isStarred,
      remarks: matchingLead?.remarks,
      createdAt: matchingLead?.createdAt,
      updatedAt: matchingLead?.updatedAt,
    };
  }

  private populateFollowupDrawerState(bookmark: Bookmark): void {
    const shouldLoadAiSuggestion =
      this.editingBookmarkId !== bookmark._id ||
      !this.followupLead ||
      this.followupLead.contactNumber !== bookmark.contactNumber;

    this.editingBookmarkId = bookmark._id;
    this.followupLead = this.buildDrawerLeadFromBookmark(bookmark);
    this.followupForm = {
      brochuresSent: bookmark.brochuresSent,
      techMeet: bookmark.techMeet,
      meetingRemarks: bookmark.meetingRemarks,
      quotationSent: bookmark.quotationSent,
      proposalSent: bookmark.proposalSent,
      whatsappGrp: bookmark.whatsappGrp,
      description: bookmark.description,
      remarks: [...(bookmark.remarks || [])],
      newRemark: '',
      reminderDate: bookmark.reminderDate ? new Date(bookmark.reminderDate).toISOString().split('T')[0] : '',
    };
    if (shouldLoadAiSuggestion) {
      this.loadModalAiSuggestionForLead(this.followupLead, bookmark._id);
    }
  }

  private upsertFollowupLocally(bookmark: Bookmark): void {
    const index = this.followups.findIndex((item) => item._id === bookmark._id);
    if (index === -1) {
      this.followups.unshift(bookmark);
    } else {
      this.followups[index] = bookmark;
    }
    this.touchFollowups();
  }

  private scheduleFollowupSectionScroll(section: DrawerSection, behavior: ScrollBehavior = 'smooth'): void {
    if (this.dashTab !== 'followups') return;
    setTimeout(() => this.scrollFollowupSection(section, behavior), 0);
  }

  private followupSectionElement(section: DrawerSection): HTMLElement | null {
    if (section === 'followup') return this.followupEditSection?.nativeElement || null;
    if (section === 'history') return this.followupHistorySection?.nativeElement || null;
    return this.followupDetailsSection?.nativeElement || null;
  }

  scrollFollowupSection(section: DrawerSection, behavior: ScrollBehavior = 'smooth'): void {
    const container = this.followupDetailPanel?.nativeElement;
    const target = this.followupSectionElement(section);
    this.drawerSection = section;

    if (!container || !target) return;

    this.followupScrollSyncLocked = true;
    if (this.followupScrollUnlockHandle) {
      clearTimeout(this.followupScrollUnlockHandle);
    }

    container.scrollTo({
      top: Math.max(target.offsetTop - 8, 0),
      behavior,
    });

    this.followupScrollUnlockHandle = setTimeout(() => {
      this.followupScrollSyncLocked = false;
      this.followupScrollUnlockHandle = null;
    }, behavior === 'smooth' ? 320 : 40);
  }

  onFollowupDetailScroll(): void {
    if (this.followupScrollSyncLocked) return;

    const container = this.followupDetailPanel?.nativeElement;
    if (!container) return;

    const threshold = container.scrollTop + 120;
    const sections: Array<{ section: DrawerSection; element: HTMLElement | null }> = [
      { section: 'details', element: this.followupDetailsSection?.nativeElement || null },
      { section: 'followup', element: this.followupEditSection?.nativeElement || null },
      { section: 'history', element: this.followupHistorySection?.nativeElement || null },
    ];

    let activeSection: DrawerSection = 'details';
    for (const item of sections) {
      if (item.element && item.element.offsetTop <= threshold) {
        activeSection = item.section;
      }
    }

    this.drawerSection = activeSection;
  }

  openFollowupFullDetails(bookmark: Bookmark, section: DrawerSection = 'details'): void {
    this.closeAiBriefPopup();
    this.showHistoryModal = false;
    this.showFollowupModal = false;
    this.selectFollowupRecord(bookmark, section);
    this.populateFollowupDrawerState(bookmark);

    if (section === 'history') {
      this.openFollowupHistorySection(bookmark, false);
      return;
    }

    this.scheduleFollowupSectionScroll(section, 'auto');
  }

  openFollowupHistory(bookmark: Bookmark): void {
    this.openFollowupHistorySection(bookmark, true);
  }

  private openFollowupHistorySection(bookmark: Bookmark, shouldScroll: boolean): void {
    this.selectFollowupRecord(bookmark, 'history');
    this.populateFollowupDrawerState(bookmark);
    this.closeAiBriefPopup();
    const matchedLead = this.getMatchedLeadForBookmark(bookmark);
    if (!matchedLead) {
      this.historyLead = null;
      this.historyLogs = [];
      this.historyLoading = false;
      this.showHistoryModal = true;
      if (shouldScroll) this.scheduleFollowupSectionScroll('history', 'smooth');
      return;
    }
    this.loadHistoryForLead(matchedLead);
    if (shouldScroll) this.scheduleFollowupSectionScroll('history', 'smooth');
  }

  openFollowupAiDrawer(bookmark: Bookmark): void {
    const matchedLead = this.getMatchedLeadForBookmark(bookmark);
    if (!matchedLead) return;
    this.selectFollowupRecord(bookmark, 'ai');
    this.closeAiBriefPopup();
    this.showHistoryModal = false;
    this.loadAiBriefForLead(matchedLead, matchedLead.leadCompanyName);
  }

  openAiDrawer(lead: Lead | null): void {
    if (!lead) return;
    this.selectLeadRecord(lead, 'ai');
    this.showHistoryModal = false;
    this.loadAiBriefForLead(lead, lead.leadCompanyName);
    if (this.dashTab === 'interested' || this.dashTab === 'dnp') {
      this.loadDetailAiSuggestionForSelectedCompany();
    }
  }

  openLeadInTab(tab: 'leads' | 'interested' | 'dnp' | 'converted' | 'favourite' | 'today-calls', lead: Lead): void {
    this.switchTab(tab);
    this.selectedLeadCompany = lead.leadCompanyName;
    this.tabSelections[tab] = lead.leadCompanyName;
    this.selectLeadRecord(lead, 'details');
  }

  async openRecentLeadFullView(lead: Lead): Promise<void> {
    if (!lead) return;
    this.switchTab('leads');
    this.selectedLeadCompany = lead.leadCompanyName;
    this.tabSelections['leads'] = lead.leadCompanyName;
    this.selectLeadRecord(lead, 'details');
    await this.openCompanyFullViewForLeadContext(lead, 'overview');
  }

  openFollowupInWorkspace(bookmark: Bookmark): void {
    this.switchTab('followups');
    this.selectedLeadCompany = bookmark.companyName;
    this.tabSelections['followups'] = bookmark.companyName;
    this.openFollowupFullDetails(bookmark, 'details');
  }

  private resetAiBriefState(): void {
    this.aiBrief = null;
    this.aiBriefLoading = false;
    this.aiBriefError = '';
    this.aiBriefCacheStatus = '';
    this.aiBriefCompany = '';
    this.aiBriefLeadId = '';
  }

  private resetDetailAiSuggestionState(): void {
    this.detailAiSuggestion = null;
    this.detailAiSuggestionLoading = false;
    this.detailAiSuggestionError = '';
    this.detailAiSuggestionScenario = '';
    this.detailAiSuggestionGeneratedAt = '';
  }

  private resetModalAiSuggestionState(): void {
    this.modalAiSuggestion = null;
    this.modalAiSuggestionLoading = false;
    this.modalAiSuggestionError = '';
    this.modalAiSuggestionGeneratedAt = '';
  }

  private getSelectedLeadForAiBrief(): Lead | null {
    const selected = this.leadsInSelectedCompany[0];
    if (selected) return selected;

    if (this.dashTab === 'interested') {
      return this.interestedLeads.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
    }

    if (this.dashTab === 'dnp') {
      return this.dnpLeads.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
    }

    if (this.dashTab === 'converted') {
      return this.convertedLeads.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
    }

    if (this.dashTab === 'favourite') {
      return this.favouriteLeads.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
    }

    if (this.dashTab === 'today-calls') {
      return this.leadsInTodayModifiedCompany.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
    }

    if (this.dashTab === 'followups') {
      const followup = this.followupsInSelectedCompany[0];
      if (followup) {
        return (
          this.getLeadByPhone(followup.contactNumber) ||
          this.allLeads.find((lead) => lead.leadCompanyName === followup.companyName) ||
          null
        );
      }
    }

    return this.allLeads.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
  }

  private aiBriefCacheKeyFor(lead: Lead | null, companyName = ''): string {
    const normalizedCompany = String(companyName || lead?.leadCompanyName || '')
      .trim()
      .toLowerCase();

    return normalizedCompany || String(lead?._id || '').trim();
  }

  private setAiBriefFromMemoryCache(
    cacheEntry: {
      insight: AiBrief;
      cacheStatus: 'hit' | 'miss' | '';
      companyName: string;
      leadId: string;
    },
    companyName: string
  ): void {
    this.aiBriefLoading = false;
    this.aiBriefError = '';
    this.aiBrief = cacheEntry.insight;
    this.aiBriefCacheStatus = cacheEntry.cacheStatus;
    this.aiBriefCompany = companyName || cacheEntry.companyName;
    this.aiBriefLeadId = cacheEntry.leadId;
  }

  private loadAiBriefForLead(lead: Lead | null, companyName = '', forceRefresh = false): void {
    if (!lead) {
      this.resetAiBriefState();
      this.aiBriefCompany = companyName;
      return;
    }

    const cacheKey = this.aiBriefCacheKeyFor(lead, companyName);
    const cached = forceRefresh ? undefined : this.aiBriefMemoryCache.get(cacheKey);
    if (cached) {
      this.setAiBriefFromMemoryCache(cached, companyName || lead.leadCompanyName);
      return;
    }

    const requestId = ++this.aiBriefRequestSeq;
    this.aiBriefLoading = true;
    this.aiBriefError = '';
    this.aiBrief = null;
    this.aiBriefCacheStatus = '';
    this.aiBriefCompany = companyName || lead.leadCompanyName;
    this.aiBriefLeadId = lead._id;

    this.aiBriefService.getLeadBrief(lead._id).subscribe({
      next: (res) => {
        if (requestId !== this.aiBriefRequestSeq) return;

        this.aiBriefLoading = false;
        if (res.success && res.insight) {
          this.aiBrief = res.insight;
          this.aiBriefCacheStatus = res.cacheStatus || '';
          this.aiBriefError = '';
          this.aiBriefMemoryCache.set(cacheKey, {
            insight: res.insight,
            cacheStatus: res.cacheStatus || '',
            companyName: companyName || lead.leadCompanyName,
            leadId: lead._id,
          });
          return;
        }

        this.aiBrief = null;
        this.aiBriefCacheStatus = '';
        this.aiBriefError = res.message || 'AI brief is unavailable right now.';
      },
      error: (err) => {
        if (requestId !== this.aiBriefRequestSeq) return;

        this.aiBriefLoading = false;
        this.aiBrief = null;
        this.aiBriefCacheStatus = '';
        this.aiBriefError = err.error?.message || 'AI brief is unavailable right now.';
      },
    });
  }

  retryAiBrief(): void {
    const lead = this.findLeadById(this.aiBriefLeadId) || this.getSelectedLeadForAiBrief();
    this.loadAiBriefForLead(lead, this.aiBriefCompany, true);
  }

  aiBriefCacheLabel(): string {
    return this.aiBriefCacheStatus === 'hit' ? 'Cached Brief' : 'Fresh Brief';
  }

  currentAiSummaryTargetKey(): string {
    return `${this.dashTab || 'dashboard'}-company-summary`;
  }

  isAiBriefPopupOpen(target: string): boolean {
    return this.aiBriefOpenTarget === target;
  }

  openAiBriefForCurrentCompany(event: Event): void {
    const company = this.dashTab === 'followups' ? this.activeFollowupCompany : this.selectedLeadCompany;
    this.toggleAiBriefPopup(event, this.currentAiSummaryTargetKey(), this.getSelectedLeadForAiBrief(), company);
  }

  openAiBriefFullView(event: Event): void {
    event.stopPropagation();
    const company = this.dashTab === 'followups' ? this.activeFollowupCompany : this.selectedLeadCompany;
    const lead = this.getSelectedLeadForAiBrief();
    this.aiBriefOpenTarget = '';
    this.aiBriefFullViewOpen = true;
    if (!lead?._id) {
      this.resetAiBriefState();
      this.aiBriefCompany = company;
      this.aiBriefError = 'AI summary needs a lead record for this company.';
      return;
    }
    this.loadAiBriefForLead(lead, company || lead.leadCompanyName);
  }

  openAiBriefForFollowupModal(event: Event): void {
    this.toggleAiBriefPopup(
      event,
      'followup-modal-summary',
      this.followupLead,
      this.followupLead?.leadCompanyName || this.selectedLeadCompany
    );
  }

  closeAiBriefPopup(): void {
    this.aiBriefOpenTarget = '';
  }

  closeAiBriefFullView(): void {
    this.aiBriefFullViewOpen = false;
  }

  async openCompanyFullView(event: Event): Promise<void> {
    event.stopPropagation();
    const sourceLead = this.activeLeadBannerLead() || this.companyFullViewLead();
    if (!sourceLead) return;
    await this.openCompanyFullViewForLeadContext(sourceLead, 'overview');
  }

  private async openCompanyFullViewForLeadContext(sourceLead: Lead, initialSection: CompanyFullSection = 'overview'): Promise<void> {
    this.closeAiBriefPopup();
    this.companyRemarkLead = null;
    this.companyFullContextLead = { ...sourceLead };
    if (sourceLead.leadCompanyName && this.selectedLeadCompany !== sourceLead.leadCompanyName) {
      this.selectedLeadCompany = sourceLead.leadCompanyName;
      this.tabSelections[this.dashTab] = sourceLead.leadCompanyName;
    }
    this.companyFullViewOpen = true;
    this.companyFullActiveSection = initialSection;
    this.resetCompanyFullViewState();
    await this.loadCompanyFullViewData();
    setTimeout(() => {
      const targetSection = this.companyFullSections.some((section) => section.id === initialSection)
        ? initialSection
        : 'overview';
      this.scrollCompanyFullSection(targetSection, 'auto');
    });
  }

  closeCompanyFullView(): void {
    this.companyFullViewOpen = false;
    this.companyFullContextLead = null;
    this.companyRemarkLead = null;
    this.clearCompanyFullRemarkMenuClose();
    this.companyFullRemarkMenuOpen = false;
    this.companyFullRemarkDraft = '';
    this.companyFullNoteDraft = '';
  }

  openCompanyRemarkHistory(lead: Lead): void {
    this.companyRemarkLead = lead;
  }

  closeCompanyRemarkHistory(): void {
    this.companyRemarkLead = null;
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.profileMenuOpen && (!target || !target.closest('.profile-dropdown'))) {
      this.closeProfileMenu();
    }
    if (this.clientOnboardingOpenMenuKey && (!target || !target.closest('.client-onboarding-manage-cell'))) {
      this.clientOnboardingOpenMenuKey = '';
    }

    if (!this.aiBriefOpenTarget) return;
    if (!target || target.closest('.ai-summary-anchor')) return;

    this.closeAiBriefPopup();
  }

  @HostListener('document:keydown.escape')
  handleGlobalEscape(): void {
    this.closeProfileMenu();
    this.closeAiBriefPopup();
    this.closeAiBriefFullView();
    this.closeCompanyFullView();
    this.closeProfileEditor();
    this.clientOnboardingOpenMenuKey = '';
    this.closeClientOnboardingCreateModal();
    this.closeClientOnboardingEditModal();
  }

  @HostListener('document:mousemove', ['$event'])
  handleProfileEditorDrag(event: MouseEvent): void {
    if (this.activeOverviewColumnResize) {
      this.updateOverviewColumnResize(event);
      return;
    }

    if (!this.profileEditorDragging) return;
    this.updateProfileEditorOffset(
      this.profileEditorStartOffsetX + (event.clientX - this.profileEditorDragStartX),
      this.profileEditorStartOffsetY + (event.clientY - this.profileEditorDragStartY),
    );
  }

  @HostListener('document:mouseup')
  handleProfileEditorDragEnd(): void {
    this.stopOverviewColumnResize();
    this.profileEditorDragging = false;
  }

  startOverviewColumnResize(table: OverviewTableKey, columnIndex: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement | null;
    const tableElement = handle?.closest('table');
    if (!tableElement) return;

    const tableWidth = tableElement.getBoundingClientRect().width;
    if (!tableWidth) return;

    this.activeOverviewColumnResize = {
      table,
      columnIndex,
      startX: event.clientX,
      startWidths: [...this.getOverviewColumnWidths(table)],
      tableWidth,
    };

    document.body.classList.add('column-resizing');
  }

  private updateOverviewColumnResize(event: MouseEvent): void {
    const state = this.activeOverviewColumnResize;
    if (!state) return;

    const widths = [...state.startWidths];
    const currentIndex = state.columnIndex;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= widths.length) return;

    const deltaPercent = ((event.clientX - state.startX) / state.tableWidth) * 100;
    const minPercents = this.getOverviewColumnMinPercents(state.table, state.tableWidth);
    const rightCollapseMinPercent = Math.max(1.2, 24 / state.tableWidth * 100);

    if (deltaPercent >= 0) {
      const totalRightAvailable = widths
        .slice(nextIndex)
        .reduce((sum, width) => sum + Math.max(0, width - rightCollapseMinPercent), 0);
      const appliedDelta = Math.min(deltaPercent, totalRightAvailable);

      widths[currentIndex] += appliedDelta;

      let remaining = appliedDelta;
      for (let index = nextIndex; index < widths.length && remaining > 0; index += 1) {
        const shrinkable = Math.max(0, widths[index] - rightCollapseMinPercent);
        const shrink = Math.min(shrinkable, remaining);
        widths[index] -= shrink;
        remaining -= shrink;
      }
    } else {
      const currentAvailable = Math.max(0, widths[currentIndex] - minPercents[currentIndex]);
      const appliedDelta = -Math.min(Math.abs(deltaPercent), currentAvailable);

      widths[currentIndex] += appliedDelta;
      widths[nextIndex] -= appliedDelta;
    }

    this.setOverviewColumnWidths(state.table, this.normalizeOverviewColumnWidths(widths));
  }

  private stopOverviewColumnResize(): void {
    if (!this.activeOverviewColumnResize) return;
    this.activeOverviewColumnResize = null;
    document.body.classList.remove('column-resizing');
  }

  private getOverviewColumnWidths(table: OverviewTableKey): number[] {
    return table === 'activity' ? this.overviewActivityColumnWidths : this.overviewUpcomingColumnWidths;
  }

  private setOverviewColumnWidths(table: OverviewTableKey, widths: number[]): void {
    if (table === 'activity') {
      this.overviewActivityColumnWidths = widths;
      return;
    }

    this.overviewUpcomingColumnWidths = widths;
  }

  private getOverviewColumnMinPercents(table: OverviewTableKey, tableWidth: number): number[] {
    const minWidths = this.overviewColumnMinWidths[table];
    const rawPercents = minWidths.map((width) => (width / tableWidth) * 100);
    const total = rawPercents.reduce((sum, width) => sum + width, 0);

    if (total <= 100) return rawPercents;

    const scale = 100 / total;
    return rawPercents.map((width) => width * scale);
  }

  private normalizeOverviewColumnWidths(widths: number[]): number[] {
    const rounded = widths.map((width) => Number(width.toFixed(2)));
    const total = rounded.reduce((sum, width) => sum + width, 0);
    const diff = Number((100 - total).toFixed(2));
    if (!rounded.length || diff === 0) return rounded;

    rounded[rounded.length - 1] = Number((rounded[rounded.length - 1] + diff).toFixed(2));
    return rounded;
  }

  private toggleAiBriefPopup(event: Event, target: string, lead: Lead | null, companyName = ''): void {
    event.stopPropagation();

    if (this.aiBriefOpenTarget === target) {
      this.closeAiBriefPopup();
      return;
    }

    this.aiBriefOpenTarget = target;

    if (!lead?._id) {
      this.resetAiBriefState();
      this.aiBriefCompany = companyName;
      this.aiBriefError = 'AI summary needs a lead record for this company.';
      return;
    }

    const nextCompanyName = companyName || lead.leadCompanyName;
    if (
      this.aiBriefLeadId === lead._id &&
      this.aiBriefCompany === nextCompanyName &&
      (this.aiBriefLoading || !!this.aiBrief || !!this.aiBriefError)
    ) {
      return;
    }

    this.loadAiBriefForLead(lead, nextCompanyName);
  }

  private currentDetailAiScenario(): AiSuggestionScenario | '' {
    if (this.dashTab === 'interested') return 'interested';
    if (this.dashTab === 'dnp') return 'not_interested';
    return '';
  }

  private syncAiForActiveView(): void {
    this.resetAiForActiveSelection();
  }

  private resetAiForActiveSelection(): void {
    this.closeAiBriefPopup();
    this.resetAiBriefState();
    this.resetDetailAiSuggestionState();
  }

  private getSelectedLeadForDetailAiSuggestion(): Lead | null {
    if (!this.selectedLeadCompany) return null;

    const fromCurrentList = this.leadsInSelectedCompany[0];
    if (fromCurrentList) return fromCurrentList;

    if (this.dashTab === 'interested') {
      return this.interestedLeads.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
    }

    if (this.dashTab === 'dnp') {
      return this.dnpLeads.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
    }

    return this.allLeads.find((lead) => lead.leadCompanyName === this.selectedLeadCompany) || null;
  }

  private loadDetailAiSuggestionForSelectedCompany(): void {
    const scenario = this.currentDetailAiScenario();
    if (!scenario) {
      this.resetDetailAiSuggestionState();
      return;
    }

    const lead = this.getSelectedLeadForDetailAiSuggestion();
    if (!lead) {
      this.resetDetailAiSuggestionState();
      return;
    }

    const requestId = ++this.detailAiSuggestionRequestSeq;
    this.detailAiSuggestionScenario = scenario;
    this.detailAiSuggestionLoading = true;
    this.detailAiSuggestionError = '';
    this.detailAiSuggestion = null;
    this.detailAiSuggestionGeneratedAt = '';

    this.aiSuggestionService.getLeadSuggestion(lead._id, scenario).subscribe({
      next: (res) => {
        if (requestId !== this.detailAiSuggestionRequestSeq) return;

        this.detailAiSuggestionLoading = false;
        if (res.success && res.suggestion) {
          this.detailAiSuggestion = res.suggestion;
          this.detailAiSuggestionGeneratedAt = res.generatedAt || '';
          this.detailAiSuggestionError = '';
          return;
        }

        this.detailAiSuggestion = null;
        this.detailAiSuggestionGeneratedAt = '';
        this.detailAiSuggestionError = res.message || 'AI guidance is unavailable right now.';
      },
      error: (err) => {
        if (requestId !== this.detailAiSuggestionRequestSeq) return;

        this.detailAiSuggestionLoading = false;
        this.detailAiSuggestion = null;
        this.detailAiSuggestionGeneratedAt = '';
        this.detailAiSuggestionError = err.error?.message || 'AI guidance is unavailable right now.';
      },
    });
  }

  retryDetailAiSuggestion(): void {
    this.loadDetailAiSuggestionForSelectedCompany();
  }

  detailAiSuggestionTitle(): string {
    if (this.detailAiSuggestionScenario === 'interested') return 'AI Closing Guidance';
    if (this.detailAiSuggestionScenario === 'not_interested') return 'AI Recovery Guidance';
    return 'AI Guidance';
  }

  detailAiSuggestionScenarioLabel(): string {
    if (this.detailAiSuggestionScenario === 'interested') return 'Interested';
    if (this.detailAiSuggestionScenario === 'not_interested') return 'Not Connected';
    return 'Guidance';
  }

  private loadModalAiSuggestionForLead(lead: Lead | null, bookmarkId?: string): void {
    if (!lead?._id) {
      this.resetModalAiSuggestionState();
      this.modalAiSuggestionError = 'AI guidance needs a lead record for this contact.';
      return;
    }

    const requestId = ++this.modalAiSuggestionRequestSeq;
    this.modalAiSuggestionLoading = true;
    this.modalAiSuggestionError = '';
    this.modalAiSuggestion = null;
    this.modalAiSuggestionGeneratedAt = '';

    this.aiSuggestionService.getLeadSuggestion(lead._id, 'followup', bookmarkId).subscribe({
      next: (res) => {
        if (requestId !== this.modalAiSuggestionRequestSeq) return;

        this.modalAiSuggestionLoading = false;
        if (res.success && res.suggestion) {
          this.modalAiSuggestion = res.suggestion;
          this.modalAiSuggestionGeneratedAt = res.generatedAt || '';
          this.modalAiSuggestionError = '';
          return;
        }

        this.modalAiSuggestion = null;
        this.modalAiSuggestionGeneratedAt = '';
        this.modalAiSuggestionError = res.message || 'AI guidance is unavailable right now.';
      },
      error: (err) => {
        if (requestId !== this.modalAiSuggestionRequestSeq) return;

        this.modalAiSuggestionLoading = false;
        this.modalAiSuggestion = null;
        this.modalAiSuggestionGeneratedAt = '';
        this.modalAiSuggestionError = err.error?.message || 'AI guidance is unavailable right now.';
      },
    });
  }

  retryModalAiSuggestion(): void {
    this.loadModalAiSuggestionForLead(this.followupLead, this.editingBookmarkId || undefined);
  }

  private findLeadById(leadId: string): Lead | null {
    if (!leadId) return null;
    return this.allLeads.find((lead) => lead._id === leadId) || null;
  }

  hostnameFromUrl(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  private aiBriefOfficialHostname(): string {
    return this.hostnameFromUrl(this.aiBrief?.officialWebsite || '').toLowerCase();
  }

  private isOfficialHostnameMatch(url: string): boolean {
    const officialHostname = this.aiBriefOfficialHostname();
    if (!officialHostname) return false;

    const sourceHostname = this.hostnameFromUrl(url || '').toLowerCase();
    return !!sourceHostname && (
      sourceHostname === officialHostname ||
      sourceHostname.endsWith(`.${officialHostname}`) ||
      officialHostname.endsWith(`.${sourceHostname}`)
    );
  }

  aiBriefOfficialSources(): Array<AiBrief['sources'][number]> {
    if (!this.aiBrief) return [];

    const officialSources = this.aiBrief.sources.filter((source) =>
      this.isOfficialHostnameMatch(source.url)
    );

    if (officialSources.length > 0) {
      return officialSources;
    }

    if (!this.aiBrief.officialWebsite) {
      return [];
    }

    return [
      {
        title: this.aiBrief.leadCompanyName || this.hostnameFromUrl(this.aiBrief.officialWebsite),
        url: this.aiBrief.officialWebsite,
        sourceType: 'official_website',
        snippet: '',
      },
    ];
  }

  aiBriefResearchSources(): Array<AiBrief['sources'][number]> {
    if (!this.aiBrief) return [];

    return this.aiBrief.sources.filter((source) => !this.isOfficialHostnameMatch(source.url));
  }

  aiBriefSourceMetaLabel(source: AiBrief['sources'][number], category: 'official' | 'research'): string {
    if (category === 'official') {
      if (source.sourceType === 'marketplace') return 'Official company storefront';
      if (source.sourceType === 'social') return 'Official company profile';
      return 'Official company source';
    }

    switch (source.sourceType) {
      case 'regulatory':
        return 'Regulatory / filing source';
      case 'marketplace':
        return 'Marketplace source';
      case 'directory':
        return 'Directory source';
      case 'business_profile':
        return 'Business profile source';
      case 'social':
        return 'Public profile source';
      case 'official_website':
        return 'Official website reference';
      default:
        return 'Research source';
    }
  }

  // Admin-configurable lead statuses (fetched from backend)
  LEAD_STATUSES: string[] = ['New', 'Interested', 'Not Connected', 'Converted', 'Follow Up', 'Not Interested'];
  INTERESTED_PAGE_STATUSES: string[] = ['Interested', 'Follow Up'];
  DNP_PAGE_STATUSES: string[] = ['Not Connected'];
  CONVERTED_PAGE_STATUSES: string[] = ['Converted'];
  selectedInterestedStatus: string = 'All';
  selectedDnpStatus: string = 'All';
  selectedConvertedStatus: string = 'All';
  breakHourLimitMin: number = 60; // minutes — fetched from company settings
  
  // Invoice Settings
  invoiceLogo: string = '';
  showCompanyNameOnInvoice: boolean = true;
  gstNumber: string = '';
  gstPercentage: number = 18;
  invoiceRegisteredAddress: string = '';
  invoiceFooter: string = '';
  invoiceSeal: string = '';
  invoiceTerms: string = '';
  bankDetails: any = null;
  contactDetails: any = null;
  companyAddress: string = '';
  products: any[] = [];
  readonly currentYear = new Date().getFullYear();
  readonly quotationTerms = DEFAULT_QUOTATION_TERMS;

  invoiceItems: any[] = [];
  invoiceDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  invoiceIssuedAt = new Date();
  dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  quoteNumber = Math.floor(100000 + Math.random() * 900000);
  showInvoiceModal = false;
  invoiceLead: Lead | null = null;
  selectedInvoiceClient: ClientRecord | null = null;
  showGstSelectionModal = false;
  documentGstPercentageOverride: number | null = null;
  private gstSelectionConfirmed = false;
  invoiceSaving = false;
  currentInvoiceNumber = '';
  currentInvoicePublicUrl = '';
  currentInvoiceQrDataUrl = '';
  invoicePaymentStatus: 'paid' | 'unpaid' = 'unpaid';
  invoiceRecords: InvoiceRecord[] = [];
  invoiceRecordsLoading = false;
  invoiceRecordsLoadingMore = false;
  invoiceRecordsPage = 1;
  invoiceRecordsHasMore = false;
  invoiceRecordsTotal = 0;
  invoiceEligibleLeads: Lead[] = [];
  invoiceEligibleLeadsLoading = false;
  invoiceLeadCompanies: LeadCompanyFacet[] = [];
  invoiceLeadCompanyContacts: Record<string, Lead[]> = {};
  invoiceLeadCompanyPage = 1;
  invoiceLeadCompanyHasMore = false;
  invoiceLeadCompanyTotal = 0;
  invoiceLeadCompaniesLoadingMore = false;
  invoiceLeadRenderCount = OPERATIONAL_PAGE_SIZE;
  invoiceSearch = '';
  invoiceHistorySearch = '';
  invoiceDateFilterOpen = false;
  invoiceDateFrom = '';
  invoiceDateTo = '';
  clientOnboardingRecords: ClientRecord[] = [];
  clientOnboardingSearch = '';
  clientOnboardingLoading = false;
  clientOnboardingLoadingMore = false;
  clientOnboardingPage = 1;
  clientOnboardingHasMore = false;
  clientOnboardingTotal = 0;
  clientOnboardingLoaded = false;
  selectedOnboardingClientId = '';
  clientOnboardingCreateOpen = false;
  clientOnboardingEditOpen = false;
  clientOnboardingOpenMenuKey = '';
  clientOnboardingDraft = {
    companyName: '',
    primaryContactName: '',
    primaryPhone: '',
    primaryEmail: '',
    address: '',
  };
  clientOnboardingEditDraft = {
    companyName: '',
    primaryContactName: '',
    primaryPhone: '',
    primaryEmail: '',
    address: '',
  };
  editingClientOnboarding: ClientRecord | null = null;
  clientOnboardingSaving = false;
  clientOnboardingEditSaving = false;
  clientOnboardingError = '';
  clientOnboardingEditError = '';
  clientOnboardingSuccess = '';
  quoteMode = false;
  quotationRecords: QuotationRecord[] = [];
  quotationRecordsLoading = false;
  quotationRecordsLoadingMore = false;
  quotationRecordsPage = 1;
  quotationRecordsHasMore = false;
  quotationRecordsTotal = 0;
  private quotationRecordsLoaded = false;
  quotationLeadCompanies: LeadCompanyFacet[] = [];
  quotationLeadCompanyContacts: Record<string, Lead[]> = {};
  quotationLeadCompanyPage = 1;
  quotationLeadCompanyHasMore = false;
  quotationLeadCompanyTotal = 0;
  quotationLeadsLoading = false;
  quotationLeadCompaniesLoadingMore = false;
  quotationSearch = '';
  quotationLeadRenderCount = OPERATIONAL_PAGE_SIZE;
  quotationHistorySearch = '';
  quotationDateFilterOpen = false;
  quotationDateFrom = '';
  quotationDateTo = '';
  quotationSaving = false;
  currentQuotationNumber = '';
  quotationKindNoteDraft = DEFAULT_QUOTATION_KIND_NOTE;
  viewingSavedDocument = false;
  private openedInvoiceRecord: InvoiceRecord | null = null;
  private openedQuotationRecord: QuotationRecord | null = null;
  private invoiceRecordsLoaded = false;
  private invoiceEligibleLeadsLoaded = false;
  private quotationLeadCompaniesLoaded = false;
  private followupsLoaded = false;
  private overviewFollowupsLoaded = false;
  followupsLoadingMore = false;
  followupsPage = 1;
  followupsHasMore = false;
  followupsTotal = 0;
  private readonly dashboardCacheTtlMs = 5 * 60 * 1000;
  private invoiceSearchTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  private clientOnboardingSearchTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  private quotationSearchTimeoutRef: ReturnType<typeof setTimeout> | null = null;

  get todayInputDate(): string {
    return new Date().toLocaleDateString('en-CA');
  }

  // For the selection form
  selectedInvoiceProduct: any = null;
  invoicePrice: number = 0;
  invoiceQuantity: number = 1;
  invoiceTransferredFromQuotation = false;
  quotationTransferLoading = false;
  transferredQuotationRecord: QuotationRecord | null = null;

  openInvoiceModal(lead: any): void {
    this.quoteMode = false;
    this.viewingSavedDocument = false;
    this.openedInvoiceRecord = null;
    this.openedQuotationRecord = null;
    this.invoiceLead = lead;
    this.selectedInvoiceClient = null;
    this.resetDocumentGstSelection();
    this.resetInvoiceBuilderDraftState();
    this.invoicePaymentStatus = 'unpaid';
    this.quotationKindNoteDraft = DEFAULT_QUOTATION_KIND_NOTE;
    this.showInvoiceModal = true;
    this.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    this.invoiceIssuedAt = new Date();
    this.currentInvoiceNumber = '';
    this.resetInvoicePublicLink();
  }

  openQuotationModal(lead: any): void {
    void this.loadCompanySettings();
    this.quoteMode = true;
    this.viewingSavedDocument = false;
    this.openedInvoiceRecord = null;
    this.openedQuotationRecord = null;
    this.invoiceLead = lead;
    this.selectedInvoiceClient = null;
    this.resetDocumentGstSelection();
    this.resetInvoiceBuilderDraftState();
    this.quotationKindNoteDraft = this.defaultQuotationKindNote();
    this.showInvoiceModal = true;
    this.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    this.invoiceIssuedAt = new Date();
    this.currentQuotationNumber = '';
    this.resetInvoicePublicLink();
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.quoteMode = false;
    this.viewingSavedDocument = false;
    this.resetInvoicePublicLink();
    this.invoiceLead = null;
    this.selectedInvoiceClient = null;
    this.resetDocumentGstSelection();
    this.openedInvoiceRecord = null;
    this.openedQuotationRecord = null;
    this.resetInvoiceBuilderDraftState();
    this.quotationKindNoteDraft = this.defaultQuotationKindNote();
  }

  onProductSelect(): void {
    if (this.selectedInvoiceProduct) {
      this.invoicePrice = this.selectedInvoiceProduct.minPrice;
    }
  }

  private resetInvoiceBuilderDraftState(): void {
    this.invoiceItems = [];
    this.selectedInvoiceProduct = null;
    this.invoicePrice = 0;
    this.invoiceQuantity = 1;
    this.invoiceTransferredFromQuotation = false;
    this.quotationTransferLoading = false;
    this.transferredQuotationRecord = null;
  }

  addInvoiceItem(): void {
    if (!this.selectedInvoiceProduct) return;
    
    // Validate price
    if (this.invoicePrice < this.selectedInvoiceProduct.minPrice) {
      alert(`Price cannot be less than the minimum price of ₹${this.selectedInvoiceProduct.minPrice}`);
      this.invoicePrice = this.selectedInvoiceProduct.minPrice;
      return;
    }

    const quantity = Math.max(1, Number(this.invoiceQuantity || 1));
    const price = Number(this.invoicePrice || 0);
    const incomingItem = {
      product: this.selectedInvoiceProduct,
      price,
      quantity,
      name: this.selectedInvoiceProduct.name,
    };
    const existingItem = this.invoiceItems.find((item) =>
      this.invoiceItemKey(item) === this.invoiceItemKey(incomingItem) &&
      Number(item.price || 0) === price,
    );

    if (existingItem) {
      existingItem.quantity = Math.max(1, Number(existingItem.quantity || 1)) + quantity;
    } else {
      this.invoiceItems.push(incomingItem);
    }

    // Reset selection
    this.selectedInvoiceProduct = null;
    this.invoicePrice = 0;
    this.invoiceQuantity = 1;
  }

  async transferLatestQuotationToInvoice(): Promise<void> {
    if (this.quoteMode || this.viewingSavedDocument || !this.employee || !this.invoiceLead || this.quotationTransferLoading) {
      return;
    }

    this.quotationTransferLoading = true;

    try {
      const pageResult = await firstValueFrom(this.quotationsRepository.history({
        companyCode: this.employee.companyCode,
        employeePhone: this.employee.mobile,
        leadId: String(this.invoiceLead._id || '').trim(),
        page: 1,
        pageSize: 5,
      }));

      let latestQuotation = pageResult.items
        .map((item) => this.toWorkspaceQuotationRecord(item as any))
        .sort((a, b) => this.compareQuotationVersions(b, a))
        .at(0) || null;

      if (!latestQuotation) {
        const fallbackResult = await firstValueFrom(this.quotationsRepository.history({
          companyCode: this.employee.companyCode,
          employeePhone: this.employee.mobile,
          search: this.invoiceLead.leadCompanyName,
          page: 1,
          pageSize: 15,
        }));
        const normalizedCompany = this.normalizeCompanyName(this.invoiceLead.leadCompanyName);
        latestQuotation = fallbackResult.items
          .map((item) => this.toWorkspaceQuotationRecord(item as any))
          .filter((record) => this.normalizeCompanyName(record.leadCompanyName) === normalizedCompany)
          .sort((a, b) => this.compareQuotationVersions(b, a))
          .at(0) || null;
      }

      if (!latestQuotation || !latestQuotation.items?.length) {
        alert('No saved quotation with items was found for this company.');
        return;
      }

      this.invoiceItems = this.mapTransferredQuotationItems(latestQuotation.items);
      this.invoiceTransferredFromQuotation = true;
      this.transferredQuotationRecord = latestQuotation;
      this.selectedInvoiceProduct = null;
      this.invoicePrice = 0;
      this.invoiceQuantity = 1;
    } catch {
      alert('Failed to load the latest quotation for transfer.');
    } finally {
      this.quotationTransferLoading = false;
    }
  }

  private compareQuotationVersions(left: QuotationRecord, right: QuotationRecord): number {
    const versionGap = Number(left?.versionNo || 0) - Number(right?.versionNo || 0);
    if (versionGap !== 0) return versionGap;
    const issuedGap = new Date(left?.quotationDate || left?.createdAt || 0).getTime()
      - new Date(right?.quotationDate || right?.createdAt || 0).getTime();
    if (issuedGap !== 0) return issuedGap;
    return String(left?._id || '').localeCompare(String(right?._id || ''));
  }

  private mapTransferredQuotationItems(items: QuotationRecord['items'] = []): any[] {
    return items.map((item) => {
      const matchedProduct = this.products.find((product) => {
        const productId = String(product?._id || '').trim();
        const itemProductId = String((item as any)?.productId || '').trim();
        if (productId && itemProductId) return productId === itemProductId;
        return this.invoiceItemKey({ product, name: product?.name }) === this.invoiceItemKey({ name: item?.name });
      });
      const price = Number(item?.rate || 0);
      const quantity = Math.max(1, Number(item?.quantity || 1));
      const taxable = Number(item?.taxable ?? (price * quantity));
      const gst = Number(item?.gst ?? (taxable * (this.invoicePreviewGstPercentage() / 100)));
      return {
        product: matchedProduct || {
          _id: (item as any)?.productId || null,
          name: String(item?.name || 'Service').trim(),
          sacHsn: String((item as any)?.sacHsn || matchedProduct?.sacHsn || '').trim(),
        },
        name: String(item?.name || 'Service').trim(),
        price,
        quantity,
        taxable,
        gst,
        total: Number(item?.total ?? (taxable + gst)),
      };
    });
  }

  updateTransferredInvoiceItemPrice(index: number, value: number | string): void {
    if (!this.invoiceTransferredFromQuotation) return;
    const item = this.invoiceItems[index];
    if (!item) return;
    const price = Math.max(0, Number(value || 0));
    const quantity = Math.max(1, Number(item.quantity || 1));
    item.price = price;
    item.taxable = price * quantity;
    item.gst = item.taxable * (this.invoicePreviewGstPercentage() / 100);
    item.total = item.taxable + item.gst;
  }

  removeInvoiceItem(index: number): void {
    this.invoiceItems.splice(index, 1);
  }

  get invoiceSubtotal(): number {
    const savedRecord = this.savedFinancialRecord();
    if (savedRecord && savedRecord.subtotal !== undefined) return Number(savedRecord.subtotal || 0);
    return this.invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get invoiceTotalUnits(): number {
    return this.invoiceItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
  }

  get invoiceGstAmount(): number {
    const savedRecord = this.savedFinancialRecord();
    if (savedRecord && savedRecord.gstAmount !== undefined) return Number(savedRecord.gstAmount || 0);
    return this.invoiceSubtotal * (this.invoicePreviewGstPercentage() / 100);
  }

  get invoiceTotal(): number {
    const savedRecord = this.savedFinancialRecord();
    if (savedRecord && savedRecord.total !== undefined) return Number(savedRecord.total || 0);
    return this.invoiceSubtotal + this.invoiceGstAmount;
  }

  get invoiceCgstAmount(): number {
    if (this.viewingSavedDocument && !this.quoteMode && this.openedInvoiceRecord?.cgst !== undefined) {
      return Number(this.openedInvoiceRecord.cgst || 0);
    }
    return this.invoiceGstAmount / 2;
  }

  get invoiceSgstAmount(): number {
    if (this.viewingSavedDocument && !this.quoteMode && this.openedInvoiceRecord?.sgst !== undefined) {
      return Number(this.openedInvoiceRecord.sgst || 0);
    }
    return this.invoiceGstAmount / 2;
  }

  get invoiceAmountReceived(): number {
    return this.normalizeInvoicePaymentStatus(this.invoicePaymentStatus) === 'paid' ? this.invoiceTotal : 0;
  }

  get invoiceBalanceDue(): number {
    return Math.max(0, this.invoiceTotal - this.invoiceAmountReceived);
  }

  invoiceItemTaxable(item: any): number {
    if (item?.taxable !== undefined) return Number(item.taxable || 0);
    return Number(item.price || 0) * Number(item.quantity || 0);
  }

  invoiceItemGst(item: any): number {
    if (item?.gst !== undefined) return Number(item.gst || 0);
    if (item?.cgst !== undefined || item?.sgst !== undefined) {
      return Number(item.cgst || 0) + Number(item.sgst || 0);
    }
    return this.invoiceItemTaxable(item) * (this.invoicePreviewGstPercentage() / 100);
  }

  invoiceItemTotal(item: any): number {
    if (item?.total !== undefined) return Number(item.total || 0);
    return this.invoiceItemTaxable(item) + this.invoiceItemGst(item);
  }

  formatInvoiceMoney(value: number): string {
    return `INR ${Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  invoiceCompanyDisplayName(): string {
    const snapshotName = String(this.activeInvoiceCompanySnapshot()?.name || '').trim();
    if (snapshotName) return snapshotName;
    return (this.showCompanyNameOnInvoice ? this.companyName : '') || 'DealVoice';
  }

  invoiceCompanyLogo(): string {
    return String(
      this.activeInvoiceCompanySnapshot()?.logo ||
      this.invoiceLogo ||
      '/assets/icon/softrate-transparent-logo.png'
    ).trim();
  }

  quotationCompanyLogo(): string {
    return String(
      this.activeInvoiceCompanySnapshot()?.logo ||
      this.invoiceLogo ||
      '/assets/icon/softrate-transparent-logo.png'
    ).trim();
  }

  invoiceCompanyAddress(): string {
    return String(
      this.activeInvoiceCompanySnapshot()?.registeredAddress ||
      this.invoiceRegisteredAddress ||
      this.companyAddress ||
      this.contactDetails?.address ||
      '',
    ).trim();
  }

  invoiceContactLine(): string {
    const parts = [this.invoiceCompanyPhone(), this.invoiceCompanyEmail(), this.invoiceCompanyWebsite()]
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    return parts.join(' · ');
  }

  invoiceCompanyPhone(): string {
    return String(this.activeInvoiceCompanySnapshot()?.phone || this.contactDetails?.phone || '').trim();
  }

  invoiceCompanyEmail(): string {
    return String(this.activeInvoiceCompanySnapshot()?.email || this.contactDetails?.email || '').trim();
  }

  invoiceCompanyWebsite(): string {
    return String(this.activeInvoiceCompanySnapshot()?.website || this.contactDetails?.website || '').trim();
  }

  invoiceCompanyGstNumber(): string {
    return String(this.activeInvoiceCompanySnapshot()?.gstNumber || this.gstNumber || '').trim();
  }

  quotationBankRows(): QuotationBankRow[] {
    const bankDetails = this.activeCompanyBankDetails();
    return [
      { label: 'Bank', value: bankDetails.bankName },
      { label: 'Acc', value: bankDetails.accountNumber },
      { label: 'IFSC', value: bankDetails.ifscCode },
      { label: 'Branch', value: bankDetails.branchName },
    ]
      .map((row) => ({ ...row, value: String(row.value || '').trim() }))
      .filter((row) => row.value);
  }

  private activeCompanyBankDetails(): any {
    return this.activeInvoiceCompanySnapshot()?.bankDetails || this.bankDetails || {};
  }

  invoiceBankDetails(): any {
    return this.activeCompanyBankDetails();
  }

  invoiceSealSrc(): string {
    return String(this.activeInvoiceCompanySnapshot()?.seal || this.invoiceSeal || '').trim();
  }

  invoiceTermsText(): string {
    return String(this.activeInvoiceCompanySnapshot()?.terms || this.invoiceTerms || '').trim();
  }

  invoiceClientAddress(): string {
    return String(
      this.openedInvoiceRecord?.clientSnapshot?.address ||
      this.selectedInvoiceClient?.address ||
      this.invoiceLead?.address ||
      '',
    ).trim();
  }

  invoicePreparedByName(): string {
    return String(
      (this.quoteMode ? '' : this.openedInvoiceRecord?.employeeName) ||
      this.employee?.name ||
      'DealVoice Employee',
    ).trim();
  }

  invoiceFooterText(): string {
    return String(
      this.activeInvoiceCompanySnapshot()?.footer ||
      this.invoiceFooter ||
      (this.quoteMode
        ? 'Kind note: We aim to provide high quality service at an affordable cost.'
        : 'This is a system-generated invoice. Please verify service details before processing payment.'),
    ).trim();
  }

  private defaultQuotationKindNote(): string {
    return String(this.invoiceFooter || DEFAULT_QUOTATION_KIND_NOTE).trim();
  }

  quotationKindNoteText(): string {
    return String(
      this.openedQuotationRecord?.kindNote ||
      this.quotationKindNoteDraft ||
      this.activeInvoiceCompanySnapshot()?.footer ||
      this.defaultQuotationKindNote(),
    ).trim();
  }

  private activeInvoiceCompanySnapshot(): any {
    if (!this.viewingSavedDocument) return null;
    return this.quoteMode ? this.openedQuotationRecord?.companySnapshot : this.openedInvoiceRecord?.companySnapshot;
  }

  private savedFinancialRecord(): { subtotal?: number; gstAmount?: number; total?: number } | null {
    if (!this.viewingSavedDocument) return null;
    return this.quoteMode ? this.openedQuotationRecord : this.openedInvoiceRecord;
  }

  invoicePreviewGstPercentage(): number {
    if (this.viewingSavedDocument) {
      const savedPercentage = Number(
        (this.quoteMode ? this.openedQuotationRecord?.gstPercentage : this.openedInvoiceRecord?.gstPercentage) || 0,
      );
      return savedPercentage;
    }
    if (this.documentGstPercentageOverride !== null) return this.documentGstPercentageOverride;
    return Number(this.gstPercentage || 0);
  }

  private resetDocumentGstSelection(): void {
    this.showGstSelectionModal = false;
    this.documentGstPercentageOverride = null;
    this.gstSelectionConfirmed = false;
  }

  private async setInvoiceQrFromUrl(publicUrl: string): Promise<void> {
    this.currentInvoicePublicUrl = publicUrl || '';
    this.currentInvoiceQrDataUrl = '';
    if (!publicUrl) return;
    try {
      const QRCode = await import('qrcode');
      this.currentInvoiceQrDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 136,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });
    } catch {
      this.currentInvoiceQrDataUrl = '';
    }
  }

  private async ensureInvoiceQr(): Promise<void> {
    if (!this.currentInvoicePublicUrl || this.currentInvoiceQrDataUrl) return;
    await this.setInvoiceQrFromUrl(this.currentInvoicePublicUrl);
  }

  private printFallback(): void {
    window.setTimeout(() => window.print(), 50);
  }

  private collectPrintHeadMarkup(): string {
    return Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');
  }

  private waitForPrintAssets(doc: Document): Promise<void> {
    const images = Array.from(doc.images || []);
    const imageReady = Promise.all(images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const complete = () => resolve();
        img.addEventListener('load', complete, { once: true });
        img.addEventListener('error', complete, { once: true });
      });
    }));
    const fontSet = (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    const fontsReady = fontSet?.ready ? fontSet.ready.catch(() => undefined) : Promise.resolve();
    return Promise.all([imageReady, fontsReady]).then(() => undefined);
  }

  private buildPrintDocument(previewHtml: string): string {
    const headMarkup = this.collectPrintHeadMarkup();
    const baseHref = String(document.baseURI || window.location.href).replace(/"/g, '&quot;');
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <base href="${baseHref}">
    ${headMarkup}
    <style>
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .employee-print-root,
      .employee-print-root * {
        visibility: visible !important;
      }

      .employee-print-root {
        width: 210mm !important;
        min-height: 297mm !important;
        margin: 0 auto !important;
        padding: 8mm !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
      }

      .employee-print-root .invoice-modal,
      .employee-print-root .invoice-builder {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 auto !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .employee-print-root .invoice-preview {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: 281mm !important;
        height: auto !important;
        margin: 0 auto !important;
        padding: 0 !important;
        overflow: visible !important;
        border-radius: 0 !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }

      .employee-print-root .invoice-preview:not(.quotation-preview) {
        display: flex !important;
        flex-direction: column !important;
      }

      .employee-print-root .quotation-page {
        page-break-after: always !important;
        break-after: page !important;
      }

      .employee-print-root .quotation-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }

      .employee-print-root .quotation-page + .quotation-page {
        margin-top: 0 !important;
      }

      @page {
        size: A4 portrait;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="employee-print-root">
      <div class="invoice-modal">
        <div class="invoice-builder">
          ${previewHtml}
        </div>
      </div>
    </div>
  </body>
</html>`;
  }

  private printCurrentDocument(): void {
    window.setTimeout(() => {
      const preview = document.getElementById('invoice-preview');
      if (!preview) {
        this.printFallback();
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentDocument;
      const frameWindow = iframe.contentWindow;
      if (!frameDoc || !frameWindow) {
        iframe.remove();
        this.printFallback();
        return;
      }

      frameDoc.open();
      frameDoc.write(this.buildPrintDocument(preview.outerHTML));
      frameDoc.close();

      const cleanup = () => window.setTimeout(() => iframe.remove(), 0);

      this.waitForPrintAssets(frameDoc).finally(() => {
        window.setTimeout(() => {
          const activeWindow = iframe.contentWindow;
          if (!activeWindow) {
            cleanup();
            this.printFallback();
            return;
          }
          activeWindow.addEventListener('afterprint', cleanup, { once: true });
          activeWindow.focus();
          activeWindow.print();
          window.setTimeout(cleanup, 2000);
        }, 120);
      });
    }, 50);
  }

  private resetInvoicePublicLink(): void {
    this.currentInvoicePublicUrl = '';
    this.currentInvoiceQrDataUrl = '';
  }

  private requestDocumentGstSelection(): void {
    this.showGstSelectionModal = true;
  }

  confirmDocumentGstSelection(useZeroGst: boolean): void {
    this.documentGstPercentageOverride = useZeroGst ? 0 : null;
    this.gstSelectionConfirmed = true;
    this.showGstSelectionModal = false;
    this.refreshInvoiceItemGstFromSelection();
    this.printInvoice();
  }

  cancelDocumentGstSelection(): void {
    this.showGstSelectionModal = false;
  }

  private refreshInvoiceItemGstFromSelection(): void {
    if (this.viewingSavedDocument) return;
    this.invoiceItems.forEach((item) => {
      if (item?.taxable === undefined && item?.gst === undefined && item?.total === undefined) return;
      const quantity = Math.max(1, Number(item.quantity || 1));
      const taxable = Number(item.price || 0) * quantity;
      const gst = taxable * (this.invoicePreviewGstPercentage() / 100);
      item.taxable = taxable;
      item.gst = gst;
      item.total = taxable + gst;
    });
  }

  private invoiceItemKey(item: any): string {
    const productId = String(item?.product?._id || item?.productId || '').trim();
    if (productId) return `product:${productId}`;
    return `name:${String(item?.name || item?.product?.name || '').trim().toLowerCase()}`;
  }

  private normalizeInvoicePaymentStatus(status?: string): 'paid' | 'unpaid' {
    return String(status || '').trim().toLowerCase() === 'paid' ? 'paid' : 'unpaid';
  }

  private uniqueLeadsByCompany(leads: Lead[]): Lead[] {
    const uniqueLeads: Lead[] = [];
    const seenCompanies = new Set<string>();
    for (const lead of leads) {
      const companyKey = String(lead?.leadCompanyName || '').trim().toLowerCase();
      if (!companyKey || seenCompanies.has(companyKey)) continue;
      seenCompanies.add(companyKey);
      uniqueLeads.push(lead);
    }
    return uniqueLeads;
  }

  invoiceClientCompanyName(): string {
    return String(
      this.openedInvoiceRecord?.clientSnapshot?.companyName ||
      this.selectedInvoiceClient?.companyName ||
      this.invoiceLead?.leadCompanyName ||
      '',
    ).trim() || 'Client Company';
  }

  invoiceClientContactName(): string {
    return String(
      this.openedInvoiceRecord?.clientSnapshot?.contactName ||
      this.selectedInvoiceClient?.primaryContactName ||
      this.selectedInvoiceClient?.primaryContact ||
      this.invoiceLead?.contactName ||
      '',
    ).trim();
  }

  invoiceClientPhone(): string {
    return String(
      this.openedInvoiceRecord?.clientSnapshot?.phone ||
      this.selectedInvoiceClient?.primaryPhone ||
      this.invoiceLead?.contactNumber ||
      '',
    ).trim();
  }

  invoiceClientEmail(): string {
    return String(
      this.openedInvoiceRecord?.clientSnapshot?.email ||
      this.selectedInvoiceClient?.primaryEmail ||
      this.invoiceLead?.directorEmailAddress ||
      '',
    ).trim();
  }

  invoiceNumber(): string {
    if (this.quoteMode) return this.quotationNumber();
    if (this.currentInvoiceNumber) return this.currentInvoiceNumber;
    const issued = this.invoiceIssuedAt || new Date();
    const yy = String(issued.getFullYear()).slice(-2);
    const mm = String(issued.getMonth() + 1).padStart(2, '0');
    const sequence = String(this.quoteNumber % 1000 || 1).padStart(3, '0');
    return `Invoice_${yy}${mm}${sequence}_v1`;
  }

  quotationNumber(): string {
    if (this.currentQuotationNumber) return this.currentQuotationNumber;
    const issued = this.invoiceIssuedAt || new Date();
    const yy = String(issued.getFullYear()).slice(-2);
    const mm = String(issued.getMonth() + 1).padStart(2, '0');
    const sequence = String(this.quoteNumber % 1000 || 1).padStart(3, '0');
    return `QT-${yy}${mm}${sequence}_v1`;
  }

  printInvoice(): void {
    if (this.invoiceItems.length === 0) {
      alert(`Please add at least one product to the ${this.quoteMode ? 'quotation' : 'invoice'}.`);
      return;
    }
    if (this.viewingSavedDocument) {
      void this.ensureInvoiceQr().finally(() => this.printCurrentDocument());
      return;
    }
    if (!this.gstSelectionConfirmed) {
      this.requestDocumentGstSelection();
      return;
    }
    if (this.quoteMode) {
      this.saveAndPrintQuotation();
      return;
    }
    if (!this.invoiceLead || !this.employee || this.invoiceSaving) return;

    const invoiceClient = this.selectedInvoiceClient;
    const sourceLeadId = invoiceClient?.sourceLeadIds?.[0] || this.invoiceLead._id;
    this.invoiceSaving = true;
    this.api.post<any>('/api/invoices', {
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
      employeeName: this.employee.name,
      createdByRole: 'employee',
      createdByName: this.employee.name,
      createdByPhone: this.employee.mobile,
      clientId: invoiceClient?.clientId || undefined,
      leadId: sourceLeadId,
      contactNumber: this.invoiceLead.contactNumber,
      gstPercentage: this.invoicePreviewGstPercentage(),
      invoiceDate: this.invoiceIssuedAt,
      dueDate: this.dueDate,
      paymentStatus: this.invoicePaymentStatus,
      items: this.invoiceItems.map((item) => ({
        productId: item.product?._id,
        name: item.name,
        rate: item.price,
        quantity: item.quantity,
        sacHsn: item.product?.sacHsn || '',
      })),
    }).subscribe({
      next: (res) => {
        this.invoiceSaving = false;
        if (!res?.success || !res.invoice) {
          alert(res?.message || 'Failed to save invoice.');
          return;
        }
        this.currentInvoiceNumber = res.invoice.invoiceNumber;
        this.currentInvoicePublicUrl = String(res.invoice.publicUrl || '');
        this.invoicePaymentStatus = this.normalizeInvoicePaymentStatus(res.invoice.paymentStatus);
        this.invalidateInvoiceCaches();
        this.fetchInvoiceRecords(true);
        void this.setInvoiceQrFromUrl(res.invoice.publicUrl || '').finally(() => this.printCurrentDocument());
      },
      error: (err) => {
        this.invoiceSaving = false;
        alert(err?.error?.message || 'Failed to save invoice.');
      },
    });
  }

  saveAndPrintQuotation(): void {
    if (!this.invoiceLead || !this.employee || this.quotationSaving) return;
    this.quotationSaving = true;
    this.api.post<any>('/api/quotations', {
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
      employeeName: this.employee.name,
      createdByRole: 'employee',
      createdByName: this.employee.name,
      createdByPhone: this.employee.mobile,
      leadId: this.invoiceLead._id,
      contactNumber: this.invoiceLead.contactNumber,
      gstPercentage: this.invoicePreviewGstPercentage(),
      quotationDate: this.invoiceIssuedAt,
      kindNote: this.quotationKindNoteText(),
      items: this.invoiceItems.map((item) => ({
        productId: item.product?._id,
        name: item.name,
        rate: item.price,
        quantity: item.quantity,
      })),
    }).subscribe({
      next: (res) => {
        this.quotationSaving = false;
        if (!res?.success || !res.quotation) {
          alert(res?.message || 'Failed to save quotation.');
          return;
        }
        this.currentQuotationNumber = res.quotation.quotationNumber;
        this.quotationKindNoteDraft = String(res.quotation.kindNote || this.quotationKindNoteText());
        this.invalidateQuotationCaches();
        this.fetchQuotationRecords(true);
        this.printCurrentDocument();
      },
      error: (err) => {
        this.quotationSaving = false;
        alert(err?.error?.message || 'Failed to save quotation.');
      },
    });
  }

  fetchInvoiceRecords(force = false): void {
    if (!this.employee) return;
    const restored = !force && this.restoreCachedInvoiceRecords();
    void this.loadInvoiceRecordsPage(1, { reset: true, silent: restored, forceRefresh: true });
  }

  fetchInvoiceEligibleLeads(force = false): void {
    if (!this.employee) return;
    if (this.invoiceEligibleLeadsLoaded && !force) return;
    const restored = !force && this.restoreCachedInvoiceLeadCompaniesPage(1);
    void this.loadInvoiceLeadCompaniesPage(1, {
      reset: true,
      silent: restored,
      forceRefresh: true,
    });
  }

  get invoiceConvertedLeads(): Lead[] {
    const convertedStatuses = this.CONVERTED_PAGE_STATUSES.map((status) => status.toLowerCase());
    const query = this.invoiceSearch.trim().toLowerCase();
    const source = [...this.invoiceEligibleLeads, ...this.allLeads];
    return this.uniqueLeadsByCompany(source
      .filter((lead) => convertedStatuses.includes((lead.status || '').toLowerCase()))
      .filter((lead) => {
        if (!query) return true;
        return [
          lead.leadCompanyName,
          lead.contactName,
          lead.contactNumber,
          lead.directorEmailAddress,
          lead.setLabel,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      }));
  }

  get quotationLeads(): Lead[] {
    const query = this.quotationSearch.trim().toLowerCase();
    return this.uniqueLeadsByCompany(this.allLeads
      .filter((lead) => {
        if (!query) return true;
        return [
          lead.leadCompanyName,
          lead.contactName,
          lead.contactNumber,
          lead.directorEmailAddress,
          lead.status,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      }));
  }

  get visibleInvoiceConvertedLeads(): Lead[] {
    return this.invoiceConvertedLeads.slice(0, this.invoiceLeadRenderCount);
  }

  get visibleQuotationLeads(): Lead[] {
    return this.quotationLeads.slice(0, this.quotationLeadRenderCount);
  }

  get filteredInvoiceRecords(): InvoiceRecord[] {
    const query = this.invoiceHistorySearch.trim().toLowerCase();
    return this.invoiceRecords.filter((invoice) => {
      const searchable = [
        invoice.invoiceNumber,
        invoice.leadCompanyName,
        invoice.contactName,
        invoice.contactNumber,
        invoice.directorEmailAddress,
      ].join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && this.matchesInvoiceDateFilter(invoice.invoiceDate || invoice.createdAt);
    });
  }

  matchesInvoiceDateFilter(rawDate?: string): boolean {
    if (!rawDate) return false;
    const date = new Date(rawDate);
    if (this.invoiceDateFrom) {
      const from = new Date(this.invoiceDateFrom);
      from.setHours(0, 0, 0, 0);
      if (date < from) return false;
    }
    if (this.invoiceDateTo) {
      const to = new Date(this.invoiceDateTo);
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
    return true;
  }

  fetchQuotationRecords(force = false): void {
    if (!this.employee) return;
    const restored = !force && this.restoreCachedQuotationRecords();
    void this.loadQuotationRecordsPage(1, { reset: true, silent: restored, forceRefresh: true });
  }

  onInvoiceHistoryQueryChange(): void {
    this.invoiceRecordsLoaded = false;
    this.fetchInvoiceRecords(true);
  }

  onQuotationHistoryQueryChange(): void {
    this.quotationRecordsLoaded = false;
    this.fetchQuotationRecords(true);
  }

  onFollowupQueryChange(): void {
    this.followupsLoaded = false;
    this.selectedFollowupId = '';
    this.fetchFollowups(true);
  }

  onInvoiceSearchChange(): void {
    if (this.invoiceSearchTimeoutRef) clearTimeout(this.invoiceSearchTimeoutRef);
    this.invoiceSearchTimeoutRef = setTimeout(() => {
      this.invoiceEligibleLeadsLoaded = false;
      void this.loadInvoiceLeadCompaniesPage(1, { reset: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  fetchClientOnboardingRecords(force = false): void {
    if (!this.employee) return;
    if (this.clientOnboardingLoaded && !force) return;
    void this.loadClientOnboardingPage(1, { reset: true, forceRefresh: true });
  }

  onClientOnboardingSearchChange(): void {
    if (this.clientOnboardingSearchTimeoutRef) clearTimeout(this.clientOnboardingSearchTimeoutRef);
    this.clientOnboardingSearchTimeoutRef = setTimeout(() => {
      this.clientOnboardingLoaded = false;
      this.selectedOnboardingClientId = '';
      void this.loadClientOnboardingPage(1, { reset: true, forceRefresh: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  selectOnboardingClient(client: ClientRecord): void {
    this.selectedOnboardingClientId = client.clientId;
  }

  get selectedOnboardingClient(): ClientRecord | null {
    return this.clientOnboardingRecords.find((client) => client.clientId === this.selectedOnboardingClientId) || null;
  }

  openClientOnboardingCreateModal(): void {
    this.resetClientOnboardingDraft();
    this.clientOnboardingCreateOpen = true;
  }

  closeClientOnboardingCreateModal(): void {
    this.clientOnboardingCreateOpen = false;
  }

  clientOnboardingRowKey(client: ClientRecord): string {
    return String(client._id || client.id || client.clientId || client.companyName || '');
  }

  toggleClientOnboardingRowMenu(client: ClientRecord, event?: Event): void {
    event?.stopPropagation();
    const key = this.clientOnboardingRowKey(client);
    this.clientOnboardingOpenMenuKey = this.clientOnboardingOpenMenuKey === key ? '' : key;
  }

  isClientOnboardingRowMenuOpen(client: ClientRecord): boolean {
    return !!this.clientOnboardingOpenMenuKey && this.clientOnboardingOpenMenuKey === this.clientOnboardingRowKey(client);
  }

  openClientOnboardingEditModal(client: ClientRecord): void {
    this.clientOnboardingOpenMenuKey = '';
    this.editingClientOnboarding = client;
    this.clientOnboardingEditDraft = {
      companyName: client.companyName || '',
      primaryContactName: client.primaryContactName || client.primaryContact || '',
      primaryPhone: client.primaryPhone || '',
      primaryEmail: client.primaryEmail || '',
      address: client.address || '',
    };
    this.clientOnboardingEditError = '';
    this.clientOnboardingEditOpen = true;
  }

  closeClientOnboardingEditModal(): void {
    this.clientOnboardingEditOpen = false;
    this.clientOnboardingEditError = '';
  }

  resetClientOnboardingDraft(): void {
    this.clientOnboardingDraft = {
      companyName: '',
      primaryContactName: '',
      primaryPhone: '',
      primaryEmail: '',
      address: '',
    };
    this.clientOnboardingError = '';
    this.clientOnboardingSuccess = '';
  }

  submitClientOnboarding(): void {
    if (!this.employee || this.clientOnboardingSaving) return;
    const companyName = this.clientOnboardingDraft.companyName.trim();
    if (!companyName) {
      this.clientOnboardingError = 'Company name is required.';
      return;
    }

    this.clientOnboardingSaving = true;
    this.clientOnboardingError = '';
    this.clientOnboardingSuccess = '';
    this.api.post<any>('/api/clients', {
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
      createdByRole: 'employee',
      createdByName: this.employee.name,
      createdByPhone: this.employee.mobile,
      companyName,
      primaryContactName: this.clientOnboardingDraft.primaryContactName.trim(),
      primaryPhone: this.clientOnboardingDraft.primaryPhone.trim(),
      primaryEmail: this.clientOnboardingDraft.primaryEmail.trim(),
      address: this.clientOnboardingDraft.address.trim(),
    }).subscribe({
      next: (res) => {
        this.clientOnboardingSaving = false;
        if (!res?.success || !res.client) {
          this.clientOnboardingError = res?.message || 'Failed to onboard client.';
          return;
        }
        const client = this.normalizeClientRecord(res.client);
        this.selectedOnboardingClientId = client.clientId;
        this.clientOnboardingSuccess = `Client ${client.clientId} onboarded.`;
        this.clientOnboardingDraft = {
          companyName: '',
          primaryContactName: '',
          primaryPhone: '',
          primaryEmail: '',
          address: '',
        };
        this.invalidateInvoiceCaches();
        this.clientOnboardingLoaded = false;
        this.invoiceEligibleLeadsLoaded = false;
        this.closeClientOnboardingCreateModal();
        this.fetchClientOnboardingRecords(true);
        this.fetchInvoiceEligibleLeads(true);
      },
      error: (err) => {
        this.clientOnboardingSaving = false;
        this.clientOnboardingError = err?.error?.message || 'Failed to onboard client.';
        const duplicateClient = err?.error?.client ? this.normalizeClientRecord(err.error.client) : null;
        if (duplicateClient?.clientId) {
          this.selectedOnboardingClientId = duplicateClient.clientId;
        }
      },
    });
  }

  submitClientOnboardingEdit(): void {
    if (!this.employee || this.clientOnboardingEditSaving || !this.editingClientOnboarding) return;
    const clientId = this.editingClientOnboarding._id || this.editingClientOnboarding.id || '';
    const companyName = this.clientOnboardingEditDraft.companyName.trim();
    if (!clientId) {
      this.clientOnboardingEditError = 'Client ID is missing.';
      return;
    }
    if (!companyName) {
      this.clientOnboardingEditError = 'Company name is required.';
      return;
    }

    this.clientOnboardingEditSaving = true;
    this.clientOnboardingEditError = '';
    this.api.put<any>(`/api/clients/${encodeURIComponent(clientId)}`, {
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
      companyName,
      primaryContactName: this.clientOnboardingEditDraft.primaryContactName.trim(),
      primaryPhone: this.clientOnboardingEditDraft.primaryPhone.trim(),
      primaryEmail: this.clientOnboardingEditDraft.primaryEmail.trim(),
      address: this.clientOnboardingEditDraft.address.trim(),
    }).subscribe({
      next: (res) => {
        this.clientOnboardingEditSaving = false;
        if (!res?.success || !res.client) {
          this.clientOnboardingEditError = res?.message || 'Failed to update client.';
          return;
        }
        const client = this.normalizeClientRecord(res.client);
        this.selectedOnboardingClientId = client.clientId;
        this.closeClientOnboardingEditModal();
        this.invalidateInvoiceCaches();
        this.clientOnboardingLoaded = false;
        this.invoiceEligibleLeadsLoaded = false;
        this.fetchClientOnboardingRecords(true);
        this.fetchInvoiceEligibleLeads(true);
      },
      error: (err) => {
        this.clientOnboardingEditSaving = false;
        this.clientOnboardingEditError = err?.error?.message || 'Failed to update client.';
      },
    });
  }

  onQuotationSearchChange(): void {
    if (this.quotationSearchTimeoutRef) clearTimeout(this.quotationSearchTimeoutRef);
    this.quotationSearchTimeoutRef = setTimeout(() => {
      this.quotationLeadCompaniesLoaded = false;
      void this.loadQuotationLeadCompaniesPage(1, { reset: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  openSavedInvoice(record: InvoiceRecord): void {
    this.quoteMode = false;
    this.viewingSavedDocument = true;
    this.openedInvoiceRecord = record;
    this.openedQuotationRecord = null;
    this.selectedInvoiceClient = null;
    this.resetDocumentGstSelection();
    this.invoiceTransferredFromQuotation = false;
    this.quotationTransferLoading = false;
    this.transferredQuotationRecord = null;
    this.currentInvoiceNumber = record.invoiceNumber;
    this.currentQuotationNumber = '';
    void this.setInvoiceQrFromUrl(record.publicUrl || '');
    this.invoiceIssuedAt = record.invoiceDate ? new Date(record.invoiceDate) : new Date(record.createdAt || Date.now());
    this.invoicePaymentStatus = this.normalizeInvoicePaymentStatus(record.paymentStatus);
    this.dueDate = record.dueDate ? new Date(record.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    this.invoiceLead = {
      _id: record._id,
      companyCode: this.employee?.companyCode || '',
      assignedEmployeePhone: this.employee?.mobile || '',
      leadCompanyName: record.leadCompanyName,
      contactName: record.contactName,
      contactNumber: record.contactNumber,
      directorEmailAddress: record.directorEmailAddress,
      address: '',
      status: '',
      setLabel: '',
    };
    this.invoiceItems = this.mapSavedDocumentItems(record.items);
    this.showInvoiceModal = true;
  }

  openSavedQuotation(record: QuotationRecord): void {
    this.quoteMode = true;
    this.viewingSavedDocument = true;
    this.openedInvoiceRecord = null;
    this.openedQuotationRecord = record;
    this.resetDocumentGstSelection();
    this.invoiceTransferredFromQuotation = false;
    this.quotationTransferLoading = false;
    this.transferredQuotationRecord = null;
    this.currentQuotationNumber = record.quotationNumber;
    this.currentInvoiceNumber = '';
    this.resetInvoicePublicLink();
    this.invoiceIssuedAt = record.quotationDate ? new Date(record.quotationDate) : new Date(record.createdAt || Date.now());
    this.quotationKindNoteDraft = String(record.kindNote || record.companySnapshot?.footer || this.defaultQuotationKindNote());
    this.invoiceLead = {
      _id: record._id,
      companyCode: this.employee?.companyCode || '',
      assignedEmployeePhone: this.employee?.mobile || '',
      leadCompanyName: record.leadCompanyName,
      contactName: record.contactName,
      contactNumber: record.contactNumber,
      directorEmailAddress: record.directorEmailAddress,
      address: '',
      status: '',
      setLabel: '',
    };
    this.invoiceItems = this.mapSavedDocumentItems(record.items);
    this.showInvoiceModal = true;
  }

  mapSavedDocumentItems(items?: Array<{ name: string; quantity: number; rate: number; total: number; taxable?: number; gst?: number; cgst?: number; sgst?: number; sacHsn?: string }>): any[] {
    return (items || []).map((item) => ({
      name: item.name,
      price: Number(item.rate || 0),
      quantity: Number(item.quantity || 1),
      taxable: Number((item as any).taxable ?? (Number(item.rate || 0) * Number(item.quantity || 1))),
      gst: Number((item as any).gst ?? (Number((item as any).cgst || 0) + Number((item as any).sgst || 0))),
      cgst: (item as any).cgst === undefined ? undefined : Number((item as any).cgst || 0),
      sgst: (item as any).sgst === undefined ? undefined : Number((item as any).sgst || 0),
      total: Number(item.total || 0),
      product: { name: item.name, sacHsn: (item as any).sacHsn || '' },
    }));
  }

  formatInvoicePaymentStatus(status?: string): string {
    return this.normalizeInvoicePaymentStatus(status) === 'paid' ? 'Paid' : 'Unpaid';
  }

  numberToWords(value: number): string {
    return numberToWords(value);
  }

  getGstBreakdown(): any[] {
    const breakdownMap = new Map<string, any>();
    const gstPct = this.invoicePreviewGstPercentage();

    this.invoiceItems.forEach((item: any) => {
      const hsn = item.product?.sacHsn || item.product?.hsn || '—';
      const taxable = this.invoiceItemTaxable(item);
      const cgst = this.invoiceItemGst(item) / 2;
      const sgst = this.invoiceItemGst(item) / 2;

      if (breakdownMap.has(hsn)) {
        const existing = breakdownMap.get(hsn)!;
        existing.taxableValue += taxable;
        existing.cgstAmount += cgst;
        existing.sgstAmount += sgst;
        existing.totalTax += cgst + sgst;
      } else {
        breakdownMap.set(hsn, {
          hsnSac: hsn,
          taxableValue: taxable,
          cgstRate: gstPct / 2,
          cgstAmount: cgst,
          sgstRate: gstPct / 2,
          sgstAmount: sgst,
          totalTax: cgst + sgst,
        });
      }
    });

    return Array.from(breakdownMap.values());
  }

  get filteredQuotationRecords(): QuotationRecord[] {
    const query = this.quotationHistorySearch.trim().toLowerCase();
    return this.quotationRecords.filter((quote) => {
      const searchable = [
        quote.quotationNumber,
        quote.leadCompanyName,
        quote.contactName,
        quote.contactNumber,
        quote.directorEmailAddress,
      ].join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && this.matchesQuotationDateFilter(quote.quotationDate || quote.createdAt);
    });
  }

  matchesQuotationDateFilter(rawDate?: string): boolean {
    if (!rawDate) return false;
    const date = new Date(rawDate);
    if (this.quotationDateFrom) {
      const from = new Date(this.quotationDateFrom);
      from.setHours(0, 0, 0, 0);
      if (date < from) return false;
    }
    if (this.quotationDateTo) {
      const to = new Date(this.quotationDateTo);
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
    return true;
  }
  get todayFollowupsCount(): number {
    return this.getFollowupCollections().todayFollowupsCount;
  }

  get filteredLeads(): Lead[] {
    return this.getLeadCollections().filteredLeads;
  }

  get uniqueInterestedCompanies(): string[] {
    return this.getLeadCollections().uniqueInterestedCompanies;
  }

  get uniqueDnpCompanies(): string[] {
    return this.getLeadCollections().uniqueDnpCompanies;
  }

  get uniqueConvertedCompanies(): string[] {
    return this.getLeadCollections().uniqueConvertedCompanies;
  }

  get uniqueFavouriteCompanies(): string[] {
    return this.getLeadCollections().uniqueFavouriteCompanies;
  }

  get interestedLeads(): Lead[] {
    return this.getLeadCollections().interestedLeads;
  }

  get dnpLeads(): Lead[] {
    return this.getLeadCollections().dnpLeads;
  }

  get convertedLeads(): Lead[] {
    return this.getLeadCollections().convertedLeads;
  }

  get favouriteLeads(): Lead[] {
    return this.getLeadCollections().favouriteLeads;
  }

  leadsInCompanyCount(company: string): number {
    return this.getLeadCollections().leadCompanyCounts[company] || 0;
  }

  private activeLeadSourceRows(): Lead[] {
    if (this.employeeLeadCompanies.length && this.isLeadWorkspaceTab()) {
      return this.employeeScopedLeads;
    }

    const leads = this.getLeadCollections();

    switch (this.dashTab) {
      case 'leads':
        return leads.filteredLeads;
      case 'interested':
        return leads.interestedLeads;
      case 'dnp':
        return leads.dnpLeads;
      case 'converted':
        return leads.convertedLeads;
      case 'favourite':
        return leads.favouriteLeads;
      case 'today-calls':
        return leads.todayModifiedLeads;
      default:
        return [];
    }
  }

  private activeRowsForCompany(company: string): Lead[] {
    const rows = this.rowsForCompany(this.activeLeadSourceRows(), company);
    return [...rows].sort((a, b) => this.toDateStamp(b.updatedAt || b.createdAt) - this.toDateStamp(a.updatedAt || a.createdAt));
  }

  activeCompanyLeadCount(company: string): number {
    const serverCompany = this.employeeLeadCompanies.find((item) => item.name === company);
    if (serverCompany) return serverCompany.count;
    return this.activeRowsForCompany(company).length;
  }

  activeCompanyPrimaryLead(company: string): Lead | null {
    return this.activeRowsForCompany(company)[0] || null;
  }

  activeCompanyPreviewLine(company: string): string {
    const lead = this.activeCompanyPrimaryLead(company);
    if (!lead) return '';

    if (lead.companyDescription) return lead.companyDescription;
    if (lead.mainDivisionDescription) return lead.mainDivisionDescription;
    if (lead.directorEmailAddress) return lead.directorEmailAddress;
    return `${lead.contactName || 'Primary Contact'} • ${lead.contactNumber || 'No number'}`;
  }

  activeCompanyPreviewMeta(company: string): string {
    const lead = this.activeCompanyPrimaryLead(company);
    if (!lead) return '';
    const updated = this.fmtDate(lead.updatedAt || lead.createdAt);
    return `${lead.contactName || 'Primary Contact'} • ${updated}`;
  }

  activeCompanyHeroLead(): Lead | null {
    return this.getSelectedLeadForAiBrief();
  }

  activeLeadBannerLead(): Lead | null {
    if (this.drawerSection === 'history') return null;
    return this.activeLeadRows[0] || null;
  }

  companyFullViewRows(): Lead[] {
    const contextCompany = String(this.companyFullContextLead?.leadCompanyName || this.selectedLeadCompany || '').trim();
    if (!contextCompany) return this.activeLeadRows;

    if (this.activeLeadRows.length && this.activeLeadRows[0]?.leadCompanyName === contextCompany) {
      return this.activeLeadRows;
    }

    const sourceRows = this.employeeScopedLeads.length ? this.employeeScopedLeads : this.allLeads;
    const rows = this.rowsForCompany(sourceRows, contextCompany);
    if (rows.length) return rows;

    return this.companyFullContextLead ? [this.companyFullContextLead] : [];
  }

  companyFullViewLead(): Lead | null {
    return this.companyFullViewRows()[0] || this.companyFullContextLead || this.activeLeadBannerLead();
  }

  companyFullCompanyName(): string {
    return this.selectedLeadCompany || this.companyFullProfile.leadCompanyName || this.companyFullViewLead()?.leadCompanyName || 'Company details';
  }

  companyFullViewContext(): string {
    const lead = this.companyFullViewLead();
    if (!lead) return '';
    return String(lead.mainDivisionDescription || lead.companyDescription || '').trim();
  }

  companyFullPrimaryContact(): string {
    return String(this.companyFullViewLead()?.contactName || 'Primary Contact').trim();
  }

  companyFullPrimaryPhone(): string {
    return this.companyFullResolvedPhone(this.companyFullViewLead()) || '—';
  }

  companyFullPrimaryEmail(): string {
    return this.companyFullResolvedEmail(this.companyFullViewLead()) || '—';
  }

  companyFullCompanyCode(): string {
    return String(this.companyFullViewLead()?.companyCode || this.employee?.companyCode || '').trim() || '—';
  }

  companyFullLatestUpdate(): string {
    return this.fmtDate(this.companyFullViewLead()?.updatedAt || this.companyFullViewLead()?.createdAt);
  }

  companyFullSetSummary(): string {
    const labels = Array.from(
      new Set(
        this.companyFullViewRows()
          .map((lead) => String(lead.setLabel || '').trim())
          .filter(Boolean)
      )
    );
    return labels.length ? labels.join(', ') : '—';
  }

  companyFullPrimaryStatus(): string {
    return String(this.companyFullViewLead()?.status || 'New').trim();
  }

  companyFullAlternatePhoneValue(): string {
    return this.companyFullAlternatePhone.trim() || '—';
  }

  companyFullAlternateEmailValue(): string {
    return this.companyFullAlternateEmail.trim() || '—';
  }

  companyFullOverviewContacts(): Lead[] {
    return this.companyFullViewRows();
  }

  companyFullContactPhone(lead: Lead | null | undefined): string {
    return this.companyFullResolvedPhone(lead) || '—';
  }

  companyFullContactEmail(lead: Lead | null | undefined): string {
    return this.companyFullResolvedEmail(lead) || '—';
  }

  companyFullHasFollowupSection(): boolean {
    if (this.companyFullFollowups.length > 0) return true;
    if (this.companyFullContextLead && this.isFollowupStatus(this.companyFullContextLead.status)) return true;
    return this.companyFullViewRows().some((lead) => this.isFollowupStatus(lead.status));
  }

  companyFullFollowupLead(): Lead | null {
    const rows = this.companyFullViewRows();
    const statusLead = rows.find((lead) => this.isFollowupStatus(lead.status));
    return statusLead || this.companyFullViewLead();
  }

  companyFullPrimaryFollowup(): Bookmark | null {
    if (!this.companyFullFollowups.length) return null;
    const sourceLead = this.companyFullFollowupLead();
    const matched = sourceLead
      ? this.companyFullFollowups.find((bookmark) => (
          this.normalizePhoneForMatch(bookmark.contactNumber) === this.normalizePhoneForMatch(sourceLead.contactNumber)
        ))
      : null;
    return matched || this.companyFullFollowups[0] || null;
  }

  companyFullFollowupDescription(): string {
    return String(this.companyFullPrimaryFollowup()?.description || this.companyFullFollowupForm.description || '').trim() || 'No description recorded.';
  }

  companyFullFollowupReminderLabel(): string {
    const reminderValue = String(
      this.companyFullPrimaryFollowup()?.reminderDate ||
      this.companyFullFollowupForm.reminderDate ||
      ''
    ).trim();
    return reminderValue ? this.fmtDate(reminderValue) : 'Not set';
  }

  companyFullFollowupHistoryEntries(): LeadHistoryLog[] {
    const activeBookmark = this.companyFullPrimaryFollowup();
    const activeNumber = this.normalizePhoneForMatch(activeBookmark?.contactNumber || this.companyFullFollowupLead()?.contactNumber || '');
    return this.companyFullHistoryLogs.filter((log) => {
      if (!this.isCompanyFollowupHistoryLog(log)) return false;
      if (!activeNumber) return true;
      return this.normalizePhoneForMatch((log as any)?.contactNumber || '') === activeNumber;
    });
  }

  companyFullFollowupFallbackRemarks(): string[] {
    return [...(this.companyFullPrimaryFollowup()?.remarks || [])].filter(Boolean).reverse();
  }

  companyFullFollowupHistoryText(log: LeadHistoryLog): string {
    return String(log.details || log.metadata?.remark || log.newValue || log.oldValue || log.action || '').trim();
  }

  companyFullRemarkEntries(): LeadHistoryLog[] {
    return this.companyFullRemarksHistory;
  }

  companyFullAdminRemarkOptions(): string[] {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const remark of this.productRemarks) {
      const normalized = String(remark || '').trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      options.push(normalized);
    }
    return options;
  }

  filteredCompanyFullAdminRemarkOptions(): string[] {
    const options = this.companyFullAdminRemarkOptions();
    const query = String(this.companyFullRemarkDraft || '').trim().toLowerCase();
    if (!query) return options;
    return options.filter((remark) => remark.toLowerCase().includes(query));
  }

  handleCompanyFullRemarkInput(value: string): void {
    this.companyFullRemarkDraft = value;
    this.openCompanyFullRemarkMenu();
  }

  openCompanyFullRemarkMenu(): void {
    this.clearCompanyFullRemarkMenuClose();
    this.companyFullRemarkMenuOpen = true;
  }

  queueCloseCompanyFullRemarkMenu(): void {
    this.clearCompanyFullRemarkMenuClose();
    this.companyFullRemarkMenuCloseRef = setTimeout(() => {
      this.companyFullRemarkMenuOpen = false;
      this.companyFullRemarkMenuCloseRef = null;
    }, 140);
  }

  toggleCompanyFullRemarkMenu(): void {
    this.clearCompanyFullRemarkMenuClose();
    this.companyFullRemarkMenuOpen = !this.companyFullRemarkMenuOpen;
  }

  selectCompanyFullAdminRemark(remark: string): void {
    this.companyFullRemarkDraft = remark;
    this.companyFullRemarkMenuOpen = false;
  }

  companyFullRemarkText(log: LeadHistoryLog): string {
    return String(
      log.metadata?.remark ||
      log.details ||
      log.newValue ||
      log.oldValue ||
      ''
    ).trim();
  }

  companyFullSectionId(section: CompanyFullSection): string {
    return `company-full-section-${section}`;
  }

  scrollCompanyFullSection(section: CompanyFullSection, behavior: ScrollBehavior = 'smooth'): void {
    this.companyFullActiveSection = section;
    const container = this.companyFullScrollContainer();
    const target = document.getElementById(this.companyFullSectionId(section));
    if (container && target) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      container.scrollTo({
        top: Math.max(0, container.scrollTop + (targetRect.top - containerRect.top) - 24),
        behavior,
      });
      return;
    }
    target?.scrollIntoView({ behavior, block: 'start' });
  }

  onCompanyFullContentScroll(event: Event): void {
    const container = event.target as HTMLElement | null;
    if (!container) return;
    this.syncCompanyFullActiveSection(container);
  }

  async saveCompanyFullAlternateInfo(): Promise<void> {
    const lead = this.companyFullViewLead();
    if (!lead?.companyCode || !this.companyFullCompanyName() || this.companyFullSavingAlternateInfo) return;

    this.companyFullSavingAlternateInfo = true;
    this.companyFullProfileError = '';

    try {
      const response = await firstValueFrom(this.api.patch<any>('/api/leads/company-profile', {
        companyCode: lead.companyCode,
        companyName: this.companyFullCompanyName(),
        alternatePhone: this.companyFullAlternatePhone.trim(),
        alternateEmail: this.companyFullAlternateEmail.trim(),
      }));
      this.applyCompanyFullProfile(response?.profile);
    } catch (error: any) {
      this.companyFullProfileError = error?.error?.message || 'Failed to save alternate info.';
    } finally {
      this.companyFullSavingAlternateInfo = false;
    }
  }

  async addCompanyFullNote(): Promise<void> {
    const lead = this.companyFullViewLead();
    const note = this.companyFullNoteDraft.trim();
    if (!lead?.companyCode || !this.companyFullCompanyName() || !note || this.companyFullNoteSaving) return;

    this.companyFullNoteSaving = true;
    this.companyFullProfileError = '';

    try {
      const response = await firstValueFrom(this.api.post<any>('/api/leads/company-profile/notes', {
        companyCode: lead.companyCode,
        companyName: this.companyFullCompanyName(),
        note,
      }));
      this.applyCompanyFullProfile(response?.profile);
      this.companyFullNoteDraft = '';
      this.scrollCompanyFullSection('notes', 'auto');
    } catch (error: any) {
      this.companyFullProfileError = error?.error?.message || 'Failed to save note.';
    } finally {
      this.companyFullNoteSaving = false;
    }
  }

  async addCompanyFullRemark(): Promise<void> {
    const lead = this.companyFullViewLead();
    const remark = this.companyFullRemarkDraft.trim();
    if (!lead?._id || !remark || this.companyFullRemarkSaving) return;

    this.companyFullRemarkSaving = true;
    this.companyFullRemarkError = '';

    try {
      const response = await firstValueFrom(this.api.post<any>(`/api/leads/${lead._id}/remarks`, { remark }));
      const updatedLead = this.normalizeLead(response?.lead);
      if (updatedLead?._id) this.applyLeadUpdate(updatedLead);
      this.companyFullRemarkMenuOpen = false;
      this.companyFullRemarkDraft = '';
      await this.reloadCompanyFullRemarkHistory();
      this.scrollCompanyFullSection('remarks', 'auto');
    } catch (error: any) {
      this.companyFullRemarkError = error?.error?.message || 'Failed to add remark.';
    } finally {
      this.companyFullRemarkSaving = false;
    }
  }

  async saveCompanyFullFollowup(): Promise<void> {
    const sourceLead = this.companyFullFollowupLead();
    const companyCode = String(this.employee?.companyCode || sourceLead?.companyCode || '').trim();
    const employeePhone = String(this.employee?.mobile || sourceLead?.assignedEmployeePhone || '').trim();
    const companyName = this.companyFullCompanyName();

    if (!sourceLead || !companyCode || !employeePhone || !companyName || this.companyFullFollowupSaving) return;

    this.companyFullFollowupSaving = true;
    this.companyFullFollowupError = '';

    const payload = {
      companyCode,
      employeePhone,
      contactNumber: sourceLead.contactNumber,
      contactName: sourceLead.contactName,
      companyName,
      description: this.companyFullFollowupForm.description.trim(),
      brochuresSent: this.companyFullFollowupForm.brochuresSent,
      techMeet: this.companyFullFollowupForm.techMeet,
      meetingRemarks: this.companyFullFollowupForm.meetingRemarks,
      quotationSent: this.companyFullFollowupForm.quotationSent,
      proposalSent: this.companyFullFollowupForm.proposalSent,
      whatsappGrp: this.companyFullFollowupForm.whatsappGrp,
      reminderDate: this.companyFullFollowupForm.reminderDate || undefined,
      newRemark: this.companyFullFollowupForm.newRemark.trim() || undefined,
    };

    try {
      const currentBookmark = this.companyFullPrimaryFollowup();
      if (currentBookmark?._id) {
        await firstValueFrom(this.api.patch<any>(`/api/bookmarks/${currentBookmark._id}`, payload));
      } else {
        await firstValueFrom(this.api.post<any>('/api/bookmarks', payload));
      }

      this.companyFullFollowupForm.newRemark = '';
      await Promise.all([
        this.reloadCompanyFullFollowupData(),
        this.reloadCompanyFullRemarkHistory(),
      ]);
      this.invalidateFollowupCaches();
      this.invalidateOverviewCaches();
      this.fetchFollowups(true);
      this.scrollCompanyFullSection('followups', 'auto');
    } catch (error: any) {
      this.companyFullFollowupError = error?.error?.message || 'Failed to save follow-up.';
    } finally {
      this.companyFullFollowupSaving = false;
    }
  }

  companyRemarkCount(lead: Lead): number {
    return (lead.remarks || []).filter(Boolean).length;
  }

  companyRemarkHistory(lead: Lead | null): string[] {
    return [...(lead?.remarks || [])].filter(Boolean).reverse();
  }

  leadContextPreview(lead: Lead): string {
    return String(
      lead.mainDivisionDescription ||
      lead.companyDescription ||
      lead.directorEmailAddress ||
      ''
    ).trim();
  }

  leadLatestRemarkPreview(lead: Lead): string {
    return [...(lead.remarks || [])].filter(Boolean).slice(-1)[0] || '';
  }

  leadRemarkPreviewList(lead: Lead): string[] {
    return [...(lead.remarks || [])].filter(Boolean).slice(-2).reverse();
  }

  private resetCompanyFullViewState(): void {
    this.companyFullLoading = false;
    this.companyFullProfileLoading = false;
    this.companyFullHistoryLoading = false;
    this.companyFullInvoiceLoading = false;
    this.companyFullQuotationLoading = false;
    this.companyFullFollowupLoading = false;
    this.companyFullProfileError = '';
    this.companyFullHistoryError = '';
    this.companyFullInvoiceError = '';
    this.companyFullQuotationError = '';
    this.companyFullRemarkError = '';
    this.companyFullFollowupError = '';
    this.companyFullProfile = {
      leadCompanyName: '',
      alternatePhone: '',
      alternateEmail: '',
      notes: [],
    };
    this.companyFullHistoryLogs = [];
    this.companyFullRemarksHistory = [];
    this.companyFullInvoiceItems = [];
    this.companyFullQuotationItems = [];
    this.companyFullFollowups = [];
    this.companyFullAlternatePhone = '';
    this.companyFullAlternateEmail = '';
    this.companyFullRemarkMenuOpen = false;
    this.companyFullRemarkDraft = '';
    this.companyFullNoteDraft = '';
    this.companyFullFollowupForm = {
      brochuresSent: false,
      techMeet: false,
      meetingRemarks: false,
      quotationSent: false,
      proposalSent: false,
      whatsappGrp: false,
      description: '',
      newRemark: '',
      reminderDate: '',
    };
  }

  private async loadCompanyFullViewData(): Promise<void> {
    const lead = this.companyFullViewLead();
    const companyCode = String(lead?.companyCode || this.employee?.companyCode || '').trim();
    const companyName = this.companyFullCompanyName();

    if (!companyCode || !companyName) return;

    this.companyFullLoading = true;
    this.companyFullProfileLoading = true;
    this.companyFullHistoryLoading = true;
    this.companyFullInvoiceLoading = true;
    this.companyFullQuotationLoading = true;
    this.companyFullFollowupLoading = true;

    const employeePhone = String(this.employee?.mobile || lead?.assignedEmployeePhone || '').trim();
    const query = this.buildApiQueryString({ companyCode, companyName });

    const [profileResult, historyResult, invoiceResult, quotationResult, followupResult] = await Promise.allSettled([
      firstValueFrom(this.api.get<any>(`/api/leads/company-profile?${query}`)),
      firstValueFrom(this.api.get<any>(`/api/history?${query}`)),
      firstValueFrom(this.invoicesRepository.history({
        companyCode,
        employeePhone: employeePhone || undefined,
        search: companyName,
        page: 1,
        pageSize: 100,
      })),
      firstValueFrom(this.quotationsRepository.history({
        companyCode,
        employeePhone: employeePhone || undefined,
        search: companyName,
        page: 1,
        pageSize: 100,
      })),
      employeePhone
        ? firstValueFrom(this.api.get<any>(`/api/bookmarks?${this.buildApiQueryString({ companyCode, phone: employeePhone })}`))
        : Promise.resolve({ success: true, bookmarks: [] }),
    ]);

    if (profileResult.status === 'fulfilled') {
      this.applyCompanyFullProfile(profileResult.value?.profile);
    } else {
      this.companyFullProfileError = 'Failed to load alternate info.';
    }
    this.companyFullProfileLoading = false;

    if (historyResult.status === 'fulfilled') {
      const logs = Array.isArray(historyResult.value?.logs) ? historyResult.value.logs : [];
      this.applyCompanyFullHistoryLogs(logs);
    } else {
      this.companyFullHistoryError = 'Failed to load remark history.';
    }
    this.companyFullHistoryLoading = false;

    if (invoiceResult.status === 'fulfilled') {
      const normalizedName = this.normalizeCompanyName(companyName);
      this.companyFullInvoiceItems = invoiceResult.value.items
        .map((item) => this.toWorkspaceInvoiceRecord(item as any))
        .filter((item) => this.normalizeCompanyName(item.leadCompanyName) === normalizedName);
    } else {
      this.companyFullInvoiceError = 'Failed to load invoice history.';
    }
    this.companyFullInvoiceLoading = false;

    if (quotationResult.status === 'fulfilled') {
      const normalizedName = this.normalizeCompanyName(companyName);
      this.companyFullQuotationItems = quotationResult.value.items
        .map((item) => this.toWorkspaceQuotationRecord(item as any))
        .filter((item) => this.normalizeCompanyName(item.leadCompanyName) === normalizedName);
    } else {
      this.companyFullQuotationError = 'Failed to load quotation history.';
    }
    this.companyFullQuotationLoading = false;

    if (followupResult.status === 'fulfilled') {
      const bookmarks = Array.isArray((followupResult.value as any)?.bookmarks) ? (followupResult.value as any).bookmarks : [];
      this.companyFullFollowups = this.normalizeCompanyFollowups(bookmarks, companyName, companyCode, employeePhone);
      this.syncCompanyFullFollowupForm();
    } else {
      this.companyFullFollowupError = 'Failed to load follow-up details.';
    }
    this.companyFullFollowupLoading = false;

    this.companyFullLoading = false;
  }

  private applyCompanyFullProfile(profile: any): void {
    this.companyFullProfile = {
      leadCompanyName: String(profile?.leadCompanyName || this.companyFullCompanyName() || '').trim(),
      alternatePhone: String(profile?.alternatePhone || '').trim(),
      alternateEmail: String(profile?.alternateEmail || '').trim(),
      notes: Array.isArray(profile?.notes)
        ? profile.notes
            .map((note: any) => ({
              _id: String(note?._id || ''),
              text: String(note?.text || '').trim(),
              createdAt: note?.createdAt ? String(note.createdAt) : '',
            }))
            .filter((note: CompanyFullViewNote) => note.text)
        : [],
      updatedAt: profile?.updatedAt ? String(profile.updatedAt) : '',
      createdAt: profile?.createdAt ? String(profile.createdAt) : '',
    };
    this.companyFullAlternatePhone = this.companyFullProfile.alternatePhone;
    this.companyFullAlternateEmail = this.companyFullProfile.alternateEmail;
  }

  private isCompanyRemarkHistoryLog(log: LeadHistoryLog): boolean {
    return String(log?.action || '').toLowerCase().includes('remark');
  }

  private isCompanyFollowupHistoryLog(log: LeadHistoryLog): boolean {
    const action = String(log?.action || '').toLowerCase();
    return action.includes('follow-up') || action.includes('bookmarked');
  }

  private filterCompanyRemarkHistory(logs: LeadHistoryLog[]): LeadHistoryLog[] {
    return logs.filter((log: LeadHistoryLog) => this.isCompanyRemarkHistoryLog(log));
  }

  private applyCompanyFullHistoryLogs(logs: LeadHistoryLog[]): void {
    this.companyFullHistoryLogs = [...logs];
    this.companyFullRemarksHistory = this.filterCompanyRemarkHistory(logs);
  }

  private async reloadCompanyFullRemarkHistory(): Promise<void> {
    const lead = this.companyFullViewLead();
    const companyCode = String(lead?.companyCode || this.employee?.companyCode || '').trim();
    const companyName = this.companyFullCompanyName();
    if (!companyCode || !companyName) return;

    this.companyFullHistoryLoading = true;
    this.companyFullHistoryError = '';
    try {
      const query = this.buildApiQueryString({ companyCode, companyName });
      const response = await firstValueFrom(this.api.get<any>(`/api/history?${query}`));
      const logs = Array.isArray(response?.logs) ? response.logs : [];
      this.applyCompanyFullHistoryLogs(logs);
    } catch (error: any) {
      this.companyFullHistoryError = error?.error?.message || 'Failed to load remark history.';
    } finally {
      this.companyFullHistoryLoading = false;
    }
  }

  private async reloadCompanyFullFollowupData(): Promise<void> {
    const sourceLead = this.companyFullFollowupLead() || this.companyFullViewLead();
    const companyCode = String(this.employee?.companyCode || sourceLead?.companyCode || '').trim();
    const employeePhone = String(this.employee?.mobile || sourceLead?.assignedEmployeePhone || '').trim();
    const companyName = this.companyFullCompanyName();
    if (!companyCode || !employeePhone || !companyName) return;

    this.companyFullFollowupLoading = true;
    this.companyFullFollowupError = '';
    try {
      const query = this.buildApiQueryString({ companyCode, phone: employeePhone });
      const response = await firstValueFrom(this.api.get<any>(`/api/bookmarks?${query}`));
      const bookmarks = Array.isArray(response?.bookmarks) ? response.bookmarks : [];
      this.companyFullFollowups = this.normalizeCompanyFollowups(bookmarks, companyName, companyCode, employeePhone);
      this.syncCompanyFullFollowupForm();
    } catch (error: any) {
      this.companyFullFollowupError = error?.error?.message || 'Failed to load follow-up details.';
    } finally {
      this.companyFullFollowupLoading = false;
    }
  }

  private applyLeadUpdate(updatedLead: Lead): void {
    const mergeList = (items: Lead[]): Lead[] => items.map((item) => (
      item._id === updatedLead._id
        ? { ...item, ...updatedLead, remarks: Array.isArray(updatedLead.remarks) ? updatedLead.remarks : [] }
        : item
    ));

    this.leads = mergeList(this.leads);
    this.allLeads = mergeList(this.allLeads);
    this.employeeScopedLeads = mergeList(this.employeeScopedLeads);

    if (this.historyLead?._id === updatedLead._id) {
      this.historyLead = { ...this.historyLead, ...updatedLead };
    }

    this.touchLeads();
  }

  private buildApiQueryString(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (!value) return;
      search.set(key, value);
    });
    return search.toString();
  }

  private normalizeCompanyName(value: string | undefined | null): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeCompanyFollowups(items: any[], companyName: string, companyCode: string, employeePhone: string): Bookmark[] {
    const normalizedCompany = this.normalizeCompanyName(companyName);
    return items
      .filter((item) => this.normalizeCompanyName(item?.companyName) === normalizedCompany)
      .map((item) => ({
        _id: String(item?._id || ''),
        companyCode: String(item?.companyCode || companyCode || '').trim(),
        employeePhone: String(item?.employeePhone || employeePhone || '').trim(),
        contactNumber: String(item?.contactNumber || '').trim(),
        contactName: String(item?.contactName || '').trim(),
        companyName: String(item?.companyName || companyName || '').trim(),
        description: String(item?.description || '').trim(),
        remarks: Array.isArray(item?.remarks)
          ? item.remarks.map((remark: unknown) => String(remark || '').trim()).filter(Boolean)
          : [],
        brochuresSent: !!item?.brochuresSent,
        techMeet: !!item?.techMeet,
        meetingRemarks: !!item?.meetingRemarks,
        quotationSent: !!item?.quotationSent,
        proposalSent: !!item?.proposalSent,
        whatsappGrp: !!item?.whatsappGrp,
        reminderDate: item?.reminderDate ? String(item.reminderDate) : '',
        createdAt: item?.createdAt ? String(item.createdAt) : '',
      }))
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  }

  private syncCompanyFullFollowupForm(): void {
    const bookmark = this.companyFullPrimaryFollowup();
    this.companyFullFollowupForm = {
      brochuresSent: !!bookmark?.brochuresSent,
      techMeet: !!bookmark?.techMeet,
      meetingRemarks: !!bookmark?.meetingRemarks,
      quotationSent: !!bookmark?.quotationSent,
      proposalSent: !!bookmark?.proposalSent,
      whatsappGrp: !!bookmark?.whatsappGrp,
      description: String(bookmark?.description || '').trim(),
      newRemark: '',
      reminderDate: bookmark?.reminderDate ? new Date(bookmark.reminderDate).toISOString().split('T')[0] : '',
    };
  }

  private companyFullScrollContainer(): HTMLElement | null {
    return this.companyFullScrollContent?.nativeElement || document.querySelector('.company-full-content');
  }

  private syncCompanyFullActiveSection(container: HTMLElement): void {
    const containerRect = container.getBoundingClientRect();
    const probeTop = containerRect.top + 140;
    let activeSection: CompanyFullSection = this.companyFullSections[0]?.id || 'overview';
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const section of this.companyFullSections) {
      const target = document.getElementById(this.companyFullSectionId(section.id));
      if (!target) continue;

      const rect = target.getBoundingClientRect();
      const distanceFromProbe = Math.abs(rect.top - probeTop);

      if (rect.top <= probeTop && distanceFromProbe <= nearestDistance) {
        activeSection = section.id;
        nearestDistance = distanceFromProbe;
      }
    }

    if (container.scrollTop <= 8) {
      activeSection = 'overview';
    }

    this.companyFullActiveSection = activeSection;
  }

  private clearCompanyFullRemarkMenuClose(): void {
    if (!this.companyFullRemarkMenuCloseRef) return;
    clearTimeout(this.companyFullRemarkMenuCloseRef);
    this.companyFullRemarkMenuCloseRef = null;
  }

  private companyFullResolvedPhone(lead: Lead | null | undefined): string {
    const values = [
      String(lead?.contactNumber || '').trim(),
      String(lead?.directorEmailAddress || '').trim(),
    ].filter(Boolean);
    return values.find((value) => this.isLikelyPhoneValue(value)) || values.find((value) => !this.isLikelyEmailValue(value)) || '';
  }

  private companyFullResolvedEmail(lead: Lead | null | undefined): string {
    const values = [
      String(lead?.directorEmailAddress || '').trim(),
      String(lead?.contactNumber || '').trim(),
    ].filter(Boolean);
    return values.find((value) => this.isLikelyEmailValue(value)) || '';
  }

  private normalizePhoneForMatch(value: string | undefined | null): string {
    return String(value || '').replace(/\D+/g, '');
  }

  private isFollowupStatus(value: string | undefined | null): boolean {
    return String(value || '').trim().toLowerCase() === 'follow up';
  }

  private isLikelyEmailValue(value: string): boolean {
    return /\S+@\S+\.\S+/.test(String(value || '').trim());
  }

  private isLikelyPhoneValue(value: string): boolean {
    const normalized = String(value || '').replace(/[^\d+]/g, '');
    const digitCount = normalized.replace(/\D/g, '').length;
    return digitCount >= 7 && !this.isLikelyEmailValue(value);
  }

  leadStatusShortLabel(status: string): string {
    if (this.INTERESTED_PAGE_STATUSES.includes(status)) return 'Interested';
    if (this.DNP_PAGE_STATUSES.includes(status)) return 'Not Connected';
    if (this.CONVERTED_PAGE_STATUSES.includes(status)) return 'Converted';
    if (status === 'Follow Up') return 'Follow-up';
    return status || 'New';
  }

  // ── Follow-ups ────────────────────────────────────────────────
  followups: Bookmark[] = [];
  followupsLoading = false;
  overviewFollowups: Bookmark[] = [];
  overviewFollowupsLoading = false;
  followupFilter: 'all' | 'today' | 'custom' = 'all';
  selectedFollowupDate = '';

  get filteredFollowups(): Bookmark[] {
    return this.getFollowupCollections().filteredFollowups;
  }

  get uniqueFollowupCompanies(): string[] {
    return this.getFollowupCollections().uniqueFollowupCompanies;
  }

  get followupsInSelectedCompany(): Bookmark[] {
    if (!this.selectedLeadCompany) return [];
    return this.filteredFollowups.filter(b => b.companyName === this.selectedLeadCompany);
  }

  followupsInCompanyCount(company: string): number {
    return this.getFollowupCollections().followupCompanyCounts[company] || 0;
  }

  getMatchedLeadForBookmark(bookmark: Bookmark | null | undefined): Lead | null {
    if (!bookmark) return null;
    return (
      this.getLeadByPhone(bookmark.contactNumber) ||
      this.allLeads.find(
        (lead) => lead.contactNumber === bookmark.contactNumber && lead.leadCompanyName === bookmark.companyName
      ) ||
      null
    );
  }

  activeFollowupHeroLead(): Lead | null {
    if (this.drawerSection === 'history') return null;
    return this.getMatchedLeadForBookmark(this.followupsInActiveCompany[0]) || null;
  }

  followupCompanyPreviewLine(company: string): string {
    const bookmark = this.filteredFollowups.find((item) => item.companyName === company);
    if (!bookmark) return '';
    if (bookmark.description) return bookmark.description;
    const latestRemark = [...(bookmark.remarks || [])].filter(Boolean).slice(-1)[0];
    if (latestRemark) return latestRemark;
    const matchedLead = this.getMatchedLeadForBookmark(bookmark);
    if (matchedLead) {
      return this.leadContextPreview(matchedLead) || this.activeCompanyPreviewLine(company);
    }
    return `${bookmark.contactName || 'Primary Contact'} • ${bookmark.contactNumber || 'No number'}`;
  }

  followupCompanyPreviewMeta(company: string): string {
    const bookmark = this.filteredFollowups.find((item) => item.companyName === company);
    if (!bookmark) return '';
    return `${bookmark.contactName || 'Primary Contact'} • ${this.fmtDate(bookmark.reminderDate || bookmark.createdAt)}`;
  }

  followupDescriptionPreview(bookmark: Bookmark): string {
    return String(bookmark.description || '').trim();
  }

  followupLatestRemarkPreview(bookmark: Bookmark): string {
    return [...(bookmark.remarks || [])].filter(Boolean).slice(-1)[0] || '';
  }

  followupRemarkPreviewList(bookmark: Bookmark): string[] {
    return [...(bookmark.remarks || [])].filter(Boolean).slice(-2).reverse();
  }

  followupCardNotePreviewList(bookmark: Bookmark): string[] {
    return [bookmark.description, ...(bookmark.remarks || [])]
      .map((remark) => String(remark || '').trim())
      .filter(Boolean)
      .slice(-2)
      .reverse();
  }

  followupReminderLabel(bookmark: Bookmark): string {
    if (!bookmark.reminderDate) return 'Reminder not set';
    return `Reminder • ${this.fmtDate(bookmark.reminderDate)}`;
  }

  followupAdminRemarkOptions(): string[] {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const remark of this.productRemarks) {
      const normalized = String(remark || '').trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      options.push(normalized);
    }
    return options;
  }

  filteredFollowupAdminRemarkOptions(bookmark: Bookmark): string[] {
    const options = this.followupAdminRemarkOptions();
    const query = String(this.followupRemarkInputs[bookmark._id] || '').trim().toLowerCase();
    if (!query) return options;
    return options.filter((remark) => remark.toLowerCase().includes(query));
  }

  handleFollowupRemarkInput(bookmark: Bookmark, value: string): void {
    this.followupRemarkInputs[bookmark._id] = value;
    this.openFollowupRemarkMenu(bookmark._id);
  }

  openFollowupRemarkMenu(bookmarkId: string): void {
    this.clearFollowupRemarkMenuClose();
    this.followupRemarkMenuOpenId = bookmarkId;
  }

  queueCloseFollowupRemarkMenu(bookmarkId: string): void {
    this.clearFollowupRemarkMenuClose();
    this.followupRemarkMenuCloseRef = setTimeout(() => {
      if (this.followupRemarkMenuOpenId === bookmarkId) {
        this.followupRemarkMenuOpenId = '';
      }
      this.followupRemarkMenuCloseRef = null;
    }, 140);
  }

  toggleFollowupRemarkMenu(bookmarkId: string): void {
    this.clearFollowupRemarkMenuClose();
    this.followupRemarkMenuOpenId = this.followupRemarkMenuOpenId === bookmarkId ? '' : bookmarkId;
  }

  isFollowupRemarkMenuOpen(bookmarkId: string): boolean {
    return this.followupRemarkMenuOpenId === bookmarkId;
  }

  selectFollowupAdminRemark(bookmark: Bookmark, remark: string): void {
    this.followupRemarkInputs[bookmark._id] = remark;
    this.followupRemarkMenuOpenId = '';
  }

  canAddFollowupRemark(bookmark: Bookmark): boolean {
    return !this.followupRemarkPostingIds.has(bookmark._id) && !!String(this.followupRemarkInputs[bookmark._id] || '').trim();
  }

  addFollowupRemark(bookmark: Bookmark): void {
    const remark = String(this.followupRemarkInputs[bookmark._id] || '').trim();
    if (!remark || this.followupRemarkPostingIds.has(bookmark._id)) return;

    this.followupRemarkPostingIds.add(bookmark._id);
    this.followupRemarkMenuOpenId = '';

    const body = {
      companyCode: bookmark.companyCode,
      employeePhone: bookmark.employeePhone,
      contactNumber: bookmark.contactNumber,
      contactName: bookmark.contactName,
      companyName: bookmark.companyName,
      description: bookmark.description,
      brochuresSent: bookmark.brochuresSent,
      techMeet: bookmark.techMeet,
      meetingRemarks: bookmark.meetingRemarks,
      quotationSent: bookmark.quotationSent,
      proposalSent: bookmark.proposalSent,
      whatsappGrp: bookmark.whatsappGrp,
      reminderDate: bookmark.reminderDate || undefined,
      remarks: [...(bookmark.remarks || [])],
      newRemark: remark,
    };

    this.api.patch<any>(`/api/bookmarks/${bookmark._id}`, body).subscribe({
      next: (res) => {
        this.followupRemarkPostingIds.delete(bookmark._id);
        if (!res.success) return;
        this.followupRemarkInputs[bookmark._id] = '';
        this.invalidateFollowupCaches();
        this.invalidateOverviewCaches();
        this.fetchFollowups(true);
      },
      error: () => {
        this.followupRemarkPostingIds.delete(bookmark._id);
      },
    });
  }

  private clearFollowupRemarkMenuClose(): void {
    if (!this.followupRemarkMenuCloseRef) return;
    clearTimeout(this.followupRemarkMenuCloseRef);
    this.followupRemarkMenuCloseRef = null;
  }

  followupEnabledFlags(bookmark: Bookmark): string[] {
    return [
      bookmark.brochuresSent ? 'Brochure Sent' : '',
      bookmark.quotationSent ? 'Quotation Sent' : '',
      bookmark.proposalSent ? 'Proposal Sent' : '',
      bookmark.techMeet ? 'Tech Meet' : '',
      bookmark.whatsappGrp ? 'Whatsapp Group' : '',
      bookmark.meetingRemarks ? 'Meeting Notes' : '',
    ].filter(Boolean);
  }

  // ── Follow-up Modal State ─────────────────────────────────────
  showFollowupModal = false;
  followupSaving = false;
  followupLead: Lead | null = null;
  editingBookmarkId: string | null = null;
  followupForm = {
    brochuresSent: false,
    techMeet: false,
    meetingRemarks: false,
    quotationSent: false,
    proposalSent: false,
    whatsappGrp: false,
    description: '',
    remarks: [] as string[],
    newRemark: '',
    reminderDate: ''
  };

  openFollowupModal(lead: Lead): void {
    this.showHistoryModal = false;
    this.followupLead = lead;
    this.editingBookmarkId = null;
    this.showFollowupModal = true;
    this.resetModalAiSuggestionState();
    // Reset form
    this.followupForm = {
      brochuresSent: false,
      techMeet: false,
      meetingRemarks: false,
      quotationSent: false,
      proposalSent: false,
      whatsappGrp: false,
      description: '',
      remarks: [],
      newRemark: '',
      reminderDate: ''
    };
    
    // Check if there is an existing bookmark for this contact to pre-fill
    const existing = this.followups.find(f => f.contactNumber === lead.contactNumber);
    if (existing) {
      this.editingBookmarkId = existing._id;
      this.followupForm.brochuresSent = existing.brochuresSent;
      this.followupForm.techMeet = existing.techMeet;
      this.followupForm.meetingRemarks = existing.meetingRemarks;
      this.followupForm.quotationSent = existing.quotationSent;
      this.followupForm.proposalSent = existing.proposalSent;
      this.followupForm.whatsappGrp = existing.whatsappGrp;
      this.followupForm.description = existing.description;
      this.followupForm.remarks = [...(existing.remarks || [])];
      if (existing.reminderDate) {
        this.followupForm.reminderDate = new Date(existing.reminderDate).toISOString().split('T')[0];
      }
    }
  }

  openEditFollowupModal(b: Bookmark): void {
    this.selectFollowupRecord(b, 'followup');
    this.showHistoryModal = false;
    this.populateFollowupDrawerState(b);
    this.showFollowupModal = this.dashTab !== 'followups';
    if (this.dashTab === 'followups') {
      this.scheduleFollowupSectionScroll('followup', 'smooth');
    }
  }

  openLeadFromFollowup(bookmark: Bookmark): void {
    this.showHistoryModal = false;
    this.closeFollowupModal();
    this.selectedFollowupId = '';
    this.selectedLeadId = '';
    this.selectedLeadCompany = bookmark.companyName;
    this.tabSelections['followups'] = bookmark.companyName;
    void this.openCompanyFullViewForLeadContext(this.buildDrawerLeadFromBookmark(bookmark), 'followups');
  }

  removeRemark(index: number): void {
    this.followupForm.remarks.splice(index, 1);
  }

  trackByFn(index: any, item: any) {
    return index;
  }

  closeFollowupModal(): void {
    this.showFollowupModal = false;
    this.followupLead = null;
    this.editingBookmarkId = null;
    this.resetModalAiSuggestionState();
    if (this.drawerSection === 'followup') this.drawerSection = 'details';
  }

  cancelFollowupEdit(): void {
    if (this.dashTab === 'followups' && this.currentSelectedFollowup) {
      this.populateFollowupDrawerState(this.currentSelectedFollowup);
      this.scrollFollowupSection('details');
      return;
    }

    this.closeFollowupModal();
  }

  saveFollowup(): void {
    if (!this.followupLead || !this.employee) return;
    this.followupSaving = true;

    const body = {
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
      contactNumber: this.followupLead.contactNumber,
      contactName: this.followupLead.contactName,
      companyName: this.followupLead.leadCompanyName,
      description: this.followupForm.description,
      brochuresSent: this.followupForm.brochuresSent,
      techMeet: this.followupForm.techMeet,
      meetingRemarks: this.followupForm.meetingRemarks,
      quotationSent: this.followupForm.quotationSent,
      proposalSent: this.followupForm.proposalSent,
      whatsappGrp: this.followupForm.whatsappGrp,
      reminderDate: this.followupForm.reminderDate || undefined,
      remarks: this.followupForm.remarks, // Send updated historical remarks
      newRemark: this.followupForm.newRemark.trim() || undefined
    };

    if (this.editingBookmarkId) {
      this.api.patch<any>(`/api/bookmarks/${this.editingBookmarkId}`, body).subscribe({
        next: (res) => {
          this.followupSaving = false;
          if (res.success && res.bookmark) {
            this.upsertFollowupLocally(res.bookmark);
            this.invalidateOverviewCaches();
            if (this.dashTab === 'followups') {
              this.showFollowupModal = false;
              this.populateFollowupDrawerState(res.bookmark);
              this.scrollFollowupSection('details');
            } else {
              this.closeFollowupModal();
            }
          }
        },
        error: () => { this.followupSaving = false; }
      });
    } else {
      this.api.post<any>(`/api/bookmarks`, body).subscribe({
        next: (res) => {
          this.followupSaving = false;
          if (res.success && res.bookmark) {
            this.upsertFollowupLocally(res.bookmark);
            this.invalidateOverviewCaches();
            if (this.dashTab === 'followups') {
              this.showFollowupModal = false;
              this.openFollowupFullDetails(res.bookmark, 'details');
            } else {
              this.closeFollowupModal();
            }
          }
        },
        error: () => { this.followupSaving = false; }
      });
    }
  }

  // ── Util ──────────────────────────────────────────────────────
  sidebarOpen = false;
  sidebarMinimized = false;

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleSidebarMinimized(): void {
    this.sidebarMinimized = !this.sidebarMinimized;
  }

  // ── Break button state ────────────────────────────────────────
  breakActive = false;
  breakPosting = false;
  breakTimerDisplay = '00:00';
  breakTotalSecondsToday = 0;
  private breakTimerRef: any;
  private breakStartedAt: number = 0;


  constructor(
    private sse: RealtimeService,
    public api: ApiService,
    private dashboardCache: DashboardCacheService,
    private aiBriefService: AiBriefService,
    private aiSuggestionService: AiSuggestionService,
    private employeeLeadsVm: EmployeeLeadsViewModel,
    private invoicesRepository: InvoicesRepository,
    private quotationsRepository: QuotationsRepository,
  ) { }

  ngOnInit(): void {
    Chart.register(...registerables);
    this.leadVmSub = this.employeeLeadsVm.state$.subscribe((state) => this.applyEmployeeLeadViewModelState(state));
    const raw = localStorage.getItem('dv_employee');
    let restoredSession = false;
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.employee = data.employee;
        this.companyName = data.companyName || '';
        this.loggedIn = true;
        restoredSession = true;
        this.loadDashboard();
        this.initRealtime();
        this.resumeBreakTimer();
      } catch { localStorage.removeItem('dv_employee'); }
    }
    if (!restoredSession) {
      setTimeout(() => {
        if (!this.startupWarmupPromise) this.showSplash = false;
      }, this.startupSplashMinMs);
    }
  }

  ngOnDestroy(): void {
    this.cancelStartupSplashFallback();
    this.startupWarmupRunId += 1;
    this.stopOverviewColumnResize();
    if (this.donutChart) this.donutChart.destroy();
    this.sse.disconnect();
    this.sseSub?.unsubscribe();
    this.leadVmSub?.unsubscribe();
    this.employeeLeadsVm.reset();
    this.leadFetchRun += 1;
    if (this._searchTimeout) clearTimeout(this._searchTimeout);
  }

  // ── Login ─────────────────────────────────────────────────────
  login(): void {
    const { companyCode, mobile } = this.loginForm;
    if (!companyCode.trim() || !mobile.trim()) {
      this.loginError = 'Company code and mobile number are required.';
      return;
    }
    this.loginLoading = true;
    this.loginError = '';

    this.api.post<any>(`/api/employees/login`, {
      companyCode: companyCode.trim(),
      mobile: mobile.trim(),
      countryCode: this.loginForm.countryCode,
    }).subscribe({
      next: res => {
        this.loginLoading = false;
        if (res.success) {
          this.employee = res.employee;

          // Also fetch company name
          this.api.get<any>(`/api/auth/company/${companyCode.trim()}`).subscribe({
            next: cr => {
              this.companyName = cr.company?.companyName || '';
              this.persistEmployeeSession();
            },
            error: () => {
              this.persistEmployeeSession();
            }
          });

          this.loggedIn = true;
          this.loadDashboard();
          this.initRealtime();
        } else {
          this.loginError = res.message || 'Login failed.';
        }
      },
      error: err => {
        this.loginLoading = false;
        this.loginError = err.error?.message || 'Employee not found with this number & company code.';
      }
    });
  }

  logout(): void {
    this.profileMenuOpen = false;
    this.closeProfileEditor();
    this.loggedIn = false;
    this.employee = null;
    this.companyName = '';
    this.callStats = null;
    this.timelineData = [];
    this.leads = [];
    this.followups = [];
    this.allLeads = [];
    this.todayCalls = [];
    this.invoiceRecords = [];
    this.invoiceEligibleLeads = [];
    this.invoiceLeadCompanies = [];
    this.invoiceLeadCompanyContacts = {};
    this.invoiceLeadCompanyPage = 1;
    this.invoiceLeadCompanyHasMore = false;
    this.invoiceLeadCompanyTotal = 0;
    this.clientOnboardingRecords = [];
    this.clientOnboardingPage = 1;
    this.clientOnboardingHasMore = false;
    this.clientOnboardingTotal = 0;
    this.selectedOnboardingClientId = '';
    this.selectedInvoiceClient = null;
    this.quotationRecords = [];
    this.quotationLeadCompanies = [];
    this.quotationLeadCompanyContacts = {};
    this.quotationLeadCompanyPage = 1;
    this.quotationLeadCompanyHasMore = false;
    this.quotationLeadCompanyTotal = 0;
    this.todayCallsLoaded = false;
    this.invoiceRecordsLoaded = false;
    this.invoiceEligibleLeadsLoaded = false;
    this.clientOnboardingLoaded = false;
    this.quotationRecordsLoaded = false;
    this.quotationLeadCompaniesLoaded = false;
    this.followupsLoaded = false;
    this.overviewFollowupsLoaded = false;
    this.overviewFollowups = [];
    this.overviewFollowupsLoading = false;
    this.cancelStartupSplashFallback();
    this.startupWarmupRunId += 1;
    this.startupWarmupPromise = null;
    this.showSplash = false;
    this.startupWarmupDone = false;
    this.overviewPeriodCache = {
      today: { stats: null, timeline: [], loaded: false },
      yesterday: { stats: null, timeline: [], loaded: false },
      lastweek: { stats: null, timeline: [], loaded: false },
    };
    this.resetEmployeeLeadPaginationState();
    this.employeeLeadsVm.reset();
    this.resetLeadSetSelections();
    this.resetLeadDivisionSelections();
    this.historyFilterDate = this.todayInputDate;
    this.selectedLeadCompany = '';
    this.selectedLeadId = '';
    this.selectedFollowupId = '';
    this.drawerSection = 'details';
    this.dashTab = 'overview';
    this.dashboardCache.clearAll();
    localStorage.removeItem('dv_employee');
    this.sse.disconnect();
    this.sseSub?.unsubscribe();
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }
    this.touchLeads();
    this.touchFollowups();
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.profileMenuOpen = !this.profileMenuOpen;
    this.profilePhotoError = '';
    this.profilePhotoSuccess = '';
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  openProfilePhotoPicker(input: HTMLInputElement): void {
    this.profilePhotoError = '';
    this.profilePhotoSuccess = '';
    input.value = '';
    input.click();
  }

  onProfilePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    this.profilePhotoError = '';
    this.profilePhotoSuccess = '';

    if (!file.type.startsWith('image/')) {
      this.profilePhotoError = 'Please choose an image file.';
      return;
    }

    if (file.size > this.profilePhotoMaxFileSizeMb * 1024 * 1024) {
      this.profilePhotoError = `Max image size is ${this.profilePhotoMaxFileSizeMb} MB.`;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        this.profilePhotoError = 'Unable to read the selected image.';
        return;
      }
      this.openProfileEditor(result);
    };
    reader.onerror = () => {
      this.profilePhotoError = 'Unable to read the selected image.';
    };
    reader.readAsDataURL(file);
  }

  openProfileEditor(imageSrc: string): void {
    this.profileEditorOpen = true;
    this.profileEditorImageSrc = imageSrc;
    this.profileEditorScale = 1;
    this.profileEditorMinScale = 1;
    this.profileEditorMaxScale = 3;
    this.profileEditorOffsetX = 0;
    this.profileEditorOffsetY = 0;
    this.profileEditorDragging = false;
  }

  closeProfileEditor(): void {
    this.profileEditorOpen = false;
    this.profileEditorImageSrc = '';
    this.profileEditorDragging = false;
  }

  onProfileEditorImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img?.naturalWidth || !img.naturalHeight) return;
    const minDimension = Math.min(img.naturalWidth, img.naturalHeight);
    const maxDimension = Math.max(img.naturalWidth, img.naturalHeight);
    this.profileEditorMinScale = Math.max(1, 220 / minDimension);
    this.profileEditorMaxScale = Math.max(this.profileEditorMinScale + 2, maxDimension / minDimension);
    this.profileEditorScale = Math.max(1.15, this.profileEditorMinScale);
    this.profileEditorOffsetX = 0;
    this.profileEditorOffsetY = 0;
    this.clampProfileEditorOffset();
  }

  startProfileEditorDrag(event: MouseEvent): void {
    event.preventDefault();
    this.profileEditorDragging = true;
    this.profileEditorDragStartX = event.clientX;
    this.profileEditorDragStartY = event.clientY;
    this.profileEditorStartOffsetX = this.profileEditorOffsetX;
    this.profileEditorStartOffsetY = this.profileEditorOffsetY;
  }

  onProfileEditorScaleChange(value: string | number): void {
    const numeric = typeof value === 'number' ? value : Number(value);
    this.profileEditorScale = Number.isFinite(numeric)
      ? Math.min(this.profileEditorMaxScale, Math.max(this.profileEditorMinScale, numeric))
      : this.profileEditorMinScale;
    this.clampProfileEditorOffset();
  }

  private updateProfileEditorOffset(x: number, y: number): void {
    this.profileEditorOffsetX = x;
    this.profileEditorOffsetY = y;
    this.clampProfileEditorOffset();
  }

  private clampProfileEditorOffset(): void {
    const limit = 110 * Math.max(0, this.profileEditorScale - 1);
    this.profileEditorOffsetX = Math.max(-limit, Math.min(limit, this.profileEditorOffsetX));
    this.profileEditorOffsetY = Math.max(-limit, Math.min(limit, this.profileEditorOffsetY));
  }

  saveProfilePhoto(): void {
    if (!this.employee?._id || !this.profileEditorImageSrc || this.profilePhotoSaving) return;

    let processedDataUrl = '';
    try {
      processedDataUrl = this.renderProfilePhotoDataUrl();
    } catch {
      this.profilePhotoError = 'Unable to process the image.';
      return;
    }

    this.updateProfilePhoto(processedDataUrl, 'Profile photo updated.', true);
  }

  removeProfilePhoto(): void {
    if (!this.employee?._id || !this.hasProfilePhoto || this.profilePhotoSaving) return;
    this.updateProfilePhoto('', 'Profile photo removed.');
  }

  private updateProfilePhoto(profilePhoto: string, successMessage: string, closeEditor = false): void {
    if (!this.employee?._id) return;

    this.profilePhotoSaving = true;
    this.profilePhotoError = '';
    this.profilePhotoSuccess = '';

    this.api.patch<any>(`/api/employees/${this.employee._id}/profile-photo`, {
      profilePhoto,
    }).subscribe({
      next: (res) => {
        this.profilePhotoSaving = false;
        if (!res.success) {
          this.profilePhotoError = res.message || 'Unable to save profile photo.';
          return;
        }

        if (res.employee) {
          this.employee = res.employee;
        } else if (this.employee) {
          this.employee = {
            ...this.employee,
            profilePhoto: profilePhoto || undefined,
          };
        }

        this.persistEmployeeSession();
        this.profilePhotoSuccess = successMessage;
        if (closeEditor) this.closeProfileEditor();
      },
      error: (err) => {
        this.profilePhotoSaving = false;
        this.profilePhotoError = err.error?.message || 'Unable to save profile photo.';
      },
    });
  }

  private renderProfilePhotoDataUrl(): string {
    const image = document.querySelector('.profile-editor-image') as HTMLImageElement | null;
    if (!image?.naturalWidth || !image.naturalHeight) {
      throw new Error('Profile image is not ready');
    }

    const canvas = document.createElement('canvas');
    const size = this.profilePhotoOutputSize;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');

    const coverScale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * this.profileEditorScale;
    const drawWidth = image.naturalWidth * coverScale;
    const drawHeight = image.naturalHeight * coverScale;
    const x = (size - drawWidth) / 2 + (this.profileEditorOffsetX / 220) * size;
    const y = (size - drawHeight) / 2 + (this.profileEditorOffsetY / 220) * size;

    context.clearRect(0, 0, size, size);
    context.drawImage(image, x, y, drawWidth, drawHeight);
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  private persistEmployeeSession(): void {
    if (!this.employee) return;
    localStorage.setItem('dv_employee', JSON.stringify({
      employee: this.employee,
      companyName: this.companyName,
    }));
  }

  // ── Dashboard Loader ──────────────────────────────────────────
  initRealtime(): void {
    if (!this.employee) return;
    this.sse.connect(this.employee.companyCode, this.employee.mobile);
    this.sseSub = this.sse.events$.subscribe((ev: SSEEvent) => {
      this.handleRealtimeEvent(ev);
    });
  }

  normalizeLead(lead: any): Lead {
    if (!lead) return lead;
    const rawPhone = String(lead.contactNumber || '').trim();
    const rawEmail = String(lead.directorEmailAddress || '').trim();
    let contactNumber = rawPhone;
    let directorEmailAddress = rawEmail;

    const phoneFieldHasEmail = this.looksLikeEmail(rawPhone);
    const emailFieldHasPhone = this.looksLikePhone(rawEmail);
    if (phoneFieldHasEmail && emailFieldHasPhone) {
      contactNumber = this.cleanPhoneDisplay(rawEmail);
      directorEmailAddress = rawPhone;
    } else if (phoneFieldHasEmail && !this.looksLikeEmail(rawEmail)) {
      contactNumber = '';
      directorEmailAddress = rawPhone;
    } else if (!rawPhone && emailFieldHasPhone) {
      contactNumber = this.cleanPhoneDisplay(rawEmail);
      directorEmailAddress = '';
    } else if (this.looksLikePhone(rawPhone)) {
      contactNumber = this.cleanPhoneDisplay(rawPhone);
    }

    return {
      ...lead,
      contactNumber,
      directorEmailAddress,
      remarks: Array.isArray(lead.remarks) ? lead.remarks : (lead.remarks ? [lead.remarks] : [])
    };
  }

  private looksLikeEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  private looksLikePhone(value: string): boolean {
    const normalized = String(value || '').replace(/[^\d]/g, '');
    return normalized.length >= 7 && !this.looksLikeEmail(value);
  }

  private cleanPhoneDisplay(value: string): string {
    return String(value || '').trim().replace(/^'+|'+$/g, '');
  }

  private toShellLead(lead: EmployeeLeadModel): Lead {
    return {
      _id: lead.id,
      companyCode: lead.companyCode,
      assignedEmployeePhone: lead.assignedEmployeePhone,
      leadCompanyName: lead.companyName,
      contactName: lead.contactName,
      contactNumber: lead.contactNumber,
      status: lead.status,
      setLabel: lead.setLabel,
      companyDescription: lead.description,
      mainDivisionDescription: lead.division,
      directorEmailAddress: lead.email,
      remarks: lead.remarks,
      isStarred: lead.isStarred,
      isFavourite: lead.isFavourite,
      sheetOrder: lead.sheetOrder,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  private toEmployeeLeadModel(lead: Lead): EmployeeLeadModel {
    return {
      id: lead._id,
      companyCode: lead.companyCode,
      assignedEmployeePhone: lead.assignedEmployeePhone,
      companyName: lead.leadCompanyName,
      contactName: lead.contactName,
      contactNumber: lead.contactNumber,
      status: lead.status,
      setLabel: lead.setLabel,
      description: lead.companyDescription || '',
      division: lead.mainDivisionDescription || '',
      email: lead.directorEmailAddress || '',
      remarks: lead.remarks || [],
      isStarred: !!lead.isStarred,
      isFavourite: !!lead.isFavourite,
      sheetOrder: lead.sheetOrder,
      createdAt: lead.createdAt || '',
      updatedAt: lead.updatedAt || '',
    };
  }

  private toWorkspaceInvoiceRecord(record: any): InvoiceRecord {
    return {
      _id: String(record?._id || record?.id || ''),
      invoiceNumber: String(record?.invoiceNumber || ''),
      publicToken: String(record?.publicToken || ''),
      publicUrl: String(record?.publicUrl || ''),
      clientId: String(record?.clientId || record?.clientSnapshot?.clientId || ''),
      leadCompanyName: String(record?.leadCompanyName || record?.companyName || ''),
      contactName: String(record?.contactName || ''),
      contactNumber: String(record?.contactNumber || ''),
      directorEmailAddress: String(record?.directorEmailAddress || ''),
      employeePhone: String(record?.employeePhone || ''),
      employeeName: String(record?.employeeName || ''),
      total: Number(record?.total || 0),
      invoiceDate: String(record?.invoiceDate || ''),
      createdAt: String(record?.createdAt || ''),
      dueDate: String(record?.dueDate || ''),
      versionNo: Number(record?.versionNo || 0),
      paymentStatus: this.normalizeInvoicePaymentStatus(record?.paymentStatus),
      items: Array.isArray(record?.items) ? record.items : [],
      subtotal: Number(record?.subtotal || 0),
      gstPercentage: Number(record?.gstPercentage || 0),
      cgst: Number(record?.cgst || 0),
      sgst: Number(record?.sgst || 0),
      gstAmount: Number(record?.gstAmount || 0),
      companySnapshot: record?.companySnapshot,
      clientSnapshot: record?.clientSnapshot,
    };
  }

  private toWorkspaceQuotationRecord(record: any): QuotationRecord {
    return {
      _id: String(record?._id || record?.id || ''),
      quotationNumber: String(record?.quotationNumber || ''),
      leadCompanyName: String(record?.leadCompanyName || record?.companyName || ''),
      contactName: String(record?.contactName || ''),
      contactNumber: String(record?.contactNumber || ''),
      directorEmailAddress: String(record?.directorEmailAddress || ''),
      total: Number(record?.total || 0),
      quotationDate: String(record?.quotationDate || ''),
      createdAt: String(record?.createdAt || ''),
      versionNo: Number(record?.versionNo || 0),
      kindNote: String(record?.kindNote || ''),
      items: Array.isArray(record?.items) ? record.items : [],
      subtotal: Number(record?.subtotal || 0),
      gstPercentage: Number(record?.gstPercentage || 0),
      gstAmount: Number(record?.gstAmount || 0),
      companySnapshot: record?.companySnapshot,
    };
  }

  private applyEmployeeLeadViewModelState(state: EmployeeLeadsState): void {
    this.employeeLeadCompanies = state.companies;
    this.employeeLeadCompanyTotal = state.companyTotal;
    this.employeeLeadCompanyPage = Math.max(1, Math.ceil(state.companies.length / this.leadCompanyPageSize));
    this.employeeLeadCompanyHasMore = state.companyHasMore;
    this.employeeLeadCompaniesLoading = state.companyLoadingMore;
    this.employeeLeadContactsPage = state.page;
    this.employeeLeadContactsHasMore = state.hasMore;
    this.employeeLeadContactsLoadingMore = state.loadingMore;
    this.leadsLoading = state.loading;
    this.serverLeadSets = state.sets;
    this.serverLeadDivisions = Array.isArray(state.divisions) ? state.divisions : [];

    if (this._selectedLeadCompany !== state.selectedCompany) {
      this._selectedLeadCompany = state.selectedCompany;
      this.tabSelections[this.dashTab] = state.selectedCompany;
      if (state.selectedCompany) this.syncAiForActiveView();
    }
    if (this.selectedLeadId !== state.selectedLeadId) {
      this.selectedLeadId = state.selectedLeadId;
    }
    this.drawerSection = state.drawerSection;
    this.historyLogs = state.historyLogs;
    this.historyLoading = state.historyLoading;

    const shellLeads = state.leads.map((lead) => this.toShellLead(lead));
    this.employeeScopedLeads = shellLeads;
    if (shellLeads.length) {
      const hydratedCompanies = new Set(shellLeads.map((lead) => lead.leadCompanyName).filter(Boolean));
      const hydratedIds = new Set(shellLeads.map((lead) => lead._id).filter(Boolean));
      const otherLeads = this.allLeads.filter((lead) => {
        if (hydratedIds.has(lead._id)) return false;
        return !hydratedCompanies.has(lead.leadCompanyName);
      });
      this.allLeads = [...otherLeads, ...shellLeads].sort((a, b) => {
        const aOrder = a.sheetOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sheetOrder ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.contactName || '').localeCompare(String(b.contactName || ''));
      });
    } else {
      this.allLeads = [];
    }
    this.leads = [...this.allLeads];
    if (
      state.search === this.leadSearch.trim() &&
      !state.loading &&
      !state.loadingMore &&
      !state.companyLoadingMore &&
      (state.companies.length > 0 || state.leads.length > 0 || state.empty || !!state.error)
    ) {
      this.isSearching = false;
    }
    this.touchLeads();
  }

  private touchLeads(): void {
    this.leadStateVersion += 1;
    this.leadCollectionsCache = null;
    this.workspaceStateCache = null;
  }

  private touchFollowups(): void {
    this.followupStateVersion += 1;
    this.followupCollectionsCache = null;
    this.workspaceStateCache = null;
  }

  private toDateStamp(value: string | undefined | null): number {
    return value ? new Date(value).getTime() : 0;
  }

  private uniqueCompanyNames<T>(items: T[], pickName: (item: T) => string | undefined): string[] {
    const companies = new Set<string>();
    for (const item of items) {
      const name = String(pickName(item) || '').trim();
      if (name) companies.add(name);
    }
    return Array.from(companies);
  }

  handleRealtimeEvent(ev: SSEEvent): void {
    if (ev.type === 'LEADS_REFRESH' || ev.type === 'LEADS_BULK_CREATED' || ev.type === 'LEAD_SET_DELETED') {
      this.invalidateInvoiceCaches();
      this.invalidateOverviewCaches();
      this.fetchLeads(true); // bulk change, just refresh
    } else if (ev.type === 'LEAD_CREATED' && ev.lead) {
      this.invalidateInvoiceCaches();
      this.invalidateOverviewCaches();
      const normalized = this.normalizeLead(ev.lead);
      const sortFn = (a: Lead, b: Lead) => {
        const aOrder = a.sheetOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sheetOrder ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.contactName || '').localeCompare(String(b.contactName || ''));
      };
      if (!this.leads.find(l => l._id === ev.lead._id)) {
        this.leads.push(normalized);
        this.leads.sort(sortFn);
      }
      if (!this.allLeads.find(l => l._id === ev.lead._id)) {
        this.allLeads.push(normalized);
        this.allLeads.sort(sortFn);
      }
      this.touchLeads();
    } else if (ev.type === 'LEAD_UPDATED' && ev.lead) {
      this.invalidateInvoiceCaches();
      this.invalidateOverviewCaches();
      const normalized = this.normalizeLead(ev.lead);
      const idx = this.leads.findIndex(l => l._id === ev.lead._id);
      if (idx !== -1) this.leads[idx] = normalized;
      const allIdx = this.allLeads.findIndex(l => l._id === ev.lead._id);
      if (allIdx !== -1) this.allLeads[allIdx] = normalized;
      this.touchLeads();
    } else if (ev.type === 'LEAD_DELETED' && ev.id) {
      this.invalidateInvoiceCaches();
      this.invalidateOverviewCaches();
      this.leads = this.leads.filter(l => l._id !== ev.id);
      this.allLeads = this.allLeads.filter(l => l._id !== ev.id);
      this.touchLeads();
    } else if (ev.type === 'BOOKMARK_CREATED' && ev.bookmark) {
      this.invalidateFollowupCaches();
      this.invalidateOverviewCaches();
      if (!this.followups.find(b => b._id === ev.bookmark._id)) {
        this.followups.unshift(ev.bookmark);
      }
      this.touchFollowups();
    } else if (ev.type === 'BOOKMARK_UPDATED' && ev.bookmark) {
      this.invalidateFollowupCaches();
      this.invalidateOverviewCaches();
      const idx = this.followups.findIndex(b => b._id === ev.bookmark._id);
      if (idx !== -1) this.followups[idx] = ev.bookmark;
      this.touchFollowups();
    } else if (ev.type === 'BOOKMARK_DELETED' && ev.id) {
      this.invalidateFollowupCaches();
      this.invalidateOverviewCaches();
      this.followups = this.followups.filter(b => b._id !== ev.id);
      this.touchFollowups();
    }
  }

  loadDashboard(): void {
    if (this.startupWarmupPromise) return;
    const runId = ++this.startupWarmupRunId;
    this.showSplash = true;
    this.startupWarmupDone = false;
    this.armStartupSplashFallback(runId);
    this.startupWarmupPromise = this.runStartupWarmup(runId);
  }

  private async runStartupWarmup(runId: number): Promise<void> {
    const minimumSplash = this.delay(this.startupSplashMinMs);
    try {
      await this.loadCompanySettings();
      this.fetchBreakStatus();
      const restoredOverview = this.applyCachedOverviewPeriod(this.selectedPeriod);
      this.restoreCachedFollowups();
      this.employeeLeadsVm.loadScope(
        this.employee!.companyCode,
        this.employee!.mobile,
        this.currentEmployeeLeadScope(),
      );
      await Promise.all([
        this.loadOverviewPeriod(this.selectedPeriod, {
          preferCache: restoredOverview,
          silent: restoredOverview,
        }),
        this.loadOverviewFollowupsOnce(),
        this.warmDefaultLeadScopes(),
      ]);
      void this.warmBackgroundDashboardData(runId);
    } finally {
      await minimumSplash;
      this.finishStartupWarmup(runId, true);
    }
  }

  private armStartupSplashFallback(runId: number): void {
    this.cancelStartupSplashFallback();
    this.startupSplashFallbackRef = setTimeout(() => {
      this.finishStartupWarmup(runId, false);
    }, this.startupSplashMaxMs);
  }

  private cancelStartupSplashFallback(): void {
    if (!this.startupSplashFallbackRef) return;
    clearTimeout(this.startupSplashFallbackRef);
    this.startupSplashFallbackRef = null;
  }

  private finishStartupWarmup(runId: number, completed: boolean): void {
    if (runId !== this.startupWarmupRunId) return;
    this.cancelStartupSplashFallback();
    this.startupWarmupDone = completed;
    this.showSplash = false;
    this.startupWarmupPromise = null;

    if (!completed) return;

    setTimeout(() => {
      this.renderDonutChart();
      this.renderTimelineChart();
    }, 150);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private overviewCacheKey(period: OverviewPeriod): string {
    return `overview|${this.employee?.companyCode || ''}|${this.employee?.mobile || ''}|${period}`;
  }

  private followupsCacheKey(page = 1): string {
    return [
      'followups',
      this.employee?.companyCode || '',
      this.employee?.mobile || '',
      this.followupFilter,
      this.leadSearch.trim(),
      this.followupReminderDateFilter(),
      page,
    ].join('|');
  }

  private overviewFollowupsCacheKey(): string {
    return [
      'overview-followups-v2',
      this.employee?.companyCode || '',
      this.employee?.mobile || '',
    ].join('|');
  }

  private todayHistoryCacheKey(page = 1): string {
    return [
      'today-history',
      this.employee?.companyCode || '',
      this.employee?.mobile || '',
      this.historyFilterDate || this.todayInputDate,
      this.leadSearch.trim(),
      page,
    ].join('|');
  }

  private invoiceHistoryCacheKey(page = 1): string {
    return [
      'invoice',
      this.employee?.companyCode || '',
      this.employee?.mobile || '',
      this.invoiceHistorySearch.trim(),
      this.invoiceDateFrom,
      this.invoiceDateTo,
      page,
    ].join('|');
  }

  private quotationHistoryCacheKey(page = 1): string {
    return [
      'quotation',
      this.employee?.companyCode || '',
      this.employee?.mobile || '',
      this.quotationHistorySearch.trim(),
      this.quotationDateFrom,
      this.quotationDateTo,
      page,
    ].join('|');
  }

  private invoiceLeadCompaniesCacheKey(page = 1): string {
    return [
      'invoice-client-companies',
      this.employee?.companyCode || '',
      this.employee?.mobile || '',
      this.invoiceSearch.trim(),
      page,
    ].join('|');
  }

  private quotationLeadCompaniesCacheKey(page = 1): string {
    return [
      'quotation-lead-companies',
      this.employee?.companyCode || '',
      this.employee?.mobile || '',
      this.quotationSearch.trim(),
      page,
    ].join('|');
  }

  private followupReminderDateFilter(): string {
    if (this.followupFilter === 'today') return this.todayInputDate;
    if (this.followupFilter === 'custom') return this.selectedFollowupDate || '';
    return '';
  }

  private invalidateOverviewCaches(): void {
    this.dashboardCache.invalidate('overview|');
  }

  private invalidateFollowupCaches(): void {
    this.dashboardCache.invalidate('followups|');
    this.dashboardCache.invalidate('overview-followups|');
    this.overviewFollowupsLoaded = false;
    if (this.dashTab === 'overview') {
      this.fetchOverviewFollowups(true);
    }
  }

  private invalidateTodayHistoryCaches(): void {
    this.dashboardCache.invalidate('today-history|');
  }

  private invalidateInvoiceCaches(): void {
    this.dashboardCache.invalidate('invoice|');
    this.dashboardCache.invalidate('invoice-client-companies|');
  }

  private invalidateQuotationCaches(): void {
    this.dashboardCache.invalidate('quotation|');
    this.dashboardCache.invalidate('quotation-lead-companies|');
  }

  private resolvePagedResponse<T>(response: any, rawItems: T[], requestedPage: number, pageSize = OPERATIONAL_PAGE_SIZE): PagedResponse<T> {
    const hasServerPageMeta = typeof response?.page === 'number'
      || typeof response?.pageSize === 'number'
      || typeof response?.total === 'number'
      || typeof response?.hasMore === 'boolean';

    if (hasServerPageMeta) {
      const page = Number(response?.page || requestedPage || 1);
      const resolvedPageSize = Number(response?.pageSize || pageSize || OPERATIONAL_PAGE_SIZE);
      const total = Number(response?.total || rawItems.length || 0);
      return {
        items: rawItems,
        page,
        pageSize: resolvedPageSize,
        total,
        hasMore: typeof response?.hasMore === 'boolean'
          ? response.hasMore
          : (page * resolvedPageSize < total),
      };
    }

    const total = rawItems.length;
    const start = Math.max(0, (requestedPage - 1) * pageSize);
    const items = rawItems.slice(start, start + pageSize);
    return {
      items,
      page: requestedPage,
      pageSize,
      total,
      hasMore: start + pageSize < total,
    };
  }

  private mergePagedItems<T>(existing: T[], incoming: T[], pickId: (item: T) => string): T[] {
    const byId = new Map(existing.map((item) => [pickId(item), item]));
    for (const item of incoming) {
      byId.set(pickId(item), item);
    }
    return Array.from(byId.values());
  }

  private applyOverviewPeriodData(period: OverviewPeriod, payload: CachedOverviewPeriodData): void {
    this.overviewPeriodCache[period] = {
      stats: payload.stats,
      timeline: payload.timeline,
      loaded: true,
    };
    if (this.selectedPeriod !== period) return;
    this.callStats = payload.stats;
    this.timelineData = payload.timeline;
    if (this.dashTab === 'overview') {
      setTimeout(() => {
        this.renderDonutChart();
        this.renderTimelineChart();
      }, 50);
    }
  }

  private restoreCachedFollowups(): boolean {
    const cached = this.dashboardCache.get<PagedResponse<Bookmark>>(this.followupsCacheKey(1));
    if (!cached) return false;
    this.followups = cached.items;
    this.followupsPage = cached.page;
    this.followupsHasMore = cached.hasMore;
    this.followupsTotal = cached.total;
    this.followupsLoaded = true;
    this.followupsLoading = false;
    this.touchFollowups();
    return true;
  }

  private restoreCachedOverviewFollowups(): boolean {
    const cached = this.dashboardCache.get<PagedResponse<Bookmark>>(this.overviewFollowupsCacheKey());
    if (!cached) return false;
    this.overviewFollowups = cached.items;
    this.overviewFollowupsLoaded = true;
    this.overviewFollowupsLoading = false;
    return true;
  }

  private async warmBackgroundDashboardData(runId: number): Promise<void> {
    if (runId !== this.startupWarmupRunId) return;
    try {
      await Promise.all([
        this.warmOverviewPeriods(),
        this.warmLeadScopes(),
        this.warmExecutionAndDocuments(),
      ]);
    } catch {
      // Background warmup is opportunistic.
    }
  }

  private async warmOverviewPeriods(): Promise<void> {
    if (!this.employee) return;
    await Promise.all((['today', 'yesterday', 'lastweek'] as OverviewPeriod[]).map((period) => (
      this.loadOverviewPeriod(period, { silent: true })
    )));
  }

  private async loadOverviewPeriod(
    period: OverviewPeriod,
    options: { preferCache?: boolean; silent?: boolean } = {},
  ): Promise<void> {
    if (!this.employee) return;
    const restored = this.applyCachedOverviewPeriod(period);
    if (restored && options.preferCache) return;
    if (this.selectedPeriod === period && !options.silent) {
      this.statsLoading = true;
    }
    const { companyCode, mobile } = this.employee;
    try {
      const [statsRes, timelineRes] = await Promise.all([
        firstValueFrom(this.api.get<any>(`/api/calllogs/employee?companyCode=${companyCode}&phone=${mobile}&period=${period}`)),
        firstValueFrom(this.api.get<any>(`/api/calllogs/timeline?companyCode=${companyCode}&phone=${mobile}&period=${period}`)),
      ]);
      const payload: CachedOverviewPeriodData = {
        stats: statsRes?.success ? statsRes.stats : null,
        timeline: timelineRes?.success ? (timelineRes.timeline || []) : [],
      };
      this.overviewPeriodCache[period] = {
        ...payload,
        loaded: true,
      };
      this.dashboardCache.set(this.overviewCacheKey(period), payload, {
        ttlMs: this.dashboardCacheTtlMs,
      });
      if (this.selectedPeriod === period) {
        this.applyOverviewPeriodData(period, payload);
      }
    } catch {
      if (!restored) {
        this.overviewPeriodCache[period] = { stats: null, timeline: [], loaded: false };
      }
    } finally {
      if (this.selectedPeriod === period) {
        this.statsLoading = false;
      }
    }
  }

  private async warmLeadScopes(): Promise<void> {
    if (!this.employee) return;
    await this.warmDefaultLeadScopes();
  }

  private async warmDefaultLeadScopes(): Promise<void> {
    if (!this.employee) return;
    const baseScopes = this.uniqueLeadScopes(this.leadWarmupScopesForSet('', { includeToday: true }));
    await this.employeeLeadsVm.prefetchScopes(this.employee.companyCode, this.employee.mobile, baseScopes);
  }

  private leadWarmupScopesForSet(
    setLabel: string,
    options: { includeToday?: boolean } = {},
  ): EmployeeLeadScope[] {
    const build = (scope: Record<string, string>) => ({
      search: '',
      setLabel,
      division: '',
      status: scope['status'] || '',
      statuses: scope['statuses'] || '',
      isFavourite: scope['isFavourite'] === 'true',
      updatedFrom: scope['updatedFrom'] || '',
      updatedTo: scope['updatedTo'] || '',
    });

    const scopes = [
      build({}),
      build(this.INTERESTED_PAGE_STATUSES.length ? { statuses: this.INTERESTED_PAGE_STATUSES.join(',') } : {}),
      build(this.DNP_PAGE_STATUSES.length ? { statuses: this.DNP_PAGE_STATUSES.join(',') } : {}),
      build(this.CONVERTED_PAGE_STATUSES.length ? { statuses: this.CONVERTED_PAGE_STATUSES.join(',') } : {}),
      build({ isFavourite: 'true' }),
    ];

    if (options.includeToday) {
      scopes.push(build(this.todayLeadDateRangeParams()));
    }

    return scopes;
  }

  private uniqueLeadScopes(scopes: EmployeeLeadScope[]): EmployeeLeadScope[] {
    const seen = new Set<string>();
    return scopes.filter((scope) => {
      const key = JSON.stringify({
        search: scope.search || '',
        status: scope.status || '',
        statuses: scope.statuses || '',
        isFavourite: !!scope.isFavourite,
        updatedFrom: scope.updatedFrom || '',
        updatedTo: scope.updatedTo || '',
        setLabel: scope.setLabel || '',
        division: scope.division || '',
      });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async warmExecutionAndDocuments(): Promise<void> {
    await Promise.all([
      this.loadFollowupsOnce(true),
      this.loadOverviewFollowupsOnce(true),
      this.loadTodayCallsOnce(true),
      this.loadInvoiceRecordsOnce(true),
      this.loadInvoiceEligibleLeadsOnce(),
      this.loadQuotationLeadCompaniesOnce(),
      this.loadQuotationRecordsOnce(true),
    ]);
  }

  private async loadFollowupsOnce(force = false): Promise<void> {
    if (!this.employee) return;
    const restored = force ? false : this.restoreCachedFollowups();
    await this.loadFollowupsPage(1, { reset: true, silent: restored, forceRefresh: true });
  }

  private async loadOverviewFollowupsOnce(force = false): Promise<void> {
    if (!this.employee || (this.overviewFollowupsLoaded && !force)) return;
    const restored = !force && this.restoreCachedOverviewFollowups();
    if (restored) return;

    this.overviewFollowupsLoading = true;
    const pageSize = 20;
    const params = new URLSearchParams({
      companyCode: this.employee.companyCode,
      phone: this.employee.mobile,
      page: '1',
      pageSize: String(pageSize),
      paginated: 'true',
    });

    try {
      const res = await firstValueFrom(this.api.get<any>(`/api/bookmarks?${params.toString()}`));
      const rawItems = Array.isArray(res?.items) ? res.items : (res?.bookmarks || []);
      const pageResult = this.resolvePagedResponse<Bookmark>(res, rawItems, 1, pageSize);
      this.overviewFollowups = pageResult.items;
      this.overviewFollowupsLoaded = true;
      this.dashboardCache.set(this.overviewFollowupsCacheKey(), pageResult, {
        ttlMs: this.dashboardCacheTtlMs,
      });
    } catch {
      this.overviewFollowupsLoaded = false;
    } finally {
      this.overviewFollowupsLoading = false;
    }
  }

  private async loadTodayCallsOnce(force = false): Promise<void> {
    if (!this.employee) return;
    const restored = force ? false : this.restoreCachedTodayCalls();
    await this.loadTodayCallsPage(1, { reset: true, silent: restored, forceRefresh: true });
  }

  private async loadInvoiceRecordsOnce(force = false): Promise<void> {
    if (!this.employee) return;
    const restored = force ? false : this.restoreCachedInvoiceRecords();
    await this.loadInvoiceRecordsPage(1, { reset: true, silent: restored, forceRefresh: true });
  }

  private async loadInvoiceEligibleLeadsOnce(force = false): Promise<void> {
    if (!this.employee || (this.invoiceEligibleLeadsLoaded && !force)) return;
    const restored = !force && this.restoreCachedInvoiceLeadCompaniesPage(1);
    await this.loadInvoiceLeadCompaniesPage(1, {
      reset: true,
      silent: restored,
      forceRefresh: true,
    });
  }

  private async loadQuotationLeadCompaniesOnce(force = false): Promise<void> {
    if (!this.employee || (this.quotationLeadCompaniesLoaded && !force)) return;
    const restored = !force && this.restoreCachedQuotationLeadCompaniesPage(1);
    await this.loadQuotationLeadCompaniesPage(1, {
      reset: true,
      silent: restored,
      forceRefresh: true,
    });
  }

  private async loadQuotationRecordsOnce(force = false): Promise<void> {
    if (!this.employee) return;
    const restored = force ? false : this.restoreCachedQuotationRecords();
    await this.loadQuotationRecordsPage(1, { reset: true, silent: restored, forceRefresh: true });
  }

  private restoreCachedTodayCalls(): boolean {
    const cached = this.dashboardCache.get<PagedResponse<any>>(this.todayHistoryCacheKey(1));
    if (!cached) return false;
    this.todayCalls = cached.items;
    this.todayCallsPage = cached.page;
    this.todayCallsHasMore = cached.hasMore;
    this.todayCallsTotal = cached.total;
    this.todayCallsLoaded = true;
    this.todayCallsLoading = false;
    return true;
  }

  private restoreCachedInvoiceRecords(): boolean {
    const cached = this.dashboardCache.get<PagedResponse<InvoiceRecord>>(this.invoiceHistoryCacheKey(1));
    if (!cached) return false;
    this.invoiceRecords = cached.items;
    this.invoiceRecordsPage = cached.page;
    this.invoiceRecordsHasMore = cached.hasMore;
    this.invoiceRecordsTotal = cached.total;
    this.invoiceRecordsLoaded = true;
    this.invoiceRecordsLoading = false;
    return true;
  }

  private restoreCachedQuotationRecords(): boolean {
    const cached = this.dashboardCache.get<PagedResponse<QuotationRecord>>(this.quotationHistoryCacheKey(1));
    if (!cached) return false;
    this.quotationRecords = cached.items;
    this.quotationRecordsPage = cached.page;
    this.quotationRecordsHasMore = cached.hasMore;
    this.quotationRecordsTotal = cached.total;
    this.quotationRecordsLoaded = true;
    this.quotationRecordsLoading = false;
    return true;
  }

  private restoreCachedInvoiceLeadCompaniesPage(page = 1, append = false): boolean {
    const cached = this.dashboardCache.get<CachedLeadCompanyPage>(this.invoiceLeadCompaniesCacheKey(page));
    if (!cached) return false;
    this.invoiceLeadCompanies = append
      ? this.mergeWorkspaceLeadCompanies(this.invoiceLeadCompanies, cached.companies)
      : cached.companies;
    this.invoiceLeadCompanyContacts = append
      ? this.mergeWorkspaceLeadCompanyContacts(this.invoiceLeadCompanyContacts, cached.contactsByCompany)
      : cached.contactsByCompany;
    this.invoiceLeadCompanyPage = cached.page;
    this.invoiceLeadCompanyHasMore = cached.hasMore;
    this.invoiceLeadCompanyTotal = cached.total;
    this.invoiceEligibleLeadsLoaded = true;
    this.invoiceEligibleLeadsLoading = false;
    this.invoiceLeadCompaniesLoadingMore = false;
    return true;
  }

  private restoreCachedQuotationLeadCompaniesPage(page = 1, append = false): boolean {
    const cached = this.dashboardCache.get<CachedLeadCompanyPage>(this.quotationLeadCompaniesCacheKey(page));
    if (!cached) return false;
    this.quotationLeadCompanies = append
      ? this.mergeWorkspaceLeadCompanies(this.quotationLeadCompanies, cached.companies)
      : cached.companies;
    this.quotationLeadCompanyContacts = append
      ? this.mergeWorkspaceLeadCompanyContacts(this.quotationLeadCompanyContacts, cached.contactsByCompany)
      : cached.contactsByCompany;
    this.quotationLeadCompanyPage = cached.page;
    this.quotationLeadCompanyHasMore = cached.hasMore;
    this.quotationLeadCompanyTotal = cached.total;
    this.quotationLeadCompaniesLoaded = true;
    this.quotationLeadsLoading = false;
    this.quotationLeadCompaniesLoadingMore = false;
    return true;
  }

  private async loadFollowupsPage(
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!this.employee) return;
    if (options.reset && !options.silent) {
      this.followups = [];
      this.followupsPage = 1;
      this.followupsHasMore = false;
      this.followupsTotal = 0;
      this.touchFollowups();
    }
    if (options.append) {
      this.followupsLoadingMore = true;
    } else if (!options.silent) {
      this.followupsLoading = true;
    }

    const params = new URLSearchParams({
      companyCode: this.employee.companyCode,
      phone: this.employee.mobile,
      page: String(page),
      pageSize: String(OPERATIONAL_PAGE_SIZE),
      paginated: 'true',
    });
    if (this.leadSearch.trim()) params.set('search', this.leadSearch.trim());
    if (this.followupFilter !== 'all') params.set('filter', this.followupFilter);
    if (this.followupReminderDateFilter()) params.set('reminderDate', this.followupReminderDateFilter());

    try {
      const res = await firstValueFrom(this.api.get<any>(`/api/bookmarks?${params.toString()}`));
      const rawItems = Array.isArray(res?.items) ? res.items : (res?.bookmarks || []);
      const pageResult = this.resolvePagedResponse<Bookmark>(res, rawItems, page);
      const items = options.append
        ? this.mergePagedItems(this.followups, pageResult.items, (bookmark) => bookmark._id || `${bookmark.companyName}:${bookmark.contactNumber}`)
        : pageResult.items;
      this.followups = items;
      this.followupsPage = pageResult.page;
      this.followupsHasMore = pageResult.hasMore;
      this.followupsTotal = pageResult.total;
      this.followupsLoaded = true;
      this.followupsLoading = false;
      this.followupsLoadingMore = false;
      this.dashboardCache.set(this.followupsCacheKey(page), pageResult, {
        ttlMs: this.dashboardCacheTtlMs,
      });
      this.touchFollowups();
    } catch {
      this.followupsLoading = false;
      this.followupsLoadingMore = false;
    } finally {
      this.finishGlobalSearchIfSettled();
    }
  }

  private async loadTodayCallsPage(
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!this.employee) return;
    if (options.reset && !options.silent) {
      this.todayCalls = [];
      this.todayCallsPage = 1;
      this.todayCallsHasMore = false;
      this.todayCallsTotal = 0;
    }
    if (options.append) {
      this.todayCallsLoadingMore = true;
    } else if (!options.silent) {
      this.todayCallsLoading = true;
    }

    const params = new URLSearchParams({
      companyCode: this.employee.companyCode,
      phone: this.employee.mobile,
      from: this.historyFilterDate || this.todayInputDate,
      to: this.historyFilterDate || this.todayInputDate,
      page: String(page),
      pageSize: String(OPERATIONAL_PAGE_SIZE),
      paginated: 'true',
    });
    if (this.leadSearch.trim()) params.set('search', this.leadSearch.trim());

    try {
      const res = await firstValueFrom(this.api.get<any>(`/api/calllogs/details?${params.toString()}`));
      const rawItems = Array.isArray(res?.items) ? res.items : (res?.calls || []);
      const pageResult = this.resolvePagedResponse<any>(res, rawItems, page);
      this.todayCalls = options.append
        ? this.mergePagedItems(this.todayCalls, pageResult.items, (call) => `${call.timestamp || ''}:${call.number || ''}:${call.callType || ''}`)
        : pageResult.items;
      this.todayCallsPage = pageResult.page;
      this.todayCallsHasMore = pageResult.hasMore;
      this.todayCallsTotal = pageResult.total;
      this.todayCallsLoaded = true;
      this.todayCallsLoading = false;
      this.todayCallsLoadingMore = false;
      this.dashboardCache.set(this.todayHistoryCacheKey(page), pageResult, {
        ttlMs: this.dashboardCacheTtlMs,
      });
    } catch {
      this.todayCallsLoading = false;
      this.todayCallsLoadingMore = false;
    } finally {
      this.finishGlobalSearchIfSettled();
    }
  }

  private async loadInvoiceRecordsPage(
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!this.employee) return;
    if (options.reset && !options.silent) {
      this.invoiceRecords = [];
      this.invoiceRecordsPage = 1;
      this.invoiceRecordsHasMore = false;
      this.invoiceRecordsTotal = 0;
    }
    if (options.append) {
      this.invoiceRecordsLoadingMore = true;
    } else if (!options.silent) {
      this.invoiceRecordsLoading = true;
    }

    try {
      const pageResult = await firstValueFrom(this.invoicesRepository.history({
        companyCode: this.employee.companyCode,
        employeePhone: this.employee.mobile,
        search: this.invoiceHistorySearch.trim(),
        dateFrom: this.invoiceDateFrom || undefined,
        dateTo: this.invoiceDateTo || undefined,
        page,
        pageSize: OPERATIONAL_PAGE_SIZE,
      }));
      const mappedPage: PagedResponse<InvoiceRecord> = {
        items: pageResult.items.map((item) => this.toWorkspaceInvoiceRecord(item as any)),
        page: pageResult.page,
        pageSize: pageResult.pageSize,
        total: pageResult.total,
        hasMore: pageResult.hasMore,
      };
      this.invoiceRecords = options.append
        ? this.mergePagedItems(this.invoiceRecords, mappedPage.items, (item) => item._id)
        : mappedPage.items;
      this.invoiceRecordsPage = mappedPage.page;
      this.invoiceRecordsHasMore = mappedPage.hasMore;
      this.invoiceRecordsTotal = mappedPage.total;
      this.invoiceRecordsLoaded = true;
      this.invoiceRecordsLoading = false;
      this.invoiceRecordsLoadingMore = false;
      this.dashboardCache.set(this.invoiceHistoryCacheKey(page), mappedPage, {
        ttlMs: this.dashboardCacheTtlMs,
      });
    } catch {
      this.invoiceRecordsLoading = false;
      this.invoiceRecordsLoadingMore = false;
    } finally {
      this.finishGlobalSearchIfSettled();
    }
  }

  private async loadQuotationRecordsPage(
    page: number,
    options: { reset?: boolean; silent?: boolean; forceRefresh?: boolean; append?: boolean } = {},
  ): Promise<void> {
    if (!this.employee) return;
    if (options.reset && !options.silent) {
      this.quotationRecords = [];
      this.quotationRecordsPage = 1;
      this.quotationRecordsHasMore = false;
      this.quotationRecordsTotal = 0;
    }
    if (options.append) {
      this.quotationRecordsLoadingMore = true;
    } else if (!options.silent) {
      this.quotationRecordsLoading = true;
    }

    try {
      const pageResult = await firstValueFrom(this.quotationsRepository.history({
        companyCode: this.employee.companyCode,
        employeePhone: this.employee.mobile,
        search: this.quotationHistorySearch.trim(),
        dateFrom: this.quotationDateFrom || undefined,
        dateTo: this.quotationDateTo || undefined,
        page,
        pageSize: OPERATIONAL_PAGE_SIZE,
      }));
      const mappedPage: PagedResponse<QuotationRecord> = {
        items: pageResult.items.map((item) => this.toWorkspaceQuotationRecord(item as any)),
        page: pageResult.page,
        pageSize: pageResult.pageSize,
        total: pageResult.total,
        hasMore: pageResult.hasMore,
      };
      this.quotationRecords = options.append
        ? this.mergePagedItems(this.quotationRecords, mappedPage.items, (item) => item._id)
        : mappedPage.items;
      this.quotationRecordsPage = mappedPage.page;
      this.quotationRecordsHasMore = mappedPage.hasMore;
      this.quotationRecordsTotal = mappedPage.total;
      this.quotationRecordsLoaded = true;
      this.quotationRecordsLoading = false;
      this.quotationRecordsLoadingMore = false;
      this.dashboardCache.set(this.quotationHistoryCacheKey(page), mappedPage, {
        ttlMs: this.dashboardCacheTtlMs,
      });
    } catch {
      this.quotationRecordsLoading = false;
      this.quotationRecordsLoadingMore = false;
    } finally {
      this.finishGlobalSearchIfSettled();
    }
  }

  switchTab(tab: EmployeePageId): void {
    this.sidebarOpen = false;

    // Save current selection to the map before switching
    if (this.dashTab) {
      this.tabSelections[this.dashTab] = this.selectedLeadCompany;
    }

    this.dashTab = tab;

    // Restore the selection for the target tab
    this.selectedLeadCompany = this.tabSelections[tab] || '';
    this.selectedLeadId = '';
    this.selectedFollowupId = '';
    this.drawerSection = 'details';
    this.showHistoryModal = false;
    this.showFollowupModal = false;
    this.syncAiForActiveView();

    if (this.isLeadWorkspaceTab(tab) && this.employee) {
      this.fetchLeads();
    }

    if (tab === 'today-calls') {
      this.fetchTodayCalls();
    }
    if (tab === 'followups') {
      this.fetchFollowups();
    }
    if (tab === 'invoices') {
      this.invoiceLeadRenderCount = OPERATIONAL_PAGE_SIZE;
      this.fetchInvoiceRecords();
      this.fetchInvoiceEligibleLeads();
    }
    if (tab === 'client-onboarding') {
      this.fetchClientOnboardingRecords();
    }
    if (tab === 'quotations') {
      this.quotationLeadRenderCount = OPERATIONAL_PAGE_SIZE;
      void this.loadQuotationLeadCompaniesOnce();
      this.fetchQuotationRecords();
    }
    if (tab === 'overview') {
      this.fetchStats();
      this.fetchOverviewFollowups();
      setTimeout(() => {
        this.renderDonutChart();
        this.renderTimelineChart();
      }, 150);
    } else {
      setTimeout(() => {
        const activeItem = document.querySelector('.lead-item.active');
        if (activeItem) {
          activeItem.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }, 100);
    }
  }

  // ── Company Settings (lead statuses, break limit) ──
  fetchCompanySettings(): void {
    if (!this.employee) return;
    this.loadCompanySettings();
  }

  private async loadCompanySettings(): Promise<void> {
    if (!this.employee) return;
    try {
      const res = await firstValueFrom(this.api.get<any>(`/api/auth/company/${this.employee.companyCode}/settings`));
      if (res.success && res.settings) {
        this.applyCompanySettings(res.settings);
        await this.loadCompanyInvoiceProfile();
      }
    } catch {}
  }

  private applyCompanySettings(settings: any): void {
    if (settings.leadStatuses?.length) {
      this.LEAD_STATUSES = settings.leadStatuses;
    }
    if (settings.interestedPageStatuses?.length) {
      this.INTERESTED_PAGE_STATUSES = settings.interestedPageStatuses;
    }
    if (settings.dnpPageStatuses?.length) {
      this.DNP_PAGE_STATUSES = settings.dnpPageStatuses;
    }
    if (settings.convertedPageStatuses?.length) {
      this.CONVERTED_PAGE_STATUSES = settings.convertedPageStatuses;
    }
    this.breakHourLimitMin = settings.breakHourLimit ?? 60;
    this.companyName = settings.companyName || this.companyName || '';
    this.invoiceLogo = settings.invoiceLogo || '';
    this.showCompanyNameOnInvoice = settings.showCompanyNameOnInvoice ?? true;
    this.gstNumber = settings.gstNumber || '';
    this.gstPercentage = settings.gstPercentage ?? 18;
    this.invoiceRegisteredAddress = settings.invoiceRegisteredAddress || '';
    this.invoiceFooter = settings.invoiceFooter || '';
    this.invoiceSeal = settings.invoiceSeal || '';
    this.invoiceTerms = settings.invoiceTerms || '';
    this.bankDetails = settings.bankDetails;
    this.contactDetails = settings.contactDetails;
    this.products = settings.products || [];
    this.productRemarks = settings.productRemarks || [];
  }

  fetchCompanyInvoiceProfile(): void {
    if (!this.employee?.companyCode) return;
    this.loadCompanyInvoiceProfile();
  }

  get visibleProducts(): any[] {
    const employeeTags = new Set((this.employee?.tags || []).map((tag) => String(tag).trim()).filter(Boolean));
    return (this.products || [])
      .filter((product) => {
        const productTags = Array.isArray(product?.tags)
          ? product.tags.map((tag: any) => String(tag).trim()).filter(Boolean)
          : [];
        if (productTags.length === 0) return true;
        return productTags.some((tag: string) => employeeTags.has(tag));
      })
      .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''), undefined, { sensitivity: 'base' }));
  }

  private async loadCompanyInvoiceProfile(): Promise<void> {
    if (!this.employee?.companyCode) return;
    try {
      const res = await firstValueFrom(this.api.get<any>(`/api/auth/company/${this.employee.companyCode}`));
      if (res.success && res.company) {
        this.companyAddress = res.company.companyAddress || '';
        if (!this.companyName) this.companyName = res.company.companyName || '';
      }
    } catch {}
  }

  // ── Break Button Logic ──
  fetchBreakStatus(): void {
    if (!this.employee) return;
    this.api.get<any>(`/api/breaklog/employee-today?companyCode=${this.employee.companyCode}&employeePhone=${this.employee.mobile}`).subscribe({
      next: res => {
        if (res.success) {
          this.breakTotalSecondsToday = res.totalSeconds ?? 0;
          this.breakHourLimitMin = Math.floor((res.limitSeconds ?? 3600) / 60);
        }
      },
      error: () => {}
    });
  }

  markBreak(): void {
    if (this.breakActive) {
      // Stop timer — compute how many seconds elapsed
      clearInterval(this.breakTimerRef);
      const elapsedMs = Date.now() - this.breakStartedAt;
      const elapsedSec = Math.max(1, Math.floor(elapsedMs / 1000));
      this.breakActive = false;
      this.breakTimerDisplay = '00:00';
      this.breakPosting = true;
      localStorage.removeItem('dv_break_state');

      // Post to backend
      this.api.post<any>('/api/breaklog/mark', {
        companyCode: this.employee!.companyCode,
        employeePhone: this.employee!.mobile,
        employeeName: this.employee!.name,
        durationSeconds: elapsedSec,
      }).subscribe({
        next: res => {
          this.breakPosting = false;
          if (res.success) {
            this.breakTotalSecondsToday = res.totalSeconds;
          }
        },
        error: () => { this.breakPosting = false; }
      });
    } else {
      // Start timer
      this.breakActive = true;
      this.breakStartedAt = Date.now();
      localStorage.setItem('dv_break_state', JSON.stringify({ startedAt: this.breakStartedAt }));
      this.startBreakTimerLoop();
    }
  }

  resumeBreakTimer(): void {
    const rawBreak = localStorage.getItem('dv_break_state');
    if (rawBreak) {
      try {
        const data = JSON.parse(rawBreak);
        if (data.startedAt) {
          this.breakActive = true;
          this.breakStartedAt = data.startedAt;
          this.startBreakTimerLoop();
        }
      } catch { localStorage.removeItem('dv_break_state'); }
    }
  }

  startBreakTimerLoop(): void {
    // Initial display update
    const sec = Math.floor((Date.now() - this.breakStartedAt) / 1000);
    this.breakTimerDisplay = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    
    this.breakTimerRef = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - this.breakStartedAt) / 1000);
      const m = Math.floor(elapsedSec / 60);
      const s = elapsedSec % 60;
      this.breakTimerDisplay = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
  }

  fmtSecs(totalSecs: number): string {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  onPeriodChange(p: OverviewPeriod): void {
    this.selectedPeriod = p;
    const restored = this.applyCachedOverviewPeriod(p);
    void this.loadOverviewPeriod(p, { preferCache: false, silent: restored });
  }

  // ── Call Stats ────────────────────────────────────────────────
  fetchStats(): void {
    const restored = this.applyCachedOverviewPeriod(this.selectedPeriod);
    void this.loadOverviewPeriod(this.selectedPeriod, {
      preferCache: restored,
      silent: restored,
    });
  }

  fetchTimeline(): void {
    const restored = this.applyCachedOverviewPeriod(this.selectedPeriod);
    void this.loadOverviewPeriod(this.selectedPeriod, {
      preferCache: restored,
      silent: restored,
    });
  }

  private applyCachedOverviewPeriod(period: OverviewPeriod): boolean {
    let cached = this.overviewPeriodCache[period];
    if (!cached.loaded) {
      const persisted = this.dashboardCache.get<CachedOverviewPeriodData>(this.overviewCacheKey(period));
      if (persisted) {
        this.applyOverviewPeriodData(period, persisted);
        cached = this.overviewPeriodCache[period];
      }
    }
    if (!cached.loaded) return false;
    this.statsLoading = false;
    this.applyOverviewPeriodData(period, {
      stats: cached.stats,
      timeline: cached.timeline,
    });
    return true;
  }

  setChartType(type: 'line' | 'bar'): void {
    this.chartType = type;
    setTimeout(() => this.renderTimelineChart(), 50);
  }

  renderTimelineChart(): void {
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    const canvas = document.getElementById('timelineChart') as HTMLCanvasElement;
    if (!canvas) return;

    const textColor = '#6B7280';
    const gridColor = 'rgba(229, 231, 235, 0.9)';
    const ctx = canvas.getContext('2d');
    const tickFont = {
      family: 'Inter, system-ui, sans-serif',
      size: 12,
      weight: '400' as const,
    };

    let chartType: any = this.chartType;
    let data: any;
    let options: any;

    if (this.chartType === 'line') {
      // Timeline Trend
      if (!this.timelineData.length) return;
      
      const nonZeroRows = this.timelineData.filter(d =>
        ((d.incoming || 0) + (d.outgoing || 0) + (d.missed || 0) + (d.rejected || 0)) > 0
      );

      const chartRows = nonZeroRows.length ? nonZeroRows : this.timelineData;
      const isHourly = chartRows.length > 0 && chartRows[0]._isHourly;
      const labels = chartRows.map(d => {
        let dt: Date;
        if (d.date.includes('T')) {
          // It's hourly data from backend, which is in UTC.
          // Appending 'Z' ensures the browser converts it to the user's local time correctly.
          dt = new Date(d.date + 'Z');
        } else {
          // It's daily data: 2026-04-28. Use local parsing.
          dt = new Date(d.date.replace(/-/g, '/'));
        }

        if (isHourly) {
          const h = dt.getHours();
          const ampm = h >= 12 ? 'PM' : 'AM';
          const displayH = h % 12 || 12;
          return `${String(displayH).padStart(2, '0')} ${ampm}`;
        }
        return dt.toLocaleDateString('en-US', { weekday: 'short' });
      });
      const totalCalls = chartRows.map(d =>
        (d.incoming || 0) + (d.outgoing || 0) + (d.missed || 0) + (d.rejected || 0)
      );
      const hasCallVolume = totalCalls.some(value => value > 0);

      const grad = ctx ? ctx.createLinearGradient(0, 0, 0, canvas.height || 320) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      }

      data = {
        labels: labels,
        datasets: [{
          label: 'Total Calls',
          data: totalCalls,
          borderColor: '#3B82F6',
          backgroundColor: grad ?? 'rgba(59, 130, 246, 0.16)',
          fill: true,
          cubicInterpolationMode: 'monotone',
          tension: 0.42,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 18,
          pointBackgroundColor: '#3B82F6',
          pointBorderWidth: 0
        }]
      };
      options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#151B23', padding: 12, cornerRadius: 0 }
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false, drawTicks: false },
            border: { display: false },
            ticks: { color: textColor, font: tickFont, padding: 10 }
          },
          y: {
            beginAtZero: true,
            suggestedMax: hasCallVolume ? undefined : 1,
            grid: { color: gridColor, borderDash: [4, 4], drawBorder: false, drawTicks: false },
            border: { display: false },
            ticks: { color: textColor, font: tickFont, precision: 0, padding: 12 }
          }
        }
      };

    } else {
      // Category Breakdown (Bar)
      if (!this.callStats) return;
      const counts = [
        this.callStats.incoming || 0,
        this.callStats.outgoing || 0,
        this.callStats.missed || 0,
        this.callStats.rejected || 0
      ];
      const labels = ['Incoming', 'Outgoing', 'Missed', 'Rejected'];
      const colors = ['#3B82F6', '#F28C28', '#F4C247', '#D97706'];

      data = {
        labels: labels,
        datasets: [{
          label: 'Call Count',
          data: counts,
          backgroundColor: colors,
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 0,
          barPercentage: 0.6
        }]
      };

      options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#151B23', padding: 12, cornerRadius: 0 }
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false, drawTicks: false },
            border: { display: false },
            ticks: { color: textColor, font: tickFont, padding: 10 }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor, borderDash: [4, 4], drawBorder: false, drawTicks: false },
            border: { display: false },
            ticks: { color: textColor, font: tickFont, stepSize: 1, padding: 12 }
          }
        }
      };
    }

    this.timelineChart = new Chart(canvas, { type: chartType, data, options });
  }

  renderDonutChart(): void {
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }
    const canvas = document.getElementById('empDonutChart') as HTMLCanvasElement;
    if (!canvas || !this.callStats || !this.hasOverviewActivity) return;

    const s = this.callStats;
    this.donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          data: [s.incoming, s.outgoing, s.missed, s.rejected],
          backgroundColor: ['#3B82F6', '#F28C28', '#F4C247', '#D97706'],
          borderWidth: 0,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '78%',
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#151B23', cornerRadius: 0, bodyFont: { family: 'Inter, system-ui, sans-serif' } }
        }
      }
    });
  }

  // ── Leads ─────────────────────────────────────────────────────
  fetchLeads(options: boolean | { clearCache?: boolean; forceRefresh?: boolean } = false): void {
    if (!this.employee) return;
    ++this.leadFetchRun;
    const clearCache = typeof options === 'boolean' ? options : !!options.clearCache;
    const forceRefresh = typeof options === 'object' && !!options.forceRefresh;
    const scope = this.currentEmployeeLeadScope();
    if (clearCache) this.employeeLeadsVm.clearCache();
    const hasCachedScope = !forceRefresh && this.employeeLeadsVm.hasCachedScope(
      this.employee.companyCode,
      this.employee.mobile,
      scope,
    );
    if (!hasCachedScope || forceRefresh) {
      this.leadsLoading = true;
      this.resetEmployeeLeadPaginationState();
      this.allLeads = [];
      this.leads = [];
      this.touchLeads();
    }
    this.employeeLeadsVm.loadScope(
      this.employee.companyCode,
      this.employee.mobile,
      scope,
      { forceRefresh },
    );
  }

  private resetEmployeeLeadPaginationState(): void {
    this.employeeScopedLeads = [];
    this.employeeLeadCompanies = [];
    this.employeeLeadCompanyTotal = 0;
    this.employeeLeadCompanyPage = 1;
    this.employeeLeadCompanyHasMore = false;
    this.employeeLeadCompaniesLoading = false;
    this.employeeLeadContactsPage = 1;
    this.employeeLeadContactsHasMore = false;
    this.employeeLeadContactsLoadingMore = false;
  }

  private activeServerLeadScopeParams(): Record<string, string> {
    let params: Record<string, string>;
    switch (this.dashTab) {
      case 'leads':
        params = this.leadStatusFilter ? { status: this.leadStatusFilter } : {};
        break;
      case 'interested':
        params = this.selectedInterestedStatus === 'All'
          ? { statuses: this.INTERESTED_PAGE_STATUSES.join(',') }
          : { status: this.selectedInterestedStatus };
        break;
      case 'dnp':
        params = this.selectedDnpStatus === 'All'
          ? { statuses: this.DNP_PAGE_STATUSES.join(',') }
          : { status: this.selectedDnpStatus };
        break;
      case 'converted':
        params = this.selectedConvertedStatus === 'All'
          ? { statuses: this.CONVERTED_PAGE_STATUSES.join(',') }
          : { status: this.selectedConvertedStatus };
        break;
      case 'favourite':
        params = {
          isFavourite: 'true',
          ...(this.selectedFavouriteStatus === 'All' ? {} : { status: this.selectedFavouriteStatus }),
        };
        break;
      case 'today-calls':
        params = {
          ...this.todayLeadDateRangeParams(),
          ...(this.todayFilterStatus === 'All' ? {} : { status: this.todayFilterStatus }),
        };
        break;
      default:
        params = {};
    }

    const division = this.isLeadSegregationFilterTab() ? this.selectedLeadDivision.trim() : '';
    return division ? { ...params, division } : params;
  }

  private currentEmployeeLeadScope(): EmployeeLeadScope {
    return this.leadScopeFromParams(this.activeServerLeadScopeParams());
  }

  private prepareGlobalLeadSearchContext(): void {
    if (this.dashTab !== 'leads') {
      if (this.dashTab) {
        this.tabSelections[this.dashTab] = this.selectedLeadCompany;
      }
      this.dashTab = 'leads';
    }

    this.setLeadSetForTab('leads', '');
    this.leadStatusFilter = '';
    this.selectedInterestedStatus = 'All';
    this.selectedDnpStatus = 'All';
    this.selectedConvertedStatus = 'All';
    this.selectedFavouriteStatus = 'All';
    this.todayFilterStatus = 'All';
    this.selectedLeadCompany = '';
    this.selectedLeadId = '';
    this.selectedFollowupId = '';
    this.drawerSection = 'details';
    this.showHistoryModal = false;
    this.showFollowupModal = false;
    this.tabSelections['leads'] = '';
    this.workspaceStateCache = null;
  }

  private resetActiveLeadSelectionForSearch(force = false): void {
    if (!force && !this._leadSearch.trim()) return;
    this.selectedLeadCompany = '';
    this.selectedLeadId = '';
    this.selectedFollowupId = '';
    this.drawerSection = 'details';
    if (this.dashTab) {
      this.tabSelections[this.dashTab] = '';
    }
    this.workspaceStateCache = null;
  }

  private normalizeWorkspaceLeadCompanies(rawCompanies: any[]): LeadCompanyFacet[] {
    return (Array.isArray(rawCompanies) ? rawCompanies : [])
      .map((company) => ({
        name: String(company?.name || company?._id || '').trim(),
        count: Number(company?.count || 0),
      }))
      .filter((company) => !!company.name);
  }

  private normalizeWorkspaceLeadCompanyContacts(rawContactsByCompany: any): Record<string, Lead[]> {
    if (!rawContactsByCompany || typeof rawContactsByCompany !== 'object') return {};
    return Object.entries(rawContactsByCompany as Record<string, unknown>).reduce<Record<string, Lead[]>>((mapped, [company, leads]) => {
      mapped[company] = Array.isArray(leads)
        ? leads.map((lead) => this.normalizeLead(lead)).filter((lead) => !!lead._id)
        : [];
      return mapped;
    }, {});
  }

  private normalizeClientRecord(raw: any): ClientRecord {
    return {
      _id: String(raw?._id || raw?.id || ''),
      id: String(raw?.id || raw?._id || ''),
      companyCode: String(raw?.companyCode || ''),
      clientId: String(raw?.clientId || ''),
      companyName: String(raw?.companyName || raw?.leadCompanyName || ''),
      leadCompanyName: String(raw?.leadCompanyName || raw?.companyName || ''),
      primaryContact: String(raw?.primaryContact || raw?.primaryContactName || ''),
      primaryContactName: String(raw?.primaryContactName || raw?.primaryContact || ''),
      primaryPhone: String(raw?.primaryPhone || raw?.contactNumber || ''),
      primaryEmail: String(raw?.primaryEmail || raw?.directorEmailAddress || ''),
      address: String(raw?.address || ''),
      description: String(raw?.description || ''),
      status: String(raw?.status || 'Onboarded'),
      source: String(raw?.source || ''),
      sourceLeadIds: Array.isArray(raw?.sourceLeadIds) ? raw.sourceLeadIds.map((id: any) => String(id || '')).filter(Boolean) : [],
      assignedEmployeePhones: Array.isArray(raw?.assignedEmployeePhones) ? raw.assignedEmployeePhones.map((phone: any) => String(phone || '')).filter(Boolean) : [],
      onboardedAt: String(raw?.onboardedAt || ''),
      createdAt: String(raw?.createdAt || ''),
      updatedAt: String(raw?.updatedAt || ''),
    };
  }

  private clientToInvoiceFacet(client: ClientRecord): LeadCompanyFacet {
    return {
      name: client.companyName,
      count: 1,
      clientId: client.clientId,
      primaryContactName: client.primaryContactName || client.primaryContact || '',
      primaryPhone: client.primaryPhone || '',
      primaryEmail: client.primaryEmail || '',
      address: client.address || '',
      source: client.source || '',
      sourceLeadIds: client.sourceLeadIds || [],
      onboardedAt: client.onboardedAt || client.createdAt || '',
      updatedAt: client.updatedAt || '',
    };
  }

  private clientFromInvoiceFacet(facet: LeadCompanyFacet): ClientRecord {
    return {
      _id: facet.clientId || this.normalizeCompanyName(facet.name),
      id: facet.clientId || this.normalizeCompanyName(facet.name),
      companyCode: this.employee?.companyCode || '',
      clientId: facet.clientId || '',
      companyName: facet.name,
      leadCompanyName: facet.name,
      primaryContact: facet.primaryContactName || '',
      primaryContactName: facet.primaryContactName || '',
      primaryPhone: facet.primaryPhone || '',
      primaryEmail: facet.primaryEmail || '',
      address: facet.address || '',
      source: facet.source || '',
      sourceLeadIds: facet.sourceLeadIds || [],
      onboardedAt: facet.onboardedAt || '',
      updatedAt: facet.updatedAt || '',
      status: 'Onboarded',
    };
  }

  private clientToInvoiceLead(client: ClientRecord): Lead {
    return {
      _id: client.sourceLeadIds?.[0] || `client:${client.clientId}`,
      companyCode: this.employee?.companyCode || client.companyCode || '',
      assignedEmployeePhone: this.employee?.mobile || client.assignedEmployeePhones?.[0] || '',
      leadCompanyName: client.companyName,
      contactName: client.primaryContactName || client.primaryContact || 'Primary Contact',
      contactNumber: client.primaryPhone || '',
      directorEmailAddress: client.primaryEmail || '',
      address: client.address || '',
      status: 'Onboarded',
      setLabel: '',
      companyDescription: client.description || '',
    };
  }

  private mergeClientRecords(current: ClientRecord[], incoming: ClientRecord[]): ClientRecord[] {
    return this.mergePagedItems(current, incoming, (client) => client.clientId || client._id || client.companyName);
  }

  private mergeWorkspaceLeadCompanies(current: LeadCompanyFacet[], incoming: LeadCompanyFacet[]): LeadCompanyFacet[] {
    const merged = [...current];
    const existingByName = new Map(merged.map((company, index) => [this.normalizeCompanyName(company.name), index]));
    for (const company of incoming) {
      const key = this.normalizeCompanyName(company.name);
      if (!key) continue;
      const existingIndex = existingByName.get(key);
      if (existingIndex === undefined) {
        existingByName.set(key, merged.length);
        merged.push(company);
        continue;
      }
      merged[existingIndex] = company;
    }
    return merged;
  }

  private mergeWorkspaceLeadCompanyContacts(current: Record<string, Lead[]>, incoming: Record<string, Lead[]>): Record<string, Lead[]> {
    if (!Object.keys(incoming).length) return current;
    return {
      ...current,
      ...incoming,
    };
  }

  private async loadInvoiceLeadCompaniesPage(
    page: number,
    options: { append?: boolean; reset?: boolean; silent?: boolean; forceRefresh?: boolean } = {},
  ): Promise<void> {
    if (!this.employee) return;
    if (!options.forceRefresh && this.restoreCachedInvoiceLeadCompaniesPage(page, !!options.append)) {
      this.finishGlobalSearchIfSettled();
      return;
    }
    if (options.append) {
      this.invoiceLeadCompaniesLoadingMore = true;
    } else {
      this.invoiceEligibleLeadsLoading = !options.silent;
      if (options.reset && !options.silent) {
        this.invoiceLeadCompanies = [];
        this.invoiceLeadCompanyContacts = {};
        this.invoiceLeadCompanyPage = 1;
        this.invoiceLeadCompanyHasMore = false;
        this.invoiceLeadCompanyTotal = 0;
      }
    }

    const params = new URLSearchParams({
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
      search: this.invoiceSearch.trim(),
      page: String(page),
      pageSize: String(OPERATIONAL_PAGE_SIZE),
    });

    try {
      const response = await firstValueFrom(this.api.get<any>(`/api/clients?${params.toString()}`));
      const rawClients = Array.isArray(response?.clients) ? response.clients : (response?.items || []);
      const pageResult = this.resolvePagedResponse<ClientRecord>(
        response,
        rawClients.map((client: any) => this.normalizeClientRecord(client)),
        page,
      );
      const incomingCompanies = pageResult.items
        .map((client) => this.clientToInvoiceFacet(client))
        .filter((company) => !!company.name && !!company.clientId);
      this.invoiceLeadCompanies = options.append
        ? this.mergeWorkspaceLeadCompanies(this.invoiceLeadCompanies, incomingCompanies)
        : incomingCompanies;
      this.invoiceLeadCompanyContacts = {};
      this.invoiceLeadCompanyPage = pageResult.page;
      this.invoiceLeadCompanyHasMore = pageResult.hasMore;
      this.invoiceLeadCompanyTotal = pageResult.total;
      this.invoiceEligibleLeadsLoaded = true;
      this.dashboardCache.set(this.invoiceLeadCompaniesCacheKey(page), {
        companies: incomingCompanies,
        contactsByCompany: {},
        page: this.invoiceLeadCompanyPage,
        pageSize: pageResult.pageSize,
        total: this.invoiceLeadCompanyTotal,
        hasMore: this.invoiceLeadCompanyHasMore,
      }, { ttlMs: this.dashboardCacheTtlMs });
    } catch {
      if (!options.append && !options.silent) {
        this.invoiceLeadCompanies = [];
        this.invoiceLeadCompanyContacts = {};
        this.invoiceLeadCompanyPage = 1;
        this.invoiceLeadCompanyHasMore = false;
        this.invoiceLeadCompanyTotal = 0;
      }
    } finally {
      this.invoiceEligibleLeadsLoading = false;
      this.invoiceLeadCompaniesLoadingMore = false;
      this.finishGlobalSearchIfSettled();
    }
  }

  private async loadClientOnboardingPage(
    page: number,
    options: { append?: boolean; reset?: boolean; silent?: boolean; forceRefresh?: boolean } = {},
  ): Promise<void> {
    if (!this.employee) return;
    if (options.reset && !options.silent) {
      this.clientOnboardingRecords = [];
      this.clientOnboardingPage = 1;
      this.clientOnboardingHasMore = false;
      this.clientOnboardingTotal = 0;
    }
    if (options.append) {
      this.clientOnboardingLoadingMore = true;
    } else if (!options.silent) {
      this.clientOnboardingLoading = true;
    }

    const params = new URLSearchParams({
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
      search: this.clientOnboardingSearch.trim(),
      page: String(page),
      pageSize: String(OPERATIONAL_PAGE_SIZE),
    });

    try {
      const response = await firstValueFrom(this.api.get<any>(`/api/clients?${params.toString()}`));
      const rawClients = Array.isArray(response?.clients) ? response.clients : (response?.items || []);
      const pageResult = this.resolvePagedResponse<ClientRecord>(
        response,
        rawClients.map((client: any) => this.normalizeClientRecord(client)),
        page,
      );
      this.clientOnboardingRecords = options.append
        ? this.mergeClientRecords(this.clientOnboardingRecords, pageResult.items)
        : pageResult.items;
      this.clientOnboardingPage = pageResult.page;
      this.clientOnboardingHasMore = pageResult.hasMore;
      this.clientOnboardingTotal = pageResult.total;
      this.clientOnboardingLoaded = true;
      if (!this.selectedOnboardingClientId && this.clientOnboardingRecords.length) {
        this.selectedOnboardingClientId = this.clientOnboardingRecords[0].clientId;
      }
    } catch {
      if (!options.append && !options.silent) {
        this.clientOnboardingRecords = [];
        this.clientOnboardingPage = 1;
        this.clientOnboardingHasMore = false;
        this.clientOnboardingTotal = 0;
      }
    } finally {
      this.clientOnboardingLoading = false;
      this.clientOnboardingLoadingMore = false;
      this.finishGlobalSearchIfSettled();
    }
  }

  private async loadQuotationLeadCompaniesPage(
    page: number,
    options: { append?: boolean; reset?: boolean; silent?: boolean; forceRefresh?: boolean } = {},
  ): Promise<void> {
    if (!this.employee) return;
    if (!options.forceRefresh && this.restoreCachedQuotationLeadCompaniesPage(page, !!options.append)) {
      this.finishGlobalSearchIfSettled();
      return;
    }
    if (options.append) {
      this.quotationLeadCompaniesLoadingMore = true;
    } else {
      this.quotationLeadsLoading = !options.silent;
      if (options.reset && !options.silent) {
        this.quotationLeadCompanies = [];
        this.quotationLeadCompanyContacts = {};
        this.quotationLeadCompanyPage = 1;
        this.quotationLeadCompanyHasMore = false;
        this.quotationLeadCompanyTotal = 0;
      }
    }

    const params = new URLSearchParams({
      companyCode: this.employee.companyCode,
      phone: this.employee.mobile,
      search: this.quotationSearch.trim(),
      page: String(page),
      pageSize: String(OPERATIONAL_PAGE_SIZE),
      paginated: 'true',
      includeContacts: 'true',
      contactPageSize: '1',
    });

    try {
      const response = await firstValueFrom(this.api.get<any>(`/api/leads/employee/companies?${params.toString()}`));
      const incomingCompanies = this.normalizeWorkspaceLeadCompanies(response?.companies);
      const incomingContacts = this.normalizeWorkspaceLeadCompanyContacts(response?.contactsByCompany);
      this.quotationLeadCompanies = options.append
        ? this.mergeWorkspaceLeadCompanies(this.quotationLeadCompanies, incomingCompanies)
        : incomingCompanies;
      this.quotationLeadCompanyContacts = options.append
        ? this.mergeWorkspaceLeadCompanyContacts(this.quotationLeadCompanyContacts, incomingContacts)
        : incomingContacts;
      this.quotationLeadCompanyPage = Number(response?.page || page);
      this.quotationLeadCompanyHasMore = !!response?.hasMore;
      this.quotationLeadCompanyTotal = Number(response?.total || this.quotationLeadCompanies.length);
      this.quotationLeadCompaniesLoaded = true;
      this.dashboardCache.set(this.quotationLeadCompaniesCacheKey(page), {
        companies: incomingCompanies,
        contactsByCompany: incomingContacts,
        page: this.quotationLeadCompanyPage,
        pageSize: Number(response?.pageSize || OPERATIONAL_PAGE_SIZE),
        total: this.quotationLeadCompanyTotal,
        hasMore: this.quotationLeadCompanyHasMore,
      }, { ttlMs: this.dashboardCacheTtlMs });
    } catch {
      if (!options.append && !options.silent) {
        this.quotationLeadCompanies = [];
        this.quotationLeadCompanyContacts = {};
        this.quotationLeadCompanyPage = 1;
        this.quotationLeadCompanyHasMore = false;
        this.quotationLeadCompanyTotal = 0;
      }
    } finally {
      this.quotationLeadsLoading = false;
      this.quotationLeadCompaniesLoadingMore = false;
      this.finishGlobalSearchIfSettled();
    }
  }

  private primaryLeadForCompany(
    companyName: string,
    contactsByCompany: Record<string, Lead[]>,
    filterFn?: (lead: Lead) => boolean,
  ): Lead | null {
    const normalizedCompany = this.normalizeCompanyName(companyName);
    const companyContacts = Object.entries(contactsByCompany)
      .find(([name]) => this.normalizeCompanyName(name) === normalizedCompany)?.[1] || [];
    const localContact = companyContacts.find((lead) => !filterFn || filterFn(lead));
    if (localContact) return localContact;
    return this.allLeads.find((lead) => (
      this.normalizeCompanyName(lead.leadCompanyName) === normalizedCompany &&
      (!filterFn || filterFn(lead))
    )) || null;
  }

  openInvoiceModalForCompany(companyName: string): void {
    const clientFacet = this.invoiceLeadCompanies.find((company) => this.normalizeCompanyName(company.name) === this.normalizeCompanyName(companyName));
    if (!clientFacet) return;
    this.openInvoiceModalForClient(clientFacet);
  }

  openInvoiceModalForClient(clientFacet: LeadCompanyFacet): void {
    const client = this.clientFromInvoiceFacet(clientFacet);
    const lead = this.clientToInvoiceLead(client);
    this.openInvoiceModal(lead);
    this.selectedInvoiceClient = client;
  }

  openQuotationModalForCompany(companyName: string): void {
    const lead = this.primaryLeadForCompany(companyName, this.quotationLeadCompanyContacts);
    if (!lead) return;
    this.openQuotationModal(lead);
  }

  private leadScopeFromParams(scope: Record<string, string>): EmployeeLeadScope {
    return {
      search: this.leadSearch.trim(),
      setLabel: this.selectedLeadSet.trim(),
      division: scope['division'] || '',
      status: scope['status'] || '',
      statuses: scope['statuses'] || '',
      isFavourite: scope['isFavourite'] === 'true',
      updatedFrom: scope['updatedFrom'] || '',
      updatedTo: scope['updatedTo'] || '',
    };
  }

  private todayLeadDateRangeParams(): Record<string, string> {
    const start = this.dateFromInputDate(this.historyFilterDate || this.todayInputDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      updatedFrom: start.toISOString(),
      updatedTo: end.toISOString(),
    };
  }

  private isLeadWorkspaceTab(tab: string = this.dashTab): boolean {
    return ['leads', 'interested', 'dnp', 'converted', 'favourite', 'today-calls'].includes(tab);
  }

  private dateFromInputDate(value: string): Date {
    const [year, month, day] = String(value || '').split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
  }

  fetchEmployeeLeadCompanies(append = false, _runId = this.leadFetchRun): void {
    if (!this.employee) return;
    if (append) {
      this.employeeLeadsVm.loadNextCompanyPage();
    } else {
      this.fetchLeads();
    }
  }

  fetchEmployeeLeadContacts(append = false, _runId = this.leadFetchRun): void {
    if (!this.employee || !this.selectedLeadCompany) {
      this.leadsLoading = false;
      return;
    }
    if (append) {
      this.employeeLeadsVm.loadNextContactPage();
    } else {
      this.employeeLeadsVm.selectCompany(this.selectedLeadCompany);
    }
  }

  onLeadFilterChange(): void {
    this.selectedLeadCompany = '';
    this.selectedLeadId = '';
    this.fetchLeads();
  }

  onHistoryDateChange(): void {
    this.selectedLeadCompany = '';
    this.selectedLeadId = '';
    this.todayCallsLoaded = false;
    this.fetchLeads();
    this.fetchTodayCalls(true);
  }

  onEmployeeLeadCompanyScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.employeeLeadCompaniesLoading || !this.employeeLeadCompanyHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 80) {
      this.fetchEmployeeLeadCompanies(true);
    }
  }

  onEmployeeLeadContactScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.employeeLeadContactsLoadingMore || !this.employeeLeadContactsHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      this.fetchEmployeeLeadContacts(true);
    }
  }

  onFollowupScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.followupsLoadingMore || !this.followupsHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadFollowupsPage(this.followupsPage + 1, { append: true, forceRefresh: true });
    }
  }

  onInvoiceLeadListScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.invoiceEligibleLeadsLoading || this.invoiceLeadCompaniesLoadingMore || !this.invoiceLeadCompanyHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadInvoiceLeadCompaniesPage(this.invoiceLeadCompanyPage + 1, { append: true });
    }
  }

  onClientOnboardingScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.clientOnboardingLoading || this.clientOnboardingLoadingMore || !this.clientOnboardingHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadClientOnboardingPage(this.clientOnboardingPage + 1, { append: true, forceRefresh: true });
    }
  }

  onQuotationLeadListScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.quotationLeadsLoading || this.quotationLeadCompaniesLoadingMore || !this.quotationLeadCompanyHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadQuotationLeadCompaniesPage(this.quotationLeadCompanyPage + 1, { append: true });
    }
  }

  onTodayHistoryScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.todayCallsLoadingMore || !this.todayCallsHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadTodayCallsPage(this.todayCallsPage + 1, { append: true, forceRefresh: true });
    }
  }

  onInvoiceHistoryScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.invoiceRecordsLoadingMore || !this.invoiceRecordsHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadInvoiceRecordsPage(this.invoiceRecordsPage + 1, { append: true, forceRefresh: true });
    }
  }

  onQuotationHistoryScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target || this.quotationRecordsLoadingMore || !this.quotationRecordsHasMore) return;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 120) {
      void this.loadQuotationRecordsPage(this.quotationRecordsPage + 1, { append: true, forceRefresh: true });
    }
  }

  fetchTodayCalls(force = false): void {
    if (!this.employee) return;
    const restored = !force && this.restoreCachedTodayCalls();
    void this.loadTodayCallsPage(1, { reset: true, silent: restored, forceRefresh: true });
  }

  private getLeadCollections(): LeadCollections {
    const key = [
      this.leadStateVersion,
      this.leadSearch,
      this.selectedLeadSet,
      this.selectedLeadDivision,
      this.leadStatusFilter,
      this.selectedInterestedStatus,
      this.selectedDnpStatus,
      this.selectedConvertedStatus,
      this.selectedFavouriteStatus,
      this.todayFilterStatus,
      this.historyFilterDate,
      this.INTERESTED_PAGE_STATUSES.join('|'),
      this.DNP_PAGE_STATUSES.join('|'),
      this.CONVERTED_PAGE_STATUSES.join('|'),
    ].join('::');

    if (this.leadCollectionsCache?.key === key) {
      return this.leadCollectionsCache.value;
    }

    const historyDateLocal = this.dateFromInputDate(this.historyFilterDate || this.todayInputDate).toLocaleDateString();
    const search = this.leadSearch.trim();
    const selectedLeadSet = this.selectedLeadSet.trim();
    const selectedLeadDivision = this.selectedLeadDivision.trim();
    const matchesLeadWorkspaceFilter = (lead: Lead): boolean => {
      if (search && !this.matchLead(lead, search)) return false;
      if (selectedLeadSet && lead.setLabel !== selectedLeadSet) return false;
      if (selectedLeadDivision && String(lead.mainDivisionDescription || '').trim() !== selectedLeadDivision) return false;
      return true;
    };
    const normalizedStatus = (status: string) => String(status || '').trim().toLowerCase();
    const interestedStatusSet = new Set(this.INTERESTED_PAGE_STATUSES.map(normalizedStatus));
    const dnpStatusSet = new Set(this.DNP_PAGE_STATUSES.map(normalizedStatus));
    const convertedStatusSet = new Set(this.CONVERTED_PAGE_STATUSES.map(normalizedStatus));
    const statusIn = (lead: Lead, statuses: Set<string>) => statuses.has(normalizedStatus(lead.status));
    const selectedStatusMatches = (lead: Lead, selectedStatus: string) => (
      selectedStatus === 'All' || normalizedStatus(lead.status) === normalizedStatus(selectedStatus)
    );

    const filteredLeads = this.allLeads.filter((lead) => {
      if (!matchesLeadWorkspaceFilter(lead)) return false;
      if (this.leadStatusFilter && lead.status !== this.leadStatusFilter) return false;
      return true;
    });

    const interestedLeads = this.allLeads
      .filter((lead) => matchesLeadWorkspaceFilter(lead))
      .filter((lead) => statusIn(lead, interestedStatusSet))
      .filter((lead) => selectedStatusMatches(lead, this.selectedInterestedStatus));

    const dnpLeads = this.allLeads
      .filter((lead) => matchesLeadWorkspaceFilter(lead))
      .filter((lead) => statusIn(lead, dnpStatusSet))
      .filter((lead) => selectedStatusMatches(lead, this.selectedDnpStatus));

    const convertedLeads = this.allLeads
      .filter((lead) => matchesLeadWorkspaceFilter(lead))
      .filter((lead) => statusIn(lead, convertedStatusSet))
      .filter((lead) => selectedStatusMatches(lead, this.selectedConvertedStatus));

    const favouriteLeads = this.allLeads
      .filter((lead) => matchesLeadWorkspaceFilter(lead))
      .filter((lead) => !!lead.isFavourite)
      .filter((lead) => selectedStatusMatches(lead, this.selectedFavouriteStatus));

    const rawTodayModifiedLeads = this.allLeads.filter(
      (lead) =>
        matchesLeadWorkspaceFilter(lead) &&
        !!lead.updatedAt &&
        new Date(lead.updatedAt).toLocaleDateString() === historyDateLocal,
    );
    const todayModifiedLeads = rawTodayModifiedLeads
      .filter((lead) => this.todayFilterStatus === 'All' || lead.status === this.todayFilterStatus)
      .sort((a, b) => this.toDateStamp(b.updatedAt) - this.toDateStamp(a.updatedAt));

    const todayStatusCounts: Record<string, number> = {};
    for (const lead of rawTodayModifiedLeads) {
      const status = lead.status || 'New';
      todayStatusCounts[status] = (todayStatusCounts[status] || 0) + 1;
    }

    const overviewRecentLeads = [...this.allLeads]
      .sort((a, b) => this.toDateStamp(b.updatedAt || b.createdAt) - this.toDateStamp(a.updatedAt || a.createdAt))
      .slice(0, 20);

    const leadCompanyCounts: Record<string, number> = {};
    for (const lead of this.allLeads) {
      const company = String(lead.leadCompanyName || '').trim();
      if (!company) continue;
      leadCompanyCounts[company] = (leadCompanyCounts[company] || 0) + 1;
    }

    const overviewTopCompanies = Object.entries(leadCompanyCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 6);

    const todayUpdateCompanyCounts: Record<string, number> = {};
    for (const lead of todayModifiedLeads) {
      const company = String(lead.leadCompanyName || '').trim();
      if (!company) continue;
      todayUpdateCompanyCounts[company] = (todayUpdateCompanyCounts[company] || 0) + 1;
    }

    const value: LeadCollections = {
      filteredLeads,
      uniqueLeadCompanies: this.uniqueCompanyNames(filteredLeads, (lead) => lead.leadCompanyName),
      interestedLeads,
      uniqueInterestedCompanies: this.uniqueCompanyNames(interestedLeads, (lead) => lead.leadCompanyName),
      dnpLeads,
      uniqueDnpCompanies: this.uniqueCompanyNames(dnpLeads, (lead) => lead.leadCompanyName),
      convertedLeads,
      uniqueConvertedCompanies: this.uniqueCompanyNames(convertedLeads, (lead) => lead.leadCompanyName),
      favouriteLeads,
      uniqueFavouriteCompanies: this.uniqueCompanyNames(favouriteLeads, (lead) => lead.leadCompanyName),
      rawTodayModifiedLeads,
      todayModifiedLeads,
      todayStatusCounts,
      uniqueTodayModifiedCompanies: this.uniqueCompanyNames(todayModifiedLeads, (lead) => lead.leadCompanyName),
      overviewRecentLeads,
      overviewTopCompanies,
      leadCompanyCounts,
      todayUpdateCompanyCounts,
      totalLeadsCount: this.allLeads.length,
      convertedLeadsCount: this.allLeads.filter((lead) => this.CONVERTED_PAGE_STATUSES.includes(lead.status)).length,
      pendingLeadsCount: this.allLeads.filter(
        (lead) => !this.CONVERTED_PAGE_STATUSES.includes(lead.status) && !this.DNP_PAGE_STATUSES.includes(lead.status),
      ).length,
    };

    this.leadCollectionsCache = { key, value };
    return value;
  }

  private getFollowupCollections(): FollowupCollections {
    const key = [
      this.followupStateVersion,
      this.leadSearch,
      this.followupFilter,
      this.selectedFollowupDate,
    ].join('::');

    if (this.followupCollectionsCache?.key === key) {
      return this.followupCollectionsCache.value;
    }

    const today = new Date().toLocaleDateString('en-CA');
    let filteredFollowups = this.followups;

    if (this.leadSearch) {
      filteredFollowups = filteredFollowups.filter((bookmark) => this.matchBookmark(bookmark, this.leadSearch));
    } else if (this.followupFilter === 'today') {
      filteredFollowups = filteredFollowups.filter((bookmark) => {
        if (!bookmark.reminderDate) return false;
        return new Date(bookmark.reminderDate).toLocaleDateString('en-CA') === today;
      });
    } else if (this.followupFilter === 'custom' && this.selectedFollowupDate) {
      const target = new Date(this.selectedFollowupDate).toLocaleDateString('en-CA');
      filteredFollowups = filteredFollowups.filter((bookmark) => {
        if (!bookmark.reminderDate) return false;
        return new Date(bookmark.reminderDate).toLocaleDateString('en-CA') === target;
      });
    }

    const followupCompanyCounts: Record<string, number> = {};
    for (const bookmark of this.followups) {
      const company = String(bookmark.companyName || '').trim();
      if (!company) continue;
      followupCompanyCounts[company] = (followupCompanyCounts[company] || 0) + 1;
    }

    const todayFollowupsCount = this.followups.filter((bookmark) => {
      if (!bookmark.reminderDate) return false;
      return new Date(bookmark.reminderDate).toLocaleDateString('en-CA') === today;
    }).length;

    const value: FollowupCollections = {
      filteredFollowups,
      uniqueFollowupCompanies: this.uniqueCompanyNames(filteredFollowups, (bookmark) => bookmark.companyName),
      followupCompanyCounts,
      overviewUpcomingFollowups: [...this.followups]
        .sort((a, b) => this.toDateStamp(b.updatedAt || b.createdAt) - this.toDateStamp(a.updatedAt || a.createdAt))
        .slice(0, 20),
      todayFollowupsCount,
    };

    this.followupCollectionsCache = { key, value };
    return value;
  }

  private getWorkspaceState(): WorkspaceState {
    const key = [
      this.dashTab,
      this.selectedLeadCompany,
      this.selectedLeadId,
      this.selectedFollowupId,
      this.leadStateVersion,
      this.followupStateVersion,
      this.leadSearch,
      this.selectedLeadSet,
      this.selectedLeadDivision,
      this.leadStatusFilter,
      this.selectedInterestedStatus,
      this.selectedDnpStatus,
      this.selectedConvertedStatus,
      this.selectedFavouriteStatus,
      this.todayFilterStatus,
      this.historyFilterDate,
      this.employeeLeadCompanies.map((company) => `${company.name}:${company.count}`).join('|'),
      this.followupFilter,
      this.selectedFollowupDate,
      this.INTERESTED_PAGE_STATUSES.join('|'),
      this.DNP_PAGE_STATUSES.join('|'),
      this.CONVERTED_PAGE_STATUSES.join('|'),
    ].join('::');

    if (this.workspaceStateCache?.key === key) {
      return this.workspaceStateCache.value;
    }

    const leads = this.getLeadCollections();
    const followups = this.getFollowupCollections();
    const scopedLeadRows = this.employeeLeadCompanies.length && this.isLeadWorkspaceTab()
      ? this.employeeScopedLeads
      : null;

    let activeLeadViewCompanies: string[] = [];
    let sourceRows: Lead[] = [];

    switch (this.dashTab) {
      case 'leads':
        activeLeadViewCompanies = this.employeeLeadCompanies.length
          ? this.employeeLeadCompanies.map((company) => company.name)
          : leads.uniqueLeadCompanies;
        sourceRows = scopedLeadRows || leads.filteredLeads;
        break;
      case 'interested':
        activeLeadViewCompanies = this.employeeLeadCompanies.length
          ? this.employeeLeadCompanies.map((company) => company.name)
          : leads.uniqueInterestedCompanies;
        sourceRows = scopedLeadRows || leads.interestedLeads;
        break;
      case 'dnp':
        activeLeadViewCompanies = this.employeeLeadCompanies.length
          ? this.employeeLeadCompanies.map((company) => company.name)
          : leads.uniqueDnpCompanies;
        sourceRows = scopedLeadRows || leads.dnpLeads;
        break;
      case 'converted':
        activeLeadViewCompanies = this.employeeLeadCompanies.length
          ? this.employeeLeadCompanies.map((company) => company.name)
          : leads.uniqueConvertedCompanies;
        sourceRows = scopedLeadRows || leads.convertedLeads;
        break;
      case 'favourite':
        activeLeadViewCompanies = this.employeeLeadCompanies.length
          ? this.employeeLeadCompanies.map((company) => company.name)
          : leads.uniqueFavouriteCompanies;
        sourceRows = scopedLeadRows || leads.favouriteLeads;
        break;
      case 'today-calls':
        activeLeadViewCompanies = this.employeeLeadCompanies.length
          ? this.employeeLeadCompanies.map((company) => company.name)
          : leads.uniqueTodayModifiedCompanies;
        sourceRows = scopedLeadRows || leads.todayModifiedLeads;
        break;
      default:
        activeLeadViewCompanies = [];
        sourceRows = [];
        break;
    }

    const activeSelectedCompany = activeLeadViewCompanies.includes(this.selectedLeadCompany)
      ? this.selectedLeadCompany
      : (activeLeadViewCompanies[0] || '');

    const activeLeadRows = this.rowsForCompany(sourceRows, activeSelectedCompany);
    const currentSelectedLead = activeLeadRows.find((lead) => lead._id === this.selectedLeadId) || null;

    const activeFollowupCompany = followups.uniqueFollowupCompanies.includes(this.selectedLeadCompany)
      ? this.selectedLeadCompany
      : (followups.uniqueFollowupCompanies[0] || '');

    const followupsInActiveCompany = activeFollowupCompany
      ? [...followups.filteredFollowups]
          .filter((bookmark) => bookmark.companyName === activeFollowupCompany)
          .sort((a, b) => this.toDateStamp(a.reminderDate || a.createdAt) - this.toDateStamp(b.reminderDate || b.createdAt))
      : [];

    const currentSelectedFollowup =
      followupsInActiveCompany.find((bookmark) => bookmark._id === this.selectedFollowupId) ||
      null;

    const value: WorkspaceState = {
      activeLeadViewCompanies,
      activeSelectedCompany,
      activeLeadRows,
      currentSelectedLead,
      activeFollowupCompany,
      followupsInActiveCompany,
      currentSelectedFollowup,
    };

    this.workspaceStateCache = { key, value };
    return value;
  }

  get todayModifiedLeads(): any[] {
    return this.getLeadCollections().todayModifiedLeads;
  }

  get rawTodayModifiedLeads(): any[] {
    return this.getLeadCollections().rawTodayModifiedLeads;
  }

  setTodayFilterStatus(st: string): void {
    if (this.todayFilterStatus === st) {
      this.todayFilterStatus = 'All';
    } else {
      this.todayFilterStatus = st;
    }
    this.onLeadFilterChange();
  }

  get todayStatusCounts(): { [key: string]: number } {
    return this.getLeadCollections().todayStatusCounts;
  }

  get todayStatusSummaryItems(): Array<{ status: string; count: number }> {
    const counts = this.todayStatusCounts;
    const ordered = this.LEAD_STATUSES
      .filter((status) => counts[status] > 0)
      .map((status) => ({ status, count: counts[status] }));
    const knownStatuses = new Set(this.LEAD_STATUSES);
    const unknown = Object.entries(counts)
      .filter(([status, count]) => !knownStatuses.has(status) && count > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([status, count]) => ({ status, count }));
    return [...ordered, ...unknown];
  }

  get todayCallSummary(): { total: number; connected: number } {
    const connected = this.todayCalls.filter((call) => Number(call?.duration || 0) > 0).length;
    return {
      total: this.todayCallsTotal || this.todayCalls.length,
      connected,
    };
  }

  get uniqueTodayModifiedCompanies(): string[] {
    return this.getLeadCollections().uniqueTodayModifiedCompanies;
  }

  get leadsInTodayModifiedCompany(): Lead[] {
    return this.rowsForCompany(this.todayModifiedLeads, this.selectedLeadCompany);
  }

  getTodayUpdatesCount(company: string): number {
    return this.getLeadCollections().todayUpdateCompanyCounts[company] || 0;
  }

  updateLeadStatus(lead: Lead, newStatus: string): void {
    this.updatingLeadId = lead._id;
    this.invalidateInvoiceCaches();
    this.invalidateOverviewCaches();
    this.employeeLeadsVm.updateStatus(this.toEmployeeLeadModel(lead), newStatus);
    setTimeout(() => {
      if (this.updatingLeadId === lead._id) this.updatingLeadId = '';
    }, 400);
  }

  getLeadStatusClass(status: string): string {
    if (this.INTERESTED_PAGE_STATUSES.includes(status)) return 'status-interested';
    if (this.DNP_PAGE_STATUSES.includes(status)) return 'status-not-interested';
    if (this.CONVERTED_PAGE_STATUSES.includes(status)) return 'status-converted';
    if (status === 'Follow Up') return 'status-followup';
    if (status === 'Contacted') return 'status-contacted';
    return 'status-new';
  }

  leadStatusColor(status: string): string {
    if (this.INTERESTED_PAGE_STATUSES.includes(status)) return 'var(--status-positive)';
    if (this.DNP_PAGE_STATUSES.includes(status)) return 'var(--status-negative)';
    if (this.CONVERTED_PAGE_STATUSES.includes(status)) return 'var(--status-info)';
    if (status === 'Follow Up') return 'var(--status-warning)';
    if (status === 'Contacted') return 'var(--status-info)';
    return 'var(--text-strong)';
  }

  leadStatusColorFn = (status: string): string => this.leadStatusColor(status);

  fmtDateFn = (value: string | undefined): string => this.fmtDate(value);

  trackCompanyName(_index: number, company: string): string {
    return company;
  }

  trackLeadId(_index: number, lead: Lead): string {
    return lead._id || `${lead.leadCompanyName}:${lead.contactNumber}:${_index}`;
  }

  trackStatusSummary(_index: number, item: { status: string; count: number }): string {
    return item.status;
  }

  // ── Follow-ups ────────────────────────────────────────────────
  fetchFollowups(force = false): void {
    if (!this.employee) return;
    const restored = !force && this.restoreCachedFollowups();
    void this.loadFollowupsPage(1, { reset: true, silent: restored, forceRefresh: true });
  }

  fetchOverviewFollowups(force = false): void {
    if (!this.employee) return;
    void this.loadOverviewFollowupsOnce(force);
  }

  get overviewRecentLeads(): Lead[] {
    return this.getLeadCollections().overviewRecentLeads;
  }

  get overviewUpcomingFollowups(): Bookmark[] {
    if (this.overviewFollowupsLoaded || this.overviewFollowupsLoading) {
      return this.overviewFollowups;
    }
    return this.getFollowupCollections().overviewUpcomingFollowups;
  }

  get hasOverviewActivity(): boolean {
    const statTotal =
      (this.callStats?.incoming || 0) +
      (this.callStats?.outgoing || 0) +
      (this.callStats?.missed || 0) +
      (this.callStats?.rejected || 0) +
      (this.callStats?.connected || 0) +
      (this.callStats?.totalDuration || 0);

    if (statTotal > 0) return true;

    return this.timelineData.some((row) =>
      ((row?.incoming || 0) + (row?.outgoing || 0) + (row?.missed || 0) + (row?.rejected || 0)) > 0
    );
  }

  get overviewTopCompanies(): Array<{ name: string; count: number }> {
    return this.getLeadCollections().overviewTopCompanies;
  }

  get activeWorkspaceTitle(): string {
    switch (this.dashTab) {
      case 'leads':
        return 'My Leads';
      case 'interested':
        return 'Interested';
      case 'dnp':
        return 'Not Connected';
      case 'converted':
        return 'Converted';
      case 'favourite':
        return 'Favorites';
      case 'today-calls':
        return 'Today History';
      case 'invoices':
        return 'Invoices';
      case 'client-onboarding':
        return 'Client Onboarding';
      case 'quotations':
        return 'Quotations';
      default:
        return '';
    }
  }

  get topbarTitle(): string {
    if (this.dashTab === 'overview') return 'Overview';
    if (this.dashTab === 'followups') return 'Follow-ups';
    if (this.dashTab === 'invoices') return 'Invoices';
    if (this.dashTab === 'client-onboarding') return 'Client Onboarding';
    if (this.dashTab === 'quotations') return 'Quotations';
    return this.activeWorkspaceTitle || 'DealVoice';
  }

  get activeWorkspaceDescription(): string {
    switch (this.dashTab) {
      case 'leads':
        return 'Assigned accounts and contact records.';
      case 'interested':
        return 'Leads that require closing momentum and next-action discipline.';
      case 'dnp':
        return 'Leads that need recovery, retry, or disqualification handling.';
      case 'converted':
        return 'Closed business and confirmed conversion records.';
      case 'favourite':
        return 'Priority companies and contacts marked for repeat focus.';
      case 'today-calls':
        return 'Today’s updated records and live work history.';
      case 'invoices':
        return 'Create invoices for onboarded clients and review saved invoice history.';
      case 'client-onboarding':
        return 'Onboard client companies and keep their generated client IDs ready for delivery workflows.';
      case 'quotations':
        return 'Create quotations for leads and review saved quotation history.';
      default:
        return '';
    }
  }

  get employeeFirstName(): string {
    const name = String(this.employee?.name || '').trim();
    return name ? name.split(/\s+/)[0] : 'there';
  }

  get overviewGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get activeLeadViewCompanies(): string[] {
    return this.getWorkspaceState().activeLeadViewCompanies;
  }

  get activeSelectedCompany(): string {
    return this.getWorkspaceState().activeSelectedCompany;
  }

  private rowsForCompany(source: Lead[], company: string): Lead[] {
    if (!company) return [];
    return source
      .filter((lead) => lead.leadCompanyName === company)
      .sort((a, b) => {
        const aOrder = a.sheetOrder ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sheetOrder ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.contactName || '').localeCompare(String(b.contactName || ''));
      });
  }

  get activeLeadRows(): Lead[] {
    return this.getWorkspaceState().activeLeadRows;
  }

  get currentSelectedLead(): Lead | null {
    return this.getWorkspaceState().currentSelectedLead;
  }

  get showLeadRecordView(): boolean {
    return !!this.currentSelectedLead && ['leads', 'interested', 'dnp', 'converted', 'favourite', 'today-calls'].includes(this.dashTab);
  }

  get activeFollowupCompany(): string {
    return this.getWorkspaceState().activeFollowupCompany;
  }

  get followupsInActiveCompany(): Bookmark[] {
    return this.getWorkspaceState().followupsInActiveCompany;
  }

  get currentSelectedFollowup(): Bookmark | null {
    return this.getWorkspaceState().currentSelectedFollowup;
  }

  get showFollowupRecordView(): boolean {
    return this.dashTab === 'followups' && !!this.currentSelectedFollowup && !!this.selectedFollowupId;
  }

  get currentDrawerLead(): Lead | null {
    if (this.dashTab === 'followups') {
      if (this.followupLead) return this.followupLead;
      const bookmark = this.currentSelectedFollowup;
      if (!bookmark) return null;
      return (
        this.getLeadByPhone(bookmark.contactNumber) ||
        this.allLeads.find(
          (lead) => lead.contactNumber === bookmark.contactNumber && lead.leadCompanyName === bookmark.companyName
        ) || {
          _id: '',
          companyCode: bookmark.companyCode,
          assignedEmployeePhone: bookmark.employeePhone,
          leadCompanyName: bookmark.companyName,
          contactName: bookmark.contactName,
          contactNumber: bookmark.contactNumber,
          status: 'Follow Up',
          setLabel: '',
        }
      );
    }

    return this.currentSelectedLead;
  }

  get employeeInitials(): string {
    const name = String(this.employee?.name || '').trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }

  get hasProfilePhoto(): boolean {
    return !!String(this.employee?.profilePhoto || '').trim();
  }

  // ── Helpers ───────────────────────────────────────────────────
  fmtDur(secs: number): string {
    if (!secs) return '0s';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  fmtDate(d: string | undefined | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fmtDateTime(d: string | undefined | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatAiText(text: string | undefined | null): string {
    return String(text || '').trim();
  }

  get initials(): string {
    if (!this.employee?.name) return 'E';
    return this.employee.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  }

  get totalLeadsCount(): number { return this.getLeadCollections().totalLeadsCount; }
  get convertedLeadsCount(): number { 
    return this.getLeadCollections().convertedLeadsCount; 
  }
  get pendingLeadsCount(): number { 
    return this.getLeadCollections().pendingLeadsCount; 
  }

  getLeadByPhone(phone: string): Lead | undefined {
    return this.allLeads.find(l => l.contactNumber === phone);
  }
}

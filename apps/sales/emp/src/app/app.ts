import { Component, ElementRef, HostListener, OnInit, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe, DecimalPipe, NgTemplateOutlet, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { Subscription } from 'rxjs';
import { RealtimeService, SSEEvent } from './realtime.service';
import { ApiService } from './api.service';
import { AiBrief, AiBriefService } from './ai-brief.service';
import {
  AiSuggestion,
  AiSuggestionScenario,
  AiSuggestionService,
} from './ai-suggestion.service';

interface Employee {
  _id: string;
  name: string;
  mobile: string;
  companyCode: string;
  countryCode?: string;
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
}

interface InvoiceRecord {
  _id: string;
  invoiceNumber: string;
  leadCompanyName: string;
  contactName: string;
  contactNumber: string;
  directorEmailAddress?: string;
  employeePhone?: string;
  employeeName?: string;
  total: number;
  invoiceDate: string;
  createdAt?: string;
  items?: Array<{ name: string; quantity: number; rate: number; total: number }>;
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  companySnapshot?: any;
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
  items?: Array<{ name: string; quantity: number; rate: number; total: number }>;
  subtotal?: number;
  gstPercentage?: number;
  gstAmount?: number;
  companySnapshot?: any;
}

interface QuotationLeadCompanyOption {
  companyName: string;
  primaryLead: Lead;
}

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

type DrawerSection = 'details' | 'history' | 'followup' | 'ai';

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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, NgTemplateOutlet, FormsModule, DatePipe, DecimalPipe, KeyValuePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App implements OnInit, OnDestroy {
  @ViewChild('followupDetailPanel') private followupDetailPanel?: ElementRef<HTMLElement>;
  @ViewChild('followupDetailsSection') private followupDetailsSection?: ElementRef<HTMLElement>;
  @ViewChild('followupEditSection') private followupEditSection?: ElementRef<HTMLElement>;
  @ViewChild('followupHistorySection') private followupHistorySection?: ElementRef<HTMLElement>;

  private sseSub?: Subscription;
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

  // ── Dashboard tabs ────────────────────────────────────────────
  dashTab: 'overview' | 'leads' | 'followups' | 'interested' | 'dnp' | 'converted' | 'favourite' | 'today-calls' | 'invoices' | 'quotations' = 'overview';
  sidebarFeatureSearch = '';

  // ── Period ────────────────────────────────────────────────────
  selectedPeriod: 'today' | 'yesterday' | 'lastweek' = 'today';

  // ── Call Stats ────────────────────────────────────────────────
  callStats: CallStats | null = null;
  statsLoading = false;
  donutChart: Chart | null = null;
  timelineChart: Chart | null = null;
  timelineData: any[] = [];
  chartType: 'line' | 'bar' = 'line';

  // ── Leads ─────────────────────────────────────────────────────
  allLeads: Lead[] = [];
  leads: Lead[] = [];
  leadsLoading = false;
  isSearching = false;
  private _leadSearch = '';
  private _searchTimeout: any;
  private leadFetchRun = 0;
  private readonly leadPageSize = 200;
  private serverLeadSets: string[] = [];

  todayCalls: any[] = [];
  todayCallsLoading = false;

  get leadSearch(): string {
    return this._leadSearch;
  }

  set leadSearch(val: string) {
    this._leadSearch = val;
    this.isSearching = true;
    if (this._searchTimeout) clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      this.isSearching = false;
    }, 400);
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
    quotations: ''
  };
  leadRemarksInputs: { [key: string]: string } = {};
  todayFilterStatus: string = 'All';
  historyFilterDate: string = new Date().toLocaleDateString('en-CA');
  remarkPostingIds = new Set<string>();
  productRemarks: string[] = [];
  aiBrief: AiBrief | null = null;
  aiBriefLoading = false;
  aiBriefError = '';
  aiBriefCacheStatus: 'hit' | 'miss' | '' = '';
  aiBriefCompany = '';
  aiBriefLeadId = '';
  aiBriefOpenTarget = '';
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

    if (!nextValue) {
      this.closeAiBriefPopup();
      this.resetAiBriefState();
      this.resetDetailAiSuggestionState();
      return;
    }

    this.syncAiForActiveView();
  }

  // ── History Modal ─────────────────────────────────────────────
  showHistoryModal = false;
  historyLogs: any[] = [];
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

    this.api.get<any>(`/api/history?companyCode=${lead.companyCode}&companyName=${encodeURIComponent(lead.leadCompanyName)}`).subscribe({
      next: res => {
        this.historyLoading = false;
        if (res.success) {
          this.historyLogs = res.logs;

          // 1. Fallback for "Lead Created"
          const hasCreated = this.historyLogs.some(l => l.action.toLowerCase().includes('created'));
          if (!hasCreated && lead.createdAt) {
            this.historyLogs.push({
              action: 'Lead Created',
              createdAt: lead.createdAt,
              changedBy: 'System (Legacy)',
              newValue: lead.status || 'New'
            });
          }

          // 2. Fallback for legacy Remarks
          if (lead.remarks && Array.isArray(lead.remarks)) {
            const loggedRemarks = new Set(
              this.historyLogs
                .filter(l => l.action === 'Remark Added')
                .map(l => l.newValue)
            );

            lead.remarks.forEach(rem => {
              if (rem && !loggedRemarks.has(rem)) {
                this.historyLogs.push({
                  action: 'Legacy Remark',
                  createdAt: lead.createdAt,
                  changedBy: 'System (Legacy)',
                  metadata: { remark: rem }
                });
              }
            });
          }

          // 3. Final Sort
          this.historyLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      },
      error: () => {
        this.historyLoading = false;
      }
    });
  }

  closeHistoryModal(): void {
    this.showHistoryModal = false;
    this.historyLead = null;
    this.historyLogs = [];
    if (this.drawerSection === 'history') this.drawerSection = 'details';
  }

  addLeadRemark(lead: Lead): void {
    const remark = this.leadRemarksInputs[lead._id];
    if (!remark || !remark.trim() || this.remarkPostingIds.has(lead._id)) return;

    this.remarkPostingIds.add(lead._id);

    this.api.post(`/api/leads/${lead._id}/remarks`, { remark }).subscribe({
      next: (res: any) => {
        this.remarkPostingIds.delete(lead._id);
        if (res.success) {
          this.leadRemarksInputs[lead._id] = '';
          // Immediate reflection
          const idx = this.leads.findIndex(l => l._id === lead._id);
          if (idx !== -1) {
            this.leads[idx] = this.normalizeLead(res.lead);
          }
          const allIdx = this.allLeads.findIndex(l => l._id === lead._id);
          if (allIdx !== -1) {
            this.allLeads[allIdx] = this.normalizeLead(res.lead);
          }
          this.touchLeads();
        }
      },
      error: () => {
        this.remarkPostingIds.delete(lead._id);
      }
    });
  }

  remarkDeletingIds = new Set<string>();

  deleteLeadRemark(lead: Lead, index: number): void {
    if (!confirm('Delete this remark?')) return;
    const key = `${lead._id}-${index}`;
    if (this.remarkDeletingIds.has(key)) return;
    this.remarkDeletingIds.add(key);

    this.api.delete(`/api/leads/${lead._id}/remarks/${index}`).subscribe({
      next: (res: any) => {
        this.remarkDeletingIds.delete(key);
        if (res.success) {
          const idx = this.leads.findIndex(l => l._id === lead._id);
          if (idx !== -1) {
            this.leads[idx] = this.normalizeLead(res.lead);
          }
          const allIdx = this.allLeads.findIndex(l => l._id === lead._id);
          if (allIdx !== -1) {
            this.allLeads[allIdx] = this.normalizeLead(res.lead);
          }
          this.touchLeads();
        }
      },
      error: () => {
        this.remarkDeletingIds.delete(key);
      }
    });
  }

  toggleFavourite(lead: Lead): void {
    const newVal = !lead.isFavourite;
    this.api.patch<any>(`/api/leads/${lead._id}/flags`, { isFavourite: newVal }).subscribe({
      next: res => {
        if (res.success && res.lead) {
          const normalized = this.normalizeLead(res.lead);
          const allIdx = this.allLeads.findIndex(al => al._id === lead._id);
          if (allIdx !== -1) this.allLeads[allIdx] = normalized;
          Object.assign(lead, normalized);
          this.touchLeads();
        }
      }
    });
  }

  toggleStar(lead: Lead): void {
    const newVal = !lead.isStarred;
    this.api.patch<any>(`/api/leads/${lead._id}/flags`, { isStarred: newVal }).subscribe({
      next: res => {
        if (res.success && res.lead) {
          const normalized = this.normalizeLead(res.lead);
          const allIdx = this.allLeads.findIndex(al => al._id === lead._id);
          if (allIdx !== -1) this.allLeads[allIdx] = normalized;
          Object.assign(lead, normalized);
          this.touchLeads();
        }
      }
    });
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
  selectedLeadSet = '';
  selectedFavouriteStatus: string = 'All';
  updatingLeadId = '';

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
  }

  selectLeadRecord(lead: Lead, section: DrawerSection = 'details'): void {
    if (lead.leadCompanyName && this.selectedLeadCompany !== lead.leadCompanyName) {
      this.selectedLeadCompany = lead.leadCompanyName;
      this.tabSelections[this.dashTab] = lead.leadCompanyName;
    }
    this.selectedLeadId = lead._id;
    this.drawerSection = section;
  }

  closeLeadRecordView(): void {
    this.selectedLeadId = '';
    this.drawerSection = 'details';
    this.showHistoryModal = false;
  }

  closeFollowupRecordView(): void {
    this.selectedFollowupId = '';
    this.selectedLeadId = '';
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
      reminderDate: bookmark.reminderDate ? new Date(bookmark.reminderDate).toISOString().split('T')[0] : ''
    };
    if (shouldLoadAiSuggestion) {
      this.loadModalAiSuggestionForLead(this.followupLead, bookmark._id);
    }
  }

  private upsertFollowupLocally(bookmark: Bookmark): void {
    const idx = this.followups.findIndex((item) => item._id === bookmark._id);
    if (idx === -1) {
      this.followups.unshift(bookmark);
    } else {
      this.followups[idx] = bookmark;
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

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.profileMenuOpen && (!target || !target.closest('.profile-dropdown'))) {
      this.closeProfileMenu();
    }

    if (!this.aiBriefOpenTarget) return;
    if (!target || target.closest('.ai-summary-anchor')) return;

    this.closeAiBriefPopup();
  }

  @HostListener('document:keydown.escape')
  handleGlobalEscape(): void {
    this.closeProfileMenu();
    this.closeAiBriefPopup();
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
    this.closeAiBriefPopup();
    this.resetAiBriefState();
    const briefLead = this.getSelectedLeadForAiBrief();
    if (briefLead && this.selectedLeadCompany) {
      this.loadAiBriefForLead(briefLead, this.selectedLeadCompany);
    }
    this.loadDetailAiSuggestionForSelectedCompany();
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
  LEAD_STATUSES: string[] = [];
  INTERESTED_PAGE_STATUSES: string[] = [];
  DNP_PAGE_STATUSES: string[] = [];
  CONVERTED_PAGE_STATUSES: string[] = [];
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
  bankDetails: any = null;
  contactDetails: any = null;
  companyAddress: string = '';
  products: any[] = [];

  invoiceItems: any[] = [];
  invoiceDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  invoiceIssuedAt = new Date();
  dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  quoteNumber = Math.floor(100000 + Math.random() * 900000);
  showInvoiceModal = false;
  invoiceLead: Lead | null = null;
  invoiceSaving = false;
  currentInvoiceNumber = '';
  invoiceRecords: InvoiceRecord[] = [];
  invoiceRecordsLoading = false;
  invoiceSearch = '';
  invoiceHistorySearch = '';
  invoiceLeadPage = 1;
  invoiceDateFilterOpen = false;
  invoiceDateFrom = '';
  invoiceDateTo = '';
  quoteMode = false;
  quotationRecords: QuotationRecord[] = [];
  quotationRecordsLoading = false;
  quotationSearch = '';
  quotationHistorySearch = '';
  quotationLeadPage = 1;
  quotationDateFilterOpen = false;
  quotationDateFrom = '';
  quotationDateTo = '';
  quotationSaving = false;
  currentQuotationNumber = '';
  viewingSavedDocument = false;
  readonly documentLeadPageSize = 15;

  get todayInputDate(): string {
    return new Date().toLocaleDateString('en-CA');
  }

  // For the selection form
  selectedInvoiceProduct: any = null;
  invoicePrice: number = 0;
  invoiceQuantity: number = 1;

  openInvoiceModal(lead: any): void {
    this.quoteMode = false;
    this.invoiceLead = lead;
    this.invoiceItems = [];
    this.selectedInvoiceProduct = null;
    this.invoicePrice = 0;
    this.invoiceQuantity = 1;
    this.showInvoiceModal = true;
    this.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    this.invoiceIssuedAt = new Date();
    this.currentInvoiceNumber = '';
  }

  openQuotationModal(lead: any): void {
    this.quoteMode = true;
    this.invoiceLead = lead;
    this.invoiceItems = [];
    this.selectedInvoiceProduct = null;
    this.invoicePrice = 0;
    this.invoiceQuantity = 1;
    this.showInvoiceModal = true;
    this.quoteNumber = Math.floor(100000 + Math.random() * 900000);
    this.invoiceIssuedAt = new Date();
    this.currentQuotationNumber = '';
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.quoteMode = false;
    this.viewingSavedDocument = false;
  }

  onProductSelect(): void {
    if (this.selectedInvoiceProduct) {
      this.invoicePrice = this.selectedInvoiceProduct.minPrice;
    }
  }

  addInvoiceItem(): void {
    if (!this.selectedInvoiceProduct) return;
    
    // Validate price
    if (this.invoicePrice < this.selectedInvoiceProduct.minPrice) {
      alert(`Price cannot be less than the minimum price of ₹${this.selectedInvoiceProduct.minPrice}`);
      this.invoicePrice = this.selectedInvoiceProduct.minPrice;
      return;
    }

    this.invoiceItems.push({
      product: this.selectedInvoiceProduct,
      price: this.invoicePrice,
      quantity: this.invoiceQuantity,
      name: this.selectedInvoiceProduct.name
    });

    // Reset selection
    this.selectedInvoiceProduct = null;
    this.invoicePrice = 0;
    this.invoiceQuantity = 1;
  }

  removeInvoiceItem(index: number): void {
    this.invoiceItems.splice(index, 1);
  }

  get invoiceSubtotal(): number {
    return this.invoiceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get invoiceGstAmount(): number {
    return this.invoiceSubtotal * (this.gstPercentage / 100);
  }

  get invoiceTotal(): number {
    return this.invoiceSubtotal + this.invoiceGstAmount;
  }

  get invoiceCgstAmount(): number {
    return this.invoiceGstAmount / 2;
  }

  get invoiceSgstAmount(): number {
    return this.invoiceGstAmount / 2;
  }

  invoiceItemTaxable(item: any): number {
    return Number(item.price || 0) * Number(item.quantity || 0);
  }

  invoiceItemGst(item: any): number {
    return this.invoiceItemTaxable(item) * (this.gstPercentage / 100);
  }

  invoiceItemTotal(item: any): number {
    return this.invoiceItemTaxable(item) + this.invoiceItemGst(item);
  }

  formatInvoiceMoney(value: number): string {
    return `INR ${Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  invoiceCompanyDisplayName(): string {
    return (this.showCompanyNameOnInvoice ? this.companyName : '') || 'DealVoice';
  }

  invoiceCompanyAddress(): string {
    return this.invoiceRegisteredAddress || this.companyAddress || this.contactDetails?.address || '';
  }

  invoiceContactLine(): string {
    const parts = [this.contactDetails?.phone, this.contactDetails?.email, this.contactDetails?.website]
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    return parts.join(' · ');
  }

  invoiceNumber(): string {
    if (this.quoteMode) return this.quotationNumber();
    if (this.currentInvoiceNumber) return this.currentInvoiceNumber;
    const issued = this.invoiceIssuedAt || new Date();
    const yyyy = String(issued.getFullYear());
    const mm = String(issued.getMonth() + 1).padStart(2, '0');
    const sequence = String(this.quoteNumber % 1000 || 1).padStart(3, '0');
    return `Invoice_${yyyy}${mm}${sequence}_v1.pdf`;
  }

  quotationNumber(): string {
    if (this.currentQuotationNumber) return this.currentQuotationNumber;
    const issued = this.invoiceIssuedAt || new Date();
    const yyyy = String(issued.getFullYear());
    const mm = String(issued.getMonth() + 1).padStart(2, '0');
    const sequence = String(this.quoteNumber % 1000 || 1).padStart(3, '0');
    return `Quote_${yyyy}${mm}${sequence}_v1.pdf`;
  }

  printInvoice(): void {
    if (this.invoiceItems.length === 0) {
      alert(`Please add at least one product to the ${this.quoteMode ? 'quotation' : 'invoice'}.`);
      return;
    }
    if (this.viewingSavedDocument) {
      setTimeout(() => window.print(), 50);
      return;
    }
    if (this.quoteMode) {
      this.saveAndPrintQuotation();
      return;
    }
    if (!this.invoiceLead || !this.employee || this.invoiceSaving) return;

    this.invoiceSaving = true;
    this.api.post<any>('/api/invoices', {
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
      employeeName: this.employee.name,
      createdByRole: 'employee',
      createdByName: this.employee.name,
      createdByPhone: this.employee.mobile,
      leadId: this.invoiceLead._id,
      contactNumber: this.invoiceLead.contactNumber,
      gstPercentage: this.gstPercentage,
      invoiceDate: this.invoiceIssuedAt,
      dueDate: this.dueDate,
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
        this.fetchInvoiceRecords();
        setTimeout(() => window.print(), 50);
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
      gstPercentage: this.gstPercentage,
      quotationDate: this.invoiceIssuedAt,
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
        this.fetchQuotationRecords();
        setTimeout(() => window.print(), 50);
      },
      error: (err) => {
        this.quotationSaving = false;
        alert(err?.error?.message || 'Failed to save quotation.');
      },
    });
  }

  fetchInvoiceRecords(): void {
    if (!this.employee) return;
    this.invoiceRecordsLoading = true;
    const params = new URLSearchParams({
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
    });
    this.api.get<any>(`/api/invoices?${params.toString()}`).subscribe({
      next: (res) => {
        this.invoiceRecordsLoading = false;
        this.invoiceRecords = res?.success ? (res.invoices || []) : [];
      },
      error: () => {
        this.invoiceRecordsLoading = false;
      },
    });
  }

  get invoiceConvertedLeads(): Lead[] {
    const convertedStatuses = this.CONVERTED_PAGE_STATUSES.map((status) => status.toLowerCase());
    const query = this.invoiceSearch.trim().toLowerCase();
    return this.allLeads
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
      });
  }

  get currentInvoiceLeadPage(): number {
    return Math.min(this.invoiceLeadPage, this.invoiceLeadTotalPages);
  }

  get invoiceLeadTotalPages(): number {
    return Math.max(1, Math.ceil(this.invoiceConvertedLeads.length / this.documentLeadPageSize));
  }

  get paginatedInvoiceConvertedLeads(): Lead[] {
    const start = (this.currentInvoiceLeadPage - 1) * this.documentLeadPageSize;
    return this.invoiceConvertedLeads.slice(start, start + this.documentLeadPageSize);
  }

  get quotationLeadCompanies(): QuotationLeadCompanyOption[] {
    const query = this.quotationSearch.trim().toLowerCase();
    const companies = new Map<string, QuotationLeadCompanyOption>();

    for (const lead of this.allLeads) {
      const companyName = String(lead.leadCompanyName || '').trim();
      if (!companyName) continue;

      const searchable = [
        lead.leadCompanyName,
        lead.contactName,
        lead.contactNumber,
        lead.directorEmailAddress,
        lead.status,
      ].join(' ').toLowerCase();

      if (query && !searchable.includes(query)) continue;

      const key = companyName.toLowerCase();
      if (!companies.has(key)) {
        companies.set(key, {
          companyName,
          primaryLead: lead,
        });
      }
    }

    return Array.from(companies.values());
  }

  get currentQuotationLeadPage(): number {
    return Math.min(this.quotationLeadPage, this.quotationLeadTotalPages);
  }

  get quotationLeadTotalPages(): number {
    return Math.max(1, Math.ceil(this.quotationLeadCompanies.length / this.documentLeadPageSize));
  }

  get paginatedQuotationLeadCompanies(): QuotationLeadCompanyOption[] {
    const start = (this.currentQuotationLeadPage - 1) * this.documentLeadPageSize;
    return this.quotationLeadCompanies.slice(start, start + this.documentLeadPageSize);
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

  fetchQuotationRecords(): void {
    if (!this.employee) return;
    this.quotationRecordsLoading = true;
    const params = new URLSearchParams({
      companyCode: this.employee.companyCode,
      employeePhone: this.employee.mobile,
    });
    this.api.get<any>(`/api/quotations?${params.toString()}`).subscribe({
      next: (res) => {
        this.quotationRecordsLoading = false;
        this.quotationRecords = res?.success ? (res.quotations || []) : [];
      },
      error: () => {
        this.quotationRecordsLoading = false;
      },
    });
  }

  openSavedInvoice(record: InvoiceRecord): void {
    this.quoteMode = false;
    this.viewingSavedDocument = true;
    this.currentInvoiceNumber = record.invoiceNumber;
    this.currentQuotationNumber = '';
    this.invoiceIssuedAt = record.invoiceDate ? new Date(record.invoiceDate) : new Date(record.createdAt || Date.now());
    this.invoiceLead = {
      _id: record._id,
      companyCode: this.employee?.companyCode || '',
      assignedEmployeePhone: this.employee?.mobile || '',
      leadCompanyName: record.leadCompanyName,
      contactName: record.contactName,
      contactNumber: record.contactNumber,
      directorEmailAddress: record.directorEmailAddress,
      status: '',
      setLabel: '',
    };
    this.invoiceItems = this.mapSavedDocumentItems(record.items);
    this.showInvoiceModal = true;
  }

  openSavedQuotation(record: QuotationRecord): void {
    this.quoteMode = true;
    this.viewingSavedDocument = true;
    this.currentQuotationNumber = record.quotationNumber;
    this.currentInvoiceNumber = '';
    this.invoiceIssuedAt = record.quotationDate ? new Date(record.quotationDate) : new Date(record.createdAt || Date.now());
    this.invoiceLead = {
      _id: record._id,
      companyCode: this.employee?.companyCode || '',
      assignedEmployeePhone: this.employee?.mobile || '',
      leadCompanyName: record.leadCompanyName,
      contactName: record.contactName,
      contactNumber: record.contactNumber,
      directorEmailAddress: record.directorEmailAddress,
      status: '',
      setLabel: '',
    };
    this.invoiceItems = this.mapSavedDocumentItems(record.items);
    this.showInvoiceModal = true;
  }

  mapSavedDocumentItems(items?: Array<{ name: string; quantity: number; rate: number; total: number }>): any[] {
    return (items || []).map((item) => ({
      name: item.name,
      price: Number(item.rate || 0),
      quantity: Number(item.quantity || 1),
      product: { name: item.name, sacHsn: '' },
    }));
  }

  setInvoiceLeadPage(page: number): void {
    this.invoiceLeadPage = Math.min(Math.max(page, 1), this.invoiceLeadTotalPages);
  }

  setQuotationLeadPage(page: number): void {
    this.quotationLeadPage = Math.min(Math.max(page, 1), this.quotationLeadTotalPages);
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
    return this.activeRowsForCompany(company).length;
  }

  activeCompanyPrimaryLead(company: string): Lead | null {
    return this.activeRowsForCompany(company)[0] || null;
  }

  activeCompanyPreviewLine(company: string): string {
    const lead = this.activeCompanyPrimaryLead(company);
    if (!lead) return '';

    const latestRemark = [...(lead.remarks || [])].filter(Boolean).slice(-1)[0];
    if (latestRemark) return latestRemark;
    if (lead.mainDivisionDescription) return lead.mainDivisionDescription;
    if (lead.companyDescription) return lead.companyDescription;
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
    this.openFollowupFullDetails(bookmark, 'details');
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
        next: res => {
          this.followupSaving = false;
          if (res.success && res.bookmark) {
            this.upsertFollowupLocally(res.bookmark);
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
        next: res => {
          this.followupSaving = false;
          if (res.success && res.bookmark) {
            this.upsertFollowupLocally(res.bookmark);
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
    private aiBriefService: AiBriefService,
    private aiSuggestionService: AiSuggestionService
  ) { }

  ngOnInit(): void {
    Chart.register(...registerables);
    const raw = localStorage.getItem('dv_employee');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.employee = data.employee;
        this.companyName = data.companyName || '';
        this.loggedIn = true;
        this.loadDashboard();
        this.initRealtime();
        this.resumeBreakTimer();
      } catch { localStorage.removeItem('dv_employee'); }
    }
  }

  ngOnDestroy(): void {
    if (this.donutChart) this.donutChart.destroy();
    this.sse.disconnect();
    this.sseSub?.unsubscribe();
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
              localStorage.setItem('dv_employee', JSON.stringify({
                employee: this.employee,
                companyName: this.companyName,
              }));
            },
            error: () => {
              localStorage.setItem('dv_employee', JSON.stringify({ employee: this.employee, companyName: '' }));
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
    this.loggedIn = false;
    this.employee = null;
    this.companyName = '';
    this.callStats = null;
    this.leads = [];
    this.followups = [];
    this.allLeads = [];
    this.selectedLeadSet = '';
    this.selectedLeadCompany = '';
    this.selectedLeadId = '';
    this.selectedFollowupId = '';
    this.drawerSection = 'details';
    this.dashTab = 'overview';
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
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  // ── Dashboard Loader ──────────────────────────────────────────
  initRealtime(): void {
    if (!this.employee) return;
    this.sse.connect(this.employee.companyCode, this.employee.mobile);
    this.sseSub = this.sse.events$.subscribe((ev: SSEEvent) => {
      this.handleRealtimeEvent(ev);
    });
  }

  private looksLikeEmail(value: unknown): boolean {
    const normalized = String(value ?? '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  }

  private looksLikePhone(value: unknown): boolean {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  normalizeLead(lead: any): Lead {
    if (!lead) return lead;
    const contactNumber = String(lead.contactNumber ?? '').trim();
    const directorEmailAddress = String(lead.directorEmailAddress ?? '').trim();
    const shouldSwapContactFields =
      this.looksLikeEmail(contactNumber) &&
      this.looksLikePhone(directorEmailAddress);

    return {
      ...lead,
      contactNumber: shouldSwapContactFields ? directorEmailAddress : contactNumber,
      directorEmailAddress: shouldSwapContactFields ? contactNumber : directorEmailAddress,
      remarks: Array.isArray(lead.remarks) ? lead.remarks : (lead.remarks ? [lead.remarks] : [])
    };
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
      this.fetchLeads(); // bulk change, just refresh
    } else if (ev.type === 'LEAD_CREATED' && ev.lead) {
      const normalized = this.normalizeLead(ev.lead);
      if (!this.leads.find(l => l._id === ev.lead._id)) {
        this.leads.unshift(normalized);
      }
      if (!this.allLeads.find(l => l._id === ev.lead._id)) {
        this.allLeads.unshift(normalized);
      }
      this.touchLeads();
    } else if (ev.type === 'LEAD_UPDATED' && ev.lead) {
      const normalized = this.normalizeLead(ev.lead);
      const idx = this.leads.findIndex(l => l._id === ev.lead._id);
      if (idx !== -1) this.leads[idx] = normalized;
      const allIdx = this.allLeads.findIndex(l => l._id === ev.lead._id);
      if (allIdx !== -1) this.allLeads[allIdx] = normalized;
      this.touchLeads();
    } else if (ev.type === 'LEAD_DELETED' && ev.id) {
      this.leads = this.leads.filter(l => l._id !== ev.id);
      this.allLeads = this.allLeads.filter(l => l._id !== ev.id);
      this.touchLeads();
    } else if (ev.type === 'BOOKMARK_CREATED' && ev.bookmark) {
      if (!this.followups.find(b => b._id === ev.bookmark._id)) {
        this.followups.unshift(ev.bookmark);
      }
      this.touchFollowups();
    } else if (ev.type === 'BOOKMARK_UPDATED' && ev.bookmark) {
      const idx = this.followups.findIndex(b => b._id === ev.bookmark._id);
      if (idx !== -1) this.followups[idx] = ev.bookmark;
      this.touchFollowups();
    } else if (ev.type === 'BOOKMARK_DELETED' && ev.id) {
      this.followups = this.followups.filter(b => b._id !== ev.id);
      this.touchFollowups();
    }
  }

  loadDashboard(): void {
    this.fetchStats();
    this.fetchLeads();
    this.fetchFollowups();
    this.fetchCompanySettings();
    this.fetchBreakStatus();
  }

  switchTab(tab: 'overview' | 'leads' | 'followups' | 'interested' | 'dnp' | 'converted' | 'favourite' | 'today-calls' | 'invoices' | 'quotations'): void {
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

    if (tab === 'today-calls') {
      this.fetchTodayCalls();
    }
    if (tab === 'invoices') {
      this.fetchInvoiceRecords();
    }
    if (tab === 'quotations') {
      this.fetchQuotationRecords();
    }
    if (tab === 'overview') {
      this.fetchStats();
      this.fetchTimeline();
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
    this.api.get<any>(`/api/auth/company/${this.employee.companyCode}/settings`).subscribe({
      next: res => {
        if (res.success && res.settings) {
          if (res.settings.leadStatuses?.length) {
            this.LEAD_STATUSES = res.settings.leadStatuses;
          }
          if (res.settings.interestedPageStatuses?.length) {
            this.INTERESTED_PAGE_STATUSES = res.settings.interestedPageStatuses;
          }
          if (res.settings.dnpPageStatuses?.length) {
            this.DNP_PAGE_STATUSES = res.settings.dnpPageStatuses;
          }
          if (res.settings.convertedPageStatuses?.length) {
            this.CONVERTED_PAGE_STATUSES = res.settings.convertedPageStatuses;
          }
          this.breakHourLimitMin = res.settings.breakHourLimit ?? 60;
          
          this.companyName = res.settings.companyName || '';
          this.invoiceLogo = res.settings.invoiceLogo || '';
          this.showCompanyNameOnInvoice = res.settings.showCompanyNameOnInvoice ?? true;
          this.gstNumber = res.settings.gstNumber || '';
          this.gstPercentage = res.settings.gstPercentage ?? 18;
          this.invoiceRegisteredAddress = res.settings.invoiceRegisteredAddress || '';
          this.invoiceFooter = res.settings.invoiceFooter || '';
          this.bankDetails = res.settings.bankDetails;
          this.contactDetails = res.settings.contactDetails;
          this.products = res.settings.products || [];
          this.productRemarks = res.settings.productRemarks || [];
          this.fetchCompanyInvoiceProfile();
        }
      },
      error: () => {}
    });
  }

  fetchCompanyInvoiceProfile(): void {
    if (!this.employee?.companyCode) return;
    this.api.get<any>(`/api/auth/company/${this.employee.companyCode}`).subscribe({
      next: res => {
        if (res.success && res.company) {
          this.companyAddress = res.company.companyAddress || '';
          if (!this.companyName) this.companyName = res.company.companyName || '';
        }
      },
      error: () => {}
    });
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

  onPeriodChange(p: 'today' | 'yesterday' | 'lastweek'): void {
    this.selectedPeriod = p;
    this.fetchStats();
  }

  // ── Call Stats ────────────────────────────────────────────────
  fetchStats(): void {
    if (!this.employee) return;
    this.statsLoading = true;
    const { companyCode, mobile } = this.employee;
    this.api.get<any>(
      `/api/calllogs/employee?companyCode=${companyCode}&phone=${mobile}&period=${this.selectedPeriod}`
    ).subscribe({
      next: res => {
        this.statsLoading = false;
        if (res.success) {
          this.callStats = res.stats;
          if (this.dashTab === 'overview') {
            setTimeout(() => this.renderDonutChart(), 100);
          }
        }
      },
      error: () => { this.statsLoading = false; }
    });
    this.fetchTimeline();
  }

  fetchTimeline(): void {
    if (!this.employee) return;
    const { companyCode, mobile } = this.employee;
    this.api.get<any>(
      `/api/calllogs/timeline?companyCode=${companyCode}&phone=${mobile}&period=${this.selectedPeriod}`
    ).subscribe({
      next: res => {
        if (res.success) {
          this.timelineData = res.timeline;
          if (this.dashTab === 'overview') {
            setTimeout(() => this.renderTimelineChart(), 150);
          }
        }
      }
    });
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
        grad.addColorStop(0, 'rgba(37, 99, 235, 0.1)');
        grad.addColorStop(1, 'rgba(37, 99, 235, 0)');
      }

      data = {
        labels: labels,
        datasets: [{
          label: 'Total Calls',
          data: totalCalls,
          borderColor: '#2563EB',
          backgroundColor: grad ?? 'rgba(37, 99, 235, 0.1)',
          fill: true,
          cubicInterpolationMode: 'monotone',
          tension: 0.42,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHitRadius: 18,
          pointBackgroundColor: '#2563EB',
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
      const colors = ['#22C55E', '#F59E0B', '#9CA3AF', '#EF4444'];

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
    const canvas = document.getElementById('empDonutChart') as HTMLCanvasElement;
    if (!canvas || !this.callStats) return;
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }

    const s = this.callStats;
    this.donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          data: [s.incoming, s.outgoing, s.missed, s.rejected],
          backgroundColor: ['#22C55E', '#F59E0B', '#9CA3AF', '#EF4444'],
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
  fetchLeads(): void {
    if (!this.employee) return;
    const runId = ++this.leadFetchRun;
    this.leadsLoading = true;
    const { companyCode, mobile } = this.employee;
    this.fetchLeadPage(companyCode, mobile, 1, runId, true);
  }

  private fetchLeadPage(companyCode: string, mobile: string, page: number, runId: number, replace: boolean): void {
    const params = new URLSearchParams({
      companyCode,
      phone: mobile,
      paginated: 'true',
      page: String(page),
      pageSize: String(this.leadPageSize),
      sort: 'sheetOrder_asc',
    });

    this.api.get<any>(`/api/leads/employee?${params.toString()}`)
      .subscribe({
        next: res => {
          if (runId !== this.leadFetchRun) return;
          if (res.success) {
            const pageLeads = (res.items || res.leads || []).map((l: any) => this.normalizeLead(l));
            if (Array.isArray(res.sets)) {
              this.serverLeadSets = res.sets;
            }
            this.allLeads = replace ? pageLeads : this.mergeLeadPages(this.allLeads, pageLeads);
            this.leads = [...this.allLeads];
            this.touchLeads();
            if (this.selectedLeadCompany) {
              this.syncAiForActiveView();
            }
            if (res.hasMore) {
              setTimeout(() => this.fetchLeadPage(companyCode, mobile, page + 1, runId, false), 0);
              return;
            }
          }
          this.leadsLoading = false;
        },
        error: () => {
          if (runId === this.leadFetchRun) {
            this.leadsLoading = false;
          }
        }
      });
  }

  private mergeLeadPages(existing: Lead[], incoming: Lead[]): Lead[] {
    if (!incoming.length) return existing;
    const byId = new Map(existing.map((lead) => [lead._id, lead]));
    for (const lead of incoming) {
      byId.set(lead._id, lead);
    }
    return Array.from(byId.values());
  }

  fetchTodayCalls(date?: string): void {
    if (!this.employee) return;
    this.todayCallsLoading = true;
    const { companyCode, mobile } = this.employee;
    const dateToUse = date || this.historyFilterDate;
    console.log('[TodayCalls] Fetching for:', mobile, 'Date:', dateToUse);
    const params = `companyCode=${companyCode}&phone=${mobile}&from=${dateToUse}&to=${dateToUse}`;
    this.api.get<any>(`/api/calllogs/details?${params}`)
      .subscribe({
        next: res => {
          this.todayCallsLoading = false;
          console.log('[TodayCalls] Response:', res);
          if (res.success) {
            this.todayCalls = res.calls || [];
          }
        },
        error: (err) => { 
          this.todayCallsLoading = false; 
          console.error('[TodayCalls] Error:', err);
        }
      });
  }

  get todayCallSummary() {
    const total = this.todayCalls.length;
    const connected = this.todayCalls.filter(c => (c.duration || 0) > 0).length;
    return { total, connected };
  }

  get todayCallTypeCounts() {
    const counts: Record<string, number> = {};
    for (const call of this.todayCalls) {
      const type = call.callType || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  private getLeadCollections(): LeadCollections {
    const key = [
      this.leadStateVersion,
      this.leadSearch,
      this.selectedLeadSet,
      this.leadStatusFilter,
      this.selectedInterestedStatus,
      this.selectedDnpStatus,
      this.selectedConvertedStatus,
      this.selectedFavouriteStatus,
      this.todayFilterStatus,
      this.INTERESTED_PAGE_STATUSES.join('|'),
      this.DNP_PAGE_STATUSES.join('|'),
      this.CONVERTED_PAGE_STATUSES.join('|'),
    ].join('::');

    if (this.leadCollectionsCache?.key === key) {
      return this.leadCollectionsCache.value;
    }

    const todayLocal = new Date().toLocaleDateString();
    const filterDateLocal = new Date(this.historyFilterDate).toLocaleDateString();
    const search = this.leadSearch.trim();
    const selectedLeadSet = this.selectedLeadSet.trim();
    const matchesLeadWorkspaceFilter = (lead: Lead): boolean => {
      if (search && !this.matchLead(lead, search)) return false;
      if (selectedLeadSet && lead.setLabel !== selectedLeadSet) return false;
      return true;
    };

    const filteredLeads = this.allLeads.filter((lead) => {
      if (!matchesLeadWorkspaceFilter(lead)) return false;
      if (this.leadStatusFilter && lead.status !== this.leadStatusFilter) return false;
      return true;
    });

    const interestedLeads = search
      ? this.allLeads.filter((lead) => matchesLeadWorkspaceFilter(lead))
      : this.allLeads
          .filter((lead) => matchesLeadWorkspaceFilter(lead))
          .filter((lead) => this.INTERESTED_PAGE_STATUSES.includes(lead.status))
          .filter((lead) => this.selectedInterestedStatus === 'All' || lead.status === this.selectedInterestedStatus);

    const dnpLeads = search
      ? this.allLeads.filter((lead) => matchesLeadWorkspaceFilter(lead))
      : this.allLeads
          .filter((lead) => matchesLeadWorkspaceFilter(lead))
          .filter((lead) => this.DNP_PAGE_STATUSES.includes(lead.status))
          .filter((lead) => this.selectedDnpStatus === 'All' || lead.status === this.selectedDnpStatus);

    const convertedLeads = search
      ? this.allLeads.filter((lead) => matchesLeadWorkspaceFilter(lead))
      : this.allLeads
          .filter((lead) => matchesLeadWorkspaceFilter(lead))
          .filter((lead) => this.CONVERTED_PAGE_STATUSES.includes(lead.status))
          .filter((lead) => this.selectedConvertedStatus === 'All' || lead.status === this.selectedConvertedStatus);

    const favouriteLeads = search
      ? this.allLeads.filter((lead) => matchesLeadWorkspaceFilter(lead))
      : this.allLeads
          .filter((lead) => matchesLeadWorkspaceFilter(lead))
          .filter((lead) => !!lead.isFavourite)
          .filter((lead) => this.selectedFavouriteStatus === 'All' || lead.status === this.selectedFavouriteStatus);

    const rawTodayModifiedLeads = this.allLeads.filter(
      (lead) =>
        matchesLeadWorkspaceFilter(lead) &&
        !!lead.updatedAt &&
        new Date(lead.updatedAt).toLocaleDateString() === filterDateLocal,
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
      .slice(0, 8);

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
        .filter((bookmark) => !!bookmark.reminderDate)
        .sort((a, b) => this.toDateStamp(a.reminderDate || a.createdAt) - this.toDateStamp(b.reminderDate || b.createdAt))
        .slice(0, 8),
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
      this.leadStatusFilter,
      this.selectedInterestedStatus,
      this.selectedDnpStatus,
      this.selectedConvertedStatus,
      this.selectedFavouriteStatus,
      this.todayFilterStatus,
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

    let activeLeadViewCompanies: string[] = [];
    let sourceRows: Lead[] = [];

    switch (this.dashTab) {
      case 'leads':
        activeLeadViewCompanies = leads.uniqueLeadCompanies;
        sourceRows = leads.filteredLeads;
        break;
      case 'interested':
        activeLeadViewCompanies = leads.uniqueInterestedCompanies;
        sourceRows = leads.interestedLeads;
        break;
      case 'dnp':
        activeLeadViewCompanies = leads.uniqueDnpCompanies;
        sourceRows = leads.dnpLeads;
        break;
      case 'converted':
        activeLeadViewCompanies = leads.uniqueConvertedCompanies;
        sourceRows = leads.convertedLeads;
        break;
      case 'favourite':
        activeLeadViewCompanies = leads.uniqueFavouriteCompanies;
        sourceRows = leads.favouriteLeads;
        break;
      case 'today-calls':
        activeLeadViewCompanies = leads.uniqueTodayModifiedCompanies;
        sourceRows = leads.todayModifiedLeads;
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
    this.selectedLeadCompany = ''; // Reset selection when filter changes
  }

  onHistoryDateChange(): void {
    this.selectedLeadCompany = '';
    this.fetchTodayCalls(this.historyFilterDate);
    this.touchLeads();
  }

  get todayStatusCounts(): { [key: string]: number } {
    return this.getLeadCollections().todayStatusCounts;
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
    this.api.patch<any>(`/api/leads/${lead._id}/status`, { status: newStatus })
      .subscribe({
        next: res => {
          this.updatingLeadId = '';
          if (res.success && res.lead) {
            const normalized = this.normalizeLead(res.lead);
            // Update in allLeads
            const allIdx = this.allLeads.findIndex(al => al._id === lead._id);
            if (allIdx !== -1) this.allLeads[allIdx] = normalized;
            // Also update the local reference used in loops
            Object.assign(lead, normalized);
            this.touchLeads();
          }
        },
        error: () => { this.updatingLeadId = ''; }
      });
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

  // ── Follow-ups ────────────────────────────────────────────────
  fetchFollowups(): void {
    if (!this.employee) return;
    this.followupsLoading = true;
    const { companyCode, phone } = { companyCode: this.employee.companyCode, phone: this.employee.mobile };
    this.api.get<any>(`/api/bookmarks?companyCode=${companyCode}&phone=${phone}`)
      .subscribe({
        next: res => {
          this.followupsLoading = false;
          if (res.success) {
            this.followups = res.bookmarks || [];
            this.touchFollowups();
          }
        },
        error: () => { this.followupsLoading = false; }
      });
  }

  get overviewRecentLeads(): Lead[] {
    return this.getLeadCollections().overviewRecentLeads;
  }

  get overviewUpcomingFollowups(): Bookmark[] {
    return this.getFollowupCollections().overviewUpcomingFollowups;
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
        return 'Favourite';
      case 'today-calls':
        return 'Today History';
      case 'invoices':
        return 'Invoices';
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
        return 'Create invoices for converted leads and review saved invoice history.';
      case 'quotations':
        return 'Create quotations for leads and review saved quotation history.';
      default:
        return '';
    }
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

import { Directive, OnInit } from '@angular/core';
import { Chart, ChartType, registerables } from 'chart.js';
import { RegisterPayload, LoginPayload } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { Employee } from '../../../services/employee.service';
import { CallLogService, CallStats } from '../../../services/calllog.service';
import { LeadService, Lead } from '../../../services/lead.service';
import { Bookmark } from '../../../services/bookmark.service';
import { AiBrief, AiBriefService } from '../../../services/ai-brief.service';
import { CrmAmcRow, CrmClient, CrmHostingerDomain, CrmProjectRow, CrmService } from '../../../services/crm.service';
import { CrmTicket, TicketService } from '../../../services/ticket.service';
import { AdminPageId } from '../../../core/layout/admin-pages';
import { DashboardCacheService } from '../../../core/cache/dashboard-cache.service';
import * as XLSX from 'xlsx';
import { ADMIN_INDUSTRIES, LANDING_TESTIMONIALS } from '../../auth/presentation/landing-content';
import { AdminAuthPaymentWorkflow } from '../../auth/presentation/admin-auth-payment.workflow';
import { AdminEmployeesWorkflow } from '../../employees/presentation/admin-employees.workflow';
import { AdminFollowupsWorkflow } from '../../follow-ups/presentation/admin-followups.workflow';
import { AdminLeadsWorkflow } from '../../leads/presentation/admin-leads.workflow';
import { COUNTRY_CODES } from '../../../shared/constants/country-codes';
import {
  ADMIN_LEAD_STATUSES,
  leadStatusClass,
  leadStatusColor as leadStatusColorValue,
  leadStatusShortLabel as leadStatusShortLabelValue,
  normalizedLeadStatus as normalizedLeadStatusValue,
} from '../../leads/domain/lead-status-ui';
import { AdminInvoiceQuotationWorkflow } from '../../invoices/presentation/admin-invoice-quotation.workflow';
import { AdminSettingsWorkflow } from '../../settings/presentation/admin-settings.workflow';
import { OPERATIONAL_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../../core/config/pagination.config';
import {
  CALL_TYPE_OPTIONS,
  DASHBOARD_PALETTE,
  DASHBOARD_PERIODS,
  DURATION_OPTIONS,
  TIME_OPTIONS,
  dashboardPeriodLabel,
  formatAverageDuration,
  formatDuration,
  formatIndianDateTime,
  formatIndianTime,
  formatShortDuration,
} from '../../reports/domain/call-formatters';

interface QuotationBankRow {
  label: string;
  value: string;
}

const DEFAULT_QUOTATION_KIND_NOTE = 'We aim to provide the best software to automate your business with high quality at affordable cost.';
const DEFAULT_QUOTATION_TERMS = [
  'All rates quoted are valid for 14 days.',
  '40% payment should be done in advance.',
  'The remaining amount should be paid within 7 days of invoice.',
];

@Directive()
export abstract class AdminWorkspaceController implements OnInit {
  readonly self = this;

  currentPage: 'home' | 'pricing' = 'home';
  isNavbarScrolled = false;
  showSplash = true;
  onWindowScroll() {
    this.isNavbarScrolled = window.scrollY > 20;
  }

  setPage(page: 'home' | 'pricing') {
    this.currentPage = page;
    this.isMobileMenuOpen = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  scrollToSection(sectionId: string, page: 'home' | 'pricing' = 'home') {
    if (this.currentPage !== page) {
      this.setPage(page);
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    this.isMobileMenuOpen = false;
  }

  goHome() {
    if (this.loggedIn) {
      this.loggedIn = false;
    }
    this.setPage('home');
  }

  // ── Signup / Login ─────────────────────────────────────────
  signupForm: RegisterPayload = {
    companyName: '', companyAddress: '', name: '', email: '', password: '',
    countryCode: '+91', mobile: '', teamSize: '', industry: '',
  };
  signupError = '';
  signupSuccess = false;
  signupLoading = false;
  isTrialRequest = false;

  // ── Payment ────────────────────────────────────────────────
  paymentToDate = '';
  paymentCostPreview: { days: number; teamSizeMax: number; amountRupees: number } | null = null;
  paymentCostLoading = false;
  paymentStep: 'idle' | 'paying' | 'done' = 'idle';
  pendingCompanyCode = '';
  paymentHistory: any[] = [];
  paymentHistoryLoading = false;
  renewToDate = '';
  renewCostPreview: { days: number; teamSizeMax: number; amountRupees: number } | null = null;
  renewLoading = false;

  razorpayKeyId = '';

  get minToDate(): string { return this.authPaymentWorkflow.minToDate(this); }

  get subscriptionExpired(): boolean { return this.authPaymentWorkflow.subscriptionExpired(this); }

  /** Days left until subscription ends. Negative = already expired. null = no sub date or still on trial. */
  get subscriptionDaysLeft(): number | null { return this.authPaymentWorkflow.subscriptionDaysLeft(this); }

  // Spotlight Effect
  dashMouseX = 50;
  dashMouseY = 50;
  isDashHovered = false;

  onHeroMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.dashMouseX = ((event.clientX - rect.left) / rect.width) * 100;
    this.dashMouseY = ((event.clientY - rect.top) / rect.height) * 100;
  }

  // --- Testimonials Slider Logic ---
  currentTestimonialIndex = 0;
  testimonials = LANDING_TESTIMONIALS;

  nextTestimonial(): void {
    this.currentTestimonialIndex = (this.currentTestimonialIndex + 1) % this.testimonials.length;
  }

  prevTestimonial(): void {
    this.currentTestimonialIndex = (this.currentTestimonialIndex - 1 + this.testimonials.length) % this.testimonials.length;
  }

  touchStartX = 0;
  touchEndX = 0;

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipeGesture();
  }

  handleSwipeGesture(): void {
    const swipeThreshold = 50;
    if (this.touchEndX < this.touchStartX - swipeThreshold) {
      this.nextTestimonial();
    } else if (this.touchEndX > this.touchStartX + swipeThreshold) {
      this.prevTestimonial();
    }
  }

  /** Show the due-end alert if ≤7 days remaining (including expired) */
  get showDueAlert(): boolean { return this.authPaymentWorkflow.showDueAlert(this); }

  openTrialSignup(): void { this.authPaymentWorkflow.openTrialSignup(this); }

  loginForm: LoginPayload = { email: '', password: '' };
  loginError = '';
  loginLoading = false;

  pwdChecks = { length: false, upper: false, number: false, symbol: false };

  readonly INDUSTRIES = ADMIN_INDUSTRIES;

  // ── Dashboard session ──────────────────────────────────────
  loggedIn = false;
  userRole: 'admin' | 'crm_admin' | 'project_manager' = 'admin';
  dashboardCompany = '';
  dashboardCode = '';
  dashboardTeamSize = 0;

  // ── UI panels ──────────────────────────────────────────────
  isMobileMenuOpen = false;
  isLoginOpen = false;
  isSignupOpen = false;
  isForgotPwdOpen = false;
  isResetPwdOpen = false;

  forgotEmail = '';
  forgotLoading = false;
  forgotError = '';
  forgotSuccess = '';

  resetTokenValue = '';
  resetNewPassword = '';
  resetConfirmPassword = '';
  resetLoading = false;
  resetError = '';
  resetSuccess = '';
  resetPwdChecks = { length: false, upper: false, number: false, symbol: false };

  // ── Dashboard tabs ─────────────────────────────────────────
  dashTab: AdminPageId = 'overview';
  sidebarFeatureSearch = '';
  showShareModal = false;
  shareMessage = '';
  isLogoutConfirmOpen = false;
  employeeSearchQuery = '';

  // ── Follow-ups Filters ─────────────────────────────────────
  followupSelectedEmps: string[] = [];
  followupSelectedCompanyTags: string[] = [];
  followupSearchQuery: string = '';
  followupEmpLocalSearch: string = '';
  followupTagLocalSearch: string = '';

  getFilteredEmployeesLocal(): Employee[] { return this.adminFollowupsWorkflow.getFilteredEmployeesLocal(this); }

  getFilteredTagsLocal(): string[] { return this.adminFollowupsWorkflow.getFilteredTagsLocal(this); }

  toggleFollowupCompanyTag(tag: string): void { return this.adminFollowupsWorkflow.toggleFollowupCompanyTag(this, tag); }

  isFollowupCompanyTagSelected(tag: string): boolean { return this.adminFollowupsWorkflow.isFollowupCompanyTagSelected(this, tag); }

  toggleFollowupEmp(phone: string): void { return this.adminFollowupsWorkflow.toggleFollowupEmp(this, phone); }

  isFollowupEmpSelected(phone: string): boolean { return this.adminFollowupsWorkflow.isFollowupEmpSelected(this, phone); }

  get filteredEmployeesForTable(): Employee[] { return this.adminEmployeesWorkflow.filteredEmployeesForTable(this); }

  readonly LEAD_STATUSES = ADMIN_LEAD_STATUSES;
  updatingLeadId: string | null = null;
  leadRemarksInputs: { [key: string]: string } = {};
  remarkPostingIds = new Set<string>();
  adminRemarkMenuOpenKey = '';
  private adminRemarkMenuCloseTimer: ReturnType<typeof setTimeout> | null = null;
  adminLeadStatusFilter = '';
  remarkLeads: any[] = [];
  remarkLeadsLoading: boolean = false;
  remarkLeadCompanies: Array<{ name: string; count: number }> = [];
  remarkLeadCompanyPage = 1;
  remarkLeadCompanyHasMore = false;
  remarkLeadCompanyTotal = 0;
  remarkLeadCompaniesLoading = false;
  remarkLeadContactsPage = 1;
  remarkLeadContactsHasMore = false;
  remarkLeadContactsLoadingMore = false;

  selectedEmpFollowupCompany: string = '';

  // ── History Modal ─────────────────────────────────────────────
  showHistoryModal = false;
  historyLogs: any[] = [];
  historyLoading = false;
  historyLead: Lead | null = null;
  adminCompanyFullSection: 'overview' | 'contacts' | 'followups' | 'remarks' | 'invoices' | 'quotations' | 'notes' = 'overview';

  openHistory(lead: Lead): void {
    if (!this.dashboardCode || !lead.contactNumber) return;
    this.showHistoryModal = true;
    this.updateScrollLock();
    this.loadLeadHistoryLogs(lead);
  }

  openAdminCompanyFullHistory(lead: Lead): void {
    if (!this.dashboardCode || !lead.contactNumber) return;
    this.adminCompanyFullSection = 'remarks';
    this.showHistoryModal = false;
    this.loadLeadHistoryLogs(lead);
  }

  private loadLeadHistoryLogs(lead: Lead): void {
    this.historyLead = lead;
    this.historyLogs = [];
    this.historyLoading = true;
    this.leadService.getLeadHistory(lead.companyCode, lead.leadCompanyName).subscribe({
      next: res => {
        this.historyLoading = false;
        if (res.success) {
          this.historyLogs = res.logs;

          const companyLeads = this.allLeads.filter(l => l.companyCode === lead.companyCode && l.leadCompanyName === lead.leadCompanyName);

          companyLeads.forEach((cL: Lead) => {
            // 1. Fallback for "Lead Created" for each director
            const hasCreated = this.historyLogs.some(l => 
              l.action.toLowerCase().includes('created') && 
              l.contactNumber === cL.contactNumber
            );
            if (!hasCreated && cL.createdAt) {
              this.historyLogs.push({
                action: 'Lead Created',
                contactNumber: cL.contactNumber,
                contactName: cL.contactName,
                createdAt: cL.createdAt,
                changedBy: 'System (Legacy)',
                newValue: cL.status || 'New'
              });
            }

            // 2. Fallback for legacy Remarks for each director
            if (cL.remarks && Array.isArray(cL.remarks)) {
              const loggedRemarks = new Set(
                this.historyLogs
                  .filter(l => l.action === 'Remark Added' && l.contactNumber === cL.contactNumber)
                  .map(l => l.newValue)
              );

              cL.remarks.forEach((rem: string) => {
                if (rem && !loggedRemarks.has(rem)) {
                  this.historyLogs.push({
                    action: 'Legacy Remark',
                    contactNumber: cL.contactNumber,
                    contactName: cL.contactName,
                    createdAt: cL.createdAt,
                    changedBy: 'System (Legacy)',
                    metadata: { remark: rem }
                  });
                }
              });
            }
          });

          // 3. Final Sort
          this.historyLogs.sort((a, b) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime());
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
    this.updateScrollLock();
  }

  selectedEmpBookmarksDepsStr = '';
  lastAllBookmarksRefForEmp: any[] | null = null;
  selectedEmpBookmarksCache: Bookmark[] = [];

  get selectedEmpBookmarks(): Bookmark[] { return this.adminEmployeesWorkflow.selectedEmpBookmarks(this); }

  selectedEmpBookmarksFilteredDepsStr = '';
  lastSelectedEmpBookmarksRefForFiltered: any[] | null = null;
  selectedEmpBookmarksFilteredCache: Bookmark[] = [];

  get selectedEmpBookmarksFiltered(): Bookmark[] { return this.adminEmployeesWorkflow.selectedEmpBookmarksFiltered(this); }

  selectedEmpBookmarksByCompanyDepsStr = '';
  lastSelectedEmpBookmarksFilteredRef: any[] | null = null;
  selectedEmpBookmarksByCompanyCache: Bookmark[] = [];

  get selectedEmpBookmarksByCompany(): Bookmark[] { return this.adminEmployeesWorkflow.selectedEmpBookmarksByCompany(this); }

  get todayFollowupCount(): number { return this.adminFollowupsWorkflow.todayFollowupCount(this); }

  get todayGlobalFollowupCount(): number { return this.adminFollowupsWorkflow.todayGlobalFollowupCount(this); }

  groupedEmpBookmarksCache: { company: string, count: number }[] = [];
  lastGroupedEmpBookmarksRef: any[] | null = null;

  get groupedEmpBookmarks(): { company: string, count: number }[] { return this.adminEmployeesWorkflow.groupedEmpBookmarks(this); }

  private ensureSelectedEmpFollowupCompany(): void { return this.adminEmployeesWorkflow.ensureSelectedEmpFollowupCompany(this); }

  leadMapCache: { [phone: string]: Lead } | null = null;
  lastAllLeadsRef: any[] | null = null;

  getLeadByPhone(phone: string): Lead | undefined {
    if (this.lastAllLeadsRef !== this.allLeads) {
      this.leadMapCache = {};
      for (const l of this.allLeads) {
        if (l.contactNumber) {
          this.leadMapCache[String(l.contactNumber).trim()] = l;
        }
      }
      this.lastAllLeadsRef = this.allLeads;
    }
    return this.leadMapCache![String(phone || '').trim()];
  }

    private resetAdminLeadDerivedCaches(): void { return this.adminLeadsWorkflow.resetAdminLeadDerivedCaches(this); }

    updateLeadStatus(lead: Lead, status: string): void { return this.adminLeadsWorkflow.updateLeadStatus(this, lead, status); }

  getLeadStatusClass(status: string): string {
    return leadStatusClass(status);
  }

  leadStatusShortLabel(status: string): string {
    return leadStatusShortLabelValue(status);
  }

  private findLeadRecordForAdminBookmark(bookmark: Bookmark | null | undefined): Lead | undefined {
    if (!bookmark) return undefined;
    const bookmarkPhone = String(bookmark.contactNumber || '').trim();
    const bookmarkCompany = String(bookmark.companyName || '').trim();
    const sameCompanyLead = bookmarkPhone ? this.allLeads.find((lead) => (
      String(lead.contactNumber || '').trim() === bookmarkPhone &&
      String(lead.leadCompanyName || '').trim() === bookmarkCompany
    )) : undefined;
    const phoneLead = bookmarkPhone ? this.getLeadByPhone(bookmarkPhone) : undefined;
    const matchedLead =
      sameCompanyLead ||
      (phoneLead && (!bookmarkCompany || String(phoneLead.leadCompanyName || '').trim() === bookmarkCompany) ? phoneLead : undefined);

    return matchedLead;
  }

  getMatchedLeadForAdminBookmark(bookmark: Bookmark | null | undefined): Lead | null { return this.adminFollowupsWorkflow.getMatchedLeadForAdminBookmark(this, bookmark); }

  followupDescriptionPreview(bookmark: Bookmark): string { return this.adminFollowupsWorkflow.followupDescriptionPreview(this, bookmark); }

  followupRemarkPreviewList(bookmark: Bookmark): string[] { return this.adminFollowupsWorkflow.followupRemarkPreviewList(this, bookmark); }

  openLeadFromAdminFollowup(bookmark: Bookmark): void { return this.adminFollowupsWorkflow.openLeadFromAdminFollowup(this, bookmark); }

  // Invoice Flow Support
  selectedEmployeeForInvoice: any = null;
  invoiceLead: any = null;
  invoiceRecords: any[] = [];
  invoiceRecordsLoading = false;
  invoiceRecordsLoadingMore = false;
  invoiceRecordsPage = 1;
  invoiceRecordsHasMore = false;
  invoiceRecordsTotal = 0;
  invoiceRecordsLoaded = false;
  invoiceSearch = '';
  adminInvoiceClients: any[] = [];
  adminInvoiceClientsLoading = false;
  adminInvoiceClientsLoadingMore = false;
  adminInvoiceClientsLoaded = false;
  adminInvoiceClientPage = 1;
  adminInvoiceClientHasMore = false;
  adminInvoiceClientTotal = 0;
  selectedInvoiceClient: any = null;
  clientOnboardingRecords: any[] = [];
  clientOnboardingSearch = '';
  clientOnboardingLoading = false;
  clientOnboardingLoadingMore = false;
  clientOnboardingLoaded = false;
  clientOnboardingPage = 1;
  clientOnboardingHasMore = false;
  clientOnboardingTotal = 0;
  selectedOnboardingClientId = '';
  clientOnboardingCreateOpen = false;
  clientOnboardingOpenMenuKey = '';
  clientOnboardingDraft = {
    companyName: '',
    primaryContactName: '',
    primaryPhone: '',
    primaryEmail: '',
    address: '',
  };
  clientOnboardingSaving = false;
  clientOnboardingError = '';
  clientOnboardingSuccess = '';
  invoiceHistorySearch = '';
  invoiceDateFilter: 'all' | 'today' | '7d' | '30d' = 'all';
  invoiceDateFilterOpen = false;
  invoiceDateFrom = '';
  invoiceDateTo = '';
  invoiceSavingLeadId = '';
  private invoiceSearchTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  showInvoiceModal = false;
  quoteMode = false;
  viewingSavedDocument = false;
  invoiceItems: Array<{ product: any; price: number; quantity: number; name: string }> = [];
  selectedInvoiceProduct: any = null;
  invoicePrice = 0;
  invoiceQuantity = 1;
  invoiceIssuedAt = new Date();
  quoteNumber = Math.floor(100000 + Math.random() * 900000);
  currentInvoiceNumber = '';
  currentInvoicePublicUrl = '';
  currentInvoiceQrDataUrl = '';
  invoicePaymentStatus: 'paid' | 'unpaid' = 'unpaid';
  currentQuotationNumber = '';
  quotationKindNoteDraft = DEFAULT_QUOTATION_KIND_NOTE;
  showGstSelectionModal = false;
  documentGstPercentageOverride: number | null = null;
  gstSelectionConfirmed = false;
  invoiceSaving = false;
  quotationSaving = false;
  quotationRecords: any[] = [];
  quotationRecordsLoading = false;
  quotationRecordsLoadingMore = false;
  quotationRecordsLoaded = false;
  quotationRecordsPage = 1;
  quotationRecordsHasMore = false;
  quotationRecordsTotal = 0;
  quotationSearch = '';
  quotationLeads: Lead[] = [];
  quotationLeadsLoading = false;
  quotationLeadsLoadingMore = false;
  quotationLeadsLoaded = false;
  quotationLeadsPage = 1;
  quotationLeadsHasMore = false;
  quotationLeadsTotal = 0;
  quotationClientsLoadingMore = false;
  quotationClientsLoaded = false;
  quotationClientPage = 1;
  quotationClientHasMore = false;
  quotationClientTotal = 0;
  quotationHistorySearch = '';
  quotationDateFilterOpen = false;
  quotationDateFrom = '';
  quotationDateTo = '';
  private quotationSearchTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  private clientOnboardingSearchTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  readonly currentYear = new Date().getFullYear();
  readonly quotationTerms = DEFAULT_QUOTATION_TERMS;
  companyFullViewOpen = false;
  companyRemarkLead: Lead | null = null;
  adminAiSummaryOpen = false;
  aiBrief: AiBrief | null = null;
  aiBriefLoading = false;
  aiBriefError = '';
  aiBriefCacheStatus: 'hit' | 'miss' | '' = '';
  aiBriefCompany = '';
  aiBriefLeadId = '';
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


  filteredBookmarksDepsStr = '';
  lastAllBookmarksRefForFiltered: any[] | null = null;
  filteredBookmarksCache: Bookmark[] = [];

  get filteredBookmarks(): Bookmark[] { return this.adminFollowupsWorkflow.filteredBookmarks(this); }

  filteredBookmarksFilteredDepsStr = '';
  lastFilteredBookmarksRefForFiltered: any[] | null = null;
  filteredBookmarksFilteredCache: Bookmark[] = [];

  get filteredBookmarksFiltered(): Bookmark[] { return this.adminFollowupsWorkflow.filteredBookmarksFiltered(this); }

  lastFilteredBookmarksFilteredRefForGrouped: any[] | null = null;
  groupedAllBookmarksCache: { company: string, count: number }[] = [];

  get groupedAllBookmarks(): { company: string, count: number }[] { return this.adminFollowupsWorkflow.groupedAllBookmarks(this); }

  filteredBookmarksByGlobalCompanyDepsStr = '';
  lastFilteredBookmarksFilteredRefForGlobal: any[] | null = null;
  filteredBookmarksByGlobalCompanyCache: Bookmark[] = [];

  get filteredBookmarksByGlobalCompany(): Bookmark[] { return this.adminFollowupsWorkflow.filteredBookmarksByGlobalCompany(this); }

  selectGlobalFollowupCompany(company: string): void { return this.adminFollowupsWorkflow.selectGlobalFollowupCompany(this, company); }

  private ensureAdminFollowupLeadHydration(company: string): void { return this.adminFollowupsWorkflow.ensureAdminFollowupLeadHydration(this, company); }

  followupLastInteraction(bookmark: Bookmark): string { return this.adminFollowupsWorkflow.followupLastInteraction(this, bookmark); }

  followupCompanyPreviewLine(company: string): string { return this.adminFollowupsWorkflow.followupCompanyPreviewLine(this, company); }

  // ── Support & RM ───────────────────────────────────────────
  rmRequestLoading = false;
  rmRequestMessage = '';

  adminRm = {
    name: '',
    phone: '',
    email: '',
    workingDays: '',
    workingHours: ''
  };
  adminRmLoading = false;
  rmCountdown = '';

  openLogin(): void { this.authPaymentWorkflow.openLogin(this); }

  // --- Follow-up Edit Modal Logic (Mirroring Emp UI) ---
  showFollowupModal = false;
  editingBookmarkId: string | null = null;
  followupLead: any = null;
  followupSaving = false;
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

  openEditFollowupModal(bookmark: any): void { return this.adminFollowupsWorkflow.openEditFollowupModal(this, bookmark); }

  openFollowupModal(lead: Lead): void { return this.adminFollowupsWorkflow.openFollowupModal(this, lead); }

  closeFollowupModal(): void { return this.adminFollowupsWorkflow.closeFollowupModal(this); }

  removeRemark(index: number): void { return this.adminFollowupsWorkflow.removeRemark(this, index); }

  trackByFn(index: number, item: any) {
    return index;
  }

  async saveFollowup(): Promise<void> { return this.adminFollowupsWorkflow.saveFollowup(this); }


  openSignup(): void { this.authPaymentWorkflow.openSignup(this); }

  openForgotPwd(): void { this.authPaymentWorkflow.openForgotPwd(this); }

  openForgotFromSettings(): void { this.authPaymentWorkflow.openForgotFromSettings(this); }

  closeModals(): void {
    this.isLoginOpen = false;
    this.isSignupOpen = false;
    this.isMobileMenuOpen = false;
    this.isForgotPwdOpen = false;
    this.isResetPwdOpen = false;
    this.showShareModal = false;
    this.isAddEmployeeOpen = false;
    this.isEditEmployeeOpen = false;
    this.showAllCallsModal = false;
    this.isLogoutConfirmOpen = false;
    this.updateScrollLock();
  }

  updateScrollLock(): void {
    const isAnyModalOpen = this.isLoginOpen || this.isSignupOpen || this.isForgotPwdOpen || this.isResetPwdOpen || this.isAddEmployeeOpen || this.isEditEmployeeOpen || this.showAllCallsModal || this.isLogoutConfirmOpen || this.showFollowupModal;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
  private rmTimerInterval: any;

  get canRequestRm(): boolean { return this.adminSettingsWorkflow.canRequestRm(this); }

  // ── Advanced Filters ──────────────────────────────────────
  filterTags = '';
  filterEmployees = '';
  filterCallType = '';
  filterDuration = '';
  filterCallTime = '';
  excludePhoneNumbers = false;

  tagOptions = ['Sales', 'Support', 'Admin', 'Marketing'];
  callTypeOptions = CALL_TYPE_OPTIONS;
  durationOptions = DURATION_OPTIONS;
  timeOptions = TIME_OPTIONS;

  // ── Period selector ────────────────────────────────────────
  selectedPeriod: 'today' | 'yesterday' | 'lastweek' | 'custom' = 'today';
  customFrom = new Date().toISOString().split('T')[0];
  customTo = new Date().toISOString().split('T')[0];
  readonly periods = DASHBOARD_PERIODS;
  get todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ── Stats ──────────────────────────────────────────────────
  summaryStats: CallStats | null = null;
  summaryLoading = false;

  // ── Tag Management ──────────────────────────────────────────
  newTagInput = '';
  tagManagementLoading = false;
  tagManagementError = '';
  tagManagementSuccess = '';

  // ── App Settings (new Settings page) ─────────────────────────
  settingsBreakHourLimit: number = 60;
  settingsConnectedCallDuration: number = 0;
  settingsLeadStatuses: string[] = [];
  settingsInterestedPageStatuses: string[] = [];
  settingsDnpPageStatuses: string[] = [];
  settingsConvertedPageStatuses: string[] = [];
  newLeadStatusInput: string = '';
  settingsLoading = false;
  settingsSaveError = '';
  settingsSaveSuccess = '';
  settingsCompanyName: string = '';
  settingsInvoiceLogo: string = '';
  settingsInvoiceSeal: string = '';
  settingsInvoiceTerms: string = '';
  currentInvoiceRecord: any = null;
  settingsShowCompanyNameOnInvoice: boolean = true;
  settingsGstNumber: string = '';
  settingsGstPercentage: number = 18;
  settingsInvoiceRegisteredAddress: string = '';
  settingsInvoiceFooter: string = '';
  settingsBankDetails = {
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
  };
  settingsContactDetails = {
    website: '',
    email: '',
    phone: '',
  };
  settingsProducts: Array<{ name: string, minPrice: number, maxPrice: number, tags?: string[] }> = [];
  newProductInput = { name: '', minPrice: 0, maxPrice: 0, tags: [] as string[] };
  productTagDropdownOpenKey = '';
  settingsProductRemarks: string[] = [];
  newProductRemarkInput: string = '';

  // ── Break Notifications (admin) ───────────────────────────────
  breakOverLimitEmps: { employeePhone: string; employeeName: string; totalSeconds: number; limitSeconds: number }[] = [];
  breakNotifCount = 0;
  showBreakNotifPanel = false;
  private breakPollInterval: any;

  profileMenuOpen = false;
  readonly profilePhotoMaxFileSizeMb = 5;
  adminProfilePhoto = '';
  profilePhotoError = '';
  profilePhotoSuccess = '';

  // ── Employee list ──────────────────────────────────────────
  employees: Employee[] = [];
  employeesLoading = false;
  employeesError = '';
  isAddEmployeeOpen = false;
  addEmployeeLoading = false;
  addEmployeeError = '';
  newEmployee = { name: '', mobile: '', countryCode: '+91' };
  countryCodes = COUNTRY_CODES;

  isEditEmployeeOpen = false;
  editEmployeeLoading = false;
  editEmployeeError = '';
  editingEmployee: any = { _id: '', name: '', mobile: '', tags: [] };

  employeeCallRows: { emp: Employee; stats: any }[] = [];
  empCallLoading = false;
  empCallError = '';
  syncAllLoading = false;
  syncEmpLoading = false;
  sidebarOpen = false;
  sidebarMinimized = false;

  // ── Employee drilldown ─────────────────────────────────────
  selectedEmployee: Employee | null = null;
  selectedEmpStats: CallStats | null = null;
  selectedEmpLoading = false;
  selectedEmpCalls: any[] = [];
  selectedEmpCallsLoading = false;
  drilldownTab: 'stats' | 'calls' | 'leads' | 'followups' = 'stats';
  followupFilter: 'all' | 'today' = 'all';
  selectedFollowupDate: string = '';
  followupSearch: string = '';
  selectedGlobalFollowupCompany: string = '';

  // ── Leads Management (Drilldown) ───────────────────────────
  empLeads: any[] = [];
  empLeadsLoading = false;
  empLeadSearchQuery = '';
  empLeadSetFilter = '';

  // Lead addition in dashboard
  showAddLeadForm = false;
  leadUploadStep: 'idle' | 'mapping' | 'uploading' = 'idle';
  parsedExcelData: any[] = [];
  excelHeaders: string[] = [];
  leadColumnMapping = { firstName: '', lastName: '', contactNumber: '', leadCompanyName: '', mainDivisionDescription: '', directorEmailAddress: '', remarks: '', companyDescription: '' };
  batchDefaultStatus = 'New';
  newSingleLead = { firstName: '', lastName: '', contactNumber: '', leadCompanyName: '', mainDivisionDescription: '', directorEmailAddress: '', remarks: '', status: 'New', companyDescription: '' };
  addLeadLoading = false;
  addLeadError = '';
  addLeadSuccess = '';
  leadImportRowErrors: string[] = [];

  // Follow-up addition (Interested Clients)
  followupUploadStep: 'idle' | 'mapping' | 'uploading' = 'idle';
  followupColumnMapping = { 
    firstName: '',
    lastName: '',
    contactNumber: '', 
    companyName: '', 
    description: '',
    remarks: '',
    reminderDate: '',
    proposalSent: '',
    meetingRemarks: ''
  };

  // Admin Leads Tab
  allLeads: any[] = [];
  allLeadsLoading = false;
  selectedAdminLead: any = null;
  selectedLeadCompany: string = '';
  selectedEmpLeadCompany: string = '';
  adminLeadSets: string[] = [];
  selectedAdminLeadSet: string = '';
  leadSearchQuery: string = '';
  leadEmployeeFilter: string = '';
  companyLimit = 20;
  adminLeadCompanies: Array<{ name: string; count: number }> = [];
  adminLeadCompanyPage = 1;
  adminLeadCompanyHasMore = false;
  adminLeadCompaniesLoading = false;
  adminLeadCompanyTotal = 0;
  adminLeadContactsPage = 1;
  adminLeadContactsHasMore = false;
  adminLeadContactsLoadingMore = false;
  crmFeatureOpen = true;
  adminFeatureOpen = true;
  isAdminSearching = false;
  crmClients: CrmClient[] = [];
  crmClientsLoading = false;
  crmClientSearch = '';
  isEditCrmClientOpen = false;
  editCrmClientLoading = false;
  editCrmClientError = '';
  editingCrmClient: any = { _id: '', companyName: '', primaryContactName: '', primaryPhone: '', primaryEmail: '', address: '', description: '' };
  selectedCrmClientCompany = '';
  crmContractView: 'generate' | 'history' = 'generate';
  crmContractsLoading = false;
  crmContracts: any[] = [];
  crmActionMessage = '';
  ndaWorkspaceOpen = false;
  ndaWorkspaceClient: CrmClient | null = null;
  ndaHistorySearch = '';
  ndaDateFilterOpen = false;
  ndaDateFrom = '';
  ndaDateTo = '';
  activeNdaClauseIndex = -1;
  activeNdaParagraphIndex = -1;
  ndaTemplateMode: 'generate' | 'builder' = 'generate';
  ndaTemplateLoading = false;
  ndaTemplateSaving = false;
  ndaSelectedPageIndex = 0;
  ndaDraggingType: 'placeholder' | 'paragraph' | 'highlight' | null = null;
  ndaDraggingIndex: number | null = null;
  ndaDragOffset = { x: 0, y: 0 };
  ndaTemplate: any = this.defaultNdaTemplate();
  ndaGenerationDraft = {
    clientAddress: '',
    effectiveFrom: '',
    effectiveTo: '',
    projectName: '',
    projectDescription: '',
    jurisdiction: 'India',
    solicitationPeriod: 'one (1) year',
    validityPeriod: 'three (3) years',
    terminationNoticeDays: '30',
    noticeReceiptDays: 'five (5)',
    signatoryName: '',
    signatoryTitle: 'Authorized Signatory',
    clientSignatoryTitle: 'Authorized Signatory',
  };
  readonly ndaAvailableFonts = [
    { name: 'Times', value: 'Times-Roman' },
    { name: 'Helvetica', value: 'Helvetica' },
    { name: 'Courier New', value: 'Courier' },
    { name: 'Inter', value: "'Inter', sans-serif" },
    { name: 'Montserrat', value: "'Montserrat', sans-serif" },
    { name: 'Georgia', value: "Georgia, serif" },
  ];
  ndaAvailablePlaceholderKeys = [
    { key: 'companyName', label: 'Company Name' },
    { key: 'companyAddress', label: 'Company Address' },
    { key: 'companyEmail', label: 'Company Email' },
    { key: 'companyPhone', label: 'Company Phone' },
    { key: 'clientName', label: 'Client Name' },
    { key: 'clientCompanyName', label: 'Client Company Name' },
    { key: 'clientAddress', label: 'Client Address' },
    { key: 'clientEmail', label: 'Client Email' },
    { key: 'effectiveDate', label: 'Effective Date' },
    { key: 'expiryDate', label: 'Expiry Date' },
    { key: 'projectName', label: 'Project Name' },
    { key: 'projectDescription', label: 'Service Description' },
    { key: 'jurisdiction', label: 'Jurisdiction' },
    { key: 'solicitationPeriod', label: 'Solicitation Period' },
    { key: 'validityPeriod', label: 'Validity Period' },
    { key: 'terminationNoticeDays', label: 'Termination Notice' },
    { key: 'noticeReceiptDays', label: 'Notice Receipt Days' },
    { key: 'signatoryName', label: 'Authorized Signatory' },
    { key: 'signatoryTitle', label: 'Signatory Title' },
    { key: 'clientSignatoryTitle', label: 'Client Signatory Title' },
    { key: 'companySignature', label: 'Company Signature Text' },
    { key: 'clientSignature', label: 'Client Signature Text' },
    { key: 'todayDate', label: 'Current Date' },
  ];
  readonly ndaParaPlaceholderHint = 'Type NDA content. Use Insert Placeholder to add fields like {{clientCompanyName}}.';
  crmAmcRows: CrmAmcRow[] = [];
  crmAmcLoading = false;
  crmAmcView: 'all' | 'paid' | 'unpaid' | 'upcoming' | 'blocked' = 'all';
  crmHostingerImportLoading = false;
  crmHostingerMappingOpen = false;
  crmHostingerDomainsLoading = false;
  crmHostingerDomains: CrmHostingerDomain[] = [];
  crmHostingerMappingDrafts: Record<string, { clientId: string; clientCompanyName: string; annualFee: number; owner: string }> = {};
  crmMappingDomainSearch = '';
  crmMappingClientSearch = '';
  selectedCrmHostingerDomainName = '';
  selectedCrmMappingClientId = '';
  selectedCrmMappingClientCompany = '';
  crmMappingAnnualFee = 0;
  crmMappingOwner = '';
  crmAmcOpenMenuKey = '';
  crmAmcAnalytics: { paid: number; unpaid: number; upcoming: number; blocked: number } | null = null;
  crmPaymentRows: any[] = [];
  crmPaymentsLoading = false;
  crmPaymentAnalytics: any = null;
  crmPaymentSearch = '';
  crmPaidInvoiceAmount = 0;
  crmTicketRows: CrmTicket[] = [];
  crmTicketsLoading = false;
  crmTicketSearch = '';
  crmTicketStatusFilter: 'all' | 'Open' | 'In Progress' | 'Waiting on Client' | 'Resolved' | 'Closed' = 'all';
  crmTicketPriorityFilter: 'all' | 'Low' | 'Medium' | 'High' | 'Critical' = 'all';
  crmTicketCategoryFilter: 'all' | 'Bug' | 'Feature Request' | 'Billing' | 'Support' | 'Change Request' = 'all';
  selectedCrmTicketId = '';
  crmTicketRemarkDraft = '';
  crmProjectRows: CrmProjectRow[] = [];
  crmProjectsLoading = false;
  crmProjectSearch = '';
  crmProjectStatusFilter: 'all' | 'Assigned' | 'In Progress' | 'On Hold' | 'Completed' = 'all';
  crmProjectOpenMenuKey = '';
  crmProjectMappingOpen = false;
  crmProjectClientSearch = '';
  crmProjectManagerSearch = '';
  selectedCrmProjectClientId = '';
  selectedCrmProjectClientCompany = '';
  selectedCrmProjectManagerKey = '';
  crmProjectDraft = {
    clientId: '',
    clientCompanyName: '',
    projectManagerName: '',
    projectManagerPhone: '',
    projectManagerEmail: '',
    status: 'Assigned',
    notes: '',
  };
  private readonly adminDashboardCacheTtlMs = 24 * 60 * 60 * 1000;
  private readonly adminDashboardRefreshAfterMs = 5 * 60 * 1000;
  private readonly adminLeadCompanyCachePrefix = 'admin-lead-companies|';
  private readonly adminLeadContactCachePrefix = 'admin-lead-contacts|';
  private readonly adminLeadSetsCachePrefix = 'admin-lead-sets|';
  readonly adminInvoiceHistoryCachePrefix = 'admin-invoice-history|';
  readonly adminInvoiceClientCachePrefix = 'admin-invoice-clients|';
  readonly adminQuotationHistoryCachePrefix = 'admin-quotation-history|';
  readonly adminQuotationLeadCachePrefix = 'admin-quotation-leads|';
  readonly adminQuotationClientCachePrefix = 'admin-quotation-clients|';
  readonly adminClientOnboardingCachePrefix = 'admin-client-onboarding|';
  readonly remarkLeadCompanyCachePrefix = 'admin-remark-lead-companies|';
  readonly remarkLeadContactCachePrefix = 'admin-remark-lead-contacts|';
  private readonly adminLeadHydrationConcurrency = 12;
  private adminLeadRequestRun = 0;
  private adminLeadSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private remarkLeadRequestRun = 0;
  private remarkFilterSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private adminGlobalSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private adminGlobalSearchSettleTimer: ReturnType<typeof setInterval> | null = null;

  // Bookmarks (Follow-up)
  allBookmarks: Bookmark[] = [];
  allBookmarksLoading = false;
  adminFollowupCompanies: Array<{ company: string; count: number }> = [];
  adminFollowupCompanyPage = 1;
  adminFollowupCompanyHasMore = false;
  adminFollowupCompanyTotal = 0;
  adminFollowupCompaniesLoading = false;
  private readonly adminFollowupCompanyCachePrefix = 'admin-followup-companies|';
  private adminFollowupRequestRun = 0;
  private adminFollowupLeadHydrationKeys = new Set<string>();
  private adminFollowupLeadHydrationLoadingKeys = new Set<string>();
  private followupSearchTimer: ReturnType<typeof setTimeout> | null = null;
  leadCallCounts: { [number: string]: number } = {};
  showAllRemarksModal: boolean = false;
  selectedBookmarkForRemarks: any = null;
  // Set label (batch grouping)
  leadSets: string[] = [];           // Available set labels for this employee
  selectedLeadSet = '';              // Currently viewed set filter ('' = all)
  newLeadSetLabel = '';              // User types a label before uploading
  deleteSetLoading = false;
  empLeadCompanies: Array<{ name: string; count: number }> = [];
  empLeadCompanyPage = 1;
  empLeadCompanyHasMore = false;
  empLeadCompanyTotal = 0;
  empLeadCompaniesLoading = false;
  empLeadContactsPage = 1;
  empLeadContactsHasMore = false;
  empLeadContactsLoadingMore = false;
  private empLeadRequestRun = 0;
  private empLeadSearchTimer: ReturnType<typeof setTimeout> | null = null;
  readonly empLeadSetCachePrefix = 'admin-employee-lead-sets|';
  readonly empLeadCompanyCachePrefix = 'admin-employee-lead-companies|';
  readonly empLeadContactCachePrefix = 'admin-employee-lead-contacts|';
  empFollowupBookmarks: Bookmark[] = [];
  empFollowupsLoading = false;
  empFollowupLoadingMore = false;
  empFollowupPage = 1;
  empFollowupHasMore = false;
  empFollowupTotal = 0;
  private empFollowupSearchTimer: ReturnType<typeof setTimeout> | null = null;
  readonly empFollowupCachePrefix = 'admin-employee-followups|';

  // ── Chart state ────────────────────────────────────────────
  chartType: 'line' | 'pie' | 'bar' = 'line';
  employeeChartType: 'line' | 'bar' = 'line';
  chart: Chart | null = null;
  private employeeChartRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private employeeDonutRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private overviewTimelineRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private overviewDonutRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxChartRetryAttempts = 8;

  overviewChartType: 'pie' | 'bar' = 'pie';
  overviewChart: Chart | null = null;
  adminStatsView: 'overview' | 'bars' | 'grid' = 'overview';
  timelineChart: Chart | null = null;
  donutChart: Chart | null = null;
  timelineData: any[] = [];
  readonly dashboardPalette = DASHBOARD_PALETTE;

  // ── Preloaded Data Caches ───────────────────────────────────
  preloadedCache: Record<string, { summary: any, timeline: any, employees: any, prevSummary: any, summaryLoaded: boolean, timelineLoaded: boolean, employeesLoaded: boolean, prevSummaryLoaded: boolean }> = {
    today: { summary: null, timeline: [], employees: [], prevSummary: null, summaryLoaded: false, timelineLoaded: false, employeesLoaded: false, prevSummaryLoaded: false },
    yesterday: { summary: null, timeline: [], employees: [], prevSummary: null, summaryLoaded: false, timelineLoaded: false, employeesLoaded: false, prevSummaryLoaded: false },
    lastweek: { summary: null, timeline: [], employees: [], prevSummary: null, summaryLoaded: false, timelineLoaded: false, employeesLoaded: false, prevSummaryLoaded: false }
  };

  // ── Company Profile ────────────────────────────────────────
  companyProfile: any = null;
  companyProfileLoading = false;

  changePwdForm = { oldPassword: '', newPassword: '', confirmPassword: '' };
  changePwdLoading = false;
  changePwdError = '';

  get filteredEmployeeCallRows(): any[] { return this.adminEmployeesWorkflow.filteredEmployeeCallRows(this); }
  changePwdSuccess = '';
  changePwdChecks = { length: false, upper: false, number: false, symbol: false };

  onResetPasswordInput(val: string): void {
    this.resetNewPassword = val;
    this.resetPwdChecks.length = val.length >= 8;
    this.resetPwdChecks.upper = /[A-Z]/.test(val);
    this.resetPwdChecks.number = /[0-9]/.test(val);
    this.resetPwdChecks.symbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val);
  }

  get isResetPasswordStrong(): boolean {
    return Object.values(this.resetPwdChecks).every(v => v === true);
  }

  editingAddress = false;
  editAddressValue = '';
  saveAddressLoading = false;
  saveAddressError = '';
  saveAddressSuccess = '';

  editingTeamSize = false;
  editTeamSizeValue = '';
  saveTeamSizeLoading = false;
  saveTeamSizeError = '';
  saveTeamSizeSuccess = '';

  // Employee Tagging Inline
  editTagEmpId: string | null = null;
  inlineTagValue: string = '';
  activeEmployeeCount: number = 0; // State for dashboard cards
  showInlineDropdown: string | null = null;
  savingTag = false;

  // View All Calls Modal
  showAllCallsModal = false;

  today = new Date();

  constructor(
    private callLogService: CallLogService,
    private leadService: LeadService,
    private aiBriefService: AiBriefService,
    private crmService: CrmService,
    private ticketService: TicketService,
    private api: ApiService,
    private dashboardCache: DashboardCacheService,
    protected authPaymentWorkflow: AdminAuthPaymentWorkflow,
    protected invoiceQuotationWorkflow: AdminInvoiceQuotationWorkflow,
    protected adminLeadsWorkflow: AdminLeadsWorkflow,
    protected adminFollowupsWorkflow: AdminFollowupsWorkflow,
    protected adminSettingsWorkflow: AdminSettingsWorkflow,
    protected adminEmployeesWorkflow: AdminEmployeesWorkflow
  ) { }

  private resolveCrmSalesCompanyCode(user: any): string {
    const code = user.salesCompanyCode || user.adminCompanyCode || user.companyCode || '';
    const companyName = String(user.companyName || '').trim().toLowerCase();
    if (
      user.role === 'crm_admin' &&
      (companyName.includes('softrate tech park') || !code)
    ) {
      return 'STP-1603-2026';
    }
    return code;
  }

  ngOnInit(): void {
    window.scrollTo({ top: 0 });

    // Hide splash screen after 2.2s
    setTimeout(() => {
      this.showSplash = false;
    }, 2200);

    Chart.register(...registerables);
    const raw = localStorage.getItem('tracecall_user');
    if (raw) {
      try {
        const user = JSON.parse(raw);
        this.loggedIn = true;
        this.userRole = user.role === 'crm_admin' || user.role === 'project_manager' ? user.role : 'admin';
        this.dashboardCompany = user.companyName || 'Your Company';
        this.dashboardCode = this.userRole === 'crm_admin' ? this.resolveCrmSalesCompanyCode(user) : (user.companyCode || '');
        this.dashboardTeamSize = parseInt(user.teamSize) || 0;
        if (this.userRole === 'crm_admin' && user.companyCode !== this.dashboardCode) {
          localStorage.setItem('tracecall_user', JSON.stringify({
            ...user,
            crmCompanyCode: user.crmCompanyCode || user.companyCode || '',
            salesCompanyCode: this.dashboardCode,
            companyCode: this.dashboardCode,
          }));
        }
        this.loadAdminProfilePhoto();
        if (this.userRole === 'crm_admin') {
          this.dashTab = 'crm_clients';
          this.loadCrmDashboard();
          if (this.dashboardCode) this._loadDashboard();
        } else {
          this._loadDashboard();
        }
      } catch { localStorage.removeItem('tracecall_user'); }
    }

    // Check for reset token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    if (token) {
      this.resetTokenValue = token;
      this.isResetPwdOpen = true;
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  switchTab(tab: AdminPageId): void {
    const prevTab = this.dashTab;
    
    // If switching away from employee dashboard, clear selected employee state 
    // so legacy side-drilldown doesn't show up.
    if (prevTab === 'emp_dashboard' && tab !== 'emp_dashboard') {
      this.destroyEmployeeCharts();
      this.selectedEmployee = null;
      this.selectedEmpStats = null;
      this.selectedEmpCalls = [];
      this.employeeChartType = 'line';
    }

    this.dashTab = tab;
    this.sidebarOpen = false;

    if (this.isCrmPage(tab)) {
      this.loadCrmTab(tab);
      return;
    }

    // Reset period to 'today' when moving from Reports back to Overview/Employees
    // unless specifically requested otherwise. This prevents getting stuck in 'custom' filters.
    if ((tab === 'overview' || tab === 'employees') && this.selectedPeriod === 'custom') {
      this.onPeriodChange('today');
    }

    // If switching back to overview and we have data, ensure charts are rendered
    // (since *ngIf removes the canvas from DOM when switching tabs)
    if (tab === 'overview' && prevTab !== 'overview') {
      setTimeout(() => {
        if (this.summaryStats) this.renderDonutChart();
        if (this.timelineData.length) this.renderTimelineChart();
      }, 100);
    } else if (tab !== 'overview') {
      this.clearOverviewChartRetries();
    }

    if (tab === 'leads' || tab === 'followups' || tab === 'remarks_filter') {
      if (tab === 'remarks_filter') {
        this.selectedAdminLeadSet = ''; // Reset set filter for global remarks search
        this.selectedRemarkFilter = this.settingsProductRemarks[0] || '';
        this.selectedRemarksFilterCompany = '';
        this.remarkFilterSearch = ''; // Reset search when switching to this tab
        if (this.selectedRemarkFilter) this.fetchLeadsByRemark(this.selectedRemarkFilter);
      }
      
      if (tab === 'leads') this.fetchAdminLeads();
      if (tab === 'followups') this.fetchCompanyBookmarks();
    }

    // Load settings when navigating to settings or remarks_filter tab
    if (tab === 'settings' || tab === 'remarks_filter' || tab === 'invoice_settings') {
      this.fetchSettings();
    }
    if (tab === 'invoice') {
      this.fetchSettings();
      this.fetchInvoiceRecords();
      this.fetchAdminInvoiceClients();
    }
    if (tab === 'client_onboarding') {
      this.fetchClientOnboardingRecords();
    }
    if (tab === 'quotation') {
      this.fetchSettings();
      this.fetchAdminQuotationLeads();
      this.fetchQuotationRecords();
    }
  }

  get adminTopbarTitle(): string {
    switch (this.dashTab) {
      case 'overview': return 'Overview';
      case 'leads': return 'Leads';
      case 'remarks_filter': return 'Remarks Filter';
      case 'followups': return 'Follow-ups';
      case 'employees': return 'Employees';
      case 'emp_dashboard': return this.selectedEmployee?.name || 'Employee Dashboard';
      case 'reports': return 'Periodic Reports';
      case 'company': return 'Company Settings';
      case 'support': return 'Help & Support';
      case 'settings': return 'App Settings';
      case 'invoice': return 'Invoice';
      case 'client_onboarding': return 'Client Onboarding';
      case 'invoice_settings': return 'Invoice Settings';
      case 'quotation': return 'Quotation';
      case 'crm_clients': return 'CRM Clients';
      case 'crm_sla': return 'SLA';
      case 'crm_nda': return 'NDA';
      case 'crm_amc': return 'AMC Tracking';
      case 'crm_payments': return 'Payments';
      case 'crm_tickets': return 'Tickets';
      case 'crm_projects': return 'Project Management';
      default: return 'Dashboard';
    }
  }

  get adminSearchPlaceholder(): string {
    switch (this.dashTab) {
      case 'leads': return 'Search leads, phone, or company...';
      case 'remarks_filter': return 'Search companies, contacts, or remarks...';
      case 'followups': return 'Search follow-ups, phone, or company...';
      case 'quotation': return 'Search leads, phone, or company...';
      case 'invoice': return 'Search onboarded clients...';
      case 'client_onboarding': return 'Search onboarded clients...';
      case 'invoice_settings': return 'Search invoice settings...';
      case 'employees': return 'Search employees, phone, or tag...';
      case 'emp_dashboard': return 'Search assigned leads or follow-ups...';
      case 'crm_clients': return 'Search CRM clients, contacts, or managers...';
      case 'crm_sla': return 'Search SLA history or clients...';
      case 'crm_nda': return 'Search NDA history or clients...';
      case 'crm_amc': return 'Search AMC clients...';
      case 'crm_payments': return 'Search payments, invoices, or clients...';
      case 'crm_projects': return 'Search projects, clients, or managers...';
      case 'crm_tickets': return 'Search tickets or client queries...';
      default: return 'Search leads, phone, or company...';
    }
  }

  get adminGlobalSearch(): string {
    return this.currentAdminGlobalSearchValue();
  }

  set adminGlobalSearch(value: string) {
    const sourceTab = this.dashTab;
    const previousTrimmed = this.currentAdminGlobalSearchValue(sourceTab).trim();
    this.setCurrentAdminGlobalSearchValue(value, sourceTab);

    const trimmed = value.trim();
    const shouldRunAsyncSearch = this.isAdminGlobalSearchAsyncTab(sourceTab, trimmed);
    this.isAdminSearching = shouldRunAsyncSearch && previousTrimmed !== trimmed;

    if (this.adminGlobalSearchTimer) clearTimeout(this.adminGlobalSearchTimer);
    if (!shouldRunAsyncSearch) {
      this.stopAdminGlobalSearchTracking();
      this.isAdminSearching = false;
      return;
    }

    this.adminGlobalSearchTimer = setTimeout(() => {
      if (trimmed !== this.currentAdminGlobalSearchValue(sourceTab).trim()) return;
      this.runAdminGlobalSearch(sourceTab, trimmed);
    }, SEARCH_DEBOUNCE_MS);
  }

  onAdminGlobalSearchEnter(): void {
    const query = this.adminGlobalSearch.trim();
    const sourceTab = this.dashTab;
    if (this.adminGlobalSearchTimer) clearTimeout(this.adminGlobalSearchTimer);
    if (!this.isAdminGlobalSearchAsyncTab(sourceTab, query)) {
      this.stopAdminGlobalSearchTracking();
      this.isAdminSearching = false;
      return;
    }
    this.isAdminSearching = true;
    this.runAdminGlobalSearch(sourceTab, query);
  }

  get adminGlobalSearchLoading(): boolean {
    return this.isAdminSearching;
  }

  private currentAdminGlobalSearchValue(tab: AdminPageId = this.dashTab): string {
    switch (tab) {
      case 'remarks_filter':
        return this.remarkFilterSearch;
      case 'followups':
        return this.followupSearch;
      case 'emp_dashboard':
        return this.empLeadSearchQuery || this.followupSearch;
      case 'invoice':
      case 'invoice_settings':
        return this.invoiceSearch;
      case 'client_onboarding':
        return this.clientOnboardingSearch;
      case 'quotation':
        return this.quotationSearch;
      case 'employees':
        return this.employeeSearchQuery;
      case 'crm_clients':
      case 'crm_sla':
      case 'crm_nda':
      case 'crm_amc':
        return this.crmClientSearch;
      case 'crm_tickets':
        return this.crmTicketSearch;
      case 'crm_payments':
        return this.crmPaymentSearch;
      case 'crm_projects':
        return this.crmProjectSearch;
      default:
        return this.leadSearchQuery;
    }
  }

  private setCurrentAdminGlobalSearchValue(value: string, tab: AdminPageId = this.dashTab): void {
    switch (tab) {
      case 'remarks_filter':
        this.remarkFilterSearch = value;
        return;
      case 'followups':
        this.followupSearch = value;
        return;
      case 'emp_dashboard':
        this.empLeadSearchQuery = value;
        this.followupSearch = value;
        return;
      case 'invoice':
      case 'invoice_settings':
        this.invoiceSearch = value;
        return;
      case 'client_onboarding':
        this.clientOnboardingSearch = value;
        return;
      case 'quotation':
        this.quotationSearch = value;
        return;
      case 'employees':
        this.employeeSearchQuery = value;
        return;
      case 'crm_clients':
      case 'crm_sla':
      case 'crm_nda':
      case 'crm_amc':
        this.crmClientSearch = value;
        return;
      case 'crm_tickets':
        this.crmTicketSearch = value;
        return;
      case 'crm_payments':
        this.crmPaymentSearch = value;
        return;
      case 'crm_projects':
        this.crmProjectSearch = value;
        return;
      default:
        this.leadSearchQuery = value;
    }
  }

  private isAdminGlobalSearchAsyncTab(tab: AdminPageId, query: string): boolean {
    if (tab === 'overview') return !!query;
    return ['leads', 'followups', 'remarks_filter', 'emp_dashboard', 'invoice', 'client_onboarding', 'quotation', 'crm_clients', 'crm_amc', 'crm_tickets'].includes(tab);
  }

  private runAdminGlobalSearch(sourceTab: AdminPageId, query: string): void {
    switch (sourceTab) {
      case 'overview':
        this.leadSearchQuery = query;
        if (!query) {
          this.isAdminSearching = false;
          this.stopAdminGlobalSearchTracking();
          return;
        }
        if (this.dashTab !== 'leads') {
          this.switchTab('leads');
        } else {
          this.fetchAdminLeads();
        }
        this.startAdminGlobalSearchTracking();
        return;
      case 'leads':
        this.fetchAdminLeads();
        this.startAdminGlobalSearchTracking();
        return;
      case 'followups':
        this.fetchCompanyBookmarks();
        this.startAdminGlobalSearchTracking();
        return;
      case 'remarks_filter':
        this.fetchLeadsByRemark(this.selectedRemarkFilter);
        this.startAdminGlobalSearchTracking();
        return;
      case 'emp_dashboard':
        this.fetchEmpLeads();
        this.fetchEmpFollowups();
        this.startAdminGlobalSearchTracking();
        return;
      case 'invoice':
        this.fetchAdminInvoiceClients();
        this.startAdminGlobalSearchTracking();
        return;
      case 'client_onboarding':
        this.fetchClientOnboardingRecords();
        this.startAdminGlobalSearchTracking();
        return;
      case 'quotation':
        this.fetchAdminQuotationLeads();
        this.startAdminGlobalSearchTracking();
        return;
      case 'crm_clients':
        this.fetchCrmClients();
        this.startAdminGlobalSearchTracking();
        return;
      case 'crm_amc':
        this.fetchCrmAmc();
        this.startAdminGlobalSearchTracking();
        return;
      case 'crm_tickets':
        this.fetchCrmTickets();
        this.startAdminGlobalSearchTracking();
        return;
      default:
        this.isAdminSearching = false;
        this.stopAdminGlobalSearchTracking();
    }
  }

  private startAdminGlobalSearchTracking(): void {
    if (this.adminGlobalSearchSettleTimer) clearInterval(this.adminGlobalSearchSettleTimer);
    this.adminGlobalSearchSettleTimer = setInterval(() => this.finishAdminGlobalSearchIfSettled(), 80);
    this.finishAdminGlobalSearchIfSettled();
  }

  private stopAdminGlobalSearchTracking(): void {
    if (this.adminGlobalSearchSettleTimer) clearInterval(this.adminGlobalSearchSettleTimer);
    this.adminGlobalSearchSettleTimer = null;
  }

  private finishAdminGlobalSearchIfSettled(): void {
    if (!this.isAdminSearching) {
      this.stopAdminGlobalSearchTracking();
      return;
    }
    const hasActiveLoad = this.allLeadsLoading ||
      this.adminLeadCompaniesLoading ||
      this.adminLeadContactsLoadingMore ||
      this.remarkLeadsLoading ||
      this.remarkLeadCompaniesLoading ||
      this.remarkLeadContactsLoadingMore ||
      this.allBookmarksLoading ||
      this.adminFollowupCompaniesLoading ||
      this.empLeadsLoading ||
      this.empLeadCompaniesLoading ||
      this.empLeadContactsLoadingMore ||
      this.empFollowupsLoading ||
      this.empFollowupLoadingMore ||
      this.adminInvoiceClientsLoading ||
      this.clientOnboardingLoading ||
      this.crmClientsLoading ||
      this.crmAmcLoading ||
      this.crmTicketsLoading;
    if (!hasActiveLoad) {
      this.isAdminSearching = false;
      this.stopAdminGlobalSearchTracking();
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  fmtDur(seconds: number): string {
    return formatDuration(seconds);
  }

  shortDur(seconds: number): string {
    return formatShortDuration(seconds);
  }

  // Returns avg call duration formatted as Xm Ys (based on connected calls)
  fmtAvgDur(totalDuration: number, connectedCalls: number): string {
    return formatAverageDuration(totalDuration, connectedCalls);
  }

  private pct(value: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.round((value / total) * 100);
  }

  get adminConnectRate(): number {
    return this.pct(this.summaryStats?.connected || 0, this.summaryStats?.total || 0);
  }

  get adminMissedRate(): number {
    return this.pct(this.summaryStats?.missed || 0, this.summaryStats?.total || 0);
  }

  get adminOutboundShare(): number {
    return this.pct(this.summaryStats?.outgoing || 0, this.summaryStats?.total || 0);
  }

  get adminIncomingShare(): number {
    return this.pct(this.summaryStats?.incoming || 0, this.summaryStats?.total || 0);
  }

  get adminRejectedRate(): number {
    return this.pct(this.summaryStats?.rejected || 0, this.summaryStats?.total || 0);
  }

  get adminDonutGradient(): string {
    const s = this.summaryStats;
    const incoming = Math.max(0, s?.incoming || 0);
    const outgoing = Math.max(0, s?.outgoing || 0);
    const missed = Math.max(0, s?.missed || 0);
    const rejected = Math.max(0, s?.rejected || 0);
    const total = incoming + outgoing + missed + rejected;

    if (!total) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    const incomingEnd = (incoming / total) * 360;
    const outgoingEnd = incomingEnd + (outgoing / total) * 360;
    const missedEnd = outgoingEnd + (missed / total) * 360;

    return [
      'conic-gradient(',
      `${this.dashboardPalette.incoming} 0deg ${incomingEnd}deg, `,
      `${this.dashboardPalette.outgoing} ${incomingEnd}deg ${outgoingEnd}deg, `,
      `${this.dashboardPalette.missed} ${outgoingEnd}deg ${missedEnd}deg, `,
      `${this.dashboardPalette.rejected} ${missedEnd}deg 360deg`,
      ')'
    ].join('');
  }

  get adminSelectedPeriodLabel(): string {
    return this.periods.find(p => p.key === this.selectedPeriod)?.label || 'Selected period';
  }

  get adminActiveEmployeeCount(): number {
    return this.employeeCallRows.filter(row => (row.stats?.total || 0) > 0).length;
  }

  get adminTopPerformerName(): string {
    const top = [...this.employeeCallRows].sort((a, b) => (b.stats?.total || 0) - (a.stats?.total || 0))[0];
    if (!top || !(top.stats?.total || 0)) return 'No activity';
    return top.emp?.name || top.emp?.mobile || 'No activity';
  }

  get adminAvgCallsPerActiveEmployee(): number {
    if (!this.adminActiveEmployeeCount) return 0;
    return Math.round((this.summaryStats?.total || 0) / this.adminActiveEmployeeCount);
  }

  get adminTopEmployeeMaxCalls(): number {
    const top = this.employeeCallRows.reduce((max, row) => Math.max(max, row.stats?.total || 0), 0);
    return top || 1;
  }

  get adminPeakActivity(): { label: string; count: number } {
    const peak = (this.timelineData || []).reduce((best, row) => {
      const count = (row?.incoming || 0) + (row?.outgoing || 0) + (row?.missed || 0) + (row?.rejected || 0);
      return count > best.count ? { row, count } : best;
    }, { row: null as any, count: 0 });

    if (!peak.row || peak.count <= 0) return { label: 'No activity', count: 0 };

    const rawDate = peak.row._isHourly ? peak.row.hour : peak.row.date;
    if (!rawDate) return { label: 'Peak window', count: peak.count };

    const date = new Date(rawDate);
    const label = peak.row._isHourly
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return { label, count: peak.count };
  }

  empMapCache: { [phone: string]: string } | null = null;
  lastEmployeesRef: any[] | null = null;

  getEmployeeName(phone: string): string {
    if (this.lastEmployeesRef !== this.employees) {
      this.empMapCache = {};
      for (const e of this.employees) {
        if (e.mobile) {
          this.empMapCache[e.mobile] = e.name;
        }
      }
      this.lastEmployeesRef = this.employees;
    }
    return this.empMapCache![phone] || phone;
  }

  fmtDate(d: string | undefined | null): string {
    return formatIndianDateTime(d);
  }

  fmtTime(ts: string | number | undefined): string {
    return formatIndianTime(ts);
  }

  periodLabel(p: string): string {
    return dashboardPeriodLabel(p);
  }

  // ── Dashboard loader ──────────────────────────────────────
  _loadDashboard(): void {
    this.companyProfileLoading = true;
    this.fetchCompanyProfile();
    this.fetchEmployees();
    this.fetchPaymentHistory();
    this.fetchAdminLeads();
    this.fetchCompanyBookmarks();
    // Preload past 7 days data on load to avoid spinners when toggling periods
    this.preloadDashboardData();
    // Start break notification polling (every 60s)
    this.startBreakNotifPolling();
    // Load Settings data
    this.fetchSettings();
  }

  get isCrmAdmin(): boolean {
    return this.userRole === 'crm_admin';
  }

  get isProjectManager(): boolean {
    return this.userRole === 'project_manager';
  }

  isCrmPage(tab: AdminPageId): boolean {
    return ['crm_clients', 'crm_sla', 'crm_nda', 'crm_amc', 'crm_payments', 'crm_tickets', 'crm_projects'].includes(tab);
  }

  loadCrmDashboard(): void {
    this.fetchCrmClients();
    this.fetchCrmContracts('SLA');
    this.fetchCrmContracts('NDA');
    this.fetchNdaTemplate();
    this.fetchCrmAmc();
    this.fetchCrmPayments();
    this.fetchCrmTickets();
    this.fetchCrmProjects();
  }

  loadCrmTab(tab: AdminPageId): void {
    if (tab === 'crm_clients') this.fetchCrmClients();
    if (tab === 'crm_sla') this.fetchCrmContracts('SLA');
    if (tab === 'crm_nda') {
      this.fetchCrmContracts('NDA');
      this.fetchNdaTemplate();
    }
    if (tab === 'crm_amc') this.fetchCrmAmc();
    if (tab === 'crm_payments') this.fetchCrmPayments();
    if (tab === 'crm_tickets') this.fetchCrmTickets();
    if (tab === 'crm_projects') this.fetchCrmProjects();
  }

  fetchCrmClients(): void {
    this.crmClientsLoading = true;
    this.crmService.getClients({ search: this.crmClientSearch, companyCode: this.dashboardCode }).subscribe({
      next: (res) => {
        this.crmClientsLoading = false;
        this.crmClients = res?.clients || [];
        this.hydrateCrmContactsIntoLeadStore();
        if (!this.selectedCrmClientCompany || !this.crmClients.some((client) => client.companyName === this.selectedCrmClientCompany)) {
          this.selectCrmClient(this.crmClients[0]?.companyName || '');
        }
      },
      error: (err) => {
        this.crmClientsLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to load CRM clients.';
      },
    });
  }

  hydrateCrmContactsIntoLeadStore(): void {
    const contacts = this.crmClients.flatMap((client) => client.contacts || []).map((lead) => this.normalizeLead(lead));
    if (!contacts.length) return;
    this.upsertAdminHydratedLeadRecords(contacts);
  }

  selectCrmClient(companyName: string): void {
    this.selectedCrmClientCompany = companyName;
    this.selectedLeadCompany = companyName;
    this.closeAdminLeadPanels();
  }

  openEditCrmClientModal(client: any): void {
    this.editCrmClientError = '';
    this.editingCrmClient = {
      _id: client._id || client.id || '',
      companyName: client.companyName || '',
      primaryContactName: client.primaryContactName || client.primaryContact || '',
      primaryPhone: client.primaryPhone || '',
      primaryEmail: client.primaryEmail || '',
      address: client.address || '',
      description: client.description || ''
    };
    this.isEditCrmClientOpen = true;
  }

  closeEditCrmClient(): void {
    this.isEditCrmClientOpen = false;
  }

  onEditCrmClientSubmit(event: Event): void {
    event.preventDefault();
    if (!this.editingCrmClient._id) {
      this.editCrmClientError = 'Client ID is missing.';
      return;
    }
    this.editCrmClientLoading = true;
    this.editCrmClientError = '';
    this.crmService.updateClient(this.editingCrmClient._id, this.editingCrmClient).subscribe({
      next: (res) => {
        this.editCrmClientLoading = false;
        this.isEditCrmClientOpen = false;
        this.fetchCrmClients();
        this.fetchClientOnboardingRecords(true);
        this.fetchAdminInvoiceClients(true);
        this.fetchAdminQuotationClients(true);
      },
      error: (err) => {
        this.editCrmClientLoading = false;
        this.editCrmClientError = err?.error?.message || 'Failed to update client details.';
      }
    });
  }

  get selectedCrmClient(): CrmClient | null {
    return this.crmClients.find((client) => client.companyName === this.selectedCrmClientCompany) || null;
  }

  get filteredCrmClients(): CrmClient[] {
    const query = this.crmClientSearch.trim().toLowerCase();
    if (!query) return this.crmClients;
    return this.crmClients.filter((client) => [
      client.companyName,
      client.primaryContact,
      client.primaryPhone,
      client.primaryEmail,
      ...(client.managers || []),
      ...((client.managers || []).map((manager) => this.crmManagerName(manager))),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }

  crmClientContacts(client: CrmClient | null = this.selectedCrmClient): any[] {
    return (client?.contacts || []).map((lead) => this.normalizeLead(lead));
  }

  crmManagerName(phoneOrName = ''): string {
    const value = String(phoneOrName || '').trim();
    const fallbackNames: Record<string, string> = {
      '7845905710': 'Arun Kumar',
      '9787797450': 'Leena Priya',
      '9787797466': 'Ravi Narayan',
      '9787797395': 'Divya Suresh',
      '7826022170': 'Karthik Raman',
    };
    if (fallbackNames[value]) return fallbackNames[value];
    const employee = this.employees.find((item) => String(item.mobile || '').trim() === value || String((item as any).email || '').trim() === value);
    return String(employee?.name || value || '').trim();
  }

  crmManagerNames(values: string[] = []): string {
    const names = values.map((value) => this.crmManagerName(value)).filter(Boolean);
    return Array.from(new Set(names)).join(', ');
  }

  openCrmClientFullView(client = this.selectedCrmClient, event?: Event): void {
    event?.stopPropagation();
    if (!client) return;
    this.selectCrmClient(client.companyName);
    this.upsertAdminHydratedLeadRecords(this.crmClientContacts(client));
    this.openCompanyFullView(event);
  }

  openCrmClientAiSummary(client = this.selectedCrmClient, event?: Event): void {
    event?.stopPropagation();
    if (!client) return;
    this.selectCrmClient(client.companyName);
    this.upsertAdminHydratedLeadRecords(this.crmClientContacts(client));
    this.openAdminAiSummary(event);
  }

  fetchCrmContracts(type: 'SLA' | 'NDA'): void {
    this.crmContractsLoading = true;
    this.crmService.getContracts(type, { companyCode: this.dashboardCode }).subscribe({
      next: (res) => {
        this.crmContractsLoading = false;
        const otherType = this.crmContracts.filter((item) => item.type !== type);
        this.crmContracts = [...otherType, ...(res?.contracts || [])];
      },
      error: (err) => {
        this.crmContractsLoading = false;
        this.crmActionMessage = err?.error?.message || `Unable to load ${type} history.`;
      },
    });
  }

  crmContractsByType(type: 'SLA' | 'NDA'): any[] {
    const query = this.crmClientSearch.trim().toLowerCase();
    return this.crmContracts
      .filter((item) => item.type === type)
      .filter((item) => !query || String(item.clientCompanyName || '').toLowerCase().includes(query) || String(item.documentNumber || '').toLowerCase().includes(query));
  }

  get filteredNdaContracts(): any[] {
    const query = this.ndaHistorySearch.trim().toLowerCase();
    return this.crmContracts
      .filter((item) => item.type === 'NDA')
      .filter((item) => this.matchesNdaDateFilter(item.createdAt || item.generatedAt || item.effectiveFrom))
      .filter((item) => !query || [
        item.documentNumber,
        item.clientCompanyName,
        item.contactName,
        item.status,
      ].some((value) => String(value || '').toLowerCase().includes(query)));
  }

  get todayInputDate(): string {
    return this.inputDateValue(new Date().toISOString());
  }

  matchesNdaDateFilter(rawDate?: string): boolean {
    if (!this.ndaDateFrom && !this.ndaDateTo) return true;
    if (!rawDate) return false;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return false;
    if (this.ndaDateFrom) {
      const from = new Date(`${this.ndaDateFrom}T00:00:00`);
      if (date < from) return false;
    }
    if (this.ndaDateTo) {
      const to = new Date(`${this.ndaDateTo}T23:59:59`);
      if (date > to) return false;
    }
    return true;
  }

  openNdaWorkspace(client: CrmClient, event?: Event): void {
    event?.stopPropagation();
    this.selectCrmClient(client.companyName);
    this.ndaWorkspaceClient = client;
    this.ndaWorkspaceOpen = true;
    this.ndaTemplateMode = 'builder';
    this.crmActionMessage = '';
    this.prefillNdaDraftFromClient(client);
    if (!Array.isArray(this.currentNdaTemplate.clauses) || this.currentNdaTemplate.clauses.length === 0) {
      this.fetchNdaTemplate();
    } else {
      this.syncNdaPagesFromClauses();
    }
    setTimeout(() => this.focusNdaClause(0, false), 0);
  }

  closeNdaWorkspace(): void {
    this.ndaWorkspaceOpen = false;
    this.ndaWorkspaceClient = null;
    this.activeNdaClauseIndex = -1;
    this.activeNdaParagraphIndex = -1;
    this.onNdaCanvasMouseUp();
  }

  prefillNdaDraftFromClient(client: CrmClient): void {
    const contact = client.contacts?.[0] || {};
    this.ndaGenerationDraft.clientAddress = this.ndaGenerationDraft.clientAddress || contact.address || contact.companyAddress || '';
    this.ndaGenerationDraft.projectName = this.ndaGenerationDraft.projectName || client.companyName || '';
    this.ndaGenerationDraft.projectDescription = this.ndaGenerationDraft.projectDescription || client.description || '';
  }

  defaultNdaPage(): any {
    return {
      showHeader: false,
      backgroundUrl: '',
      placeholders: [],
      highlightedAreas: [],
      paragraphs: [],
    };
  }

  defaultNdaClause(index = 0): any {
    return {
      id: `nda-clause-${Date.now()}-${index}`,
      type: 'clause',
      heading: 'New Clause',
      subheading: '',
      content: '',
      enabled: true,
    };
  }

  defaultNdaTemplate(): any {
    return {
      name: 'NDA Format Sample',
      sourceDocument: 'docs/NDA Format Sample.docx',
      version: '1.0',
      orientation: 'portrait',
      header: {
        enabled: true,
        companyTitle: 'SOFTRATE TECHNOLOGIES (P) LTD',
        addressLine: 'SOFTRATE TECH PARK, MANGADU, CHENNAI, INDIA, 600 122',
        contactLine: '(+91) 8148633580  |  helpdesk@softrateglobal.com',
      },
      clauses: [],
      pages: [{ ...this.defaultNdaPage(), showHeader: true }],
    };
  }

  get currentNdaTemplate(): any {
    if (!this.ndaTemplate?.pages?.length) this.ndaTemplate = this.defaultNdaTemplate();
    return this.ndaTemplate;
  }

  get currentNdaPage(): any {
    const template = this.currentNdaTemplate;
    if (!template.pages[this.ndaSelectedPageIndex]) this.ndaSelectedPageIndex = 0;
    return template.pages[this.ndaSelectedPageIndex] || this.defaultNdaPage();
  }

  get ndaCanvasWidth(): number {
    return this.currentNdaTemplate.orientation === 'landscape' ? 842 : 595;
  }

  get ndaCanvasHeight(): number {
    return this.currentNdaTemplate.orientation === 'landscape' ? 595 : 842;
  }

  fetchNdaTemplate(): void {
    if (!this.dashboardCode) return;
    this.ndaTemplateLoading = true;
    this.crmService.getNdaTemplate({ companyCode: this.dashboardCode }).subscribe({
      next: (res) => {
        this.ndaTemplateLoading = false;
        if (res?.ndaTemplate) {
          this.ndaTemplate = this.normalizeNdaTemplate(res.ndaTemplate);
          this.ndaSelectedPageIndex = Math.min(this.ndaSelectedPageIndex, this.ndaTemplate.pages.length - 1);
        }
        if (Array.isArray(res?.placeholders)) this.ndaAvailablePlaceholderKeys = res.placeholders;
      },
      error: (err) => {
        this.ndaTemplateLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to load NDA template.';
      },
    });
  }

  saveNdaTemplate(): void {
    this.ndaTemplateSaving = true;
    this.crmService.updateNdaTemplate({
      companyCode: this.dashboardCode,
      ndaTemplate: this.normalizeNdaTemplate(this.ndaTemplate),
    }).subscribe({
      next: (res) => {
        this.ndaTemplateSaving = false;
        if (res?.ndaTemplate) this.ndaTemplate = this.normalizeNdaTemplate(res.ndaTemplate);
        this.crmActionMessage = 'NDA template saved successfully.';
      },
      error: (err) => {
        this.ndaTemplateSaving = false;
        this.crmActionMessage = err?.error?.message || 'Unable to save NDA template.';
      },
    });
  }

  normalizeNdaTemplate(template: any): any {
    const next = {
      ...this.defaultNdaTemplate(),
      ...(template || {}),
      header: {
        ...this.defaultNdaTemplate().header,
        ...((template || {}).header || {}),
      },
    };
    next.orientation = next.orientation === 'landscape' ? 'landscape' : 'portrait';
    next.clauses = Array.isArray(next.clauses)
      ? next.clauses.map((clause: any, index: number) => ({
          id: String(clause?.id || `nda-clause-${Date.now()}-${index}`),
          type: clause?.type === 'title' ? 'title' : 'clause',
          heading: String(clause?.heading || clause?.title || (clause?.type === 'title' ? 'Non-Disclosure Agreement (NDA)' : 'New Clause')).trim(),
          subheading: String(clause?.subheading || clause?.subHeading || '').trim(),
          content: String(clause?.content || clause?.body || '').trim(),
          enabled: clause?.enabled !== false,
        }))
      : [];
    next.pages = Array.isArray(next.pages) && next.pages.length
      ? next.pages.map((page: any) => ({
          showHeader: typeof page?.showHeader === 'boolean' ? page.showHeader : false,
          backgroundUrl: page?.backgroundUrl || '',
          placeholders: Array.isArray(page?.placeholders) ? page.placeholders : [],
          highlightedAreas: Array.isArray(page?.highlightedAreas) ? page.highlightedAreas : [],
          paragraphs: Array.isArray(page?.paragraphs) ? page.paragraphs : [],
        }))
      : [this.defaultNdaPage()];
    return next;
  }

  private ndaText(value: unknown): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  private ndaContentLinesToBlocks(content: string, source: any): any[] {
    return String(content || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => /^[-•]\s+/.test(line)
        ? { type: 'bullet', text: line.replace(/^[-•]\s+/, ''), ...source }
        : { type: 'body', text: line, ...source });
  }

  private ndaBlocksFromCurrentClauses(): any[] {
    const blocks: any[] = [];
    let lastHeading = '';
    let sectionNumber = 0;
    let subSectionNumber = 0;
    (this.currentNdaTemplate.clauses || [])
      .forEach((clause: any, index: number) => {
        if (clause?.enabled === false) return;

        const heading = this.ndaText(clause.heading || clause.title || '');
        const subheading = this.ndaText(clause.subheading || clause.subHeading || '');
        const source = {
          sourceClauseId: String(clause.id || ''),
          sourceClauseIndex: index,
        };

        if (clause.type === 'title') {
          blocks.push({ type: 'title', text: heading || 'Non-Disclosure Agreement (NDA)', ...source });
          blocks.push(...this.ndaContentLinesToBlocks(clause.content || '', source));
          lastHeading = '';
          return;
        }

        if (heading && heading !== lastHeading) {
          sectionNumber += 1;
          subSectionNumber = 0;
          blocks.push({ type: 'heading', text: `${sectionNumber}. ${heading}`, rawText: heading, numberLabel: `${sectionNumber}`, ...source });
          lastHeading = heading;
        }
        if (subheading) {
          subSectionNumber += 1;
          const numberLabel = sectionNumber ? `${sectionNumber}.${subSectionNumber}` : `${subSectionNumber}`;
          blocks.push({ type: 'subheading', text: `${numberLabel} ${subheading}`, rawText: subheading, numberLabel, ...source });
        }
        blocks.push(...this.ndaContentLinesToBlocks(clause.content || '', source));
      });
    return blocks;
  }

  private ndaParagraphForBlock(block: any): any {
    const base = {
      id: `nda-${Math.random().toString(36).slice(2, 10)}`,
      text: block.text,
      sourceClauseId: block.sourceClauseId || '',
      sourceClauseIndex: Number.isInteger(block.sourceClauseIndex) ? block.sourceClauseIndex : null,
      x: 54,
      y: 140,
      width: 487,
      fontSize: 10,
      fontFamily: 'Times-Roman',
      alignment: block.type === 'body' || block.type === 'bullet' ? 'justify' : 'left',
      letterSpacing: 0,
      lineHeight: 1.3,
      isBold: false,
      isItalic: false,
      color: '#111111',
      isCollapsed: true,
      highlightPlaceholders: /\{\{[^}]+\}\}/.test(String(block.text || '')),
      placeholderHighlightColor: '#fff3a3',
    };

    if (block.type === 'title') return { ...base, fontSize: 18, alignment: 'center', isBold: true, lineHeight: 1.2 };
    if (block.type === 'heading') return { ...base, fontSize: 11.5, isBold: true, lineHeight: 1.2 };
    if (block.type === 'subheading') return { ...base, fontSize: 10.5, isBold: true, lineHeight: 1.2 };
    if (block.type === 'bullet') return { ...base, x: 70, width: 471, text: `- ${block.text}` };
    return base;
  }

  private ndaEstimateParagraphHeight(paragraph: any): number {
    const fontSize = Number(paragraph.fontSize || 10);
    const width = Number(paragraph.width || 487);
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const family = paragraph.fontFamily || 'Helvetica';
        const weight = paragraph.isBold ? 'bold' : 'normal';
        const style = paragraph.isItalic ? 'italic' : 'normal';
        ctx.font = `${style} ${weight} ${fontSize}px "${family}"`;
        
        const words = String(paragraph.text || '').split(' ');
        let lines = 0;
        let currentLine = '';
        
        for (let i = 0; i < words.length; i++) {
          const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > width && currentLine) {
            lines++;
            currentLine = words[i];
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          lines++;
        }
        
        const lineCount = Math.max(1, lines);
        return Math.ceil(lineCount * fontSize * Number(paragraph.lineHeight || 1.3)) + 7;
      }
    } catch (e) {
      console.warn('Canvas measureText failed, falling back to heuristic:', e);
    }

    const charsPerLine = Math.max(30, Math.floor(width / (fontSize * 0.44)));
    const lineCount = Math.max(1, Math.ceil(String(paragraph.text || '').length / charsPerLine));
    return Math.ceil(lineCount * fontSize * Number(paragraph.lineHeight || 1.3)) + 7;
  }

  private ndaNewGeneratedPage(): any {
    return {
      showHeader: false,
      backgroundUrl: '',
      placeholders: [],
      highlightedAreas: [],
      paragraphs: [],
    };
  }

  private ndaPaginateBlocks(blocks: any[]): any[] {
    const firstPage = { ...this.ndaNewGeneratedPage(), showHeader: true };
    const pages = [firstPage];
    const firstPageTop = 132;
    const continuationTop = 84;
    const bottom = 64;
    const gap = 5;
    let y = firstPageTop;

    const addPage = () => {
      pages.push(this.ndaNewGeneratedPage());
      y = pages[pages.length - 1].showHeader ? firstPageTop : continuationTop;
    };

    blocks.forEach((block) => {
      const paragraph = this.ndaParagraphForBlock(block);
      const height = this.ndaEstimateParagraphHeight(paragraph);
      if (y + height > this.ndaCanvasHeight - bottom && pages[pages.length - 1].paragraphs.length > 0) {
        addPage();
      }
      paragraph.y = y;
      pages[pages.length - 1].paragraphs.push(paragraph);
      y += height + gap;
    });

    if (y + 165 > this.ndaCanvasHeight - bottom) {
      addPage();
    }

    const signaturePage = pages[pages.length - 1];
    signaturePage.paragraphs.push({
      ...this.ndaParagraphForBlock({ type: 'body', text: 'This agreement has been executed and signed by the parties.' }),
      id: 'nda-signature-intro',
      y,
      isCollapsed: false,
    });
    y += 32;

    signaturePage.paragraphs.push({
      ...this.ndaParagraphForBlock({ type: 'body', text: '{{companyName}}' }),
      id: 'nda-party-a-name',
      x: 54,
      y,
      width: 220,
      isBold: true,
      alignment: 'left',
      highlightPlaceholders: true,
    });
    signaturePage.paragraphs.push({
      ...this.ndaParagraphForBlock({ type: 'body', text: '{{clientCompanyName}}' }),
      id: 'nda-party-b-name',
      x: 318,
      y,
      width: 220,
      isBold: true,
      alignment: 'left',
      highlightPlaceholders: true,
    });

    [
      ['signatoryName', 'clientName', 'Full Name:'],
      ['signatoryTitle', 'clientSignatoryTitle', 'Title:'],
      ['todayDate', 'todayDate', 'Date:'],
      ['companySignature', 'clientSignature', 'Signature:'],
    ].forEach(([leftKey, rightKey, label], index) => {
      const rowY = y + 28 + (index * 26);
      signaturePage.paragraphs.push({ ...this.ndaParagraphForBlock({ type: 'body', text: label }), id: `nda-signature-left-label-${index}`, x: 54, y: rowY, width: 70, alignment: 'left' });
      signaturePage.paragraphs.push({ ...this.ndaParagraphForBlock({ type: 'body', text: label }), id: `nda-signature-right-label-${index}`, x: 318, y: rowY, width: 70, alignment: 'left' });
      signaturePage.highlightedAreas.push({ key: leftKey, x: 126, y: rowY - 3, width: 145, height: 18, fontSize: 10, isBold: index === 0, color: '#111111', backgroundColor: '#fff3a3', borderColor: '#f0c94a' });
      signaturePage.highlightedAreas.push({ key: rightKey, x: 390, y: rowY - 3, width: 145, height: 18, fontSize: 10, isBold: index === 0, color: '#111111', backgroundColor: '#fff3a3', borderColor: '#f0c94a' });
    });

    return pages;
  }

  syncNdaPagesFromClauses(): void {
    const template = this.currentNdaTemplate;
    const existingPages = Array.isArray(template.pages) ? template.pages : [];
    const generated = this.ndaPaginateBlocks(this.ndaBlocksFromCurrentClauses());
    template.pages = generated.map((page, index) => {
      const existing = existingPages[index] || {};
      return {
        ...page,
        showHeader: typeof existing.showHeader === 'boolean' ? existing.showHeader : page.showHeader,
        backgroundUrl: existing.backgroundUrl || page.backgroundUrl || '',
        placeholders: Array.isArray(existing.placeholders) ? existing.placeholders : page.placeholders,
        highlightedAreas: Array.isArray(existing.highlightedAreas) && existing.highlightedAreas.length
          ? existing.highlightedAreas
          : page.highlightedAreas,
      };
    });
    if (this.ndaSelectedPageIndex >= template.pages.length) {
      this.ndaSelectedPageIndex = Math.max(0, template.pages.length - 1);
    }
  }

  addNdaClause(): void {
    if (!Array.isArray(this.currentNdaTemplate.clauses)) this.currentNdaTemplate.clauses = [];
    this.currentNdaTemplate.clauses.push(this.defaultNdaClause(this.currentNdaTemplate.clauses.length));
    this.syncNdaPagesFromClauses();
    setTimeout(() => this.focusNdaClause(this.currentNdaTemplate.clauses.length - 1), 0);
  }

  removeNdaClause(index: number): void {
    if (!Array.isArray(this.currentNdaTemplate.clauses)) return;
    this.currentNdaTemplate.clauses.splice(index, 1);
    this.activeNdaClauseIndex = Math.min(index, this.currentNdaTemplate.clauses.length - 1);
    this.syncNdaPagesFromClauses();
  }

  onNdaInsertClausePlaceholder(clauseIndex: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const key = select.value;
    if (!key) return;
    const clause = this.currentNdaTemplate.clauses?.[clauseIndex];
    if (!clause) return;
    const token = `{{${key}}}`;
    const textarea = document.getElementById(`nda-clause-ta-${clauseIndex}`) as HTMLTextAreaElement | null;
    const currentText = String(clause.content || '');
    if (textarea) {
      const start = textarea.selectionStart ?? currentText.length;
      const end = textarea.selectionEnd ?? start;
      clause.content = currentText.substring(0, start) + token + currentText.substring(end);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + token.length;
        textarea.focus();
      }, 0);
    } else {
      clause.content = currentText ? `${currentText}\n${token}` : token;
    }
    setTimeout(() => { select.value = ''; }, 0);
  }

  addNdaPage(): void {
    this.currentNdaTemplate.pages.push(this.defaultNdaPage());
    this.ndaSelectedPageIndex = this.currentNdaTemplate.pages.length - 1;
  }

  removeNdaPage(index: number): void {
    if (this.currentNdaTemplate.pages.length <= 1) return;
    this.currentNdaTemplate.pages.splice(index, 1);
    if (this.ndaSelectedPageIndex >= this.currentNdaTemplate.pages.length) {
      this.ndaSelectedPageIndex = this.currentNdaTemplate.pages.length - 1;
    }
  }

  onNdaBackgroundSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.crmActionMessage = 'NDA background image must be 5 MB or smaller.';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.currentNdaPage.backgroundUrl = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  addNdaPlaceholder(): void {
    this.currentNdaPage.placeholders.push({
      key: 'clientCompanyName',
      x: 80,
      y: 150,
      width: 220,
      fontSize: 12,
      isBold: false,
      color: '#111111',
    });
  }

  removeNdaPlaceholder(index: number): void {
    this.currentNdaPage.placeholders.splice(index, 1);
  }

  addNdaHighlightArea(): void {
    this.currentNdaPage.highlightedAreas.push({
      key: 'clientCompanyName',
      x: 80,
      y: 190,
      width: 180,
      height: 24,
      fontSize: 11,
      isBold: false,
      color: '#111111',
      backgroundColor: '#fff3a3',
      borderColor: '#f0c94a',
    });
  }

  removeNdaHighlightArea(index: number): void {
    this.currentNdaPage.highlightedAreas.splice(index, 1);
  }

  addNdaParagraph(): void {
    const count = this.currentNdaPage.paragraphs.length;
    this.currentNdaPage.paragraphs.push({
      id: `nda-para-${Date.now()}`,
      text: '',
      x: 54,
      y: 140 + (count * 64),
      width: 487,
      fontSize: 10,
      fontFamily: 'Times-Roman',
      alignment: 'justify',
      letterSpacing: 0,
      lineHeight: 1.3,
      isBold: false,
      isItalic: false,
      color: '#111111',
      isCollapsed: false,
      highlightPlaceholders: true,
      placeholderHighlightColor: '#fff3a3',
    });
  }

  removeNdaParagraph(index: number): void {
    this.currentNdaPage.paragraphs.splice(index, 1);
  }

  adjustNdaFontSize(para: any, delta: number): void {
    para.fontSize = Math.min(120, Math.max(6, Number(para.fontSize || 10) + delta));
  }

  onNdaInsertPlaceholder(paraIndex: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const key = select.value;
    if (!key) return;
    const token = `{{${key}}}`;
    const para = this.currentNdaPage.paragraphs[paraIndex];
    const textarea = document.getElementById(`nda-para-ta-${paraIndex}`) as HTMLTextAreaElement | null;
    const currentText = String(para.text || '');
    if (textarea) {
      const start = textarea.selectionStart ?? currentText.length;
      const end = textarea.selectionEnd ?? start;
      para.text = currentText.substring(0, start) + token + currentText.substring(end);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + token.length;
        textarea.focus();
      }, 0);
    } else {
      para.text = `${currentText}${token}`;
    }
    setTimeout(() => { select.value = ''; }, 0);
  }

  focusNdaClause(index: number, scroll = true): void {
    if (index < 0) return;
    this.activeNdaClauseIndex = index;
    this.activeNdaParagraphIndex = -1;
    if (scroll) this.scrollNdaSidebarTo(`nda-clause-card-${index}`);
  }

  focusNdaParagraph(index: number, scroll = true): void {
    if (index < 0) return;
    const paragraph = this.currentNdaPage.paragraphs[index];
    if (paragraph) paragraph.isCollapsed = false;
    this.activeNdaParagraphIndex = index;
    this.activeNdaClauseIndex = -1;
    if (scroll) this.scrollNdaSidebarTo(`nda-para-editor-${index}`);
  }

  focusNdaParagraphFromCanvas(index: number, paragraph: any, event?: Event): void {
    event?.stopPropagation();
    const sourceClauseIndex = Number(paragraph?.sourceClauseIndex);
    if (Number.isInteger(sourceClauseIndex) && sourceClauseIndex >= 0) {
      this.focusNdaClause(sourceClauseIndex);
      return;
    }
    const sourceClauseId = String(paragraph?.sourceClauseId || '');
    const clauseIndex = sourceClauseId
      ? (this.currentNdaTemplate.clauses || []).findIndex((clause: any) => String(clause.id || '') === sourceClauseId)
      : -1;
    if (clauseIndex >= 0) {
      this.focusNdaClause(clauseIndex);
      return;
    }
    this.focusNdaParagraph(index);
  }

  private scrollNdaSidebarTo(id: string): void {
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  onNdaCanvasMouseDown(event: MouseEvent, type: 'placeholder' | 'paragraph' | 'highlight', index: number): void {
    this.ndaDraggingType = type;
    this.ndaDraggingIndex = index;
    this.ndaDragOffset.x = event.offsetX;
    this.ndaDragOffset.y = event.offsetY;
    event.preventDefault();
  }

  onNdaCanvasMouseMove(event: MouseEvent): void {
    if (this.ndaDraggingIndex === null || !this.ndaDraggingType) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const rawX = event.clientX - rect.left - this.ndaDragOffset.x;
    const rawY = event.clientY - rect.top - this.ndaDragOffset.y;
    const page = this.currentNdaPage;

    if (this.ndaDraggingType === 'placeholder') {
      const item = page.placeholders[this.ndaDraggingIndex];
      item.x = Math.round(Math.max(0, Math.min(rawX, this.ndaCanvasWidth - 80)));
      item.y = Math.round(Math.max(0, Math.min(rawY, this.ndaCanvasHeight - 24)));
    }
    if (this.ndaDraggingType === 'highlight') {
      const item = page.highlightedAreas[this.ndaDraggingIndex];
      item.x = Math.round(Math.max(0, Math.min(rawX, this.ndaCanvasWidth - Number(item.width || 160))));
      item.y = Math.round(Math.max(0, Math.min(rawY, this.ndaCanvasHeight - Number(item.height || 24))));
    }
    if (this.ndaDraggingType === 'paragraph') {
      const item = page.paragraphs[this.ndaDraggingIndex];
      item.x = Math.round(Math.max(0, Math.min(rawX, this.ndaCanvasWidth - Number(item.width || 400))));
      item.y = Math.round(Math.max(0, Math.min(rawY, this.ndaCanvasHeight - 36)));
    }
  }

  onNdaCanvasMouseUp(): void {
    this.ndaDraggingIndex = null;
    this.ndaDraggingType = null;
  }

  ndaPlaceholderLabel(key: string): string {
    return this.ndaAvailablePlaceholderKeys.find((item) => item.key === key)?.label || key;
  }

  previewNdaText(text: string): string {
    return String(text || '').replace(/\{\{([^}]+)\}\}/g, (_match: string, key: string) => `{{${key.trim()}}}`);
  }

  downloadCrmContractPdf(contract: any): void {
    const id = String(contract?._id || contract?.id || '');
    if (!id) return;
    this.crmService.getContractPdf(id, { companyCode: this.dashboardCode }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      },
      error: (err) => {
        this.crmActionMessage = err?.error?.message || 'Unable to open NDA PDF.';
      },
    });
  }

  openCrmContractPrintView(contract: any, event?: Event): void {
    event?.stopPropagation();
    this.downloadCrmContractPdf(contract);
  }

  generateCrmContract(type: 'SLA' | 'NDA', client = this.selectedCrmClient): void {
    if (!client) {
      this.crmActionMessage = 'Select a CRM client before generating a document.';
      return;
    }
    this.crmContractsLoading = true;
    this.crmService.generateContract({
      type,
      companyCode: client.companyCode || this.dashboardCode,
      clientCompanyName: client.companyName,
      contactName: client.primaryContact,
      contactEmail: client.primaryEmail,
      ...(type === 'NDA' ? {
        clientAddress: this.ndaGenerationDraft.clientAddress,
        effectiveFrom: this.ndaGenerationDraft.effectiveFrom,
        effectiveTo: this.ndaGenerationDraft.effectiveTo,
        projectName: this.ndaGenerationDraft.projectName,
        projectDescription: this.ndaGenerationDraft.projectDescription,
        jurisdiction: this.ndaGenerationDraft.jurisdiction,
        solicitationPeriod: this.ndaGenerationDraft.solicitationPeriod,
        validityPeriod: this.ndaGenerationDraft.validityPeriod,
        terminationNoticeDays: this.ndaGenerationDraft.terminationNoticeDays,
        noticeReceiptDays: this.ndaGenerationDraft.noticeReceiptDays,
        signatoryName: this.ndaGenerationDraft.signatoryName,
        signatoryTitle: this.ndaGenerationDraft.signatoryTitle,
        clientSignatoryTitle: this.ndaGenerationDraft.clientSignatoryTitle,
        ndaTemplate: this.normalizeNdaTemplate(this.ndaTemplate),
      } : {}),
    }).subscribe({
      next: (res) => {
        this.crmContractsLoading = false;
        if (res?.success && res.contract) {
          this.crmContracts = [res.contract, ...this.crmContracts.filter((item) => item._id !== res.contract._id)];
          this.crmActionMessage = `${type} generated for ${client.companyName}.`;
          this.fetchCrmClients();
        }
      },
      error: (err) => {
        this.crmContractsLoading = false;
        this.crmActionMessage = err?.error?.message || `Unable to generate ${type}.`;
      },
    });
  }

  fetchCrmAmc(): void {
    this.crmAmcLoading = true;
    this.crmService.getAmc({ search: this.crmClientSearch, companyCode: this.dashboardCode, view: this.crmAmcView }).subscribe({
      next: (res) => {
        this.crmAmcLoading = false;
        this.crmAmcRows = (res?.amc || []).map((row: CrmAmcRow) => this.normalizeCrmAmcRow(row));
        this.crmAmcAnalytics = res?.analytics || null;
      },
      error: (err) => {
        this.crmAmcLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to load AMC tracking.';
      },
    });
  }

  normalizeCrmAmcRow(row: CrmAmcRow): CrmAmcRow {
    const domainPurchaseDate = this.inputDateValue(row.domainPurchaseDate);
    return {
      ...row,
      id: row.id || row._id,
      clientId: row.clientId || '',
      domainPurchaseDate,
      renewalDate: this.inputDateValue(row.renewalDate) || this.nextAnnualRenewalDate(domainPurchaseDate),
      annualFee: Number(row.annualFee || 0),
      outstandingAmount: Number(row.outstandingAmount || 0),
      paymentStatus: row.paymentStatus || 'Unpaid',
      status: row.status || 'Not Configured',
      daysUntilRenewal: row.daysUntilRenewal ?? this.daysUntilDate(row.renewalDate),
      blocked: !!row.blocked || row.status === 'Blocked',
      canManualBlock: !!row.canManualBlock,
    };
  }

  onCrmAmcPurchaseDateChange(row: CrmAmcRow): void {
    row.domainPurchaseDate = this.inputDateValue(row.domainPurchaseDate);
    row.renewalDate = this.nextAnnualRenewalDate(row.domainPurchaseDate);
  }

  saveCrmAmcDomain(row: CrmAmcRow): void {
    if (!row.clientCompanyName || !row.domainPurchaseDate) {
      this.crmActionMessage = 'Add the client domain purchase date before saving AMC tracking.';
      return;
    }
    this.crmAmcLoading = true;
    this.crmService.updateAmc(this.crmAmcPayload(row)).subscribe({
      next: (res) => {
        this.crmAmcLoading = false;
        const updated = this.normalizeCrmAmcRow(res?.amc || row);
        this.crmAmcRows = this.crmAmcRows.map((item) => this.sameCrmAmcRow(item, row) ? updated : item);
        this.crmActionMessage = `AMC renewal tracking saved for ${row.clientCompanyName}.`;
        this.fetchCrmClients();
      },
      error: (err) => {
        this.crmAmcLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to save AMC tracking.';
      },
    });
  }

  setCrmAmcPaymentStatus(row: CrmAmcRow, statusValue: string): void {
    const status: 'Paid' | 'Unpaid' = statusValue === 'Paid' ? 'Paid' : 'Unpaid';
    row.paymentStatus = status;
    row.outstandingAmount = status === 'Paid' ? 0 : Number(row.outstandingAmount || row.annualFee || 0);
    if (row.id || row._id) {
      this.crmAmcLoading = true;
      this.crmService.updateAmcStatus({
        id: row.id || row._id || '',
        paymentStatus: status,
        outstandingAmount: row.outstandingAmount,
      }).subscribe({
        next: (res) => {
          this.crmAmcLoading = false;
          const updated = this.normalizeCrmAmcRow(res?.amc || row);
          this.crmAmcRows = this.crmAmcRows.map((item) => this.sameCrmAmcRow(item, row) ? updated : item);
          this.crmActionMessage = `${row.clientCompanyName} marked ${status}.`;
          this.fetchCrmClients();
        },
        error: (err) => {
          this.crmAmcLoading = false;
          this.crmActionMessage = err?.error?.message || 'Unable to update AMC payment status.';
        },
      });
      return;
    }
    this.saveCrmAmcDomain(row);
  }

  blockCrmAmcClient(row: CrmAmcRow): void {
    this.crmAmcOpenMenuKey = '';
    if (!row.canManualBlock && !this.canBlockCrmAmc(row)) {
      this.crmActionMessage = 'Manual block is available only for unpaid AMC records in the last 3 days before renewal or overdue.';
      return;
    }
    if (row.id || row._id) {
      this.crmAmcLoading = true;
      this.crmService.blockAmcDomain({
        id: row.id || row._id || '',
        reason: 'Manual AMC block from CRM',
      }).subscribe({
        next: (res) => {
          this.crmAmcLoading = false;
          const updated = this.normalizeCrmAmcRow(res?.amc || { ...row, status: 'Blocked', blocked: true });
          this.crmAmcRows = this.crmAmcRows.map((item) => this.sameCrmAmcRow(item, row) ? updated : item);
          this.crmActionMessage = `${row.clientCompanyName} AMC domain blocked.`;
          this.fetchCrmClients();
        },
        error: (err) => {
          this.crmAmcLoading = false;
          this.crmActionMessage = err?.error?.message || 'Unable to block AMC domain.';
        },
      });
      return;
    }
    this.saveCrmAmcDomain({ ...row, blockClient: true, blockReason: 'Manual AMC block from CRM' } as CrmAmcRow & { blockClient?: boolean; blockReason?: string });
  }

  removeCrmAmcMapping(row: CrmAmcRow): void {
    this.crmAmcOpenMenuKey = '';
    const id = row.id || row._id || '';
    if (!id) return;
    this.crmAmcLoading = true;
    this.crmService.removeAmcMapping(id).subscribe({
      next: () => {
        this.crmAmcLoading = false;
        this.crmAmcRows = this.crmAmcRows.filter((item) => (item.id || item._id) !== id);
        this.crmActionMessage = `${row.clientCompanyName} AMC mapping removed.`;
        this.fetchCrmClients();
        this.fetchCrmHostingerDomains();
      },
      error: (err) => {
        this.crmAmcLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to remove AMC mapping.';
      },
    });
  }

  importHostingerAmcDomains(): void {
    this.crmHostingerImportLoading = true;
    this.crmService.importHostingerDomains({ companyCode: this.dashboardCode, autoMap: true }).subscribe({
      next: (res) => {
        this.crmHostingerImportLoading = false;
        this.crmActionMessage = res?.message || 'Hostinger domain dates imported.';
        this.fetchCrmAmc();
        this.fetchCrmClients();
      },
      error: (err) => {
        this.crmHostingerImportLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to import Hostinger domain dates.';
      },
    });
  }

  openCrmHostingerMappingModal(): void {
    this.crmHostingerMappingOpen = true;
    this.crmMappingDomainSearch = '';
    this.crmMappingClientSearch = '';
    this.selectedCrmHostingerDomainName = '';
    this.selectedCrmMappingClientId = '';
    this.selectedCrmMappingClientCompany = '';
    this.crmMappingAnnualFee = 0;
    this.crmMappingOwner = '';
    if (this.crmHostingerDomains.length === 0) {
      this.fetchCrmHostingerDomains();
    }
  }

  closeCrmHostingerMappingModal(): void {
    this.crmHostingerMappingOpen = false;
  }

  fetchCrmHostingerDomains(): void {
    this.crmHostingerDomainsLoading = true;
    this.crmService.getHostingerDomains({ companyCode: this.dashboardCode, search: this.crmClientSearch }).subscribe({
      next: (res) => {
        this.crmHostingerDomainsLoading = false;
        this.crmHostingerDomains = (res?.domains || []).map((domain: CrmHostingerDomain) => this.normalizeCrmHostingerDomain(domain));
        this.seedCrmHostingerMappingDrafts();
      },
      error: (err) => {
        this.crmHostingerDomainsLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to fetch Hostinger domains.';
      },
    });
  }

  normalizeCrmHostingerDomain(domain: CrmHostingerDomain): CrmHostingerDomain {
    return {
      ...domain,
      domainPurchaseDate: this.inputDateValue(domain.domainPurchaseDate),
      hostingerRegisteredAt: this.inputDateValue(domain.hostingerRegisteredAt),
      hostingerCreatedAt: this.inputDateValue(domain.hostingerCreatedAt),
      hostingerExpiresAt: this.inputDateValue(domain.hostingerExpiresAt),
      existingMapping: domain.existingMapping ? this.normalizeCrmAmcRow(domain.existingMapping) : null,
      suggestions: Array.isArray(domain.suggestions) ? domain.suggestions : [],
    };
  }

  seedCrmHostingerMappingDrafts(): void {
    this.crmHostingerDomains.forEach((domain) => {
      const key = this.crmHostingerDomainKey(domain);
      if (this.crmHostingerMappingDrafts[key]) return;
      this.crmHostingerMappingDrafts[key] = {
        clientId: domain.existingMapping?.clientId || '',
        clientCompanyName: domain.existingMapping?.clientCompanyName || '',
        annualFee: Number(domain.existingMapping?.annualFee || 0),
        owner: domain.existingMapping?.owner || '',
      };
    });
  }

  crmHostingerDomainKey(domain: CrmHostingerDomain | string): string {
    const value = typeof domain === 'string' ? domain : domain.domainName;
    return String(value || '').trim().toLowerCase();
  }

  crmHostingerDraft(domain: CrmHostingerDomain): { clientId: string; clientCompanyName: string; annualFee: number; owner: string } {
    const key = this.crmHostingerDomainKey(domain);
    if (!this.crmHostingerMappingDrafts[key]) {
      this.crmHostingerMappingDrafts[key] = { clientId: '', clientCompanyName: '', annualFee: 0, owner: '' };
    }
    return this.crmHostingerMappingDrafts[key];
  }

  crmHostingerDraftValue(domain: CrmHostingerDomain, field: 'clientId' | 'clientCompanyName' | 'annualFee' | 'owner'): string | number {
    return this.crmHostingerDraft(domain)[field];
  }

  updateCrmHostingerDraft(domain: CrmHostingerDomain, field: 'clientId' | 'clientCompanyName' | 'annualFee' | 'owner', value: string | number): void {
    const draft = this.crmHostingerDraft(domain);
    if (field === 'annualFee') {
      draft.annualFee = Number(value || 0);
      return;
    }
    draft[field] = String(value || '');
  }

  get crmHostingerSelectedMappingCount(): number {
    return this.crmHostingerSelectedMappings().length;
  }

  crmHostingerSelectedMappings(): Array<{ domainName: string; clientId: string; clientCompanyName: string; annualFee?: number; owner?: string }> {
    return this.crmHostingerDomains
      .map((domain) => {
        const draft = this.crmHostingerDraft(domain);
        return {
          domainName: domain.domainName,
          clientId: draft.clientId,
          clientCompanyName: draft.clientCompanyName,
          annualFee: Number(draft.annualFee || 0),
          owner: draft.owner,
        };
      })
      .filter((mapping) => !!mapping.domainName && !!mapping.clientId && !!mapping.clientCompanyName);
  }

  saveCrmHostingerDomainMapping(domain: CrmHostingerDomain): void {
    const draft = this.crmHostingerDraft(domain);
    if (!draft.clientId) {
      this.crmActionMessage = 'Select a CRM client before saving this Hostinger domain mapping.';
      return;
    }
    this.importCrmHostingerMappings([{
      domainName: domain.domainName,
      clientId: draft.clientId,
      clientCompanyName: draft.clientCompanyName,
      annualFee: Number(draft.annualFee || 0),
      owner: draft.owner,
    }]);
  }

  importSelectedCrmHostingerMappings(): void {
    const mappings = this.crmHostingerSelectedMappings();
    if (!mappings.length) {
      this.crmActionMessage = 'Select at least one Hostinger domain and CRM client mapping.';
      return;
    }
    this.importCrmHostingerMappings(mappings);
  }

  importCrmHostingerMappings(mappings: Array<{ domainName: string; clientId?: string; clientCompanyName: string; annualFee?: number; owner?: string }>): void {
    this.crmHostingerImportLoading = true;
    this.crmService.importHostingerDomains({ companyCode: this.dashboardCode, autoMap: false, mappings }).subscribe({
      next: (res) => {
        this.crmHostingerImportLoading = false;
        this.crmActionMessage = res?.message || 'Hostinger domain mapping saved.';
        this.fetchCrmAmc();
        this.fetchCrmClients();
        this.fetchCrmHostingerDomains();
      },
      error: (err) => {
        this.crmHostingerImportLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to save Hostinger domain mapping.';
      },
    });
  }

  get filteredCrmHostingerDomainsForMapping(): CrmHostingerDomain[] {
    const query = this.crmMappingDomainSearch.trim().toLowerCase();
    const domains = query
      ? this.crmHostingerDomains.filter((domain) => [
        domain.domainName,
        domain.hostingerStatus,
        domain.existingMapping?.clientId,
        domain.existingMapping?.clientCompanyName,
      ].some((value) => String(value || '').toLowerCase().includes(query)))
      : this.crmHostingerDomains;
    return domains.slice(0, 50);
  }

  get filteredCrmMappingClients(): CrmClient[] {
    const query = this.crmMappingClientSearch.trim().toLowerCase();
    const clients = query
      ? this.crmClients.filter((client) => [
        client.companyName,
        client.clientId,
        client.primaryContact,
        client.primaryEmail,
        client.primaryPhone,
      ].some((value) => String(value || '').toLowerCase().includes(query)))
      : this.crmClients;
    return clients.slice(0, 80);
  }

  get selectedCrmHostingerDomain(): CrmHostingerDomain | null {
    return this.crmHostingerDomains.find((domain) => domain.domainName === this.selectedCrmHostingerDomainName) || null;
  }

  get selectedCrmMappingClient(): CrmClient | null {
    return this.crmClients.find((client) => client.clientId === this.selectedCrmMappingClientId) || null;
  }

  selectCrmHostingerDomainForMapping(domain: CrmHostingerDomain): void {
    this.selectedCrmHostingerDomainName = domain.domainName;
    const draft = this.crmHostingerDraft(domain);
    this.selectedCrmMappingClientId = draft.clientId || domain.existingMapping?.clientId || '';
    this.selectedCrmMappingClientCompany = draft.clientCompanyName || domain.existingMapping?.clientCompanyName || '';
    this.crmMappingAnnualFee = Number(draft.annualFee || domain.existingMapping?.annualFee || 0);
    this.crmMappingOwner = draft.owner || domain.existingMapping?.owner || '';
  }

  selectCrmClientForHostingerMapping(client: CrmClient): void {
    this.selectedCrmMappingClientId = client.clientId || '';
    this.selectedCrmMappingClientCompany = client.companyName;
    const domain = this.selectedCrmHostingerDomain;
    if (domain) {
      const draft = this.crmHostingerDraft(domain);
      draft.clientId = client.clientId || '';
      draft.clientCompanyName = client.companyName;
    }
    if (!this.crmMappingOwner) this.crmMappingOwner = client.managers?.[0] || '';
  }

  saveCrmHostingerModalMapping(): void {
    const domain = this.selectedCrmHostingerDomain;
    if (!domain || !this.selectedCrmMappingClientId || !this.selectedCrmMappingClientCompany) {
      this.crmActionMessage = 'Select one Hostinger domain and one onboarded client before saving.';
      return;
    }
    this.importCrmHostingerMappings([{
      domainName: domain.domainName,
      clientId: this.selectedCrmMappingClientId,
      clientCompanyName: this.selectedCrmMappingClientCompany,
      annualFee: Number(this.crmMappingAnnualFee || 0),
      owner: this.crmMappingOwner,
    }]);
  }

  setCrmAmcView(view: 'all' | 'paid' | 'unpaid' | 'upcoming' | 'blocked'): void {
    this.crmAmcView = view;
    this.fetchCrmAmc();
  }

  canBlockCrmAmc(row: CrmAmcRow): boolean {
    const days = row.daysUntilRenewal ?? this.daysUntilDate(row.renewalDate);
    return row.paymentStatus !== 'Paid' && !row.blocked && days !== null && days <= 3;
  }

  isCrmAmcOverdue(row: CrmAmcRow): boolean {
    const days = row.daysUntilRenewal ?? this.daysUntilDate(row.renewalDate);
    return days !== null && days < 0;
  }

  crmAmcStatusClass(row: CrmAmcRow): string {
    const status = String(row.status || '').toLowerCase();
    if (status.includes('blocked')) return 'crm-status-blocked';
    if (status.includes('unpaid')) return 'crm-status-unpaid';
    if (status.includes('upcoming')) return 'crm-status-upcoming';
    if (status.includes('paid')) return 'crm-status-paid';
    return '';
  }

  crmAmcRowKey(row: CrmAmcRow): string {
    return row.id || row._id || `${row.clientId || row.clientCompanyName}:${row.domainName}`;
  }

  toggleCrmAmcRowMenu(row: CrmAmcRow, event?: Event): void {
    event?.stopPropagation();
    const key = this.crmAmcRowKey(row);
    this.crmAmcOpenMenuKey = this.crmAmcOpenMenuKey === key ? '' : key;
  }

  isCrmAmcRowMenuOpen(row: CrmAmcRow): boolean {
    return this.crmAmcOpenMenuKey === this.crmAmcRowKey(row);
  }

  crmAmcPayload(row: CrmAmcRow & { blockClient?: boolean; blockReason?: string }) {
    return {
      companyCode: row.companyCode || this.dashboardCode,
      clientId: row.clientId || '',
      clientCompanyName: row.clientCompanyName,
      domainName: row.domainName,
      hostingerDomainId: row.hostingerDomainId,
      domainPurchaseDate: this.inputDateValue(row.domainPurchaseDate),
      renewalDate: this.inputDateValue(row.renewalDate),
      annualFee: Number(row.annualFee || 0),
      outstandingAmount: Number(row.outstandingAmount || 0),
      paymentStatus: row.paymentStatus || 'Unpaid',
      blockClient: !!row.blockClient,
      blockReason: row.blockReason,
    };
  }

  sameCrmAmcRow(a: CrmAmcRow, b: CrmAmcRow): boolean {
    return (!!a._id && a._id === b._id)
      || (!!a.id && a.id === b.id)
      || (!!a.clientId && a.clientId === b.clientId && a.domainName === b.domainName)
      || a.clientCompanyName === b.clientCompanyName;
  }

  inputDateValue(value?: string): string {
    if (!value) return '';
    return String(value).substring(0, 10);
  }

  parseInputDate(value?: string): Date | null {
    const dateValue = this.inputDateValue(value);
    if (!dateValue) return null;
    const date = new Date(`${dateValue}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  nextAnnualRenewalDate(value?: string): string {
    const purchaseDate = this.parseInputDate(value);
    if (!purchaseDate) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let renewalDate = new Date(today.getFullYear(), purchaseDate.getMonth(), purchaseDate.getDate());
    if (renewalDate.getMonth() !== purchaseDate.getMonth()) {
      renewalDate = new Date(today.getFullYear(), purchaseDate.getMonth() + 1, 0);
    }
    if (renewalDate.getTime() < today.getTime()) {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }
    return renewalDate.toISOString().substring(0, 10);
  }

  daysUntilDate(value?: string): number | null {
    const date = this.parseInputDate(value);
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  fetchCrmPayments(): void {
    this.crmPaymentsLoading = true;
    this.crmService.getPayments({ companyCode: this.dashboardCode, clientCompanyName: this.selectedCrmClientCompany }).subscribe({
      next: (res) => {
        this.crmPaymentsLoading = false;
        this.crmPaymentRows = res?.payments || [];
        this.crmPaymentAnalytics = res?.analytics || null;
      },
      error: (err) => {
        this.crmPaymentsLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to load CRM payments.';
      },
    });
  }

  generateCrmPaidInvoice(client = this.selectedCrmClient): void {
    if (!client || !this.crmPaidInvoiceAmount) {
      this.crmActionMessage = 'Select a client and enter a paid amount.';
      return;
    }
    this.crmPaymentsLoading = true;
    this.crmService.generatePaidInvoice({
      companyCode: client.companyCode || this.dashboardCode,
      clientCompanyName: client.companyName,
      amount: this.crmPaidInvoiceAmount,
      paidAmount: this.crmPaidInvoiceAmount,
      paymentMode: 'Manual',
    }).subscribe({
      next: () => {
        this.crmPaidInvoiceAmount = 0;
        this.crmActionMessage = `Paid invoice generated for ${client.companyName}.`;
        this.fetchCrmPayments();
      },
      error: (err) => {
        this.crmPaymentsLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to generate paid invoice.';
      },
    });
  }

  fetchCrmTickets(): void {
    this.crmTicketsLoading = true;
    this.ticketService.getCrmTickets({
      companyCode: this.dashboardCode,
      clientCompanyName: this.selectedCrmClientCompany,
      search: this.crmTicketSearch,
      status: this.crmTicketStatusFilter,
      priority: this.crmTicketPriorityFilter,
      category: this.crmTicketCategoryFilter,
    }).subscribe({
      next: (res) => {
        this.crmTicketsLoading = false;
        this.crmTicketRows = res?.tickets || [];
        if (!this.selectedCrmTicketId || !this.crmTicketRows.some((ticket) => ticket.id === this.selectedCrmTicketId)) {
          this.selectedCrmTicketId = this.crmTicketRows[0]?.id || '';
        }
      },
      error: (err) => {
        this.crmTicketsLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to load tickets.';
      },
    });
  }

  get selectedCrmTicket(): CrmTicket | null {
    return this.crmTicketRows.find((ticket) => ticket.id === this.selectedCrmTicketId) || this.crmTicketRows[0] || null;
  }

  get crmTicketAnalytics(): { open: number; inProgress: number; waiting: number; resolved: number } {
    return this.crmTicketRows.reduce((acc, ticket) => {
      if (ticket.status === 'In Progress') acc.inProgress += 1;
      else if (ticket.status === 'Waiting on Client') acc.waiting += 1;
      else if (ticket.status === 'Resolved' || ticket.status === 'Closed') acc.resolved += 1;
      else acc.open += 1;
      return acc;
    }, { open: 0, inProgress: 0, waiting: 0, resolved: 0 });
  }

  setCrmTicketSearch(value: string): void {
    this.crmTicketSearch = value;
    this.fetchCrmTickets();
  }

  setCrmTicketStatusFilter(value: string): void {
    this.crmTicketStatusFilter = (value || 'all') as typeof this.crmTicketStatusFilter;
    this.fetchCrmTickets();
  }

  setCrmTicketPriorityFilter(value: string): void {
    this.crmTicketPriorityFilter = (value || 'all') as typeof this.crmTicketPriorityFilter;
    this.fetchCrmTickets();
  }

  setCrmTicketCategoryFilter(value: string): void {
    this.crmTicketCategoryFilter = (value || 'all') as typeof this.crmTicketCategoryFilter;
    this.fetchCrmTickets();
  }

  selectCrmTicket(ticket: CrmTicket): void {
    this.selectedCrmTicketId = ticket.id;
    this.crmTicketRemarkDraft = '';
  }

  setCrmTicketStatus(ticket: CrmTicket, status: string): void {
    ticket.status = status;
    this.crmTicketsLoading = true;
    this.ticketService.updateCrmTicketStatus(ticket.id, status).subscribe({
      next: (res) => {
        this.crmTicketsLoading = false;
        const updated = res?.ticket || ticket;
        this.crmTicketRows = this.crmTicketRows.map((item) => item.id === updated.id ? updated : item);
        this.crmActionMessage = `${ticket.clientCompanyName} ticket marked ${status}.`;
      },
      error: (err) => {
        this.crmTicketsLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to update ticket status.';
        this.fetchCrmTickets();
      },
    });
  }

  addCrmTicketRemark(ticket = this.selectedCrmTicket): void {
    const message = this.crmTicketRemarkDraft.trim();
    if (!ticket || !message) return;
    this.crmTicketsLoading = true;
    this.ticketService.addCrmTicketRemark(ticket.id, message).subscribe({
      next: (res) => {
        this.crmTicketsLoading = false;
        const updated = res?.ticket || ticket;
        this.crmTicketRows = this.crmTicketRows.map((item) => item.id === updated.id ? updated : item);
        this.selectedCrmTicketId = updated.id;
        this.crmTicketRemarkDraft = '';
        this.crmActionMessage = 'Ticket response added.';
      },
      error: (err) => {
        this.crmTicketsLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to add ticket response.';
      },
    });
  }

  downloadCrmTicketAttachment(ticket: CrmTicket, attachment: { id: string; originalName: string }): void {
    if (!ticket?.id || !attachment?.id) return;
    this.ticketService.downloadCrmTicketAttachment(ticket.id, attachment.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = attachment.originalName || 'ticket-attachment';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.crmActionMessage = err?.error?.message || 'Unable to download ticket attachment.';
      },
    });
  }

  crmTicketStatusClass(status = ''): string {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('resolved') || normalized.includes('closed')) return 'crm-status-paid';
    if (normalized.includes('waiting')) return 'crm-status-upcoming';
    if (normalized.includes('progress')) return 'crm-status-upcoming';
    return 'crm-status-unpaid';
  }

  fetchCrmProjects(): void {
    this.crmProjectsLoading = true;
    this.crmService.getProjects({
      companyCode: this.dashboardCode,
      status: this.crmProjectStatusFilter,
    }).subscribe({
      next: (res) => {
        this.crmProjectsLoading = false;
        this.crmProjectRows = (res?.projects || []).map((project: CrmProjectRow) => this.normalizeCrmProjectRow(project));
      },
      error: () => {
        this.crmProjectsLoading = false;
        this.crmProjectRows = [];
      },
    });
  }

  normalizeCrmProjectRow(project: CrmProjectRow): CrmProjectRow {
    return {
      ...project,
      id: project.id || project._id,
      clientId: project.clientId || '',
      status: project.status || 'Assigned',
      clientStatus: project.clientStatus || this.crmProjectClientStatus(project.clientCompanyName),
    };
  }

  get crmProjectManagerOptions(): Array<{ name: string; mobile: string; email?: string }> {
    const employeeManagers = this.employees
      .map((employee) => ({
        name: String(employee.name || this.crmManagerName(employee.mobile) || '').trim(),
        mobile: String(employee.mobile || '').trim(),
        email: String((employee as any).email || '').trim(),
      }))
      .filter((employee) => employee.name || employee.mobile);
    const clientManagers = this.crmClients
      .flatMap((client) => client.managers || [])
      .map((phone) => String(phone || '').trim())
      .filter(Boolean)
      .map((phone) => ({ name: this.crmManagerName(phone), mobile: phone, email: '' }));
    return Array.from(new Map([...employeeManagers, ...clientManagers].map((manager) => [manager.mobile || manager.name, manager])).values());
  }

  get crmProjectAnalytics(): { assigned: number; inProgress: number; onHold: number; completed: number } {
    return this.crmProjectRows.reduce((acc, project) => {
      const status = String(project.status || 'Assigned');
      if (status === 'Completed') acc.completed += 1;
      else if (status === 'On Hold') acc.onHold += 1;
      else if (status === 'In Progress') acc.inProgress += 1;
      else acc.assigned += 1;
      return acc;
    }, { assigned: 0, inProgress: 0, onHold: 0, completed: 0 });
  }

  get filteredCrmPaymentRows(): any[] {
    const query = this.crmPaymentSearch.trim().toLowerCase();
    if (!query) return this.crmPaymentRows;
    return this.crmPaymentRows.filter((payment) => [
      payment.invoiceNumber,
      payment.clientCompanyName,
      payment.status,
      payment.amount,
      payment.paidAmount,
      payment.paymentMode,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }

  get filteredCrmProjectRows(): CrmProjectRow[] {
    const query = this.crmProjectSearch.trim().toLowerCase();
    return this.crmProjectRows
      .filter((project) => this.crmProjectStatusFilter === 'all' || project.status === this.crmProjectStatusFilter)
      .filter((project) => !query || [
        project.clientCompanyName,
        project.clientId,
        project.clientStatus,
        project.projectManagerName,
        project.projectManagerPhone,
        project.projectManagerEmail,
        project.status,
        project.notes,
      ].some((value) => String(value || '').toLowerCase().includes(query)));
  }

  get filteredCrmProjectMappingClients(): CrmClient[] {
    const query = this.crmProjectClientSearch.trim().toLowerCase();
    const clients = query
      ? this.crmClients.filter((client) => [
        client.companyName,
        client.clientId,
        client.primaryContact,
        client.primaryEmail,
        client.primaryPhone,
      ].some((value) => String(value || '').toLowerCase().includes(query)))
      : this.crmClients;
    return clients.slice(0, 80);
  }

  get filteredCrmProjectManagers(): Array<{ name: string; mobile: string; email?: string }> {
    const query = this.crmProjectManagerSearch.trim().toLowerCase();
    const managers = query
      ? this.crmProjectManagerOptions.filter((manager) => [
        manager.name,
        manager.mobile,
        manager.email,
      ].some((value) => String(value || '').toLowerCase().includes(query)))
      : this.crmProjectManagerOptions;
    return managers.slice(0, 80);
  }

  get selectedCrmProjectClient(): CrmClient | null {
    return this.crmClients.find((client) => client.clientId === this.selectedCrmProjectClientId) || null;
  }

  get selectedCrmProjectManager(): { name: string; mobile: string; email?: string } | null {
    return this.crmProjectManagerOptions.find((manager) => this.crmProjectManagerKey(manager) === this.selectedCrmProjectManagerKey) || null;
  }

  crmProjectManagerKey(manager: { name?: string; mobile?: string; email?: string }): string {
    return String(manager.mobile || manager.email || manager.name || '').trim();
  }

  openCrmProjectMappingModal(): void {
    this.crmProjectMappingOpen = true;
    this.crmProjectClientSearch = '';
    this.crmProjectManagerSearch = '';
    this.selectedCrmProjectClientId = '';
    this.selectedCrmProjectClientCompany = '';
    this.selectedCrmProjectManagerKey = '';
    this.crmProjectDraft = {
      clientId: '',
      clientCompanyName: '',
      projectManagerName: '',
      projectManagerPhone: '',
      projectManagerEmail: '',
      status: 'Assigned',
      notes: '',
    };
  }

  closeCrmProjectMappingModal(): void {
    this.crmProjectMappingOpen = false;
  }

  setCrmProjectStatusFilter(status: 'all' | 'Assigned' | 'In Progress' | 'On Hold' | 'Completed'): void {
    this.crmProjectStatusFilter = status;
    this.fetchCrmProjects();
  }

  crmProjectClientStatus(clientCompanyName = ''): string {
    return this.crmClients.find((client) => client.companyName === clientCompanyName)?.status || 'Onboarded';
  }

  selectCrmProjectClientForMapping(client: CrmClient): void {
    this.selectedCrmProjectClientId = client.clientId || '';
    this.selectedCrmProjectClientCompany = client.companyName;
    this.crmProjectDraft.clientId = client.clientId || '';
    this.crmProjectDraft.clientCompanyName = client.companyName;
  }

  selectCrmProjectManagerForMapping(manager: { name: string; mobile: string; email?: string }): void {
    this.selectedCrmProjectManagerKey = this.crmProjectManagerKey(manager);
    this.crmProjectDraft.projectManagerName = manager.name;
    this.crmProjectDraft.projectManagerPhone = manager.mobile;
    this.crmProjectDraft.projectManagerEmail = manager.email || '';
  }

  onCrmProjectManagerChange(phone: string): void {
    const manager = this.crmProjectManagerOptions.find((item) => item.mobile === phone);
    if (!manager) return;
    this.crmProjectDraft.projectManagerName = manager.name;
    this.crmProjectDraft.projectManagerPhone = manager.mobile;
    this.crmProjectDraft.projectManagerEmail = manager.email || '';
  }

  saveCrmProjectMapping(): void {
    const client = this.crmClients.find((item) => item.clientId === this.crmProjectDraft.clientId);
    if (!this.crmProjectDraft.clientId || !this.crmProjectDraft.clientCompanyName || !this.crmProjectDraft.projectManagerName) return;

    this.crmProjectsLoading = true;
    this.crmService.mapProject({
      companyCode: client?.companyCode || this.dashboardCode,
      clientId: this.crmProjectDraft.clientId,
      clientCompanyName: this.crmProjectDraft.clientCompanyName,
      clientStatus: client?.status || 'Onboarded',
      projectManagerName: this.crmProjectDraft.projectManagerName,
      projectManagerPhone: this.crmProjectDraft.projectManagerPhone,
      projectManagerEmail: this.crmProjectDraft.projectManagerEmail,
      status: this.crmProjectDraft.status,
      notes: this.crmProjectDraft.notes,
    }).subscribe({
      next: (res) => {
        this.crmProjectsLoading = false;
        const updated = this.normalizeCrmProjectRow(res?.project || this.crmProjectDraft as CrmProjectRow);
        this.crmProjectRows = [updated, ...this.crmProjectRows.filter((item) => (item.clientId || item.clientCompanyName) !== (updated.clientId || updated.clientCompanyName))];
        this.closeCrmProjectMappingModal();
        this.crmProjectDraft = {
          clientId: '',
          clientCompanyName: '',
          projectManagerName: '',
          projectManagerPhone: '',
          projectManagerEmail: '',
          status: 'Assigned',
          notes: '',
        };
      },
      error: () => {
        this.crmProjectsLoading = false;
      },
    });
  }

  setCrmProjectStatus(project: CrmProjectRow, status: string): void {
    project.status = status;
    const id = project.id || project._id || '';
    if (!id) return;

    this.crmProjectsLoading = true;
    this.crmService.updateProjectStatus({ id, status, notes: project.notes }).subscribe({
      next: (res) => {
        this.crmProjectsLoading = false;
        const updated = this.normalizeCrmProjectRow(res?.project || project);
        this.crmProjectRows = this.crmProjectRows.map((item) => (item.id || item._id) === (updated.id || updated._id) ? updated : item);
      },
      error: () => {
        this.crmProjectsLoading = false;
      },
    });
  }

  crmProjectRowKey(project: CrmProjectRow): string {
    return project.id || project._id || project.clientId || project.clientCompanyName;
  }

  toggleCrmProjectRowMenu(project: CrmProjectRow, event?: Event): void {
    event?.stopPropagation();
    const key = this.crmProjectRowKey(project);
    this.crmProjectOpenMenuKey = this.crmProjectOpenMenuKey === key ? '' : key;
  }

  isCrmProjectRowMenuOpen(project: CrmProjectRow): boolean {
    return this.crmProjectOpenMenuKey === this.crmProjectRowKey(project);
  }

  removeCrmProjectMapping(project: CrmProjectRow): void {
    this.crmProjectOpenMenuKey = '';
    const id = project.id || project._id || '';
    if (!id) return;
    this.crmProjectsLoading = true;
    this.crmService.removeProjectMapping(id).subscribe({
      next: () => {
        this.crmProjectsLoading = false;
        this.crmProjectRows = this.crmProjectRows.filter((item) => (item.id || item._id) !== id);
        this.crmActionMessage = `${project.clientCompanyName} project assignment removed.`;
      },
      error: (err) => {
        this.crmProjectsLoading = false;
        this.crmActionMessage = err?.error?.message || 'Unable to remove project assignment.';
      },
    });
  }

  preloadDashboardData(): void {
    this.summaryLoading = true;
    this.empCallLoading = true;

    const periods = ['today', 'yesterday', 'lastweek'];
    let loadedCount = 0;

    periods.forEach(period => {
      // Fetch summary
      this.callLogService.getSummary(this.dashboardCode, period).subscribe({
        next: (res: any) => {
          this.preloadedCache[period].summaryLoaded = true;
          if (res.success) {
            this.preloadedCache[period].summary = res.stats;
            this.fetchPreviousStatsForCache(res.from, res.to, period);
          }
          if (period === this.selectedPeriod) this.applyFilterLocally();
        },
        error: () => {
          this.preloadedCache[period].summaryLoaded = true;
          if (period === this.selectedPeriod) this.applyFilterLocally();
        }
      });

      // Fetch timeline
      this.callLogService.getTimeline(this.dashboardCode, period).subscribe({
        next: (res: any) => {
          this.preloadedCache[period].timelineLoaded = true;
          if (res.success) {
            this.preloadedCache[period].timeline = res.timeline;
          }
          if (period === this.selectedPeriod) this.applyFilterLocally();
        },
        error: () => {
          this.preloadedCache[period].timelineLoaded = true;
          if (period === this.selectedPeriod) this.applyFilterLocally();
        }
      });

      // Fetch employees stats
      this.callLogService.getEmployeesStats(this.dashboardCode, period).subscribe({
        next: (res: any) => {
          this.preloadedCache[period].employeesLoaded = true;
          if (res.success) {
            this.preloadedCache[period].employees = res.employees;
          }
          if (period === this.selectedPeriod) this.applyFilterLocally();
        },
        error: () => {
          this.preloadedCache[period].employeesLoaded = true;
          if (period === this.selectedPeriod) this.applyFilterLocally();
        }
      });
    });
  }

  // We rewrite fetchSummary to instantly return preloaded data if available, and to show loading ONLY if not.
  fetchSummary(forceReload = false): void {
    // If we have it preloaded, skip hitting the API
    if (!forceReload && this.selectedPeriod !== 'custom' && this.preloadedCache[this.selectedPeriod].summaryLoaded) {
      this.applyFilterLocally();
      return;
    }

    this.summaryLoading = true;
    this.summaryStats = null;

    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }

    this.callLogService.getSummary(
      this.dashboardCode, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.summaryStats = res.stats;
          this.fetchPreviousStats(res.from, res.to);

          setTimeout(() => {
            if (this.dashTab === 'overview') {
              this.renderDonutChart();
              if (this.timelineData.length) this.renderTimelineChart();
            }
          }, 500);

        } else {
          this.summaryLoading = false;
        }
      },
      error: () => { this.summaryLoading = false; }
    });

    this.callLogService.getTimeline(
      this.dashboardCode, this.selectedPeriod,
      this.selectedPeriod === 'custom' ? this.customFrom : undefined,
      this.selectedPeriod === 'custom' ? (this.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.timelineData = res.timeline;
          setTimeout(() => {
            if (this.dashTab === 'overview') this.renderTimelineChart();
          }, 350);
        }
      },
      error: () => { }
    });
  }

  kpiMetrics = {
    connectRate: 0,
    durationProgress: 0,
    totalCallsProgress: 0,
    missedRate: 0,
    trends: { connected: 0, duration: 0, total: 0, missed: 0 }
  };

  fetchPreviousStats(currentFrom: string, currentTo: string): void {
    const fromDate = new Date(currentFrom);
    const toDate = new Date(currentTo || currentFrom);
    const diff = toDate.getTime() - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime() - (24 * 60 * 60 * 1000));
    const prevFrom = new Date(prevTo.getTime() - diff);

    const fromStr = prevFrom.toISOString().split('T')[0];
    const toStr = prevTo.toISOString().split('T')[0];

    this.callLogService.getSummary(this.dashboardCode, 'custom', fromStr, toStr).subscribe({
      next: (res: any) => {
        this.summaryLoading = false;
        if (res.success && res.stats) {
          this.calculateMetrics(this.summaryStats!, res.stats);
        } else {
          this.calculateMetrics(this.summaryStats!, null);
        }
      },
      error: () => {
        this.summaryLoading = false;
        this.calculateMetrics(this.summaryStats!, null);
      }
    });
  }

  fetchPreviousStatsForCache(currentFrom: string, currentTo: string, period: string): void {
    const fromDate = new Date(currentFrom);
    const toDate = new Date(currentTo || currentFrom);
    const diff = toDate.getTime() - fromDate.getTime();
    const prevTo = new Date(fromDate.getTime() - (24 * 60 * 60 * 1000));
    const prevFrom = new Date(prevTo.getTime() - diff);

    const fromStr = prevFrom.toISOString().split('T')[0];
    const toStr = prevTo.toISOString().split('T')[0];

    this.callLogService.getSummary(this.dashboardCode, 'custom', fromStr, toStr).subscribe({
      next: (res: any) => {
        this.preloadedCache[period].prevSummaryLoaded = true;
        if (res.success && res.stats) {
          this.preloadedCache[period].prevSummary = res.stats;
        }
        if (this.selectedPeriod === period) this.applyFilterLocally();
      },
      error: () => {
        this.preloadedCache[period].prevSummaryLoaded = true;
        if (this.selectedPeriod === period) this.applyFilterLocally();
      }
    });
  }

  calculateMetrics(curr: CallStats, prev: CallStats | null): void {
    const total = curr.total || 0;
    const connected = curr.connected || 0;

    // Rates (0–1)
    this.kpiMetrics.connectRate = total ? (connected / total) : 0;
    this.kpiMetrics.missedRate = total ? (curr.missed / total) : 0;

    if (prev && prev.total) {
      // Progress relative to previous period (capped at 1.0 = 100%)
      this.kpiMetrics.durationProgress = Math.min(curr.totalDuration / Math.max(prev.totalDuration, 1), 1);
      this.kpiMetrics.totalCallsProgress = Math.min(total / Math.max(prev.total, 1), 1);
      // Trends vs previous period
      this.kpiMetrics.trends.connected = this.calcTrend(connected, prev.connected);
      this.kpiMetrics.trends.total = this.calcTrend(curr.total, prev.total);
      this.kpiMetrics.trends.duration = this.calcTrend(curr.totalDuration, prev.totalDuration);
      this.kpiMetrics.trends.missed = this.calcTrend(curr.missed, prev.missed);
    } else {
      // No previous data — use rates as progress indicators
      this.kpiMetrics.durationProgress = this.kpiMetrics.connectRate; // fallback: mirror connect rate
      this.kpiMetrics.totalCallsProgress = total > 0 ? 1 : 0;           // full if there are calls
      this.kpiMetrics.trends = { connected: 0, duration: 0, total: 0, missed: 0 };
    }
  }

  calcTrend(curr: number, prev: number): number {
    if (!prev) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  onPeriodChange(p: string): void {
    this.selectedPeriod = p as any;
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.donutChart) { this.donutChart.destroy(); this.donutChart = null; }

    if (p !== 'custom') {
      // If we're toggling locally without spinners (today, yesterday, lastweek)
      this.applyFilterLocally();
      if (this.selectedEmployee) this.openEmployee(this.selectedEmployee); // drilldowns need a specific api hit
    }
  }

  // Attempts to switch to current period view instantly without hitting the API for standard views
  applyFilterLocally(): void {
    if (this.selectedPeriod === 'custom') {
      return; // Custom is handled by its explicit apply event and fetch commands
    }

    const cache = this.preloadedCache[this.selectedPeriod];

    // Only parse and display everything IF the big 3 are completely loaded, AND the employees list is loaded
    if (cache.summaryLoaded && cache.timelineLoaded && cache.employeesLoaded) {
      this.summaryStats = cache.summary || null;
      this.timelineData = cache.timeline || [];

      // We only compute metrics if prev is loaded too, or we fallback if the summary API call was successful
      if (cache.prevSummaryLoaded && cache.summary) {
        this.calculateMetrics(this.summaryStats!, cache.prevSummary);
      } else if (cache.summary) {
        this.calculateMetrics(this.summaryStats!, null);
      }

      // Delay map employee stats until `this.employees` array is successfully populated
      if (!this.employeesLoading) {
        this.mapEmployeeStats(cache.employees || []);
        this.empCallLoading = false;
      }

      setTimeout(() => {
        if (this.dashTab === 'overview') {
          if (this.summaryStats) this.renderDonutChart();
          if (this.timelineData && this.timelineData.length) this.renderTimelineChart();
        }
      }, 50);

      this.summaryLoading = false;
    }
  }

  mapEmployeeStats(stats: any[]): void {
    this.empCallLoading = false;
    const statsMap: Record<string, any> = {};
    for (const s of stats) statsMap[s.phone] = s;
    this.employeeCallRows = this.employees.map(emp => ({
      emp,
      stats: statsMap[emp.mobile] ?? null,
    }));

    // Count employees who have at least 1 call in the current period
    this.activeEmployeeCount = this.employeeCallRows.filter(r => r.stats && (r.stats.total || 0) > 0).length;
  }

  applyCustomRange(): void {
    if (!this.customFrom) return;
    this.selectedPeriod = 'custom';
    this.fetchSummary();
    this.fetchEmployeeCallRows();
    if (this.selectedEmployee) this.openEmployee(this.selectedEmployee);
  }

  fetchEmployees(): void { return this.adminEmployeesWorkflow.fetchEmployees(this); }

  fetchEmployeeCallRows(forceRefresh = false): void { return this.adminEmployeesWorkflow.fetchEmployeeCallRows(this, forceRefresh); }

  syncAll(): void { return this.adminEmployeesWorkflow.syncAll(this); }

  syncEmployee(): void { return this.adminEmployeesWorkflow.syncEmployee(this); }

  // ── Employee drilldown ────────────────────────────────────
  openEmployee(emp: Employee): void { return this.adminEmployeesWorkflow.openEmployee(this, emp); }
  


  empDonutChart: Chart | null = null;
  private clearEmployeeChartRetries(): void {
    if (this.employeeChartRetryTimer) {
      clearTimeout(this.employeeChartRetryTimer);
      this.employeeChartRetryTimer = null;
    }
    if (this.employeeDonutRetryTimer) {
      clearTimeout(this.employeeDonutRetryTimer);
      this.employeeDonutRetryTimer = null;
    }
  }

  private clearOverviewChartRetries(): void {
    if (this.overviewTimelineRetryTimer) {
      clearTimeout(this.overviewTimelineRetryTimer);
      this.overviewTimelineRetryTimer = null;
    }
    if (this.overviewDonutRetryTimer) {
      clearTimeout(this.overviewDonutRetryTimer);
      this.overviewDonutRetryTimer = null;
    }
  }

  private scheduleEmployeeChartRetry(retryCount: number, target: 'chart' | 'donut'): void {
    if (retryCount >= this.maxChartRetryAttempts - 1) return;
    const timer = target === 'chart' ? this.employeeChartRetryTimer : this.employeeDonutRetryTimer;
    if (timer) clearTimeout(timer);
    const nextRetry = retryCount + 1;
    const handle = setTimeout(() => {
      if (target === 'chart') this.employeeChartRetryTimer = null;
      else this.employeeDonutRetryTimer = null;
      if (target === 'chart') this.renderChart(nextRetry);
      else this.renderEmpDonutChart(nextRetry);
    }, 120);
    if (target === 'chart') this.employeeChartRetryTimer = handle;
    else this.employeeDonutRetryTimer = handle;
  }

  private scheduleOverviewChartRetry(retryCount: number, target: 'timeline' | 'donut'): void {
    if (retryCount >= this.maxChartRetryAttempts - 1) return;
    const timer = target === 'timeline' ? this.overviewTimelineRetryTimer : this.overviewDonutRetryTimer;
    if (timer) clearTimeout(timer);
    const nextRetry = retryCount + 1;
    const handle = setTimeout(() => {
      if (target === 'timeline') this.overviewTimelineRetryTimer = null;
      else this.overviewDonutRetryTimer = null;
      if (target === 'timeline') this.renderTimelineChart(nextRetry);
      else this.renderDonutChart(nextRetry);
    }, 200);
    if (target === 'timeline') this.overviewTimelineRetryTimer = handle;
    else this.overviewDonutRetryTimer = handle;
  }

  destroyEmployeeCharts(): void {
    this.clearEmployeeChartRetries();
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.empDonutChart) { this.empDonutChart.destroy(); this.empDonutChart = null; }
  }

  renderEmpDonutChart(retryCount = 0): void {
    if (this.empDonutChart) { this.empDonutChart.destroy(); this.empDonutChart = null; }
    if (this.dashTab !== 'emp_dashboard' || !this.selectedEmployee || !this.selectedEmpStats) {
      this.clearEmployeeChartRetries();
      return;
    }
    const canvas = document.getElementById('empDonutChart') as HTMLCanvasElement;
    if (!canvas || !canvas.offsetParent) {
      this.scheduleEmployeeChartRetry(retryCount, 'donut');
      return;
    }
    if (this.employeeDonutRetryTimer) {
      clearTimeout(this.employeeDonutRetryTimer);
      this.employeeDonutRetryTimer = null;
    }

    const s = this.selectedEmpStats;
    this.empDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          data: [s.incoming || 0, s.outgoing || 0, s.missed || 0, s.rejected || 0],
          backgroundColor: [
            this.dashboardPalette.incoming,
            this.dashboardPalette.outgoing,
            this.dashboardPalette.missed,
            this.dashboardPalette.rejected
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#fff', bodyColor: '#9ca3af',
            borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
            padding: 10, cornerRadius: 8
          }
        }
      }
    });
  }

  selectEmployee(emp: Employee): void { return this.adminEmployeesWorkflow.selectEmployee(this, emp); }

  setChartType(type: 'line' | 'pie' | 'bar'): void {
    this.chartType = type;
    requestAnimationFrame(() => {
      if (this.dashTab === 'overview') {
        this.renderTimelineChart();
        return;
      }
      this.renderChart();
    });
  }

  setEmployeeChartType(type: 'line' | 'bar'): void {
    this.employeeChartType = type;
    requestAnimationFrame(() => {
      if (this.dashTab === 'emp_dashboard') {
        this.renderChart();
      }
    });
  }

  trackByCallId(index: number, call: any): any { return this.adminEmployeesWorkflow.trackByCallId(this, index, call); }

  trackByEmpId(index: number, emp: Employee): any { return this.adminEmployeesWorkflow.trackByEmpId(this, index, emp); }

  setOverviewChartType(type: 'pie' | 'bar'): void {
    this.overviewChartType = type;
    this.renderOverviewChart();
  }

  setAdminStatsView(view: 'overview' | 'bars' | 'grid'): void {
    this.adminStatsView = view;
  }

  // ── Chart renderers ───────────────────────────────────────

  renderOverviewChart(): void {
    if (this.overviewChart) { this.overviewChart.destroy(); this.overviewChart = null; }
    const canvas = document.getElementById('overviewChart') as HTMLCanvasElement;
    if (!canvas || !this.summaryStats) return;

    const textColor = 'rgba(59,59,59,0.7)';
    const gridColor = 'rgba(0,0,0,0.05)';
    const s = this.summaryStats;
    const counts = {
      incoming: s.incoming || 0, outgoing: s.outgoing || 0,
      missed: s.missed || 0, rejected: s.rejected || 0
    };

    const data = {
      labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
      datasets: [{
        label: 'Call Count',
        data: [counts.incoming, counts.outgoing, counts.missed, counts.rejected],
        backgroundColor: [
          this.dashboardPalette.incoming,
          this.dashboardPalette.outgoing,
          this.dashboardPalette.missed,
          this.dashboardPalette.rejected
        ],
        borderWidth: this.overviewChartType === 'pie' ? 2 : 0,
        borderColor: '#ffffff',
        borderRadius: this.overviewChartType === 'bar' ? 6 : 0,
        barPercentage: 0.6
      }]
    };
    const options: any = {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.overviewChartType === 'pie', position: 'right',
          labels: { color: textColor, font: { size: 12 }, padding: 15 }
        },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 8 }
      },
      scales: this.overviewChartType === 'bar' ? {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 } },
        x: { grid: { display: false }, ticks: { color: textColor, padding: 8 } }
      } : undefined
    };
    this.overviewChart = new Chart(canvas, { type: this.overviewChartType, data, options });
  }

  renderTimelineChart(retryCount = 0): void {
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.dashTab !== 'overview' || !this.summaryStats) {
      this.clearOverviewChartRetries();
      return;
    }
    const canvas = document.getElementById('timelineChart') as HTMLCanvasElement;
    if (!canvas || !canvas.offsetParent) {
      this.scheduleOverviewChartRetry(retryCount, 'timeline');
      return;
    }
    if (this.overviewTimelineRetryTimer) {
      clearTimeout(this.overviewTimelineRetryTimer);
      this.overviewTimelineRetryTimer = null;
    }

    const isHourly = this.timelineData.length > 0 && this.timelineData[0]._isHourly;
    const labels = this.timelineData.map(d => {
      let dt: Date;
      if (d.date.includes('T')) {
        // Hourly data from backend is UTC; append 'Z' for correct local conversion
        dt = new Date(d.date + 'Z');
      } else {
        // Daily data: use slashes for local parsing
        dt = new Date(d.date.replace(/-/g, '/'));
      }

      if (isHourly) {
        // Show hours: 08 AM, 02 PM, etc.
        const h = dt.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${String(displayH).padStart(2, '0')} ${ampm}`;
      }
      return dt.toLocaleDateString('en-US', { weekday: 'short' });
    });
    const totalCalls = this.timelineData.map(d =>
      (d.incoming || 0) + (d.outgoing || 0) + (d.missed || 0) + (d.rejected || 0)
    );

    const textColor = 'rgba(80,80,100,0.6)';
    const gridColor = 'rgba(0,0,0,0.04)';
    const ctx = canvas.getContext('2d');
    const grad = ctx ? ctx.createLinearGradient(0, 0, 0, 260) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(79,143,231,0.18)');
      grad.addColorStop(1, 'rgba(79,143,231,0)');
    }

    const isBarView = this.chartType === 'bar';

    this.timelineChart = new Chart(canvas, {
      type: isBarView ? 'bar' : 'line',
      data: {
        labels: labels.length ? labels : ['No data'],
        datasets: [{
          label: 'Total Calls',
          data: totalCalls.length ? totalCalls : [0],
          borderColor: this.dashboardPalette.incoming,
          backgroundColor: isBarView ? this.dashboardPalette.incoming : (grad ?? 'rgba(79,143,231,0.1)'),
          fill: !isBarView,
          tension: isBarView ? 0 : 0.45,
          pointRadius: isBarView ? 0 : 4,
          pointHoverRadius: isBarView ? 0 : 6,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: this.dashboardPalette.incoming,
          pointBorderWidth: isBarView ? 0 : 2,
          borderWidth: isBarView ? 0 : 3,
          borderRadius: isBarView ? 8 : 0,
          barPercentage: isBarView ? 0.55 : undefined,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            titleColor: '#111', bodyColor: '#444',
            borderColor: '#e5e7eb', borderWidth: 1,
            padding: 10, cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11 }, maxRotation: 0, padding: 8 }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor, font: { size: 11 }, padding: 8,
              callback: (value: any) => value >= 1000 ? (value / 1000) + 'k' : value
            },
            grid: { color: gridColor },
            border: { display: false }
          }
        }
      }
    });
  }

  renderDonutChart(retryCount = 0): void {
    if (this.donutChart) {
      this.donutChart.destroy();
      this.donutChart = null;
    }
    if (this.dashTab !== 'overview' || !this.summaryStats) {
      this.clearOverviewChartRetries();
      return;
    }

    const canvas = document.getElementById('donutChart') as HTMLCanvasElement;

    // Guard: canvas not in DOM yet or hidden
    if (!canvas || !canvas.offsetParent) {
      this.scheduleOverviewChartRetry(retryCount, 'donut');
      return;
    }
    if (this.overviewDonutRetryTimer) {
      clearTimeout(this.overviewDonutRetryTimer);
      this.overviewDonutRetryTimer = null;
    }

    const s = this.summaryStats;
    this.donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          data: [s.incoming || 0, s.outgoing || 0, s.missed || 0, s.rejected || 0],
          backgroundColor: [
            this.dashboardPalette.incoming,
            this.dashboardPalette.outgoing,
            this.dashboardPalette.missed,
            this.dashboardPalette.rejected
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#fff', bodyColor: '#9ca3af',
            borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
            padding: 10, cornerRadius: 8
          }
        }
      }
    });
  }

  renderChart(retryCount = 0): void {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }
    if (this.dashTab !== 'emp_dashboard' || !this.selectedEmployee) {
      this.clearEmployeeChartRetries();
      return;
    }
    const canvas = (document.getElementById('empChart') || document.getElementById('timelineChart')) as HTMLCanvasElement;
    if (!canvas || !canvas.offsetParent) {
      this.scheduleEmployeeChartRetry(retryCount, 'chart');
      return;
    }
    if (this.employeeChartRetryTimer) {
      clearTimeout(this.employeeChartRetryTimer);
      this.employeeChartRetryTimer = null;
    }

    const textColor = 'rgba(59,59,59,0.7)';
    const gridColor = 'rgba(0,0,0,0.04)';
    let data: any, options: any, chartType: any;

    if (this.employeeChartType === 'bar') {
      const counts = { incoming: 0, outgoing: 0, missed: 0, rejected: 0 };
      this.selectedEmpCalls.forEach(c => {
        if (c.callType in counts) (counts as any)[c.callType]++;
      });
      chartType = 'bar';
      data = {
        labels: ['Incoming', 'Outgoing', 'Missed', 'Rejected'],
        datasets: [{
          label: 'Call Count',
          data: [counts.incoming, counts.outgoing, counts.missed, counts.rejected],
          backgroundColor: [
            this.dashboardPalette.incoming,
            this.dashboardPalette.outgoing,
            this.dashboardPalette.missed,
            this.dashboardPalette.rejected
          ],
          borderWidth: 0,
          borderRadius: 8,
          barPercentage: 0.55
        }]
      };
      options = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 8 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 }, border: { display: false } },
          x: { grid: { display: false }, ticks: { color: textColor, padding: 8 } }
        }
      };
    } else {
      // Line chart
      if (!this.selectedEmpCalls.length) return;
      const map = new Map<string, number>();
      const calls = [...this.selectedEmpCalls].reverse();
      calls.forEach(c => {
        const d = new Date(c.timestamp);
        const k = (this.selectedPeriod === 'today' || this.selectedPeriod === 'yesterday')
          ? (d.getHours() % 12 || 12) + (d.getHours() >= 12 ? ' PM' : ' AM')
          : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        map.set(k, (map.get(k) || 0) + 1);
      });

      chartType = 'line';
      const ctx = canvas.getContext('2d');
      let gradient: any = 'rgba(99,102,241,0.2)';
      if (ctx) {
        gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(79,143,231,0.35)');
        gradient.addColorStop(1, 'rgba(79,143,231,0.0)');
      }

      data = {
        labels: Array.from(map.keys()),
        datasets: [{
          label: 'Calls Made/Received',
          data: Array.from(map.values()),
          borderColor: this.dashboardPalette.incoming,
          backgroundColor: gradient,
          fill: true, tension: 0.4,
          pointBackgroundColor: this.dashboardPalette.incoming,
          pointBorderColor: '#fff', pointBorderWidth: 2,
          pointRadius: 4, pointHoverRadius: 6, borderWidth: 3
        }]
      };
      options = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 8, displayColors: false }
        },
        interaction: { intersect: false, mode: 'index' },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1, padding: 8 } },
          x: { grid: { display: false }, ticks: { color: textColor, maxRotation: 45, padding: 8 } }
        }
      };
    }

    this.chart = new Chart(canvas, { type: chartType, data, options });
  }

  // ── Auth flows ────────────────────────────────────────────
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleSidebarMinimized(): void {
    this.sidebarMinimized = !this.sidebarMinimized;
  }

  sidebarFeatureMatches(label: string): boolean {
    const query = this.sidebarFeatureSearch.trim().toLowerCase();
    return !query || label.toLowerCase().includes(query);
  }

  sidebarSectionHas(labels: string[]): boolean {
    return labels.some((label) => this.sidebarFeatureMatches(label));
  }

  get adminInitials(): string {
    const name = String(this.dashboardCompany || 'Admin').trim();
    if (!name) return 'A';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }

  get hasAdminProfilePhoto(): boolean {
    return !!this.adminProfilePhoto.trim();
  }

  loadAdminProfilePhoto(): void {
    this.adminProfilePhoto = localStorage.getItem(this.adminProfilePhotoStorageKey()) || '';
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

      this.adminProfilePhoto = result;
      localStorage.setItem(this.adminProfilePhotoStorageKey(), result);
      this.profilePhotoSuccess = 'Profile photo updated.';
    };
    reader.onerror = () => {
      this.profilePhotoError = 'Unable to read the selected image.';
    };
    reader.readAsDataURL(file);
  }

  removeProfilePhoto(): void {
    this.adminProfilePhoto = '';
    localStorage.removeItem(this.adminProfilePhotoStorageKey());
    this.profilePhotoError = '';
    this.profilePhotoSuccess = 'Profile photo removed.';
  }

  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.profileMenuOpen && (!target || !target.closest('.profile-dropdown'))) {
      this.closeProfileMenu();
    }
    if (this.crmAmcOpenMenuKey && (!target || !target.closest('.crm-manage-cell'))) {
      this.crmAmcOpenMenuKey = '';
    }
    if (this.crmProjectOpenMenuKey && (!target || !target.closest('.crm-manage-cell'))) {
      this.crmProjectOpenMenuKey = '';
    }
    if (this.clientOnboardingOpenMenuKey && (!target || !target.closest('.client-onboarding-manage-cell'))) {
      this.clientOnboardingOpenMenuKey = '';
    }
    if (this.productTagDropdownOpenKey && (!target || !target.closest('.product-tag-dropdown'))) {
      this.productTagDropdownOpenKey = '';
    }
  }

  handleGlobalEscape(): void {
    this.closeProfileMenu();
    this.crmAmcOpenMenuKey = '';
    this.crmProjectOpenMenuKey = '';
    this.clientOnboardingOpenMenuKey = '';
    this.closeClientOnboardingCreateModal();
    this.productTagDropdownOpenKey = '';
  }

  private adminProfilePhotoStorageKey(): string {
    const code = String(this.dashboardCode || 'default').trim() || 'default';
    return `tracecall_admin_profile_photo:${code}`;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
  // (Original duplicates removed here. Modal methods moved to top)

  onForgotPwdSubmit(event: Event): void { this.authPaymentWorkflow.onForgotPwdSubmit(this, event); }

  onResetPwdSubmit(event: Event): void { this.authPaymentWorkflow.onResetPwdSubmit(this, event); }

  onPasswordInput(value: string): void { this.authPaymentWorkflow.onPasswordInput(this, value); }

  get passwordStrong(): boolean { return this.authPaymentWorkflow.passwordStrong(this); }

  onSignupSubmit(event: Event): void { this.authPaymentWorkflow.onSignupSubmit(this, event); }

  /** PAYMENT-FIRST: Creates order via pre-order, opens Razorpay, account created only on success */
  launchNewAccountPayment(): void { this.authPaymentWorkflow.launchNewAccountPayment(this); }

  openRazorpay(order: any, isRenewal: boolean): void { this.authPaymentWorkflow.openRazorpay(this, order, isRenewal); }

  renewSubscription(): void { this.authPaymentWorkflow.renewSubscription(this); }

  onRenewToDateChange(): void { this.authPaymentWorkflow.onRenewToDateChange(this); }

  onToDateChange(): void { this.authPaymentWorkflow.onToDateChange(this); }

  fetchPaymentHistory(): void { this.authPaymentWorkflow.fetchPaymentHistory(this); }

  deleteOrder(id: string): void { this.authPaymentWorkflow.deleteOrder(this, id); }

  retryPayment(p: any): void { this.authPaymentWorkflow.retryPayment(this, p); }

  downloadInvoice(p: any): void { this.authPaymentWorkflow.downloadInvoice(this, p); }

  onLoginSubmit(event: Event): void { this.authPaymentWorkflow.onLoginSubmit(this, event); }

  goToLoginFromSuccess(): void { this.authPaymentWorkflow.goToLoginFromSuccess(this); }

  openLogoutConfirm(): void { this.authPaymentWorkflow.openLogoutConfirm(this); }

  closeLogoutConfirm(): void { this.authPaymentWorkflow.closeLogoutConfirm(this); }

  logout(): void { this.authPaymentWorkflow.logout(this); }

  openAddEmployee(): void { return this.adminEmployeesWorkflow.openAddEmployee(this); }
  closeAddEmployee(): void { return this.adminEmployeesWorkflow.closeAddEmployee(this); }

  onAddEmployeeSubmit(event: Event): void { return this.adminEmployeesWorkflow.onAddEmployeeSubmit(this, event); }

  // Edit Employee
  openEditEmployee(emp: Employee): void { return this.adminEmployeesWorkflow.openEditEmployee(this, emp); }

  closeEditEmployee(): void { return this.adminEmployeesWorkflow.closeEditEmployee(this); }

  onEditEmployeeSubmit(event: Event): void { return this.adminEmployeesWorkflow.onEditEmployeeSubmit(this, event); }

  toggleEditTag(tag: string): void { return this.adminEmployeesWorkflow.toggleEditTag(this, tag); }

  // ── Employee Tagging (Inline) ─────────────────────────────────

  enableTagEdit(emp: Employee): void { return this.adminEmployeesWorkflow.enableTagEdit(this, emp); }

  cancelTagEdit(event: Event): void { return this.adminEmployeesWorkflow.cancelTagEdit(this, event); }

  focusTagInput(emp: Employee): void { return this.adminEmployeesWorkflow.focusTagInput(this, emp); }

  blurTagInput(): void { return this.adminEmployeesWorkflow.blurTagInput(this); }

  getFilteredTagOptions(): string[] { return this.adminEmployeesWorkflow.getFilteredTagOptions(this); }

  saveInlineTag(emp: Employee, event?: Event): void { return this.adminEmployeesWorkflow.saveInlineTag(this, emp, event); }

  // ── Modals / Misc ────────────────────────────────────────

  openAllCallsModal(): void { return this.adminEmployeesWorkflow.openAllCallsModal(this); }

  closeAllCallsModal(): void { return this.adminEmployeesWorkflow.closeAllCallsModal(this); }

  // ── Company & Password ────────────────────────────────────
  fetchCompanyProfile(): void { return this.adminSettingsWorkflow.fetchCompanyProfile(this); }

  // ── Support & RM ──────────────────────────────────────────

  requestRm(): void { return this.adminSettingsWorkflow.requestRm(this); }

  startRmTimer(requestTime: any): void { return this.adminSettingsWorkflow.startRmTimer(this, requestTime); }

  assignAdminRm(): void { return this.adminSettingsWorkflow.assignAdminRm(this); }

  copyConnectCodeLink(): void { return this.adminSettingsWorkflow.copyConnectCodeLink(this); }

  // ── Tag Management logic ──
  addTag(): void { return this.adminSettingsWorkflow.addTag(this); }

  removeTag(tag: string): void { return this.adminSettingsWorkflow.removeTag(this, tag); }

  persistCompanyTags(): void { return this.adminSettingsWorkflow.persistCompanyTags(this); }

  // ── Settings page methods ─────────────────────────────────────
  fetchSettings(): void { return this.adminSettingsWorkflow.fetchSettings(this); }

  onLogoUpload(event: any): void { return this.adminSettingsWorkflow.onLogoUpload(this, event); }

  onSealUpload(event: any): void { return this.adminSettingsWorkflow.onSealUpload(this, event); }

  addProduct(): void { return this.adminSettingsWorkflow.addProduct(this); }

  toggleNewProductTag(tag: string): void { return this.adminSettingsWorkflow.toggleNewProductTag(this, tag); }

  toggleProductTag(product: any, tag: string): void { return this.adminSettingsWorkflow.toggleProductTag(this, product, tag); }

  toggleProductTagDropdown(key: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.productTagDropdownOpenKey = this.productTagDropdownOpenKey === key ? '' : key;
  }

  isProductTagDropdownOpen(key: string): boolean {
    return !!key && this.productTagDropdownOpenKey === key;
  }

  productTagDropdownLabel(tags?: string[]): string {
    const selected = Array.isArray(tags) ? tags.filter(Boolean) : [];
    if (selected.length === 0) return 'All employee tags';
    if (selected.length <= 2) return selected.join(', ');
    return `${selected.length} tags selected`;
  }

  addProductRemark(): void { return this.adminSettingsWorkflow.addProductRemark(this); }

  removeProductRemark(remark: string): void { return this.adminSettingsWorkflow.removeProductRemark(this, remark); }

  removeProduct(index: number): void { return this.adminSettingsWorkflow.removeProduct(this, index); }

  saveSettings(): void { return this.adminSettingsWorkflow.saveSettings(this); }

  addLeadStatus(): void { return this.adminSettingsWorkflow.addLeadStatus(this); }

  toggleStatusForPage(status: string, page: 'interested' | 'dnp' | 'converted'): void { return this.adminSettingsWorkflow.toggleStatusForPage(this, status, page); }

  removeLeadStatus(status: string): void { return this.adminSettingsWorkflow.removeLeadStatus(this, status); }

  // ── Break Notifications ───────────────────────────────────────
  startBreakNotifPolling(): void { return this.adminSettingsWorkflow.startBreakNotifPolling(this); }

  fetchBreakOverLimit(): void { return this.adminSettingsWorkflow.fetchBreakOverLimit(this); }

  toggleBreakNotifPanel(): void { return this.adminSettingsWorkflow.toggleBreakNotifPanel(this); }

  fmtSecs(totalSecs: number): string { return this.adminSettingsWorkflow.fmtSecs(this, totalSecs); }

  openShareModal(): void { return this.adminSettingsWorkflow.openShareModal(this); }

  copyShareMessage(): void { return this.adminSettingsWorkflow.copyShareMessage(this); }

  startEditAddress(): void { return this.adminSettingsWorkflow.startEditAddress(this); }

  cancelEditAddress(): void { return this.adminSettingsWorkflow.cancelEditAddress(this); }

  saveAddress(): void { return this.adminSettingsWorkflow.saveAddress(this); }

  startEditTeamSize(): void { return this.adminSettingsWorkflow.startEditTeamSize(this); }

  cancelEditTeamSize(): void { return this.adminSettingsWorkflow.cancelEditTeamSize(this); }

  saveTeamSize(): void { return this.adminSettingsWorkflow.saveTeamSize(this); }

  onChangePwdInput(value: string): void { return this.adminSettingsWorkflow.onChangePwdInput(this, value); }

  get changePwdStrong(): boolean { return this.adminSettingsWorkflow.changePwdStrong(this); }

  onChangePasswordSubmit(event: Event): void { return this.adminSettingsWorkflow.onChangePasswordSubmit(this, event); }

  exportToExcel(): void {
    const data = this.filteredEmployeeCallRows.map((row, index) => {
      const obj: any = {
        'Sr. No.': index + 1,
        'Employee': `${row.emp.name} (${row.emp.mobile})`,
        'Total Calls': row.stats?.total || 0,
        'Total Duration': this.fmtDur(row.stats?.totalDuration || 0),
        'Connected Calls': row.stats?.connected || 0,
        'Conn. Calls Duration': this.fmtDur((row.stats?.incomingDuration || 0) + (row.stats?.outgoingDuration || 0)),
        'Conn. Call Avg. Duration': this.fmtAvgDur((row.stats?.incomingDuration || 0) + (row.stats?.outgoingDuration || 0), row.stats?.connected || 0),
        'Working Hours': this.fmtDur(row.stats?.totalDuration || 0),
        'Unique Clients': 0,
        'Unique Conn. Calls': 0
      };

      if (!this.filterCallType || this.filterCallType === 'Incoming') {
        obj['Incoming Total'] = row.stats?.incoming || 0;
        obj['Incoming Duration'] = this.fmtDur(row.stats?.incomingDuration || 0);
        obj['Incoming Connected'] = row.stats?.incomingConnected || 0;
      }

      if (!this.filterCallType || this.filterCallType === 'Outgoing') {
        obj['Outgoing Total'] = row.stats?.outgoing || 0;
        obj['Outgoing Duration'] = this.fmtDur(row.stats?.outgoingDuration || 0);
        obj['Outgoing Connected'] = row.stats?.outgoingConnected || 0;
      }

      if (!this.filterCallType || this.filterCallType === 'Missed') {
        obj['Missed Total'] = row.stats?.missed || 0;
      }

      if (!this.filterCallType || this.filterCallType === 'Rejected') {
        obj['Rejected Total'] = row.stats?.rejected || 0;
      }

      obj['Never Attended'] = 0;
      obj['Not Pickup by Client'] = 0;
      obj['Last Sync Time'] = row.emp.lastSyncTime ? new Date(row.emp.lastSyncTime).toLocaleString('en-IN') : 'Never';

      return obj;
    });

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Summary');
    XLSX.writeFile(wb, `Employee_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  resetFilters(): void {
    this.filterTags = '';
    this.filterEmployees = '';
    this.filterCallType = '';
    this.filterDuration = '';
    this.filterCallTime = '';
    this.excludePhoneNumbers = false;
    this.customFrom = new Date().toISOString().split('T')[0];
    this.customTo = new Date().toISOString().split('T')[0];
    this.selectedPeriod = 'custom';
    this.applyCustomRange();
  }

  closeEmployee(): void { return this.adminEmployeesWorkflow.closeEmployee(this); }

  fetchEmpLeads(forceRefresh = false): void { return this.adminEmployeesWorkflow.fetchEmpLeads(this, forceRefresh); }

  onEmployeeLeadSearchChange(): void { return this.adminEmployeesWorkflow.onEmployeeLeadSearchChange(this); }

  onEmployeeLeadCompanyScroll(event: Event): void { return this.adminEmployeesWorkflow.onEmployeeLeadCompanyScroll(this, event); }

  onEmployeeLeadContactsScroll(event: Event): void { return this.adminEmployeesWorkflow.onEmployeeLeadContactsScroll(this, event); }

  fetchEmpFollowups(forceRefresh = false): void { return this.adminEmployeesWorkflow.fetchEmpFollowups(this, forceRefresh); }

  onEmployeeFollowupFiltersChange(): void { return this.adminEmployeesWorkflow.onEmployeeFollowupFiltersChange(this); }

  onEmployeeFollowupScroll(event: Event): void { return this.adminEmployeesWorkflow.onEmployeeFollowupScroll(this, event); }

    fetchAdminLeads(forceRefresh = false): void { return this.adminLeadsWorkflow.fetchAdminLeads(this, forceRefresh); }

    onAdminLeadSearchChange(): void { return this.adminLeadsWorkflow.onAdminLeadSearchChange(this); }

    loadAdminLeadCompanies(append: boolean, forceRefresh = false): void { return this.adminLeadsWorkflow.loadAdminLeadCompanies(this, append, forceRefresh); }

    loadAdminLeadContacts(append: boolean, forceRefresh = false): void { return this.adminLeadsWorkflow.loadAdminLeadContacts(this, append, forceRefresh); }

    private prefetchAdminLeadContacts(
    companies: Array<{ name: string; count: number }>,
    run: number,
    skipSelectedCompany: boolean,
  ): void { return this.adminLeadsWorkflow.prefetchAdminLeadContacts(this, companies, run, skipSelectedCompany); }

    private flattenAdminContactsByCompany(raw: unknown): Lead[] { return this.adminLeadsWorkflow.flattenAdminContactsByCompany(this, raw); }

    private mergeAdminHydratedLeads(leads: Lead[]): void { return this.adminLeadsWorkflow.mergeAdminHydratedLeads(this, leads); }

    private upsertAdminHydratedLeadRecords(leads: Lead[]): void { return this.adminLeadsWorkflow.upsertAdminHydratedLeadRecords(this, leads); }

    private adminLeadSetsCacheKey(): string { return this.adminLeadsWorkflow.adminLeadSetsCacheKey(this); }

    private adminLeadCompanyCacheKey(page: number): string { return this.adminLeadsWorkflow.adminLeadCompanyCacheKey(this, page); }

    private adminLeadContactCacheKey(page: number, company = this.selectedLeadCompany): string { return this.adminLeadsWorkflow.adminLeadContactCacheKey(this, page, company); }

    private restoreCachedAdminLeadCompanyPage(page: number, append = false): boolean { return this.adminLeadsWorkflow.restoreCachedAdminLeadCompanyPage(this, page, append); }

    private restoreCachedAdminLeadContactPage(page: number, append = false): boolean { return this.adminLeadsWorkflow.restoreCachedAdminLeadContactPage(this, page, append); }

    private mergeAdminLeadCompanies(
    existing: Array<{ name: string; count: number }>,
    incoming: Array<{ name: string; count: number }>,
  ): Array<{ name: string; count: number }> { return this.adminLeadsWorkflow.mergeAdminLeadCompanies(this, existing, incoming); }

    private isAdminDashboardCacheRefreshDue(key: string): boolean { return this.adminLeadsWorkflow.isAdminDashboardCacheRefreshDue(this, key); }

    private invalidateAdminDashboardCaches(): void { return this.adminLeadsWorkflow.invalidateAdminDashboardCaches(this); }

  fetchInvoiceRecords(force = false): void { return this.invoiceQuotationWorkflow.fetchInvoiceRecords(this, force); }

  fetchAdminInvoiceClients(force = false): void { return this.invoiceQuotationWorkflow.fetchAdminInvoiceClients(this, force); }

  fetchAdminQuotationClients(force = false): void { return this.invoiceQuotationWorkflow.fetchAdminQuotationClients(this, force); }

  fetchAdminQuotationLeads(force = false): void { return this.invoiceQuotationWorkflow.fetchAdminQuotationLeads(this, force); }

  fetchClientOnboardingRecords(force = false): void { return this.invoiceQuotationWorkflow.fetchClientOnboardingRecords(this, force); }

  onAdminInvoiceSearchChange(): void { return this.invoiceQuotationWorkflow.onAdminInvoiceSearchChange(this); }

  onAdminInvoiceHistoryQueryChange(): void { return this.invoiceQuotationWorkflow.onAdminInvoiceHistoryQueryChange(this); }

  onAdminQuotationSearchChange(): void { return this.invoiceQuotationWorkflow.onAdminQuotationSearchChange(this); }

  onAdminQuotationHistoryQueryChange(): void { return this.invoiceQuotationWorkflow.onAdminQuotationHistoryQueryChange(this); }

  onAdminClientOnboardingSearchChange(): void { return this.invoiceQuotationWorkflow.onAdminClientOnboardingSearchChange(this); }

  onAdminInvoiceClientScroll(event: Event): void { return this.invoiceQuotationWorkflow.onAdminInvoiceClientScroll(this, event); }

  onAdminInvoiceHistoryScroll(event: Event): void { return this.invoiceQuotationWorkflow.onAdminInvoiceHistoryScroll(this, event); }

  onAdminClientOnboardingScroll(event: Event): void { return this.invoiceQuotationWorkflow.onAdminClientOnboardingScroll(this, event); }

  onAdminQuotationClientScroll(event: Event): void { return this.invoiceQuotationWorkflow.onAdminQuotationClientScroll(this, event); }

  onAdminQuotationLeadScroll(event: Event): void { return this.invoiceQuotationWorkflow.onAdminQuotationLeadScroll(this, event); }

  onAdminQuotationHistoryScroll(event: Event): void { return this.invoiceQuotationWorkflow.onAdminQuotationHistoryScroll(this, event); }

  submitClientOnboarding(): void { return this.invoiceQuotationWorkflow.submitClientOnboarding(this); }

  resetClientOnboardingDraft(): void { return this.invoiceQuotationWorkflow.resetClientOnboardingDraft(this); }

  openClientOnboardingCreateModal(): void {
    this.resetClientOnboardingDraft();
    this.clientOnboardingCreateOpen = true;
  }

  closeClientOnboardingCreateModal(): void {
    this.clientOnboardingCreateOpen = false;
  }

  selectOnboardingClient(client: any): void { return this.invoiceQuotationWorkflow.selectOnboardingClient(this, client); }

  get selectedOnboardingClient(): any { return this.invoiceQuotationWorkflow.selectedOnboardingClient(this); }

  clientOnboardingRowKey(client: any): string {
    return String(client?._id || client?.id || client?.clientId || client?.companyName || '');
  }

  toggleClientOnboardingRowMenu(client: any, event?: Event): void {
    event?.stopPropagation();
    const key = this.clientOnboardingRowKey(client);
    this.clientOnboardingOpenMenuKey = this.clientOnboardingOpenMenuKey === key ? '' : key;
  }

  isClientOnboardingRowMenuOpen(client: any): boolean {
    return !!this.clientOnboardingOpenMenuKey && this.clientOnboardingOpenMenuKey === this.clientOnboardingRowKey(client);
  }

  editOnboardingClient(client: any): void {
    this.clientOnboardingOpenMenuKey = '';
    this.openEditCrmClientModal(client);
  }

  get adminConvertedInvoiceLeads(): Lead[] { return this.invoiceQuotationWorkflow.adminConvertedInvoiceLeads(this); }

  get adminQuotationLeads(): Lead[] { return this.invoiceQuotationWorkflow.adminQuotationLeads(this); }

  get filteredInvoiceRecords(): any[] { return this.invoiceQuotationWorkflow.filteredInvoiceRecords(this); }

  get filteredQuotationRecords(): any[] { return this.invoiceQuotationWorkflow.filteredQuotationRecords(this); }

  matchesAdminInvoiceDateFilter(rawDate?: string): boolean { return this.invoiceQuotationWorkflow.matchesAdminInvoiceDateFilter(this, rawDate); }

  matchesInvoiceDateRange(rawDate?: string): boolean { return this.invoiceQuotationWorkflow.matchesInvoiceDateRange(this, rawDate); }

  matchesQuotationDateRange(rawDate?: string): boolean { return this.invoiceQuotationWorkflow.matchesQuotationDateRange(this, rawDate); }

  fetchQuotationRecords(force = false): void { return this.invoiceQuotationWorkflow.fetchQuotationRecords(this, force); }

  openSavedInvoice(record: any): void { return this.invoiceQuotationWorkflow.openSavedInvoice(this, record); }

  openSavedQuotation(record: any): void { return this.invoiceQuotationWorkflow.openSavedQuotation(this, record); }

  formatInvoiceMoney(value: number): string { return this.invoiceQuotationWorkflow.formatInvoiceMoney(this, value); }

  openQuotationModal(lead: Lead): void { return this.invoiceQuotationWorkflow.openQuotationModal(this, lead); }

  openAdminInvoiceModal(lead: Lead): void { return this.invoiceQuotationWorkflow.openAdminInvoiceModal(this, lead); }

  openAdminInvoiceModalForClient(client: any): void { return this.invoiceQuotationWorkflow.openAdminInvoiceModalForClient(this, client); }

  openAdminQuotationModalForClient(client: any): void { return this.invoiceQuotationWorkflow.openAdminQuotationModalForClient(this, client); }

  closeInvoiceModal(): void { return this.invoiceQuotationWorkflow.closeInvoiceModal(this); }

  onProductSelect(): void { return this.invoiceQuotationWorkflow.onProductSelect(this); }

  addInvoiceItem(): void { return this.invoiceQuotationWorkflow.addInvoiceItem(this); }

  removeInvoiceItem(index: number): void { return this.invoiceQuotationWorkflow.removeInvoiceItem(this, index); }

  get invoiceSubtotal(): number { return this.invoiceQuotationWorkflow.invoiceSubtotal(this); }

  get invoiceGstAmount(): number { return this.invoiceQuotationWorkflow.invoiceGstAmount(this); }

  get invoiceCgstAmount(): number { return this.invoiceQuotationWorkflow.invoiceCgstAmount(this); }

  get invoiceSgstAmount(): number { return this.invoiceQuotationWorkflow.invoiceSgstAmount(this); }

  get invoiceTotal(): number { return this.invoiceQuotationWorkflow.invoiceTotal(this); }

  invoiceItemTaxable(item: { price: number; quantity: number }): number { return this.invoiceQuotationWorkflow.invoiceItemTaxable(this, item); }

  invoiceItemGst(item: { price: number; quantity: number }): number { return this.invoiceQuotationWorkflow.invoiceItemGst(this, item); }

  invoiceItemTotal(item: { price: number; quantity: number }): number { return this.invoiceQuotationWorkflow.invoiceItemTotal(this, item); }

  invoiceNumber(): string { return this.invoiceQuotationWorkflow.invoiceNumber(this); }

  invoiceCompanyDisplayName(): string { return this.invoiceQuotationWorkflow.invoiceCompanyDisplayName(this); }

  invoiceCompanyAddress(): string { return this.invoiceQuotationWorkflow.invoiceCompanyAddress(this); }

  invoiceContactLine(): string { return this.invoiceQuotationWorkflow.invoiceContactLine(this); }

  quotationBankRows(): QuotationBankRow[] { return this.invoiceQuotationWorkflow.quotationBankRows(this); }

  quotationKindNoteText(): string { return this.invoiceQuotationWorkflow.quotationKindNoteText(this); }

  formatInvoicePaymentStatus(status?: string): string { return this.invoiceQuotationWorkflow.formatInvoicePaymentStatus(this, status); }

  invoiceBankDetails(): any { return this.invoiceQuotationWorkflow.invoiceBankDetails(this); }

  invoiceSealSrc(): string { return this.invoiceQuotationWorkflow.invoiceSealSrc(this); }

  invoiceTermsText(): string { return this.invoiceQuotationWorkflow.invoiceTermsText(this); }

  invoicePreviewGstPercentage(): number { return this.invoiceQuotationWorkflow.invoicePreviewGstPercentage(this); }

  numberToWords(value: number): string { return this.invoiceQuotationWorkflow.numberToWords(this, value); }

  getGstBreakdown(): any[] { return this.invoiceQuotationWorkflow.getGstBreakdown(this); }

  getTotalItemsQty(): number { return this.invoiceQuotationWorkflow.getTotalItemsQty(this); }

  confirmDocumentGstSelection(useZeroGst: boolean): void { return this.invoiceQuotationWorkflow.confirmDocumentGstSelection(this, useZeroGst); }

  cancelDocumentGstSelection(): void { return this.invoiceQuotationWorkflow.cancelDocumentGstSelection(this); }

  printInvoice(): void { return this.invoiceQuotationWorkflow.printInvoice(this); }

  saveAndPrintQuotation(): void { return this.invoiceQuotationWorkflow.saveAndPrintQuotation(this); }

  openCompanyFullView(event?: Event): void {
    event?.stopPropagation();
    this.companyRemarkLead = null;
    this.adminAiSummaryOpen = false;
    this.adminCompanyFullSection = 'overview';
    this.companyFullViewOpen = true;
    if (!this.allBookmarks.length) this.fetchCompanyBookmarks();
    if (!this.invoiceRecords.length) this.fetchInvoiceRecords();
    if (!this.quotationRecords.length) this.fetchQuotationRecords();
  }

  closeCompanyFullView(): void {
    this.companyFullViewOpen = false;
    this.companyRemarkLead = null;
    this.adminCompanyFullSection = 'overview';
  }

  openCompanyRemarkHistory(lead: Lead): void {
    this.companyRemarkLead = lead;
  }

  closeCompanyRemarkHistory(): void {
    this.companyRemarkLead = null;
  }

  openAdminAiSummary(event?: Event): void {
    event?.stopPropagation();
    this.companyFullViewOpen = false;
    this.adminAiSummaryOpen = true;
    this.loadAiBriefForLead(this.companyFullViewLead(), this.selectedLeadCompany || this.selectedRemarksFilterCompany);
  }

  closeAdminAiSummary(): void {
    this.adminAiSummaryOpen = false;
  }

  closeAdminLeadPanels(): void {
    this.adminAiSummaryOpen = false;
    this.companyFullViewOpen = false;
  }

  retryAiBrief(): void {
    const lead = this.findLeadById(this.aiBriefLeadId) || this.companyFullViewLead();
    this.loadAiBriefForLead(lead, this.aiBriefCompany, true);
  }

  aiBriefCacheLabel(): string {
    return this.aiBriefCacheStatus === 'hit' ? 'Cached Brief' : 'Fresh Brief';
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

  private resetAiBriefState(): void {
    this.aiBrief = null;
    this.aiBriefLoading = false;
    this.aiBriefError = '';
    this.aiBriefCacheStatus = '';
    this.aiBriefCompany = '';
    this.aiBriefLeadId = '';
  }

  private loadAiBriefForLead(lead: Lead | null, companyName = '', forceRefresh = false): void {
    if (!lead?._id) {
      this.resetAiBriefState();
      this.aiBriefCompany = companyName;
      this.aiBriefError = 'AI summary needs a lead record for this company.';
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
            leadId: lead._id || '',
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

  private findLeadById(leadId: string): Lead | null {
    if (!leadId) return null;
    return this.allLeads.find((lead) => lead._id === leadId) || this.remarkLeads.find((lead) => lead._id === leadId) || null;
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

    const sources = this.aiBrief.sources || [];
    const officialSources = sources.filter((source) => this.isOfficialHostnameMatch(source.url));

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

    return (this.aiBrief.sources || []).filter((source) => !this.isOfficialHostnameMatch(source.url));
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

  get adminTotalLeadsCount(): number {
    const companyTotal = this.adminLeadCompanies.reduce((total, company) => total + (company.count || 0), 0);
    return companyTotal || this.allLeads.length;
  }

  get adminOverviewRecentLeads(): Lead[] {
    return [...this.allLeads]
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 8);
  }

  get adminOverviewUpcomingFollowups(): Bookmark[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return [...this.allBookmarks]
      .filter((bookmark) => {
        if (!bookmark.reminderDate) return false;
        const date = new Date(bookmark.reminderDate);
        date.setHours(0, 0, 0, 0);
        return date >= now;
      })
      .sort((a, b) => new Date(a.reminderDate || 0).getTime() - new Date(b.reminderDate || 0).getTime())
      .slice(0, 8);
  }

  openOverviewLead(lead: Lead): void {
    if (!lead?.leadCompanyName) return;
    this.dashTab = 'leads';
    this.sidebarOpen = false;
    this.selectedLeadCompany = lead.leadCompanyName;
    this.closeAdminLeadPanels();
    this.loadAdminLeadContacts(false);
  }

  openOverviewFollowup(bookmark: Bookmark): void {
    this.dashTab = 'followups';
    this.sidebarOpen = false;
    this.selectGlobalFollowupCompany(bookmark.companyName || '');
  }

  companyFullViewRows(): Lead[] {
    if (this.dashTab === 'remarks_filter') return this.remarksFilterLeadsInCompany;
    if (this.dashTab === 'followups') {
      return this.filteredBookmarksByGlobalCompany
        .map((bookmark) => this.getMatchedLeadForAdminBookmark(bookmark))
        .filter((lead): lead is Lead => !!lead);
    }
    return this.leadsInSelectedCompany;
  }

  companyFullViewLead(): Lead | null {
    return this.companyFullViewRows()[0] || null;
  }

  get adminCompanyFullSections(): Array<{ id: 'overview' | 'contacts' | 'followups' | 'remarks' | 'invoices' | 'quotations' | 'notes'; label: string }> {
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'contacts', label: 'Contacts' },
      { id: 'followups', label: 'Followups' },
      { id: 'remarks', label: 'Remarks' },
      { id: 'invoices', label: 'Invoices' },
      { id: 'quotations', label: 'Quotations' },
      { id: 'notes', label: 'Notes' },
    ];
  }

  adminCompanyFullSectionId(section: string): string {
    return `admin-company-full-${section}`;
  }

  scrollAdminCompanyFullSection(section: 'overview' | 'contacts' | 'followups' | 'remarks' | 'invoices' | 'quotations' | 'notes'): void {
    this.adminCompanyFullSection = section;
    setTimeout(() => {
      document.getElementById(this.adminCompanyFullSectionId(section))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  onAdminCompanyFullScroll(event: Event): void {
    const container = event.target as HTMLElement | null;
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    let active = this.adminCompanyFullSections[0]?.id || 'overview';
    let closest = active;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const section of this.adminCompanyFullSections) {
      const element = document.getElementById(this.adminCompanyFullSectionId(section.id));
      if (!element) continue;
      const distance = element.getBoundingClientRect().top - containerTop;
      const absoluteDistance = Math.abs(distance);
      if (absoluteDistance < closestDistance) {
        closestDistance = absoluteDistance;
        closest = section.id;
      }
      if (distance <= 120) {
        active = section.id;
      }
    }

    this.adminCompanyFullSection = active || closest;
  }

  companyFullCompanyName(): string {
    return this.selectedLeadCompany
      || this.selectedRemarksFilterCompany
      || this.selectedGlobalFollowupCompany
      || this.companyFullViewLead()?.leadCompanyName
      || 'Company details';
  }

  companyFullPrimaryContact(): string {
    return this.companyFullViewLead()?.contactName || 'Primary Contact';
  }

  companyFullPrimaryPhone(): string {
    return this.companyFullViewLead()?.contactNumber || '-';
  }

  companyFullPrimaryEmail(): string {
    return this.companyFullViewLead()?.directorEmailAddress || '-';
  }

  companyFullPrimaryStatus(): string {
    return this.normalizedLeadStatus(this.companyFullViewLead()?.status);
  }

  companyFullLatestUpdate(): string {
    return this.companyLeadLatestDate(this.companyFullViewLead());
  }

  companyFullSetSummary(): string {
    const sets = Array.from(new Set(this.companyFullViewRows().map((lead) => String(lead.setLabel || '').trim()).filter(Boolean)));
    return sets.length ? sets.join(', ') : '-';
  }

  companyFullCompanyCode(): string {
    return this.companyFullViewLead()?.companyCode || this.dashboardCode || '-';
  }

  companyFullOverviewContacts(): Lead[] {
    return this.companyFullViewRows();
  }

  companyFullContactEmail(lead: Lead): string {
    return lead.directorEmailAddress || '-';
  }

  companyFullContactPhone(lead: Lead): string {
    return lead.contactNumber || '-';
  }

  adminCompanyFullRemarkEntries(): Array<{ lead: Lead; remark: string; index: number }> {
    return this.companyFullViewRows().flatMap((lead) =>
      [...(lead.remarks || [])]
        .map((remark, index) => ({ lead, remark: String(remark || '').trim(), index }))
        .filter((entry) => !!entry.remark)
        .reverse()
    );
  }

  adminCompanyFullFollowups(): Bookmark[] {
    const company = this.companyFullCompanyName().trim().toLowerCase();
    const phones = new Set(this.companyFullViewRows().map((lead) => String(lead.contactNumber || '').trim()).filter(Boolean));
    const source = this.dashTab === 'followups' && this.filteredBookmarksByGlobalCompany.length
      ? this.filteredBookmarksByGlobalCompany
      : this.allBookmarks;

    return source.filter((bookmark: Bookmark) => {
      const bookmarkCompany = String(bookmark.companyName || '').trim().toLowerCase();
      const bookmarkPhone = String(bookmark.contactNumber || '').trim();
      return (!!company && bookmarkCompany === company) || (!!bookmarkPhone && phones.has(bookmarkPhone));
    });
  }

  adminCompanyFullFollowupFlagCount(flag: keyof Bookmark): number {
    return this.adminCompanyFullFollowups().filter((bookmark: Bookmark) => !!bookmark[flag]).length;
  }

  adminCompanyFullFollowupRemarkCount(): number {
    return this.adminCompanyFullFollowups().reduce((sum, bookmark: Bookmark) => (
      sum + (bookmark.description ? 1 : 0) + (bookmark.remarks || []).filter(Boolean).length
    ), 0);
  }

  adminCompanyFullFollowupReminderCount(): number {
    return this.adminCompanyFullFollowups().filter((bookmark: Bookmark) => !!bookmark.reminderDate).length;
  }

  adminCompanyFullFollowupEntries(): Array<{ bookmark: Bookmark; employeeName: string; date: string; title: string; body: string }> {
    return this.adminCompanyFullFollowups()
      .map((bookmark: Bookmark) => {
        const notes = [
          String(bookmark.description || '').trim(),
          ...(bookmark.remarks || []).map((remark) => String(remark || '').trim()).filter(Boolean),
        ].filter(Boolean);
        return {
          bookmark,
          employeeName: this.getEmployeeName(bookmark.employeePhone || ''),
          date: this.fmtDate(bookmark.reminderDate || bookmark.updatedAt || bookmark.createdAt),
          title: bookmark.contactName || 'Follow-up Contact',
          body: notes.join(' · ') || 'Follow-up saved without notes.',
        };
      })
      .sort((a, b) => new Date(b.bookmark.updatedAt || b.bookmark.createdAt || b.bookmark.reminderDate || 0).getTime() - new Date(a.bookmark.updatedAt || a.bookmark.createdAt || a.bookmark.reminderDate || 0).getTime());
  }

  adminCompanyFullNoteEntries(): Array<{ title: string; body: string; employeeName: string; date: string }> {
    const followupNotes = this.adminCompanyFullFollowups().flatMap((bookmark: Bookmark) => {
      const employeeName = this.getEmployeeName(bookmark.employeePhone || '');
      const date = this.fmtDate(bookmark.updatedAt || bookmark.createdAt || bookmark.reminderDate);
      const rows = [
        String(bookmark.description || '').trim(),
        ...(bookmark.remarks || []).map((remark) => String(remark || '').trim()),
      ].filter(Boolean);
      return rows.map((body) => ({
        title: bookmark.contactName || 'Follow-up note',
        body,
        employeeName,
        date,
      }));
    });

    const leadNotes = this.companyFullViewRows().flatMap((lead: Lead) => {
      const employeeName = this.getEmployeeName(lead.assignedEmployeePhone || '');
      const date = this.fmtDate(lead.updatedAt || lead.createdAt);
      return (lead.remarks || [])
        .map((remark) => String(remark || '').trim())
        .filter(Boolean)
        .map((body) => ({
          title: lead.contactName || 'Lead note',
          body,
          employeeName: employeeName || 'Lead record',
          date,
        }));
    });

    return [...followupNotes, ...leadNotes];
  }

  adminCompanyFullInvoiceItems(): any[] {
    const company = this.companyFullCompanyName().toLowerCase();
    const phones = new Set(this.companyFullViewRows().map((lead) => String(lead.contactNumber || '').trim()).filter(Boolean));
    return this.invoiceRecords.filter((record) =>
      String(record.leadCompanyName || '').toLowerCase() === company
      || phones.has(String(record.contactNumber || '').trim())
    );
  }

  adminCompanyFullQuotationItems(): any[] {
    const company = this.companyFullCompanyName().toLowerCase();
    const phones = new Set(this.companyFullViewRows().map((lead) => String(lead.contactNumber || '').trim()).filter(Boolean));
    return this.quotationRecords.filter((record) =>
      String(record.leadCompanyName || '').toLowerCase() === company
      || phones.has(String(record.contactNumber || '').trim())
    );
  }

  companyFullViewContext(): string {
    const lead = this.companyFullViewLead();
    return String(lead?.mainDivisionDescription || lead?.companyDescription || '').trim();
  }

  companyLeadLatestDate(lead: Lead | null): string {
    const raw = (lead as any)?.updatedAt || (lead as any)?.createdAt || '';
    return raw ? this.fmtDate(raw) : '-';
  }

  companyRemarkCount(lead: Lead): number {
    return (lead.remarks || []).filter(Boolean).length;
  }

  companyRemarkHistory(lead: Lead | null): string[] {
    return [...(lead?.remarks || [])].filter(Boolean).reverse();
  }

  leadStatusColor(status: string): string {
    return leadStatusColorValue(status);
  }

  normalizedLeadStatus(status: string | null | undefined): string {
    return normalizedLeadStatusValue(status);
  }

  createAdminInvoiceForLead(lead: Lead): void { return this.invoiceQuotationWorkflow.createAdminInvoiceForLead(this, lead); }

  deleteLeadRemark(lead: Lead, index: number): void {
    if (!confirm('Delete this remark?')) return;
    this.api.delete(`/api/leads/${lead._id}/remarks/${index}`).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.invalidateAdminDashboardCaches();
          const idx = this.allLeads.findIndex(l => l._id === lead._id);
          if (idx !== -1) {
            this.allLeads[idx] = this.normalizeLead(res.lead);
            this.lastAllLeadsRef = null; // force map rebuild
          }
        }
      }
    });
  }

  addLeadRemark(lead: Lead): void {
    if (!lead._id) return;
    const remark = this.leadRemarksInputs[lead._id];
    if (!remark || !remark.trim() || this.remarkPostingIds.has(lead._id)) return;

    this.remarkPostingIds.add(lead._id);
    this.leadService.addLeadRemark(lead._id, remark.trim()).subscribe({
      next: (res: any) => {
        if (res?.success && res.lead) {
          const normalized = this.normalizeLead(res.lead);
          const allIndex = this.allLeads.findIndex((item) => item._id === lead._id);
          if (allIndex !== -1) this.allLeads[allIndex] = normalized;
          this.leadRemarksInputs[lead._id!] = '';
          this.lastAllLeadsRef = null;
          this.invalidateAdminDashboardCaches();
        }
        this.remarkPostingIds.delete(lead._id!);
      },
      error: () => {
        this.remarkPostingIds.delete(lead._id!);
        alert('Failed to add remark.');
      }
    });
  }

  openAdminRemarkMenu(key: string): void {
    if (!key) return;
    if (this.adminRemarkMenuCloseTimer) {
      clearTimeout(this.adminRemarkMenuCloseTimer);
      this.adminRemarkMenuCloseTimer = null;
    }
    this.adminRemarkMenuOpenKey = key;
  }

  toggleAdminRemarkMenu(key: string): void {
    if (!key) return;
    if (this.adminRemarkMenuOpenKey === key) {
      this.adminRemarkMenuOpenKey = '';
      return;
    }
    this.openAdminRemarkMenu(key);
  }

  queueCloseAdminRemarkMenu(key: string): void {
    if (!key) return;
    if (this.adminRemarkMenuCloseTimer) clearTimeout(this.adminRemarkMenuCloseTimer);
    this.adminRemarkMenuCloseTimer = setTimeout(() => {
      if (this.adminRemarkMenuOpenKey === key) this.adminRemarkMenuOpenKey = '';
      this.adminRemarkMenuCloseTimer = null;
    }, 120);
  }

  isAdminRemarkMenuOpen(key: string): boolean {
    return !!key && this.adminRemarkMenuOpenKey === key;
  }

  filteredAdminRemarkOptions(value: string | null | undefined): string[] {
    const query = String(value || '').trim().toLowerCase();
    return (this.settingsProductRemarks || [])
      .filter((remark) => {
        const normalized = String(remark || '').trim();
        return normalized && (!query || normalized.toLowerCase().includes(query));
      })
      .slice(0, 8);
  }

  selectAdminRemark(key: string, remark: string): void {
    if (!key) return;
    this.leadRemarksInputs[key] = remark;
    this.adminRemarkMenuOpenKey = '';
  }

  normalizeLead(lead: any): Lead {
    if (!lead) return lead;
    return {
      ...lead,
      remarks: Array.isArray(lead.remarks) ? lead.remarks : (lead.remarks ? [lead.remarks] : [])
    };
  }

  toggleStar(lead: Lead): void {
    const newValue = !lead.isStarred;
    lead.isStarred = newValue;
    this.leadService.updateLeadFlags(lead._id!, { isStarred: newValue }).subscribe({
      next: () => this.invalidateAdminDashboardCaches(),
      error: () => { lead.isStarred = !newValue; }
    });
  }

  toggleFavourite(lead: Lead): void {
    const newValue = !lead.isFavourite;
    lead.isFavourite = newValue;
    this.leadService.updateLeadFlags(lead._id!, { isFavourite: newValue }).subscribe({
      next: () => this.invalidateAdminDashboardCaches(),
      error: () => { lead.isFavourite = !newValue; }
    });
  }

  filteredLeadsDepsStr = '';
  lastAllLeadsRefForFiltered: any[] | null = null;
  filteredLeadsCache: any[] = [];

  get filteredLeads(): any[] {
    if (this.dashTab === 'leads') {
      const q = this.leadSearchQuery.toLowerCase();
      return this.allLeads.filter(lead => {
        const remarks: string[] = Array.isArray(lead.remarks) ? lead.remarks : [];
        const matchesSearch = !this.leadSearchQuery ||
          (lead.contactName?.toLowerCase().includes(q)) ||
          (lead.contactNumber?.includes(this.leadSearchQuery)) ||
          (lead.leadCompanyName?.toLowerCase().includes(q)) ||
          (lead.directorEmailAddress?.toLowerCase().includes(q)) ||
          (remarks.some(r => r.toLowerCase().includes(q)));
        const matchesEmployee = !this.leadEmployeeFilter ||
          lead.assignedEmployeePhone === this.leadEmployeeFilter;
        const matchesStatus = !this.adminLeadStatusFilter ||
          (lead.status || 'New') === this.adminLeadStatusFilter;
        return matchesSearch && matchesEmployee && matchesStatus;
      });
    }

    const depsStr = JSON.stringify([this.leadSearchQuery, this.leadEmployeeFilter]);
    if (this.lastAllLeadsRefForFiltered !== this.allLeads || this.filteredLeadsDepsStr !== depsStr) {
      this.filteredLeadsCache = this.allLeads.filter(lead => {
        const q = this.leadSearchQuery.toLowerCase();
        const remarks: string[] = Array.isArray(lead.remarks) ? lead.remarks : [];
        
        const matchesSearch = !this.leadSearchQuery ||
          (lead.contactName?.toLowerCase().includes(q)) ||
          (lead.contactNumber?.includes(this.leadSearchQuery)) ||
          (lead.leadCompanyName?.toLowerCase().includes(q)) ||
          (remarks.some(r => r.toLowerCase().includes(q)));

        const matchesEmployee = !this.leadEmployeeFilter ||
          lead.assignedEmployeePhone === this.leadEmployeeFilter;

        return matchesSearch && matchesEmployee;
      });
      this.lastAllLeadsRefForFiltered = this.allLeads;
      this.filteredLeadsDepsStr = depsStr;
    }
    return this.filteredLeadsCache;
  }

  lastFilteredLeadsRefForUnique: any[] | null = null;
  uniqueLeadCompaniesCache: string[] = [];

  get uniqueLeadCompanies(): string[] {
    if (this.dashTab === 'leads') {
      return this.adminLeadCompanies.map((company) => company.name);
    }

    if (this.lastFilteredLeadsRefForUnique !== this.filteredLeads) {
      this.companyLimit = 200;
      const companies = this.filteredLeads.map(l => l.leadCompanyName);
      this.uniqueLeadCompaniesCache = [...new Set(companies)].sort();
      this.lastFilteredLeadsRefForUnique = this.filteredLeads;
    }
    return this.uniqueLeadCompaniesCache;
  }

  get displayedLeadCompanies(): string[] {
    if (this.dashTab === 'leads') return this.uniqueLeadCompanies;
    return this.uniqueLeadCompanies.slice(0, this.companyLimit);
  }

  onSidebarScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
      if (this.dashTab === 'leads') {
        this.loadAdminLeadCompanies(true);
        return;
      }
      if (this.companyLimit < this.uniqueLeadCompanies.length) {
        this.companyLimit += 200;
      }
    }
  }

  onAdminLeadContactsScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 120) {
      this.loadAdminLeadContacts(true);
    }
  }

  // ── Remarks Filter Page ───────────────────────────────────────
  selectedRemarkFilter: string = '';
  remarkFilterSearch: string = '';

  selectRemarkFilter(remark: string): void {
    this.selectedRemarkFilter = remark;
    this.selectedRemarksFilterCompany = '';
    this.fetchLeadsByRemark(remark);
  }

  onRemarkFilterSearchChange(): void {
    if (this.remarkFilterSearchTimer) clearTimeout(this.remarkFilterSearchTimer);
    this.remarkFilterSearchTimer = setTimeout(() => this.fetchLeadsByRemark(this.selectedRemarkFilter), SEARCH_DEBOUNCE_MS);
  }

  fetchLeadsByRemark(remark: string = this.selectedRemarkFilter, forceRefresh = false): void {
    this.selectedRemarkFilter = remark;
    this.remarkLeadRequestRun++;
    this.remarkLeadCompanyPage = 1;
    this.remarkLeadCompanyHasMore = false;
    this.remarkLeadContactsPage = 1;
    this.remarkLeadContactsHasMore = false;

    if (!this.dashboardCode || !this.selectedRemarkFilter) {
      this.remarkLeads = [];
      this.remarkLeadCompanies = [];
      this.remarkLeadCompanyTotal = 0;
      this.selectedRemarksFilterCompany = '';
      this.remarkLeadsLoading = false;
      this.remarkLeadCompaniesLoading = false;
      this.remarkLeadContactsLoadingMore = false;
      return;
    }

    if (forceRefresh || !this.restoreCachedRemarkLeadCompanyPage(1)) {
      this.remarkLeads = [];
      this.remarkLeadCompanies = [];
      this.remarkLeadCompanyTotal = 0;
      this.selectedRemarksFilterCompany = '';
      this.remarkLeadsLoading = true;
    }

    this.closeAdminLeadPanels();
    this.loadRemarkLeadCompanies(false, forceRefresh);
  }

  onRemarkFilterSidebarScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
      this.loadRemarkLeadCompanies(true);
    }
  }

  onRemarkFilterContactsScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 120) {
      this.loadRemarkLeadContacts(true);
    }
  }

  private remarkLeadCompanyCacheKey(page: number): string {
    return [
      this.remarkLeadCompanyCachePrefix,
      this.dashboardCode,
      this.selectedRemarkFilter || 'all',
      this.remarkFilterSearch.trim().toLowerCase() || 'all',
      `page:${page}`,
    ].join('|');
  }

  private remarkLeadContactCacheKey(page: number, company = this.selectedRemarksFilterCompany): string {
    return [
      this.remarkLeadContactCachePrefix,
      this.dashboardCode,
      this.selectedRemarkFilter || 'all',
      this.remarkFilterSearch.trim().toLowerCase() || 'all',
      company || 'none',
      `page:${page}`,
    ].join('|');
  }

  private restoreCachedRemarkLeadCompanyPage(page: number, append = false): boolean {
    const payload = this.dashboardCache.get<{
      companies: Array<{ name: string; count: number }>;
      leads: Lead[];
      page: number;
      hasMore: boolean;
      total: number;
    }>(this.remarkLeadCompanyCacheKey(page));
    if (!payload) return false;

    this.remarkLeadCompanies = append
      ? this.mergeRemarkLeadCompanies(this.remarkLeadCompanies, payload.companies || [])
      : (payload.companies || []);
    this.remarkLeads = append
      ? this.mergeRemarkHydratedLeads(this.remarkLeads, payload.leads || [])
      : (payload.leads || []);
    this.remarkLeadCompanyPage = payload.page;
    this.remarkLeadCompanyHasMore = payload.hasMore;
    this.remarkLeadCompanyTotal = payload.total || this.remarkLeadCompanies.length;
    this.remarkLeadsLoading = false;
    this.remarkLeadCompaniesLoading = false;

    if (!append) {
      const selectedStillVisible = this.remarkLeadCompanies.some((company) => company.name === this.selectedRemarksFilterCompany);
      if (!selectedStillVisible) this.selectedRemarksFilterCompany = this.remarkLeadCompanies[0]?.name || '';
      this.ensureSelectedRemarkLeadContactsLoaded();
    }

    return true;
  }

  private restoreCachedRemarkLeadContactPage(page: number, append = false): boolean {
    const payload = this.dashboardCache.get<{ leads: Lead[]; page: number; hasMore: boolean }>(
      this.remarkLeadContactCacheKey(page)
    );
    if (!payload) return false;

    const selectedCompany = this.remarkLeadCompanies.find((company) => company.name === this.selectedRemarksFilterCompany);
    const expectedCount = selectedCompany?.count || 0;
    if (!append && expectedCount > 0 && (!payload.leads || payload.leads.length === 0)) return false;

    const otherCompanyLeads = this.remarkLeads.filter((lead: Lead) => lead.leadCompanyName !== this.selectedRemarksFilterCompany);
    const selectedCompanyLeads = append
      ? [...this.remarksFilterLeadsInCompany, ...(payload.leads || [])]
      : (payload.leads || []);

    this.remarkLeads = [...otherCompanyLeads, ...selectedCompanyLeads];
    this.remarkLeadContactsPage = payload.page;
    this.remarkLeadContactsHasMore = payload.hasMore;
    this.remarkLeadsLoading = false;
    this.remarkLeadContactsLoadingMore = false;
    return true;
  }

  private loadRemarkLeadCompanies(append: boolean, forceRefresh = false): void {
    if (!this.dashboardCode || !this.selectedRemarkFilter) return;
    if (append && (this.remarkLeadCompaniesLoading || !this.remarkLeadCompanyHasMore)) return;

    const run = this.remarkLeadRequestRun;
    const page = append ? this.remarkLeadCompanyPage + 1 : 1;
    if (!forceRefresh && this.restoreCachedRemarkLeadCompanyPage(page, append)) {
      if (!this.isAdminDashboardCacheRefreshDue(this.remarkLeadCompanyCacheKey(page))) return;
    }

    this.remarkLeadCompaniesLoading = true;

    this.leadService.getAdminLeadCompanies(this.dashboardCode, {
      remark: this.selectedRemarkFilter,
      search: this.remarkFilterSearch || undefined,
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
      includeContacts: true,
      contactPageSize: OPERATIONAL_PAGE_SIZE,
    }).subscribe({
      next: (res: any) => {
        if (run !== this.remarkLeadRequestRun) return;

        const companies = res?.companies || [];
        const hydratedLeads = this.flattenAdminContactsByCompany(res?.contactsByCompany);
        this.remarkLeadCompanies = append ? this.mergeRemarkLeadCompanies(this.remarkLeadCompanies, companies) : companies;
        this.remarkLeads = append ? this.mergeRemarkHydratedLeads(this.remarkLeads, hydratedLeads) : hydratedLeads;
        this.remarkLeadCompanyPage = res?.page || page;
        this.remarkLeadCompanyHasMore = !!res?.hasMore;
        this.remarkLeadCompanyTotal = Number(res?.totalCompanies || res?.total || res?.count || this.remarkLeadCompanies.length) || this.remarkLeadCompanies.length;
        this.remarkLeadsLoading = false;
        this.remarkLeadCompaniesLoading = false;

        if (!append) {
          this.selectedRemarksFilterCompany = this.remarkLeadCompanies[0]?.name || '';
          const selectedHydratedCount = hydratedLeads.filter((lead: Lead) => lead.leadCompanyName === this.selectedRemarksFilterCompany).length;
          this.remarkLeadContactsPage = 1;
          this.remarkLeadContactsHasMore = selectedHydratedCount < (this.remarkLeadCompanies[0]?.count || 0);
          if (this.selectedRemarksFilterCompany && !selectedHydratedCount) this.loadRemarkLeadContacts(false);
        }

        this.dashboardCache.set(this.remarkLeadCompanyCacheKey(page), {
          companies,
          leads: hydratedLeads,
          page: this.remarkLeadCompanyPage,
          hasMore: this.remarkLeadCompanyHasMore,
          total: this.remarkLeadCompanyTotal,
        }, { ttlMs: this.adminDashboardCacheTtlMs });
      },
      error: () => {
        this.remarkLeadCompaniesLoading = false;
        this.remarkLeadsLoading = false;
      },
    });
  }

  private loadRemarkLeadContacts(append: boolean, forceRefresh = false): void {
    if (!this.dashboardCode || !this.selectedRemarkFilter || !this.selectedRemarksFilterCompany) return;
    if (append && (this.remarkLeadContactsLoadingMore || !this.remarkLeadContactsHasMore)) return;

    const run = this.remarkLeadRequestRun;
    const page = append ? this.remarkLeadContactsPage + 1 : 1;
    if (!forceRefresh && this.restoreCachedRemarkLeadContactPage(page, append)) {
      if (!this.isAdminDashboardCacheRefreshDue(this.remarkLeadContactCacheKey(page))) return;
    }

    if (append) this.remarkLeadContactsLoadingMore = true;
    else this.remarkLeadsLoading = true;

    this.leadService.getAdminLeadPage(this.dashboardCode, {
      remark: this.selectedRemarkFilter,
      search: this.remarkFilterSearch || undefined,
      company: this.selectedRemarksFilterCompany,
      page,
      pageSize: OPERATIONAL_PAGE_SIZE,
      paginated: true,
    }).subscribe({
      next: (res: any) => {
        if (run !== this.remarkLeadRequestRun) return;

        const leads = (res?.leads || res?.items || []).map((lead: any) => this.normalizeLead(lead));
        const otherCompanyLeads = this.remarkLeads.filter((lead: Lead) => lead.leadCompanyName !== this.selectedRemarksFilterCompany);
        const selectedCompanyLeads = append ? [...this.remarksFilterLeadsInCompany, ...leads] : leads;

        this.remarkLeads = [...otherCompanyLeads, ...selectedCompanyLeads];
        this.remarkLeadContactsPage = res?.page || page;
        this.remarkLeadContactsHasMore = !!res?.hasMore;
        this.remarkLeadsLoading = false;
        this.remarkLeadContactsLoadingMore = false;

        this.dashboardCache.set(this.remarkLeadContactCacheKey(page), {
          leads,
          page: this.remarkLeadContactsPage,
          hasMore: this.remarkLeadContactsHasMore,
        }, { ttlMs: this.adminDashboardCacheTtlMs });
      },
      error: () => {
        this.remarkLeadsLoading = false;
        this.remarkLeadContactsLoadingMore = false;
      },
    });
  }

  private ensureSelectedRemarkLeadContactsLoaded(): void {
    if (!this.selectedRemarksFilterCompany) return;
    const selectedCompany = this.remarkLeadCompanies.find((company) => company.name === this.selectedRemarksFilterCompany);
    const expectedCount = selectedCompany?.count || 0;
    if (expectedCount <= 0) return;
    if (this.remarksFilterLeadsInCompany.length > 0) return;
    this.loadRemarkLeadContacts(false, true);
  }

  private mergeRemarkLeadCompanies(
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

  private mergeRemarkHydratedLeads(existing: Lead[], incoming: Lead[]): Lead[] {
    const byKey = new Map<string, Lead>();
    const pickKey = (lead: Lead): string => {
      const id = String(lead._id || '').trim();
      if (id) return `id:${id}`;
      return [
        'contact',
        String(lead.leadCompanyName || '').trim(),
        String(lead.contactNumber || '').trim(),
      ].join('|');
    };

    [...existing, ...incoming].forEach((lead) => {
      if (!lead) return;
      byKey.set(pickKey(lead), lead);
    });

    return Array.from(byKey.values());
  }

  get remarksFilteredLeads(): any[] {
    if (!this.selectedRemarkFilter) return [];
    return this.remarkLeads;
  }

  get remarksFilterUniqueCompanies(): string[] {
    return this.remarkLeadCompanies.map((company) => company.name);
  }

  selectedRemarksFilterCompany: string = '';

  selectRemarksFilterCompany(company: string): void {
    this.selectedRemarksFilterCompany = company;
    this.closeAdminLeadPanels();
    const currentCount = this.remarksFilterLeadsInCompany.length;
    const expectedCount = this.getRemarksFilterCompanyCount(company);
    if (expectedCount > currentCount) {
      this.remarkLeadContactsPage = 1;
      this.remarkLeadContactsHasMore = true;
      this.loadRemarkLeadContacts(false);
    }
  }

  getRemarksFilterCompanyCount(company: string): number {
    return this.remarkLeadCompanies.find((item) => item.name === company)?.count
      || this.remarksFilteredLeads.filter((lead) => lead.leadCompanyName === company).length;
  }

  get remarksFilterLeadsInCompany(): any[] {
    if (!this.selectedRemarksFilterCompany) return [];
    return this.remarksFilteredLeads.filter(l => l.leadCompanyName === this.selectedRemarksFilterCompany);
  }

  remarkFilterCompanyPreviewLine(company: string): string {
    const lead = this.remarksFilterLeadsInCompany.find((item) => item.mainDivisionDescription || item.companyDescription)
      || this.remarkLeads.find((item) => item.leadCompanyName === company && (item.mainDivisionDescription || item.companyDescription));
    return lead?.mainDivisionDescription || lead?.companyDescription || '';
  }

  get leadsInSelectedCompany(): any[] {
    if (!this.selectedLeadCompany) return [];
    return this.allLeads
      .filter(l => {
        const companyMatches = l.leadCompanyName === this.selectedLeadCompany;
        const statusMatches = !this.adminLeadStatusFilter || (l.status || 'New') === this.adminLeadStatusFilter;
        const employeeMatches = !this.leadEmployeeFilter || l.assignedEmployeePhone === this.leadEmployeeFilter;
        const q = this.leadSearchQuery.toLowerCase();
        const remarks: string[] = Array.isArray(l.remarks) ? l.remarks : [];
        const searchMatches = !this.leadSearchQuery ||
          l.leadCompanyName?.toLowerCase().includes(q) ||
          l.contactName?.toLowerCase().includes(q) ||
          l.contactNumber?.includes(this.leadSearchQuery) ||
          l.directorEmailAddress?.toLowerCase().includes(q) ||
          l.mainDivisionDescription?.toLowerCase().includes(q) ||
          l.companyDescription?.toLowerCase().includes(q) ||
          remarks.some((remark) => remark.toLowerCase().includes(q));
        return companyMatches && statusMatches && employeeMatches && searchMatches;
      });
  }

  adminLeadCompanyPreviewLine(company: string): string {
    const lead = this.getLeadsByCompany(company).find((item) => item.mainDivisionDescription || item.companyDescription);
    return lead?.mainDivisionDescription || lead?.companyDescription || '';
  }

  adminLeadRemarkPreviewList(lead: Lead): string[] {
    return [...(lead.remarks || [])].filter(Boolean).reverse();
  }

  getLeadsByCompany(company: string): any[] {
    return this.allLeads.filter(l => l.leadCompanyName === company);
  }

  getAdminLeadCompanyCount(company: string): number {
    return this.adminLeadCompanies.find((item) => item.name === company)?.count || this.getLeadsByCompany(company).length;
  }

  selectLeadCompany(company: string): void {
    this.selectedLeadCompany = company;
    this.closeAdminLeadPanels();
    if (this.dashTab === 'leads') {
      this.loadAdminLeadContacts(false);
    }
  }

  // Employee Dashboard Lead Sidebar logic
  get empUniqueCompanies(): string[] { return this.adminEmployeesWorkflow.empUniqueCompanies(this); }

  get leadsInSelectedEmpCompany(): any[] { return this.adminEmployeesWorkflow.leadsInSelectedEmpCompany(this); }

  empLeadsByCompanyCache: { [company: string]: any[] } = {};
  lastFilteredEmpLeadsRefForCompany: any[] | null = null;

  getEmpLeadsByCompany(company: string): any[] { return this.adminEmployeesWorkflow.getEmpLeadsByCompany(this, company); }

  getEmpLeadCompanyCount(company: string): number { return this.adminEmployeesWorkflow.getEmpLeadCompanyCount(this, company); }

  selectEmpLeadCompany(company: string): void { return this.adminEmployeesWorkflow.selectEmpLeadCompany(this, company); }

  // ── Bookmarks (Follow-up) ──────────────────────────────────
  fetchCompanyBookmarks(forceRefresh = false, append = false): void { return this.adminFollowupsWorkflow.fetchCompanyBookmarks(this, forceRefresh, append); }

  onFollowupFiltersChange(): void { return this.adminFollowupsWorkflow.onFollowupFiltersChange(this); }

  onAdminFollowupSidebarScroll(event: Event): void { return this.adminFollowupsWorkflow.onAdminFollowupSidebarScroll(this, event); }

  private adminFollowupCompanyCacheKey(page: number): string { return this.adminFollowupsWorkflow.adminFollowupCompanyCacheKey(this, page); }

  private restoreCachedAdminFollowupCompanyPage(page: number, append = false): boolean { return this.adminFollowupsWorkflow.restoreCachedAdminFollowupCompanyPage(this, page, append); }

  private applyAdminFollowupPagePayload(payload: any, append: boolean): void { return this.adminFollowupsWorkflow.applyAdminFollowupPagePayload(this, payload, append); }

  private normalizeAdminFollowupCompanies(rawCompanies: any[] | undefined, bookmarks: Bookmark[]): Array<{ company: string; count: number }> { return this.adminFollowupsWorkflow.normalizeAdminFollowupCompanies(this, rawCompanies, bookmarks); }

  private mergeAdminFollowupCompanies(
    existing: Array<{ company: string; count: number }>,
    incoming: Array<{ company: string; count: number }>,
  ): Array<{ company: string; count: number }> { return this.adminFollowupsWorkflow.mergeAdminFollowupCompanies(this, existing, incoming); }

  private mergeBookmarks(existing: Bookmark[], incoming: Bookmark[]): Bookmark[] { return this.adminFollowupsWorkflow.mergeBookmarks(this, existing, incoming); }

  fetchLeadCallCounts(): void {
    if (!this.dashboardCode) return;
    this.callLogService.getLeadCallCounts(this.dashboardCode).subscribe({
      next: (res: any) => {
        if (res.success) this.leadCallCounts = res.counts;
      }
    });
  }

  normalizedBookmarkCounts: { [num: string]: number } | null = null;
  normalizedCallCounts: { [num: string]: number } | null = null;
  interactionCountCache: { [phone: string]: number } = {};

  lastBookmarksRefForCount: any[] | null = null;
  lastCallCountsRefForCount: any | null = null;

  getLeadInteractionCount(phone: string): number {
    if (!phone) return 0;

    if (this.lastBookmarksRefForCount !== this.allBookmarks) {
      this.normalizedBookmarkCounts = {};
      for (const bm of this.allBookmarks) {
        if (bm.contactNumber) {
          const cleanNum = bm.contactNumber.replace(/\D/g, '').slice(-10);
          if (this.normalizedBookmarkCounts[cleanNum] === undefined) {
             this.normalizedBookmarkCounts[cleanNum] = bm.remarks?.length || 0;
          }
        }
      }
      this.lastBookmarksRefForCount = this.allBookmarks;
      this.interactionCountCache = {}; 
    }

    if (this.lastCallCountsRefForCount !== this.leadCallCounts) {
      this.normalizedCallCounts = {};
      if (this.leadCallCounts) {
        for (const key of Object.keys(this.leadCallCounts)) {
          const cleanNum = key.replace(/\D/g, '').slice(-10);
          this.normalizedCallCounts[cleanNum] = (this.normalizedCallCounts[cleanNum] || 0) + this.leadCallCounts[key];
        }
      }
      this.lastCallCountsRefForCount = this.leadCallCounts;
      this.interactionCountCache = {}; 
    }

    if (this.interactionCountCache[phone] !== undefined) {
      return this.interactionCountCache[phone];
    }

    const cleanNum = phone.replace(/\D/g, '').slice(-10);
    const bCount = this.normalizedBookmarkCounts![cleanNum] || 0;
    const cCount = this.normalizedCallCounts![cleanNum] || 0;
    
    const total = bCount + cCount;
    this.interactionCountCache[phone] = total;
    return total;
  }

  viewAllRemarks(bookmark: any): void {
    this.selectedBookmarkForRemarks = bookmark;
    this.showAllRemarksModal = true;
  }

  closeAllRemarksModal(): void {
    this.showAllRemarksModal = false;
    this.selectedBookmarkForRemarks = null;
  }

  deleteBookmark(id: string): void { return this.adminFollowupsWorkflow.deleteBookmark(this, id); }

  getEmployeeInteractionCount(mobile: string): number {
    // For employees, we'll still show the manually logged interactions for now
    // as their call stats are already shown in other columns.
    return this.allBookmarks
      .filter(bm => bm.employeePhone === mobile)
      .reduce((sum, bm) => sum + (bm.remarks?.length || 0), 0);
  }

  getCompanyInteractionCount(company: string): number {
    const companyContacts = this.allLeads.filter(l => l.leadCompanyName === company);
    let total = 0;
    companyContacts.forEach(contact => {
      total += this.getLeadInteractionCount(contact.contactNumber);
    });
    return total;
  }

  selectLeadSet(set: string): void { return this.adminEmployeesWorkflow.selectLeadSet(this, set); }

  deleteLeadSet(setLabel: string): void { return this.adminEmployeesWorkflow.deleteLeadSet(this, setLabel); }

  // ── Manual Lead Addition ─────────────────────────────────────────
  addManualLead(): void {
    if (!this.newSingleLead.contactNumber || !this.newSingleLead.leadCompanyName) {
      this.addLeadError = 'Please enter Company Name and Contact Number.';
      return;
    }
    this.addLeadLoading = true;
    this.addLeadError = '';
    this.addLeadSuccess = '';

    const contactName = (this.newSingleLead.firstName.trim() + ' ' + this.newSingleLead.lastName.trim()).trim();

    const payload: Partial<Lead> = {
      companyCode: this.dashboardCode,
      assignedEmployeePhone: this.selectedEmployee!.mobile,
      leadCompanyName: this.newSingleLead.leadCompanyName.trim(),
      contactName: contactName,
      contactNumber: this.newSingleLead.contactNumber.trim(),
      setLabel: this.newLeadSetLabel.trim() || '',
      mainDivisionDescription: this.newSingleLead.mainDivisionDescription.trim(),
      directorEmailAddress: this.newSingleLead.directorEmailAddress.trim(),
      remarks: this.newSingleLead.remarks ? [this.newSingleLead.remarks.trim()] : [],
      status: this.newSingleLead.status,
      companyDescription: this.newSingleLead.companyDescription.trim(),
    };

    this.leadService.addSingleLead(payload).subscribe({
      next: (res: any) => {
        this.addLeadLoading = false;
        if (res.success) {
          this.invalidateAdminDashboardCaches();
          this.addLeadSuccess = 'Lead added successfully!';
          this.newSingleLead = { firstName: '', lastName: '', contactNumber: '', leadCompanyName: '', mainDivisionDescription: '', directorEmailAddress: '', remarks: '', status: 'New', companyDescription: '' };
          this.fetchEmpLeads();
          setTimeout(() => this.addLeadSuccess = '', 3000);
        } else {
          this.addLeadError = res.message || 'Failed to add lead.';
        }
      },
      error: () => {
        this.addLeadLoading = false;
        this.addLeadError = 'Server error maintaining lead. Please check connection.';
      }
    });
  }

  // ── Excel Upload & Mapping ───────────────────────────────────────
  onLeadExcelUpload(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.addLeadError = '';
    this.leadImportRowErrors = [];
    this.leadUploadStep = 'mapping';
    this.parsedExcelData = [];
    this.excelHeaders = [];
    this.leadColumnMapping = { firstName: '', lastName: '', contactNumber: '', leadCompanyName: '', mainDivisionDescription: '', directorEmailAddress: '', remarks: '', companyDescription: '' };
    this.batchDefaultStatus = 'New';

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (rawJson.length < 2) {
          this.addLeadError = 'Excel file seems empty or missing headers.';
          this.leadUploadStep = 'idle';
          return;
        }

        // Extract headers
        this.excelHeaders = rawJson[0].map((h: any) => h ? h.toString().trim() : '');

        // Filter out empty rows and build objects based on headers
        this.parsedExcelData = [];
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;
          const hasData = row.some((cell: any) => cell !== undefined && cell !== null && cell.toString().trim() !== '');
          if (!hasData) continue;
          let rowData: any = {};
          this.excelHeaders.forEach((header, index) => {
            if (header) rowData[header] = row[index];
          });
          rowData.__excelRowNumber = i + 1;
          this.parsedExcelData.push(rowData);
        }

        // Auto-attempt mapping if headers match standard names
        this.leadColumnMapping.firstName = this.excelHeaders.find(h => ['first name', 'firstname', 'name', 'contact name', 'directorfirstname'].includes(h.toLowerCase())) || this.excelHeaders[0];
        this.leadColumnMapping.lastName = this.excelHeaders.find(h => ['last name', 'lastname', 'surname', 'second name'].includes(h.toLowerCase())) || '';
        this.leadColumnMapping.contactNumber = this.excelHeaders.find(h => ['number', 'phone', 'mobile', 'contact number', 'directormobilenumber'].includes(h.toLowerCase())) || this.excelHeaders[1] || '';
        this.leadColumnMapping.leadCompanyName = this.excelHeaders.find(h => ['company', 'company name', 'business'].includes(h.toLowerCase())) || this.excelHeaders[2] || '';
        this.leadColumnMapping.mainDivisionDescription = this.excelHeaders.find(h => ['maindivisiondescription', 'division'].includes(h.toLowerCase())) || '';
        this.leadColumnMapping.directorEmailAddress = this.excelHeaders.find(h => ['directoremailaddress', 'email'].includes(h.toLowerCase())) || '';
        this.leadColumnMapping.remarks = this.excelHeaders.find(h => ['remarks', 'notes'].includes(h.toLowerCase())) || '';
        this.leadColumnMapping.companyDescription = this.excelHeaders.find(h => ['company description', 'description'].includes(h.toLowerCase())) || '';

      } catch (err) {
        this.addLeadError = 'Invalid Excel format.';
        this.leadUploadStep = 'idle';
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    event.target.value = null;
  }

  cancelLeadMapping(): void {
    this.leadUploadStep = 'idle';
    this.parsedExcelData = [];
    this.excelHeaders = [];
    this.leadImportRowErrors = [];
    this.leadColumnMapping = { firstName: '', lastName: '', contactNumber: '', leadCompanyName: '', mainDivisionDescription: '', directorEmailAddress: '', remarks: '', companyDescription: '' };
    this.batchDefaultStatus = 'New';
  }

  confirmLeadMapping(): void {
    if (!this.leadColumnMapping.contactNumber || !this.leadColumnMapping.leadCompanyName) {
      this.addLeadError = 'Contact Number and Company Name columns must be mapped.';
      return;
    }

    this.leadUploadStep = 'uploading';
    this.addLeadLoading = true;
    this.addLeadError = '';
    this.leadImportRowErrors = [];

    const setLabel = this.newLeadSetLabel.trim();
    const validationErrors: string[] = [];
    const mappedLeads: Partial<Lead>[] = [];

    this.parsedExcelData.forEach(row => {
        const contactNumber = row[this.leadColumnMapping.contactNumber]?.toString().trim() || '';
        const leadCompanyName = row[this.leadColumnMapping.leadCompanyName]?.toString().trim() || '';
        const missingFields = [
          !leadCompanyName ? 'Company Name' : '',
          !contactNumber ? 'Contact Number' : ''
        ].filter(Boolean);

        if (missingFields.length) {
          validationErrors.push(`Row ${row.__excelRowNumber || '?'}: missing ${missingFields.join(', ')}`);
          return;
        }
        
        const fName = this.leadColumnMapping.firstName ? (row[this.leadColumnMapping.firstName]?.toString().trim() || '') : '';
        const lName = this.leadColumnMapping.lastName ? (row[this.leadColumnMapping.lastName]?.toString().trim() || '') : '';
        const contactName = (fName + ' ' + lName).trim();

        const mainDivisionDescription = this.leadColumnMapping.mainDivisionDescription ? (row[this.leadColumnMapping.mainDivisionDescription]?.toString().trim() || '') : '';
        const directorEmailAddress = this.leadColumnMapping.directorEmailAddress ? (row[this.leadColumnMapping.directorEmailAddress]?.toString().trim() || '') : '';
        const remarks = this.leadColumnMapping.remarks ? (row[this.leadColumnMapping.remarks]?.toString().trim() || '') : '';
        const status = this.batchDefaultStatus;
        const companyDescription = this.leadColumnMapping.companyDescription ? (row[this.leadColumnMapping.companyDescription]?.toString().trim() || '') : '';

        mappedLeads.push({
          companyCode: this.dashboardCode,
          assignedEmployeePhone: this.selectedEmployee!.mobile,
          contactNumber,
          leadCompanyName,
          contactName,
          setLabel,
          mainDivisionDescription,
          directorEmailAddress,
          remarks: remarks ? [remarks] : [],
          status,
          companyDescription,
          isStarred: false,
          isFavourite: false,
          createdAt: new Date().toISOString()
        });
      });

    if (validationErrors.length > 0) {
      this.leadImportRowErrors = validationErrors;
      this.addLeadError = 'Please fix the rows listed below and import again.';
      this.leadUploadStep = 'mapping';
      this.addLeadLoading = false;
      return;
    }

    if (mappedLeads.length === 0) {
      this.addLeadError = 'No valid leads found in Excel after mapping. Ensure rows are not empty.';
      this.leadUploadStep = 'mapping';
      this.addLeadLoading = false;
      return;
    }

    this.leadService.addBulkLeads(mappedLeads).subscribe({
      next: (res: any) => {
        this.addLeadLoading = false;
        if (res.success) {
          this.invalidateAdminDashboardCaches();
          this.addLeadSuccess = `Successfully mapped and imported ${res.count} leads!`;
          this.leadUploadStep = 'idle';
          this.fetchEmpLeads();
          setTimeout(() => this.addLeadSuccess = '', 4000);
        } else {
          this.addLeadError = res.message || 'Bulk upload failed.';
          this.leadUploadStep = 'mapping';
        }
      },
      error: () => {
        this.addLeadLoading = false;
        this.addLeadError = 'Server error during bulk upload. Connection issue.';
        this.leadUploadStep = 'mapping';
      }
    });
  }

  deleteLead(id: string): void {
    if (confirm('Are you sure you want to remove this lead?')) {
      this.leadService.deleteLead(id).subscribe(res => {
        if (res.success) {
          this.invalidateAdminDashboardCaches();
          this.fetchEmpLeads();
        }
      });
    }
  }

  deleteCurrentLeadSet(): void {
    if (!this.selectedLeadSet) return;
    if (confirm(`Are you sure you want to delete ALL leads in the set "${this.selectedLeadSet}" for this employee?`)) {
      this.leadService.deleteLeadSet(this.dashboardCode, this.selectedEmployee!.mobile, this.selectedLeadSet).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.selectedLeadSet = '';
            this.fetchEmpLeads();
            alert(`Deleted ${res.deleted} leads from this set.`);
          }
        },
        error: () => alert('Failed to delete set.')
      });
    }
  }

  deleteGlobalLeadSet(): void {
    if (!this.selectedAdminLeadSet) return;
    if (confirm(`Are you sure you want to delete ALL leads in the set "${this.selectedAdminLeadSet}" for the entire company? This will remove these leads from all assigned employees.`)) {
      this.leadService.deleteAdminLeadSet(this.dashboardCode, this.selectedAdminLeadSet).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.invalidateAdminDashboardCaches();
            this.selectedAdminLeadSet = '';
            this.fetchAdminLeads(true);
            alert(`Deleted ${res.deleted} leads from this global set.`);
          }
        },
        error: () => alert('Failed to delete global set.')
      });
    }
  }

  get filteredEmpLeads(): any[] {
    return this.empLeads;
  }

  get empUniqueCompaniesFiltered(): string[] {
    return this.empUniqueCompanies;
  }

  get leadsInSelectedEmpCompanyFiltered(): any[] {
    return this.leadsInSelectedEmpCompany;
  }

  switchDrilldownTab(tab: 'stats' | 'calls' | 'leads' | 'followups'): void {
    this.drilldownTab = tab;
    if (tab === 'leads') {
      this.fetchEmpLeads();
    }
    if (tab === 'followups') {
      this.fetchEmpFollowups();
      this.ensureSelectedEmpFollowupCompany();
    }
    if (tab === 'stats' && this.selectedEmpStats) {
      setTimeout(() => {
        this.renderChart();
        this.renderEmpDonutChart();
      }, 100);
    }
    if (tab === 'followups') {
      this.fetchCompanyBookmarks();
    }
  }

  // ── Follow-up Bulk Import ──────────────────────────────────────
  onFollowupExcelUpload(event: any): void { return this.adminFollowupsWorkflow.onFollowupExcelUpload(this, event); }

  confirmFollowupMapping(): void { return this.adminFollowupsWorkflow.confirmFollowupMapping(this); }
}

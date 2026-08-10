import { Component, HostListener, ViewEncapsulation } from '@angular/core';
import { NgIf } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { CallLogService } from '../../services/calllog.service';
import { LeadService } from '../../services/lead.service';
import { AiBriefService } from '../../services/ai-brief.service';
import { CrmService } from '../../services/crm.service';
import { TicketService } from '../../services/ticket.service';
import { DashboardCacheService } from '../../core/cache/dashboard-cache.service';
import { AdminDashboardShellComponent } from './sections/admin-dashboard-shell/admin-dashboard-shell.component';
import { AdminLandingComponent } from '../auth/presentation/admin-landing/admin-landing.component';
import { AdminAuthPaymentWorkflow } from '../auth/presentation/admin-auth-payment.workflow';
import { AdminEmployeesWorkflow } from '../employees/presentation/admin-employees.workflow';
import { AdminFollowupsWorkflow } from '../follow-ups/presentation/admin-followups.workflow';
import { AdminInvoiceQuotationWorkflow } from '../invoices/presentation/admin-invoice-quotation.workflow';
import { AdminLeadsWorkflow } from '../leads/presentation/admin-leads.workflow';
import { AdminSettingsWorkflow } from '../settings/presentation/admin-settings.workflow';
import { AdminWorkspaceModalsComponent } from './sections/admin-workspace-modals/admin-workspace-modals.component';
import { AdminWorkspaceController } from './state/admin-workspace.controller';

@Component({
  selector: 'app-admin-workspace',
  imports: [
    NgIf,
    AdminDashboardShellComponent,
    AdminLandingComponent,
    AdminWorkspaceModalsComponent
  ],
  template: `
    <div class="splash-screen" *ngIf="showSplash" [class.fade-out]="!showSplash">
      <div class="splash-content">
        <div class="splash-logo">
          <img src="assets/icon/logo.png" alt="DealVoice Logo">
        </div>
        <div class="splash-loader">
          <div class="loader-bar"></div>
        </div>
      </div>
    </div>

    <app-admin-landing [vm]="self"></app-admin-landing>
    <app-admin-dashboard-shell [vm]="self"></app-admin-dashboard-shell>
    <app-admin-workspace-modals [vm]="self"></app-admin-workspace-modals>
  `,
  styleUrls: [
    './styles/landing-shell.css',
    './styles/dashboard-base.css',
    '../reports/presentation/styles/reports-settings-base.css',
    '../auth/presentation/styles/marketing-pricing.css',
    '../leads/presentation/styles/leads-base.css',
    '../follow-ups/presentation/styles/followups-employee-base.css',
    './styles/admin-crm-overrides.css',
    './styles/admin-phase-overrides.css',
    '../leads/presentation/styles/admin-leads-rewrite.css',
    './styles/employee-portal-parity.css',
    './styles/admin-polish-overrides.css',
    '../invoices/presentation/styles/invoice-quotation-modals.css',
    '../employees/presentation/styles/record-layouts-employee-detail.css',
    './styles/admin-global-compat.css',
    './styles/final-alignment-overrides.css'
  ],
  encapsulation: ViewEncapsulation.None
})
export class AdminWorkspaceComponent extends AdminWorkspaceController {
  adminLeadViewMode: 'grid' | 'table' = 'grid';
  adminFollowupViewMode: 'grid' | 'table' = 'grid';
  hoveredField: string | null = null;
  copiedField: string | null = null;

  // ── Deal Modal ──────────────────────────────────────────────────
  dealModalVisible = false;
  dealModalLead: any = null;
  dealForm = {
    dealName: '',
    amount: 0,
    closingDate: '',
    description: '',
  };
  dealModalSaving = false;
  dealAmountDisplay = '';

  get products() {
    return this.settingsProducts || [];
  }

  openDealModal(lead: any): void {
    this.dealModalLead = lead;
    this.dealForm = {
      dealName: '',
      amount: 0,
      closingDate: '',
      description: '',
    };
    this.dealAmountDisplay = '';
    this.dealModalVisible = true;
  }

  onDealAmountChange(value: string) {
    if (!value) {
      this.dealForm.amount = 0;
      this.dealAmountDisplay = '';
      return;
    }
    const numericValue = value.toString().replace(/[^0-9]/g, '');
    this.dealForm.amount = numericValue ? parseInt(numericValue, 10) : 0;
    this.dealAmountDisplay = numericValue ? Number(numericValue).toLocaleString('en-IN') : '';
  }

  closeDealModal(): void {
    this.dealModalVisible = false;
    this.dealModalLead = null;
  }

  saveDeal(): void {
    if (!this.dealModalLead || !this.dealForm.dealName) return;

    this.dealModalSaving = true;
    const payload = {
      companyCode: this.dashboardCode,
      leadId: this.dealModalLead._id,
      ...this.dealForm
    };

    this.api.post<any>('/api/deals', payload).subscribe({
      next: () => {
        this.dealModalSaving = false;
        this.closeDealModal();
        this.fetchAdminLeads(true);
      },
      error: (err: any) => {
        console.error('Error saving deal:', err);
        this.dealModalSaving = false;
        alert('Failed to save deal');
      }
    });
  }

  copyText(text: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = text;
      setTimeout(() => this.copiedField = null, 2000);
    });
  }
  constructor(
    callLogService: CallLogService,
    leadService: LeadService,
    aiBriefService: AiBriefService,
    crmService: CrmService,
    ticketService: TicketService,
    api: ApiService,
    dashboardCache: DashboardCacheService,
    authPaymentWorkflow: AdminAuthPaymentWorkflow,
    invoiceQuotationWorkflow: AdminInvoiceQuotationWorkflow,
    adminLeadsWorkflow: AdminLeadsWorkflow,
    adminFollowupsWorkflow: AdminFollowupsWorkflow,
    adminSettingsWorkflow: AdminSettingsWorkflow,
    adminEmployeesWorkflow: AdminEmployeesWorkflow
  ) {
    super(
      callLogService,
      leadService,
      aiBriefService,
      crmService,
      ticketService,
      api,
      dashboardCache,
      authPaymentWorkflow,
      invoiceQuotationWorkflow,
      adminLeadsWorkflow,
      adminFollowupsWorkflow,
      adminSettingsWorkflow,
      adminEmployeesWorkflow
    );
  }

  @HostListener('window:scroll', [])
  override onWindowScroll(): void {
    super.onWindowScroll();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.handleDocumentClick(event);
  }

  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    this.handleGlobalEscape();
  }
}

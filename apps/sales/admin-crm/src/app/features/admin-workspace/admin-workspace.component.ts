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

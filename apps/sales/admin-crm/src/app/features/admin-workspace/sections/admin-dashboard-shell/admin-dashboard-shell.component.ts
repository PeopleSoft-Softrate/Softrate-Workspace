import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { AdminWorkspaceComponent } from '../../admin-workspace.component';
import { AdminDashboardNavComponent } from '../admin-dashboard-nav/admin-dashboard-nav.component';
import { AdminDashboardSidebarComponent } from '../admin-dashboard-sidebar/admin-dashboard-sidebar.component';
import { AdminEmployeeDashboardSectionComponent } from '../../../employees/presentation/admin-employee-dashboard-section/admin-employee-dashboard-section.component';
import { AdminEmployeeDrilldownComponent } from '../../../employees/presentation/admin-employee-drilldown/admin-employee-drilldown.component';
import { AdminEmployeesSectionComponent } from '../../../employees/presentation/admin-employees-section/admin-employees-section.component';
import { AdminFollowupsSectionComponent } from '../../../follow-ups/presentation/admin-followups-section/admin-followups-section.component';
import { AdminInvoiceSectionComponent } from '../../../invoices/presentation/admin-invoice-section/admin-invoice-section.component';
import { AdminLeadsSectionComponent } from '../../../leads/presentation/admin-leads-section/admin-leads-section.component';
import { AdminOrganizationSectionComponent } from '../../../settings/presentation/admin-organization-section/admin-organization-section.component';
import { AdminOverviewSectionComponent } from '../../../overview/presentation/admin-overview-section/admin-overview-section.component';
import { AdminQuotationSectionComponent } from '../../../quotations/presentation/admin-quotation-section/admin-quotation-section.component';
import { AdminRemarksSectionComponent } from '../../../leads/presentation/admin-remarks-section/admin-remarks-section.component';
import { AdminReportsSectionComponent } from '../../../reports/presentation/admin-reports-section/admin-reports-section.component';
import { AdminSettingsSectionComponent } from '../../../settings/presentation/admin-settings-section/admin-settings-section.component';
import { AdminSupportSectionComponent } from '../../../settings/presentation/admin-support-section/admin-support-section.component';
import { CrmAdminSectionComponent } from '../../crm/crm-admin-section.component';

@Component({
  selector: 'app-admin-dashboard-shell',
  imports: [
    CommonModule,
    AdminDashboardNavComponent,
    AdminDashboardSidebarComponent,
    AdminOverviewSectionComponent,
    AdminEmployeeDashboardSectionComponent,
    AdminEmployeesSectionComponent,
    AdminLeadsSectionComponent,
    AdminRemarksSectionComponent,
    AdminFollowupsSectionComponent,
    AdminReportsSectionComponent,
    AdminOrganizationSectionComponent,
    AdminSettingsSectionComponent,
    AdminSupportSectionComponent,
    AdminInvoiceSectionComponent,
    AdminQuotationSectionComponent,
    CrmAdminSectionComponent,
    AdminEmployeeDrilldownComponent
  ],
  templateUrl: './admin-dashboard-shell.component.html'
})
export class AdminDashboardShellComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

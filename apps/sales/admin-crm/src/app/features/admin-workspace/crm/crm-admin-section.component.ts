import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';
import { CrmAmcSectionComponent } from './crm-amc-section.component';
import { CrmClientsSectionComponent } from './crm-clients-section.component';
import { CrmDocumentsSectionComponent } from './crm-documents-section.component';
import { CrmPaymentsSectionComponent } from './crm-payments-section.component';
import { CrmProjectsSectionComponent } from './crm-projects-section.component';
import { CrmTicketsSectionComponent } from './crm-tickets-section.component';

@Component({
  selector: 'app-crm-admin-section',
  imports: [
    CommonModule,
    CrmClientsSectionComponent,
    CrmDocumentsSectionComponent,
    CrmAmcSectionComponent,
    CrmPaymentsSectionComponent,
    CrmTicketsSectionComponent,
    CrmProjectsSectionComponent,
  ],
  templateUrl: './crm-admin-section.component.html',
})
export class CrmAdminSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

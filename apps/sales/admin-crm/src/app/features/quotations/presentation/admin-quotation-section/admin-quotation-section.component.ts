import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';

@Component({
  selector: 'app-admin-quotation-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-quotation-section.component.html'
})
export class AdminQuotationSectionComponent extends AdminWorkspaceSectionProxy {
  override fetchAdminQuotationClients(): void {
    this.vm.fetchAdminQuotationLeads();
  }

  override openAdminQuotationModalForClient(client: any): void {
    this.vm.openQuotationModal(client);
  }
}

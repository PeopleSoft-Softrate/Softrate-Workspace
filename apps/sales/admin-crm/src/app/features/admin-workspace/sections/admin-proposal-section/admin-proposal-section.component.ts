import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../admin-workspace-section-proxy';

import { PaneSplitterDirective } from '../../../../shared/ui/pane-splitter.directive';
import { TableColumnResizeDirective } from '../../../../shared/ui/table-column-resize.directive';

@Component({
  selector: 'app-admin-proposal-section',
  imports: [CommonModule, FormsModule, PaneSplitterDirective, TableColumnResizeDirective],
  templateUrl: './admin-proposal-section.component.html'
})
export class AdminProposalSectionComponent extends AdminWorkspaceSectionProxy {
  onLeadClick(lead: any): void {
    if (this.vm.selectedProposalLead?._id === lead?._id) {
      this.vm.selectedProposalLead = null;
    } else {
      this.vm.selectedProposalLead = lead;
    }
    this.vm.onAdminProposalHistoryQueryChange();
  }

  openNewProposalForSelectedLead(): void {
    if (this.vm.selectedProposalLead) {
      this.vm.openProposalModal(this.vm.selectedProposalLead);
    }
  }
}

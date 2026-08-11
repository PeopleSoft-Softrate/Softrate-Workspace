import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';
import { PIPELINE_STAGES } from '../../../pipeline/domain/pipeline.model';
import { ADMIN_LEAD_STATUSES } from '../../domain/lead-status-ui';

@Component({
  selector: 'app-admin-leads-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-leads-section.component.html'
})
export class AdminLeadsSectionComponent extends AdminWorkspaceSectionProxy {
  readonly PIPELINE_STAGES = PIPELINE_STAGES;
  readonly ADMIN_LEAD_STATUSES = ADMIN_LEAD_STATUSES;
}

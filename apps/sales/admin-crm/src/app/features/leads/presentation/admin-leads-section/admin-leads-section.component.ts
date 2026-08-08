import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';
import { PIPELINE_STAGES } from '../../../pipeline/domain/pipeline.model';

@Component({
  selector: 'app-admin-leads-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-leads-section.component.html'
})
export class AdminLeadsSectionComponent extends AdminWorkspaceSectionProxy {
  readonly PIPELINE_STAGES = PIPELINE_STAGES;
}

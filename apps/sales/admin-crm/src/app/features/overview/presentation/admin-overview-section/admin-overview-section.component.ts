import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';

@Component({
  selector: 'app-admin-overview-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-overview-section.component.html'
})
export class AdminOverviewSectionComponent extends AdminWorkspaceSectionProxy {}

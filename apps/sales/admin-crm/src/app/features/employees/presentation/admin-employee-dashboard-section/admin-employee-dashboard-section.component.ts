import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';

@Component({
  selector: 'app-admin-employee-dashboard-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-employee-dashboard-section.component.html'
})
export class AdminEmployeeDashboardSectionComponent extends AdminWorkspaceSectionProxy {}

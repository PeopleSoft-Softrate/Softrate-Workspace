import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../../admin-workspace.component';

@Component({
  selector: 'app-admin-dashboard-sidebar',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard-sidebar.component.html'
})
export class AdminDashboardSidebarComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

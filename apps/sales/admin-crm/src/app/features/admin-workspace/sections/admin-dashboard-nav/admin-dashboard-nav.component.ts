import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../../admin-workspace.component';

@Component({
  selector: 'app-admin-dashboard-nav',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard-nav.component.html',
  styleUrls: ['./admin-dashboard-nav.component.css']
})
export class AdminDashboardNavComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

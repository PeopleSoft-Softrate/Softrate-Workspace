import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';

@Component({
  selector: 'app-crm-projects-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-projects-section.component.html',
})
export class CrmProjectsSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

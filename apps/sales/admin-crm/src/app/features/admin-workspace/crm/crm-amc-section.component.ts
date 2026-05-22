import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';

@Component({
  selector: 'app-crm-amc-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-amc-section.component.html',
})
export class CrmAmcSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

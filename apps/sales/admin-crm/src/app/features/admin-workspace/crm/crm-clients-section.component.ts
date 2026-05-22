import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';

@Component({
  selector: 'app-crm-clients-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-clients-section.component.html',
})
export class CrmClientsSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

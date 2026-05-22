import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';

@Component({
  selector: 'app-crm-tickets-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-tickets-section.component.html',
})
export class CrmTicketsSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

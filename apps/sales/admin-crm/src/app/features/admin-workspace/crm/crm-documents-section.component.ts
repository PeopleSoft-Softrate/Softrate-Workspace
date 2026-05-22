import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';

@Component({
  selector: 'app-crm-documents-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-documents-section.component.html',
})
export class CrmDocumentsSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

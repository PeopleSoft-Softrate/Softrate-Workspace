import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';

@Component({
  selector: 'app-crm-payments-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-payments-section.component.html',
})
export class CrmPaymentsSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

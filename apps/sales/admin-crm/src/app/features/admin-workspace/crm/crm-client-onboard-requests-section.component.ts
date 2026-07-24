import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../admin-workspace.component';

@Component({
  selector: 'app-crm-client-onboard-requests-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-client-onboard-requests-section.component.html',
})
export class CrmClientOnboardRequestsSectionComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;

  // Track copied field states
  copiedField: string | null = null;
  hoveredField: string | null = null;

  async copyText(text: string | null | undefined): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copiedField = text;
      setTimeout(() => {
        if (this.copiedField === text) {
          this.copiedField = null;
        }
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  }
}

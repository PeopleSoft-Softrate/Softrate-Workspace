import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../../admin-workspace.component';

@Component({
  selector: 'app-admin-workspace-modals',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-workspace-modals.component.html'
})
export class AdminWorkspaceModalsComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

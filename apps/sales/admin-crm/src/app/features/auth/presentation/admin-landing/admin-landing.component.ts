import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../../../admin-workspace/admin-workspace.component';

@Component({
  selector: 'app-admin-landing',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-landing.component.html'
})
export class AdminLandingComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

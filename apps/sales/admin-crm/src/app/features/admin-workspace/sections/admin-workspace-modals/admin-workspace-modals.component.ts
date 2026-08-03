import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AdminWorkspaceComponent } from '../../admin-workspace.component';
import { CompanyTimelineComponent } from '../../../../shared/ui/company-timeline/company-timeline.component';
import { ActivitiesCalendarComponent } from '../../../../shared/ui/activities-calendar/activities-calendar.component';

@Component({
  selector: 'app-admin-workspace-modals',
  imports: [CommonModule, FormsModule, CompanyTimelineComponent, ActivitiesCalendarComponent],
  templateUrl: './admin-workspace-modals.component.html'
})
export class AdminWorkspaceModalsComponent {
  @Input({ required: true }) vm!: AdminWorkspaceComponent;
}

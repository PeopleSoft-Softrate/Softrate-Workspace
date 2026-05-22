import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';

@Component({
  selector: 'app-admin-organization-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-organization-section.component.html'
})
export class AdminOrganizationSectionComponent extends AdminWorkspaceSectionProxy {}

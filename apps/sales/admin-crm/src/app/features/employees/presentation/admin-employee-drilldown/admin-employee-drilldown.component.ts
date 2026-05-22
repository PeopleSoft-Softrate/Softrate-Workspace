import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';

@Component({
  selector: 'app-admin-employee-drilldown',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-employee-drilldown.component.html'
})
export class AdminEmployeeDrilldownComponent extends AdminWorkspaceSectionProxy {}

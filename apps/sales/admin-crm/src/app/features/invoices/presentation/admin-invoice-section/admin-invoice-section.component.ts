import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminWorkspaceSectionProxy } from '../../../admin-workspace/sections/admin-workspace-section-proxy';

@Component({
  selector: 'app-admin-invoice-section',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-invoice-section.component.html'
})
export class AdminInvoiceSectionComponent extends AdminWorkspaceSectionProxy {}

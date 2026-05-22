import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Home01Icon, FileDownloadIcon, NoteEditIcon, Calendar01Icon, Chat01Icon, LogoutIcon } from '@hugeicons/core-free-icons';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-intern-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent],
  template: `
  <aside class="action-sidebar">
    <!-- MANAGE LIST (Home) -->
    <button routerLink="/interns" [queryParams]="{tab: 'list'}" class="sidebar-action-item" [class.active]="activeTab === 'list'" title="Intern List">
      <div class="action-icon-circle">
        <hugeicons-icon [icon]="Home01Icon" size="20" [strokeWidth]="1.5" color="#475569"></hugeicons-icon>
      </div>
      <span class="action-label">Intern List</span>
    </button>

    <div class="sidebar-divider"></div>

    <!-- APPROVE LEAVE -->
    <button routerLink="/interns" [queryParams]="{tab: 'leaves'}" class="sidebar-action-item" [class.active]="activeTab === 'leaves'" title="Approve Leave">
      <div class="action-icon-circle">
        <hugeicons-icon [icon]="Calendar01Icon" size="20" [strokeWidth]="1.5" color="#10b981"></hugeicons-icon>
      </div>
      <span class="action-label">Approve Leave</span>
    </button>

    <div class="sidebar-divider"></div>

    <!-- PENDING REQUESTS -->
    <button routerLink="/interns" [queryParams]="{tab: 'requests'}" class="sidebar-action-item" [class.active]="activeTab === 'requests'" title="Pending Requests">
      <div class="action-icon-circle">
        <hugeicons-icon [icon]="Chat01Icon" size="20" [strokeWidth]="1.5" color="#f97316"></hugeicons-icon>
      </div>
      <span class="action-label">Pending Requests</span>
    </button>

    <div class="sidebar-divider"></div>

    <!-- ATTENDANCE CORRECTIONS -->
    <button routerLink="/interns" [queryParams]="{tab: 'corrections'}" class="sidebar-action-item" [class.active]="activeTab === 'corrections'" title="Attendance Corrections">
      <div class="action-icon-circle">
        <hugeicons-icon [icon]="NoteEditIcon" size="20" [strokeWidth]="1.5" color="#3b82f6"></hugeicons-icon>
      </div>
      <span class="action-label">Attendance Correction</span>
    </button>

    <div class="sidebar-divider"></div>

    <!-- OFFBOARDING -->
    <button routerLink="/interns" [queryParams]="{tab: 'offboarding'}" class="sidebar-action-item" [class.active]="activeTab === 'offboarding'" title="Offboarding">
      <div class="action-icon-circle">
        <hugeicons-icon [icon]="LogoutIcon" size="20" [strokeWidth]="1.5" color="#ef4444"></hugeicons-icon>
      </div>
      <span class="action-label">Offboarding</span>
    </button>

    <div class="sidebar-divider"></div>

    <!-- EXPORT DATA -->
    <button (click)="exportInternData()" class="sidebar-action-item" title="Export Data">
      <div class="action-icon-circle">
        <hugeicons-icon [icon]="FileDownloadIcon" size="20" [strokeWidth]="1.5" color="#8b5cf6"></hugeicons-icon>
      </div>
      <span class="action-label">Export Data</span>
    </button>
  </aside>
  `,
  styleUrls: ['../intern-list/intern-list.css']
})
export class InternSidebar {
  @Input() activeTab: string = '';
  private apiService = inject(ApiService);

  readonly Home01Icon = Home01Icon;
  readonly FileDownloadIcon = FileDownloadIcon;
  readonly NoteEditIcon = NoteEditIcon;
  readonly Calendar01Icon = Calendar01Icon;
  readonly Chat01Icon = Chat01Icon;
  readonly LogoutIcon = LogoutIcon;

  exportInternData() {
    const baseUrl = this.apiService.getBaseUrl();
    const userRole = localStorage.getItem('user_role');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const managerId = userRole === 'manager' ? (userData._id || userData.employeeId) : '';

    let url = `${baseUrl}/api/intern/export/excel?status=all&range=all`;
    if (managerId) {
      url += `&managerId=${managerId}`;
    }

    this.apiService.downloadFile(url).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = 'Intern_Data.xlsx';
        link.click();
      },
      error: (err) => console.error('Export failed', err)
    });
  }
}

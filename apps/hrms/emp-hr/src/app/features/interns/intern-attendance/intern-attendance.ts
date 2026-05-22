import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Home01Icon, FileDownloadIcon, Location01Icon } from '@hugeicons/core-free-icons';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InternSidebar } from '../intern-sidebar/intern-sidebar';

@Component({
  selector: 'app-intern-attendance',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent, InternSidebar],
  templateUrl: './intern-attendance.html',
  styleUrls: ['./intern-attendance.css', '../intern-list/intern-list.css']
})
export class InternAttendance implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly Location01Icon = Location01Icon;
  readonly FileDownloadIcon = FileDownloadIcon;

  exportAttendance() {
    const from = prompt('Enter start date (YYYY-MM-DD):', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const to = prompt('Enter end date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    
    if (!from || !to) return;

    const url = `${this.apiService.getBaseUrl()}/api/attendance/export/pdf/${this.internId()}?from=${from}&to=${to}`;
    
    this.apiService.downloadFile(url).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `Attendance_${this.internId()}.pdf`;
        link.click();
      },
      error: (err) => console.error('Export failed', err)
    });
  }

  openMap(locationStr: string) {
    if (locationStr) {
      window.open(`https://www.google.com/maps?q=${locationStr}`, '_blank');
    } else {
      alert('Location not available for this record');
    }
  }

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  internId = signal<string>('');
  attendance = signal<any[]>([]);
  isLoading = signal(true);

  ngOnInit() {
    this.internId.set(this.route.snapshot.paramMap.get('id') || '');
    this.fetchAttendance();
  }

  fetchAttendance() {
    console.log('Fetching attendance for internId:', this.internId());
    this.isLoading.set(true);
    this.apiService.getInternAttendance(this.internId()).subscribe({
      next: (data: any) => {
        console.log('Attendance data received:', data);
        this.attendance.set(data.attendance || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch attendance', err);
        this.isLoading.set(false);
      }
    });
  }

  getStatusColor(status: string): string {
    switch(status.toLowerCase()) {
      case 'present': return 'status-green';
      case 'absent': return 'status-red';
      case 'half-day': return 'status-orange';
      default: return 'status-gray';
    }
  }
}

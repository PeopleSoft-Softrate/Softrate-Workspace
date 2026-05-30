import { AlertService } from '../../../shared/services/alert';
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-attendance-corrections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-corrections.html',
  styleUrl: './attendance-corrections.css'
})
export class AttendanceCorrections implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  
  requests = signal<any[]>([]);
  isLoading = signal(true);
  reviewingId = signal<string | null>(null);
  remarks = '';

  ngOnInit() {
    this.fetchRequests();
  }

  fetchRequests() {
    this.isLoading.set(true);
    this.apiService.getHrPendingAttendanceRequests().subscribe({
      next: (data) => {
        this.requests.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch attendance requests', err);
        this.isLoading.set(false);
      }
    });
  }

  async approveRequest(requestId: string) {
    if (!await this.alertService.confirm('Are you sure you want to approve this correction? The attendance record will be updated.')) return;
    
    this.apiService.hrReviewAttendanceRequest(requestId, 'approved', this.remarks).subscribe({
      next: () => {
        this.requests.update(prev => prev.filter(r => r._id !== requestId));
        this.remarks = '';
        this.reviewingId.set(null);
        this.alertService.show('Attendance corrected successfully');
      },
      error: (err) => {
        console.error('Approval failed', err);
        this.alertService.show('Failed to approve request');
      }
    });
  }

  async rejectRequest(requestId: string) {
    if (!this.remarks.trim()) {
      this.alertService.show('Please provide remarks for rejection');
      return;
    }

    if (!await this.alertService.confirm('Are you sure you want to reject this correction?')) return;

    this.apiService.hrReviewAttendanceRequest(requestId, 'rejected', this.remarks).subscribe({
      next: () => {
        this.requests.update(prev => prev.filter(r => r._id !== requestId));
        this.remarks = '';
        this.reviewingId.set(null);
        this.alertService.show('Request rejected');
      },
      error: (err) => {
        console.error('Rejection failed', err);
        this.alertService.show('Failed to reject request');
      }
    });
  }

  formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  formatTime(iso: string) {
    if (!iso) return '--:--';
    const date = new Date(iso);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
}

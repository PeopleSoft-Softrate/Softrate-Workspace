import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-leave-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-management.html',
  styleUrl: './leave-management.css',
})
export class LeaveManagement implements OnInit {
  private apiService = inject(ApiService);
  
  pendingLeaves = signal<any[]>([]);
  isLoading = signal(true);
  rejectionReason = signal('');
  selectedLeaveId = signal<string | null>(null);

  ngOnInit() {
    this.fetchPendingLeaves();
  }

  fetchPendingLeaves() {
    this.isLoading.set(true);
    this.apiService.getHrPendingLeaves().subscribe({
      next: (data) => {
        this.pendingLeaves.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch pending leaves', err);
        this.isLoading.set(false);
      }
    });
  }

  approveLeave(id: string) {
    if (!confirm('Are you sure you want to approve this leave request?')) return;
    
    this.apiService.hrReviewLeave(id, 'approved', '').subscribe({
      next: () => {
        alert('Leave approved successfully');
        this.fetchPendingLeaves();
      },
      error: (err) => {
        console.error('Failed to approve leave', err);
        alert(err.error?.message || 'Failed to approve leave');
      }
    });
  }

  openRejectModal(id: string) {
    this.selectedLeaveId.set(id);
    this.rejectionReason.set('');
  }

  closeRejectModal() {
    this.selectedLeaveId.set(null);
  }

  rejectLeave() {
    const id = this.selectedLeaveId();
    const reason = this.rejectionReason();
    
    if (!id || !reason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    this.apiService.hrReviewLeave(id, 'rejected', reason).subscribe({
      next: () => {
        alert('Leave rejected');
        this.closeRejectModal();
        this.fetchPendingLeaves();
      },
      error: (err) => {
        console.error('Failed to reject leave', err);
        alert('Failed to reject leave');
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
}

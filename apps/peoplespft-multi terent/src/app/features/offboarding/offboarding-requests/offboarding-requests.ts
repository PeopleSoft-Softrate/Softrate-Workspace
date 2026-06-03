import { AlertService } from '../../../shared/services/alert';
import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-offboarding-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offboarding-requests.html',
  styleUrl: './offboarding-requests.css'
})
export class OffboardingRequests implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private http = inject(HttpClient);

  userRole = signal<string | null>(localStorage.getItem('user_role'));
  allRequests = signal<any[]>([]);
  isLoading = signal(true);
  
  isHrType(role: string | null): boolean {
    const r = role?.toLowerCase();
    return r === 'hr' || r === 'hr_admin';
  }

  activeTab = signal<'manager' | 'hr' | 'completed'>(this.isHrType(localStorage.getItem('user_role')) ? 'hr' : 'manager');

  // Review state
  showReviewModal = signal(false);
  selectedRequest = signal<any>(null);
  reviewRemarks = signal('');
  reviewAction = signal<'approved' | 'rejected' | 'accept' | 'reject' | null>(null);
  
  // Certificate flags for HR Accept
  certInternship = signal(false);
  certProject = signal(false);
  certLor = signal(false);
  
  onboardingDate = signal('');
  endDate = signal('');

  ngOnInit() {
    this.fetchRequests();
  }

  fetchRequests() {
    this.isLoading.set(true);
    this.apiService.getAllResignations().subscribe({
      next: (res) => {
        this.allRequests.set(res.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch all resignations', err);
        this.isLoading.set(false);
      }
    });
  }

  get filteredRequests() {
    const role = this.userRole();
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const myManagerId = userData._id;
    
    return this.allRequests().filter(r => {
      if (role === 'manager') {
        // Managers only see what's pending their approval AND assigned to them
        return r.status === 'pending_manager' && r.managerId === myManagerId;
      }
      if (this.isHrType(role)) {
        // HR sees everything except what's still with managers,
        // PLUS any unassigned (managerId is null) requests that go directly to HR.
        const isUnassigned = r.managerId === null || !r.managerId;
        return r.status === 'pending_hr' || r.status === 'accepted' || r.status === 'rejected' || (r.status === 'pending_manager' && isUnassigned);
      }
      return false;
    });
  }

  openReview(request: any, action: any) {
    this.selectedRequest.set(request);
    this.reviewAction.set(action);
    this.showReviewModal.set(true);
    this.reviewRemarks.set('');
    
    // Reset certificate flags
    this.certInternship.set(false);
    this.certProject.set(false);
    this.certLor.set(false);

    // Set dates
    const parsedLastDate = request.lastWorkingDay ? new Date(request.lastWorkingDay).toISOString().split('T')[0] : '';
    this.onboardingDate.set('');
    this.endDate.set(parsedLastDate);
  }

  submitReview() {
    const request = this.selectedRequest();
    const action = this.reviewAction();
    if (!request || !action) return;

    this.isLoading.set(true);

    if (this.userRole() === 'manager') {
      this.apiService.managerReviewOffboarding(request._id, action as 'approved' | 'rejected', this.reviewRemarks())
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: () => {
            this.closeModal();
            this.fetchRequests();
            this.alertService.show(`Resignation ${action} successfully`);
          },
          error: (err) => this.alertService.show('Failed to process review: ' + err.message)
        });
    } else if (this.isHrType(this.userRole())) {
      const flags = {
        internship: this.certInternship(),
        project: this.certProject(),
        lor: this.certLor(),
        onboardingDate: this.onboardingDate(),
        endDate: this.endDate()
      };

      this.apiService.hrReviewOffboarding(request._id, action as 'accept' | 'reject', this.reviewRemarks(), flags)
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: () => {
            this.closeModal();
            this.fetchRequests();
            this.alertService.show(`Resignation ${action}ed successfully`);
          },
          error: (err) => this.alertService.show('Failed to process review: ' + err.message)
        });
    }
  }

  closeModal() {
    this.showReviewModal.set(false);
    this.selectedRequest.set(null);
    this.reviewAction.set(null);
  }

  getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  formatDate(date: string) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

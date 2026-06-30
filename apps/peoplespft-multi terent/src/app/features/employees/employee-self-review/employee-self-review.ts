import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { LicenseDraftIcon, UserCircleIcon } from '@hugeicons/core-free-icons';

import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../shared/services/alert';

@Component({
  selector: 'app-employee-self-review',
  standalone: true,
  imports: [CommonModule, FormsModule, HugeiconsIconComponent, RouterModule],
  templateUrl: './employee-self-review.html',
  styleUrl: './employee-self-review.css'
})
export class EmployeeSelfReview implements OnInit {
  private apiService = inject(ApiService);
  private alertService = inject(AlertService);
  private router = inject(Router);

  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly UserCircleIcon = UserCircleIcon;

  employeeId = signal<string>('');
  employeeName = signal<string>('');
  
  isLoading = signal(true);
  isSubmitting = signal(false);

  // Existing Review
  submittedReview = signal<any>(null);
  
  // Templates
  dynamicTemplates = signal<any[]>([]);
  selectedTeam = signal<string>('');
  teamGoals = signal<any[]>([]);

  ngOnInit() {
    const dataStr = localStorage.getItem('user_data');
    if (dataStr) {
      const data = JSON.parse(dataStr);
      this.employeeId.set(data.EmployeeId || '');
      this.employeeName.set(data.fullName || data.name || 'Employee');
    } else {
      this.router.navigate(['/login']);
      return;
    }

    this.fetchData();
  }

  fetchData() {
    this.isLoading.set(true);
    // 1. Fetch current month review to see if already submitted
    this.apiService.getEmployeeSelfReview(this.employeeId()).subscribe({
      next: (res: any) => {
        if (res && res.success && res.data) {
          this.submittedReview.set(res.data);
          this.isLoading.set(false);
        } else {
          this.fetchTemplates();
        }
      },
      error: () => {
        // Not found or error -> meaning we haven't submitted yet
        this.fetchTemplates();
      }
    });
  }

  fetchTemplates() {
    this.apiService.getPerformanceTemplates().subscribe({
      next: (data: any[]) => {
        this.dynamicTemplates.set(data || []);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch templates', err);
        this.isLoading.set(false);
      }
    });
  }

  onTeamChanged(category: string) {
    this.selectedTeam.set(category);
    const template = this.dynamicTemplates().find(t => t.category === category);
    if (template && template.goals) {
      // Map to add empty comment field
      const goals = template.goals.map((g: any) => ({
        ...g,
        comment: ''
      }));
      this.teamGoals.set(goals);
    } else {
      this.teamGoals.set([]);
    }
  }

  submitReview() {
    if (!this.selectedTeam()) {
      this.alertService.show('Please select a team/category');
      return;
    }

    const payload = {
      employeeId: this.employeeId(),
      employeeName: this.employeeName(),
      team: this.selectedTeam(),
      goals: this.teamGoals()
    };

    this.isSubmitting.set(true);
    this.apiService.submitEmployeeSelfReview(payload).subscribe({
      next: (res: any) => {
        this.alertService.show('Self Review submitted successfully!');
        this.isSubmitting.set(false);
        this.submittedReview.set(res.data);
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        this.alertService.show(err.error?.message || 'Failed to submit review');
      }
    });
  }

  getRatingColor(rating: number): string {
    if (rating >= 4.5) return 'status-green';
    if (rating >= 3.5) return 'status-teal';
    if (rating >= 2.5) return 'status-orange';
    return 'status-red';
  }
}

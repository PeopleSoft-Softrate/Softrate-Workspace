import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-intern-add',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './intern-add.html',
  styleUrl: './intern-add.css'
})
export class InternAdd implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  
  isSaving = signal(false);
  submitted = signal(false);
  isApprovalMode = signal(false);
  isEditMode = signal(false);
  requestId = '';
  
  intern = {
    _id: '',
    fullName: '',
    email: '',
    contact: '',
    college: '',
    department: '',
    role: '',
    onboardingDate: '',
    endDate: '',
    durationValue: 3,
    durationType: 'month' as 'day' | 'month',
    internshipType: 'Stipend',
    applicationType: 'Internship'
  };

  internRoles = signal<string[]>([]);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const isEdit = this.route.snapshot.queryParamMap.get('edit') === 'true';

    if (id) {
      if (isEdit) {
        this.isEditMode.set(true);
      } else {
        this.isApprovalMode.set(true);
      }
      this.requestId = id;
      this.fetchRequestData(id);
    }
    this.fetchSettings();
  }

  fetchSettings() {
    this.apiService.getCompanySettings().subscribe({
      next: (res: any) => {
        if (res.success && res.settings) {
          this.internRoles.set(res.settings.internRoles || []);
        }
      },
      error: (err) => console.error('Failed to fetch settings', err)
    });
  }

  fetchRequestData(id: string) {
    this.apiService.getInternById(id).subscribe({
      next: (data) => {
        console.log('Fetched applicant data:', data);
        // Explicitly map fields to ensure reactivity
        this.intern.fullName = data.fullName || '';
        this.intern.email = data.email || '';
        this.intern.contact = data.contact || '';
        this.intern.college = data.college || '';
        this.intern.department = data.department || '';
        this.intern.role = data.role || '';
        this.intern.applicationType = data.applicationType || 'Internship';
        this.intern._id = data._id;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch request data', err);
        alert('Failed to load application data');
      }
    });
  }

  calculateEndDate() {
    if (!this.intern.onboardingDate || !this.intern.durationValue) return;

    const start = new Date(this.intern.onboardingDate);
    const end = new Date(start);

    if (this.intern.durationType === 'day') {
      end.setDate(start.getDate() + this.intern.durationValue);
    } else {
      end.setMonth(start.getMonth() + this.intern.durationValue);
    }

    this.intern.endDate = end.toISOString().split('T')[0];
  }

  saveIntern() {
    this.submitted.set(true);
    
    if (!this.intern.fullName || !this.intern.email || !this.intern.onboardingDate) {
      return;
    }

    this.isSaving.set(true);
    
    if (this.isEditMode()) {
      this.apiService.updateIntern(this.requestId, this.intern).subscribe({
        next: () => {
          alert('Intern profile updated successfully!');
          this.router.navigate(['/interns', this.requestId]);
        },
        error: (err: any) => {
          console.error('Failed to update intern', err);
          alert('Failed to update: ' + (err.error?.message || err.message));
          this.isSaving.set(false);
        }
      });
    } else if (this.isApprovalMode()) {
      // Approval logic
      this.apiService.acceptIntern(this.requestId, this.intern).subscribe({
        next: () => {
          alert('Intern approved and onboarding started!');
          this.router.navigate(['/interns/requests']);
        },
        error: (err) => {
          console.error('Failed to approve intern', err);
          alert('Failed to approve intern: ' + (err.error?.message || err.message));
          this.isSaving.set(false);
        }
      });
    } else {
      // Manual registration (legacy support)
      this.apiService.addIntern(this.intern).subscribe({
        next: () => {
          alert('Intern added successfully');
          this.router.navigate(['/interns']);
        },
        error: (err: any) => {
          console.error('Failed to add intern', err);
          alert('Failed to add intern: ' + (err.error?.message || err.message));
          this.isSaving.set(false);
        }
      });
    }
  }
}

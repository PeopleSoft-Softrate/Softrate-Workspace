import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-mobile-offboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mobile-offboarding.html',
  styleUrl: './mobile-offboarding.css'
})
export class MobileOffboardingComponent implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);

  // User details
  user = signal<any>(null);
  isLoading = signal(true);
  isSubmitting = signal(false);

  // Form Fields
  lastWorkingDay = signal('');
  exitType = 'Offboarding';
  exitReason = signal<string>('');
  assetReturn = signal<string>('');
  otherReasonText = signal('');

  // Dropdown Lists
  exitReasons = [
    'End of Internship',
    'Other'
  ];

  assetStatus = [
    'All Returned',
    'Pending',
    'Not Applicable'
  ];

  // Project Links
  projectLinks = signal<string[]>(['']);

  ngOnInit() {
    // Set default last working day to today's date formatted as YYYY-MM-DD
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.lastWorkingDay.set(`${year}-${month}-${day}`);

    this.fetchProfile();
  }

  fetchProfile() {
    this.apiService.getMe().subscribe({
      next: (res: any) => {
        if (res.success && res.user) {
          this.user.set(res.user);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch profile:', err);
        this.isLoading.set(false);
      }
    });
  }

  get displayId(): string {
    const u = this.user();
    if (!u) return '-';
    return u.internid || u.employeeId || '-';
  }

  get displayDepartment(): string {
    const u = this.user();
    if (!u) return '-';
    return u.department || u.departmentId?.name || '-';
  }

  get role(): string {
    const u = this.user();
    if (!u) return 'employee';
    return u.role || (u.internid ? 'intern' : 'employee');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  goBack() {
    this.router.navigate(['/profile']);
  }

  addProjectLink() {
    if (this.projectLinks().length < 5) {
      this.projectLinks.update(links => [...links, '']);
    }
  }

  removeProjectLink(index: number) {
    this.projectLinks.update(links => links.filter((_, i) => i !== index));
  }

  updateProjectLink(index: number, event: any) {
    const val = event.target.value;
    this.projectLinks.update(links => {
      const updated = [...links];
      updated[index] = val;
      return updated;
    });
  }

  submitForm() {
    if (!this.exitReason() || !this.assetReturn()) {
      alert('Please complete all required fields');
      return;
    }

    if (this.exitReason() === 'Other' && !this.otherReasonText().trim()) {
      alert("Please specify the reason for 'Other'");
      return;
    }

    const u = this.user();
    if (!u) return;

    this.isSubmitting.set(true);

    const userId = u.internid || u.employeeId || u._id;

    // Check if resignation already exists
    this.apiService.getResignationByUserId(userId).subscribe({
      next: (checkRes: any) => {
        if (checkRes && checkRes.success && checkRes.resignation) {
          alert('Offboarding already submitted');
          this.isSubmitting.set(false);
          return;
        }
        this.executeSubmission();
      },
      error: () => {
        // If 404 or other error, proceed to submit
        this.executeSubmission();
      }
    });
  }

  private executeSubmission() {
    const u = this.user();
    const userId = u.internid || u.employeeId || u._id;
    const departmentName = u.department || u.departmentId?.name || '-';

    // Format lastWorkingDay to dd MMM yyyy for backend presentation if needed
    // or pass the raw date. The flutter app does dd MMM yyyy: "28 Jul 2026"
    const dateObj = new Date(this.lastWorkingDay());
    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const activeLinks = this.projectLinks()
      .map(link => link.trim())
      .filter(link => link !== '');

    const payload = {
      fullName: u.fullName,
      userId: userId,
      userType: this.role === 'intern' ? 'intern' : 'employee',
      department: departmentName,
      lastWorkingDay: formattedDate,
      exitType: this.exitType,
      exitReason: this.exitReason() === 'Other' ? this.otherReasonText() : this.exitReason(),
      assetReturnStatus: this.assetReturn(),
      projectLinks: activeLinks
    };

    this.apiService.submitResignation(payload).subscribe({
      next: (res: any) => {
        this.isSubmitting.set(false);
        if (res && res.success) {
          alert('Exit form submitted successfully!');
          this.router.navigate(['/profile']);
        } else {
          alert(res.message || 'Submission failed');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        alert(err.error?.message || 'Submission failed');
      }
    });
  }
}

import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AlertService } from '../../../shared/services/alert';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { CalendarCheckOut01Icon, Upload02Icon, LicenseDraftIcon } from '@hugeicons/core-free-icons';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InternSidebar } from '../intern-sidebar/intern-sidebar';

@Component({
  selector: 'app-intern-leaves',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, InternSidebar, HugeiconsIconComponent],
  templateUrl: './intern-leaves.html',
  styleUrls: ['../intern-list/intern-list.css', './intern-leaves.css']
})
export class InternLeaves implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  goBack() {
    this.location.back();
  }

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  internId = signal<string>('');
  internName = signal<string>('');
  leaves = signal<any[]>([]);
  balances = signal<any[]>([]);
  isLoading = signal(true);
  submitLoading = signal(false);

  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly Upload02Icon = Upload02Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;

  leaveForm = {
    leaveType: '',
    fromDate: '',
    toDate: '',
    reason: ''
  };
  selectedFile: File | null = null;

  private alertService = inject(AlertService);

  isSelfPortal(): boolean {
    return this.router.url.includes('/intern/leaves');
  }

  ngOnInit() {
    let id = this.route.snapshot.paramMap.get('id');
    let name = '';
    if (!id) {
      const data = localStorage.getItem('user_data');
      if (data) {
        const parsedData = JSON.parse(data);
        id = parsedData.internid || parsedData._id;
        name = parsedData.name || '';
      }
    }
    this.internId.set(id || '');
    this.internName.set(name);
    this.fetchLeaves();
    this.fetchBalance();
  }

  fetchLeaves() {
    this.isLoading.set(true);
    this.apiService.getInternLeaves(this.internId()).subscribe({
      next: (data: any) => {
        this.leaves.set(Array.isArray(data) ? data : (data.leaves || []));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch leaves', err);
        this.isLoading.set(false);
      }
    });
  }

  fetchBalance() {
    // We reuse the employee leave balance API since interns are in the same collection structure
    this.apiService.getEmployeeLeaveBalance(this.internId()).subscribe({
      next: (data: any) => {
        this.balances.set(Array.isArray(data) ? data : (data.balances || []));
      },
      error: (err) => console.error('Failed to fetch balances', err)
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.alertService.show('File is too large (max 5MB)', 'error');
        return;
      }
      this.selectedFile = file;
    }
  }

  onSubmitLeave() {
    if (!this.leaveForm.leaveType || !this.leaveForm.fromDate || !this.leaveForm.toDate || !this.leaveForm.reason) {
      this.alertService.show('Please fill in all required fields');
      return;
    }

    const start = new Date(this.leaveForm.fromDate);
    const end = new Date(this.leaveForm.toDate);
    if (end < start) {
      this.alertService.show('End date cannot be before start date');
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    this.submitLoading.set(true);

    const formData = new FormData();
    formData.append('employeeId', this.internId());
    formData.append('employeeName', this.internName());
    formData.append('leaveType', this.leaveForm.leaveType);
    formData.append('fromDate', this.leaveForm.fromDate);
    formData.append('toDate', this.leaveForm.toDate);
    formData.append('numberOfDays', days.toString());
    formData.append('reason', this.leaveForm.reason);

    if (this.selectedFile) {
      formData.append('document', this.selectedFile);
    }

    this.apiService.applyLeave(formData).subscribe({
      next: (res) => {
        this.alertService.show('Leave application submitted successfully!');
        this.fetchLeaves();
        this.fetchBalance();
        this.resetForm();
        this.submitLoading.set(false);
      },
      error: (err) => {
        this.alertService.show(err.error?.message || 'Failed to submit leave application');
        this.submitLoading.set(false);
      }
    });
  }

  resetForm() {
    this.leaveForm = {
      leaveType: '',
      fromDate: '',
      toDate: '',
      reason: ''
    };
    this.selectedFile = null;
    const fileInput = document.getElementById('document-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  getStatusColor(hrStatus: string, managerStatus: string): string {
    const hr = hrStatus?.toLowerCase();
    const mgr = managerStatus?.toLowerCase();

    if (hr === 'accepted') return 'status-green';
    if (hr === 'rejected' || mgr === 'rejected') return 'status-red';
    return 'status-orange';
  }

  getStatusLabel(hrStatus: string, managerStatus: string): string {
    const hr = hrStatus?.toLowerCase();
    const mgr = managerStatus?.toLowerCase();

    if (hr === 'accepted') return 'Approved';
    if (hr === 'rejected') return 'Rejected by HR';
    if (mgr === 'rejected') return 'Rejected by Manager';
    if (mgr === 'accepted') return 'Awaiting HR';
    return 'Awaiting Manager';
  }
}

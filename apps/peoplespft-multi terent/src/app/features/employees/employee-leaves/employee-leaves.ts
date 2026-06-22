import { AlertService } from '../../../shared/services/alert';
import { Component, signal, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { CalendarCheckOut01Icon, UserCircleIcon, FingerAccessIcon, LicenseDraftIcon, Money03Icon, FileDownloadIcon, Upload02Icon } from '@hugeicons/core-free-icons';
import { ApiService } from '../../../services/api.service';
import { EmployeeSidebar } from '../employee-sidebar/employee-sidebar';

@Component({
  selector: 'app-employee-leaves',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HugeiconsIconComponent, EmployeeSidebar],
  templateUrl: './employee-leaves.html',
  styleUrls: ['./employee-leaves.css', '../employee-list/employee-list.css']
})
export class EmployeeLeaves implements OnInit, OnDestroy {
  private alertService = inject(AlertService);
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  goBack() {
    this.location.back();
  }

  ngOnDestroy() {
    // Component cleanup
  }

  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly UserCircleIcon = UserCircleIcon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly Money03Icon = Money03Icon;
  readonly FileDownloadIcon = FileDownloadIcon;
  readonly Upload02Icon = Upload02Icon;

  employeeId = signal<string>('');
  employeeName = signal<string>('');
  isIntern = signal<boolean>(false);
  isSelfPortal = signal<boolean>(true);
  isLoading = signal(true);
  submitLoading = signal(false);

  leaves = signal<any[]>([]);
  balances = signal<any[]>([]);

  leaveForm = {
    leaveType: '',
    fromDate: '',
    toDate: '',
    reason: ''
  };

  selectedFile: File | null = null;

  ngOnInit() {
    const isSelf = this.router.url.includes('/employee/leaves');
    this.isSelfPortal.set(isSelf);

    let id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.employeeId.set(id);
      this.fetchLeaves();
      this.fetchBalance();
    } else {
      const dataStr = localStorage.getItem('user_data');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        this.employeeId.set(data.EmployeeId || data.internid || '');
        this.employeeName.set(data.fullName || data.name || 'Employee');
        this.isIntern.set(!!data.internid);
        this.fetchLeaves();
        this.fetchBalance();
      } else {
        this.router.navigate(['/login']);
      }
    }
  }

  fetchLeaves() {
    this.isLoading.set(true);
    this.apiService.getEmployeeLeaves(this.employeeId()).subscribe({
      next: (data: any) => {
        this.leaves.set(data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch leaves', err);
        this.isLoading.set(false);
      }
    });
  }

  fetchBalance() {
    if (this.isIntern()) {
      // Intern balance is fixed at 2 days per month
      this.balances.set([
        { leaveType: 'Monthly Allowance', totalAllowed: 2, used: 0, balance: 2 }
      ]);
      return;
    }

    this.apiService.getEmployeeLeaveBalance(this.employeeId()).subscribe({
      next: (res: any) => {
        if (res?.success && Array.isArray(res.data)) {
          this.balances.set(res.data);
        } else {
          this.balances.set([]);
        }
      },
      error: (err) => {
        console.error('Failed to fetch leave balance', err);
      }
    });
  }

  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.selectedFile = event.target.files[0];
    }
  }

  onSubmitLeave() {
    if (!this.leaveForm.fromDate || !this.leaveForm.toDate || !this.leaveForm.leaveType || !this.leaveForm.reason) {
      this.alertService.show('Please fill all required fields');
      return;
    }

    const fromDateObj = new Date(this.leaveForm.fromDate);
    const toDateObj = new Date(this.leaveForm.toDate);
    const timeDiff = toDateObj.getTime() - fromDateObj.getTime();
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    if (days <= 0) {
      this.alertService.show('End date must be after or equal to Start date');
      return;
    }

    this.submitLoading.set(true);

    const formData = new FormData();
    formData.append('employeeId', this.employeeId());
    formData.append('employeeName', this.employeeName());
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

  getStatusColor(status: string): string {
    switch(status?.toLowerCase()) {
      case 'accepted':
      case 'approved': return 'status-green';
      case 'rejected': return 'status-red';
      case 'pending': return 'status-orange';
      default: return 'status-gray';
    }
  }
}

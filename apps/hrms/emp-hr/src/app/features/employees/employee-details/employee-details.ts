import { AlertService } from '../../../shared/services/alert';
import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UserCircleIcon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, Money03Icon, Share05Icon } from '@hugeicons/core-free-icons';
import { EmployeeSidebar } from '../employee-sidebar/employee-sidebar';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-employee-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HugeiconsIconComponent, EmployeeSidebar],
  templateUrl: './employee-details.html',
  styleUrl: './employee-details.css',
})
export class EmployeeDetails implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly UserCircleIcon = UserCircleIcon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly Money03Icon = Money03Icon;
  readonly Share05Icon = Share05Icon;

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  
  employeeId = signal<string>('');
  employee = signal<any>(null);
  isLoading = signal(true);
  isPromoting = signal(false);
  isTerminating = signal(false);
  showTerminateForm = signal(false);
  terminationReason = signal('');
  userRole = signal<string | null>(localStorage.getItem('user_role'));

  ngOnInit() {
    this.employeeId.set(this.route.snapshot.paramMap.get('id') || '');
    this.fetchDetails();
  }

  fetchDetails() {
    this.isLoading.set(true);
    this.apiService.getEmployeeById(this.employeeId()).subscribe({
      next: (data) => {
        console.log('Employee details received:', data);
        this.employee.set(data);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch employee details', err);
        this.isLoading.set(false);
      }
    });
  }

  getStatusColor(status: string): string {
    switch(status?.toLowerCase()) {
      case 'active': return 'status-green';
      case 'on leave': return 'status-orange';
      case 'terminated': return 'status-red';
      default: return 'status-gray';
    }
  }

  canPromoteToManager(): boolean {
    const role = this.userRole()?.toLowerCase();
    const isManager = this.employee()?.isManager;
    const isHr = this.employee()?.isHr;
    // HR and HR_ADMIN can promote to Manager, but they cannot already be Manager or HR
    return (role === 'hr' || role === 'hr_admin') && !isManager && !isHr;
  }

  canConvertToHr(): boolean {
    const role = this.userRole()?.toLowerCase();
    const isHr = this.employee()?.isHr;
    const isManager = this.employee()?.isManager;
    // Only HR_ADMIN can convert others to HR, and they must not already be HR or Manager
    // (If they are Manager, they use a different conversion path or this one unsets Manager)
    return role === 'hr_admin' && !isHr && !isManager;
  }

  canDemoteToManager(): boolean {
    const role = this.userRole()?.toLowerCase();
    const isHr = this.employee()?.isHr;
    // Only HR_ADMIN can demote HR back to Manager
    return role === 'hr_admin' && isHr === true;
  }

  canDemoteToEmployee(): boolean {
    const role = this.userRole()?.toLowerCase();
    const isManager = this.employee()?.isManager;
    const isHr = this.employee()?.isHr;
    // HR and HR_ADMIN can demote Manager to Employee (if they are not also HR)
    return (role === 'hr' || role === 'hr_admin') && isManager === true && !isHr;
  }

  async promoteToManager() {
    if (!await this.alertService.confirm('Promote this employee to Manager?')) return;
    this.isPromoting.set(true);
    this.apiService.promoteToManager(this.employeeId()).subscribe({
      next: () => {
        this.alertService.show('Employee promoted to Manager successfully!');
        this.fetchDetails();
        this.isPromoting.set(false);
      },
      error: (err: any) => {
        this.alertService.show('Promotion failed: ' + (err.error?.message || err.message));
        this.isPromoting.set(false);
      }
    });
  }

  async convertToHr() {
    if (!await this.alertService.confirm('Convert this staff member to HR? They will gain admin dashboard access.')) return;
    this.isPromoting.set(true);
    this.apiService.convertToHr(this.employeeId()).subscribe({
      next: () => {
        this.alertService.show('Staff converted to HR successfully!');
        this.fetchDetails();
        this.isPromoting.set(false);
      },
      error: (err: any) => {
        this.alertService.show('Conversion failed: ' + (err.error?.message || err.message));
        this.isPromoting.set(false);
      }
    });
  }

  async demoteToManager() {
    if (!await this.alertService.confirm('Demote this HR staff member back to Manager? Their admin privileges will be revoked.')) return;
    this.isPromoting.set(true);
    this.apiService.demoteToManager(this.employeeId()).subscribe({
      next: () => {
        this.alertService.show('HR staff demoted to Manager successfully!');
        this.fetchDetails();
        this.isPromoting.set(false);
      },
      error: (err: any) => {
        this.alertService.show('Demotion failed: ' + (err.error?.message || err.message));
        this.isPromoting.set(false);
      }
    });
  }

  async demoteToEmployee() {
    if (!await this.alertService.confirm('Demote this Manager back to Employee status?')) return;
    this.isPromoting.set(true);
    this.apiService.demoteManagerToEmployee(this.employeeId()).subscribe({
      next: () => {
        this.alertService.show('Manager demoted to Employee successfully!');
        this.fetchDetails();
        this.isPromoting.set(false);
      },
      error: (err: any) => {
        this.alertService.show('Demotion failed: ' + (err.error?.message || err.message));
        this.isPromoting.set(false);
      }
    });
  }

  editProfile() {
    this.router.navigate(['/employees/add', this.employeeId()], { queryParams: { edit: 'true' } });
  }

  canTerminate(): boolean {
    const role = this.userRole()?.toLowerCase();
    const isHr = this.employee()?.isHr;
    if (isHr) {
      return role === 'hr_admin';
    }
    return role === 'hr' || role === 'hr_admin';
  }

  toggleTerminateForm() {
    this.showTerminateForm.set(!this.showTerminateForm());
    if (!this.showTerminateForm()) {
      this.terminationReason.set('');
    }
  }

  async terminateEmployee() {
    if (!this.terminationReason().trim()) {
      this.alertService.show("Please provide a reason for termination.");
      return;
    }
    
    if (!await this.alertService.confirm('Are you sure you want to terminate this staff member? This action will disable their login access.')) return;

    this.isTerminating.set(true);
    this.apiService.terminateStaff(this.employeeId(), 'employee', this.terminationReason()).subscribe({
      next: () => {
        this.alertService.show('Staff member terminated successfully!');
        this.fetchDetails();
        this.isTerminating.set(false);
        this.showTerminateForm.set(false);
      },
      error: (err: any) => {
        this.alertService.show('Termination failed: ' + (err.error?.message || err.message));
        this.isTerminating.set(false);
      }
    });
  }
}

import { Component, Input, Output, EventEmitter, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { 
  UserAccountIcon, 
  Settings01Icon, 
  Logout02Icon, 
  ArrowRight01Icon, 
  Shield02Icon, 
  DiplomaIcon,
  Calendar01Icon,
  Briefcase02Icon,
  SchoolIcon,
  CallIcon,
  Cancel01Icon,
  WorkflowSquare03Icon
} from '@hugeicons/core-free-icons';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mobile-profile',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent, FormsModule, RouterModule],
  templateUrl: './mobile-profile.html',
  styleUrl: './mobile-profile.css'
})
export class MobileProfileComponent {
  @Input() user: any = null;
  @Input() role: string = '';
  @Input() profilePhoto: string | null = null;
  @Input() initials: string = 'U';
  
  @Output() logoutEvent = new EventEmitter<void>();

  private router = inject(Router);
  private apiService = inject(ApiService);

  // Modal State
  showOffboardModal = signal(false);
  offboardReason = signal('');
  offboardDate = signal('');
  offboardLoading = signal(false);

  // icons
  UserAccountIcon = UserAccountIcon;
  Settings01Icon = Settings01Icon;
  Logout02Icon = Logout02Icon;
  ArrowRight01Icon = ArrowRight01Icon;
  Shield02Icon = Shield02Icon;
  DiplomaIcon = DiplomaIcon;
  Calendar01Icon = Calendar01Icon;
  Briefcase02Icon = Briefcase02Icon;
  SchoolIcon = SchoolIcon;
  CallIcon = CallIcon;
  Cancel01Icon = Cancel01Icon;
  WorkflowSquare03Icon = WorkflowSquare03Icon;

  confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
      this.logoutEvent.emit();
    }
  }

  goBack() {
    if (this.role?.toLowerCase()?.includes('intern')) {
      this.router.navigate(['/intern/dashboard']);
    } else {
      this.router.navigate(['/employee/dashboard']);
    }
  }

  // Getters & formatters
  get displayRoleName(): string {
    if (this.role === 'hr' || this.role === 'hr_admin' || this.role === 'admin') return 'HR Manager';
    if (this.role === 'manager') return 'Manager';
    if (this.role === 'intern') return 'Intern';
    if (this.role === 'employee') return 'Employee';
    return this.user?.designation || this.user?.role || 'Employee';
  }

  get displayId(): string {
    return this.user?.internid || this.user?.EmployeeId || this.user?.employeeId || '-';
  }

  get displayDepartment(): string {
    return this.user?.department || this.user?.departmentId?.name || '-';
  }

  formatDate(dateInput: any): string {
    if (!dateInput) return '-';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '-';
    }
  }

  openOffboardDialog() {
    this.showOffboardModal.set(true);
  }

  closeOffboardDialog() {
    this.showOffboardModal.set(false);
    this.offboardReason.set('');
    this.offboardDate.set('');
  }

  submitOffboarding() {
    if (!this.offboardReason() || !this.offboardDate()) return;
    this.offboardLoading.set(true);
    
    this.apiService.submitResignation({
      reason: this.offboardReason(),
      lastWorkingDay: this.offboardDate()
    }).subscribe({
      next: () => {
        this.offboardLoading.set(false);
        this.closeOffboardDialog();
        alert('Offboarding request submitted successfully!');
      },
      error: (err) => {
        this.offboardLoading.set(false);
        alert(err.error?.message || 'Failed to submit offboarding request');
      }
    });
  }

  openLinkedIn(url: string) {
    if (!url) return;
    let target = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      target = 'https://' + url;
    }
    window.open(target, '_blank');
  }
}

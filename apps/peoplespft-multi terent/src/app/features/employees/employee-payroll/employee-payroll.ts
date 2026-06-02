import { AlertService } from '../../../shared/services/alert';
import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UserCircleIcon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, Money03Icon, Download02Icon } from '@hugeicons/core-free-icons';
import { EmployeeSidebar } from '../employee-sidebar/employee-sidebar';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-employee-payroll',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent, RouterModule, EmployeeSidebar],
  templateUrl: './employee-payroll.html',
  styleUrl: './employee-payroll.css'
})
export class EmployeePayroll implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly UserCircleIcon = UserCircleIcon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly Money03Icon = Money03Icon;
  readonly Download02Icon = Download02Icon;

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
  isSelfPortal = signal<boolean>(false);
  
  // Mock payroll data
  payrollStats = {
    grossSalary: '₹ 45,000',
    netSalary: '₹ 41,200',
    deductions: '₹ 3,800',
    tax: '₹ 1,200'
  };

  salaryHistory = [
    { month: 'March 2024', status: 'Paid', amount: '₹ 41,200', date: '01 Mar 2024' },
    { month: 'February 2024', status: 'Paid', amount: '₹ 41,200', date: '01 Feb 2024' },
    { month: 'January 2024', status: 'Paid', amount: '₹ 41,200', date: '01 Jan 2024' }
  ];

  ngOnInit() {
    const isSelf = this.router.url.includes('/employee/payroll');
    this.isSelfPortal.set(isSelf);

    let id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      const data = localStorage.getItem('user_data');
      if (data) {
        const parsedData = JSON.parse(data);
        id = parsedData.EmployeeId || parsedData.internid || '';
      }
    }
    this.employeeId.set(id || '');
    this.fetchEmployee();
  }

  fetchEmployee() {
    this.isLoading.set(true);
    this.apiService.getEmployeeById(this.employeeId()).subscribe({
      next: (data) => {
        this.employee.set(data);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch employee', err);
        this.isLoading.set(false);
      }
    });
  }

  downloadPayslip(month: string) {
    this.alertService.show(`Downloading payslip for ${month}...`);
  }
}

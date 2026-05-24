import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UserCircleIcon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, Money03Icon, Download02Icon } from '@hugeicons/core-free-icons';
import { EmployeeSidebar } from '../employee-sidebar/employee-sidebar';
import { ApiService } from '../../../services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

type PayrollType = 'employee' | 'intern';

interface PayrollBreakdown {
  basicSalary: number;
  hra: number;
  baseAllowances: number;
  allowances: number;
  approvedFundAmount: number;
  fixedDeductions: number;
  pf: number;
  professionalTax: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
}

@Component({
  selector: 'app-employee-payroll',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent, RouterModule, EmployeeSidebar],
  templateUrl: './employee-payroll.html',
  styleUrl: './employee-payroll.css'
})
export class EmployeePayroll implements OnInit {
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
  errorMessage = signal<string>('');
  payrollSettings = signal<any>(null);
  fundRequests = signal<any[]>([]);
  payrollMonth = signal<string>(this.currentMonthKey());
  
  payrollType = computed<PayrollType>(() => {
    const userRole = String(localStorage.getItem('user_role') || '').toLowerCase();
    const employmentType = String(this.employee()?.employment?.type || '').toLowerCase();
    return userRole === 'intern' || employmentType === 'intern' ? 'intern' : 'employee';
  });

  payroll = computed<PayrollBreakdown>(() => this.buildPayrollBreakdown());

  payrollStats = computed(() => {
    const payroll = this.payroll();
    return {
      grossSalary: this.formatCurrency(payroll.grossSalary),
      netSalary: this.formatCurrency(payroll.netSalary),
      deductions: this.formatCurrency(payroll.totalDeductions),
      tax: this.formatCurrency(payroll.professionalTax)
    };
  });

  salaryHistory = computed(() => {
    const selectedMonth = this.dateFromMonthKey(this.payrollMonth());
    return [{
      month: selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      status: 'Available',
      amount: this.formatCurrency(this.payroll().netSalary),
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    }];
  });

  ngOnInit() {
    const isSelf = this.router.url.includes('/employee/payroll');
    this.isSelfPortal.set(isSelf);

    let id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      const data = localStorage.getItem('user_data');
      if (data) {
        const parsedData = JSON.parse(data);
        id = parsedData.EmployeeId || parsedData.employeeId || parsedData._id || '';
      }
    }
    this.employeeId.set(id || '');
    this.fetchEmployee();
  }

  fetchEmployee() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    forkJoin({
      employee: this.apiService.getEmployeeById(this.employeeId()),
      settings: this.apiService.getCompanySettings().pipe(catchError(() => of(null))),
      funds: this.apiService.getUserFundRequests(this.employeeId()).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ employee, settings, funds }) => {
        this.employee.set(employee);
        this.payrollSettings.set(settings?.settings?.payrollSettings || null);
        this.fundRequests.set(funds || []);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch employee', err);
        this.errorMessage.set('Unable to load payroll details for this employee.');
        this.isLoading.set(false);
      }
    });
  }

  downloadPayslip(month: string) {
    const employee = this.employee();
    const payroll = this.payroll();
    const lines = [
      'Payslip',
      `Month: ${month}`,
      `Employee: ${employee?.fullName || 'Employee'}`,
      `Employee ID: ${employee?.EmployeeId || this.employeeId()}`,
      '',
      'Earnings',
      `Basic Salary: ${this.formatCurrency(payroll.basicSalary)}`,
      `HRA: ${this.formatCurrency(payroll.hra)}`,
      `Allowances: ${this.formatCurrency(payroll.baseAllowances)}`,
      `Finance-Approved Funds: ${this.formatCurrency(payroll.approvedFundAmount)}`,
      `Gross Salary: ${this.formatCurrency(payroll.grossSalary)}`,
      '',
      'Deductions',
      `Configured Deductions: ${this.formatCurrency(payroll.fixedDeductions)}`,
      `Provident Fund: ${this.formatCurrency(payroll.pf)}`,
      `Professional Tax: ${this.formatCurrency(payroll.professionalTax)}`,
      `Total Deductions: ${this.formatCurrency(payroll.totalDeductions)}`,
      '',
      `Net Payable: ${this.formatCurrency(payroll.netSalary)}`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${employee?.EmployeeId || this.employeeId()}-${month.replace(/\s+/g, '-')}-payslip.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private buildPayrollBreakdown(): PayrollBreakdown {
    const storedPayroll = this.employee()?.payroll || {};
    const basicSalary = this.toNumber(storedPayroll.basicSalary);
    const hra = this.toNumber(storedPayroll.hra);
    const baseAllowances = this.toNumber(storedPayroll.allowances);
    const approvedFundAmount = this.approvedFundAmountForMonth();
    const allowances = baseAllowances + approvedFundAmount;
    const fixedDeductions = this.toNumber(storedPayroll.deductions);
    const grossSalary = basicSalary + hra + allowances;
    const pf = this.calculatePF(basicSalary);
    const professionalTax = this.calculateProfessionalTax(grossSalary - pf);
    const totalDeductions = fixedDeductions + pf + professionalTax;
    const netSalary = Math.max(grossSalary - totalDeductions, 0);

    return {
      basicSalary,
      hra,
      baseAllowances,
      allowances,
      approvedFundAmount,
      fixedDeductions,
      pf,
      professionalTax,
      grossSalary,
      totalDeductions,
      netSalary
    };
  }

  private calculatePF(basicSalary: number): number {
    const settings = this.payrollSettings();
    const shouldCalculate = this.payrollType() === 'intern'
      ? settings?.pfCalculateIntern
      : settings?.pfCalculateEmployee;

    if (!shouldCalculate) return 0;
    return basicSalary * (this.toNumber(settings?.pfPercentage) || 12) / 100;
  }

  private calculateProfessionalTax(taxableSalary: number): number {
    const settings = this.payrollSettings();
    const threshold = this.toNumber(settings?.taxLimitThreshold) || 50000;
    if (taxableSalary <= threshold) return 0;
    return taxableSalary * ((this.toNumber(settings?.taxPercentage) || 10) / 100);
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  private approvedFundAmountForMonth(): number {
    return this.fundRequests()
      .filter((fund: any) => fund.isFinanceTeamApprove === true && this.monthKey(fund.expenseDate) === this.payrollMonth())
      .reduce((sum: number, fund: any) => sum + (Number(fund.amount) || 0), 0);
  }

  onPayrollMonthChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.payrollMonth.set(value || this.currentMonthKey());
  }

  private currentMonthKey(): string {
    return this.monthKey(new Date());
  }

  private monthKey(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private dateFromMonthKey(monthKey: string): Date {
    const [year, month] = monthKey.split('-').map(Number);
    if (!year || !month) return new Date();
    return new Date(year, month - 1, 1);
  }
}

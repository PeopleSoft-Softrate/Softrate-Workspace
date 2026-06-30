import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { 
  Invoice01Icon, 
  Search01Icon, 
  UserCircleIcon, 
  NoteEditIcon, 
  ArrowLeft01Icon 
} from '@hugeicons/core-free-icons';
import { ApiService } from '../../../services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TourService } from '../../../services/tour.service';

@Component({
  selector: 'app-payroll-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './payroll-management.html',
  styleUrl: './payroll-management.css'
})
export class PayrollManagement implements OnInit {
  private apiService = inject(ApiService);
  private router = inject(Router);
  private tourService = inject(TourService);

  // Icons
  readonly Invoice01Icon = Invoice01Icon;
  readonly Search01Icon = Search01Icon;
  readonly UserCircleIcon = UserCircleIcon;
  readonly NoteEditIcon = NoteEditIcon;
  readonly ArrowLeft01Icon = ArrowLeft01Icon;

  // State Signals
  allEmployees = signal<any[]>([]);
  allInterns = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  searchQuery = signal<string>('');
  activeTab = signal<'employees' | 'interns'>('employees');

  // Edit Modal Signals
  showEditModal = signal<boolean>(false);
  selectedPerson = signal<any>(null);
  basicSalary = signal<number>(0);
  hra = signal<number>(0);
  allowances = signal<number>(0);
  deductions = signal<number>(0);

  // Toast Notification Signals
  showToast = signal<boolean>(false);
  toastMessage = signal<string>('');
  toastType = signal<'success' | 'error'>('success');

  // Computed signals for search filtering
  filteredEmployees = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const emps = this.allEmployees();
    if (!query) return emps;
    return emps.filter(e => 
      e.fullName?.toLowerCase().includes(query) ||
      (e.EmployeeId || '').toLowerCase().includes(query) ||
      (e.department || '').toLowerCase().includes(query) ||
      (e.role || '').toLowerCase().includes(query)
    );
  });

  // Enriched metrics using signals
  filteredInterns = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const ints = this.allInterns();
    if (!query) return ints;
    return ints.filter(i => 
      i.fullName?.toLowerCase().includes(query) ||
      (i.internid || i.internId || '').toLowerCase().includes(query) ||
      (i.department || '').toLowerCase().includes(query) ||
      (i.status || '').toLowerCase().includes(query)
    );
  });

  // Computed signals for metrics
  totalPayrollExpense = computed(() => {
    const empSum = this.allEmployees().reduce((sum, e) => sum + e.netSalary, 0);
    const intSum = this.allInterns().reduce((sum, i) => sum + i.netSalary, 0);
    return empSum + intSum;
  });

  totalStaffCount = computed(() => {
    return this.allEmployees().length + this.allInterns().length;
  });

  averageNetSalary = computed(() => {
    const total = this.totalPayrollExpense();
    const count = this.totalStaffCount();
    return count > 0 ? Math.round(total / count) : 0;
  });

  // PF and Tax default parameters loaded from defaults or fallback
  pfCalculateEmployee = signal<boolean>(false);
  pfCalculateIntern = signal<boolean>(false);
  pfPercentage = signal<number>(12);
  taxPercentage = signal<number>(10);
  taxLimitThreshold = signal<number>(50000);

  // LOP (Loss of Pay) configuration
  // Applies to: pending leaves + absences without any leave approval
  // Company/weekly holidays from Holiday Calendar are excluded from LOP count
  enableLopEmployee     = signal<boolean>(false);
  enableLopIntern       = signal<boolean>(false);
  lopTypeEmployee       = signal<'percentage' | 'amount'>('percentage');
  lopTypeIntern         = signal<'percentage' | 'amount'>('percentage');
  lopPercentageEmployee = signal<number>(100);
  lopPercentageIntern   = signal<number>(100);
  lopAmountEmployee     = signal<number>(0);
  lopAmountIntern       = signal<number>(0);
  workingDaysEmployee   = signal<number>(26);
  workingDaysIntern     = signal<number>(26);

  // Modal LOP days input (unauthorized leave days for this month)
  modalLopDays = signal<number>(0);

  // Real-time calculation in modal
  modalGross = computed(() => {
    return (this.basicSalary() || 0) + (this.hra() || 0) + (this.allowances() || 0) - (this.deductions() || 0);
  });

  modalPF = computed(() => {
    const person = this.selectedPerson();
    if (!person) return 0;
    return this.calculatePF(this.basicSalary() || 0, person.payrollType);
  });

  modalTax = computed(() => {
    const gross = this.modalGross();
    const pf = this.modalPF();
    return this.calculateTax(gross, pf);
  });

  modalLOP = computed(() => {
    const person = this.selectedPerson();
    if (!person) return 0;
    return this.calculateLOP(this.basicSalary() || 0, this.modalLopDays() || 0, person.payrollType);
  });

  modalNetSalary = computed(() => {
    const person = this.selectedPerson();
    if (!person) return 0;
    const basic = this.basicSalary() || 0;
    const hra = this.hra() || 0;
    const allowances = this.allowances() || 0;
    const deductions = this.deductions() || 0;
    const lopDays = this.modalLopDays() || 0;
    return this.calculateNetSalary(basic, hra, allowances, deductions, person.payrollType, lopDays);
  });

  ngOnInit() {
    this.loadPayrollDefaults();
    this.fetchData();

    setTimeout(() => {
      this.tourService.startPayrollTour();
    }, 800);
  }

  loadPayrollDefaults() {
    const payrollDefaultsStr = localStorage.getItem('payroll_default_settings');
    if (payrollDefaultsStr) {
      try {
        const defaults = JSON.parse(payrollDefaultsStr);
        if (defaults.pfCalculateEmployee !== undefined) this.pfCalculateEmployee.set(defaults.pfCalculateEmployee);
        if (defaults.pfCalculateIntern !== undefined) this.pfCalculateIntern.set(defaults.pfCalculateIntern);
        if (defaults.pfPercentage !== undefined) this.pfPercentage.set(defaults.pfPercentage);
        if (defaults.taxPercentage !== undefined) this.taxPercentage.set(defaults.taxPercentage);
        if (defaults.taxLimitThreshold !== undefined) this.taxLimitThreshold.set(defaults.taxLimitThreshold);
      } catch (e) {
        console.error('Failed to parse payroll defaults from localStorage', e);
      }
    }
  }

  calculatePF(basic: number, type: 'employee' | 'intern'): number {
    const calculate = type === 'employee' ? this.pfCalculateEmployee() : this.pfCalculateIntern();
    if (!calculate) return 0;
    return (basic * this.pfPercentage()) / 100;
  }

  calculateTax(gross: number, pf: number): number {
    const taxable = gross - pf;
    if (taxable <= this.taxLimitThreshold()) return 0;
    return (taxable * this.taxPercentage()) / 100;
  }

  calculateNetSalary(basic: number, hra: number, allowances: number, deductions: number, type: 'employee' | 'intern', lopDays: number = 0): number {
    const gross = basic + hra + allowances - deductions;
    const pf = this.calculatePF(basic, type);
    const tax = this.calculateTax(gross, pf);
    const lop = this.calculateLOP(basic, lopDays, type);
    return gross - pf - tax - lop;
  }

  // LOP = Loss of Pay for unauthorized days (pending + unapproved absences)
  // Holiday calendar days (company & weekly) are excluded before calling this
  calculateLOP(basic: number, lopDays: number, type: 'employee' | 'intern'): number {
    if (lopDays <= 0) return 0;
    const enabled = type === 'employee' ? this.enableLopEmployee() : this.enableLopIntern();
    if (!enabled) return 0;

    const lopType = type === 'employee' ? this.lopTypeEmployee() : this.lopTypeIntern();
    if (lopType === 'amount') {
      const amtPerDay = type === 'employee' ? this.lopAmountEmployee() : this.lopAmountIntern();
      return lopDays * (amtPerDay || 0);
    } else {
      // percentage of per-day salary
      const workingDays = type === 'employee' ? this.workingDaysEmployee() : this.workingDaysIntern();
      const lopPct = type === 'employee' ? this.lopPercentageEmployee() : this.lopPercentageIntern();
      const perDaySalary = basic / (workingDays || 26);
      return lopDays * perDaySalary * ((lopPct || 0) / 100);
    }
  }

  // Helper method to determine if a specific date is a weekly or special holiday
  isHoliday(date: Date, holidays: any[]): boolean {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[date.getDay()]; // e.g. "Sun"
    const dateNum = date.getDate();
    const weekNum = Math.ceil(dateNum / 7); // 1st week, 2nd week...

    for (const h of holidays) {
      if (h.type === 'weekly') {
        // Weekly holiday (e.g. Sun, Sat)
        if (h.day === dayName && Array.isArray(h.weeks) && h.weeks.includes(weekNum)) {
          return true;
        }
      } else if (h.type === 'special') {
        // Special holiday (e.g. National holiday)
        if (h.fromDate && h.toDate) {
          const from = new Date(h.fromDate);
          const to = new Date(h.toDate);
          
          const checkTime = date.getTime();
          const fromTime = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
          const toTime = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();

          if (checkTime >= fromTime && checkTime <= toTime) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Automatic calculation of LOP Days for this month, considering onboardingDate boundary
  calculateAutoLopDaysForPerson(attendance: any, leaves: any, holidays: any[], onboardingDateStr?: string | Date): number {
    const attList = Array.isArray(attendance)
      ? attendance
      : (attendance?.attendance || attendance?.data || []);

    const leavesList = Array.isArray(leaves)
      ? leaves
      : (leaves?.leaves || leaves?.data || []);

    const holidaysList = Array.isArray(holidays) ? holidays : [];

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0 = Jan, 4 = May...

    let startDay = 1;
    if (onboardingDateStr) {
      const obDate = new Date(onboardingDateStr);
      if (!isNaN(obDate.getTime())) {
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startOfOb = new Date(obDate.getFullYear(), obDate.getMonth(), obDate.getDate());
        if (startOfOb > startOfToday) {
          return 0; // Onboarding date is in the future
        }
        if (obDate.getFullYear() === currentYear && obDate.getMonth() === currentMonth) {
          startDay = obDate.getDate();
        }
      }
    }

    let lopCount = 0;

    // Loop through startDay of current month up to today
    for (let day = startDay; day <= today.getDate(); day++) {
      const d = new Date(currentYear, currentMonth, day);
      
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yearStr}-${monthStr}-${dayStr}`;

      // 1. Skip if it's a holiday (special or weekly)
      if (this.isHoliday(d, holidaysList)) {
        continue;
      }

      // 2. Check if the employee punched in
      const hasPunchIn = attList.some((record: any) => {
        if (!record.date) return false;
        const recordDateStr = record.date.substring(0, 10);
        return recordDateStr === dateKey && record.punchInTime;
      });

      if (hasPunchIn) {
        continue; // Present
      }

      // 3. Check if there is an approved leave
      const hasApprovedLeave = leavesList.some((leave: any) => {
        const isApproved = leave.hrStatus === 'accepted' || leave.hrStatus === 'approved';
        if (!isApproved) return false;

        const from = new Date(leave.fromDate);
        const to = new Date(leave.toDate);

        const checkTime = d.getTime();
        const fromTime = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
        const toTime = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();

        return checkTime >= fromTime && checkTime <= toTime;
      });

      if (hasApprovedLeave) {
        continue; // Approved Leave
      }

      // Absent and no approved leave on a working day -> Loss of Pay!
      lopCount++;
    }

    return lopCount;
  }

  fetchData() {
    this.isLoading.set(true);
    forkJoin({
      settings: this.apiService.getCompanySettings(),
      employees: this.apiService.getAllEmployees('all', 'approved'),
      interns: this.apiService.getAllActiveInterns('all', 'all'),
      holidays: this.apiService.getHolidays().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        // Load settings from backend if available
        if (res.settings && res.settings.success && res.settings.settings && res.settings.settings.payrollSettings) {
          const s = res.settings.settings.payrollSettings;
          this.pfCalculateEmployee.set(s.pfCalculateEmployee ?? false);
          this.pfCalculateIntern.set(s.pfCalculateIntern ?? false);
          this.pfPercentage.set(s.pfPercentage ?? 12);
          this.taxPercentage.set(s.taxPercentage ?? 10);
          this.taxLimitThreshold.set(s.taxLimitThreshold ?? 50000);

          // Load LOP settings
          const lop = s.lopSettings || {};
          this.enableLopEmployee.set(lop.enableLopEmployee ?? false);
          this.enableLopIntern.set(lop.enableLopIntern ?? false);
          this.lopTypeEmployee.set(lop.lopTypeEmployee ?? 'percentage');
          this.lopTypeIntern.set(lop.lopTypeIntern ?? 'percentage');
          this.lopPercentageEmployee.set(lop.lopPercentageEmployee ?? 100);
          this.lopPercentageIntern.set(lop.lopPercentageIntern ?? 100);
          this.lopAmountEmployee.set(lop.lopAmountEmployee ?? 0);
          this.lopAmountIntern.set(lop.lopAmountIntern ?? 0);
          this.workingDaysEmployee.set(lop.workingDaysEmployee ?? 26);
          this.workingDaysIntern.set(lop.workingDaysIntern ?? 26);
        }

        const holidays = res.holidays || [];

        // Parallel fetch attendance and leaves for all approved employees
        const empFetches = res.employees.map(emp => {
          const empId = emp.EmployeeId || emp._id;
          return forkJoin({
            attendance: this.apiService.getEmployeeAttendance(empId).pipe(catchError(() => of([]))),
            leaves: this.apiService.getEmployeeLeaves(empId).pipe(catchError(() => of([])))
          }).pipe(
            catchError(() => of({ attendance: [], leaves: [] }))
          );
        });

        // Parallel fetch attendance and leaves for all active interns, including ongoing interns.
        const intFetches = res.interns.map(intern => {
          const internId = intern.internid || intern.internId || intern._id;
          return forkJoin({
            attendance: this.apiService.getInternAttendance(internId).pipe(catchError(() => of([]))),
            leaves: this.apiService.getInternLeaves(internId).pipe(catchError(() => of([])))
          }).pipe(
            catchError(() => of({ attendance: [], leaves: [] }))
          );
        });

        forkJoin({
          empData: empFetches.length > 0 ? forkJoin(empFetches) : of([]),
          intData: intFetches.length > 0 ? forkJoin(intFetches) : of([])
        }).subscribe({
          next: (details) => {
            const enrichedEmployees = res.employees.map((emp, index) => {
              const data = details.empData[index];
              const att = data ? (data.attendance || []) : [];
              const leaves = data ? (data.leaves || []) : [];
              const lopDays = this.calculateAutoLopDaysForPerson(att, leaves, holidays, emp.onboardingDate);

              const payroll = this.getPayrollDetails(emp, 'employee');
              const net = this.calculateNetSalary(payroll.basicSalary, payroll.hra, payroll.allowances, payroll.deductions, 'employee', lopDays);
              return {
                ...emp,
                payrollType: 'employee',
                payroll,
                lopDays,
                netSalary: net
              };
            });

            const enrichedInterns = res.interns.map((intern, index) => {
              const data = details.intData[index];
              const att = data ? (data.attendance || []) : [];
              const leaves = data ? (data.leaves || []) : [];
              const lopDays = this.calculateAutoLopDaysForPerson(att, leaves, holidays, intern.onboardingDate);

              const payroll = this.getPayrollDetails(intern, 'intern');
              const net = this.calculateNetSalary(payroll.basicSalary, payroll.hra || 0, payroll.allowances, payroll.deductions, 'intern', lopDays);
              return {
                ...intern,
                payrollType: 'intern',
                payroll,
                lopDays,
                netSalary: net
              };
            });

            this.allEmployees.set(enrichedEmployees);
            this.allInterns.set(enrichedInterns);
            this.isLoading.set(false);
          },
          error: (err) => {
            console.error('Failed to resolve detailed payroll metrics', err);
            // Fallback load without auto-calculated LOP
            const enrichedEmployees = res.employees.map(emp => {
              const payroll = this.getPayrollDetails(emp, 'employee');
              const net = this.calculateNetSalary(payroll.basicSalary, payroll.hra, payroll.allowances, payroll.deductions, 'employee', 0);
              return { ...emp, payrollType: 'employee', payroll, lopDays: 0, netSalary: net };
            });
            const enrichedInterns = res.interns.map(intern => {
              const payroll = this.getPayrollDetails(intern, 'intern');
              const net = this.calculateNetSalary(payroll.basicSalary, payroll.hra || 0, payroll.allowances, payroll.deductions, 'intern', 0);
              return { ...intern, payrollType: 'intern', payroll, lopDays: 0, netSalary: net };
            });
            this.allEmployees.set(enrichedEmployees);
            this.allInterns.set(enrichedInterns);
            this.isLoading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Failed to load base payroll data', err);
        this.displayToast('Failed to retrieve employee/intern rosters.', 'error');
        this.isLoading.set(false);
      }
    });
  }

  getPayrollDetails(person: any, type: 'employee' | 'intern') {
    if (person.payroll && typeof person.payroll === 'object' && person.payroll.basicSalary) {
      return {
        basicSalary: Number(person.payroll.basicSalary) || 0,
        hra: Number(person.payroll.hra) || 0,
        allowances: Number(person.payroll.allowances) || 0,
        deductions: Number(person.payroll.deductions) || 0
      };
    }

    const payrollDefaultsStr = localStorage.getItem('payroll_default_settings');
    let defaults: any = null;
    if (payrollDefaultsStr) {
      try {
        defaults = JSON.parse(payrollDefaultsStr);
      } catch (e) {
        console.error('Failed to parse payroll defaults from localStorage', e);
      }
    }

    if (type === 'employee') {
      return {
        basicSalary: defaults?.empBasic !== undefined ? defaults.empBasic : 35000,
        hra: defaults?.empHra !== undefined ? defaults.empHra : 12000,
        allowances: defaults?.empAllowances !== undefined ? defaults.empAllowances : 6000,
        deductions: defaults?.empDeductions !== undefined ? defaults.empDeductions : 3000
      };
    } else {
      return {
        basicSalary: defaults?.intBasic !== undefined ? defaults.intBasic : 12000,
        hra: 0,
        allowances: defaults?.intAllowances !== undefined ? defaults.intAllowances : 2000,
        deductions: defaults?.intDeductions !== undefined ? defaults.intDeductions : 1000
      };
    }
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  switchTab(tab: 'employees' | 'interns') {
    this.activeTab.set(tab);
  }

  openEditModal(person: any) {
    this.selectedPerson.set(person);
    this.basicSalary.set(person.payroll.basicSalary);
    this.hra.set(person.payroll.hra);
    this.allowances.set(person.payroll.allowances);
    this.deductions.set(person.payroll.deductions);
    this.modalLopDays.set(person.lopDays || 0); // set to auto-calculated LOP days
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.selectedPerson.set(null);
  }

  savePayrollStructure() {
    const person = this.selectedPerson();
    if (!person) return;

    const id = person.payrollType === 'employee' ? (person.EmployeeId || person._id) : (person.internid || person.internId || person._id);
    const updatedPayroll = {
      basicSalary: Number(this.basicSalary()) || 0,
      hra: Number(this.hra()) || 0,
      allowances: Number(this.allowances()) || 0,
      deductions: Number(this.deductions()) || 0
    };

    localStorage.setItem(`payroll_struct_${id}`, JSON.stringify(updatedPayroll));

    const update$ = person.payrollType === 'employee'
      ? this.apiService.updateEmployee(person._id, { payroll: updatedPayroll })
      : this.apiService.updateIntern(person._id, { payroll: updatedPayroll });

    update$.subscribe({
      next: () => {
        if (person.payrollType === 'employee') {
          const updated = this.allEmployees().map(emp => {
            if ((emp.EmployeeId || emp._id) === id) {
              const net = this.calculateNetSalary(updatedPayroll.basicSalary, updatedPayroll.hra, updatedPayroll.allowances, updatedPayroll.deductions, 'employee', this.modalLopDays());
              return {
                ...emp,
                payroll: updatedPayroll,
                lopDays: this.modalLopDays(), // preserve manually overridden LOP days
                netSalary: net
              };
            }
            return emp;
          });
          this.allEmployees.set(updated);
        } else {
          const updated = this.allInterns().map(intern => {
            const internIdVal = intern.internid || intern.internId || intern._id;
            if (internIdVal === id) {
              const net = this.calculateNetSalary(updatedPayroll.basicSalary, updatedPayroll.hra, updatedPayroll.allowances, updatedPayroll.deductions, 'intern', this.modalLopDays());
              return {
                ...intern,
                payroll: updatedPayroll,
                lopDays: this.modalLopDays(), // preserve manually overridden LOP days
                netSalary: net
              };
            }
            return intern;
          });
          this.allInterns.set(updated);
        }

        this.displayToast(`Payroll structure updated successfully for ${person.fullName}.`, 'success');
        this.closeEditModal();
      },
      error: (err) => {
        console.error('Failed to update payroll structure on backend', err);
        this.displayToast('Failed to save payroll structure to backend server.', 'error');
      }
    });
  }

  displayToast(message: string, type: 'success' | 'error') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.showToast.set(true);
    setTimeout(() => {
      this.showToast.set(false);
    }, 3000);
  }

  navigateToDashboard() {
    this.router.navigate(['/dashboard']).then(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
}

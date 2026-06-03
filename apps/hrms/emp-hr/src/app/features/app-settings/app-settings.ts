import { AlertService } from '../../shared/services/alert';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { 
  PlusSignIcon,
  Delete02Icon,
  Location01Icon,
  MapsLocation02Icon,
  Settings01Icon,
  CheckmarkCircle01Icon,
  Coordinate01Icon,
  MailReceive01Icon,
  UserCircleIcon,
  UserGroupIcon,
  PaymentSuccess02Icon,
  Search01Icon,
  Calendar01Icon
} from '@hugeicons/core-free-icons';
import { catchError, finalize, forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, HugeiconsIconComponent],
  templateUrl: './app-settings.html',
  styleUrl: './app-settings.css'
})
export class AppSettings implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);

  readonly PlusSignIcon = PlusSignIcon;
  readonly Delete02Icon = Delete02Icon;
  readonly Location01Icon = Location01Icon;
  readonly MapsLocation02Icon = MapsLocation02Icon;
  readonly Settings01Icon = Settings01Icon;
  readonly CheckmarkCircle01Icon = CheckmarkCircle01Icon;
  readonly Coordinate01Icon = Coordinate01Icon;
  readonly MailReceive01Icon = MailReceive01Icon;
  readonly UserCircleIcon = UserCircleIcon;
  readonly UserGroupIcon = UserGroupIcon;
  readonly PaymentSuccess02Icon = PaymentSuccess02Icon;
  readonly Search01Icon = Search01Icon;
  readonly Calendar01Icon = Calendar01Icon;

  userRole = signal<string | null>(localStorage.getItem('user_role'));
  currentUser = signal<any>(null);

  receivingEmail = signal<string>('');
  locations = signal<any[]>([]);
  communication = signal<any>({
    emailNotifications: true,
    emailSignatureUrl: null,
    emailLogoUrl: null,
    offboardingRejectionTemplate: '',
    onboardingTemplateEmployee: '',
    onboardingTemplateIntern: ''
  });
  employeeRoles = signal<string[]>([]);
  internRoles = signal<string[]>([]);
  leavePolicies = signal<any[]>([
    { name: 'Casual Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' },
    { name: 'Sick Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' }
  ]);

  // Default Payroll settings
  defaultEmployeeBasic = signal<number>(35000);
  defaultEmployeeHra = signal<number>(12000);
  defaultEmployeeAllowances = signal<number>(6000);
  defaultEmployeeDeductions = signal<number>(3000);
  defaultInternBasic = signal<number>(12000);
  defaultInternAllowances = signal<number>(2000);
  defaultInternDeductions = signal<number>(1000);

  // PF and Tax settings
  pfCalculateEmployee = signal<boolean>(false);
  pfPercentage = signal<number>(12);
  taxPercentage = signal<number>(10);
  taxLimitThreshold = signal<number>(50000);

  // LOP (Loss of Pay) settings
  // Applies to: pending leaves + absence without any approval
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

  // Individual payroll lists
  allEmployees = signal<any[]>([]);
  allInterns = signal<any[]>([]);
  payrollSearchQuery = signal<string>('');
  payrollActiveSubTab = signal<'employees' | 'interns'>('employees');

  filteredPayrollEmployees = computed(() => {
    const query = this.payrollSearchQuery().toLowerCase().trim();
    const emps = this.allEmployees();
    if (!query) return emps;
    return emps.filter(e => 
      e.fullName?.toLowerCase().includes(query) ||
      (e.EmployeeId || '').toLowerCase().includes(query) ||
      (e.department || '').toLowerCase().includes(query) ||
      (e.role || '').toLowerCase().includes(query)
    );
  });

  filteredPayrollInterns = computed(() => {
    const query = this.payrollSearchQuery().toLowerCase().trim();
    const ints = this.allInterns();
    if (!query) return ints;
    return ints.filter(i => 
      i.fullName?.toLowerCase().includes(query) ||
      (i.internid || i.internId || '').toLowerCase().includes(query) ||
      (i.department || '').toLowerCase().includes(query)
    );
  });
  
  activeTab = signal<'locations' | 'communication' | 'employee_roles' | 'intern_roles' | 'payroll_settings' | 'leave_policies'>('locations');

  isSaving = signal(false);
  isLoading = signal(true);

  ngOnInit() {
    const data = localStorage.getItem('user_data');
    if (data) {
      this.currentUser.set(JSON.parse(data));
    }
    // Load default payroll settings from localStorage if available
    const payrollDefaultsStr = localStorage.getItem('payroll_default_settings');
    if (payrollDefaultsStr) {
      try {
        const defaults = JSON.parse(payrollDefaultsStr);
        if (defaults.empBasic !== undefined) this.defaultEmployeeBasic.set(defaults.empBasic);
        if (defaults.empHra !== undefined) this.defaultEmployeeHra.set(defaults.empHra);
        if (defaults.empAllowances !== undefined) this.defaultEmployeeAllowances.set(defaults.empAllowances);
        if (defaults.empDeductions !== undefined) this.defaultEmployeeDeductions.set(defaults.empDeductions);
        if (defaults.intBasic !== undefined) this.defaultInternBasic.set(defaults.intBasic);
        if (defaults.intAllowances !== undefined) this.defaultInternAllowances.set(defaults.intAllowances);
        if (defaults.intDeductions !== undefined) this.defaultInternDeductions.set(defaults.intDeductions);
        if (defaults.pfCalculateEmployee !== undefined) this.pfCalculateEmployee.set(defaults.pfCalculateEmployee);
        if (defaults.pfPercentage !== undefined) this.pfPercentage.set(defaults.pfPercentage);
        if (defaults.taxPercentage !== undefined) this.taxPercentage.set(defaults.taxPercentage);
        if (defaults.taxLimitThreshold !== undefined) this.taxLimitThreshold.set(defaults.taxLimitThreshold);
      } catch (e) {
        console.error('Failed to parse payroll defaults', e);
      }
    }
    this.fetchSettings();
  }

  fetchSettings() {
    this.isLoading.set(true);
    forkJoin({
      settings: this.apiService.getCompanySettings(),
      employees: this.apiService.getAllEmployees('all', 'approved'),
      interns: this.apiService.getAllActiveInterns('all', 'approved')
    }).subscribe({
      next: (res: any) => {
        if (res.settings && res.settings.success && res.settings.settings) {
          const s = res.settings.settings;
          this.receivingEmail.set(s.receivingEmail || '');
          this.locations.set(s.locations || []);
          this.communication.set(s.communication || {
            whatsappNotifications: false,
            emailNotifications: true,
            emailSignatureUrl: null,
            emailLogoUrl: null,
            offboardingRejectionTemplate: '',
            onboardingTemplateEmployee: '',
            onboardingTemplateIntern: ''
          });
          this.employeeRoles.set(s.employeeRoles || []);
          this.internRoles.set(s.internRoles || [
            'Web developer',
            'App developer',
            'Artificial Intelligence',
            'Data Analyst',
            'Cybersecurity Analyst',
            'Networking Analyst',
            'Graphics Designer',
            'Digital marketing',
            'Business developer (Sales)',
            'Research & Development (R&D)',
            'HR Analyst',
            'Other'
          ]);
          this.leavePolicies.set(s.leavePolicies || [
            { name: 'Casual Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' },
            { name: 'Sick Leave', allowance: 12, frequency: 'annual', appliesTo: 'both' }
          ]);

          if (s.payrollSettings) {
            const ps = s.payrollSettings;
            this.pfCalculateEmployee.set(ps.pfCalculateEmployee ?? false);
            this.pfPercentage.set(ps.pfPercentage ?? 12);
            this.taxPercentage.set(ps.taxPercentage ?? 10);
            this.taxLimitThreshold.set(ps.taxLimitThreshold ?? 50000);

            // Load LOP settings
            const lop = ps.lopSettings || {};
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
        }

        const emps = (res.employees || []).map((emp: any) => {
          const payroll = this.getIndividualPayroll(emp, 'employee');
          return { ...emp, payroll };
        });
        const ints = (res.interns || []).map((intern: any) => {
          const payroll = this.getIndividualPayroll(intern, 'intern');
          return { ...intern, payroll };
        });

        this.allEmployees.set(emps);
        this.allInterns.set(ints);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch settings, employees, and interns', err);
        this.isLoading.set(false);
      }
    });
  }

  getIndividualPayroll(person: any, type: 'employee' | 'intern') {
    // 1. Check if person already has payroll fields in database (configured > 0)
    if (person.payroll && typeof person.payroll === 'object' && person.payroll.basicSalary) {
      return {
        basicSalary: Number(person.payroll.basicSalary) || 0,
        hra: Number(person.payroll.hra) || 0,
        allowances: Number(person.payroll.allowances) || 0,
        deductions: Number(person.payroll.deductions) || 0
      };
    }
    // 2. Fall back to default settings signals
    if (type === 'employee') {
      return {
        basicSalary: this.defaultEmployeeBasic(),
        hra: this.defaultEmployeeHra(),
        allowances: this.defaultEmployeeAllowances(),
        deductions: this.defaultEmployeeDeductions()
      };
    } else {
      return {
        basicSalary: this.defaultInternBasic(),
        hra: 0,
        allowances: this.defaultInternAllowances(),
        deductions: this.defaultInternDeductions()
      };
    }
  }

  canEditCommunication(): boolean {
    const role = this.userRole()?.toLowerCase();
    return role === 'hr' || role === 'hr_admin';
  }

  canEditLocation(location: any): boolean {
    const role = this.userRole()?.toLowerCase();
    if (role === 'hr' || role === 'hr_admin') return true;
    if (this.userRole() === 'manager') {
      // If it's a new location being added, or one they created
      return !location._id || location.addedBy === this.currentUser()?.employeeId;
    }
    return false;
  }

  addLocation() {
    const current = this.locations();
    current.push({
      name: 'New Branch',
      latitude: 0,
      longitude: 0,
      radius: 200,
      addedBy: (this.userRole()?.toLowerCase() === 'hr' || this.userRole()?.toLowerCase() === 'hr_admin') ? 'hr' : this.currentUser()?.employeeId
    });
    this.locations.set([...current]);
  }

  removeLocation(index: number) {
    const loc = this.locations()[index];
    if (!this.canEditLocation(loc)) {
      this.alertService.show('You do not have permission to remove this location');
      return;
    }
    const current = this.locations();
    current.splice(index, 1);
    this.locations.set([...current]);
  }

  saveAllSettings() {
    this.isSaving.set(true);
    const payload = {
      receivingEmail: this.receivingEmail(),
      locations: this.locations(),
      communication: this.communication(),
      employeeRoles: this.employeeRoles(),
      internRoles: this.internRoles(),
      leavePolicies: this.leavePolicies(),
      payrollSettings: {
        pfCalculateEmployee: this.pfCalculateEmployee(),
        pfCalculateIntern: false,
        pfPercentage: Number(this.pfPercentage()) || 0,
        taxPercentage: Number(this.taxPercentage()) || 0,
        taxLimitThreshold: Number(this.taxLimitThreshold()) || 0,
        lopSettings: {
          enableLopEmployee:     this.enableLopEmployee(),
          enableLopIntern:       this.enableLopIntern(),
          lopTypeEmployee:       this.lopTypeEmployee(),
          lopTypeIntern:         this.lopTypeIntern(),
          lopPercentageEmployee: Number(this.lopPercentageEmployee()) || 0,
          lopPercentageIntern:   Number(this.lopPercentageIntern()) || 0,
          lopAmountEmployee:     Number(this.lopAmountEmployee()) || 0,
          lopAmountIntern:       Number(this.lopAmountIntern()) || 0,
          workingDaysEmployee:   Number(this.workingDaysEmployee()) || 26,
          workingDaysIntern:     Number(this.workingDaysIntern()) || 26
        }
      }
    };

    // Save payroll default settings to localStorage
    const payrollDefaults = {
      empBasic: Number(this.defaultEmployeeBasic()) || 0,
      empHra: Number(this.defaultEmployeeHra()) || 0,
      empAllowances: Number(this.defaultEmployeeAllowances()) || 0,
      empDeductions: Number(this.defaultEmployeeDeductions()) || 0,
      intBasic: Number(this.defaultInternBasic()) || 0,
      intAllowances: Number(this.defaultInternAllowances()) || 0,
      intDeductions: Number(this.defaultInternDeductions()) || 0,
      pfCalculateEmployee: this.pfCalculateEmployee(),
      pfPercentage: Number(this.pfPercentage()) || 0,
      taxPercentage: Number(this.taxPercentage()) || 0,
      taxLimitThreshold: Number(this.taxLimitThreshold()) || 0
    };
    localStorage.setItem('payroll_default_settings', JSON.stringify(payrollDefaults));

    const updates: any[] = [];

    // Save each employee's individual payroll structure to localStorage and DB
    for (const emp of this.allEmployees()) {
      const id = emp.EmployeeId || emp._id;
      const payroll = {
        basicSalary: Number(emp.payroll.basicSalary) || 0,
        hra: Number(emp.payroll.hra) || 0,
        allowances: Number(emp.payroll.allowances) || 0,
        deductions: Number(emp.payroll.deductions) || 0
      };
      localStorage.setItem(`payroll_struct_${id}`, JSON.stringify(payroll));
      if (emp._id) {
        updates.push(
          this.apiService.updateEmployee(emp._id, { payroll }).pipe(
            catchError(() => of(null)) // Ignore if employee not found
          )
        );
      }
    }

    // Save each intern's individual payroll structure to localStorage and DB
    for (const intern of this.allInterns()) {
      const id = intern.internid || intern.internId || intern._id;
      const payroll = {
        basicSalary: Number(intern.payroll.basicSalary) || 0,
        hra: 0,
        allowances: Number(intern.payroll.allowances) || 0,
        deductions: Number(intern.payroll.deductions) || 0
      };
      localStorage.setItem(`payroll_struct_${id}`, JSON.stringify(payroll));
      if (intern._id) {
        updates.push(
          this.apiService.updateIntern(intern._id, { payroll }).pipe(
            catchError(() => of(null)) // Ignore if intern not found
          )
        );
      }
    }

    const companySettingsUpdate$ = this.apiService.updateCompanySettings(payload);

    forkJoin([companySettingsUpdate$, ...updates]).pipe(
      finalize(() => this.isSaving.set(false))
    ).subscribe({
      next: (res: any) => {
        this.alertService.show('All settings updated successfully');
        this.fetchSettings(); // Refresh to reflect changes immediately
      },
      error: (err) => {
        this.alertService.show('Failed to update settings: ' + (err.error?.message || err.message));
      }
    });
  }

  calculatePF(basic: number, type: 'employee' | 'intern'): number {
    if (type === 'intern' || !this.pfCalculateEmployee()) return 0;
    return (basic * this.pfPercentage()) / 100;
  }

  calculateTax(gross: number, pf: number): number {
    const taxable = gross - pf;
    if (taxable <= this.taxLimitThreshold()) return 0;
    return (taxable * this.taxPercentage()) / 100;
  }

  calculateNetSalary(basic: number, hra: number, allowances: number, deductions: number, type: 'employee' | 'intern'): number {
    const gross = basic + hra + allowances - deductions;
    const pf = this.calculatePF(basic, type);
    const tax = this.calculateTax(gross, pf);
    return gross - pf - tax;
  }
  
  addRole(type: 'employee' | 'intern') {
    const roles = type === 'employee' ? this.employeeRoles() : this.internRoles();
    roles.push('');
    if (type === 'employee') this.employeeRoles.set([...roles]);
    else this.internRoles.set([...roles]);
  }

  removeRole(type: 'employee' | 'intern', index: number) {
    const roles = type === 'employee' ? this.employeeRoles() : this.internRoles();
    
    // Don't allow deleting 'Other'
    if (roles[index].toLowerCase() === 'other') {
      this.alertService.show('The "Other" role cannot be deleted as it is required by the system.');
      return;
    }

    roles.splice(index, 1);
    if (type === 'employee') this.employeeRoles.set([...roles]);
    else this.internRoles.set([...roles]);
  }

  updateRole(type: 'employee' | 'intern', index: number, value: string) {
    const roles = type === 'employee' ? this.employeeRoles() : this.internRoles();
    roles[index] = value;
    if (type === 'employee') this.employeeRoles.set([...roles]);
    else this.internRoles.set([...roles]);
  }

  onSignatureUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Str = e.target?.result as string;
        this.communication.set({
          ...this.communication(),
          emailSignatureUrl: base64Str
        });
      };
      reader.readAsDataURL(file);
    }
  }

  onLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Str = e.target?.result as string;
        this.communication.set({
          ...this.communication(),
          emailLogoUrl: base64Str
        });
      };
      reader.readAsDataURL(file);
    }
  }

  insertVariable(selectElem: HTMLSelectElement, textareaElem: HTMLTextAreaElement, field: string) {
    const variable = selectElem.value;
    if (!variable) return;

    const currentVal = this.communication()[field] || '';
    const startPos = textareaElem.selectionStart || currentVal.length;
    const endPos = textareaElem.selectionEnd || currentVal.length;

    const newVal = currentVal.substring(0, startPos) + variable + currentVal.substring(endPos);
    
    this.communication.set({
      ...this.communication(),
      [field]: newVal
    });

    // Reset dropdown
    selectElem.value = "";

    // Set cursor position back inside textarea after angular updates
    setTimeout(() => {
      textareaElem.focus();
      textareaElem.setSelectionRange(startPos + variable.length, startPos + variable.length);
    }, 0);
  }

  addLeavePolicy() {
    const current = this.leavePolicies();
    current.push({ name: '', allowance: 12, frequency: 'annual', appliesTo: 'both' });
    this.leavePolicies.set([...current]);
  }

  removeLeavePolicy(index: number) {
    const current = this.leavePolicies();
    current.splice(index, 1);
    this.leavePolicies.set([...current]);
  }

  trackByIndex(index: number, item: any): any {
    return index;
  }
}

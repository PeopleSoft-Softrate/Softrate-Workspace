import { Injectable } from '@angular/core';
import { CallLogService } from '../../../services/calllog.service';
import { EmployeeService, Employee } from '../../../services/employee.service';
import { LeadService, Lead } from '../../../services/lead.service';

@Injectable({ providedIn: 'root' })
export class AdminEmployeesWorkflow {
  constructor(
    private employeeService: EmployeeService,
    private callLogService: CallLogService,
    private leadService: LeadService
  ) {}

  filteredEmployeesForTable(vm: any): Employee[] {
    const query = vm.employeeSearchQuery.trim().toLowerCase();
    if (!query) return vm.employees;
    return vm.employees.filter((emp: Employee) => {
      const tags = Array.isArray(emp.tags) ? emp.tags.join(' ') : '';
      return [
        emp.name,
        emp.mobile,
        tags,
        emp.appVersion,
        emp.lastCallTime,
        emp.lastSyncTime,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }

  filteredEmployeeCallRows(vm: any): any[] {
    return vm.employeeCallRows.filter((row: any) => {
      if (vm.filterTags && (!row.emp.tags || !row.emp.tags.includes(vm.filterTags))) return false;
      if (vm.filterEmployees && row.emp.mobile !== vm.filterEmployees) return false;
      return true;
    });
  }

  fetchEmployees(vm: any): void {
    if (!vm.dashboardCode) return;
    vm.employeesLoading = true;
    vm.employeesError = '';
    this.employeeService.getEmployees(vm.dashboardCode).subscribe({
      next: (res: any) => {
        vm.employeesLoading = false;
        if (res.success && res.employees) {
          vm.employees = res.employees;

          if (vm.selectedPeriod !== 'custom') {
            const cache = vm.preloadedCache[vm.selectedPeriod];
            if (cache.employeesLoaded) {
              vm.mapEmployeeStats(cache.employees || []);
              vm.empCallLoading = false;
            }
          } else {
            vm.fetchEmployeeCallRows();
          }
        } else {
          vm.employeesError = res.message || 'Failed to load employees.';
        }
      },
      error: (err: any) => {
        vm.employeesLoading = false;
        vm.employeesError = err?.error?.message || 'Server error: Could not connect to the server. Please try again.';
      },
    });
  }

  fetchEmployeeCallRows(vm: any, forceRefresh = false): void {
    if (!vm.dashboardCode) return;

    if (!forceRefresh && vm.selectedPeriod !== 'custom') {
      const cache = vm.preloadedCache[vm.selectedPeriod];
      if (cache.employeesLoaded) {
        vm.mapEmployeeStats(cache.employees || []);
        vm.empCallLoading = false;
      } else {
        vm.empCallLoading = true;
      }
      return;
    }

    vm.empCallLoading = true;
    vm.empCallError = '';

    const filters = vm.dashTab === 'reports' ? {
      callType: vm.filterCallType,
      duration: vm.filterDuration,
      callTime: vm.filterCallTime,
    } : null;

    this.callLogService.getEmployeesStats(
      vm.dashboardCode,
      vm.selectedPeriod,
      vm.selectedPeriod === 'custom' ? vm.customFrom : undefined,
      vm.selectedPeriod === 'custom' ? (vm.customTo || undefined) : undefined,
      filters
    ).subscribe({
      next: (res: any) => {
        if (res.success) {
          vm.mapEmployeeStats(res.employees);
        } else {
          vm.empCallLoading = false;
          vm.empCallError = res.message || 'Failed to load call data.';
        }
      },
      error: (err: any) => {
        vm.empCallLoading = false;
        vm.empCallError = err?.error?.message || 'Server error: Could not load call statistics.';
      },
    });
  }

  syncAll(vm: any): void {
    vm.syncAllLoading = true;

    if (vm.selectedPeriod === 'custom') {
      vm.fetchSummary();
      vm.fetchEmployeeCallRows();
    } else {
      vm.fetchSummary(true);
      vm.fetchEmployeeCallRows(true);
    }
    vm.fetchEmployees();
    setTimeout(() => vm.syncAllLoading = false, 1500);
  }

  syncEmployee(vm: any): void {
    if (!vm.selectedEmployee) return;
    vm.syncEmpLoading = true;
    vm.openEmployee(vm.selectedEmployee);
    setTimeout(() => vm.syncEmpLoading = false, 1500);
  }

  openEmployee(vm: any, emp: Employee): void {
    vm.selectedEmployee = emp;
    vm.selectedEmpStats = null;
    vm.selectedEmpCalls = [];
    vm.selectedEmpLoading = true;
    vm.selectedEmpCallsLoading = true;
    vm.drilldownTab = 'stats';
    vm.dashTab = 'emp_dashboard';
    vm.selectedEmpLeadCompany = '';
    vm.selectedEmpFollowupCompany = '';
    vm.followupFilter = 'all';
    vm.followupSearch = '';
    vm.selectedFollowupDate = '';

    window.scrollTo({ top: 0, behavior: 'instant' });

    this.callLogService.getEmployeeStat(
      vm.dashboardCode,
      emp.mobile,
      vm.selectedPeriod,
      vm.selectedPeriod === 'custom' ? vm.customFrom : undefined,
      vm.selectedPeriod === 'custom' ? (vm.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        vm.selectedEmpLoading = false;
        if (res.success) vm.selectedEmpStats = res.stats;
      },
      error: () => { vm.selectedEmpLoading = false; },
    });

    this.callLogService.getCallDetails(
      vm.dashboardCode,
      emp.mobile,
      vm.selectedPeriod,
      vm.selectedPeriod === 'custom' ? vm.customFrom : undefined,
      vm.selectedPeriod === 'custom' ? (vm.customTo || undefined) : undefined,
    ).subscribe({
      next: (res: any) => {
        vm.selectedEmpCallsLoading = false;
        if (res.success) {
          vm.selectedEmpCalls = res.calls;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              vm.renderChart();
              vm.renderEmpDonutChart();
            });
          });
        }
      },
      error: () => { vm.selectedEmpCallsLoading = false; },
    });

    vm.fetchEmpLeads();
    vm.fetchCompanyBookmarks();
  }

  selectEmployee(vm: any, emp: Employee): void {
    vm.openEmployee(emp);
  }

  openAddEmployee(vm: any): void {
    vm.isAddEmployeeOpen = true;
    vm.addEmployeeError = '';
    vm.newEmployee = { name: '', mobile: '', countryCode: '+91' };
    vm.updateScrollLock();
  }

  closeAddEmployee(vm: any): void {
    vm.isAddEmployeeOpen = false;
  }

  onAddEmployeeSubmit(vm: any, event: Event): void {
    event.preventDefault();
    vm.addEmployeeError = '';
    if (!vm.newEmployee.name || !vm.newEmployee.mobile) {
      vm.addEmployeeError = 'Name and mobile are required.';
      return;
    }
    if (vm.dashboardTeamSize > 0 && vm.employees.length >= vm.dashboardTeamSize) {
      vm.addEmployeeError = `Employee limit reached. Your current plan allows for a maximum of ${vm.dashboardTeamSize} employees. Please update your team size in settings if you need to add more.`;
      return;
    }

    vm.addEmployeeLoading = true;
    this.employeeService.addEmployee({ ...vm.newEmployee, companyCode: vm.dashboardCode }).subscribe({
      next: (res: any) => {
        vm.addEmployeeLoading = false;
        if (res.success && res.employee) {
          vm.employees.unshift(res.employee);
          vm.closeAddEmployee();
          vm.fetchEmployeeCallRows(true);
        } else {
          vm.addEmployeeError = res.message || 'Failed to add employee.';
        }
      },
      error: (err: any) => {
        vm.addEmployeeLoading = false;
        vm.addEmployeeError = err?.error?.message || 'Server error.';
      },
    });
  }

  openEditEmployee(vm: any, emp: Employee): void {
    vm.editingEmployee = { ...emp };
    vm.isEditEmployeeOpen = true;
    vm.editEmployeeError = '';
    vm.updateScrollLock();
  }

  closeEditEmployee(vm: any): void {
    vm.isEditEmployeeOpen = false;
    vm.editEmployeeError = '';
    vm.updateScrollLock();
  }

  onEditEmployeeSubmit(vm: any, event: Event): void {
    event.preventDefault();
    if (!vm.editingEmployee._id) return;
    vm.editEmployeeLoading = true;
    vm.editEmployeeError = '';

    this.employeeService.updateEmployee(vm.editingEmployee._id, {
      name: vm.editingEmployee.name,
      mobile: vm.editingEmployee.mobile,
      countryCode: vm.editingEmployee.countryCode,
      tags: vm.editingEmployee.tags,
    }).subscribe({
      next: (res: any) => {
        vm.editEmployeeLoading = false;
        if (res.success) {
          vm.fetchEmployees();
          vm.closeEditEmployee();
        } else {
          vm.editEmployeeError = res.message;
        }
      },
      error: (err: any) => {
        vm.editEmployeeLoading = false;
        vm.editEmployeeError = err?.error?.message || 'Error updating employee.';
      },
    });
  }

  toggleEditTag(vm: any, tag: string): void {
    const idx = vm.editingEmployee.tags.indexOf(tag);
    if (idx > -1) {
      vm.editingEmployee.tags.splice(idx, 1);
    } else {
      vm.editingEmployee.tags.push(tag);
    }
  }

  enableTagEdit(vm: any, emp: Employee): void {
    event?.stopPropagation();
    vm.editTagEmpId = emp._id!;
    vm.inlineTagValue = (emp.tags && emp.tags.length > 0) ? emp.tags[0] : '';
  }

  cancelTagEdit(vm: any, event: Event): void {
    event.stopPropagation();
    vm.editTagEmpId = null;
    vm.inlineTagValue = '';
    vm.showInlineDropdown = null;
  }

  focusTagInput(vm: any, emp: Employee): void {
    vm.showInlineDropdown = emp._id!;
  }

  blurTagInput(vm: any): void {
    setTimeout(() => {
      vm.showInlineDropdown = null;
    }, 200);
  }

  getFilteredTagOptions(vm: any): string[] {
    const val = (vm.inlineTagValue || '').toLowerCase();
    return vm.tagOptions.filter((tag: string) => tag.toLowerCase().includes(val));
  }

  saveInlineTag(vm: any, emp: Employee, event?: Event): void {
    if (event) event.stopPropagation();
    if (!vm.dashboardCode) return;

    const finalTag = vm.inlineTagValue.trim();
    if (!finalTag) {
      alert('Please enter a tag name to save.');
      return;
    }

    vm.savingTag = true;
    const tagsToSave = [finalTag];

    this.employeeService.updateEmployeeTags(emp._id!, tagsToSave, vm.dashboardCode).subscribe({
      next: (res: any) => {
        vm.savingTag = false;
        if (res.success) {
          emp.tags = res.employee.tags;

          if (finalTag && !vm.tagOptions.includes(finalTag)) {
            vm.tagOptions.push(finalTag);
          }

          vm.editTagEmpId = null;
        } else {
          alert('Failed to update tag: ' + (res.message || 'Unknown error'));
        }
      },
      error: () => {
        vm.savingTag = false;
        alert('Server error updating tags.');
      },
    });
  }

  openAllCallsModal(vm: any): void {
    vm.showAllCallsModal = true;
  }

  closeAllCallsModal(vm: any): void {
    vm.showAllCallsModal = false;
  }

  closeEmployee(vm: any): void {
    vm.selectedEmployee = null;
    vm.selectedEmpStats = null;
    vm.selectedEmpCalls = [];
    vm.drilldownTab = 'stats';
    vm.dashTab = 'employees';
    vm.empLeads = [];
    vm.leadSets = [];
    vm.selectedLeadSet = '';
    vm.newLeadSetLabel = '';
    vm.showAddLeadForm = false;
    vm.leadUploadStep = 'idle';
    vm.empLeadSearchQuery = '';
    vm.empLeadSetFilter = '';
    vm.followupUploadStep = 'idle';
    if (vm.chart) {
      vm.chart.destroy();
      vm.chart = null;
    }
  }

  fetchEmpLeads(vm: any): void {
    if (!vm.selectedEmployee) return;
    vm.empLeadsLoading = true;
    const setFilter = vm.selectedLeadSet || undefined;
    this.leadService.getEmployeeLeads(vm.dashboardCode, vm.selectedEmployee.mobile, setFilter).subscribe({
      next: (res: any) => {
        vm.empLeadsLoading = false;
        if (res.success) {
          vm.empLeads = res.leads;
          vm.leadSets = res.sets || [];
          const companies = Array.from(new Set(vm.empLeads.map((lead: Lead) => lead.leadCompanyName || 'Unnamed Company')));
          if (!vm.selectedEmpLeadCompany || !companies.includes(vm.selectedEmpLeadCompany)) {
            vm.selectedEmpLeadCompany = companies[0] || '';
          }
        }
      },
      error: () => {
        vm.empLeadsLoading = false;
      },
    });
  }

  empUniqueCompanies(vm: any): string[] {
    if (!vm.empLeads) return [];
    const companies: string[] = vm.empLeads.map((lead: Lead) => lead.leadCompanyName || 'Unnamed Company');
    return [...new Set(companies)].sort();
  }

  leadsInSelectedEmpCompany(vm: any): any[] {
    if (!vm.selectedEmpLeadCompany) return [];
    return vm.empLeads.filter((lead: Lead) => (lead.leadCompanyName || 'Unnamed Company') === vm.selectedEmpLeadCompany);
  }

  getEmpLeadsByCompany(vm: any, company: string): any[] {
    if (vm.lastFilteredEmpLeadsRefForCompany !== vm.filteredEmpLeads) {
      vm.empLeadsByCompanyCache = {};
      for (const lead of vm.filteredEmpLeads) {
        const companyName = lead.leadCompanyName || 'Unnamed Company';
        if (!vm.empLeadsByCompanyCache[companyName]) {
          vm.empLeadsByCompanyCache[companyName] = [];
        }
        vm.empLeadsByCompanyCache[companyName].push(lead);
      }
      vm.lastFilteredEmpLeadsRefForCompany = vm.filteredEmpLeads;
    }
    return vm.empLeadsByCompanyCache[company] || [];
  }

  selectEmpLeadCompany(vm: any, company: string): void {
    vm.selectedEmpLeadCompany = company;
  }

  selectLeadSet(vm: any, set: string): void {
    vm.selectedLeadSet = set;
    vm.fetchEmpLeads();
  }

  deleteLeadSet(vm: any, setLabel: string): void {
    if (!confirm(`Delete ALL leads in set "${setLabel}"? This cannot be undone.`)) return;
    vm.deleteSetLoading = true;
    this.leadService.deleteLeadSet(vm.dashboardCode, vm.selectedEmployee!.mobile, setLabel).subscribe({
      next: (res: any) => {
        vm.deleteSetLoading = false;
        if (res.success) {
          if (vm.selectedLeadSet === setLabel) vm.selectedLeadSet = '';
          vm.fetchEmpLeads();
        }
      },
      error: () => { vm.deleteSetLoading = false; },
    });
  }

  trackByCallId(vm: any, index: number, call: any): any {
    return call._id || call.timestamp || index;
  }

  trackByEmpId(vm: any, index: number, emp: Employee): any {
    return emp.mobile || emp._id || index;
  }
}

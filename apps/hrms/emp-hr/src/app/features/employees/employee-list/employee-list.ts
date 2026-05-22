import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Home12Icon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, UserCircleIcon, Shield01Icon, Shield02Icon } from '@hugeicons/core-free-icons';
import { ApiService } from '../../../services/api.service';

import { EmployeeRequests } from '../employee-requests/employee-requests';
import { LeaveManagement } from '../../leaves/leave-management/leave-management';
import { EmployeeSidebar } from '../employee-sidebar/employee-sidebar';
import { OffboardingRequests } from '../../offboarding/offboarding-requests/offboarding-requests';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, RouterModule, EmployeeRequests, LeaveManagement, OffboardingRequests, HugeiconsIconComponent, EmployeeSidebar],
  templateUrl: './employee-list.html',
  styleUrl: './employee-list.css'
})
export class EmployeeList implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly Home12Icon = Home12Icon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly UserCircleIcon = UserCircleIcon;
  readonly Shield01Icon = Shield01Icon;
  readonly Shield02Icon = Shield02Icon;

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  currentTab = signal<'list' | 'leaves' | 'requests' | 'offboarding'>('list');
  employees = signal<any[]>([]);
  allEmployees = signal<any[]>([]);
  isLoading = signal(true);
  roleFilter = signal<string>('all');
  searchQuery = signal<string>('');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.currentTab.set(params['tab'] as any);
      } else {
        this.currentTab.set('list');
      }
    });
    this.fetchEmployees();
  }

  fetchEmployees() {
    this.isLoading.set(true);
    // Always fetch all approved employees to filter locally by role
    this.apiService.getAllEmployees('all', 'approved').subscribe({
      next: (data) => {
        this.allEmployees.set(data);
        this.applyFilter();
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch employees', err);
        this.isLoading.set(false);
      }
    });
  }

  applyFilter() {
    const filter = this.roleFilter();
    const query = this.searchQuery().toLowerCase();
    const all = this.allEmployees();
    
    let filtered = all;

    // First apply role filter
    if (filter === 'manager') {
      filtered = all.filter(e => e.isManager);
    } else if (filter === 'hr') {
      filtered = all.filter(e => e.isHr);
    } else if (filter === 'employee') {
      filtered = all.filter(e => !e.isManager && !e.isHr);
    }

    // Then apply search query
    if (query) {
      filtered = filtered.filter(e => 
        e.fullName?.toLowerCase().includes(query) || 
        e.EmployeeId?.toLowerCase().includes(query) ||
        e.email?.toLowerCase().includes(query)
      );
    }

    this.employees.set(filtered);
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    this.applyFilter();
  }

  setRoleFilter(role: string) {
    this.roleFilter.set(role);
    this.applyFilter();
  }

  toggleManager(emp: any) {
    this.apiService.toggleManager(emp._id).subscribe({
      next: (res) => {
        // Immutable update to trigger signal refresh
        this.employees.update(prev =>
          prev.map(e => e._id === emp._id ? { ...e, isManager: res.isManager } : e)
        );
      },
      error: (err) => {
        console.error('Failed to toggle manager status', err);
      }
    });
  }
}

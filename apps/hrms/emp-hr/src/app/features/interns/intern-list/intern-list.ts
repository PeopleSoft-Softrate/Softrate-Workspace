import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { Home01Icon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, UserCircleIcon } from '@hugeicons/core-free-icons';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InternSidebar } from '../intern-sidebar/intern-sidebar';
import { ApiService } from '../../../services/api.service';

import { InternRequests } from '../intern-requests/intern-requests';
import { LeaveManagement } from '../../leaves/leave-management/leave-management';
import { AttendanceCorrections } from '../attendance-corrections/attendance-corrections';
import { OffboardingRequests } from '../../offboarding/offboarding-requests/offboarding-requests';

@Component({
  selector: 'app-intern-list',
  standalone: true,
  imports: [CommonModule, RouterModule, InternRequests, LeaveManagement, AttendanceCorrections, OffboardingRequests, HugeiconsIconComponent, InternSidebar],
  templateUrl: './intern-list.html',
  styleUrl: './intern-list.css'
})
export class InternList implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly Home01Icon = Home01Icon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly UserCircleIcon = UserCircleIcon;

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  currentTab = signal<'list' | 'leaves' | 'requests' | 'corrections' | 'offboarding'>('list');
  interns = signal<any[]>([]);
  allInterns = signal<any[]>([]);
  isLoading = signal(true);
  statusFilter = signal<string>('all');
  rangeFilter = signal<string>('all');
  searchQuery = signal<string>('');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.currentTab.set(params['tab'] as any);
      } else {
        this.currentTab.set('list');
      }
    });
    this.fetchInterns();
  }

  fetchInterns() {
    this.isLoading.set(true);
    this.apiService.getAllActiveInterns(this.rangeFilter(), this.statusFilter()).subscribe({
      next: (data) => {
        this.allInterns.set(data);
        this.applyFilter();
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch interns', err);
        this.isLoading.set(false);
      }
    });
  }

  applyFilter() {
    const query = this.searchQuery().toLowerCase();
    const all = this.allInterns();
    
    if (!query) {
      this.interns.set(all);
      return;
    }

    const filtered = all.filter(i => 
      i.fullName?.toLowerCase().includes(query) || 
      i.internid?.toLowerCase().includes(query) ||
      i.email?.toLowerCase().includes(query)
    );
    this.interns.set(filtered);
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    this.applyFilter();
  }

  setFilter(range: string) {
    this.rangeFilter.set(range);
    this.fetchInterns();
  }

  setStatus(status: string) {
    this.statusFilter.set(status);
    this.fetchInterns();
  }

  getStatusColor(status: string): string {
    switch(status.toLowerCase()) {
      case 'approved':
      case 'accepted':
      case 'active':
        return 'status-green';
      case 'ongoing':
        return 'status-teal';
      case 'drop':
      case 'rejected':
      case 'terminated':
        return 'status-red';
      case 'pending':
      case 'initial':
        return 'status-orange';
      default:
        return 'status-gray';
    }
  }

  exportInternData() {
    const baseUrl = this.apiService.getBaseUrl();
    const userRole = localStorage.getItem('user_role');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const managerId = userRole === 'manager' ? userData._id : '';

    let url = `${baseUrl}/api/intern/export/excel?status=${this.statusFilter()}&range=${this.rangeFilter()}`;
    if (managerId) {
      url += `&managerId=${managerId}`;
    }
    window.open(url, '_blank');
  }
}

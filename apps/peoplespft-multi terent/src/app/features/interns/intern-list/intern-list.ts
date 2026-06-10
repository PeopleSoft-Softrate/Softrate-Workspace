import { Component, signal, computed, OnInit, inject } from '@angular/core';
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
import { InternRejected } from '../intern-rejected/intern-rejected';
import { UnifiedRequests } from '../../unified-requests/unified-requests';

@Component({
  selector: 'app-intern-list',
  standalone: true,
  imports: [CommonModule, RouterModule, InternRequests, LeaveManagement, AttendanceCorrections, OffboardingRequests, InternRejected, HugeiconsIconComponent, InternSidebar, UnifiedRequests],
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

  getPhotoUrl(id: string): string {
    return `${this.apiService.getBaseUrl()}/api/interns/profile-photo/${id}`;
  }

  onImageError(event: any) {
    event.target.style.display = 'none';
    if (event.target.nextElementSibling) {
      event.target.nextElementSibling.style.display = 'flex';
    }
  }

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  currentTab = signal<'list' | 'leaves' | 'requests' | 'corrections' | 'offboarding' | 'rejected'>('list');
  interns = signal<any[]>([]);
  allInterns = signal<any[]>([]);
  isLoading = signal(true);
  statusFilter = signal<string>('all');
  rangeFilter = signal<string>('current');
  searchQuery = signal<string>('');
  sortFilter = signal<string>('recent');
  roles = signal<string[]>([]);
  internRoleFilter = signal<string>('all');

  filterCounts = computed(() => {
    const all = this.allInterns();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let current = 0;
    let alumni = 0;
    
    all.forEach(i => {
      const isStatusValid = i.status === 'approved' || i.status === 'ongoing';
      let isCurrent = false;
      if (isStatusValid && i.onboardingDate) {
        const d = new Date(i.onboardingDate);
        d.setHours(0, 0, 0, 0);
        if (d <= today) isCurrent = true;
      }

      if (isCurrent) current++;
      if (i.status === 'alumni' || i.status === 'completed') alumni++;
    });

    return {
      all: all.length,
      current,
      alumni
    };
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.currentTab.set(params['tab'] as any);
      } else {
        this.currentTab.set('list');
      }
    });
    this.fetchInterns();
    this.apiService.getCompanySettings().subscribe(res => {
      if (res?.settings?.internRoles) {
        this.roles.set(res.settings.internRoles);
      }
    });
  }

  fetchInterns() {
    this.isLoading.set(true);
    const backendStatus = this.statusFilter();
    
    this.apiService.getAllActiveInterns(this.rangeFilter(), backendStatus).subscribe({
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
    let filtered = this.allInterns();
    
    const isCurrentActive = this.rangeFilter() === 'current';
    if (isCurrentActive) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(i => {
        const isStatusValid = i.status === 'approved' || i.status === 'ongoing';
        if (!isStatusValid) return false;
        
        if (!i.onboardingDate) return false;
        const onboardingDate = new Date(i.onboardingDate);
        onboardingDate.setHours(0, 0, 0, 0);
        return onboardingDate <= today;
      });
    }

    if (query) {
      filtered = filtered.filter(i => 
        i.fullName?.toLowerCase().includes(query) || 
        i.internid?.toLowerCase().includes(query) ||
        i.email?.toLowerCase().includes(query)
      );
    }
    
    const roleVal = this.internRoleFilter();
    if (roleVal !== 'all') {
      filtered = filtered.filter(i => i.role === roleVal || i.domain === roleVal);
    }

    const sortVal = this.sortFilter();
    if (sortVal === 'az') {
      filtered.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    } else if (sortVal === 'za') {
      filtered.sort((a, b) => (b.fullName || '').localeCompare(a.fullName || ''));
    } else if (sortVal === 'recent') {
      filtered.sort((a, b) => new Date(b.createdAt || b.onboardingDate || 0).getTime() - new Date(a.createdAt || a.onboardingDate || 0).getTime());
    } else if (sortVal === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt || a.onboardingDate || 0).getTime() - new Date(b.createdAt || b.onboardingDate || 0).getTime());
    }

    this.interns.set(filtered);
  }

  setSort(sort: string) {
    this.sortFilter.set(sort);
    this.applyFilter();
  }

  setInternRole(role: string) {
    this.internRoleFilter.set(role);
    this.applyFilter();
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    this.applyFilter();
  }

  setFilter(range: string) {
    this.rangeFilter.set(range);
    this.statusFilter.set('all');
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

    const backendStatus = this.statusFilter() === 'currently-active' ? 'all' : this.statusFilter();
    let url = `${baseUrl}/api/intern/export/excel?status=${backendStatus}&range=${this.rangeFilter()}`;
    if (managerId) {
      url += `&managerId=${managerId}`;
    }
    window.open(url, '_blank');
  }
}

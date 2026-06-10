import { AlertService } from '../../../shared/services/alert';
import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UserCircleIcon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, Money03Icon } from '@hugeicons/core-free-icons';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-employee-requests',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './employee-requests.html',
  styleUrl: './employee-requests.css'
})
export class EmployeeRequests implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private router = inject(Router);

  readonly UserCircleIcon = UserCircleIcon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly Money03Icon = Money03Icon;

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  
  requests = signal<any[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');
  sortFilter = signal<string>('recent');

  setSort(sort: string) {
    this.sortFilter.set(sort);
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  filteredRequests = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const all = this.requests();
    const result = all.filter(r => {
      if (!query) return true;
      return r.fullName?.toLowerCase().includes(query) || 
             r.email?.toLowerCase().includes(query) || 
             r.designation?.toLowerCase().includes(query) ||
             r.department?.toLowerCase().includes(query) ||
             r.phone?.toLowerCase().includes(query);
    });

    const sortVal = this.sortFilter();
    if (sortVal === 'az') {
      result.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    } else if (sortVal === 'za') {
      result.sort((a, b) => (b.fullName || '').localeCompare(a.fullName || ''));
    } else if (sortVal === 'recent') {
      result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sortVal === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    }
    return result;
  });

  ngOnInit() {
    this.fetchRequests();
  }

  fetchRequests() {
    this.isLoading.set(true);
    // Passing 'initial' to the active employees endpoint
    this.apiService.getAllEmployees('all', 'initial').subscribe({
      next: (data) => {
        this.requests.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch employee requests', err);
        this.isLoading.set(false);
      }
    });
  }

  async rejectRequest(id: string) {
    if (!await this.alertService.confirm('Are you sure you want to reject this application?')) return;
    
    // Perform a soft rejection by updating status
    this.apiService.updateEmployee(id, { status: 'rejected' }).subscribe({
      next: () => {
        this.requests.update((all: any[]) => all.filter((r: any) => r._id !== id));
      },
      error: (err) => {
        console.error('Failed to reject request', err);
        this.alertService.show('Failed to reject application');
      }
    });
  }
}

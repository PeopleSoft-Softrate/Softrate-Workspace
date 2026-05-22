import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-intern-requests',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './intern-requests.html',
  styleUrl: './intern-requests.css'
})
export class InternRequests implements OnInit {
  private apiService = inject(ApiService);
  
  allRequests = signal<any[]>([]);
  managers = signal<any[]>([]);
  currentCategory = signal<'Internship' | 'Job' | 'Assigned' | 'Approved' | 'Rejected'>('Internship');
  isLoading = signal(true);
  isAssigning = signal<string | null>(null);
  searchQuery = signal('');

  ngOnInit() {
    this.fetchRequests();
    this.fetchManagers();
  }

  fetchRequests() {
    this.isLoading.set(true);
    // Fetch all interns with status 'initial' (pending applications)
    this.apiService.getAllActiveInterns('all', 'initial').subscribe({
      next: (data) => {
        this.allRequests.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch intern requests', err);
        this.isLoading.set(false);
      }
    });
  }

  fetchManagers() {
    this.apiService.getManagers().subscribe(data => this.managers.set(data));
  }

  assignToManager(internId: string, managerId: string) {
    if (!managerId) return;
    this.isAssigning.set(internId);
    this.apiService.assignInternToManager(internId, managerId).subscribe({
      next: () => {
        alert('Intern assigned to manager successfully');
        this.fetchRequests(); // Refresh to show assignment status
        this.isAssigning.set(null);
      },
      error: (err) => {
        console.error('Assignment failed', err);
        alert('Failed to assign manager');
        this.isAssigning.set(null);
      }
    });
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  filteredRequests = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const category = this.currentCategory();
    const all = this.allRequests();
    
    return all.filter(r => {
      // 1. Search Logic
      const matchesSearch = !query || 
        r.fullName?.toLowerCase().includes(query) || 
        r.college?.toLowerCase().includes(query) || 
        r.department?.toLowerCase().includes(query) ||
        r.contact?.toLowerCase().includes(query) ||
        r.email?.toLowerCase().includes(query) ||
        (r.internid && r.internid.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // 2. Category filter logic
      const type = r.applicationType || 'Internship';
      const isAssigned = !!r.assignedManager;
      const managerStatus = r.managerApprovalStatus || 'pending';

      if (category === 'Assigned') {
        return isAssigned && managerStatus === 'pending';
      }
      
      if (category === 'Approved') {
        return managerStatus === 'approved';
      }

      if (category === 'Rejected') {
        return managerStatus === 'rejected';
      }

      // In Internship/Job tabs, show ONLY unassigned requests matching the type
      return !isAssigned && type === category;
    });
  });

  setCategory(category: 'Internship' | 'Job' | 'Assigned' | 'Approved' | 'Rejected') {
    this.currentCategory.set(category);
  }

  internshipCount = computed(() => this.getFilteredCountForCategory('Internship'));
  jobCount = computed(() => this.getFilteredCountForCategory('Job'));
  assignedCount = computed(() => this.getFilteredCountForCategory('Assigned'));
  approvedCount = computed(() => this.getFilteredCountForCategory('Approved'));
  rejectedCount = computed(() => this.getFilteredCountForCategory('Rejected'));

  private getFilteredCountForCategory(category: string) {
    const query = this.searchQuery().toLowerCase();
    const all = this.allRequests();
    
    return all.filter(r => {
      // Category filter
      const type = r.applicationType || 'Internship';
      const isAssigned = !!r.assignedManager;
      const managerStatus = r.managerApprovalStatus || 'pending';

      let inCategory = false;
      if (category === 'Assigned') inCategory = isAssigned && managerStatus === 'pending';
      else if (category === 'Approved') inCategory = managerStatus === 'approved';
      else if (category === 'Rejected') inCategory = managerStatus === 'rejected';
      else inCategory = !isAssigned && type === category;

      if (!inCategory) return false;

      // Search filter
      if (!query) return true;
      return r.fullName?.toLowerCase().includes(query) || 
             r.college?.toLowerCase().includes(query) || 
             r.department?.toLowerCase().includes(query) ||
             r.contact?.toLowerCase().includes(query) ||
             r.email?.toLowerCase().includes(query) ||
             (r.internid && r.internid.toLowerCase().includes(query));
    }).length;
  }

  hasSearchMatch(category: string): boolean {
    if (!this.searchQuery()) return false;
    return this.getFilteredCountForCategory(category) > 0;
  }

  rejectRequest(id: string) {
    if (!confirm('Are you sure you want to reject this application?')) return;
    
    this.apiService.deleteIntern(id).subscribe({
      next: () => {
        this.allRequests.update((all: any[]) => all.filter((r: any) => r._id !== id));
      },
      error: (err) => {
        console.error('Failed to reject request', err);
        alert('Failed to reject application');
      }
    });
  }
}

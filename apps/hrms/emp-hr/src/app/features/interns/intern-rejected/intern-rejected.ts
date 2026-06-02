import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-intern-rejected',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './intern-rejected.html',
  styleUrl: '../intern-requests/intern-requests.css'
})
export class InternRejected implements OnInit {
  private apiService = inject(ApiService);
  
  allRejected = signal<any[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');

  ngOnInit() {
    this.fetchRejected();
  }

  fetchRejected() {
    this.isLoading.set(true);
    // Fetch all interns with status 'initial' or 'rejected'. We will filter down to rejected in computed.
    this.apiService.getAllActiveInterns('all', 'initial,rejected').subscribe({
      next: (data) => {
        this.allRejected.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch rejected requests', err);
        this.isLoading.set(false);
      }
    });
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  filteredRejected = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const all = this.allRejected();
    
    return all.filter(r => {
      const isManagerRejected = r.managerApprovalStatus === 'rejected';
      const isHrRejected = r.status === 'rejected';
      
      if (!isManagerRejected && !isHrRejected) return false;

      if (!query) return true;
      return r.fullName?.toLowerCase().includes(query) || 
             r.college?.toLowerCase().includes(query) || 
             r.department?.toLowerCase().includes(query) ||
             r.email?.toLowerCase().includes(query);
    });
  });
}

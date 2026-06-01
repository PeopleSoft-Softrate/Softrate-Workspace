import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-employee-rejected',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './employee-rejected.html',
  styleUrl: '../employee-requests/employee-requests.css'
})
export class EmployeeRejected implements OnInit {
  private apiService = inject(ApiService);
  
  allRejected = signal<any[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');

  ngOnInit() {
    this.fetchRejected();
  }

  fetchRejected() {
    this.isLoading.set(true);
    // Fetch all employees with status 'rejected'
    this.apiService.getAllEmployees('all', 'rejected').subscribe({
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
      const isRejected = r.status === 'rejected';
      
      if (!isRejected) return false;

      if (!query) return true;
      return r.fullName?.toLowerCase().includes(query) || 
             r.email?.toLowerCase().includes(query) ||
             r.contact?.toLowerCase().includes(query);
    });
  });
}

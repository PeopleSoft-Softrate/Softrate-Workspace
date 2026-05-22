import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-manager-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager-assignments.html',
  styleUrls: ['./manager-assignments.css']
})
export class ManagerAssignments implements OnInit {
  private http = inject(HttpClient);
  private apiService = inject(ApiService);

  managers = signal<any[]>([]);
  unassignedInterns = signal<any[]>([]);
  unassignedEmployees = signal<any[]>([]);

  selectedManagerId = signal<string>('');
  selectedUserIds = signal<string[]>([]);
  selectedUserType = signal<'intern' | 'employee' | null>(null);

  managerSearch = signal<string>('');
  userSearch = signal<string>('');

  isLoading = signal<boolean>(true);
  isAssigning = signal<boolean>(false);
  successMessage = signal<string>('');
  errorMessage = signal<string>('');
  isHr = signal<boolean>(false);

  filteredManagers = computed(() => {
    const search = this.managerSearch().toLowerCase();
    return this.managers().filter(m => 
      m.fullName.toLowerCase().includes(search) || 
      m.department.toLowerCase().includes(search)
    );
  });

  filteredInterns = computed(() => {
    const search = this.userSearch().toLowerCase();
    return this.unassignedInterns().filter(i => 
      i.fullName.toLowerCase().includes(search) || 
      i.internid.toLowerCase().includes(search)
    );
  });

  filteredEmployees = computed(() => {
    const search = this.userSearch().toLowerCase();
    return this.unassignedEmployees().filter(e => 
      e.fullName.toLowerCase().includes(search) || 
      e.EmployeeId.toLowerCase().includes(search)
    );
  });

  ngOnInit(): void {
    const data = localStorage.getItem('user_data');
    if (data) {
      const user = JSON.parse(data);
      const role = (user.role || '').toLowerCase();
      this.isHr.set(role === 'hr' || role === 'hr_admin');
    }
    if (!this.isHr()) {
      this.isLoading.set(false);
      return;
    }
    this.fetchData();
  }

  fetchData(): void {
    this.isLoading.set(true);
    const baseUrl = this.apiService.getBaseUrl();

    // Fetch managers
    this.http.get<any[]>(`${baseUrl}/api/assignments/managers`).subscribe({
      next: (data) => {
        // Filter out HR staff from the manager list
        const nonHrManagers = data.filter(m => !m.isHr && (m.role?.toLowerCase() !== 'hr' && m.role?.toLowerCase() !== 'hr admin'));
        this.managers.set(nonHrManagers);
      },
      error: (err) => {
        console.error('Failed to load managers', err);
        this.showError('Failed to load managers. Please try again.');
      }
    });

    // Fetch unassigned users
    this.http.get<any>(`${baseUrl}/api/assignments/unassigned`).subscribe({
      next: (data) => {
        this.unassignedInterns.set(data.interns || []);
        // Filter out HR from personnel selection
        const employees = data.employees || [];
        const nonHrEmployees = employees.filter((e: any) => !e.isHr && (e.role?.toLowerCase() !== 'hr' && e.role?.toLowerCase() !== 'hr admin'));
        this.unassignedEmployees.set(nonHrEmployees);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load unassigned users', err);
        this.isLoading.set(false);
        this.showError('Failed to load users. Please try again.');
      }
    });
  }

  toggleSelection(userId: string, userType: 'intern' | 'employee'): void {
    // If switching between types, clear selection first
    if (this.selectedUserType() && this.selectedUserType() !== userType) {
      this.selectedUserIds.set([]);
    }

    this.selectedUserType.set(userType);

    const current = this.selectedUserIds();
    if (current.includes(userId)) {
      const updated = current.filter(id => id !== userId);
      this.selectedUserIds.set(updated);
      if (updated.length === 0) {
        this.selectedUserType.set(null);
      }
    } else {
      this.selectedUserIds.set([...current, userId]);
    }
  }

  isSelected(userId: string): boolean {
    return this.selectedUserIds().includes(userId);
  }

  assignToManager(): void {
    if (!this.selectedManagerId()) {
      this.showError('Please select a manager first.');
      return;
    }
    if (this.selectedUserIds().length === 0) {
      this.showError('Please select at least one user to assign.');
      return;
    }

    this.isAssigning.set(true);
    this.clearMessages();

    const payload = {
      managerId: this.selectedManagerId(),
      userIds: this.selectedUserIds(),
      userType: this.selectedUserType()
    };
    const baseUrl = this.apiService.getBaseUrl();

    this.http.post<any>(`${baseUrl}/api/assignments/assign`, payload).subscribe({
      next: (res) => {
        this.successMessage.set(res.message || 'Assignment successful!');
        this.isAssigning.set(false);
        this.resetSelections();
        this.fetchData();

        // Auto-dismiss success after 3 seconds (matches CSS progress bar animation)
        setTimeout(() => this.successMessage.set(''), 3000);
      },
      error: (err) => {
        this.showError(err.error?.error || 'Assignment failed. Please try again.');
        this.isAssigning.set(false);
      }
    });
  }

  public resetSelections(): void {
    this.selectedUserIds.set([]);
    this.selectedUserType.set(null);
    this.selectedManagerId.set('');
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    this.successMessage.set('');
    // Auto-dismiss error after 5 seconds
    setTimeout(() => this.errorMessage.set(''), 5000);
  }

  private clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }
}
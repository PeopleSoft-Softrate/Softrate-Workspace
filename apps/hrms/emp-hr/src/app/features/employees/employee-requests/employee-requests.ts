import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UserCircleIcon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, Money03Icon } from '@hugeicons/core-free-icons';
import { EmployeeSidebar } from '../employee-sidebar/employee-sidebar';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-employee-requests',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent, EmployeeSidebar],
  templateUrl: './employee-requests.html',
  styleUrl: './employee-requests.css'
})
export class EmployeeRequests implements OnInit {
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

  rejectRequest(id: string) {
    if (!confirm('Are you sure you want to reject this application?')) return;
    
    this.apiService.deleteEmployee(id).subscribe({
      next: () => {
        this.requests.update((all: any[]) => all.filter((r: any) => r._id !== id));
      },
      error: (err) => {
        console.error('Failed to reject request', err);
        alert('Failed to reject application');
      }
    });
  }
}

import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, UserCircleIcon, Share05Icon } from '@hugeicons/core-free-icons';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InternSidebar } from '../intern-sidebar/intern-sidebar';

@Component({
  selector: 'app-intern-details',
  standalone: true,
  imports: [CommonModule, RouterModule, InternSidebar, HugeiconsIconComponent],
  templateUrl: './intern-details.html',
  styleUrls: ['./intern-details.css', '../intern-list/intern-list.css'],
})
export class InternDetails implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly UserCircleIcon = UserCircleIcon;
  readonly Share05Icon = Share05Icon;

  internId = signal<string>('');
  intern = signal<any>(null);
  isLoading = signal(true);
  isConverting = signal(false);
  userRole = signal<string | null>(localStorage.getItem('user_role'));

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      // Scroll the main content area to top after navigation
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  ngOnInit() {
    this.internId.set(this.route.snapshot.paramMap.get('id') || '');
    this.fetchDetails();
  }

  fetchDetails() {
    this.isLoading.set(true);
    this.apiService.getInternById(this.internId()).subscribe({
      next: (data) => {
        console.log('Intern details received:', data);
        this.intern.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch intern details', err);
        this.isLoading.set(false);
      }
    });
  }

  getStatusColor(status: string): string {
    switch(status?.toLowerCase()) {
      case 'active': return 'status-green';
      case 'initial': return 'status-blue';
      case 'completed': return 'status-teal';
      default: return 'status-gray';
    }
  }

  canConvert(): boolean {
    const role = this.userRole()?.toLowerCase();
    const status = this.intern()?.status?.toLowerCase();
    // Managers, HR, and HR_ADMIN can convert active interns
    const isAuthorized = role === 'manager' || role === 'hr' || role === 'hr_admin';
    return isAuthorized && status !== 'completed';
  }

  canConvertToHr(): boolean {
    const role = this.userRole()?.toLowerCase();
    // Only HR_ADMIN can convert others to HR
    return role === 'hr_admin';
  }

  convertToEmployee() {
    if (!confirm('Are you sure you want to promote this intern to a full-time employee?')) return;

    this.isConverting.set(true);
    this.apiService.convertInternToEmployee(this.internId()).subscribe({
      next: () => {
        alert('Intern promoted to employee successfully!');
        this.router.navigate(['/employees']);
      },
      error: (err: any) => {
        alert('Failed to convert: ' + (err.error?.message || err.message));
        this.isConverting.set(false);
      }
    });
  }

  convertToHr() {
    if (!confirm('Convert this intern to HR? They will gain admin dashboard access.')) return;
    this.isConverting.set(true);
    this.apiService.convertToHr(this.internId()).subscribe({
      next: () => {
        alert('Intern converted to HR successfully!');
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        alert('Conversion failed: ' + (err.error?.message || err.message));
        this.isConverting.set(false);
      }
    });
  }

  editProfile() {
    this.router.navigate(['/interns/add', this.internId()], { queryParams: { edit: 'true' } });
  }
}

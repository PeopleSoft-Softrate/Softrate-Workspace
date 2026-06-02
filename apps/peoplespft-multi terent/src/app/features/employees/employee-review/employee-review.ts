import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UserCircleIcon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, Money03Icon } from '@hugeicons/core-free-icons';
import { EmployeeSidebar } from '../employee-sidebar/employee-sidebar';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-employee-review',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent, RouterModule, EmployeeSidebar],
  templateUrl: './employee-review.html',
  styleUrl: './employee-review.css'
})
export class EmployeeReview implements OnInit {
  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
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
  
  employeeId = signal<string>('');
  reviews = signal<any[]>([]);
  isLoading = signal(true);

  ngOnInit() {
    this.employeeId.set(this.route.snapshot.paramMap.get('id') || '');
    this.fetchReviews();
  }

  fetchReviews() {
    this.isLoading.set(true);
    this.apiService.getEmployeeReview(this.employeeId()).subscribe({
      next: (data: any[]) => {
        console.log('Employee reviews received:', data);
        this.reviews.set(data);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch employee reviews', err);
        this.isLoading.set(false);
      }
    });
  }

  getRatingColor(rating: number): string {
    if (rating >= 4.5) return 'status-green';
    if (rating >= 3.5) return 'status-teal';
    if (rating >= 2.5) return 'status-orange';
    return 'status-red';
  }
}

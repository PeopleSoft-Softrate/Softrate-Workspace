import { AlertService } from '../../../shared/services/alert';
import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InternSidebar } from '../intern-sidebar/intern-sidebar';

@Component({
  selector: 'app-intern-review',
  standalone: true,
  imports: [CommonModule, RouterModule, InternSidebar],
  templateUrl: './intern-review.html',
  styleUrls: ['./intern-review.css', '../intern-list/intern-list.css']
})
export class InternReview implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  internId = signal<string>('');
  reviewData = signal<any>(null);
  selectedMonth = signal<string>('');
  isLoading = signal(true);
  months = signal<string[]>([]);
  grades = signal<{ [goalId: string]: string }>({});

  ngOnInit() {
    this.internId.set(this.route.snapshot.paramMap.get('id') || '');
    this.initMonths();
    this.fetchReviews();
  }

  initMonths() {
    const now = new Date();
    if (now.getDate() <= 5) {
      now.setMonth(now.getMonth() - 1);
    }
    
    const monthList = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i);
      const month = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      monthList.push(month);
    }
    this.months.set(monthList);
    this.selectedMonth.set(monthList[0]);
  }

  onMonthChange(event: any) {
    this.selectedMonth.set(event.target.value);
    this.fetchReviews();
  }

  fetchReviews() {
    this.isLoading.set(true);
    this.apiService.getInternReview(this.internId(), this.selectedMonth()).subscribe({
      next: (res: any) => {
        console.log('Review data received:', res);
        this.reviewData.set(res.data || null);
        
        // Initialize grades dictionary
        const initialGrades: { [key: string]: string } = {};
        if (res.data && res.data.goals) {
          res.data.goals.forEach((g: any) => {
            initialGrades[g._id] = g.grade || '';
          });
        }
        this.grades.set(initialGrades);
        
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch reviews', err);
        this.reviewData.set(null);
        this.isLoading.set(false);
      }
    });
  }

  setGrade(goalId: string, grade: string) {
    if (this.reviewData()?.isGraded) return;
    this.grades.update(prev => ({
      ...prev,
      [goalId]: grade
    }));
  }

  submitGrades() {
    const goals = this.reviewData()?.goals;
    if (!goals) return;

    // Check if any goal is not graded yet
    const hasUngraded = goals.some((g: any) => !this.grades()[g._id]);
    if (hasUngraded) {
      this.alertService.show('Please select a grade for all goals before submitting.');
      return;
    }

    const payload = goals.map((g: any) => ({
      _id: g._id,
      grade: this.grades()[g._id]
    }));

    this.isLoading.set(true);
    this.apiService.gradeInternReview(this.internId(), this.selectedMonth(), payload).subscribe({
      next: (res: any) => {
        this.alertService.show('Review ratings submitted successfully!');
        this.fetchReviews();
      },
      error: (err) => {
        console.error('Failed to submit review grades:', err);
        this.alertService.show(err.error?.message || 'Failed to submit review grades. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  getGradeColor(grade: string): string {
    switch(grade) {
      case 'A': return 'status-green';
      case 'B': return 'status-teal';
      case 'C': return 'status-orange';
      case 'D': return 'status-red';
      default: return 'status-gray';
    }
  }
}

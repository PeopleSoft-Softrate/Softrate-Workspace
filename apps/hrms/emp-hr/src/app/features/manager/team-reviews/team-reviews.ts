import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-team-reviews',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './team-reviews.html',
  styleUrls: ['./team-reviews.css']
})
export class TeamReviews implements OnInit {
  interns = signal<any[]>([]);
  hasAssignedInterns = signal<boolean>(false);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  constructor(private apiService: ApiService, private router: Router) {}

  ngOnInit() {
    this.fetchTeamInterns();
  }

  fetchTeamInterns() {
    this.isLoading.set(true);
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        // Extract managerId
        const managerId = parsed._id; 
        
        if (managerId) {
          this.apiService.getManagerTeam(managerId).subscribe({
            next: (data) => {
              if (data && data.interns) {
                this.hasAssignedInterns.set(data.interns.length > 0);
                this.interns.set(data.interns.filter((intern: any) => !intern.isReviewed));
              }
              this.isLoading.set(false);
            },
            error: (err) => {
              console.error('Error fetching manager team:', err);
              this.errorMessage.set('Failed to load team assignments. Please try again.');
              this.isLoading.set(false);
            }
          });
        } else {
           this.errorMessage.set('Invalid manager context.');
           this.isLoading.set(false);
        }
      } catch (e) {
        this.errorMessage.set('Failed to parse user data.');
        this.isLoading.set(false);
      }
    } else {
      this.errorMessage.set('Not logged in.');
      this.isLoading.set(false);
    }
  }

  evaluateIntern(internId: string) {
    if (!internId) return;
    this.router.navigate(['/interns', internId, 'review']);
  }
}

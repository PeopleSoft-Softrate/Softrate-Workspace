import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InternSidebar } from '../intern-sidebar/intern-sidebar';

@Component({
  selector: 'app-intern-leaves',
  standalone: true,
  imports: [CommonModule, RouterModule, InternSidebar],
  templateUrl: './intern-leaves.html',
  styleUrls: ['./intern-leaves.css', '../intern-list/intern-list.css']
})
export class InternLeaves implements OnInit {
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
  leaves = signal<any[]>([]);
  isLoading = signal(true);

  ngOnInit() {
    this.internId.set(this.route.snapshot.paramMap.get('id') || '');
    this.fetchLeaves();
  }

  fetchLeaves() {
    console.log('Fetching leaves for internId:', this.internId());
    this.isLoading.set(true);
    this.apiService.getInternLeaves(this.internId()).subscribe({
      next: (data: any) => {
        console.log('Leaves data received:', data);
        this.leaves.set(Array.isArray(data) ? data : (data.leaves || []));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch leaves', err);
        this.isLoading.set(false);
      }
    });
  }

  getStatusColor(hrStatus: string, managerStatus: string): string {
    const hr = hrStatus?.toLowerCase();
    const mgr = managerStatus?.toLowerCase();

    if (hr === 'accepted') return 'status-green';
    if (hr === 'rejected' || mgr === 'rejected') return 'status-red';
    return 'status-orange';
  }

  getStatusLabel(hrStatus: string, managerStatus: string): string {
    const hr = hrStatus?.toLowerCase();
    const mgr = managerStatus?.toLowerCase();

    if (hr === 'accepted') return 'Approved';
    if (hr === 'rejected') return 'Rejected by HR';
    if (mgr === 'rejected') return 'Rejected by Manager';
    if (mgr === 'accepted') return 'Awaiting HR';
    return 'Awaiting Manager';
  }
}

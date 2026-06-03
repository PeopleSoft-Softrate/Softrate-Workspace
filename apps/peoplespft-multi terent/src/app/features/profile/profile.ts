import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  private apiService = inject(ApiService);

  user = signal<any>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  companyLogo = signal<string | null>(null);

  // Computed properties
  displayName = computed(() => this.user()?.fullName || 'User');
  displayRole = computed(() => this.user()?.role || 'Employee');
  displayId = computed(() => this.user()?.EmployeeId || this.user()?.internid || 'N/A');
  displayEmail = computed(() => this.user()?.email || 'N/A');
  displayPhone = computed(() => this.user()?.contact || this.user()?.phoneNumber || 'N/A');
  profilePhoto = computed(() => this.user()?.profilePhotoUrl || null);
  userInitials = computed(() => {
    const name = this.displayName();
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  });

  ngOnInit() {
    this.fetchProfile();
    this.fetchCompanySettings();
  }

  fetchProfile() {
    this.isLoading.set(true);
    this.apiService.getMe().subscribe({
      next: (res: any) => {
        if (res.success && res.user) {
          this.user.set(res.user);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load profile', err);
        this.error.set('Failed to load user profile');
        this.isLoading.set(false);
      }
    });
  }

  fetchCompanySettings() {
    this.apiService.getCompanySettings().subscribe({
      next: (res: any) => {
        if (res.success && res.settings?.communication?.emailLogoUrl) {
          this.companyLogo.set(res.settings.communication.emailLogoUrl);
        }
      }
    });
  }
}

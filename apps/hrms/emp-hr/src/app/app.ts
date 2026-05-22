import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { StudentsIcon, WorkflowSquare03Icon, DashboardSquareRemoveIcon, Settings01Icon, DiplomaIcon, DashboardSquare02Icon, DashboardSpeed01Icon, UserGroupIcon, WorkIcon, Calendar03Icon, PolicyIcon, FingerAccessIcon, CalendarCheckIn01Icon, SentIcon, Invoice01Icon } from '@hugeicons/core-free-icons';
import { ApiService } from './services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, 
    RouterLink,
    RouterLinkActive,
    CommonModule,
    HugeiconsIconComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  title = 'admin-page';
  router = inject(Router);
  readonly StudentsIcon = StudentsIcon;
  readonly WorkflowSquare03Icon = WorkflowSquare03Icon;
  readonly DashboardSquareRemoveIcon = DashboardSquareRemoveIcon;
  readonly Settings01Icon = Settings01Icon;
  readonly DiplomaIcon = DiplomaIcon;
  readonly DashboardSquare02Icon = DashboardSquare02Icon;
  readonly DashboardSpeed01Icon = DashboardSpeed01Icon;
  readonly UserGroupIcon = UserGroupIcon;
  readonly WorkIcon = WorkIcon;
  readonly Calendar03Icon = Calendar03Icon;
  readonly PolicyIcon = PolicyIcon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckIn01Icon = CalendarCheckIn01Icon;
  readonly SentIcon = SentIcon;
  readonly Invoice01Icon = Invoice01Icon;

  userRole = signal<string | null>(localStorage.getItem('user_role'));
  userName = signal<string | null>(null);
  currentUser = signal<any>(null);
  hasNotifications = signal<boolean>(false);
  notificationItems = signal<any[]>([]);
  showNotifications = signal<boolean>(false);
  showUserMenu = signal<boolean>(false);
  profilePhotoSaving = signal<boolean>(false);
  profilePhotoError = signal<string | null>(null);
  readonly profilePhotoMaxSizeMb = 2;
  apiService = inject(ApiService);

  currentUrl = signal<string>('');

  constructor() {
    this.currentUrl.set(this.router.url);
    this.router.events.subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.showNotifications.set(false);
      this.showUserMenu.set(false);
    });

    this.loadUserData();
    if (this.isHrType()) {
      this.refreshMe(); // Auto-refresh profile
      this.checkNotifications();
      // Poll every 2 minutes
      setInterval(() => this.checkNotifications(), 120000);
    }
  }

  isHrType(): boolean {
    return this.isRole('hr') || this.isRole('hr_admin');
  }

  isManager(): boolean {
    return this.isRole('manager');
  }

  isEmployee(): boolean {
    return this.isRole('employee');
  }

  isRole(roleName: string): boolean {
    const role = this.userRole()?.toLowerCase().replace(/[\s_-]/g, '');
    const target = roleName.toLowerCase().replace(/[\s_-]/g, '');
    return role === target;
  }

  toggleNotifications() {
    this.showUserMenu.set(false);
    this.showNotifications.update(v => !v);
    if (this.showNotifications()) {
      this.checkNotifications();
    }
  }

  toggleUserMenu() {
    this.showNotifications.set(false);
    this.profilePhotoError.set(null);
    this.showUserMenu.update(v => !v);
  }

  checkNotifications() {
    forkJoin({
      leaves: this.apiService.getHrPendingLeaves(),
      requests: this.apiService.getHrPendingAttendanceRequests(),
      applications: this.apiService.getAllActiveInterns('all', 'initial'),
      offboarding: this.apiService.getPendingOffboarding()
    }).subscribe({
      next: (data) => {
        const items: any[] = [];
        
        if (data.leaves) {
          data.leaves.forEach((l: any) => items.push({
            type: 'Leave Request',
            title: l.employeeName || 'Staff Member',
            desc: `${l.leaveType}: ${l.reason}`,
            link: '/employees',
            icon: 'fa-solid fa-calendar-minus',
            color: 'orange'
          }));
        }

        if (data.requests) {
          data.requests.forEach((r: any) => items.push({
            type: 'Attendance Correction',
            title: r.employeeName || 'Staff Member',
            desc: `Correction for ${new Date(r.date).toLocaleDateString()}`,
            link: '/employees',
            icon: 'fa-solid fa-clock-rotate-left',
            color: 'blue'
          }));
        }

        if (data.applications) {
          data.applications.forEach((a: any) => items.push({
            type: 'New Application',
            title: a.fullName,
            desc: `New intern application submitted`,
            link: '/interns',
            icon: 'fa-solid fa-user-plus',
            color: 'green'
          }));
        }

        if (data.offboarding) {
          data.offboarding.forEach((o: any) => items.push({
            type: 'Offboarding Request',
            title: o.internName,
            desc: `Pending HR approval for ${o.internId}`,
            link: '/offboarding',
            icon: 'fa-solid fa-user-minus',
            color: 'red'
          }));
        }

        this.notificationItems.set(items);
        this.hasNotifications.set(items.length > 0);
      },
      error: () => {
        this.hasNotifications.set(false);
        this.notificationItems.set([]);
      }
    });
  }

  loadUserData() {
    const role = localStorage.getItem('user_role');
    this.userRole.set(role);

    const data = localStorage.getItem('user_data');
    if (data) {
      try {
        const user = JSON.parse(data);
        this.setCurrentUser(user);
      } catch (e) {
        this.currentUser.set(null);
        this.userName.set('User');
      }
    } else {
      this.currentUser.set(null);
      this.userName.set('User');
    }
  }

  private setCurrentUser(user: any, persist = false) {
    this.currentUser.set(user);
    this.userName.set(this.resolveUserName(user));

    if (persist) {
      localStorage.setItem('user_data', JSON.stringify(user));
    }
  }

  private resolveUserName(user: any): string {
    const profile = user?.profile || {};
    const composedName = [
      profile.firstName || user?.firstName,
      profile.lastName || user?.lastName
    ].filter(Boolean).join(' ').trim();

    return user?.fullName
      || user?.name
      || profile.fullName
      || profile.name
      || composedName
      || 'User';
  }

  private pickUserField(keys: string[]): string | null {
    const user = this.currentUser();
    const profile = user?.profile || {};

    for (const key of keys) {
      const value = user?.[key] || profile?.[key];
      if (value) return String(value);
    }

    return null;
  }

  displayName(): string {
    return this.userName() || 'User';
  }

  userInitials(): string {
    const words = this.displayName().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'U';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }

  userPhone(): string | null {
    return this.pickUserField(['phone', 'phoneNumber', 'contact', 'mobile', 'mobileNumber']);
  }

  userCode(): string | null {
    return this.pickUserField(['employeeId', 'EmployeeId', 'internId', 'internid', 'staffId', 'code']);
  }

  roleLabel(): string {
    const role = this.userRole()?.toLowerCase();
    if (role === 'hr_admin') return 'System Admin';
    if (role === 'hr') return 'HR Manager';
    if (role === 'manager') return 'Management';

    return 'Team Member';
  }

  profilePhotoUrl(): string | null {
    const user = this.currentUser();
    const profile = user?.profile || {};
    const candidates = [
      user?.profilePhotoUrl,
      user?.profilePhoto?.url,
      profile?.avatar,
      profile?.photo,
      profile?.photoUrl,
      profile?.profilePhoto,
      user?.avatar,
      user?.avatarUrl,
      user?.photo,
      user?.photoUrl,
      user?.image,
      user?.imageUrl
    ];

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) return value;
    }

    return null;
  }

  openProfilePhotoPicker(input: HTMLInputElement, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.profilePhotoError.set(null);
    input.click();
  }

  onProfilePhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.profilePhotoError.set(null);

    if (!file.type.startsWith('image/')) {
      this.profilePhotoError.set('Choose an image file.');
      input.value = '';
      return;
    }

    if (file.size > this.profilePhotoMaxSizeMb * 1024 * 1024) {
      this.profilePhotoError.set(`Image must be ${this.profilePhotoMaxSizeMb} MB or smaller.`);
      input.value = '';
      return;
    }

    this.profilePhotoSaving.set(true);
    this.apiService.updateProfilePhoto(file).subscribe({
      next: (res: any) => {
        if (res.user) this.setCurrentUser(res.user, true);
        if (res.role) {
          localStorage.setItem('user_role', res.role);
          this.userRole.set(res.role);
        }

        this.profilePhotoSaving.set(false);
        input.value = '';
      },
      error: (err) => {
        this.profilePhotoSaving.set(false);
        this.profilePhotoError.set(err.error?.message || 'Unable to update profile photo.');
        input.value = '';
      }
    });
  }

  removeProfilePhoto() {
    if (this.profilePhotoSaving()) return;

    this.profilePhotoSaving.set(true);
    this.profilePhotoError.set(null);
    this.apiService.removeProfilePhoto().subscribe({
      next: (res: any) => {
        if (res.user) this.setCurrentUser(res.user, true);
        this.profilePhotoSaving.set(false);
      },
      error: (err) => {
        this.profilePhotoSaving.set(false);
        this.profilePhotoError.set(err.error?.message || 'Unable to remove profile photo.');
      }
    });
  }

  refreshMe() {
    this.apiService.getMe().subscribe({
      next: (res: any) => {
        if (res.success && res.user) {
          this.setCurrentUser(res.user, true);
          
          // Also sync the role from the exact backend calculation
          if (res.role) {
            localStorage.setItem('user_role', res.role);
            this.userRole.set(res.role);
          }
        }
      }
    });
  }

  isLoginPage(): boolean {
    const url = this.currentUrl().split('?')[0]; // Use signal for reactivity
    return url === '/login' || url === '/register' || url === '/';
  }

  getGreeting(): string {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  logout() {
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_data');
    this.userRole.set(null);
    this.currentUser.set(null);
    this.showUserMenu.set(false);
    this.router.navigate(['/login']);
  }
}

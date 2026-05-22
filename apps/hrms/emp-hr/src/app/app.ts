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
  hasNotifications = signal<boolean>(false);
  notificationItems = signal<any[]>([]);
  showNotifications = signal<boolean>(false);
  apiService = inject(ApiService);

  currentUrl = signal<string>('');

  constructor() {
    this.currentUrl.set(this.router.url);
    this.router.events.subscribe(() => {
      this.currentUrl.set(this.router.url);
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
    this.showNotifications.update(v => !v);
    if (this.showNotifications()) {
      this.checkNotifications();
    }
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
        // Extremely flexible name lookup
        const name = user.profile?.firstName || user.firstName || user.fullName || user.profile?.name || 'User';
        this.userName.set(name);
      } catch (e) {
        this.userName.set('User');
      }
    }
  }

  refreshMe() {
    this.apiService.getMe().subscribe({
      next: (res: any) => {
        if (res.success && res.user) {
          localStorage.setItem('user_data', JSON.stringify(res.user));
          
          // Also sync the role from the exact backend calculation
          if (res.role) {
            localStorage.setItem('user_role', res.role);
            this.userRole.set(res.role);
          }
          
          this.loadUserData();
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
    this.router.navigate(['/login']);
  }
}

import { Component, inject, signal, HostListener, ViewChild, ElementRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { StudentsIcon, WorkflowSquare03Icon, DashboardSquareRemoveIcon, Settings01Icon, DiplomaIcon, DashboardSquare02Icon, DashboardSpeed01Icon, UserGroupIcon, WorkIcon, Calendar03Icon, PolicyIcon, FingerAccessIcon, CalendarCheckIn01Icon, SentIcon, Invoice01Icon, Notification01Icon, PanelLeftCloseIcon, PanelLeftOpenIcon, UserAccountIcon, Logout02Icon, LicenseDraftIcon, Delete01Icon } from '@hugeicons/core-free-icons';
import { forkJoin } from 'rxjs';
import { Alert } from './shared/components/alert/alert';
import { AlertService } from './shared/services/alert';
import { ApiService } from './services/api.service';
import { GlobalSearch } from './shared/components/global-search/global-search';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, 
    RouterLink,
    RouterLinkActive,
    CommonModule,
    FormsModule,
    HugeiconsIconComponent,
    Alert,
    GlobalSearch
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  @ViewChild('profileMenuWrapper') profileMenuWrapper!: ElementRef;
  @ViewChild('notificationWrapper') notificationWrapper!: ElementRef;
  @ViewChild('notificationDropdown') notificationDropdown!: ElementRef;
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
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckIn01Icon = CalendarCheckIn01Icon;
  readonly SentIcon = SentIcon;
  readonly Invoice01Icon = Invoice01Icon;
  readonly Notification01Icon = Notification01Icon;
  readonly PanelLeftCloseIcon = PanelLeftCloseIcon;
  readonly PanelLeftOpenIcon = PanelLeftOpenIcon;
  readonly UserAccountIcon = UserAccountIcon;
  readonly Logout02Icon = Logout02Icon;
  readonly Delete01Icon = Delete01Icon;

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
  alertService = inject(AlertService);

  currentUrl = signal<string>('');
  isSidebarMinimized = signal<boolean>(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.showUserMenu() && this.profileMenuWrapper && !this.profileMenuWrapper.nativeElement.contains(event.target)) {
      this.showUserMenu.set(false);
    }
    
    if (this.showNotifications()) {
      const clickedInsideWrapper = this.notificationWrapper?.nativeElement.contains(event.target);
      const clickedInsideDropdown = this.notificationDropdown?.nativeElement.contains(event.target);
      if (!clickedInsideWrapper && !clickedInsideDropdown) {
        this.showNotifications.set(false);
      }
    }
  }

  @HostListener('document:input', ['$event'])
  onGlobalInput(event: Event) {
    const target = event.target as HTMLElement;
    if (target && target.tagName.toLowerCase() === 'textarea') {
      target.style.height = 'auto';
      target.style.height = target.scrollHeight + 'px';
    }
  }

  constructor() {
    this.currentUrl.set(this.router.url);
    this.router.events.subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.showNotifications.set(false);
      this.showUserMenu.set(false);
    });

    this.loadUserData();
    this.refreshMe(); // Always fetch fresh profile including photo
    if (this.isHrType()) {
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

  toggleSidebar() {
    this.isSidebarMinimized.update(v => !v);
  }

  showBroadcastModal = signal(false);
  isBroadcasting = signal(false);
  broadcastData = {
    title: '',
    description: '',
    sendToEmployees: true,
    sendToInterns: true
  };

  openBroadcastModal() {
    this.showNotifications.set(false);
    this.showBroadcastModal.set(true);
    this.broadcastData = { title: '', description: '', sendToEmployees: true, sendToInterns: true };
  }

  closeBroadcastModal() {
    this.showBroadcastModal.set(false);
  }

  submitBroadcast() {
    let targetAudience: 'employee' | 'intern' | 'all' = 'all';
    if (this.broadcastData.sendToEmployees && !this.broadcastData.sendToInterns) targetAudience = 'employee';
    if (!this.broadcastData.sendToEmployees && this.broadcastData.sendToInterns) targetAudience = 'intern';
    if (this.broadcastData.sendToEmployees && this.broadcastData.sendToInterns) targetAudience = 'all';

    this.isBroadcasting.set(true);
    this.apiService.createGeneralNotification({
      title: this.broadcastData.title,
      description: this.broadcastData.description,
      targetAudience
    }).subscribe({
      next: () => {
        this.isBroadcasting.set(false);
        this.closeBroadcastModal();
        this.alertService.show('Notification broadcasted successfully!', 'success');
        this.checkNotifications();
      },
      error: (err: any) => {
        console.error(err);
        this.isBroadcasting.set(false);
        this.alertService.show('Failed to send broadcast', 'error');
      }
    });
  }

  checkNotifications() {
    if (this.isEmployee() && !this.isManager() && !this.isHrType()) {
      const employeeId = this.currentUser()?._id || this.currentUser()?.id;
      if (!employeeId) return;

      forkJoin({
        myLeaves: this.apiService.getEmployeeLeaves(employeeId),
        myFunds: this.apiService.getEmployeeFundRequests(employeeId),
        general: this.apiService.getGeneralNotifications(this.isRole('intern') ? 'intern' : 'employee')
      }).subscribe({
        next: (data) => this.processNotificationData(data),
        error: () => {
          this.hasNotifications.set(false);
          this.notificationItems.set([]);
        }
      });
      return;
    }

    if (this.isHrType()) {
      forkJoin({
        leaves: this.apiService.getHrPendingLeaves(),
        requests: this.apiService.getHrPendingAttendanceRequests(),
        applications: this.apiService.getAllActiveInterns('all', 'initial'),
        offboarding: this.apiService.getPendingOffboarding(),
        general: this.apiService.getGeneralNotifications('hr')
      }).subscribe({
        next: (data) => this.processNotificationData(data),
        error: () => {
          this.hasNotifications.set(false);
          this.notificationItems.set([]);
        }
      });
    } else if (this.isManager()) {
      const managerId = this.currentUser()?._id || this.currentUser()?.id;
      if (!managerId) return;

      forkJoin({
        leaves: this.apiService.getManagerPendingLeaves(managerId),
        requests: this.apiService.getManagerPendingAttendanceRequests(managerId),
        offboarding: this.apiService.getManagerPendingOffboarding(managerId),
        general: this.apiService.getGeneralNotifications('employee')
      }).subscribe({
        next: (data) => this.processNotificationData(data),
        error: () => {
          this.hasNotifications.set(false);
          this.notificationItems.set([]);
        }
      });
    }
  }

  private processNotificationData(data: any) {
    const items: any[] = [];
    
    if (data.myLeaves) {
      const getLeaveStatus = (l: any) => {
        if (l.hrStatus === 'rejected' || l.managerStatus === 'rejected') return 'Rejected';
        if (l.hrStatus === 'accepted') return 'Approved';
        if (l.managerStatus === 'accepted') return 'Manager Approved';
        return 'Pending';
      };

      const recentLeaves = data.myLeaves.filter((l: any) => getLeaveStatus(l) !== 'Pending');
      recentLeaves.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
      recentLeaves.slice(0, 5).forEach((l: any) => {
        const s = getLeaveStatus(l);
        items.push({
          type: 'Leave Update',
          title: `Leave ${s}`,
          desc: `${l.leaveType || 'Leave'}`,
          link: '/employee/leaves',
          isSvg: true,
          icon: 'leave',
          color: s === 'Approved' || s === 'Manager Approved' ? 'green' : 'red',
          timestamp: l.updatedAt || l.createdAt || l.date
        });
      });
    }

    if (data.myFunds) {
      const getFundStatus = (f: any) => {
        if (f.hrStatus === 'rejected' || f.managerStatus === 'rejected') return 'Rejected';
        if (f.hrStatus === 'accepted') return 'Approved';
        if (f.managerStatus === 'accepted') return 'Manager Approved';
        return 'Pending';
      };

      const recentFunds = data.myFunds.filter((f: any) => getFundStatus(f) !== 'Pending');
      recentFunds.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
      recentFunds.slice(0, 5).forEach((f: any) => {
        const s = getFundStatus(f);
        items.push({
          type: 'Reimbursement',
          title: `Reimbursement ${s}`,
          desc: `${f.expenseType || f.title || f.category || 'Expense request'}`,
          link: '/employee/unified-requests',
          icon: 'fa-solid fa-money-bill-transfer',
          color: s === 'Approved' || s === 'Manager Approved' ? 'green' : 'red',
          timestamp: f.updatedAt || f.createdAt || f.date
        });
      });
    }

    if (data.leaves) {
      data.leaves.forEach((l: any) => items.push({
        type: 'Leave Request',
        title: l.employeeName || 'Staff Member',
        desc: `${l.leaveType}: ${l.reason}`,
        link: '/employees',
        isSvg: true,
        icon: 'leave',
        color: 'orange',
        timestamp: l.createdAt || l.date
      }));
    }

    if (data.requests) {
      data.requests.forEach((r: any) => items.push({
        type: 'Attendance Correction',
        title: r.employeeName || r.internName || 'Staff Member',
        desc: `Correction for ${new Date(r.date).toLocaleDateString()}`,
        link: '/employees',
        icon: 'fa-solid fa-clock-rotate-left',
        color: 'blue',
        timestamp: r.createdAt || r.date
      }));
    }

    if (data.applications) {
      data.applications.forEach((a: any) => items.push({
        type: 'New Application',
        title: a.fullName,
        desc: `New intern application submitted`,
        link: '/interns',
        icon: 'fa-solid fa-user-plus',
        color: 'green',
        timestamp: a.createdAt
      }));
    }

    if (data.offboarding) {
      data.offboarding.forEach((o: any) => items.push({
        type: 'Offboarding Request',
        title: o.internName || o.employeeName || 'Staff Member',
        desc: `Pending approval for ${o.internId || o.employeeId || 'Exit'}`,
        link: '/offboarding',
        icon: 'fa-solid fa-user-minus',
        color: 'red',
        timestamp: o.createdAt || o.date
      }));
    }

    if (data.general && data.general.success && data.general.notifications) {
      data.general.notifications.forEach((n: any) => items.push({
        type: 'General Announcement',
        title: n.title,
        desc: n.description,
        link: '', // No specific link
        icon: 'fa-solid fa-bullhorn',
        color: 'teal',
        timestamp: n.createdAt
      }));
    }

    // Sort all notifications by time
    items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    this.notificationItems.set(items);
    this.hasNotifications.set(items.length > 0);
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
    return words[0][0].toUpperCase();
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
      user?.profilePhotoUrl,          // Direct field from login/getMe response
      user?.profilePhoto?.url,        // Nested object with url
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
      if (typeof value === 'string' && value.trim() && !value.startsWith('null')) return value;
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
    return url === '/login' || url === '/register' || url === '/' || url.startsWith('/id-card');
  }

  getGreeting(): string {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  formatTimeAgo(dateInput: string | Date | undefined): string {
    if (!dateInput) return 'Just now';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Just now';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  logout() {
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_data');
    localStorage.removeItem('auth_token');
    this.userRole.set(null);
    this.currentUser.set(null);
    this.showUserMenu.set(false);
    this.router.navigate(['/login']);
  }
}

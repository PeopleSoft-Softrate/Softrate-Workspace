import { AlertService } from '../../../shared/services/alert';
import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { 
  Calendar01Icon,
  CalendarCheckOut01Icon,
  FingerAccessIcon,
  UserCircleIcon,
  StudentsIcon,
  WorkflowSquare03Icon,
  Home01Icon,
  Chat01Icon,
  PlusSignIcon,
  Delete01Icon,
  FilterIcon,
  Money03Icon,
  LicenseDraftIcon,
  File02Icon,
  Clock01Icon,
  CalendarCheckIn01Icon,
  SentIcon,
  Invoice01Icon,
  AssignmentsIcon,
  Linkedin01Icon,
  Mail01Icon,
  CallIcon
} from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './employee-dashboard.html',
  styleUrl: './employee-dashboard.css'
})
export class EmployeeDashboard implements OnInit {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  
  // Icons
  readonly Calendar01Icon = Calendar01Icon;
  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly UserCircleIcon = UserCircleIcon;
  readonly StudentsIcon = StudentsIcon;
  readonly WorkflowSquare03Icon = WorkflowSquare03Icon;
  readonly Home01Icon = Home01Icon;
  readonly Chat01Icon = Chat01Icon;
  readonly PlusSignIcon = PlusSignIcon;
  readonly Delete01Icon = Delete01Icon;
  readonly FilterIcon = FilterIcon;
  readonly Money03Icon = Money03Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly File02Icon = File02Icon;
  readonly Clock01Icon = Clock01Icon;
  readonly CalendarCheckIn01Icon = CalendarCheckIn01Icon;
  readonly SentIcon = SentIcon;
  readonly Invoice01Icon = Invoice01Icon;
  readonly AssignmentsIcon = AssignmentsIcon;
  readonly Linkedin01Icon = Linkedin01Icon;
  readonly Mail01Icon = Mail01Icon;
  readonly CallIcon = CallIcon;

  employeeData = signal<any>(null);
  currentTime = signal(new Date());
  pendingTeamRequests = signal<any[]>([]);
  urgentProject = signal<any>(null);

  // Real-time Dashboard Stats signals
  monthlyAttendance = signal<string>('0%');
  attendanceSubtitle = signal<string>('0 days present');
  leavesAvailable = signal<string>('0 Days');
  leavesSubtitle = signal<string>('Casual & Sick');
  activeTasksCount = signal<string>('00');
  tasksSubtitle = signal<string>('0 active projects');

  isManager = computed(() => this.employeeData()?.isManager === true);

  ngOnInit() {
    const data = localStorage.getItem('user_data');
    if (data) {
      const parsedData = JSON.parse(data);
      this.employeeData.set(parsedData);
      
      const empId = parsedData.EmployeeId || parsedData.internid;
      const mongoId = parsedData._id;

      this.fetchAttendanceStats(empId);
      this.fetchLeaveStats(empId);
      this.fetchProjectStats(mongoId);

      if (parsedData.isManager) {
        this.fetchTeamRequests();
      }
    }

    // Update clock
    setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  fetchAttendanceStats(empId: string) {
    if (!empId) return;
    this.apiService.getEmployeeAttendance(empId).subscribe({
      next: (res: any) => {
        const attendanceList = res.attendance || res.data || (Array.isArray(res) ? res : []);
        if (attendanceList.length === 0) {
          this.monthlyAttendance.set('0%');
          this.attendanceSubtitle.set('No records this month');
          return;
        }

        const now = new Date();
        const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
        const currentYearStr = String(now.getFullYear());

        // Filter current month safely without timezone issue
        const currentMonthRecords = attendanceList.filter((record: any) => {
          if (!record.date) return false;
          const parts = record.date.split('-');
          return parts[0] === currentYearStr && parts[1] === currentMonthStr;
        });

        const presentDays = currentMonthRecords.filter((record: any) => record.punchInTime).length;
        const passedDays = now.getDate();

        const rate = passedDays > 0 ? Math.round((presentDays / passedDays) * 100) : 0;
        this.monthlyAttendance.set(`${Math.min(rate, 100)}%`);
        this.attendanceSubtitle.set(`${presentDays} of ${passedDays} days present`);
      },
      error: (err) => console.error('Failed to fetch attendance stats', err)
    });
  }

  fetchLeaveStats(empId: string) {
    if (!empId) return;
    this.apiService.getEmployeeLeaveBalance(empId).subscribe({
      next: (res: any) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const balances = res.data;
          const totalBalance = balances.reduce((sum: number, b: any) => sum + (b.balance || 0), 0);
          this.leavesAvailable.set(`${totalBalance} Days`);
          
          const casual = balances.find((b: any) => b.leaveType === 'Casual Leave')?.balance || 0;
          const sick = balances.find((b: any) => b.leaveType === 'Sick Leave')?.balance || 0;
          this.leavesSubtitle.set(`Casual: ${casual} | Sick: ${sick}`);
        } else {
          // Fallback for Interns (2 days per month limit) or missing balance record
          this.apiService.getEmployeeLeaves(empId).subscribe({
            next: (leaves: any[]) => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              const usedThisMonth = leaves.filter((l: any) => {
                const leaveDate = new Date(l.fromDate);
                return leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear && l.hrStatus !== 'rejected';
              }).reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
              
              const available = Math.max(0, 2 - usedThisMonth);
              this.leavesAvailable.set(`${available} Days`);
              this.leavesSubtitle.set(`Used this month: ${usedThisMonth}`);
            },
            error: () => {
              this.leavesAvailable.set('12 Days');
              this.leavesSubtitle.set('Casual & Sick');
            }
          });
        }
      },
      error: (err) => console.error('Failed to fetch leave stats', err)
    });
  }

  fetchProjectStats(mongoId: string) {
    if (!mongoId) return;
    this.apiService.getEmployeeProjects(mongoId).subscribe({
      next: (res: any) => {
        if (res.success && Array.isArray(res.projects)) {
          const inProgress = res.projects.filter((p: any) => p.status === 'In Progress');
          
          let incompleteTasks = 0;
          inProgress.forEach((p: any) => {
            if (Array.isArray(p.checklist)) {
              incompleteTasks += p.checklist.filter((t: any) => !t.isCompleted).length;
            }
          });

          const countStr = String(incompleteTasks).padStart(2, '0');
          this.activeTasksCount.set(countStr);
          this.tasksSubtitle.set(`${inProgress.length} active project${inProgress.length !== 1 ? 's' : ''}`);

          // Determine the most urgent active task (closest/earliest deadline)
          if (inProgress.length > 0) {
            const getDeadlineTime = (proj: any): number => {
              if (!proj.deadline) return Infinity;
              const d = proj.deadline.$date || proj.deadline;
              return new Date(d).getTime();
            };
            const sorted = [...inProgress].sort((a, b) => getDeadlineTime(a) - getDeadlineTime(b));
            this.urgentProject.set(sorted[0]);
          } else {
            this.urgentProject.set(null);
          }
        } else {
          this.activeTasksCount.set('00');
          this.tasksSubtitle.set('0 active projects');
          this.urgentProject.set(null);
        }
      },
      error: (err) => {
        console.error('Failed to fetch project stats', err);
        this.activeTasksCount.set('00');
        this.tasksSubtitle.set('0 active projects');
        this.urgentProject.set(null);
      }
    });
  }

  fetchTeamRequests() {
    this.apiService.getAssignedInterns(this.employeeData()._id).subscribe({
      next: (data) => {
        // Filter only those that haven't been reviewed by this manager yet
        this.pendingTeamRequests.set(data.filter(r => r.managerApprovalStatus === 'pending'));
      },
      error: (err) => console.error('Failed to fetch team requests', err)
    });
  }

  reviewRequest(internId: string, status: 'approved' | 'rejected') {
    const remarks = prompt(`Enter remarks for ${status}:`) || '';
    this.apiService.managerReviewIntern(internId, status, remarks).subscribe({
      next: () => {
        this.alertService.show(`Request ${status} successfully`);
        this.fetchTeamRequests();
      },
      error: (err) => this.alertService.show('Action failed')
    });
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  getProjectDeadline(project: any): Date | null {
    if (!project || !project.deadline) return null;
    const d = project.deadline.$date || project.deadline;
    return new Date(d);
  }

  getPhotoUrl(id: string): string {
    const token = localStorage.getItem('auth_token') || '';
    return `${this.apiService.getBaseUrl()}/api/employee/profile-photo/${id}?token=${token}`;
  }

  getInternPhotoUrl(id: string): string {
    const token = localStorage.getItem('auth_token') || '';
    return `${this.apiService.getBaseUrl()}/api/intern/profile-photo/${id}?token=${token}`;
  }

  onImageError(event: any) {
    event.target.style.display = 'none';
    if (event.target.nextElementSibling) {
      event.target.nextElementSibling.style.display = 'flex';
    }
  }
}

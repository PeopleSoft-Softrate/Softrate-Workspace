import { AlertService } from '../../../shared/services/alert';
import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
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
  private sanitizer  = inject(DomSanitizer);
  
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

  isLoading = signal<boolean>(true);
  employeeData = signal<any>(null);
  currentTime = signal(new Date());
  pendingTeamRequests = signal<any[]>([]);
  urgentProject = signal<any>(null);

  companyLogo = signal<string | null>(null);
  qrCodeUrl = signal<string | null>(null);
  virtualIdTemplate = signal<any>(null);

  // Real-time Dashboard Stats signals
  monthlyAttendance = signal<string>('0%');
  attendanceSubtitle = signal<string>('0 days present');
  performanceScore = signal<string>('0.0');
  performanceSubtitle = signal<string>('No review yet');
  
  // Timer signals
  todayPunchInTime = signal<Date | null>(null);
  todayPunchOutTime = signal<Date | null>(null);
  timerDisplay = signal<string>('00:00:00');
  timerStatus = signal<string>('Please Punch In');

  isManager = computed(() => this.employeeData()?.isManager === true);

  // Trend Chart signals
  workDuration = signal<number>(8);
  chartType = signal<'bar' | 'line'>('line');
  showDayFilter = signal<boolean>(false);
  hiddenDays = signal<string[]>([]);
  
  employeeTrend = signal<any[]>([
    { day: 'Mon', count: 100, height: 100 },
    { day: 'Tue', count: 100, height: 100 },
    { day: 'Wed', count: 100, height: 100 },
    { day: 'Thu', count: 100, height: 100 },
    { day: 'Fri', count: 100, height: 100 },
    { day: 'Sat', count: 0, height: 5 },
    { day: 'Sun', count: 0, height: 5 }
  ]);
  
  employeePrevTrend = signal<any[]>([
    { day: 'Mon', count: 100, height: 100 },
    { day: 'Tue', count: 100, height: 100 },
    { day: 'Wed', count: 100, height: 100 },
    { day: 'Thu', count: 100, height: 100 },
    { day: 'Fri', count: 100, height: 100 },
    { day: 'Sat', count: 0, height: 5 },
    { day: 'Sun', count: 0, height: 5 }
  ]);

  setChartType(type: 'bar' | 'line') {
    this.chartType.set(type);
  }

  toggleDay(day: string) {
    this.hiddenDays.update(days => {
      return days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    });
  }

  getFullWeekday(dayObj: any): string {
    const map: any = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
    return map[dayObj.day] || dayObj.day;
  }

  getFilteredTrend(trendArray: any[]) {
    if (!trendArray) return [];
    return trendArray.filter(t => !this.hiddenDays().includes(t.day));
  }

  getSmoothLinePath(trend: any[] | undefined): string {
    if (!trend || trend.length === 0) return '';
    let path = '';
    const points = trend.map((day, index) => {
      const x = trend.length > 1 ? (index / (trend.length - 1)) * 100 : 50;
      return {
        x: x,
        y: 100 - (day.height || 0)
      };
    });
    
    points.forEach((point, i) => {
      if (i === 0) {
        path += `M ${point.x} ${point.y} `;
      } else {
        const prev = points[i - 1];
        const cp1x = prev.x + (point.x - prev.x) / 2;
        const cp1y = prev.y;
        const cp2x = prev.x + (point.x - prev.x) / 2;
        const cp2y = point.y;
        path += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y} `;
      }
    });
    return path;
  }

  getAreaPath(trend: any[] | undefined): string {
    if (!trend || trend.length === 0) return '';
    const linePath = this.getSmoothLinePath(trend);
    return `${linePath} L 100 100 L 0 100 Z`;
  }

  // ── Custom VID template renderer ─────────────────────────────────────────────
  vidPage = computed(() => {
    const t = this.virtualIdTemplate();
    return t?.pages?.[0] ?? null;
  });

  readonly VID_CANVAS_W = 595;
  readonly VID_CARD_W   = 340;
  get vidScale() { return this.VID_CARD_W / this.VID_CANVAS_W; }
  get vidCardH()  { return Math.round(842 * this.vidScale); }

  vidBgStyle(page: any): SafeStyle {
    if (!page?.backgroundUrl) return '';
    return this.sanitizer.bypassSecurityTrustStyle(`url('${page.backgroundUrl}')`);
  }

  readonly IMAGE_KEYS = ['logo', 'signature', 'qrCode', 'profilePhoto'];
  isVidImageKey(key: string) { return this.IMAGE_KEYS.includes(key); }

  resolveVidValue(key: string): string {
    const u = this.employeeData();
    switch (key) {
      case 'fullName':       return u?.fullName || 'Employee';
      case 'internId':
      case 'EmployeeId':     return u?.EmployeeId || u?.internid || '';
      case 'role':           return u?.role || 'Employee';
      case 'email':          return u?.email || '';
      case 'department':     return u?.department || u?.departmentId?.name || '';
      case 'college':        return u?.college || '';
      case 'onboardingDate': return u?.onboardingDate ? new Date(u.onboardingDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';
      case 'endDate':        return u?.endDate       ? new Date(u.endDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';
      case 'todayDate':      return new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      case 'logo':           return this.companyLogo() || '';
      case 'qrCode':         return this.qrCodeUrl()   || '';
      case 'profilePhoto':   return this.getPhotoUrl(u?._id || u?.internid) || '';
      default:               return u?.[key] || '';
    }
  }

  resolveVidParagraph(text: string): string {
    if (!text) return '';
    return text.replace(/\{\{([^}]+)\}\}/g, (_, k) => this.resolveVidValue(k.trim()));
  }

  private _buildQrCode(user: any) {
    const origin    = typeof window !== 'undefined' ? window.location.origin : 'https://peoplesoft.softrateglobal.com';
    const companyId = user.companyId?._id || user.companyId || '';
    const userId    = user.EmployeeId || user.internid || user.employeeId || user._id || '';
    if (companyId && userId) {
      const vidUrl = `${origin}/hrms/id-card/${companyId}/${userId}`;
      this.qrCodeUrl.set(`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(vidUrl)}`);
    }
  }

  ngOnInit() {
    const data = localStorage.getItem('user_data');
    if (data) {
      const parsedData = JSON.parse(data);
      this.employeeData.set(parsedData);
      
      const empId = parsedData.EmployeeId || parsedData.internid;
      const mongoId = parsedData._id;

      this._buildQrCode(parsedData);

      this.pendingRequests = 3 + (parsedData.isManager ? 1 : 0);

      this.apiService.getCompanySettings().subscribe({
        next: (res: any) => {
          if (res?.success) {
            if (res.settings?.communication?.emailLogoUrl) {
              this.companyLogo.set(res.settings.communication.emailLogoUrl);
            }
            const tmpl = res.offerLetterSettings?.documentTemplates?.virtualIdCard;
            if (tmpl?.pages?.some((p: any) => p.backgroundUrl || p.placeholders?.length || p.paragraphs?.length)) {
              this.virtualIdTemplate.set(tmpl);
            }
          }

          if (res && res.settings && res.settings.workDurationSettings) {
             const wds = res.settings.workDurationSettings;
             const role = parsedData.role?.toLowerCase() || '';
             let duration = 8;
             if (parsedData.isHr) duration = wds.hr || 8;
             else if (parsedData.isManager) duration = wds.manager || 8;
             else if (parsedData.internid || role.includes('intern')) duration = wds.intern || 6;
             else duration = wds.employee || 8;
             this.workDuration.set(duration);
          }
          this.fetchAttendanceStats(empId);
        },
        error: () => {
          this.fetchAttendanceStats(empId);
        }
      });

      this.fetchPerformanceStats(empId);
      this.fetchProjectStats(mongoId);

      if (parsedData.isManager) {
        this.fetchTeamRequests();
      }
    }

    // Update clock and timer
    setInterval(() => {
      this.currentTime.set(new Date());
      this.updateTimer();
    }, 1000);
  }

  private pendingRequests = 0;
  
  private requestFinished() {
    this.pendingRequests--;
    if (this.pendingRequests <= 0) {
      this.isLoading.set(false);
    }
  }

  updateTimer() {
    const punchIn = this.todayPunchInTime();
    const punchOut = this.todayPunchOutTime();
    
    if (!punchIn) {
      this.timerDisplay.set('00:00:00');
      this.timerStatus.set('Please Punch In');
      return;
    }
    
    const endTime = punchOut ? punchOut.getTime() : new Date().getTime();
    const diff = Math.max(0, endTime - punchIn.getTime());
    
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    
    this.timerDisplay.set(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    
    if (punchOut) {
      this.timerStatus.set('Punched Out');
    } else {
      this.timerStatus.set('Punched In');
    }
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
        
        // Extract today's punch in/out times
        const todayStr = `${currentYearStr}-${currentMonthStr}-${String(now.getDate()).padStart(2, '0')}`;
        const todayRecord = attendanceList.find((r: any) => r.date === todayStr);
        if (todayRecord && todayRecord.punchInTime) {
          this.todayPunchInTime.set(new Date(todayRecord.punchInTime));
          if (todayRecord.punchOutTime) {
            this.todayPunchOutTime.set(new Date(todayRecord.punchOutTime));
          } else {
            this.todayPunchOutTime.set(null);
          }
        } else {
          this.todayPunchInTime.set(null);
          this.todayPunchOutTime.set(null);
        }
        this.updateTimer();

        // Calculate and set actual weekly trends
        const currentWeekTrend = this.calculateWeekTrend(attendanceList, 0);
        const prevWeekTrend = this.calculateWeekTrend(attendanceList, 1);
        this.employeeTrend.set(currentWeekTrend);
        this.employeePrevTrend.set(prevWeekTrend);
        this.requestFinished();
      },
      error: (err) => {
        console.error('Failed to fetch attendance stats', err);
        this.requestFinished();
      }
    });
  }

  calculateWeekTrend(attendanceList: any[], weeksAgo: number): any[] {
    const trend = [];
    const now = new Date();
    
    // The last day in the chart should be today (or exactly 'weeksAgo' weeks ago from today)
    const lastDayDate = new Date(now);
    lastDayDate.setDate(now.getDate() - (weeksAgo * 7));
    lastDayDate.setHours(0, 0, 0, 0);

    const firstDayDate = new Date(lastDayDate);
    firstDayDate.setDate(lastDayDate.getDate() - 6);

    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const requiredHours = this.workDuration() || 8;
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDayDate);
      d.setDate(firstDayDate.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const record = attendanceList.find((r: any) => r.date === dateStr);
      let count = 0;
      let height = 5;
      
      if (record && record.punchInTime) {
        count = 100;
        height = 100;
        
        // Detailed hour calculation based on company work duration
        if (record.punchOutTime) {
          const inTime = new Date(record.punchInTime).getTime();
          const outTime = new Date(record.punchOutTime).getTime();
          const hours = (outTime - inTime) / 3600000;
          count = Math.min(Math.round((hours / requiredHours) * 100), 100);
          height = Math.max(count, 5);
        }
      }
      
      trend.push({
        day: daysMap[d.getDay()],
        count: count,
        height: height
      });
    }
    
    return trend;
  }

  fetchPerformanceStats(empId: string) {
    if (!empId) return;
    this.apiService.getEmployeeReview(empId).subscribe({
      next: (res: any[]) => {
        if (res && res.length > 0) {
          const latest = res.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())[0];
          this.performanceScore.set(Number(latest.rating || 0).toFixed(1));
          
          const monthName = latest.date ? new Date(latest.date).toLocaleString('default', { month: 'long' }) : 'last month';
          this.performanceSubtitle.set(`Score for ${monthName}`);
        } else {
          this.performanceScore.set('--');
          this.performanceSubtitle.set('No records found');
        }
        this.requestFinished();
      },
      error: (err) => {
        console.error('Failed to fetch performance stats', err);
        this.requestFinished();
      }
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
          this.urgentProject.set(null);
        }
        this.requestFinished();
      },
      error: (err) => {
        console.error('Failed to fetch project stats', err);
        this.urgentProject.set(null);
        this.requestFinished();
      }
    });
  }

  fetchTeamRequests() {
    this.apiService.getAssignedInterns(this.employeeData()._id).subscribe({
      next: (data) => {
        // Filter only those that haven't been reviewed by this manager yet
        this.pendingTeamRequests.set(data.filter((r: any) => r.managerApprovalStatus === 'pending'));
        this.requestFinished();
      },
      error: (err) => {
        console.error('Failed to fetch team requests', err);
        this.requestFinished();
      }
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

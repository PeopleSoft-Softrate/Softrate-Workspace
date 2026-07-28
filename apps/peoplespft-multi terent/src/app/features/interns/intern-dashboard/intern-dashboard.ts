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
  CallIcon,
  Login03Icon,
  Logout03Icon,
  ChartHistogramIcon,
  Comment01Icon,
  Shield02Icon,
  Building03Icon,
  Wallet01Icon,
  TaskDone01Icon,
  Notification03Icon
} from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-intern-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './intern-dashboard.html',
  styleUrl: './intern-dashboard.css'
})
export class InternDashboard implements OnInit {
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
  readonly Login03Icon = Login03Icon;
  readonly Logout03Icon = Logout03Icon;
  readonly ChartHistogramIcon = ChartHistogramIcon;
  readonly Comment01Icon = Comment01Icon;
  readonly Shield02Icon = Shield02Icon;
  readonly Building03Icon = Building03Icon;
  readonly Wallet01Icon = Wallet01Icon;
  readonly TaskDone01Icon = TaskDone01Icon;
  readonly Notification03Icon = Notification03Icon;

  isLoading = signal<boolean>(true);
  internData = signal<any>(null);
  
  // Punch logic
  punchLoading = signal<boolean>(false);
  todayRecord = signal<any>(null);
  currentTime = signal<Date>(new Date());
  private clockInterval: any;
  pendingTeamRequests = signal<any[]>([]);
  urgentProject = signal<any>(null);
  
  isTodayHoliday = signal<boolean>(false);
  holidayReason = signal<string | null>(null);
  myResignation = signal<any>(null);
  resignationLoading = signal<boolean>(false);

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


  // Trend Chart signals
  workDuration = signal<number>(6);
  chartType = signal<'bar' | 'line'>('bar');
  showDayFilter = signal<boolean>(false);
  hiddenDays = signal<string[]>([]);
  
  internTrend = signal<any[]>([
    { day: 'Mon', count: 100, height: 100 },
    { day: 'Tue', count: 100, height: 100 },
    { day: 'Wed', count: 100, height: 100 },
    { day: 'Thu', count: 100, height: 100 },
    { day: 'Fri', count: 100, height: 100 },
    { day: 'Sat', count: 0, height: 5 },
    { day: 'Sun', count: 0, height: 5 }
  ]);
  
  internPrevTrend = signal<any[]>([
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
    const u = this.internData();
    switch (key) {
      case 'fullName':       return u?.fullName || 'Intern';
      case 'internId':
      case 'EmployeeId':     return u?.internid || u?.EmployeeId || '';
      case 'role':           return u?.role || 'Intern';
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
    const userId    = user.internid || user.employeeId || user._id || '';
    if (companyId && userId) {
      const vidUrl = `${origin}/hrms/id-card/${companyId}/${userId}`;
      this.qrCodeUrl.set(`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(vidUrl)}`);
    }
  }

  ngOnInit() {
    this.clockInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem('user_data');
      if (data && data !== 'undefined' && data !== 'null') {
        try {
          const parsedData = JSON.parse(data);
          this.internData.set(parsedData);
          
          this.fetchTodayAttendance(parsedData._id);
      
      const empId = parsedData.internid || parsedData.EmployeeId;
      const mongoId = parsedData._id;

      const loaded = this.loadFromCache(empId || mongoId);
      if (loaded) {
        this.isLoading.set(false);
      }

      this._buildQrCode(parsedData);

      this.pendingRequests = 3;

      this.checkTodayHoliday();
      this.fetchMyResignation(mongoId);

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
             const duration = wds.intern || 6;
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
        } catch (e) {
          console.warn('Error reading user_data in ngOnInit:', e);
        }
      }
    }

    // Update clock and timer
    setInterval(() => {
      this.currentTime.set(new Date());
      this.updateTimer();
    }, 1000);
  }

  saveToCache(empId: string) {
    if (!empId || typeof localStorage === 'undefined') return;
    try {
      const cacheData = {
        monthlyAttendance: this.monthlyAttendance(),
        attendanceSubtitle: this.attendanceSubtitle(),
        performanceScore: this.performanceScore(),
        performanceSubtitle: this.performanceSubtitle(),
        workDuration: this.workDuration(),
        companyLogo: this.companyLogo(),
        myResignation: this.myResignation(),
        todayPunchInTime: this.todayPunchInTime() ? this.todayPunchInTime()!.toISOString() : null,
        todayPunchOutTime: this.todayPunchOutTime() ? this.todayPunchOutTime()!.toISOString() : null,
        timestamp: Date.now()
      };
      localStorage.setItem('intern_dashboard_cache_' + empId, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Could not save dashboard cache:', e);
    }
  }

  loadFromCache(empId: string): boolean {
    if (!empId || typeof localStorage === 'undefined') return false;
    try {
      const cachedStr = localStorage.getItem('intern_dashboard_cache_' + empId);
      if (!cachedStr || cachedStr === 'undefined' || cachedStr === 'null') return false;
      const cache = JSON.parse(cachedStr);
      if (cache.monthlyAttendance !== undefined) this.monthlyAttendance.set(cache.monthlyAttendance);
      if (cache.attendanceSubtitle !== undefined) this.attendanceSubtitle.set(cache.attendanceSubtitle);
      if (cache.performanceScore !== undefined) this.performanceScore.set(cache.performanceScore);
      if (cache.performanceSubtitle !== undefined) this.performanceSubtitle.set(cache.performanceSubtitle);
      if (cache.workDuration !== undefined) this.workDuration.set(cache.workDuration);
      if (cache.companyLogo !== undefined) this.companyLogo.set(cache.companyLogo);
      if (cache.myResignation !== undefined) this.myResignation.set(cache.myResignation);
      if (cache.todayPunchInTime) this.todayPunchInTime.set(new Date(cache.todayPunchInTime));
      if (cache.todayPunchOutTime) this.todayPunchOutTime.set(new Date(cache.todayPunchOutTime));
      
      this.isLoading.set(false);
      this.updateTimer();
      return true;
    } catch (e) {
      console.warn('Could not load dashboard cache:', e);
      return false;
    }
  }

  private pendingRequests = 0;
  
  private requestFinished() {
    this.pendingRequests--;
    if (this.pendingRequests <= 0) {
      this.isLoading.set(false);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem('user_data');
        if (data && data !== 'undefined' && data !== 'null') {
          const parsedData = JSON.parse(data);
          const empId = parsedData.internid || parsedData.EmployeeId || parsedData._id;
          if (empId) {
            this.saveToCache(empId);
          }
        }
      }
    } catch (e) {
      console.warn('Error saving dashboard cache in requestFinished:', e);
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
    
    this.timerDisplay.set(`${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} m ${String(s).padStart(2, '0')} s`);
    
    if (punchOut) {
      this.timerStatus.set('Punched Out');
    } else {
      this.timerStatus.set('Punched In');
    }
  }

  fetchAttendanceStats(empId: string) {
    if (!empId) return;
    this.apiService.getInternAttendance(empId).subscribe({
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
        this.internTrend.set(currentWeekTrend);
        this.internPrevTrend.set(prevWeekTrend);
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

  // ── API Fetchers ───────────────────────────────────────────────────────
  checkTodayHoliday() {
    this.apiService.checkTodayHoliday().subscribe({
      next: (res) => {
        this.isTodayHoliday.set(res?.isHoliday || false);
        this.holidayReason.set(res?.reason || null);
      },
      error: (err) => console.error('Failed to check holiday', err)
    });
  }

  fetchMyResignation(internId: string) {
    this.resignationLoading.set(true);
    this.apiService.getInternResignation(internId).subscribe({
      next: (res) => {
        if (res && res.success && res.resignation) {
          this.myResignation.set(res.resignation);
        }
        this.resignationLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch resignation', err);
        this.resignationLoading.set(false);
      }
    });
  }

  // ── Punch Logic ────────────────────────────────────────────────────────
  fetchTodayAttendance(internId: string) {
    this.apiService.getInternTodayAttendance(internId).subscribe({
      next: (res) => {
        this.todayRecord.set(res?.record || null);
      },
      error: (err) => {
        console.error('Failed to fetch today record', err);
      }
    });
  }

  punchIn() {
    if (this.isTodayHoliday()) {
      this.alertService.show(`Cannot punch in - Today is holiday: ${this.holidayReason()}`);
      return;
    }

    this.punchLoading.set(true);
    const internId = this.internData()?.internid || this.internData()?.EmployeeId || this.internData()?._id;
    const executePunch = (loc: string) => {
      this.apiService.internPunchIn(internId, loc).subscribe({
        next: (res) => {
          this.alertService.show('Punched in successfully!');
          this.fetchTodayAttendance(internId);
          this.todayPunchInTime.set(new Date());
          this.punchLoading.set(false);
        },
        error: (err) => {
          this.alertService.show(err.error?.message || 'Failed to punch in');
          this.punchLoading.set(false);
        }
      });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executePunch(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => executePunch('')
      );
    } else {
      executePunch('');
    }
  }

  punchOut() {
    if (this.isTodayHoliday()) {
      this.alertService.show(`Cannot punch out - Today is holiday: ${this.holidayReason()}`);
      return;
    }

    const intern = this.internData();
    const internshipType = intern?.internshipType?.toString().toLowerCase() || '';

    if (this.todayPunchInTime()) {
      const diffMinutes = Math.floor((new Date().getTime() - this.todayPunchInTime()!.getTime()) / 60000);
      
      if (internshipType === 'stipend') {
        const requiredMinutes = (this.workDuration() || 6) * 60;
        if (diffMinutes < requiredMinutes) {
          const remaining = requiredMinutes - diffMinutes;
          const h = Math.floor(remaining / 60);
          const m = remaining % 60;
          const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
          this.alertService.show(`Cannot punch out yet. Required time remaining: ${timeStr}`);
          return;
        }
      } else {
        if (diffMinutes < 5) {
          this.alertService.show('Too early! Minimum 5 minutes required.');
          return;
        }
      }
    }

    this.punchLoading.set(true);
    const internId = this.internData()?.internid || this.internData()?.EmployeeId || this.internData()?._id;
    const executePunch = (loc: string) => {
      this.apiService.internPunchOut(internId, loc).subscribe({
        next: (res) => {
          this.alertService.show('Punched out successfully!');
          this.fetchTodayAttendance(internId);
          this.todayPunchOutTime.set(new Date());
          this.punchLoading.set(false);
        },
        error: (err) => {
          this.alertService.show(err.error?.message || 'Failed to punch out');
          this.punchLoading.set(false);
        }
      });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => executePunch(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => executePunch('')
      );
    } else {
      executePunch('');
    }
  }

  ngOnDestroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }
}

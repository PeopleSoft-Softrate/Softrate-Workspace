import { AlertService } from '../../../shared/services/alert';
import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UserCircleIcon, FingerAccessIcon, CalendarCheckOut01Icon, LicenseDraftIcon, Money03Icon, Location01Icon, FileDownloadIcon, SmartPhone02Icon, Edit02Icon } from '@hugeicons/core-free-icons';
import { EmployeeSidebar } from '../employee-sidebar/employee-sidebar';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-employee-attendance',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent, RouterModule, EmployeeSidebar, FormsModule],
  templateUrl: './employee-attendance.html',
  styleUrl: './employee-attendance.css'
})
export class EmployeeAttendance implements OnInit, OnDestroy {
  private alertService = inject(AlertService);

  private apiService = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  goBack() {
    this.location.back();
  }

  readonly UserCircleIcon = UserCircleIcon;
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly CalendarCheckOut01Icon = CalendarCheckOut01Icon;
  readonly LicenseDraftIcon = LicenseDraftIcon;
  readonly Money03Icon = Money03Icon;
  readonly Location01Icon = Location01Icon;
  readonly FileDownloadIcon = FileDownloadIcon;
  readonly SmartPhone02Icon = SmartPhone02Icon;
  readonly Edit02Icon = Edit02Icon;

  // Ratification Modal State
  showRatificationModal = signal(false);
  selectedRatificationRecord = signal<any>(null);
  newPunchIn = signal('');
  newPunchOut = signal('');
  correctionReason = signal('');
  isSubmitting = signal(false);

  // Mobile Accordion State
  expandedRecordDate = signal<string | null>(null);

  toggleExpand(date: string) {
    if (this.expandedRecordDate() === date) {
      this.expandedRecordDate.set(null);
    } else {
      this.expandedRecordDate.set(date);
    }
  }

  employeeId = signal<string>('');
  attendance = signal<any[]>([]);
  isLoading = signal(true);
  
  // Portal Punch Variables
  isSelfPortal = signal<boolean>(false);
  todayRecord = signal<any>(null);
  punchLoading = signal<boolean>(false);
  currentTime = signal<Date>(new Date());
  private clockInterval: any;

  // Filter Variables
  filterType = signal<string>('all');
  selectedMonth = signal<string>('');
  startDate = signal<string>('');
  endDate = signal<string>('');
  selectedDate = signal<string>('');

  filteredAttendance = computed(() => {
    const list = this.attendance();
    const type = this.filterType();

    if (type === 'all') {
      return list;
    }

    return list.filter(record => {
      if (!record.date) return false;
      const recDate = new Date(record.date);
      
      if (type === 'month') {
        const selMonth = this.selectedMonth(); // e.g. "2026-05"
        if (!selMonth) return true;
        const [year, month] = selMonth.split('-');
        return recDate.getFullYear() === parseInt(year) && (recDate.getMonth() + 1) === parseInt(month);
      }

      if (type === 'range') {
        const start = this.startDate();
        const end = this.endDate();
        if (!start || !end) return true;
        
        const sDate = new Date(start);
        sDate.setHours(0,0,0,0);
        const eDate = new Date(end);
        eDate.setHours(23,59,59,999);
        
        return recDate >= sDate && recDate <= eDate;
      }

      if (type === 'date') {
        const selDateStr = this.selectedDate(); // e.g. "2026-05-18"
        if (!selDateStr) return true;
        
        const selDate = new Date(selDateStr);
        return recDate.getFullYear() === selDate.getFullYear() &&
               recDate.getMonth() === selDate.getMonth() &&
               recDate.getDate() === selDate.getDate();
      }

      return true;
    });
  });

  resetFilters() {
    this.filterType.set('all');
    this.selectedMonth.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.selectedDate.set('');
  }

  exportAttendance() {
    const from = prompt('Enter start date (YYYY-MM-DD):', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const to = prompt('Enter end date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    
    if (!from || !to) return;

    const url = `${this.apiService.getBaseUrl()}/api/employeeAttanance/export/pdf/employee/${this.employeeId()}?from=${from}&to=${to}`;
    
    this.apiService.downloadFile(url).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `Attendance_${this.employeeId()}.pdf`;
        link.click();
      },
      error: (err) => console.error('Export failed', err)
    });
  }

  openMap(locationStr: string) {
    if (locationStr) {
      window.open(`https://www.google.com/maps?q=${locationStr}`, '_blank');
    } else {
      this.alertService.show('Location not available for this record');
    }
  }

  navigateTo(path: string[]) {
    this.router.navigate(path).then(() => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  ngOnInit() {
    const isSelf = this.router.url.includes('/employee/attendance') || this.router.url.includes('/intern/attendance');
    this.isSelfPortal.set(isSelf);

    let id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      const data = localStorage.getItem('user_data');
      if (data) {
        const parsedData = JSON.parse(data);
        id = parsedData.EmployeeId || parsedData.internid || '';
      }
    }
    this.employeeId.set(id || '');

    this.fetchAttendance();

    if (isSelf) {
      this.fetchTodayAttendance();
      this.clockInterval = setInterval(() => {
        this.currentTime.set(new Date());
      }, 1000);
    }
  }

  ngOnDestroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  fetchTodayAttendance() {
    this.apiService.getEmployeeTodayAttendance(this.employeeId()).subscribe({
      next: (res: any) => {
        console.log('Today record status:', res);
        this.todayRecord.set(res?.record || null);
      },
      error: (err) => {
        console.error('Failed to fetch today record', err);
      }
    });
  }

  fetchAttendance() {
    this.isLoading.set(true);
    this.apiService.getEmployeeAttendance(this.employeeId()).subscribe({
      next: (data: any) => {
        console.log('Employee attendance data received:', data);
        this.attendance.set(data.attendance || data.data || (Array.isArray(data) ? data : []));
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch employee attendance', err);
        this.isLoading.set(false);
      }
    });
  }

  punchIn() {
    this.punchLoading.set(true);
    const executePunch = (loc: string) => {
      this.apiService.employeePunchIn(this.employeeId(), loc).subscribe({
        next: (res) => {
          this.alertService.show('Punched in successfully!');
          this.fetchTodayAttendance();
          this.fetchAttendance();
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
    this.punchLoading.set(true);
    const executePunch = (loc: string) => {
      this.apiService.employeePunchOut(this.employeeId(), loc).subscribe({
        next: (res) => {
          this.alertService.show('Punched out successfully!');
          this.fetchTodayAttendance();
          this.fetchAttendance();
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

  formatTimeDisplay(dateStr: string | null | undefined): string {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getStatusColor(status: string): string {
    switch(status?.toLowerCase()) {
      case 'present': return 'status-green';
      case 'absent': return 'status-red';
      case 'on leave': return 'status-orange';
      case 'active': return 'status-teal';
      default: return 'status-gray';
    }
  }

  // --- Ratification Methods ---
  openRatification(record: any) {
    this.selectedRatificationRecord.set(record);
    this.newPunchIn.set('');
    this.newPunchOut.set('');
    this.correctionReason.set('');
    this.showRatificationModal.set(true);
  }

  closeRatification() {
    this.showRatificationModal.set(false);
    this.selectedRatificationRecord.set(null);
  }

  formatTimeForApi(timeStr: string, baseDate: string): string {
    if (!timeStr) return '';
    const dateObj = new Date(baseDate);
    const [hours, minutes] = timeStr.split(':').map(Number);
    dateObj.setHours(hours, minutes, 0, 0);
    return dateObj.toISOString();
  }

  submitRatification() {
    if (!this.correctionReason().trim()) {
      this.alertService.show('Please provide a reason');
      return;
    }

    if (!this.newPunchIn() && !this.newPunchOut()) {
      this.alertService.show('Please select at least one new time');
      return;
    }

    const record = this.selectedRatificationRecord();
    if (!record) return;

    this.isSubmitting.set(true);
    const payload = {
      employeeMongoId: this.employeeId(),
      date: record.date,
      requestedPunchIn: this.newPunchIn() ? this.formatTimeForApi(this.newPunchIn(), record.date) : null,
      requestedPunchOut: this.newPunchOut() ? this.formatTimeForApi(this.newPunchOut(), record.date) : null,
      reason: this.correctionReason().trim()
    };

    this.apiService.applyAttendanceCorrection(payload).subscribe({
      next: () => {
        this.alertService.show('Correction request sent to your Manager');
        this.closeRatification();
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.alertService.show(err.error?.message || 'Failed to send request');
        this.isSubmitting.set(false);
      }
    });
  }
}

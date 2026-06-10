import { Component, signal, OnInit, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';
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
  AnalyticsUpIcon,
  AnalyticsDownIcon,
  UserGroupIcon
} from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HugeiconsIconComponent, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private apiService = inject(ApiService);
  private socketService = inject(SocketService);
  private router = inject(Router);

  navigateTo(path: string[], queryParams?: any) {
    this.router.navigate(path, { queryParams });
  }
  
  selectedModel = signal<'interns' | 'employees'>('interns');
  chartType = signal<'bar' | 'line' | 'pie'>('bar');
  isLoading = signal(true);

  // Intersection Observer properties
  @ViewChild('summaryRow') summaryRow!: ElementRef;
  isSummaryInView = signal(false);
  private observer: IntersectionObserver | null = null;
  private hasAnimatedSummary = false;

  // Animated counter signals
  animAvgPresent = signal(0);
  animAvgAbsent = signal(0);

  stats = signal<any>({
    interns: [],
    employees: []
  });

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
  readonly AnalyticsUpIcon = AnalyticsUpIcon;
  readonly AnalyticsDownIcon = AnalyticsDownIcon;
  readonly UserGroupIcon = UserGroupIcon;

  currentTime = signal<Date>(new Date());
  searchQuery = signal('');
  showSearchDropdown = signal(false);

  appFeatures = [
    { name: 'Dashboard', link: '/dashboard' },
    { name: 'Today Attendance', link: '/attendance/today' },
    { name: 'Approvals Hub', link: '/approvals' },
    { name: 'Onboarding', link: '/onboarding' },
    { name: 'Interns Management', link: '/interns' },
    { name: 'Employees Management', link: '/employees' },
    { name: 'Leave Management', link: '/leaves' },
    { name: 'Off-boarding', link: '/offboarding' },
    { name: 'Projects', link: '/projects' },
    { name: 'Settings', link: '/app-settings' }
  ];

  filteredFeatures() {
    const query = this.searchQuery().toLowerCase();
    if (!query) return [];
    return this.appFeatures.filter(f => f.name.toLowerCase().includes(query));
  }

  onSearch(event: any) {
    this.searchQuery.set(event.target.value);
  }

  hideSearchDropdown() {
    setTimeout(() => {
      this.showSearchDropdown.set(false);
    }, 150);
  }

  ngOnInit() {
    this.fetchStats();
    this.setupLiveUpdates();
    setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  ngAfterViewInit() {
    this.setupIntersectionObserver();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAnimatedSummary) {
          this.isSummaryInView.set(true);
          this.hasAnimatedSummary = true;
          this.runSummaryCounters();
        }
      });
    }, { threshold: 0.2 });

    if (this.summaryRow) {
      this.observer.observe(this.summaryRow.nativeElement);
    }
  }

  fetchStats() {
    this.isLoading.set(true);
    this.apiService.getDashboardStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.isLoading.set(false);
        // Counters will be triggered by intersection observer now
        // But reset the state so it can animate if already in view
        this.hasAnimatedSummary = false;
        if (this.isSummaryInView()) {
          setTimeout(() => this.runSummaryCounters(), 100);
        }
      },
      error: (err) => {
        console.error('Failed to fetch stats', err);
        this.isLoading.set(false);
      }
    });
  }

  runSummaryCounters() {
    const summary = this.selectedModel() === 'interns'
      ? this.stats().internSummary
      : this.stats().employeeSummary;
    if (!summary) return;
    const present = Number(String(summary.avgPresent || '0').replace('%', '')) || 0;
    const absent  = Number(String(summary.avgAbsent  || '0').replace('%', '')) || 0;
    this.countUp(this.animAvgPresent, present, 900,  0);
    this.countUp(this.animAvgAbsent,  absent,  900, 150);
  }

  countUp(sig: ReturnType<typeof signal<number>>, target: number, duration: number, delay: number) {
    sig.set(0);
    setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        sig.set(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
  }

  getLinePath(trend: any[] | undefined): string {
    if (!trend || trend.length === 0) return '';
    let path = '';
    trend.forEach((day, index) => {
      const x = (index + 0.5) * (100 / 7);
      const y = 100 - (day.height || 0); // Y is inverted in SVG
      if (index === 0) {
        path += `M ${x} ${y} `;
      } else {
        path += `L ${x} ${y} `;
      }
    });
    return path;
  }

  getSmoothLinePath(trend: any[] | undefined): string {
    if (!trend || trend.length === 0) return '';
    let path = '';
    const points = trend.map((day, index) => ({
      x: (index + 0.5) * (100 / 7),
      y: 100 - (day.height || 0)
    }));
    
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
    const lastX = (trend.length - 0.5) * (100 / 7);
    const firstX = 0.5 * (100 / 7);
    return `${linePath} L ${lastX} 100 L ${firstX} 100 Z`;
  }

  getGaugePercentage(): number {
    const summary = this.selectedModel() === 'interns' ? this.stats().internSummary : this.stats().employeeSummary;
    if (!summary || !summary.avgPresent) return 0;
    const present = String(summary.avgPresent).replace('%', '');
    return Number(present) || 0;
  }

  selectModel(model: 'interns' | 'employees') {
    this.selectedModel.set(model);
    this.hasAnimatedSummary = false;
    this.isSummaryInView.set(false);
    // Restart animation flow
    if (this.summaryRow && this.observer) {
      this.observer.unobserve(this.summaryRow.nativeElement);
      setTimeout(() => {
        this.observer!.observe(this.summaryRow.nativeElement);
      }, 50);
    }
  }

  setChartType(type: 'bar' | 'line' | 'pie') {
    this.chartType.set(type);
  }

  setupLiveUpdates() {
    this.socketService.on('activity-updated').subscribe((event: any) => {
      let newActivity = null;

      if (event.type === 'new_intern' && event.intern) {
        newActivity = {
          title: event.intern.fullName,
          initials: event.intern.fullName?.[0] || 'I',
          description: `Applied for ${event.intern.role || 'Internship'}`,
          time: 'Just now',
          badge: 'New Intern',
          badgeColor: 'blue',
          color: 'blue'
        };
      } else if (event.type === 'new_leave' && event.leave) {
        newActivity = {
          title: event.leave.employeeName || 'Staff',
          initials: (event.leave.employeeName || 'S')[0] || 'S',
          description: `Requested ${event.leave.leaveType || 'Leave'}`,
          time: 'Just now',
          badge: 'Pending',
          badgeColor: 'orange',
          color: 'orange'
        };
      }

      if (newActivity) {
        // Prepend the new activity directly into the state
        this.stats.update(current => {
          const activities = [newActivity, ...(current.activities || [])].slice(0, 20);
          return { ...current, activities };
        });
      }
    });
  }
}

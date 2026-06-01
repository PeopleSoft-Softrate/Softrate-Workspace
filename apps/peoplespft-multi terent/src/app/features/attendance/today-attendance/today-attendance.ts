import { Component, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { SocketService } from '../../../services/socket.service';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { 
  FingerAccessIcon, 
  ArrowLeft01Icon,
  FilterIcon,
  Search01Icon,
  Location01Icon
} from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-today-attendance',
  standalone: true,
  imports: [CommonModule, RouterModule, HugeiconsIconComponent],
  templateUrl: './today-attendance.html',
  styleUrls: ['./today-attendance.css']
})
export class TodayAttendance implements OnInit {
  private apiService = inject(ApiService);
  private socketService = inject(SocketService);
  
  attendance = signal<any[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');
  
  userRole = signal<string>('');
  userId = signal<string>('');

  // Icons
  readonly FingerAccessIcon = FingerAccessIcon;
  readonly ArrowLeft01Icon = ArrowLeft01Icon;
  readonly FilterIcon = FilterIcon;
  readonly Search01Icon = Search01Icon;
  readonly Location01Icon = Location01Icon;

  filteredAttendance = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const all = this.attendance();
    if (!query) return all;
    
    return all.filter(a => 
      a.name.toLowerCase().includes(query) || 
      a.id.toLowerCase().includes(query) || 
      a.department?.toLowerCase().includes(query)
    );
  });

  presentCount = computed(() => this.attendance().filter(a => a.status === 'Present').length);
  absentCount = computed(() => this.attendance().filter(a => a.status === 'Absent').length);

  ngOnInit() {
    this.fetchUserAndData();
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socketService.on('punch-event').subscribe((data: any) => {
      // Re-fetch everything for accuracy or update single record?
      // Re-fetching is safer for complex aggregations
      this.fetchAttendance();
    });
  }

  fetchUserAndData() {
    this.isLoading.set(true);
    this.apiService.getMe().subscribe({
      next: (data) => {
        const user = data.user;
        const role = user.isManager ? 'manager' : (user.role?.toLowerCase() || '');
        this.userRole.set(role);
        this.userId.set(user._id || '');
        this.fetchAttendance();
      },
      error: (err) => {
        console.error('Failed to fetch user', err);
        this.isLoading.set(false);
      }
    });
  }

  fetchAttendance() {
    const isManager = this.userRole() === 'manager';
    const managerId = isManager ? this.userId() : undefined;

    this.apiService.getTodayUnifiedAttendance(managerId).subscribe({
      next: (data) => {
        this.attendance.set(data.attendance || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch attendance', err);
        this.isLoading.set(false);
      }
    });
  }

  getStatusColor(status: string): string {
    return status === 'Present' ? 'status-green' : 'status-red';
  }

  onSearch(event: any) {
    this.searchQuery.set(event.target.value);
  }

  openMap(location: string | undefined) {
    if (!location || location === 'No location data') return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    window.open(url, '_blank');
  }
}

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

interface ActivityItem {
  _id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  activityDate: Date;
  status: string;
  leadId: string;
  companyName?: string;
  contactName?: string;
  clientName?: string;
  leadName?: string;
  companyCode?: string;
}

@Component({
  selector: 'app-activities-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activities-calendar.component.html',
  styleUrls: ['./activities-calendar.component.css']
})
export class ActivitiesCalendarComponent implements OnInit, OnChanges {
  @Input() employee: any;
  @Input() allLeads: any[] = [];
  @Input() filterCompanyId?: string;
  @Input() filterCompanyName?: string;
  @Input() embedded = false;
  @Input() hiddenMode = false;
  
  @Output() activityClicked = new EventEmitter<{leadId: string, section: string}>();

  activitiesSubTab: 'calendar' | 'tasks' | 'meetings' | 'calls' = 'calendar';
  calendarView: 'month' | 'week' | 'day' = 'month';
  currentCalendarDate = new Date();
  activitiesFilter = {
    tasks: true,
    meetings: true,
    calls: true
  };
  
  mockActivities: ActivityItem[] = [];
  
  showActivityModal = false;
  selectedActivityDate: Date = new Date();
  
  get activityDateString(): string {
    if (!this.selectedActivityDate) return '';
    const d = this.selectedActivityDate;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  set activityDateString(value: string) {
    if (value) {
      const [year, month, day] = value.split('-').map(Number);
      this.selectedActivityDate = new Date(year, month - 1, day);
    }
  }
  activityForm = {
    type: 'task' as 'task' | 'meeting' | 'call',
    title: '',
    description: '',
    time: '10:00',
    leadId: ''
  };
  
  activityClientSearchQuery = '';
  showActivityClientDropdown = false;

  calendarDays: Array<{ 
    date: Date; 
    isCurrentMonth: boolean; 
    isToday: boolean;
    isPast: boolean;
    events: any[];
    taskCount: number; 
    meetingCount: number; 
    callCount: number; 
  }> = [];

  onActivityClick(ev: any) {
    if (ev.type === 'task') this.activitiesSubTab = 'tasks';
    else if (ev.type === 'meeting') this.activitiesSubTab = 'meetings';
    else if (ev.type === 'call') this.activitiesSubTab = 'calls';
  }

  onOverflowClick() {
    this.activitiesSubTab = 'tasks';
  }

  ngOnInit() {
    this.generateCalendarDays();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['filterCompanyId'] || changes['employee']) {
      this.generateCalendarDays();
    }
  }

  get filteredModalClients() {
    let baseLeads = this.allLeads;
    if (this.filterCompanyId) {
      baseLeads = this.allLeads.filter(l => l._id === this.filterCompanyId);
    }

    if (!this.activityClientSearchQuery) return baseLeads;
    const lowerQuery = this.activityClientSearchQuery.toLowerCase();
    return baseLeads.filter(l => 
      l.leadCompanyName?.toLowerCase().includes(lowerQuery) || 
      l.contactName?.toLowerCase().includes(lowerQuery)
    );
  }

  selectActivityClient(lead: any) {
    this.activityForm.leadId = lead._id;
    this.activityClientSearchQuery = `${lead.leadCompanyName} (${lead.contactName})`;
    this.showActivityClientDropdown = false;
  }

  @Input() searchQuery: string = '';

  get activitiesForCurrentTab(): any[] {
    if (this.activitiesSubTab === 'calendar') return [];
    
    const typeMapping: Record<string, string> = {
      'tasks': 'task',
      'meetings': 'meeting',
      'calls': 'call'
    };
    const filterType = typeMapping[this.activitiesSubTab];
    
    let filtered = this.mockActivities.filter(a => a.type === filterType);
    
    if (this.searchQuery?.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(a => 
        (a.companyName && a.companyName.toLowerCase().includes(query)) ||
        (a.clientName && a.clientName.toLowerCase().includes(query)) ||
        (a.contactName && a.contactName.toLowerCase().includes(query)) ||
        (a.title && a.title.toLowerCase().includes(query)) ||
        (a.description && a.description.toLowerCase().includes(query))
      );
    }
    
    return filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  filterEvents(events: any[]): any[] {
    if (!events) return [];
    return events.filter(ev => 
      (ev.type === 'task' && this.activitiesFilter.tasks) ||
      (ev.type === 'meeting' && this.activitiesFilter.meetings) ||
      (ev.type === 'call' && this.activitiesFilter.calls)
    );
  }

  async generateCalendarDays() {
    if (this.employee?._id) {
      try {
        let fetchStart: Date;
        let fetchEnd: Date;
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();

        if (this.calendarView === 'month') {
          const firstDay = new Date(year, month, 1);
          const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
          const prevMonthLastDay = new Date(year, month, 0).getDate();
          fetchStart = new Date(year, month - 1, prevMonthLastDay - startingDayOfWeek + 1);
          
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const remainingSlots = 42 - (startingDayOfWeek + daysInMonth);
          fetchEnd = new Date(year, month + 1, remainingSlots);
        } else if (this.calendarView === 'week') {
          const date = new Date(this.currentCalendarDate);
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1);
          fetchStart = new Date(date.setDate(diff));
          fetchEnd = new Date(fetchStart);
          fetchEnd.setDate(fetchStart.getDate() + 6);
        } else {
          fetchStart = new Date(this.currentCalendarDate);
          fetchEnd = new Date(this.currentCalendarDate);
        }
        
        fetchStart.setHours(0, 0, 0, 0);
        fetchEnd.setHours(23, 59, 59, 999);
        
        let url = `/api/activities/employee/${this.employee._id}?start=${fetchStart.toISOString()}&end=${fetchEnd.toISOString()}`;
        if (this.employee.companyCode) {
          url += `&companyCode=${this.employee.companyCode}`;
        }

        const response = await fetch(environment.apiBaseUrl + url);
        const result = await response.json();
        
        if (result.success) {
          let fetchedActivities = result.data.map((a: any) => ({
            ...a,
            date: new Date(a.activityDate)
          }));

          if (this.filterCompanyId) {
            fetchedActivities = fetchedActivities.filter((a: any) => a.leadId === this.filterCompanyId);
          }

          this.mockActivities = fetchedActivities;
        }
      } catch (err) {
        console.error('Error fetching activities', err);
      }
    }

    const today = new Date();
    this.calendarDays = [];

    if (this.calendarView === 'month') {
      const year = this.currentCalendarDate.getFullYear();
      const month = this.currentCalendarDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; 
      
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        this.calendarDays.push(this.createCalendarDay(new Date(year, month - 1, prevMonthLastDay - i), false, today));
      }

      for (let i = 1; i <= lastDay.getDate(); i++) {
        this.calendarDays.push(this.createCalendarDay(new Date(year, month, i), true, today));
      }

      const remainingSlots = 42 - this.calendarDays.length; 
      for (let i = 1; i <= remainingSlots; i++) {
        this.calendarDays.push(this.createCalendarDay(new Date(year, month + 1, i), false, today));
      }
    } else if (this.calendarView === 'week') {
      const date = new Date(this.currentCalendarDate);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(date.setDate(diff));

      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        this.calendarDays.push(this.createCalendarDay(d, true, today));
      }
    } else if (this.calendarView === 'day') {
      this.calendarDays.push(this.createCalendarDay(new Date(this.currentCalendarDate), true, today));
    }
  }

  createCalendarDay(d: Date, isCurrentMonth: boolean, today: Date) {
    const dayActivities = this.mockActivities.filter(a => 
      a.date.getFullYear() === d.getFullYear() &&
      a.date.getMonth() === d.getMonth() &&
      a.date.getDate() === d.getDate()
    );

    const pastDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return {
      date: d,
      isCurrentMonth: isCurrentMonth,
      isToday: d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(),
      isPast: d.getTime() < pastDate.getTime(),
      events: dayActivities,
      taskCount: dayActivities.filter(a => a.type === 'task').length,
      meetingCount: dayActivities.filter(a => a.type === 'meeting').length,
      callCount: dayActivities.filter(a => a.type === 'call').length
    };
  }

  get calendarTitle() {
    if (this.calendarView === 'month') {
      return this.currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (this.calendarView === 'week') {
      const date = new Date(this.currentCalendarDate);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(date.setDate(diff));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const startStr = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    } else {
      return this.currentCalendarDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  }

  prevCalendarPeriod() {
    if (this.calendarView === 'month') {
      this.currentCalendarDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() - 1, 1);
    } else if (this.calendarView === 'week') {
      this.currentCalendarDate = new Date(this.currentCalendarDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      this.currentCalendarDate = new Date(this.currentCalendarDate.getTime() - 24 * 60 * 60 * 1000);
    }
    this.generateCalendarDays();
  }

  nextCalendarPeriod() {
    if (this.calendarView === 'month') {
      this.currentCalendarDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 1);
    } else if (this.calendarView === 'week') {
      this.currentCalendarDate = new Date(this.currentCalendarDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      this.currentCalendarDate = new Date(this.currentCalendarDate.getTime() + 24 * 60 * 60 * 1000);
    }
    this.generateCalendarDays();
  }

  setCalendarView(view: 'month' | 'week' | 'day') {
    this.calendarView = view;
    this.generateCalendarDays();
  }

  setActivitiesSubTab(tab: 'calendar' | 'tasks' | 'meetings' | 'calls') {
    this.activitiesSubTab = tab;
  }
  
  openActivityModal(date?: Date, type: 'task' | 'meeting' | 'call' = 'task', prefillLead?: any) {
    this.selectedActivityDate = date ? new Date(date) : new Date();
    this.activityForm = { type: type, title: '', description: '', time: '10:00', leadId: '' };
    this.activityClientSearchQuery = '';
    
    if (prefillLead) {
      this.selectActivityClient(prefillLead);
    } else if (this.filterCompanyId) {
      this.activityForm.leadId = this.filterCompanyId;
      this.activityClientSearchQuery = this.filterCompanyName || '';
    }

    this.showActivityClientDropdown = false;
    this.showActivityModal = true;
  }
  
  closeActivityModal() {
    this.showActivityModal = false;
  }
  
  async saveActivity() {
    try {
      if (!this.employee?._id) {
        alert('Error: Employee ID is missing. Please try refreshing the page.');
        return;
      }
      
      if (!this.activityForm.title?.trim()) {
        alert('Please enter a title for the activity.');
        return;
      }
      
      if (!this.activityForm.time) {
        alert('Please select a valid time.');
        return;
      }
      
      const [hours, minutes] = this.activityForm.time.split(':').map(Number);
      const activityDate = new Date(this.selectedActivityDate);
      activityDate.setHours(hours, minutes, 0, 0);
      
      const response = await fetch(`${environment.apiBaseUrl}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: this.employee._id,
          companyCode: this.employee.companyCode,
          leadId: this.activityForm.leadId || undefined,
          type: this.activityForm.type,
          title: this.activityForm.title,
          description: this.activityForm.description,
          activityDate: activityDate
        })
      });
      
      let result;
      try {
        result = await response.json();
      } catch (jsonErr) {
        throw new Error('Server returned invalid JSON. It might be down or crashing.');
      }
      
      if (result.success) {
        this.closeActivityModal();
        await this.generateCalendarDays();
      } else {
        alert('Failed to save activity: ' + result.message);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error saving activity: ' + (err.message || String(err)));
    }
  }

  onActivityRowClick(activity: any) {
    if (activity.leadId) {
      this.activityClicked.emit({ leadId: activity.leadId, section: 'overview' });
    }
  }

  async markActivityComplete(activity: any, event: Event) {
    event.stopPropagation();
    try {
      const response = await fetch(`${environment.apiBaseUrl}/api/activities/${activity._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      const result = await response.json();
      if (result.success) {
        activity.status = 'completed';
      }
    } catch (err) {
      console.error('Failed to mark complete', err);
    }
  }
}

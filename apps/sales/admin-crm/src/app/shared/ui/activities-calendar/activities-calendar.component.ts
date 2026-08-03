import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  activitiesSubTab: 'calendar' | 'tasks' | 'meetings' | 'calls' = 'calendar';
  currentCalendarDate = new Date();
  activitiesFilter = {
    tasks: true,
    meetings: true,
    calls: true
  };
  
  mockActivities: ActivityItem[] = [];
  
  showActivityModal = false;
  selectedActivityDate: Date = new Date();
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
    events: any[];
    taskCount: number; 
    meetingCount: number; 
    callCount: number; 
  }> = [];

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

  get activitiesForCurrentTab(): any[] {
    if (this.activitiesSubTab === 'calendar') return [];
    
    const typeMapping: Record<string, string> = {
      'tasks': 'task',
      'meetings': 'meeting',
      'calls': 'call'
    };
    const filterType = typeMapping[this.activitiesSubTab];
    
    return this.mockActivities
      .filter(a => a.type === filterType)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async generateCalendarDays() {
    if (this.filterCompanyId && !this.employee?._id) {
      try {
        const url = `/api/activities/lead/${this.filterCompanyId}`;
        const response = await fetch(url);
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          this.mockActivities = result.data.map((a: any) => ({
            ...a,
            date: new Date(a.activityDate)
          }));
        }
      } catch (err) {
        console.error('Error fetching lead activities for admin', err);
      }
    } else if (this.employee?._id) {
      try {
        const firstDayOfMonth = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth(), 1);
        const lastDayOfMonth = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 0);
        
        let url = `/api/activities/employee/${this.employee._id}?start=${firstDayOfMonth.toISOString()}&end=${lastDayOfMonth.toISOString()}`;

        const response = await fetch(url);
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

    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; 
    
    this.calendarDays = [];
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      this.calendarDays.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        isToday: false,
        events: [],
        taskCount: 0,
        meetingCount: 0,
        callCount: 0
      });
    }

    const today = new Date();
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      
      const dayActivities = this.mockActivities.filter(a => 
        a.date.getFullYear() === d.getFullYear() &&
        a.date.getMonth() === d.getMonth() &&
        a.date.getDate() === d.getDate()
      );

      this.calendarDays.push({
        date: d,
        isCurrentMonth: true,
        isToday: d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(),
        events: dayActivities,
        taskCount: dayActivities.filter(a => a.type === 'task').length,
        meetingCount: dayActivities.filter(a => a.type === 'meeting').length,
        callCount: dayActivities.filter(a => a.type === 'call').length
      });
    }

    const remainingSlots = 42 - this.calendarDays.length; 
    for (let i = 1; i <= remainingSlots; i++) {
      this.calendarDays.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false,
        events: [],
        taskCount: 0,
        meetingCount: 0,
        callCount: 0
      });
    }
  }

  prevCalendarMonth() {
    this.currentCalendarDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() - 1, 1);
    this.generateCalendarDays();
  }

  nextCalendarMonth() {
    this.currentCalendarDate = new Date(this.currentCalendarDate.getFullYear(), this.currentCalendarDate.getMonth() + 1, 1);
    this.generateCalendarDays();
  }

  setActivitiesSubTab(tab: 'calendar' | 'tasks' | 'meetings' | 'calls') {
    this.activitiesSubTab = tab;
  }
  
  openActivityModal(date?: Date) {
    this.selectedActivityDate = date ? new Date(date) : new Date();
    this.activityForm = { type: 'task', title: '', description: '', time: '10:00', leadId: '' };
    this.activityClientSearchQuery = '';
    
    if (this.filterCompanyId) {
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
      
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: this.employee?._id || 'admin',
          leadId: this.activityForm.leadId || this.filterCompanyId || undefined,
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

  async markActivityComplete(activity: any, event: Event) {
    event.stopPropagation();
    try {
      const response = await fetch(`/api/activities/${activity._id}`, {
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

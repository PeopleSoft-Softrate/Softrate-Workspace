import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface TimelineItem {
  id: string;
  type: 'activity' | 'remark' | 'invoice' | 'quotation';
  date: Date;
  title: string;
  description: string;
  meta?: any;
}

@Component({
  selector: 'app-company-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-timeline.component.html',
  styleUrls: ['./company-timeline.component.css']
})
export class CompanyTimelineComponent implements OnChanges {
  @Input() leadId?: string;
  @Input() remarks: any[] = [];
  @Input() invoices: any[] = [];
  @Input() quotations: any[] = [];

  timelineItems: TimelineItem[] = [];
  filteredItems: TimelineItem[] = [];
  loading = false;
  
  filterType: 'all' | 'activity' | 'remark' | 'invoice' | 'quotation' = 'all';

  constructor(private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['leadId'] || changes['remarks'] || changes['invoices'] || changes['quotations']) {
      this.buildTimeline();
    }
  }

  async buildTimeline() {
    if (!this.leadId) return;
    this.loading = true;

    try {
      // Fetch activities for this lead
      const activitiesResponse = await this.http.get<any>(`/api/activities/lead/${this.leadId}`).toPromise();
      const activities = activitiesResponse?.data || [];

      const items: TimelineItem[] = [];

      // Add activities
      activities.forEach((act: any) => {
        items.push({
          id: act._id || Math.random().toString(),
          type: 'activity',
          date: new Date(act.activityDate || act.createdAt),
          title: `Activity: ${act.type || 'Task'}`,
          description: act.title ? `${act.title} - ${act.description || ''}` : (act.description || ''),
          meta: act
        });
      });

      // Add remarks (LeadHistoryLog)
      (this.remarks || []).forEach((remark: any) => {
        items.push({
          id: Math.random().toString(),
          type: 'remark',
          date: new Date(remark.timestamp || remark.createdAt || new Date()),
          title: 'Remark Added',
          description: remark.details || remark.action || 'No details',
          meta: remark
        });
      });

      // Add invoices
      (this.invoices || []).forEach((inv: any) => {
        items.push({
          id: inv._id || inv.invoiceNumber || Math.random().toString(),
          type: 'invoice',
          date: new Date(inv.date || inv.createdAt || new Date()),
          title: `Invoice Generated (${inv.invoiceNumber || 'Unknown'})`,
          description: `Amount: $${inv.amount || inv.totalAmount || 0} - Status: ${inv.status || 'Pending'}`,
          meta: inv
        });
      });

      // Add quotations
      (this.quotations || []).forEach((quo: any) => {
        items.push({
          id: quo._id || quo.quoteNumber || Math.random().toString(),
          type: 'quotation',
          date: new Date(quo.date || quo.createdAt || new Date()),
          title: `Quotation Sent (${quo.quoteNumber || 'Unknown'})`,
          description: `Total: $${quo.totalAmount || quo.amount || 0} - Status: ${quo.status || 'Pending'}`,
          meta: quo
        });
      });

      // Sort by date descending
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      this.timelineItems = items;
      this.applyFilter();
    } catch (error) {
      console.error('Error building timeline:', error);
    } finally {
      this.loading = false;
    }
  }

  setFilter(type: 'all' | 'activity' | 'remark' | 'invoice' | 'quotation') {
    this.filterType = type;
    this.applyFilter();
  }

  applyFilter() {
    if (this.filterType === 'all') {
      this.filteredItems = [...this.timelineItems];
    } else {
      this.filteredItems = this.timelineItems.filter(item => item.type === this.filterType);
    }
  }
}

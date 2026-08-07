import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../api.service';

export interface TimelineItem {
  id: string;
  type: 'activity' | 'remark' | 'invoice' | 'quotation' | 'email' | 'proposal';
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
  @Input() lead?: any;
  @Input() remarks: any[] = [];
  @Input() invoices: any[] = [];
  @Input() quotations: any[] = [];
  @Input() emails: any[] = [];
  @Input() proposals: any[] = [];

  timelineItems: TimelineItem[] = [];
  filteredItems: TimelineItem[] = [];
  loading = false;
  
  filterType: 'all' | 'activity' | 'remark' | 'invoice' | 'quotation' | 'email' | 'proposal' = 'all';

  constructor(private api: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lead'] || changes['remarks'] || changes['invoices'] || changes['quotations'] || changes['emails'] || changes['proposals']) {
      this.buildTimeline();
    }
  }

  async buildTimeline() {
    if (!this.lead) return;
    this.loading = true;

    try {
      let activities: any[] = [];
      try {
        const activitiesResponse = await firstValueFrom(this.api.get<any>(`/api/activities/lead/${this.lead._id}`));
        activities = activitiesResponse?.data || [];
      } catch (err) {
        console.error('Failed to fetch activities:', err);
      }

      let calls: any[] = [];
      try {
        // Collect all possible phone properties from Lead / Client models
        const phones = [
          this.lead.contactNumber,
          this.lead.phone,
          this.lead.mobile,
          this.lead.primaryPhone,
          this.lead.primaryPhoneNormalized,
          this.lead.alternatePhone,
          this.lead.directorPhone,
          ...(this.lead.alternatePhones || [])
        ].filter(Boolean).map((p: any) => String(p).trim()).filter(Boolean).join(',');
        const companyCode = this.lead.companyCode || (this.lead as any).companyId || '';
        console.log('[Timeline] Fetching calls for phones:', phones, 'companyCode:', companyCode);
        if (phones) {
           const codeParam = companyCode ? `companyCode=${encodeURIComponent(companyCode)}&` : '';
           const callsResponse = await firstValueFrom(this.api.get<any>(`/api/calllogs/lead-calls?${codeParam}phones=${encodeURIComponent(phones)}`));
           calls = callsResponse?.calls || [];
           console.log('[Timeline] Got calls:', calls.length);
        } else {
          console.warn('[Timeline] No phone numbers found on lead:', this.lead);
        }
      } catch (err) {
        console.error('Failed to fetch call logs:', err);
      }

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

      // Add actual phone call logs
      calls.forEach((call: any) => {
        const dur = Number(call.duration || 0);
        const durationText = dur > 0 ? `${dur}s` : '0s';
        const typeLabel = call.callType ? call.callType.charAt(0).toUpperCase() + call.callType.slice(1) : 'Call';
        const empName = (call.employeeName && call.employeeName !== 'Unknown Employee') ? call.employeeName : 'Team Member';
        const contactName = call.contactName || call.name || this.lead?.contactName || this.lead?.leadCompanyName || 'Contact';
        const numberStr = call.number || '—';

        items.push({
          id: call._id || Math.random().toString(),
          type: 'activity',
          date: new Date(call.timestamp || call.date || call.createdAt),
          title: `Phone Call (${typeLabel})`,
          description: `Employee: ${empName} • Contact: ${contactName} (${numberStr}) • Duration: ${durationText}`,
          meta: call
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
          description: `Amount: INR${inv.amount || inv.totalAmount || 0} - Status: ${inv.status || 'Pending'}`,
          meta: inv
        });
      });

      // Add quotations
      (this.quotations || []).forEach((quo: any) => {
        items.push({
          id: quo._id || quo.quotationNumber || Math.random().toString(),
          type: 'quotation',
          date: new Date(quo.date || quo.createdAt || new Date()),
          title: `Quotation: ${quo.quotationNumber || 'N/A'}`,
          description: `Amount: ₹${quo.grandTotal || quo.totalAmount || 0} • Status: ${quo.status || 'Draft'}`,
          meta: quo
        });
      });

      // Add emails
      (this.emails || []).forEach((email: any) => {
        items.push({
          id: Math.random().toString(),
          type: 'email',
          date: new Date(email.timestamp || email.createdAt || new Date()),
          title: 'Email Sent',
          description: email.details || 'Email communication',
          meta: email
        });
      });

      // Add proposals
      (this.proposals || []).forEach((prop: any) => {
        items.push({
          id: Math.random().toString(),
          type: 'proposal',
          date: new Date(prop.timestamp || prop.createdAt || new Date()),
          title: 'Proposal Generated',
          description: prop.details || 'Proposal was generated and downloaded',
          meta: prop
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

  setFilter(type: 'all' | 'activity' | 'remark' | 'invoice' | 'quotation' | 'email' | 'proposal') {
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

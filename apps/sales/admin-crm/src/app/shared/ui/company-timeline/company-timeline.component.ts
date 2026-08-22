import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../services/api.service';

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
  @Input() lead?: any;
  @Input() remarks: any[] = [];
  @Input() invoices: any[] = [];
  @Input() quotations: any[] = [];

  timelineItems: TimelineItem[] = [];
  filteredItems: TimelineItem[] = [];
  loading = false;
  
  filterType: 'all' | 'activity' | 'remark' | 'invoice' | 'quotation' = 'all';

  constructor(private api: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lead'] || changes['remarks'] || changes['invoices'] || changes['quotations']) {
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

      // Add remarks (LeadHistoryLog & lead.remarks)
      const seenRemarkTexts = new Set<string>();
      (this.remarks || []).forEach((remark: any) => {
        const text = String(remark.newValue || remark.details || remark.action || '').trim();
        if (text) {
          seenRemarkTexts.add(text.toLowerCase());
          const displayDetails = remark.newValue && remark.details && remark.details !== remark.newValue 
            ? `${remark.newValue} (${remark.details})`
            : (remark.newValue || remark.details || 'Remark Added');
          items.push({
            id: remark._id || Math.random().toString(),
            type: 'remark',
            date: new Date(remark.timestamp || remark.createdAt || new Date()),
            title: `Remark: ${remark.newValue || remark.details || 'Remark Added'}`,
            description: displayDetails,
            meta: remark
          });
        }
      });

      // Fallback/direct remarks from this.lead.remarks
      (this.lead?.remarks || []).forEach((r: any) => {
        const text = String(r || '').trim();
        if (text && !seenRemarkTexts.has(text.toLowerCase())) {
          seenRemarkTexts.add(text.toLowerCase());
          items.push({
            id: Math.random().toString(),
            type: 'remark',
            date: new Date(this.lead.updatedAt || this.lead.createdAt || new Date()),
            title: `Remark: ${text}`,
            description: text,
            meta: { text }
          });
        }
      });

      // Add invoices
      (this.invoices || []).forEach((inv: any) => {
        items.push({
          id: inv._id || inv.invoiceNumber || Math.random().toString(),
          type: 'invoice',
          date: new Date(inv.date || inv.createdAt || new Date()),
          title: `Invoice Generated (${inv.invoiceNumber || 'Unknown'})`,
          description: `Total: ₹${inv.total || inv.totalAmount || 0} • Paid: ₹${inv.amountPaid || 0} • Bal: ₹${inv.balanceDue || 0}`,
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
          description: `Total: INR ${quo.totalAmount || quo.amount || 0} - Status: ${quo.status || 'Pending'}`,
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

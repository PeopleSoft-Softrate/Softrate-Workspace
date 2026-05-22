import { AsyncPipe, DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { Ticket, TicketCategory, TicketDraft, TicketPriority, TicketStatus } from '../../domain/ticket.model';
import { TicketsViewModel } from '../tickets.viewmodel';

@Component({
  selector: 'app-ticket-inbox',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, NgClass, NgFor, NgIf, EmptyStateComponent],
  templateUrl: './ticket-inbox.component.html',
  styleUrl: './ticket-inbox.component.css',
})
export class TicketInboxComponent {
  readonly vm = inject(TicketsViewModel);
  readonly statusOptions: Array<'all' | TicketStatus> = ['all', 'Open', 'In Progress', 'Waiting on Client', 'Resolved', 'Closed'];
  readonly categoryOptions: TicketCategory[] = ['Bug', 'Feature Request', 'Billing', 'Support', 'Change Request'];
  readonly priorityOptions: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];

  metricCards(view: { tickets: Ticket[]; counts: { open: number; progress: number; waiting: number; resolved: number } }): Array<{ label: string; value: number }> {
    return [
      { label: 'Open', value: view.counts.open },
      { label: 'In Progress', value: view.counts.progress },
      { label: 'Waiting', value: view.counts.waiting },
      { label: 'Resolved', value: view.counts.resolved },
      { label: 'Listed', value: view.tickets.length },
    ];
  }

  statusLabel(status: 'all' | TicketStatus): string {
    return status === 'all' ? 'All Status' : status;
  }

  statusClass(status: TicketStatus): string {
    return `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  }

  priorityClass(priority: TicketPriority): string {
    return `priority-${priority.toLowerCase()}`;
  }

  ticketKey(ticket: Ticket): string {
    return ticket.id ? `#${ticket.id.slice(-6).toUpperCase()}` : 'New';
  }

  lastMessage(ticket: Ticket): string {
    const last = ticket.remarks[ticket.remarks.length - 1];
    return last?.message || ticket.description || 'No message yet.';
  }

  lastActivity(ticket: Ticket): string {
    const last = ticket.remarks[ticket.remarks.length - 1];
    return last?.createdAt || ticket.updatedAt || ticket.createdAt;
  }

  attachmentLabel(ticket: Ticket): string {
    const count = ticket.attachments.length;
    if (!count) return 'No attachments';
    return count === 1 ? '1 attachment' : `${count} attachments`;
  }

  authorLabel(ticket: Ticket, role: string): string {
    return role === 'client' ? ticket.clientCompanyName || 'Client' : 'Support team';
  }

  updateDraft<K extends keyof TicketDraft>(key: K, value: TicketDraft[K]): void {
    this.vm.updateDraft(key, value);
  }

  fileList(event: Event): FileList | null {
    return (event.target as HTMLInputElement | null)?.files || null;
  }

  trackByTicketId(_index: number, ticket: Ticket): string {
    return ticket.id;
  }
}

import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeadDrawerSection, LeadHistoryLog } from '../domain/lead.model';

export interface EmployeeLeadDetailView {
  _id: string;
  companyCode: string;
  assignedEmployeePhone: string;
  leadCompanyName: string;
  contactName: string;
  contactNumber: string;
  status: string;
  setLabel: string;
  companyDescription?: string;
  mainDivisionDescription?: string;
  directorEmailAddress?: string;
  remarks?: string[];
  isFavourite?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-employee-lead-detail',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, DatePipe],
  templateUrl: './employee-lead-detail.component.html',
})
export class EmployeeLeadDetailComponent {
  @Input({ required: true }) lead!: EmployeeLeadDetailView;
  @Input() drawerSection: LeadDrawerSection = 'details';
  @Input() statuses: string[] = [];
  @Input() historyLogs: LeadHistoryLog[] = [];
  @Input() historyLoading = false;
  @Input() remarkValue = '';
  @Input() remarkPosting = false;
  @Input() remarkDeletingIds: ReadonlySet<string> = new Set<string>();
  @Input() statusColor: (status: string) => string = () => '';
  @Input() formatDate: (value: string | undefined) => string = () => '';

  @Output() back = new EventEmitter<void>();
  @Output() detailsOpen = new EventEmitter<void>();
  @Output() historyOpen = new EventEmitter<void>();
  @Output() invoiceOpen = new EventEmitter<void>();
  @Output() favouriteToggle = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() remarkValueChange = new EventEmitter<string>();
  @Output() remarkAdd = new EventEmitter<void>();
  @Output() remarkDelete = new EventEmitter<number>();
}

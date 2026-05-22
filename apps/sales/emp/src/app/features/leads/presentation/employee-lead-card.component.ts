import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface EmployeeLeadCardLead {
  _id: string;
  contactName: string;
  contactNumber: string;
  status: string;
  setLabel: string;
  directorEmailAddress?: string;
  remarks?: string[];
  isStarred?: boolean;
  isFavourite?: boolean;
}

@Component({
  selector: 'app-employee-lead-card',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './employee-lead-card.component.html',
})
export class EmployeeLeadCardComponent {
  @Input({ required: true }) lead!: EmployeeLeadCardLead;
  @Input() statuses: string[] = [];
  @Input() productRemarks: string[] = [];
  @Input() remarkValue = '';
  @Input() remarkPosting = false;
  @Input() statusUpdating = false;
  @Input() showQuotationAction = true;
  @Input() statusColor: (status: string) => string = () => 'inherit';

  @Output() remarkValueChange = new EventEmitter<string>();
  @Output() starToggle = new EventEmitter<EmployeeLeadCardLead>();
  @Output() quotationOpen = new EventEmitter<EmployeeLeadCardLead>();
  @Output() invoiceOpen = new EventEmitter<EmployeeLeadCardLead>();
  @Output() remarkAdd = new EventEmitter<EmployeeLeadCardLead>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() followupOpen = new EventEmitter<EmployeeLeadCardLead>();
  @Output() favouriteToggle = new EventEmitter<EmployeeLeadCardLead>();
  @Output() detailOpen = new EventEmitter<EmployeeLeadCardLead>();
  @Output() remarkHistoryOpen = new EventEmitter<EmployeeLeadCardLead>();
  remarkMenuOpen = false;
  private remarkMenuCloseRef: ReturnType<typeof setTimeout> | null = null;

  remarkPreviewList(): string[] {
    return [...(this.lead.remarks || [])]
      .map((remark) => String(remark || '').trim())
      .filter(Boolean)
      .slice(-2)
      .reverse();
  }

  adminRemarkOptions(): string[] {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const remark of this.productRemarks) {
      const normalized = String(remark || '').trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      options.push(normalized);
    }
    return options;
  }

  filteredAdminRemarkOptions(): string[] {
    const options = this.adminRemarkOptions();
    const query = String(this.remarkValue || '').trim().toLowerCase();
    if (!query) return options;
    return options.filter((remark) => remark.toLowerCase().includes(query));
  }

  handleRemarkInput(value: string): void {
    this.remarkValueChange.emit(value);
    this.openRemarkMenu();
  }

  openRemarkMenu(): void {
    this.clearRemarkMenuClose();
    this.remarkMenuOpen = true;
  }

  queueCloseRemarkMenu(): void {
    this.clearRemarkMenuClose();
    this.remarkMenuCloseRef = setTimeout(() => {
      this.remarkMenuOpen = false;
      this.remarkMenuCloseRef = null;
    }, 140);
  }

  toggleRemarkMenu(): void {
    this.clearRemarkMenuClose();
    this.remarkMenuOpen = !this.remarkMenuOpen;
  }

  selectAdminRemark(remark: string): void {
    this.remarkValueChange.emit(remark);
    this.remarkMenuOpen = false;
  }

  canAddRemark(): boolean {
    return !this.remarkPosting && !!String(this.remarkValue || '').trim();
  }

  addRemark(): void {
    if (!this.canAddRemark()) return;
    this.remarkMenuOpen = false;
    this.remarkAdd.emit(this.lead);
  }

  private clearRemarkMenuClose(): void {
    if (!this.remarkMenuCloseRef) return;
    clearTimeout(this.remarkMenuCloseRef);
    this.remarkMenuCloseRef = null;
  }
}

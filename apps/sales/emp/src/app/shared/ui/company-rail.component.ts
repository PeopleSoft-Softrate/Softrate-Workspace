import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface CompanyRailItem {
  name: string;
  count?: number;
  meta?: string;
}

@Component({
  selector: 'app-company-rail',
  standalone: true,
  imports: [NgFor, NgIf],
  template: `
    <aside class="company-rail">
      <div class="rail-header">
        <div class="rail-heading">{{ heading }}</div>
        <div class="rail-total">{{ total }} listed</div>
      </div>
      <div class="rail-list" (scroll)="scroll.emit($event)">
        <button
          class="rail-item"
          type="button"
          *ngFor="let item of items"
          [class.active]="selected === item.name"
          (click)="select.emit(item.name)"
        >
          <span class="rail-item-copy">
            <span class="rail-item-name">{{ item.name }}</span>
            <span class="rail-item-meta">{{ item.meta || ((item.count || 0) + ' contacts') }}</span>
          </span>
        </button>
        <div *ngIf="items.length === 0" class="empty-state-inline empty-state-inline-minimal">{{ emptyText }}</div>
      </div>
    </aside>
  `,
})
export class CompanyRailComponent {
  @Input() heading = 'Companies';
  @Input() total = 0;
  @Input() items: CompanyRailItem[] = [];
  @Input() selected = '';
  @Input() emptyText = 'No records.';
  @Output() select = new EventEmitter<string>();
  @Output() scroll = new EventEmitter<Event>();
}

import { NgFor } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-history-pagination',
  standalone: true,
  imports: [NgFor],
  template: `
    <nav class="history-pagination" aria-label="History pagination">
      <button type="button" class="secondary-action" [disabled]="page <= 1" (click)="pageChange.emit(page - 1)">Previous</button>
      <button
        type="button"
        class="toolbar-button"
        *ngFor="let item of pages"
        [class.active]="item === page"
        (click)="pageChange.emit(item)"
      >
        {{ item }}
      </button>
      <button type="button" class="secondary-action" [disabled]="page >= totalPages" (click)="pageChange.emit(page + 1)">Next</button>
    </nav>
  `,
  styles: [`
    .history-pagination {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      padding: 24px 32px;
      border-top: 1px solid #dfe5ee;
      background: #ffffff;
      width: 100%;
    }
    
    .history-pagination .toolbar-button,
    .history-pagination .secondary-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      padding: 0 14px;
      border: 1px solid #d8dee8;
      border-radius: 8px;
      background: #ffffff;
      color: #334155;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 160ms ease;
    }
    
    .history-pagination .toolbar-button {
      padding: 0;
      width: 36px;
    }
    
    .history-pagination button:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    
    .history-pagination button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .history-pagination .toolbar-button.active {
      background: #0f172a;
      border-color: #0f172a;
      color: #ffffff;
    }
  `]
})
export class HistoryPaginationComponent {
  @Input() page = 1;
  @Input() total = 0;
  @Input() pageSize = 20;
  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / Math.max(1, this.pageSize)));
  }

  get pages(): number[] {
    const maxVisible = 5;
    const start = Math.max(1, Math.min(this.page - 2, this.totalPages - maxVisible + 1));
    const end = Math.min(this.totalPages, start + maxVisible - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
}

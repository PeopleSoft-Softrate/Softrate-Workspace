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

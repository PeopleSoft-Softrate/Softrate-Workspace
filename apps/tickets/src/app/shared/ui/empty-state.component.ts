import { Component, Input } from '@angular/core';

@Component({
  selector: 'dv-empty-state',
  standalone: true,
  template: `<div class="empty-state-inline">{{ message }}</div>`,
})
export class EmptyStateComponent {
  @Input() message = 'No records found.';
}

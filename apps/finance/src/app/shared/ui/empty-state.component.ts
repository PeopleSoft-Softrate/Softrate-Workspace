import { Component, Input } from '@angular/core';

@Component({
  selector: 'dv-empty-state',
  standalone: true,
  template: `<div class="empty-state-inline empty-state-inline-minimal">{{ message }}</div>`,
})
export class EmptyStateComponent {
  @Input() message = 'No records.';
}

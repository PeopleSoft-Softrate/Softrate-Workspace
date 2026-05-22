import { Component, Input } from '@angular/core';
import { IntegrationPlaceholderComponent } from '../integration-placeholder/integration-placeholder.component';

@Component({
  selector: 'app-finance-receivables-placeholder-view',
  standalone: true,
  imports: [IntegrationPlaceholderComponent],
  template: `<app-finance-integration-placeholder [title]="title"></app-finance-integration-placeholder>`,
})
export class ReceivablesPlaceholderViewComponent {
  @Input() title = 'Receivables to be integrated.';
}

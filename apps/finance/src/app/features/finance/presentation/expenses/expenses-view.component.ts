import { Component, Input } from '@angular/core';
import { IntegrationPlaceholderComponent } from '../integration-placeholder/integration-placeholder.component';

@Component({
  selector: 'app-finance-expenses-view',
  standalone: true,
  imports: [IntegrationPlaceholderComponent],
  template: `<app-finance-integration-placeholder [title]="title"></app-finance-integration-placeholder>`,
})
export class ExpensesViewComponent {
  @Input() title = 'Expenses to be integrated.';
}

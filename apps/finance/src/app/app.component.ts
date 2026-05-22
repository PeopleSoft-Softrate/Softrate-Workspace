import { Component } from '@angular/core';
import { FinanceWorkspaceComponent } from './features/finance/presentation/finance-workspace.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FinanceWorkspaceComponent],
  template: '<app-finance-workspace />',
})
export class AppComponent {}

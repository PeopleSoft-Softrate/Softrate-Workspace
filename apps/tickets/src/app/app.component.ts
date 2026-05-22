import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { AuthViewModel } from './features/auth/presentation/auth.viewmodel';
import { LoginComponent } from './features/auth/presentation/login.component';
import { TicketWorkspaceComponent } from './features/workspace/presentation/ticket-workspace.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, NgIf, LoginComponent, TicketWorkspaceComponent],
  template: `
    <ng-container *ngIf="auth.state$ | async as state">
      <app-ticket-workspace *ngIf="state.session; else login"></app-ticket-workspace>
      <ng-template #login>
        <app-login></app-login>
      </ng-template>
    </ng-container>
  `,
})
export class AppComponent {
  readonly auth = inject(AuthViewModel);
}

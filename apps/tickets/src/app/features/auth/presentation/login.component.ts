import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthViewModel } from './auth.viewmodel';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgIf],
  template: `
    <main class="auth-shell" *ngIf="vm.state$ | async as state">
      <section class="auth-brand">
        <img src="assets/icon/logo.png" alt="DealVoice Logo" class="auth-logo">
        <div class="section-kicker">Client support</div>
        <h1 class="auth-title">Track every request without switching channels.</h1>
        <p class="auth-copy">Access your support queue, open conversations, and attach context for the Softrate team.</p>
      </section>

      <section class="auth-panel">
        <div class="auth-panel-header">
          <div class="section-kicker">Sign in</div>
          <h2>Client Ticket Portal</h2>
          <p>Use your registered converted-client email to access support.</p>
        </div>

        <div class="form-stack">
          <label class="field-block">
            <span>Email</span>
            <input
              class="field-input"
              type="email"
              [ngModel]="state.email"
              (ngModelChange)="vm.setEmail($event)"
              placeholder="client@example.com"
              (keyup.enter)="vm.login()"
            >
          </label>
          <button class="primary-action" type="button" (click)="vm.login()" [disabled]="state.loading">
            {{ state.loading ? 'Checking...' : 'Continue' }}
          </button>
          <div class="form-error" *ngIf="state.error">{{ state.error }}</div>
        </div>
      </section>
    </main>
  `,
})
export class LoginComponent {
  readonly vm = inject(AuthViewModel);
}

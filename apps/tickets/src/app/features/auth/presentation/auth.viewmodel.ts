import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthRepository } from '../data/auth.repository';
import { ClientSession } from '../domain/client-session.model';

export interface AuthState {
  session: ClientSession | null;
  email: string;
  loading: boolean;
  error: string;
}

const storageKey = 'softrate_ticket_client_session';

@Injectable({ providedIn: 'root' })
export class AuthViewModel {
  private readonly repository = inject(AuthRepository);
  private readonly stateSubject = new BehaviorSubject<AuthState>({
    session: this.restoreSession(),
    email: '',
    loading: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();

  get state(): AuthState {
    return this.stateSubject.value;
  }

  setEmail(email: string): void {
    this.patch({ email, error: '' });
  }

  login(): void {
    const email = this.state.email.trim();
    if (!email) {
      this.patch({ error: 'Enter your client email.' });
      return;
    }
    this.patch({ loading: true, error: '' });
    this.repository.login(email).subscribe({
      next: (session) => {
        localStorage.setItem(storageKey, JSON.stringify(session));
        this.patch({ session, loading: false, error: '', email: '' });
      },
      error: (err) => {
        this.patch({
          loading: false,
          error: err?.error?.message || 'Unable to login with this email.',
        });
      },
    });
  }

  logout(): void {
    localStorage.removeItem(storageKey);
    this.patch({ session: null, email: '', error: '' });
  }

  private patch(partial: Partial<AuthState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }

  private restoreSession(): ClientSession | null {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) as ClientSession : null;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }
}

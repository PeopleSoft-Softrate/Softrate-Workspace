import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TicketApiService } from '../../../core/api/ticket-api.service';
import { ClientSession, TicketClient } from '../domain/client-session.model';
import { ClientLoginResponseDto, ClientMeResponseDto } from './auth.dto';

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly api = inject(TicketApiService);

  login(email: string): Observable<ClientSession> {
    return this.api.post<ClientLoginResponseDto>('/api/client-auth/login', { email }).pipe(
      map((response) => ({ token: response.token, client: response.client })),
    );
  }

  me(token: string): Observable<TicketClient> {
    return this.api.get<ClientMeResponseDto>('/api/client-auth/me', token).pipe(
      map((response) => response.client),
    );
  }
}

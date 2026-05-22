import { TicketClient } from '../domain/client-session.model';

export interface ClientLoginResponseDto {
  success: boolean;
  token: string;
  client: TicketClient;
  message?: string;
}

export interface ClientMeResponseDto {
  success: boolean;
  client: TicketClient;
  message?: string;
}

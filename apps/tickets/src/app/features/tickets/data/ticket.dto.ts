import { Ticket } from '../domain/ticket.model';

export interface TicketListResponseDto {
  success: boolean;
  tickets: Ticket[];
  message?: string;
}

export interface TicketResponseDto {
  success: boolean;
  ticket: Ticket;
  message?: string;
}

import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TicketApiService } from '../../../core/api/ticket-api.service';
import { Ticket, TicketDraft } from '../domain/ticket.model';
import { TicketListResponseDto, TicketResponseDto } from './ticket.dto';
import { mapTicket } from './ticket.mapper';

@Injectable({ providedIn: 'root' })
export class TicketsRepository {
  private readonly api = inject(TicketApiService);

  list(token: string, filters: { search?: string; status?: string } = {}): Observable<Ticket[]> {
    return this.api.get<TicketListResponseDto>(`/api/client/tickets${this.query(filters)}`, token).pipe(
      map((response) => (response.tickets || []).map(mapTicket)),
    );
  }

  create(token: string, draft: TicketDraft): Observable<Ticket> {
    const form = new FormData();
    form.set('subject', draft.subject);
    form.set('category', draft.category);
    form.set('priority', draft.priority);
    form.set('description', draft.description);
    form.set('relatedProjectService', draft.relatedProjectService);
    if (draft.attachment) form.set('attachment', draft.attachment);
    return this.api.post<TicketResponseDto>('/api/client/tickets', form, token).pipe(
      map((response) => mapTicket(response.ticket)),
    );
  }

  addRemark(token: string, ticketId: string, message: string): Observable<Ticket> {
    return this.api.post<TicketResponseDto>(`/api/client/tickets/${ticketId}/remarks`, { message }, token).pipe(
      map((response) => mapTicket(response.ticket)),
    );
  }

  private query(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  }
}

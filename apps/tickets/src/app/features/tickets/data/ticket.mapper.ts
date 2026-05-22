import { Ticket } from '../domain/ticket.model';

export function mapTicket(raw: Ticket): Ticket {
  return {
    ...raw,
    attachments: raw.attachments || [],
    remarks: raw.remarks || [],
  };
}

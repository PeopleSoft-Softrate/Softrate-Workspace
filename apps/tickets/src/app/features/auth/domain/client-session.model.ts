export interface TicketClient {
  companyCode: string;
  clientCompanyName: string;
  clientEmail: string;
  clientContactName: string;
  clientPhone: string;
  status: string;
  contactCount: number;
}

export interface ClientSession {
  token: string;
  client: TicketClient;
}

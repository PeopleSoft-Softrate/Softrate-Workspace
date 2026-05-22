export type TicketCategory = 'Bug' | 'Feature Request' | 'Billing' | 'Support' | 'Change Request';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketStatus = 'Open' | 'In Progress' | 'Waiting on Client' | 'Resolved' | 'Closed';

export interface TicketAttachment {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TicketRemark {
  id: string;
  authorRole: 'client' | 'crm';
  authorName: string;
  authorEmail: string;
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface Ticket {
  id: string;
  companyCode: string;
  clientCompanyName: string;
  clientEmail: string;
  clientContactName: string;
  clientPhone: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  relatedProjectService: string;
  attachments: TicketAttachment[];
  status: TicketStatus;
  remarks: TicketRemark[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketDraft {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  relatedProjectService: string;
  attachment: File | null;
}

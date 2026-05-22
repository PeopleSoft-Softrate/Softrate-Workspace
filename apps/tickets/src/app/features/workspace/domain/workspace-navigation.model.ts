import { TicketStatus } from '../../tickets/domain/ticket.model';

export type TicketQueueFilter = 'all' | TicketStatus;

export type TicketNavAction = 'queue' | 'create' | 'logout';

export interface TicketNavItem {
  id: string;
  label: string;
  action: TicketNavAction;
  icon: string;
  status?: TicketQueueFilter;
}

export interface TicketNavGroup {
  label: string;
  items: TicketNavItem[];
}

export const TICKET_NAV_GROUPS: TicketNavGroup[] = [
  {
    label: 'Support Desk',
    items: [
      {
        id: 'all',
        label: 'All Tickets',
        action: 'queue',
        status: 'all',
        icon: 'M4 5h16v14H4z M8 9h8 M8 13h8 M8 17h5',
      },
      {
        id: 'open',
        label: 'Open',
        action: 'queue',
        status: 'Open',
        icon: 'M6 4h12v16H6z M9 8h6 M9 12h6 M9 16h3',
      },
      {
        id: 'in-progress',
        label: 'In Progress',
        action: 'queue',
        status: 'In Progress',
        icon: 'M4 12a8 8 0 0 1 13.66-5.66L20 8 M20 4v4h-4 M20 12a8 8 0 0 1-13.66 5.66L4 16 M4 20v-4h4',
      },
      {
        id: 'waiting',
        label: 'Waiting',
        action: 'queue',
        status: 'Waiting on Client',
        icon: 'M12 8v5l3 2 M21 12a9 9 0 1 1-9-9',
      },
      {
        id: 'resolved',
        label: 'Resolved',
        action: 'queue',
        status: 'Resolved',
        icon: 'M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0',
      },
    ],
  },
  {
    label: 'Actions',
    items: [
      {
        id: 'create',
        label: 'Raise Ticket',
        action: 'create',
        icon: 'M12 5v14 M5 12h14',
      },
      {
        id: 'logout',
        label: 'Logout',
        action: 'logout',
        icon: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
      },
    ],
  },
];

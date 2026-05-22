import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, map, Subject, switchMap } from 'rxjs';
import { AuthViewModel } from '../../auth/presentation/auth.viewmodel';
import { Ticket, TicketDraft, TicketStatus } from '../domain/ticket.model';
import { TicketsRepository } from '../data/tickets.repository';

export interface TicketsState {
  tickets: Ticket[];
  selectedTicketId: string;
  search: string;
  status: 'all' | TicketStatus;
  draft: TicketDraft;
  remarkDraft: string;
  createOpen: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
}

const emptyDraft: TicketDraft = {
  subject: '',
  category: 'Support',
  priority: 'Medium',
  description: '',
  relatedProjectService: '',
  attachment: null,
};

@Injectable({ providedIn: 'root' })
export class TicketsViewModel {
  private readonly auth = inject(AuthViewModel);
  private readonly repository = inject(TicketsRepository);
  private readonly filterChange = new Subject<void>();
  private readonly stateSubject = new BehaviorSubject<TicketsState>({
    tickets: [],
    selectedTicketId: '',
    search: '',
    status: 'all',
    draft: { ...emptyDraft },
    remarkDraft: '',
    createOpen: false,
    loading: false,
    saving: false,
    error: '',
  });

  readonly state$ = this.stateSubject.asObservable();
  readonly view$ = combineLatest([this.state$, this.auth.state$]).pipe(
    map(([state, auth]) => ({
      ...state,
      client: auth.session?.client || null,
      selectedTicket: state.tickets.find((ticket) => ticket.id === state.selectedTicketId) || state.tickets[0] || null,
      counts: {
        open: state.tickets.filter((ticket) => ticket.status === 'Open').length,
        progress: state.tickets.filter((ticket) => ticket.status === 'In Progress').length,
        waiting: state.tickets.filter((ticket) => ticket.status === 'Waiting on Client').length,
        resolved: state.tickets.filter((ticket) => ticket.status === 'Resolved' || ticket.status === 'Closed').length,
      },
    })),
  );

  constructor() {
    this.filterChange.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(() => {
        this.patch({ loading: true, error: '' });
        return this.repository.list(this.token(), this.filters());
      }),
    ).subscribe({
      next: (tickets) => this.patch({
        tickets,
        loading: false,
        selectedTicketId: tickets.some((ticket) => ticket.id === this.state.selectedTicketId)
          ? this.state.selectedTicketId
          : tickets[0]?.id || '',
      }),
      error: (err) => this.patch({ loading: false, error: err?.error?.message || 'Unable to load tickets.' }),
    });
  }

  get state(): TicketsState {
    return this.stateSubject.value;
  }

  init(): void {
    this.reload();
  }

  reload(): void {
    const token = this.token();
    if (!token) return;
    this.patch({ loading: true, error: '' });
    this.repository.list(token, this.filters()).subscribe({
      next: (tickets) => this.patch({
        tickets,
        loading: false,
        selectedTicketId: tickets[0]?.id || '',
      }),
      error: (err) => this.patch({ loading: false, error: err?.error?.message || 'Unable to load tickets.' }),
    });
  }

  setSearch(search: string): void {
    this.patch({ search });
    this.filterChange.next();
  }

  setStatus(status: string): void {
    this.patch({ status: status as TicketsState['status'] });
    this.filterChange.next();
  }

  selectTicket(ticketId: string): void {
    this.patch({ selectedTicketId: ticketId });
  }

  openCreate(): void {
    this.patch({ createOpen: true, draft: { ...emptyDraft }, error: '' });
  }

  closeCreate(): void {
    this.patch({ createOpen: false, draft: { ...emptyDraft } });
  }

  updateDraft<K extends keyof TicketDraft>(key: K, value: TicketDraft[K]): void {
    this.patch({ draft: { ...this.state.draft, [key]: value } });
  }

  setAttachment(files: FileList | null): void {
    this.updateDraft('attachment', files?.item(0) || null);
  }

  createTicket(): void {
    const draft = this.state.draft;
    if (!draft.subject.trim() || !draft.description.trim()) {
      this.patch({ error: 'Subject and description are required.' });
      return;
    }
    this.patch({ saving: true, error: '' });
    this.repository.create(this.token(), draft).subscribe({
      next: (ticket) => this.patch({
        tickets: [ticket, ...this.state.tickets],
        selectedTicketId: ticket.id,
        createOpen: false,
        draft: { ...emptyDraft },
        saving: false,
      }),
      error: (err) => this.patch({ saving: false, error: err?.error?.message || 'Unable to raise ticket.' }),
    });
  }

  setRemarkDraft(message: string): void {
    this.patch({ remarkDraft: message });
  }

  addRemark(ticket: Ticket): void {
    const message = this.state.remarkDraft.trim();
    if (!message) return;
    this.patch({ saving: true, error: '' });
    this.repository.addRemark(this.token(), ticket.id, message).subscribe({
      next: (updated) => this.patch({
        tickets: this.state.tickets.map((item) => item.id === updated.id ? updated : item),
        remarkDraft: '',
        saving: false,
      }),
      error: (err) => this.patch({ saving: false, error: err?.error?.message || 'Unable to add response.' }),
    });
  }

  private patch(partial: Partial<TicketsState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }

  private token(): string {
    return this.auth.state.session?.token || '';
  }

  private filters(): { search?: string; status?: string } {
    return {
      search: this.state.search,
      status: this.state.status === 'all' ? '' : this.state.status,
    };
  }
}

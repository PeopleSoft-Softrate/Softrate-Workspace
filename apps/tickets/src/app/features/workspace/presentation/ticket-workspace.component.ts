import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthViewModel } from '../../auth/presentation/auth.viewmodel';
import { TicketInboxComponent } from '../../tickets/presentation/ticket-inbox/ticket-inbox.component';
import { TicketsViewModel } from '../../tickets/presentation/tickets.viewmodel';
import { TicketNavItem } from '../domain/workspace-navigation.model';
import { TicketWorkspaceViewModel } from './ticket-workspace.viewmodel';

@Component({
  selector: 'app-ticket-workspace',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, TicketInboxComponent],
  providers: [TicketWorkspaceViewModel],
  templateUrl: './ticket-workspace.component.html',
  styleUrl: './ticket-workspace.component.css',
})
export class TicketWorkspaceComponent implements OnInit {
  readonly vm = inject(TicketWorkspaceViewModel);
  readonly auth = inject(AuthViewModel);
  readonly tickets = inject(TicketsViewModel);

  ngOnInit(): void {
    this.tickets.init();
  }

  handleNav(item: TicketNavItem): void {
    if (item.action === 'queue' && item.status) {
      this.tickets.setStatus(item.status);
    }

    if (item.action === 'create') {
      this.tickets.openCreate();
    }

    if (item.action === 'logout') {
      this.auth.logout();
    }

    this.vm.closeSidebar();
  }

  isActive(item: TicketNavItem, currentStatus: string): boolean {
    return item.action === 'queue' && item.status === currentStatus;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.vm.closeProfileMenu();
  }

  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    this.vm.closeProfileMenu();
    this.vm.closeSidebar();
  }
}

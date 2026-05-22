import { Injectable } from '@angular/core';
import { TicketQueueFilter, TICKET_NAV_GROUPS, TicketNavGroup } from '../domain/workspace-navigation.model';

@Injectable()
export class TicketWorkspaceViewModel {
  sidebarOpen = false;
  sidebarMinimized = false;
  profileMenuOpen = false;
  sidebarFeatureSearch = '';

  readonly navGroups = TICKET_NAV_GROUPS;

  get filteredNavGroups(): TicketNavGroup[] {
    const term = this.sidebarFeatureSearch.trim().toLowerCase();
    if (!term) return this.navGroups;

    return this.navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => group.label.toLowerCase().includes(term) || item.label.toLowerCase().includes(term)),
      }))
      .filter((group) => group.items.length > 0);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleSidebarMinimized(): void {
    this.sidebarMinimized = !this.sidebarMinimized;
  }

  toggleProfileMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  initials(value: string | undefined | null): string {
    return String(value || 'Client')
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'CL';
  }

  queueLabel(status: TicketQueueFilter): string {
    return status === 'all' ? 'All Tickets' : status;
  }
}

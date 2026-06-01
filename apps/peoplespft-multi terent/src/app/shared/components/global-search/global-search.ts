import { Component, inject, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlobalSearchService, SearchResult } from '../../services/global-search';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-search.html',
  styleUrl: './global-search.css'
})
export class GlobalSearch {
  searchService = inject(GlobalSearchService);
  private router = inject(Router);
  private el = inject(ElementRef);

  query = signal('');
  isOpen = signal(false);

  employees = computed(() =>
    this.searchService.results().filter(r => r.type === 'employee')
  );

  interns = computed(() =>
    this.searchService.results().filter(r => r.type === 'intern')
  );

  onFocus() {
    this.isOpen.set(true);
    this.searchService.preload();
    if (this.query()) {
      this.searchService.search(this.query());
    }
  }

  onBlur() {
    // Handled via backdrop click and Escape
  }

  onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.searchService.search(value);
  }

  clearQuery(event: MouseEvent) {
    event.preventDefault();
    this.query.set('');
    this.searchService.clear();
  }

  navigate(result: SearchResult) {
    this.router.navigate([result.route]);
    this.close();
  }

  close() {
    this.isOpen.set(false);
    this.searchService.clear();
    this.query.set('');
  }

  // Global Cmd+K / Ctrl+K shortcut
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const input = this.el.nativeElement.querySelector('.gs-input') as HTMLInputElement;
      input?.focus();
      this.isOpen.set(true);
    }

    if (e.key === 'Escape') {
      this.close();
    }
  }
}

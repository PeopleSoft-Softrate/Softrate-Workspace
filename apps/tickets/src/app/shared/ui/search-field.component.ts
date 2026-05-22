import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'dv-search-field',
  standalone: true,
  template: `
    <label class="topbar-search">
      <span class="topbar-search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      </span>
      <input
        class="topbar-input"
        type="text"
        [placeholder]="placeholder"
        [value]="value"
        (input)="valueChange.emit(inputValue($event))"
      />
    </label>
  `,
})
export class SearchFieldComponent {
  @Input() value = '';
  @Input() placeholder = 'Search...';
  @Output() valueChange = new EventEmitter<string>();

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement | null)?.value || '';
  }
}

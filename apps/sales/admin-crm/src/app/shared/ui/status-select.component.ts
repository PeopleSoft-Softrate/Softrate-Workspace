import { NgFor } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-status-select',
  standalone: true,
  imports: [NgFor, FormsModule],
  template: `
    <select
      class="field-select"
      [ngModel]="value"
      (ngModelChange)="valueChange.emit($event)"
      [disabled]="disabled"
      [attr.aria-label]="label"
    >
      <option *ngFor="let option of options" [value]="option">{{ option }}</option>
    </select>
  `,
})
export class StatusSelectComponent {
  @Input() value = '';
  @Input() options: string[] = [];
  @Input() label = 'Status';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();
}

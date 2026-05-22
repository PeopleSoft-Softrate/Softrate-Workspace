import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-record-frame',
  standalone: true,
  template: `
    <section class="record-frame" [class.record-frame-detail]="detail">
      <ng-content></ng-content>
    </section>
  `,
})
export class RecordFrameComponent {
  @Input() detail = false;
}

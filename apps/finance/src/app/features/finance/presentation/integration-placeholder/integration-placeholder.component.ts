import { Component, Input } from '@angular/core';
import { RecordFrameComponent } from '../../../../shared/ui/record-frame.component';

@Component({
  selector: 'app-finance-integration-placeholder',
  standalone: true,
  imports: [RecordFrameComponent],
  template: `
    <app-record-frame>
      <div class="integration-card">
        <h2>{{ title }}</h2>
      </div>
    </app-record-frame>
  `,
  styles: [`
    .integration-card {
      display: grid;
      min-height: 280px;
      place-items: center;
      text-align: center;
    }

    .integration-card h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 24px;
      line-height: 1.2;
      letter-spacing: 0;
    }
  `],
})
export class IntegrationPlaceholderComponent {
  @Input() title = 'To be integrated.';
}

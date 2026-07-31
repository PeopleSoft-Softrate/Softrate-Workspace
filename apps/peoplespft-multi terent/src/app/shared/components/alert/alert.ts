import { Component, inject, effect, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../services/alert';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { TaskDone01Icon, Alert01Icon, InformationCircleIcon, HelpCircleIcon } from '@hugeicons/core-free-icons';

@Component({
  selector: 'app-alert',
  imports: [CommonModule, HugeiconsIconComponent],
  templateUrl: './alert.html',
  styleUrl: './alert.css',
})
export class Alert {
  alertService = inject(AlertService);
  private renderer = inject(Renderer2);

  TaskDone01Icon = TaskDone01Icon;
  Alert01Icon = Alert01Icon;
  InformationCircleIcon = InformationCircleIcon;
  HelpCircleIcon = HelpCircleIcon;

  constructor() {
    effect(() => {
      const isVisible = this.alertService.state().visible;
      if (isVisible) {
        this.renderer.setStyle(document.body, 'overflow', 'hidden');
      } else {
        this.renderer.removeStyle(document.body, 'overflow');
      }
    });
  }
}

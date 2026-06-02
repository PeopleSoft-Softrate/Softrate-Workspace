import { Injectable, signal } from '@angular/core';

export type AlertType = 'success' | 'error' | 'info' | 'confirm';

export interface AlertState {
  message: string;
  type: AlertType;
  visible: boolean;
  onConfirm?: (result: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  state = signal<AlertState>({
    message: '',
    type: 'info',
    visible: false
  });

  show(message: string, type: AlertType = 'info') {
    // Auto-detect type if not explicitly provided
    if (type === 'info') {
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('fail') || lowerMsg.includes('error') || lowerMsg.includes('reject')) {
        type = 'error';
      } else if (lowerMsg.includes('success') || lowerMsg.includes('approv')) {
        type = 'success';
      }
    }

    this.state.set({ message, type, visible: true });
  }

  confirm(message: string): Promise<boolean> {
    return new Promise(resolve => {
      this.state.set({
        message,
        type: 'confirm',
        visible: true,
        onConfirm: (result: boolean) => {
          this.hide();
          resolve(result);
        }
      });
    });
  }

  submitConfirm(result: boolean) {
    const s = this.state();
    if (s.onConfirm) {
      s.onConfirm(result);
    }
  }

  hide() {
    this.state.update(s => ({ ...s, visible: false }));
  }
}

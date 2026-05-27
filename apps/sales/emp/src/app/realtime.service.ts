import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../environments/environment';

export interface SSEEvent {
  type: string;
  lead?: any;
  bookmark?: any;
  id?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private eventSource: EventSource | null = null;
  private reconnectTimer: any;
  
  // Observable stream for the UI components to subscribe to
  public events$ = new Subject<SSEEvent>();

  constructor(private zone: NgZone) {}

  connect(companyCode: string, phone: string) {
    this.disconnect();

    const url = this.buildEventsUrl();
    url.searchParams.set('companyCode', companyCode);
    url.searchParams.set('phone', phone);

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onmessage = (event) => {
      this.zone.run(() => {
        try {
          const data = JSON.parse(event.data);
          this.events$.next(data);
        } catch (e) {
          console.error('[SSE parse error]', e);
        }
      });
    };

    this.eventSource.onerror = (error) => {
      console.warn('[SSE connection error] Reconnecting in 3s...', error);
      this.disconnect();
      this.reconnectTimer = setTimeout(() => this.connect(companyCode, phone), 3000);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private buildEventsUrl(): URL {
    const configuredBaseUrl = environment.apiBaseUrl || '';

    if (/^https?:\/\//i.test(configuredBaseUrl)) {
      return new URL('/api/events', configuredBaseUrl);
    }

    return new URL(`${configuredBaseUrl}/api/events`, window.location.origin);
  }
}

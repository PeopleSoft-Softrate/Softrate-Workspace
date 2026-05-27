import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;

  constructor() {
    const { url, path } = this.resolveSocketConfig();
    this.socket = io(url, { path });
  }

  on(eventName: string): Observable<any> {
    return new Observable((subscriber) => {
      this.socket.on(eventName, (data) => {
        subscriber.next(data);
      });
    });
  }

  emit(eventName: string, data: any) {
    this.socket.emit(eventName, data);
  }

  joinRoom(roomId: string) {
    this.socket.emit('join-room', roomId);
  }

  private resolveSocketConfig(): { url: string; path: string } {
    if (typeof window === 'undefined') {
      return { url: 'http://localhost:5001', path: '/socket.io' };
    }

    const { hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return { url: 'http://localhost:5001', path: '/socket.io' };
    }

    return { url: origin, path: '/hrms-api/socket.io' };
  }
}

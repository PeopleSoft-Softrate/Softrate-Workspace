import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private readonly baseUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : 'https://peoplesoft-develop.onrender.com';

  constructor() {
    this.socket = io(this.baseUrl);
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
}

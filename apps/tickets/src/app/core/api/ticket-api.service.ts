import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TicketApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.ticketApiBaseUrl;

  get<T>(path: string, token = ''): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { headers: this.headers(token) });
  }

  post<T>(path: string, body: unknown, token = ''): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, { headers: this.headers(token, !(body instanceof FormData)) });
  }

  patch<T>(path: string, body: unknown, token = ''): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, { headers: this.headers(token) });
  }

  private headers(token: string, json = true): HttpHeaders {
    let headers = new HttpHeaders();
    if (json) headers = headers.set('Content-Type', 'application/json');
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }
}

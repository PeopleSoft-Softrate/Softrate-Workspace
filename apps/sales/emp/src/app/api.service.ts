import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly baseUrl = this.resolveBaseUrl(environment.apiBaseUrl);

  private jsonHeaders = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  private resolveBaseUrl(configuredUrl: string): string {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    if (!currentHost || currentHost === 'localhost' || currentHost === '127.0.0.1') {
      return configuredUrl;
    }

    try {
      const url = new URL(configuredUrl);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        url.hostname = currentHost;
        return url.toString().replace(/\/$/, '');
      }
    } catch {
      return configuredUrl;
    }

    return configuredUrl;
  }

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      headers: this.jsonHeaders,
    });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers: this.jsonHeaders,
    });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, {
      headers: this.jsonHeaders,
    });
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, {
      headers: this.jsonHeaders,
    });
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, {
      headers: this.jsonHeaders,
    });
  }
}

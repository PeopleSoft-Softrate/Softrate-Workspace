import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly baseUrl = this.resolveBaseUrl(environment.apiBaseUrl);

  private get headers(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('tracecall_admin_token') || localStorage.getItem('tracecall_emp_token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
      try {
        const rawUser = localStorage.getItem('tracecall_user');
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user.companyCode) {
            headers = headers.set('x-active-company-code', user.companyCode);
          }
        }
      } catch (e) {}
    }
    return headers;
  }

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

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers: this.headers,
    });
  }

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      headers: this.headers,
    });
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, {
      headers: this.headers,
    });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, {
      headers: this.headers,
    });
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, {
      headers: this.headers,
    });
  }
}

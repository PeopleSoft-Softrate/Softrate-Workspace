import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly baseUrl = this.resolveBaseUrl(environment.apiBaseUrl);

  private get headers(): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('tracecall_emp_token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
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

  get<T>(path: string, customHeaders?: { [key: string]: string }): Observable<T> {
    let reqHeaders = this.headers;
    if (customHeaders) {
      Object.keys(customHeaders).forEach(k => { reqHeaders = reqHeaders.set(k, customHeaders[k]); });
    }
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      headers: reqHeaders,
    });
  }

  post<T>(path: string, body: unknown, customHeaders?: { [key: string]: string }): Observable<T> {
    let reqHeaders = this.headers;
    if (customHeaders) {
      Object.keys(customHeaders).forEach(k => { reqHeaders = reqHeaders.set(k, customHeaders[k]); });
    }
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers: reqHeaders,
    });
  }

  patch<T>(path: string, body: unknown, customHeaders?: { [key: string]: string }): Observable<T> {
    let reqHeaders = this.headers;
    if (customHeaders) {
      Object.keys(customHeaders).forEach(k => { reqHeaders = reqHeaders.set(k, customHeaders[k]); });
    }
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, {
      headers: reqHeaders,
    });
  }

  put<T>(path: string, body: unknown, customHeaders?: { [key: string]: string }): Observable<T> {
    let reqHeaders = this.headers;
    if (customHeaders) {
      Object.keys(customHeaders).forEach(k => { reqHeaders = reqHeaders.set(k, customHeaders[k]); });
    }
    return this.http.put<T>(`${this.baseUrl}${path}`, body, {
      headers: reqHeaders,
    });
  }

  delete<T>(path: string, customHeaders?: { [key: string]: string }): Observable<T> {
    let reqHeaders = this.headers;
    if (customHeaders) {
      Object.keys(customHeaders).forEach(k => { reqHeaders = reqHeaders.set(k, customHeaders[k]); });
    }
    return this.http.delete<T>(`${this.baseUrl}${path}`, {
      headers: reqHeaders,
    });
  }
}

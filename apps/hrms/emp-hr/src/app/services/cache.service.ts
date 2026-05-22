import { Injectable } from '@angular/core';
import { HttpResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class HttpCacheService {
  private cache = new Map<string, { response: HttpResponse<any>, expiry: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  put(url: string, response: HttpResponse<any>): void {
    const expiry = Date.now() + this.CACHE_DURATION;
    this.cache.set(url, { response, expiry });
  }

  get(url: string): HttpResponse<any> | null {
    const entry = this.cache.get(url);
    
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(url);
      return null;
    }

    return entry.response;
  }

  clear(): void {
    this.cache.clear();
  }
}

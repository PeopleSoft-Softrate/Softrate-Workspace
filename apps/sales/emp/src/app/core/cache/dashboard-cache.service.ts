import { Injectable } from '@angular/core';

export interface DashboardCacheEntry<T> {
  data: T;
  expiresAt: number;
  savedAt: number;
  version: number;
}

export interface DashboardCacheWriteOptions {
  ttlMs?: number;
}

type DashboardCachePredicate = string | ((key: string) => boolean);

@Injectable({ providedIn: 'root' })
export class DashboardCacheService {
  private readonly storagePrefix = 'dv-dashboard-cache:v1:';
  private readonly version = 1;
  private readonly defaultTtlMs = 5 * 60 * 1000;
  private readonly memoryCache = new Map<string, DashboardCacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.getEntry<T>(key);
    return entry ? entry.data : null;
  }

  getEntry<T>(key: string): DashboardCacheEntry<T> | null {
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (this.isExpired(memoryEntry)) {
        this.deleteKey(key);
        return null;
      }
      return memoryEntry as DashboardCacheEntry<T>;
    }

    const storageKey = this.storageKey(key);
    if (typeof localStorage === 'undefined') return null;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DashboardCacheEntry<T>;
      if (!this.isValidEntry(parsed) || this.isExpired(parsed)) {
        localStorage.removeItem(storageKey);
        return null;
      }
      this.memoryCache.set(key, parsed as DashboardCacheEntry<unknown>);
      return parsed;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  set<T>(key: string, data: T, options?: DashboardCacheWriteOptions): void {
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;
    const entry: DashboardCacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
      savedAt: Date.now(),
      version: this.version,
    };
    this.memoryCache.set(key, entry as DashboardCacheEntry<unknown>);

    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify(entry));
    } catch {
      // Ignore quota/storage errors and keep the in-memory copy.
    }
  }

  isFresh(key: string): boolean {
    return !!this.getEntry(key);
  }

  invalidate(match: DashboardCachePredicate): void {
    const predicate = this.toPredicate(match);
    for (const key of Array.from(this.memoryCache.keys())) {
      if (predicate(key)) this.memoryCache.delete(key);
    }

    if (typeof localStorage === 'undefined') return;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey || !storageKey.startsWith(this.storagePrefix)) continue;
      const key = storageKey.slice(this.storagePrefix.length);
      if (predicate(key)) localStorage.removeItem(storageKey);
    }
  }

  clearAll(): void {
    this.invalidate(() => true);
  }

  private deleteKey(key: string): void {
    this.memoryCache.delete(key);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey(key));
    }
  }

  private storageKey(key: string): string {
    return `${this.storagePrefix}${key}`;
  }

  private toPredicate(match: DashboardCachePredicate): (key: string) => boolean {
    if (typeof match === 'string') {
      return (key) => key.startsWith(match);
    }
    return match;
  }

  private isExpired(entry: DashboardCacheEntry<unknown>): boolean {
    return entry.expiresAt <= Date.now();
  }

  private isValidEntry(entry: DashboardCacheEntry<unknown> | null | undefined): entry is DashboardCacheEntry<unknown> {
    return !!entry
      && typeof entry.version === 'number'
      && typeof entry.savedAt === 'number'
      && typeof entry.expiresAt === 'number';
  }
}

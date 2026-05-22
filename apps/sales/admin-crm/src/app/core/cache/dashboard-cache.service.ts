import { Injectable } from '@angular/core';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  cachedAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardCacheService {
  private readonly storagePrefix = 'dv-admin-dashboard-cache:v1:';
  private readonly memory = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const now = Date.now();
    const memoryEntry = this.memory.get(key) as CacheEntry<T> | undefined;
    if (memoryEntry) {
      if (memoryEntry.expiresAt > now) return memoryEntry.value;
      this.memory.delete(key);
    }

    const storageKey = this.storageKey(key);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (!parsed || parsed.expiresAt <= now) {
        localStorage.removeItem(storageKey);
        return null;
      }
      this.memory.set(key, parsed);
      return parsed.value;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  getMetadata(key: string): { cachedAt: number; expiresAt: number } | null {
    const entry = this.getEntry<unknown>(key);
    return entry ? { cachedAt: entry.cachedAt, expiresAt: entry.expiresAt } : null;
  }

  set<T>(key: string, value: T, options: { ttlMs: number }): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      cachedAt: now,
      expiresAt: now + options.ttlMs,
    };
    this.memory.set(key, entry);
    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify(entry));
    } catch {
      this.memory.set(key, entry);
    }
  }

  removeByPrefix(prefix: string): void {
    Array.from(this.memory.keys())
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => this.memory.delete(key));

    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const storageKey = localStorage.key(index);
        if (storageKey?.startsWith(this.storageKey(prefix))) {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // Ignore storage failures; memory cache is already cleared.
    }
  }

  private getEntry<T>(key: string): CacheEntry<T> | null {
    const now = Date.now();
    const memoryEntry = this.memory.get(key) as CacheEntry<T> | undefined;
    if (memoryEntry) return memoryEntry.expiresAt > now ? memoryEntry : null;

    try {
      const raw = localStorage.getItem(this.storageKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (!parsed || parsed.expiresAt <= now) return null;
      this.memory.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  private storageKey(key: string): string {
    return `${this.storagePrefix}${key}`;
  }
}

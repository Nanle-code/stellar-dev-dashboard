import { CachePolicyType } from './cachePolicyPredictor';

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  ttlMs: number;
}

export class DynamicCacheController<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private activePolicy: CachePolicyType = 'LRU';
  private defaultTtlMs = 300000; // 5 minutes default
  private maxCapacity = 100;

  public setPolicy(policy: CachePolicyType, ttlSeconds?: number): void {
    this.activePolicy = policy;
    if (ttlSeconds) {
      this.defaultTtlMs = ttlSeconds * 1000;
    }
  }

  public getActivePolicy(): CachePolicyType {
    return this.activePolicy;
  }

  public get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.createdAt > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.lastAccessed = now;
    entry.accessCount++;
    return entry.value;
  }

  public set(key: string, value: T, customTtlSeconds?: number): void {
    if (this.cache.size >= this.maxCapacity && !this.cache.has(key)) {
      this.evict();
    }

    const ttlMs = customTtlSeconds ? customTtlSeconds * 1000 : this.defaultTtlMs;
    const now = Date.now();

    this.cache.set(key, {
      value,
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      ttlMs,
    });
  }

  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string | null = null;

    if (this.activePolicy === 'LFU') {
      let minFreq = Infinity;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.accessCount < minFreq) {
          minFreq = entry.accessCount;
          keyToEvict = key;
        }
      }
    } else {
      // Default LRU or ADAPTIVE_TTL
      let oldestAccess = Infinity;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestAccess) {
          oldestAccess = entry.lastAccessed;
          keyToEvict = key;
        }
      }
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
    }
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}
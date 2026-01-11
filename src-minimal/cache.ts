/**
 * Ultra-Minimal In-Memory Cache
 * Replaces Redis (400 lines → 50 lines)
 */
import { CacheEntry } from './types';

const cache = new Map<string, CacheEntry<any>>();

/**
 * Get cached value
 */
export function get<T>(key: string): T | null {
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  // Check if expired
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Set cached value with TTL in seconds
 */
export function set<T>(key: string, data: T, ttlSeconds: number): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Delete cached value
 */
export function del(key: string): void {
  cache.delete(key);
}

/**
 * Clear all cache
 */
export function clear(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

/**
 * Clean up expired entries
 */
export function cleanup(): void {
  const now = Date.now();
  let removed = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (entry.expires < now) {
      cache.delete(key);
      removed++;
    }
  }
  
  if (removed > 0) {
    console.log(`🧹 Cache cleanup: removed ${removed} expired entries`);
  }
}

// Auto cleanup every 5 minutes
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanup, 300000); // 5 minutes
}

export function stopCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

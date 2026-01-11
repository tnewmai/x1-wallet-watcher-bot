// In-memory cache for RPC results to speed up repeated scans
// Caches expire after a configurable TTL
import { createLogger } from './logger';

const logger = createLogger('Cache');

interface CacheEntry<T> {
  data: T;
  expiry: number;
  hits?: number; // Track cache hits for optimization
}

// Request deduplication - prevent duplicate in-flight requests
const inflightRequests: Map<string, Promise<any>> = new Map();

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number = 5000; // Increased for better performance
  private hits: number = 0;
  private misses: number = 0;
  
  // Set with TTL in seconds
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      expiry: Date.now() + (ttlSeconds * 1000),
    });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Track hit
    entry.hits = (entry.hits || 0) + 1;
    this.hits++;
    
    return entry.data as T;
  }
  
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Get cache stats
  stats(): { size: number; maxSize: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    return { 
      size: this.cache.size, 
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }
  
  // Clean expired entries (run periodically)
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Global cache instance
export const cache = new MemoryCache();

// Cache key generators
export const CacheKeys = {
  // Wallet data - short TTL as balances change
  walletSignatures: (address: string) => `sigs:${address}`,
  walletBalance: (address: string) => `bal:${address}`,
  
  // Transaction data - long TTL as transactions are immutable
  transaction: (signature: string) => `tx:${signature}`,
  
  // Deployer data - medium TTL
  deployerStatus: (address: string) => `deployer:${address}`,
  tokenAnalysis: (mint: string) => `token:${mint}`,
  
  // Security scan results - short TTL
  securityScan: (address: string) => `security:${address}`,
  rugCheck: (address: string) => `rug:${address}`,
  
  // Token info - long TTL as metadata rarely changes
  tokenInfo: (mint: string) => `info:${mint}`,
  tokenPrice: (mint: string) => `price:${mint}`,
};

// TTL values in seconds - optimized for performance
export const CacheTTL = {
  VERY_SHORT: 30,      // 30 seconds - for balance data
  SHORT: 300,          // 5 minutes - for security scans
  MEDIUM: 1800,        // 30 minutes - for deployer checks (increased)
  LONG: 7200,          // 2 hours - for token metadata (increased)
  VERY_LONG: 86400,    // 24 hours - for immutable data like transactions
};

// Helper to run with cache and request deduplication
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  // Check if there's already an in-flight request for this key
  const inflight = inflightRequests.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }
  
  // Create new request and track it
  const promise = (async () => {
    try {
      const data = await fetcher();
      cache.set(key, data, ttl);
      return data;
    } finally {
      // Remove from in-flight tracking
      inflightRequests.delete(key);
    }
  })();
  
  inflightRequests.set(key, promise);
  return promise;
}

// Batch helper - run multiple async operations with concurrency limit
export async function batchAsync<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  
  return results;
}

// Parallel helper with error handling - run all and collect results
export async function parallelAsync<T>(
  tasks: (() => Promise<T>)[],
  options: { 
    concurrency?: number;
    onError?: 'skip' | 'throw';
  } = {}
): Promise<T[]> {
  const { concurrency = 10, onError = 'skip' } = options;
  const results: T[] = [];
  
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchPromises = batch.map(async (task): Promise<T | null> => {
      try {
        return await task();
      } catch (error) {
        if (onError === 'throw') throw error;
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    for (const r of batchResults) {
      if (r !== null) {
        results.push(r);
      }
    }
  }
  
  return results;
}

// Periodic cache cleanup
let cleanupInterval: NodeJS.Timeout | null = null;
export function startCacheCleanup(intervalMs: number = 300000): void { // Every 5 minutes
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const cleaned = cache.cleanExpired();
    if (cleaned > 0) {
      logger.info(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
    }
  }, intervalMs);
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Get cache statistics
export function getCacheStats() {
  return {
    cache: cache.stats(),
    inflightRequests: inflightRequests.size
  };
}

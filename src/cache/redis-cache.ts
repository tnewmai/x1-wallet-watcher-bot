/**
 * Redis Cache Layer
 * Distributed caching for horizontal scaling
 */

import Redis from 'ioredis';
import logger from '../logger';
import { CACHE_TTL_SHORT, CACHE_TTL_MEDIUM, CACHE_TTL_LONG } from '../constants';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  prefix?: string;
}

/**
 * Redis Cache Manager
 */
export class RedisCache {
  private client: Redis;
  private readonly defaultTTL = CACHE_TTL_MEDIUM;
  private readonly keyPrefix = 'x1bot:';
  private connected = false;

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('🔗 Redis connecting...');
    });

    this.client.on('ready', () => {
      this.connected = true;
      logger.info('✅ Redis connected and ready');
    });

    this.client.on('error', (error) => {
      logger.error('❌ Redis error:', error);
      this.connected = false;
    });

    this.client.on('close', () => {
      this.connected = false;
      logger.warn('⚠️ Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected && this.client.status === 'ready';
  }

  /**
   * Generate full cache key with prefix
   */
  private getKey(key: string, prefix?: string): string {
    const customPrefix = prefix || this.keyPrefix;
    return `${customPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.isConnected()) {
      logger.warn('Redis not connected, cache miss');
      return null;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch (parseError) {
        logger.error(`Invalid JSON in cache for key ${key}:`, parseError);
        // Delete corrupted cache entry
        await this.delete(key, options);
        return null;
      }
    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected()) {
      logger.warn('Redis not connected, cache set skipped');
      return false;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      const serialized = JSON.stringify(value);
      const ttl = options?.ttl || this.defaultTTL;
      
      await this.client.set(fullKey, serialized, 'PX', ttl);
      return true;
    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      logger.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    if (!this.isConnected()) {
      return keys.map(() => null);
    }

    try {
      const fullKeys = keys.map(k => this.getKey(k, options?.prefix));
      const values = await this.client.mget(...fullKeys);
      
      return values.map(v => v ? JSON.parse(v) as T : null);
    } catch (error) {
      logger.error('Error getting multiple cache keys:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset<T>(data: Record<string, T>, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      const pipeline = this.client.pipeline();
      const ttl = options?.ttl || this.defaultTTL;

      for (const [key, value] of Object.entries(data)) {
        const fullKey = this.getKey(key, options?.prefix);
        const serialized = JSON.stringify(value);
        pipeline.set(fullKey, serialized, 'PX', ttl);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Error setting multiple cache keys:', error);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, by: number = 1, options?: CacheOptions): Promise<number> {
    if (!this.isConnected()) {
      return 0;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      const result = await this.client.incrby(fullKey, by);
      
      // Set expiry if TTL provided
      if (options?.ttl) {
        await this.client.pexpire(fullKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error incrementing cache key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get and delete (atomic operation)
   */
  async getAndDelete<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      const value = await this.client.getdel(fullKey);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Error getting and deleting cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear all keys with a pattern
   */
  async clearPattern(pattern: string, options?: CacheOptions): Promise<number> {
    if (!this.isConnected()) {
      return 0;
    }

    try {
      const fullPattern = this.getKey(pattern, options?.prefix);
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(...keys);
      return result;
    } catch (error) {
      logger.error(`Error clearing cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string, options?: CacheOptions): Promise<number> {
    if (!this.isConnected()) {
      return -1;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      return await this.client.pttl(fullKey);
    } catch (error) {
      logger.error(`Error getting TTL for cache key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Set expiry for existing key
   */
  async expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      const result = await this.client.pexpire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error(`Error setting expiry for cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    keys: number;
    memory: number;
    hits: number;
    misses: number;
  }> {
    if (!this.isConnected()) {
      return { keys: 0, memory: 0, hits: 0, misses: 0 };
    }

    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      
      // Parse info strings
      const getStatValue = (str: string, key: string): number => {
        const match = str.match(new RegExp(`${key}:(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      };

      return {
        keys: await this.client.dbsize(),
        memory: getStatValue(memory, 'used_memory'),
        hits: getStatValue(info, 'keyspace_hits'),
        misses: getStatValue(info, 'keyspace_misses'),
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return { keys: 0, memory: 0, hits: 0, misses: 0 };
    }
  }

  /**
   * Flush all cache
   */
  async flushAll(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      await this.client.flushall();
      logger.warn('⚠️ Redis cache flushed');
      return true;
    } catch (error) {
      logger.error('Error flushing cache:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis connection closed');
    }
  }

  /**
   * Ping Redis
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let redisCacheInstance: RedisCache | null = null;

/**
 * Get Redis cache instance
 */
export function getRedisCache(): RedisCache {
  if (!redisCacheInstance) {
    redisCacheInstance = new RedisCache();
  }
  return redisCacheInstance;
}

/**
 * Initialize Redis cache
 */
export async function initRedisCache(): Promise<RedisCache> {
  const cache = getRedisCache();
  
  // Wait for connection
  let attempts = 0;
  while (!cache.isConnected() && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  
  if (cache.isConnected()) {
    logger.info('✅ Redis cache initialized');
  } else {
    logger.warn('⚠️ Redis cache not connected, running in degraded mode');
  }
  
  return cache;
}

export default getRedisCache;

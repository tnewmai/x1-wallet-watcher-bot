// Production-grade rate limiting and backpressure handling
import { Context } from 'grammy';
import { createLogger } from './logger';
import { Metrics } from './metrics';

const logger = createLogger('RateLimit');

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly blockDurationMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxRequests: number = 30, windowMs: number = 60000, blockDurationMs: number = 300000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.blockDurationMs = blockDurationMs;

    // Start cleanup interval to remove old entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request should be allowed
   */
  checkLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // Check if blocked
    if (entry?.blocked) {
      if (now < entry.resetTime) {
        logger.debug('Request blocked (rate limit exceeded)', { key, resetTime: entry.resetTime });
        return { allowed: false, remaining: 0, resetTime: entry.resetTime };
      } else {
        // Unblock
        entry.blocked = false;
        entry.count = 0;
        entry.resetTime = now + this.windowMs;
      }
    }

    // Create new entry if doesn't exist or window expired
    if (!entry || now >= entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.windowMs,
        blocked: false,
      };
      this.limits.set(key, newEntry);
      return { allowed: true, remaining: this.maxRequests - 1, resetTime: newEntry.resetTime };
    }

    // Increment count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > this.maxRequests) {
      entry.blocked = true;
      entry.resetTime = now + this.blockDurationMs;
      logger.warn('Rate limit exceeded, blocking user', { key, blockDuration: this.blockDurationMs });
      Metrics.commandReceived('rate_limit_exceeded');
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    return { allowed: true, remaining: this.maxRequests - entry.count, resetTime: entry.resetTime };
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime && !entry.blocked) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up rate limit entries', { cleaned });
    }
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get statistics
   */
  getStats(): { totalTracked: number; blocked: number } {
    let blocked = 0;
    for (const entry of this.limits.values()) {
      if (entry.blocked) blocked++;
    }
    return {
      totalTracked: this.limits.size,
      blocked,
    };
  }
}

// Global rate limiters
const userRateLimiter = new RateLimiter(30, 60000, 300000); // 30 requests per minute
const commandRateLimiter = new RateLimiter(10, 60000, 60000); // 10 commands per minute per user

/**
 * Grammy middleware for rate limiting
 */
export function rateLimit() {
  return async (ctx: Context, next: () => Promise<void>) => {
    if (!ctx.from?.id) {
      return next();
    }

    const userId = ctx.from.id.toString();
    const result = userRateLimiter.checkLimit(userId);

    if (!result.allowed) {
      const waitSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
      logger.warn('Rate limit blocked request', { userId, waitSeconds });
      
      await ctx.reply(
        `⚠️ Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`,
        { reply_to_message_id: ctx.message?.message_id }
      ).catch(() => {
        // Ignore errors when replying to rate-limited users
      });
      
      return; // Don't call next()
    }

    // Add rate limit headers to context (for logging)
    (ctx as any).rateLimit = {
      remaining: result.remaining,
      resetTime: result.resetTime,
    };

    return next();
  };
}

/**
 * Command-specific rate limiting (stricter)
 */
export function commandRateLimit() {
  return async (ctx: Context, next: () => Promise<void>) => {
    if (!ctx.from?.id) {
      return next();
    }

    const userId = ctx.from.id.toString();
    const result = commandRateLimiter.checkLimit(userId);

    if (!result.allowed) {
      const waitSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
      logger.warn('Command rate limit blocked request', { userId, waitSeconds });
      
      await ctx.reply(
        `⚠️ Too many commands. Please wait ${waitSeconds} seconds.`,
        { reply_to_message_id: ctx.message?.message_id }
      ).catch(() => {});
      
      return;
    }

    return next();
  };
}

/**
 * Stop all rate limiters
 */
export function stopRateLimiters(): void {
  userRateLimiter.stop();
  commandRateLimiter.stop();
  logger.info('Rate limiters stopped');
}

/**
 * Get rate limiter statistics
 */
export function getRateLimitStats(): {
  user: { totalTracked: number; blocked: number };
  command: { totalTracked: number; blocked: number };
} {
  return {
    user: userRateLimiter.getStats(),
    command: commandRateLimiter.getStats(),
  };
}

// Backpressure handler for async operations
export class BackpressureQueue<T> {
  private queue: Array<() => Promise<T>> = [];
  private processing = false;
  private readonly concurrency: number;
  private activeCount = 0;
  private readonly logger = createLogger('BackpressureQueue');

  constructor(concurrency: number = 5) {
    this.concurrency = concurrency;
  }

  /**
   * Add task to queue
   */
  async add(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      });

      this.process();
    });
  }

  /**
   * Process queue with concurrency control
   */
  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeCount < this.concurrency) {
      const task = this.queue.shift();
      if (!task) continue;

      this.activeCount++;
      
      task()
        .catch((error) => {
          this.logger.error('Queue task failed', error);
        })
        .finally(() => {
          this.activeCount--;
          this.process();
        });
    }

    if (this.activeCount === 0) {
      this.processing = false;
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): { queued: number; active: number; concurrency: number } {
    return {
      queued: this.queue.length,
      active: this.activeCount,
      concurrency: this.concurrency,
    };
  }
}

// Enhanced memory monitoring with automatic cleanup
import { createLogger } from './logger';

const logger = createLogger('MemoryMonitor');

let monitorInterval: NodeJS.Timeout | null = null;
let lastCleanupTime = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function startMemoryMonitor(): void {
  if (monitorInterval) {
    logger.warn('Memory monitor already running');
    return;
  }

  logger.info('Starting enhanced memory monitor');

  // Check memory every 30 seconds
  monitorInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const percentUsed = Math.round((usedMB / totalMB) * 100);

    // Log current memory usage
    if (percentUsed > 70) {
      logger.info('Memory usage check', { usedMB, totalMB, percentUsed });
    }

    // Alert if memory usage is high (>80%)
    if (percentUsed > 80) {
      logger.warn('High memory usage detected', { usedMB, totalMB, percentUsed });

      // Perform periodic cleanup if it's been a while
      const timeSinceCleanup = Date.now() - lastCleanupTime;
      if (timeSinceCleanup > CLEANUP_INTERVAL) {
        performRoutineCleanup();
        lastCleanupTime = Date.now();
      }

      // If critically high (>90%), trigger garbage collection if available
      if (percentUsed > 90 && global.gc) {
        logger.warn('Triggering garbage collection due to critical memory usage');
        try {
          global.gc();
          const afterGC = process.memoryUsage();
          const afterMB = Math.round(afterGC.heapUsed / 1024 / 1024);
          logger.info('Garbage collection completed', { beforeMB: usedMB, afterMB });
        } catch (e) {
          logger.error('Failed to run garbage collection:', e);
        }
      }

      // If dangerously high (>95%), perform emergency cleanup
      if (percentUsed > 95) {
        logger.error('CRITICAL: Memory usage above 95% - performing emergency cleanup');
        performEmergencyCleanup();
      }
    }
  }, 30000); // Every 30 seconds

  logger.info('Memory monitor started (checking every 30s)');
}

export function stopMemoryMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('Memory monitor stopped');
  }
}

function performRoutineCleanup(): void {
  logger.info('Performing routine memory cleanup');
  
  try {
    // Clean old wallet data
    const { cleanupOldWalletData } = require('./watcher');
    cleanupOldWalletData();
    logger.info('Cleaned old wallet data');
  } catch (error: any) {
    logger.warn('Failed to clean wallet data', { error: error.message });
  }

  try {
    // Clean expired cache entries
    const { cache } = require('./cache');
    const cleaned = cache.cleanExpired();
    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} expired cache entries`);
    }
  } catch (error: any) {
    logger.warn('Failed to clean cache', { error: error.message });
  }

  // Trigger garbage collection if available
  if (global.gc) {
    try {
      global.gc();
      logger.info('Triggered garbage collection');
    } catch (e) {
      // Ignore
    }
  }
}

function performEmergencyCleanup(): void {
  logger.error('EMERGENCY: Performing aggressive memory cleanup');

  try {
    // Clear entire cache
    const { cache } = require('./cache');
    const beforeSize = cache.stats().size;
    cache.clear();
    logger.info(`Emergency cleanup: cleared ${beforeSize} cache entries`);
  } catch (error: any) {
    logger.error('Failed to clear cache', { error: error.message });
  }

  try {
    // Trigger wallet data cleanup
    const { cleanupOldWalletData, checkMemoryLimits } = require('./watcher');
    cleanupOldWalletData();
    
    const limits = checkMemoryLimits();
    if (!limits.ok) {
      logger.error('Memory limits exceeded', { warnings: limits.warnings });
    }
    
    logger.info('Emergency cleanup: cleaned old wallet data');
  } catch (cleanupError: any) {
    logger.error('Emergency cleanup failed', { error: cleanupError.message });
  }

  // Force garbage collection multiple times
  if (global.gc) {
    try {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      global.gc(); // Second pass
      const after = process.memoryUsage().heapUsed;
      const freedMB = Math.round((before - after) / 1024 / 1024);
      logger.info(`Emergency GC freed ${freedMB}MB`);
    } catch (e: any) {
      logger.error('Failed emergency GC', { error: e.message });
    }
  } else {
    logger.warn('Garbage collection not available. Start Node with --expose-gc for manual GC');
  }
}

export function getMemoryStats() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
    rssMB: Math.round(usage.rss / 1024 / 1024),
    externalMB: Math.round(usage.external / 1024 / 1024),
    percentUsed: Math.round((usage.heapUsed / usage.heapTotal) * 100),
  };
}

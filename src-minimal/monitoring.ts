/**
 * Minimal Monitoring & Health Check
 * Replaces 5 files (800+ lines) → 100 lines
 */
import http from 'http';
import { createLogger } from './logger';
import { config } from './config';
import { testConnection } from './blockchain';
import { getWatcherStats } from './watcher';
import { getStats as getStorageStats } from './storage';
import { getStats as getCacheStats } from './cache';

const logger = createLogger('Monitoring');

let healthServer: http.Server | null = null;
let isReady = false;

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: number;
  checks: {
    rpc: boolean;
    watcher: boolean;
    storage: boolean;
  };
  stats: {
    storage: any;
    watcher: any;
    cache: any;
  };
}

/**
 * Start health check HTTP server
 */
export function startHealthServer(): void {
  if (healthServer) {
    logger.warn('Health server already running');
    return;
  }
  
  healthServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.url === '/health' || req.url === '/') {
      const health = await getHealth();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.writeHead(statusCode);
      res.end(JSON.stringify(health, null, 2));
    } else if (req.url === '/ready') {
      res.writeHead(isReady ? 200 : 503);
      res.end(JSON.stringify({ ready: isReady }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
  
  healthServer.listen(config.healthCheckPort, () => {
    logger.info(`Health server listening on port ${config.healthCheckPort}`);
    console.log(`🏥 Health check: http://localhost:${config.healthCheckPort}/health`);
  });
}

/**
 * Stop health server
 */
export function stopHealthServer(): void {
  if (healthServer) {
    healthServer.close();
    healthServer = null;
    logger.info('Health server stopped');
  }
}

/**
 * Mark service as ready
 */
export function markReady(): void {
  isReady = true;
  logger.info('Service marked as ready');
}

/**
 * Get health status
 */
async function getHealth(): Promise<HealthStatus> {
  const checks = {
    rpc: false,
    watcher: false,
    storage: true, // Storage is always available (file-based)
  };
  
  // Check RPC
  try {
    checks.rpc = await testConnection();
  } catch (error) {
    checks.rpc = false;
  }
  
  // Check watcher
  const watcherStats = getWatcherStats();
  checks.watcher = watcherStats.isWatching;
  
  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (!checks.rpc || !checks.watcher) {
    status = 'degraded';
  }
  if (!checks.rpc && !checks.watcher) {
    status = 'unhealthy';
  }
  
  return {
    status,
    uptime: process.uptime(),
    timestamp: Date.now(),
    checks,
    stats: {
      storage: getStorageStats(),
      watcher: watcherStats,
      cache: getCacheStats(),
    },
  };
}

/**
 * Log system stats
 */
export function logStats(): void {
  const memory = process.memoryUsage();
  const stats = {
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
    },
    storage: getStorageStats(),
    watcher: getWatcherStats(),
  };
  
  logger.info('System stats', stats);
}

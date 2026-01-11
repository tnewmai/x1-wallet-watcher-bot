// Production-grade health checks and readiness probes for Kubernetes/orchestrators
import http from 'http';
import { config } from './config';
import { createLogger } from './logger';
import { getConnection } from './blockchain';

const logger = createLogger('HealthCheck');

// Health check state
interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    rpc: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    storage: { status: 'ok' | 'error'; error?: string };
    memory: { status: 'ok' | 'warning'; usedMB: number; percentUsed: number };
    bot: { status: 'ok' | 'error'; error?: string };
  };
  version: string;
  environment: string;
}

interface ReadinessStatus {
  ready: boolean;
  timestamp: string;
  checks: {
    rpc: boolean;
    storage: boolean;
    bot: boolean;
  };
}

let isReady = false;
let botInstance: any = null;
let server: http.Server | null = null;
const startTime = Date.now();

/**
 * Mark the service as ready to accept traffic
 */
export function markReady(): void {
  isReady = true;
  logger.info('Service marked as READY');
}

/**
 * Mark the service as not ready (used during shutdown)
 */
export function markNotReady(): void {
  isReady = false;
  logger.info('Service marked as NOT READY');
}

/**
 * Set bot instance for health checks
 */
export function setBotInstance(bot: any): void {
  botInstance = bot;
}

/**
 * Check RPC connection health
 */
async function checkRpcHealth(): Promise<{ status: 'ok' | 'error'; latencyMs?: number; error?: string }> {
  try {
    const start = Date.now();
    const conn = getConnection();
    
    // Quick health check - get slot
    await Promise.race([
      conn.getSlot(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    
    const latencyMs = Date.now() - start;
    return { status: 'ok', latencyMs };
  } catch (error: any) {
    logger.warn('RPC health check failed', { error: error.message });
    return { status: 'error', error: error.message };
  }
}

/**
 * Check storage health
 */
function checkStorageHealth(): { status: 'ok' | 'error'; error?: string } {
  try {
    const { loadStorage } = require('./storage');
    loadStorage(); // This will throw if storage is corrupted
    return { status: 'ok' };
  } catch (error: any) {
    logger.error('Storage health check failed', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Check memory usage
 */
function checkMemoryHealth(): { status: 'ok' | 'warning'; usedMB: number; percentUsed: number } {
  const usage = process.memoryUsage();
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const percentUsed = Math.round((usage.heapUsed / usage.heapTotal) * 100);
  
  // Warn if using more than 80% of heap
  const status = percentUsed > 80 ? 'warning' : 'ok';
  
  if (status === 'warning') {
    logger.warn('High memory usage detected', { usedMB, totalMB, percentUsed });
  }
  
  return { status, usedMB, percentUsed };
}

/**
 * Check bot health
 */
function checkBotHealth(): { status: 'ok' | 'error'; error?: string } {
  if (!botInstance) {
    return { status: 'error', error: 'Bot not initialized' };
  }
  
  // Check if bot is running (has token)
  if (!botInstance.token) {
    return { status: 'error', error: 'Bot token not set' };
  }
  
  return { status: 'ok' };
}

/**
 * Get full health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const [rpc, storage, memory, bot] = await Promise.all([
    checkRpcHealth(),
    Promise.resolve(checkStorageHealth()),
    Promise.resolve(checkMemoryHealth()),
    Promise.resolve(checkBotHealth()),
  ]);
  
  // Determine overall status
  let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
  
  if (rpc.status === 'error' || storage.status === 'error' || bot.status === 'error') {
    status = 'unhealthy';
  } else if (memory.status === 'warning') {
    status = 'degraded';
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
    checks: { rpc, storage, memory, bot },
    version: '1.0.0',
    environment: config.nodeEnv,
  };
}

/**
 * Get readiness status (for Kubernetes readiness probe)
 */
export function getReadinessStatus(): ReadinessStatus {
  const storage = checkStorageHealth();
  const bot = checkBotHealth();
  
  return {
    ready: isReady && storage.status === 'ok' && bot.status === 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      rpc: true, // RPC check is async, assume ok for readiness
      storage: storage.status === 'ok',
      bot: bot.status === 'ok',
    },
  };
}

/**
 * Get liveness status (for Kubernetes liveness probe)
 */
export function getLivenessStatus(): { alive: boolean; timestamp: string } {
  // Simple check - if process is running, it's alive
  // More sophisticated checks could be added here
  return {
    alive: true,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Start health check HTTP server
 */
export function startHealthCheckServer(): void {
  if (!config.healthCheckEnabled) {
    logger.info('Health check server disabled');
    return;
  }
  
  server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    try {
      // Route handling
      if (req.url === '/health' || req.url === '/healthz') {
        // Full health check
        const health = await getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else if (req.url === '/ready' || req.url === '/readiness') {
        // Readiness probe (Kubernetes)
        const readiness = getReadinessStatus();
        const statusCode = readiness.ready ? 200 : 503;
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(readiness, null, 2));
      } else if (req.url === '/live' || req.url === '/liveness') {
        // Liveness probe (Kubernetes)
        const liveness = getLivenessStatus();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(liveness, null, 2));
      } else if (req.url === '/metrics') {
        // Basic metrics endpoint (can be enhanced with Prometheus format)
        const health = await getHealthStatus();
        const metrics = {
          uptime_seconds: Math.floor(health.uptime / 1000),
          memory_used_mb: health.checks.memory.usedMB,
          memory_percent: health.checks.memory.percentUsed,
          rpc_latency_ms: health.checks.rpc.latencyMs || 0,
          status: health.status,
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics, null, 2));
      } else {
        // 404 for unknown endpoints
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error: any) {
      logger.error('Health check endpoint error', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
  
  server.listen(config.healthCheckPort, () => {
    logger.info(`Health check server listening on port ${config.healthCheckPort}`, {
      endpoints: [
        `http://localhost:${config.healthCheckPort}/health`,
        `http://localhost:${config.healthCheckPort}/ready`,
        `http://localhost:${config.healthCheckPort}/live`,
        `http://localhost:${config.healthCheckPort}/metrics`,
      ],
    });
  });
  
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.healthCheckPort} is already in use`, error);
    } else {
      logger.error('Health check server error', error);
    }
  });
}

/**
 * Stop health check server
 */
export function stopHealthCheckServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    
    server.close(() => {
      logger.info('Health check server stopped');
      resolve();
    });
  });
}

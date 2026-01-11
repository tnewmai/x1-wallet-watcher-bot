import http from 'http';
import { config } from './config';
import { monitoring } from './monitoring';
import { isConnected } from './blockchain';
import { createLogger } from './logger';

const logger = createLogger('Healthcheck');

// Simple HTTP health check server
export function startHealthCheckServer(): http.Server | null {
  if (!config.healthCheckEnabled) {
    logger.info('ℹ️  Health check server disabled');
    return null;
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';

    // Health check endpoint
    if (url === '/health' || url === '/') {
      const health = monitoring.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: health.status,
        uptime: health.uptime,
        checks: health.checks,
        timestamp: new Date().toISOString(),
      }, null, 2));
    }
    // Liveness probe (for k8s/docker)
    else if (url === '/live') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    }
    // Readiness probe (checks if bot can serve traffic)
    else if (url === '/ready') {
      const health = monitoring.getHealthStatus();
      const isReady = health.status !== 'unhealthy' && health.checks.watcherActive;
      const statusCode = isReady ? 200 : 503;

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ready: isReady,
        status: health.status,
        timestamp: new Date().toISOString(),
      }, null, 2));
    }
    // Detailed metrics endpoint
    else if (url === '/metrics') {
      const metrics = monitoring.getMetrics();
      const health = monitoring.getHealthStatus();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        health: health,
        metrics: metrics,
        timestamp: new Date().toISOString(),
      }, null, 2));
    }
    // RPC connectivity check
    else if (url === '/rpc-check') {
      try {
        const connected = await isConnected();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          connected,
          rpcUrl: config.x1RpcUrl,
          timestamp: new Date().toISOString(),
        }, null, 2));
      } catch (error) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          connected: false,
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        }, null, 2));
      }
    }
    // 404 for unknown routes
    else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Not Found',
        availableEndpoints: ['/health', '/live', '/ready', '/metrics', '/rpc-check'],
      }, null, 2));
    }
  });

  server.listen(config.healthCheckPort, () => {
    logger.info(`✅ Health check server running on http://localhost:${config.healthCheckPort}`);
    logger.info(`   Endpoints:`);
    logger.info(`   - /health      - Overall health status`);
    logger.info(`   - /live        - Liveness probe`);
    logger.info(`   - /ready       - Readiness probe`);
    logger.info(`   - /metrics     - Detailed metrics`);
    logger.info(`   - /rpc-check   - RPC connectivity`);
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.warn(`⚠️ Health check port ${config.healthCheckPort} already in use`);
    } else {
      logger.error('Health check server error:', error);
    }
  });

  return server;
}

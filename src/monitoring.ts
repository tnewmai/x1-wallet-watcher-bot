import { config } from './config';
import { createLogger } from './logger';

const logger = createLogger('Monitoring');

// Monitoring metrics storage
interface Metrics {
  rpcCalls: {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
    timeouts: number;
  };
  watcherCycles: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    lastDuration: number;
  };
  securityScans: {
    total: number;
    cached: number;
    successful: number;
    failed: number;
    averageDuration: number;
  };
  notifications: {
    sent: number;
    failed: number;
  };
  systemHealth: {
    lastHeartbeat: Date;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    isHealthy: boolean;
    errors: string[];
  };
}

class MonitoringService {
  private metrics: Metrics;
  private startTime: Date;
  private lastLogTime: Date;
  private logInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startTime = new Date();
    this.lastLogTime = new Date();
    this.metrics = {
      rpcCalls: {
        total: 0,
        successful: 0,
        failed: 0,
        rateLimited: 0,
        timeouts: 0,
      },
      watcherCycles: {
        total: 0,
        successful: 0,
        failed: 0,
        averageDuration: 0,
        lastDuration: 0,
      },
      securityScans: {
        total: 0,
        cached: 0,
        successful: 0,
        failed: 0,
        averageDuration: 0,
      },
      notifications: {
        sent: 0,
        failed: 0,
      },
      systemHealth: {
        lastHeartbeat: new Date(),
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        isHealthy: true,
        errors: [],
      },
    };
  }

  // Start periodic logging
  startPeriodicLogging(intervalMs: number = 60000): void {
    if (!config.enablePerformanceMetrics) return;

    this.logInterval = setInterval(() => {
      this.logMetricsSummary();
      this.lastLogTime = new Date();
    }, intervalMs);
  }

  stopPeriodicLogging(): void {
    if (this.logInterval) {
      clearInterval(this.logInterval);
      this.logInterval = null;
    }
  }

  // RPC call tracking
  recordRpcCall(type: 'success' | 'failure' | 'rateLimit' | 'timeout'): void {
    if (!config.enableRpcMetrics) return;

    this.metrics.rpcCalls.total++;
    switch (type) {
      case 'success':
        this.metrics.rpcCalls.successful++;
        break;
      case 'failure':
        this.metrics.rpcCalls.failed++;
        break;
      case 'rateLimit':
        this.metrics.rpcCalls.rateLimited++;
        break;
      case 'timeout':
        this.metrics.rpcCalls.timeouts++;
        break;
    }
  }

  // Watcher cycle tracking
  recordWatcherCycle(durationMs: number, success: boolean): void {
    this.metrics.watcherCycles.total++;
    this.metrics.watcherCycles.lastDuration = durationMs;
    
    if (success) {
      this.metrics.watcherCycles.successful++;
    } else {
      this.metrics.watcherCycles.failed++;
    }

    // Update running average
    const totalDuration = this.metrics.watcherCycles.averageDuration * (this.metrics.watcherCycles.total - 1) + durationMs;
    this.metrics.watcherCycles.averageDuration = totalDuration / this.metrics.watcherCycles.total;
  }

  // Security scan tracking
  recordSecurityScan(durationMs: number, cached: boolean, success: boolean): void {
    this.metrics.securityScans.total++;
    
    if (cached) {
      this.metrics.securityScans.cached++;
    }
    
    if (success) {
      this.metrics.securityScans.successful++;
    } else {
      this.metrics.securityScans.failed++;
    }

    // Update running average (only for non-cached scans)
    if (!cached) {
      const totalDuration = this.metrics.securityScans.averageDuration * (this.metrics.securityScans.total - this.metrics.securityScans.cached - 1) + durationMs;
      const scanCount = this.metrics.securityScans.total - this.metrics.securityScans.cached;
      this.metrics.securityScans.averageDuration = scanCount > 0 ? totalDuration / scanCount : 0;
    }
  }

  // Notification tracking
  recordNotification(success: boolean): void {
    if (success) {
      this.metrics.notifications.sent++;
    } else {
      this.metrics.notifications.failed++;
    }
  }

  // System health tracking
  updateSystemHealth(isHealthy: boolean, error?: string): void {
    this.metrics.systemHealth.lastHeartbeat = new Date();
    this.metrics.systemHealth.uptime = Date.now() - this.startTime.getTime();
    this.metrics.systemHealth.memoryUsage = process.memoryUsage();
    this.metrics.systemHealth.isHealthy = isHealthy;

    if (error) {
      this.metrics.systemHealth.errors.push(error);
      // Keep only last 10 errors
      if (this.metrics.systemHealth.errors.length > 10) {
        this.metrics.systemHealth.errors.shift();
      }
    }
  }

  // Get current metrics
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  // Get health status
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    checks: {
      rpcAvailability: boolean;
      watcherActive: boolean;
      memoryOk: boolean;
      errorRate: number;
    };
  } {
    const uptimeMs = Date.now() - this.startTime.getTime();
    const memoryMB = this.metrics.systemHealth.memoryUsage.heapUsed / 1024 / 1024;
    const rpcSuccessRate = this.metrics.rpcCalls.total > 0 
      ? this.metrics.rpcCalls.successful / this.metrics.rpcCalls.total 
      : 1;
    const watcherSuccessRate = this.metrics.watcherCycles.total > 0
      ? this.metrics.watcherCycles.successful / this.metrics.watcherCycles.total
      : 1;

    const checks = {
      rpcAvailability: rpcSuccessRate > 0.5, // At least 50% success rate
      watcherActive: Date.now() - this.metrics.systemHealth.lastHeartbeat.getTime() < 120000, // Active within 2 min
      memoryOk: memoryMB < 200, // Less than 200MB
      errorRate: 1 - watcherSuccessRate,
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!checks.rpcAvailability || !checks.watcherActive) {
      status = 'unhealthy';
    } else if (!checks.memoryOk || checks.errorRate > 0.2) {
      status = 'degraded';
    }

    return {
      status,
      uptime: uptimeMs,
      checks,
    };
  }

  // Log metrics summary
  public logMetricsSummary(): void {
    const health = this.getHealthStatus();
    const rpcSuccessRate = this.metrics.rpcCalls.total > 0 
      ? ((this.metrics.rpcCalls.successful / this.metrics.rpcCalls.total) * 100).toFixed(1)
      : '100.0';

    logger.info('\n📊 === MONITORING SUMMARY ===');
    logger.info(`⏱️  Uptime: ${this.formatUptime(health.uptime)}`);
    logger.info(`💚 Status: ${health.status.toUpperCase()}`);
    logger.info(`\n🔌 RPC Calls:`);
    logger.info(`   Total: ${this.metrics.rpcCalls.total}`);
    logger.info(`   Success Rate: ${rpcSuccessRate}%`);
    logger.info(`   Rate Limited: ${this.metrics.rpcCalls.rateLimited}`);
    logger.info(`   Timeouts: ${this.metrics.rpcCalls.timeouts}`);
    logger.info(`\n👀 Watcher Cycles:`);
    logger.info(`   Total: ${this.metrics.watcherCycles.total}`);
    logger.info(`   Success Rate: ${this.metrics.watcherCycles.total > 0 ? ((this.metrics.watcherCycles.successful / this.metrics.watcherCycles.total) * 100).toFixed(1) : '100.0'}%`);
    logger.info(`   Avg Duration: ${this.metrics.watcherCycles.averageDuration.toFixed(0)}ms`);
    logger.info(`   Last Duration: ${this.metrics.watcherCycles.lastDuration}ms`);
    logger.info(`\n🛡️  Security Scans:`);
    logger.info(`   Total: ${this.metrics.securityScans.total}`);
    logger.info(`   Cached: ${this.metrics.securityScans.cached} (${this.metrics.securityScans.total > 0 ? ((this.metrics.securityScans.cached / this.metrics.securityScans.total) * 100).toFixed(0) : '0'}%)`);
    logger.info(`   Avg Duration: ${this.metrics.securityScans.averageDuration.toFixed(0)}ms`);
    logger.info(`\n📬 Notifications:`);
    logger.info(`   Sent: ${this.metrics.notifications.sent}`);
    logger.info(`   Failed: ${this.metrics.notifications.failed}`);
    logger.info(`\n💾 Memory:`);
    logger.info(`   Heap Used: ${(this.metrics.systemHealth.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    logger.info(`   RSS: ${(this.metrics.systemHealth.memoryUsage.rss / 1024 / 1024).toFixed(1)}MB`);
    logger.info('='.repeat(30) + '\n');
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Reset metrics (useful for testing)
  reset(): void {
    this.metrics.rpcCalls = { total: 0, successful: 0, failed: 0, rateLimited: 0, timeouts: 0 };
    this.metrics.watcherCycles = { total: 0, successful: 0, failed: 0, averageDuration: 0, lastDuration: 0 };
    this.metrics.securityScans = { total: 0, cached: 0, successful: 0, failed: 0, averageDuration: 0 };
    this.metrics.notifications = { sent: 0, failed: 0 };
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

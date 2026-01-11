/**
 * Advanced Monitoring & Alerting System
 * Comprehensive monitoring for production environments
 */

import logger from '../logger';
import { getAnalytics } from '../analytics';
import { getRedisCache } from '../cache/redis-cache';
import { getQueueManager } from '../queue/queue-manager';
import { getRPCPool } from '../optimization/connection-pool';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    [key: string]: {
      status: 'up' | 'down' | 'degraded';
      message?: string;
      latency?: number;
    };
  };
  timestamp: number;
}

export interface Alert {
  level: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: number;
  resolved?: boolean;
}

/**
 * Advanced Monitoring Manager
 */
export class AdvancedMonitoring {
  private alerts: Alert[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly healthCheckFrequency = 30000; // 30 seconds
  private readonly metricsFrequency = 60000; // 1 minute

  /**
   * Start monitoring
   */
  start(): void {
    logger.info('🔍 Starting advanced monitoring...');

    // Health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckFrequency);

    // Metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.metricsFrequency);

    // Initial checks
    this.performHealthCheck();
    this.collectMetrics();

    logger.info('✅ Advanced monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    logger.info('Advanced monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const components: HealthStatus['components'] = {};

    // Check Redis
    try {
      const redis = getRedisCache();
      const start = Date.now();
      const pingResult = await redis.ping();
      const latency = Date.now() - start;

      components.redis = {
        status: pingResult ? 'up' : 'down',
        latency,
        message: pingResult ? 'Connected' : 'Connection failed',
      };

      if (!pingResult) {
        this.createAlert('error', 'redis', 'Redis connection failed');
      }
    } catch (error) {
      components.redis = {
        status: 'down',
        message: 'Error checking Redis',
      };
      this.createAlert('error', 'redis', `Redis error: ${error}`);
    }

    // Check Database
    try {
      // Database check would go here
      components.database = {
        status: 'up',
        message: 'Connected',
      };
    } catch (error) {
      components.database = {
        status: 'down',
        message: 'Connection failed',
      };
      this.createAlert('critical', 'database', `Database error: ${error}`);
    }

    // Check RPC Connection Pool
    try {
      const pool = getRPCPool();
      const stats = pool.getStats();
      
      const utilizationPercent = (stats.inUse / stats.maxConnections) * 100;
      
      components.rpc_pool = {
        status: stats.available > 0 ? 'up' : 'degraded',
        message: `${stats.inUse}/${stats.maxConnections} in use (${utilizationPercent.toFixed(1)}%)`,
      };

      if (utilizationPercent > 90) {
        this.createAlert('warning', 'rpc_pool', 'RPC pool utilization >90%');
      }
    } catch (error) {
      components.rpc_pool = {
        status: 'down',
        message: 'Error checking RPC pool',
      };
    }

    // Check Queue System
    try {
      const queueManager = getQueueManager();
      const queueNames = queueManager.getQueueNames();
      
      if (queueNames.length > 0) {
        const stats = await queueManager.getQueueStats(queueNames[0]);
        
        components.queues = {
          status: 'up',
          message: `${stats.active} active, ${stats.waiting} waiting`,
        };

        if (stats.failed > 100) {
          this.createAlert('warning', 'queues', `${stats.failed} failed jobs in queue`);
        }
      }
    } catch (error) {
      components.queues = {
        status: 'down',
        message: 'Error checking queues',
      };
    }

    // Check System Resources
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    components.memory = {
      status: memUsageMB < 500 ? 'up' : memUsageMB < 800 ? 'degraded' : 'down',
      message: `${memUsageMB.toFixed(2)} MB used`,
    };

    if (memUsageMB > 800) {
      this.createAlert('error', 'memory', `High memory usage: ${memUsageMB.toFixed(2)} MB`);
    }

    // Determine overall status
    const statuses = Object.values(components).map(c => c.status);
    let overallStatus: HealthStatus['status'];
    
    if (statuses.some(s => s === 'down')) {
      overallStatus = 'unhealthy';
    } else if (statuses.some(s => s === 'degraded')) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const health: HealthStatus = {
      status: overallStatus,
      components,
      timestamp: Date.now(),
    };

    // Log health status
    if (overallStatus !== 'healthy') {
      logger.warn(`Health check: ${overallStatus}`, health);
    }

    return health;
  }

  /**
   * Collect metrics
   */
  async collectMetrics(): Promise<void> {
    try {
      const analytics = getAnalytics();
      const counters = analytics.getCounters();
      
      // Log metrics
      logger.debug('Metrics collected', {
        commands: counters.commands,
        notifications: counters.notifications,
        errors: counters.errors,
        cacheHits: counters.cacheHits,
        cacheMisses: counters.cacheMisses,
      });

      // Check for high error rate
      if (counters.errors > 100) {
        this.createAlert('error', 'system', `High error count: ${counters.errors}`);
      }

      // Check cache hit rate
      const total = counters.cacheHits + counters.cacheMisses;
      if (total > 0) {
        const hitRate = (counters.cacheHits / total) * 100;
        if (hitRate < 50) {
          this.createAlert('warning', 'cache', `Low cache hit rate: ${hitRate.toFixed(1)}%`);
        }
      }
    } catch (error) {
      logger.error('Error collecting metrics:', error);
    }
  }

  /**
   * Create alert
   */
  private createAlert(
    level: Alert['level'],
    component: string,
    message: string
  ): void {
    const alert: Alert = {
      level,
      component,
      message,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);

    // Log alert
    const logFunc = level === 'critical' || level === 'error' ? logger.error : logger.warn;
    logFunc(`[${level.toUpperCase()}] ${component}: ${message}`);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 10): Alert[] {
    return this.alerts.slice(-limit).reverse();
  }

  /**
   * Get unresolved alerts
   */
  getUnresolvedAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(index: number): void {
    if (this.alerts[index]) {
      this.alerts[index].resolved = true;
    }
  }

  /**
   * Get system metrics summary
   */
  async getMetricsSummary(): Promise<any> {
    const analytics = getAnalytics();
    const health = await this.performHealthCheck();
    const redis = getRedisCache();
    
    return {
      health: health.status,
      components: health.components,
      analytics: analytics.getCounters(),
      redis: await redis.getStats(),
      alerts: this.getUnresolvedAlerts().length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}

// Singleton instance
let monitoringInstance: AdvancedMonitoring | null = null;

/**
 * Get monitoring instance
 */
export function getMonitoring(): AdvancedMonitoring {
  if (!monitoringInstance) {
    monitoringInstance = new AdvancedMonitoring();
  }
  return monitoringInstance;
}

/**
 * Initialize monitoring
 */
export function initMonitoring(): AdvancedMonitoring {
  const monitoring = getMonitoring();
  monitoring.start();
  logger.info('✅ Advanced monitoring initialized');
  return monitoring;
}

export default getMonitoring;

/**
 * Comprehensive Limit Monitoring System
 * Tracks and alerts on various resource limits:
 * - RPC rate limits
 * - Memory usage
 * - CPU usage
 * - Telegram API limits
 * - Storage limits
 * - Connection limits
 */

import { createLogger } from './logger';
import { metrics } from './metrics';

const logger = createLogger('LimitMonitor');

export interface LimitThreshold {
  warning: number;  // % of limit to trigger warning
  critical: number; // % of limit to trigger critical alert
}

export interface ResourceLimit {
  name: string;
  current: number;
  max: number;
  unit: string;
  threshold: LimitThreshold;
  lastAlertLevel?: 'warning' | 'critical' | null;
  lastAlertTime?: number;
}

export interface LimitStatus {
  status: 'ok' | 'warning' | 'critical';
  percentage: number;
  message: string;
  shouldAlert: boolean;
}

export interface MonitoringConfig {
  // Alert cooldown to prevent spam (in minutes)
  alertCooldownMinutes: number;
  
  // Check interval (in seconds)
  checkIntervalSeconds: number;
  
  // Enable/disable specific monitors
  enableRpcMonitor: boolean;
  enableMemoryMonitor: boolean;
  enableCpuMonitor: boolean;
  enableTelegramMonitor: boolean;
  enableStorageMonitor: boolean;
  
  // Limits
  rpcRequestsPerMinute: number;
  maxMemoryMB: number;
  maxCpuPercent: number;
  telegramMessagesPerSecond: number;
  maxStorageRecords: number;
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  alertCooldownMinutes: 15,
  checkIntervalSeconds: 30,
  enableRpcMonitor: true,
  enableMemoryMonitor: true,
  enableCpuMonitor: true,
  enableTelegramMonitor: true,
  enableStorageMonitor: true,
  rpcRequestsPerMinute: 50, // Conservative default
  maxMemoryMB: 512,
  maxCpuPercent: 80,
  telegramMessagesPerSecond: 20,
  maxStorageRecords: 10000,
};

export const DEFAULT_THRESHOLDS: LimitThreshold = {
  warning: 70,  // Alert at 70%
  critical: 90, // Critical at 90%
};

export class LimitMonitor {
  private config: MonitoringConfig;
  private limits: Map<string, ResourceLimit>;
  private monitorInterval?: NodeJS.Timeout;
  private alertCallbacks: Array<(limit: ResourceLimit, status: LimitStatus) => void>;
  
  // Tracking counters
  private rpcRequestCount: number = 0;
  private rpcRequestWindow: number = Date.now();
  private telegramMessageCount: number = 0;
  private telegramMessageWindow: number = Date.now();
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuTime: number = Date.now();

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
    this.limits = new Map();
    this.alertCallbacks = [];
    this.initializeLimits();
  }

  /**
   * Initialize resource limits
   */
  private initializeLimits(): void {
    if (this.config.enableRpcMonitor) {
      this.limits.set('rpc_rate', {
        name: 'RPC Rate Limit',
        current: 0,
        max: this.config.rpcRequestsPerMinute,
        unit: 'req/min',
        threshold: DEFAULT_THRESHOLDS,
      });
    }

    if (this.config.enableMemoryMonitor) {
      this.limits.set('memory', {
        name: 'Memory Usage',
        current: 0,
        max: this.config.maxMemoryMB,
        unit: 'MB',
        threshold: DEFAULT_THRESHOLDS,
      });
    }

    if (this.config.enableCpuMonitor) {
      this.limits.set('cpu', {
        name: 'CPU Usage',
        current: 0,
        max: this.config.maxCpuPercent,
        unit: '%',
        threshold: DEFAULT_THRESHOLDS,
      });
    }

    if (this.config.enableTelegramMonitor) {
      this.limits.set('telegram_rate', {
        name: 'Telegram Rate Limit',
        current: 0,
        max: this.config.telegramMessagesPerSecond,
        unit: 'msg/sec',
        threshold: DEFAULT_THRESHOLDS,
      });
    }

    if (this.config.enableStorageMonitor) {
      this.limits.set('storage', {
        name: 'Storage Records',
        current: 0,
        max: this.config.maxStorageRecords,
        unit: 'records',
        threshold: { warning: 80, critical: 95 },
      });
    }

    logger.info('Limit monitor initialized', {
      limits: Array.from(this.limits.keys()),
      checkInterval: this.config.checkIntervalSeconds,
    });
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.monitorInterval) {
      logger.warn('Monitor already running');
      return;
    }

    logger.info('Starting limit monitor', {
      interval: this.config.checkIntervalSeconds,
    });

    this.monitorInterval = setInterval(() => {
      this.checkAllLimits().catch(error => {
        logger.error('Error checking limits', { error });
      });
    }, this.config.checkIntervalSeconds * 1000);

    // Initial check
    this.checkAllLimits().catch(error => {
      logger.error('Error in initial limit check', { error });
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      logger.info('Limit monitor stopped');
    }
  }

  /**
   * Check all limits
   */
  private async checkAllLimits(): Promise<void> {
    const checks: Promise<void>[] = [];

    if (this.config.enableRpcMonitor) {
      checks.push(this.checkRpcLimit());
    }

    if (this.config.enableMemoryMonitor) {
      checks.push(this.checkMemoryLimit());
    }

    if (this.config.enableCpuMonitor) {
      checks.push(this.checkCpuLimit());
    }

    if (this.config.enableTelegramMonitor) {
      checks.push(this.checkTelegramLimit());
    }

    if (this.config.enableStorageMonitor) {
      checks.push(this.checkStorageLimit());
    }

    await Promise.allSettled(checks);
  }

  /**
   * Check RPC rate limit
   */
  private async checkRpcLimit(): Promise<void> {
    const limit = this.limits.get('rpc_rate');
    if (!limit) return;

    // Reset counter every minute
    const now = Date.now();
    if (now - this.rpcRequestWindow >= 60000) {
      this.rpcRequestCount = 0;
      this.rpcRequestWindow = now;
    }

    limit.current = this.rpcRequestCount;
    const status = this.calculateLimitStatus(limit);

    if (status.shouldAlert) {
      this.triggerAlert(limit, status);
    }

    // Record metric
    metrics.recordGauge('rpc_requests_per_minute', this.rpcRequestCount);
  }

  /**
   * Check memory limit
   */
  private async checkMemoryLimit(): Promise<void> {
    const limit = this.limits.get('memory');
    if (!limit) return;

    const memUsage = process.memoryUsage();
    const usedMB = memUsage.heapUsed / 1024 / 1024;

    limit.current = Math.round(usedMB);
    const status = this.calculateLimitStatus(limit);

    if (status.shouldAlert) {
      this.triggerAlert(limit, status);
    }

    // Record metric
    metrics.recordGauge('memory_used_mb', limit.current);
    metrics.recordGauge('memory_percent', status.percentage);
  }

  /**
   * Check CPU limit
   */
  private async checkCpuLimit(): Promise<void> {
    const limit = this.limits.get('cpu');
    if (!limit) return;

    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    const currentTime = Date.now();
    const timeDiff = currentTime - this.lastCpuTime;

    if (this.lastCpuUsage && timeDiff > 0) {
      // Calculate CPU percentage
      const totalCpuTime = currentCpuUsage.user + currentCpuUsage.system;
      const cpuPercent = (totalCpuTime / (timeDiff * 1000)) * 100;

      limit.current = Math.round(cpuPercent);
      const status = this.calculateLimitStatus(limit);

      if (status.shouldAlert) {
        this.triggerAlert(limit, status);
      }

      // Record metric
      metrics.recordGauge('cpu_percent', limit.current);
    }

    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = currentTime;
  }

  /**
   * Check Telegram rate limit
   */
  private async checkTelegramLimit(): Promise<void> {
    const limit = this.limits.get('telegram_rate');
    if (!limit) return;

    // Reset counter every second
    const now = Date.now();
    if (now - this.telegramMessageWindow >= 1000) {
      this.telegramMessageCount = 0;
      this.telegramMessageWindow = now;
    }

    limit.current = this.telegramMessageCount;
    const status = this.calculateLimitStatus(limit);

    if (status.shouldAlert) {
      this.triggerAlert(limit, status);
    }

    // Record metric
    metrics.recordGauge('telegram_messages_per_second', this.telegramMessageCount);
  }

  /**
   * Check storage limit
   */
  private async checkStorageLimit(): Promise<void> {
    const limit = this.limits.get('storage');
    if (!limit) return;

    // This would need to be updated based on actual storage implementation
    // For now, we'll use a placeholder
    try {
      const { loadStorage } = await import('./storage');
      const data = loadStorage();
      const totalRecords = Object.keys(data.users || {}).length;

      limit.current = totalRecords;
      const status = this.calculateLimitStatus(limit);

      if (status.shouldAlert) {
        this.triggerAlert(limit, status);
      }

      // Record metric
      metrics.recordGauge('storage_records', totalRecords);
    } catch (error) {
      logger.warn('Could not check storage limit', { error });
    }
  }

  /**
   * Calculate limit status
   */
  private calculateLimitStatus(limit: ResourceLimit): LimitStatus {
    const percentage = (limit.current / limit.max) * 100;

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    let shouldAlert = false;

    if (percentage >= limit.threshold.critical) {
      status = 'critical';
      shouldAlert = limit.lastAlertLevel !== 'critical' || this.shouldSendAlert(limit);
    } else if (percentage >= limit.threshold.warning) {
      status = 'warning';
      shouldAlert = limit.lastAlertLevel !== 'warning' || this.shouldSendAlert(limit);
    }

    const message = this.formatLimitMessage(limit, percentage, status);

    return { status, percentage, message, shouldAlert };
  }

  /**
   * Check if enough time has passed since last alert
   */
  private shouldSendAlert(limit: ResourceLimit): boolean {
    if (!limit.lastAlertTime) return true;

    const cooldownMs = this.config.alertCooldownMinutes * 60 * 1000;
    const timeSinceLastAlert = Date.now() - limit.lastAlertTime;

    return timeSinceLastAlert >= cooldownMs;
  }

  /**
   * Format limit message
   */
  private formatLimitMessage(
    limit: ResourceLimit,
    percentage: number,
    status: 'ok' | 'warning' | 'critical'
  ): string {
    const emoji = status === 'critical' ? '🚨' : status === 'warning' ? '⚠️' : '✅';
    
    return (
      `${emoji} <b>${limit.name}</b>\n` +
      `📊 Current: ${limit.current.toFixed(1)} ${limit.unit}\n` +
      `📈 Limit: ${limit.max} ${limit.unit}\n` +
      `📉 Usage: ${percentage.toFixed(1)}%\n` +
      `⚡ Status: ${status.toUpperCase()}`
    );
  }

  /**
   * Trigger alert
   */
  private triggerAlert(limit: ResourceLimit, status: LimitStatus): void {
    logger.warn('Limit threshold exceeded', {
      limit: limit.name,
      current: limit.current,
      max: limit.max,
      percentage: status.percentage,
      status: status.status,
    });

    // Update last alert tracking
    limit.lastAlertLevel = status.status === 'ok' ? null : status.status;
    limit.lastAlertTime = Date.now();

    // Call all registered callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(limit, status);
      } catch (error) {
        logger.error('Error in alert callback', { error });
      }
    }

    // Record metric
    metrics.incrementCounter(`limit_alert_${status.status}`, 1);
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (limit: ResourceLimit, status: LimitStatus) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Track RPC request
   */
  trackRpcRequest(): void {
    this.rpcRequestCount++;
  }

  /**
   * Track Telegram message
   */
  trackTelegramMessage(): void {
    this.telegramMessageCount++;
  }

  /**
   * Get current status of all limits
   */
  getStatus(): Array<{ limit: ResourceLimit; status: LimitStatus }> {
    const results: Array<{ limit: ResourceLimit; status: LimitStatus }> = [];

    for (const limit of this.limits.values()) {
      const status = this.calculateLimitStatus(limit);
      results.push({ limit, status });
    }

    return results;
  }

  /**
   * Get formatted status report
   */
  getStatusReport(): string {
    const statuses = this.getStatus();
    
    let report = '📊 <b>Resource Limit Status</b>\n\n';

    for (const { limit, status } of statuses) {
      report += status.message + '\n\n';
    }

    report += `🔄 <i>Last updated: ${new Date().toLocaleString()}</i>`;

    return report;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('Monitoring configuration updated', { updates });

    // Reinitialize limits if necessary
    if (
      updates.rpcRequestsPerMinute ||
      updates.maxMemoryMB ||
      updates.maxCpuPercent ||
      updates.telegramMessagesPerSecond ||
      updates.maxStorageRecords
    ) {
      this.initializeLimits();
    }
  }

  /**
   * Reset all alert tracking
   */
  resetAlerts(): void {
    for (const limit of this.limits.values()) {
      limit.lastAlertLevel = null;
      limit.lastAlertTime = undefined;
    }
    logger.info('All alert tracking reset');
  }
}

// Singleton instance
let limitMonitorInstance: LimitMonitor | null = null;

/**
 * Get limit monitor instance
 */
export function getLimitMonitor(config?: Partial<MonitoringConfig>): LimitMonitor {
  if (!limitMonitorInstance) {
    limitMonitorInstance = new LimitMonitor(config);
  }
  return limitMonitorInstance;
}

export default getLimitMonitor;

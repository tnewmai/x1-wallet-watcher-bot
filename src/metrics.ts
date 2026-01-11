// Production-grade metrics and observability
import { createLogger } from './logger';

const logger = createLogger('Metrics');

// Metrics storage
interface Metric {
  count: number;
  sum: number;
  min: number;
  max: number;
  lastValue: number;
  lastUpdated: number;
}

interface CounterMetric {
  value: number;
  lastUpdated: number;
}

class MetricsCollector {
  private gauges: Map<string, Metric> = new Map();
  private counters: Map<string, CounterMetric> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private startTime: number = Date.now();

  /**
   * Record a gauge value (e.g., active connections, memory usage)
   */
  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const existing = this.gauges.get(key);

    if (existing) {
      existing.count++;
      existing.sum += value;
      existing.min = Math.min(existing.min, value);
      existing.max = Math.max(existing.max, value);
      existing.lastValue = value;
      existing.lastUpdated = Date.now();
    } else {
      this.gauges.set(key, {
        count: 1,
        sum: value,
        min: value,
        max: value,
        lastValue: value,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Increment a counter (e.g., total requests, errors)
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const existing = this.counters.get(key);

    if (existing) {
      existing.value += value;
      existing.lastUpdated = Date.now();
    } else {
      this.counters.set(key, {
        value,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Record a histogram value (e.g., response times)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const existing = this.histograms.get(key) || [];
    existing.push(value);

    // Keep only last 1000 values to prevent memory issues
    if (existing.length > 1000) {
      existing.shift();
    }

    this.histograms.set(key, existing);
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, labels?: Record<string, string>): Metric | undefined {
    const key = this.buildKey(name, labels);
    return this.gauges.get(key);
  }

  /**
   * Get counter value
   */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.buildKey(name, labels);
    return this.counters.get(key)?.value || 0;
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | undefined {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key);

    if (!values || values.length === 0) {
      return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Get all metrics summary
   */
  getAllMetrics(): {
    uptime: number;
    gauges: Record<string, any>;
    counters: Record<string, number>;
    histograms: Record<string, any>;
  } {
    const gauges: Record<string, any> = {};
    const counters: Record<string, number> = {};
    const histograms: Record<string, any> = {};

    this.gauges.forEach((value, key) => {
      gauges[key] = {
        current: value.lastValue,
        avg: value.sum / value.count,
        min: value.min,
        max: value.max,
        count: value.count,
      };
    });

    this.counters.forEach((value, key) => {
      counters[key] = value.value;
    });

    this.histograms.forEach((_, key) => {
      const stats = this.getHistogramStats(key);
      if (stats) {
        histograms[key] = stats;
      }
    });

    return {
      uptime: Date.now() - this.startTime,
      gauges,
      counters,
      histograms,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.gauges.clear();
    this.counters.clear();
    this.histograms.clear();
    logger.info('Metrics reset');
  }

  /**
   * Build metric key with labels
   */
  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}{${labelStr}}`;
  }
}

// Global metrics collector
export const metrics = new MetricsCollector();

// Pre-defined metrics functions for common use cases
export const Metrics = {
  // RPC metrics
  rpcCall: (success: boolean, durationMs: number) => {
    metrics.incrementCounter('rpc_calls_total', 1, { status: success ? 'success' : 'error' });
    metrics.recordHistogram('rpc_call_duration_ms', durationMs);
  },

  rpcError: (errorType: string) => {
    metrics.incrementCounter('rpc_errors_total', 1, { type: errorType });
  },

  // Watcher metrics
  watcherCycle: (durationMs: number, walletsChecked: number) => {
    metrics.recordHistogram('watcher_cycle_duration_ms', durationMs);
    metrics.recordGauge('wallets_checked', walletsChecked);
  },

  // Notification metrics
  notificationSent: (type: string, success: boolean) => {
    metrics.incrementCounter('notifications_sent_total', 1, { type, status: success ? 'success' : 'error' });
  },

  // User metrics
  activeUsers: (count: number) => {
    metrics.recordGauge('active_users', count);
  },

  watchedWallets: (count: number) => {
    metrics.recordGauge('watched_wallets_total', count);
  },

  // Bot command metrics
  commandReceived: (command: string) => {
    metrics.incrementCounter('bot_commands_total', 1, { command });
  },

  // Cache metrics
  cacheHit: () => {
    metrics.incrementCounter('cache_hits_total', 1);
  },

  cacheMiss: () => {
    metrics.incrementCounter('cache_misses_total', 1);
  },

  // Storage metrics
  storageWrite: (durationMs: number) => {
    metrics.incrementCounter('storage_writes_total', 1);
    metrics.recordHistogram('storage_write_duration_ms', durationMs);
  },

  // System metrics
  memoryUsage: (usedMB: number, percentUsed: number) => {
    metrics.recordGauge('memory_used_mb', usedMB);
    metrics.recordGauge('memory_percent', percentUsed);
  },

  // Circuit breaker metrics
  circuitBreakerOpen: () => {
    metrics.incrementCounter('circuit_breaker_opens_total', 1);
  },

  circuitBreakerClosed: () => {
    metrics.incrementCounter('circuit_breaker_closes_total', 1);
  },
};

// Periodic metrics logging
let metricsInterval: NodeJS.Timeout | null = null;

export function startMetricsLogging(intervalMs: number = 60000): void {
  if (metricsInterval) {
    return;
  }

  logger.info('Starting periodic metrics logging', { intervalMs });

  metricsInterval = setInterval(() => {
    const allMetrics = metrics.getAllMetrics();
    
    logger.info('📊 Metrics Summary', {
      uptime: Math.floor(allMetrics.uptime / 1000) + 's',
      counters: allMetrics.counters,
      gauges: Object.fromEntries(
        Object.entries(allMetrics.gauges).map(([k, v]) => [k, (v as any).current])
      ),
    });
  }, intervalMs);
}

export function stopMetricsLogging(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
    logger.info('Metrics logging stopped');
  }
}

// Export metrics in Prometheus format (for future integration)
export function getPrometheusMetrics(): string {
  const allMetrics = metrics.getAllMetrics();
  const lines: string[] = [];

  // Counters
  Object.entries(allMetrics.counters).forEach(([name, value]) => {
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name} ${value}`);
  });

  // Gauges
  Object.entries(allMetrics.gauges).forEach(([name, gauge]) => {
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${(gauge as any).current}`);
  });

  // Histograms
  Object.entries(allMetrics.histograms).forEach(([name, hist]) => {
    const h = hist as any;
    lines.push(`# TYPE ${name} histogram`);
    lines.push(`${name}_sum ${h.sum}`);
    lines.push(`${name}_count ${h.count}`);
    lines.push(`${name}_bucket{le="0.5"} ${h.p50}`);
    lines.push(`${name}_bucket{le="0.95"} ${h.p95}`);
    lines.push(`${name}_bucket{le="0.99"} ${h.p99}`);
  });

  return lines.join('\n');
}

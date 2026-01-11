/**
 * Analytics Tests
 * Tests for analytics and metrics tracking
 */

import { AnalyticsManager } from '../src/analytics';

describe('Analytics Manager', () => {
  let analytics: AnalyticsManager;

  beforeEach(() => {
    analytics = new AnalyticsManager();
  });

  describe('Counters', () => {
    test('should increment command counter', () => {
      analytics.incrementCommand();
      analytics.incrementCommand();
      
      const counters = analytics.getCounters();
      expect(counters.commands).toBe(2);
    });

    test('should increment notification counter', () => {
      analytics.incrementNotification();
      
      const counters = analytics.getCounters();
      expect(counters.notifications).toBe(1);
    });

    test('should increment security scan counter', () => {
      analytics.incrementSecurityScan();
      analytics.incrementSecurityScan();
      analytics.incrementSecurityScan();
      
      const counters = analytics.getCounters();
      expect(counters.securityScans).toBe(3);
    });

    test('should reset all counters', () => {
      analytics.incrementCommand();
      analytics.incrementNotification();
      analytics.incrementSecurityScan();
      
      analytics.resetCounters();
      
      const counters = analytics.getCounters();
      expect(counters.commands).toBe(0);
      expect(counters.notifications).toBe(0);
      expect(counters.securityScans).toBe(0);
    });
  });

  describe('Cache Metrics', () => {
    test('should record cache hits and misses', () => {
      analytics.recordCacheHit();
      analytics.recordCacheHit();
      analytics.recordCacheMiss();
      
      const counters = analytics.getCounters();
      expect(counters.cacheHits).toBe(2);
      expect(counters.cacheMisses).toBe(1);
    });
  });

  describe('System Metrics', () => {
    test('should get system metrics', () => {
      const metrics = analytics.getSystemMetrics();
      
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(typeof metrics.uptime).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
    });
  });

  describe('Reports', () => {
    test('should generate analytics report', async () => {
      analytics.incrementCommand();
      analytics.incrementNotification();
      
      const report = await analytics.generateReport();
      
      expect(typeof report).toBe('string');
      expect(report).toContain('ANALYTICS REPORT');
      expect(report).toContain('User Metrics');
    });

    test('should export data as JSON', async () => {
      const data = await analytics.exportData();
      
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('usage');
      expect(data).toHaveProperty('system');
      expect(data).toHaveProperty('counters');
    });
  });
});

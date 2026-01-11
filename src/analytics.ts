/**
 * Analytics Module
 * Track and analyze bot usage metrics
 */

import { getStorage } from './storage-v2';
import logger from './logger';

interface UsageMetrics {
  totalUsers: number;
  activeUsers: number; // Active in last 24h
  totalWallets: number;
  totalTransactions: number;
  totalNotifications: number;
  averageWalletsPerUser: number;
  topUsers: Array<{ userId: number; walletCount: number }>;
}

interface UserActivity {
  userId: number;
  lastActive: Date;
  commandCount: number;
  walletsAdded: number;
  walletsRemoved: number;
  securityScans: number;
  notificationsReceived: number;
}

interface SystemMetrics {
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  rpcCalls: number;
  websocketConnections: number;
  cacheHitRate: number;
}

/**
 * Analytics Manager
 */
export class AnalyticsManager {
  private metricsCache: Map<string, { data: any; timestamp: number }>;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  
  // Counters
  private counters = {
    commands: 0,
    notifications: 0,
    securityScans: 0,
    rpcCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
  };

  constructor() {
    this.metricsCache = new Map();
  }

  /**
   * Get overall usage metrics
   */
  async getUsageMetrics(): Promise<UsageMetrics> {
    const cached = this.getCached('usage_metrics');
    if (cached) return cached;

    try {
      const storage = getStorage();
      const users = await storage.getAllUsers();
      
      let totalWallets = 0;
      const walletsPerUser: Array<{ userId: number; walletCount: number }> = [];
      
      for (const [userId, userData] of users) {
        const walletCount = userData.wallets.length;
        totalWallets += walletCount;
        walletsPerUser.push({ userId, walletCount });
      }

      // Sort by wallet count
      walletsPerUser.sort((a, b) => b.walletCount - a.walletCount);

      const metrics: UsageMetrics = {
        totalUsers: users.size,
        activeUsers: users.size, // TODO: Track last active time
        totalWallets,
        totalTransactions: this.counters.notifications,
        totalNotifications: this.counters.notifications,
        averageWalletsPerUser: users.size > 0 ? totalWallets / users.size : 0,
        topUsers: walletsPerUser.slice(0, 10),
      };

      this.setCached('usage_metrics', metrics);
      return metrics;
    } catch (error) {
      logger.error('Error getting usage metrics:', error);
      throw error;
    }
  }

  /**
   * Get system performance metrics
   */
  getSystemMetrics(): SystemMetrics {
    const cached = this.getCached('system_metrics');
    if (cached) return cached;

    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    const metrics: SystemMetrics = {
      uptime,
      memoryUsage: memUsage.heapUsed,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      rpcCalls: this.counters.rpcCalls,
      websocketConnections: 0, // TODO: Get from WebSocketManager
      cacheHitRate: this.calculateCacheHitRate(),
    };

    this.setCached('system_metrics', metrics);
    return metrics;
  }

  /**
   * Get user growth statistics
   */
  async getUserGrowth(days: number = 30): Promise<Array<{ date: string; count: number }>> {
    // TODO: Implement actual user growth tracking
    // For now, return mock data
    const growth: Array<{ date: string; count: number }> = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      growth.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 10) + 1,
      });
    }

    return growth;
  }

  /**
   * Get wallet addition statistics
   */
  async getWalletStats(days: number = 30): Promise<Array<{ date: string; count: number }>> {
    // TODO: Implement actual wallet addition tracking
    const stats: Array<{ date: string; count: number }> = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      stats.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 20) + 5,
      });
    }

    return stats;
  }

  /**
   * Increment command counter
   */
  incrementCommand(): void {
    this.counters.commands++;
  }

  /**
   * Increment notification counter
   */
  incrementNotification(): void {
    this.counters.notifications++;
  }

  /**
   * Increment security scan counter
   */
  incrementSecurityScan(): void {
    this.counters.securityScans++;
  }

  /**
   * Increment RPC call counter
   */
  incrementRpcCall(): void {
    this.counters.rpcCalls++;
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.counters.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.counters.cacheMisses++;
  }

  /**
   * Increment error counter
   */
  incrementError(): void {
    this.counters.errors++;
  }

  /**
   * Get all counters
   */
  getCounters() {
    return { ...this.counters };
  }

  /**
   * Reset counters
   */
  resetCounters(): void {
    Object.keys(this.counters).forEach(key => {
      this.counters[key as keyof typeof this.counters] = 0;
    });
    logger.info('Analytics counters reset');
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const total = this.counters.cacheHits + this.counters.cacheMisses;
    return total > 0 ? (this.counters.cacheHits / total) * 100 : 0;
  }

  /**
   * Get cached data
   */
  private getCached(key: string): any | null {
    const cached = this.metricsCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTTL) {
      this.metricsCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data
   */
  private setCached(key: string, data: any): void {
    this.metricsCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Generate analytics report
   */
  async generateReport(): Promise<string> {
    const usage = await this.getUsageMetrics();
    const system = this.getSystemMetrics();
    const counters = this.getCounters();

    let report = '📊 **ANALYTICS REPORT**\n\n';
    
    report += '👥 **User Metrics**\n';
    report += `Total Users: ${usage.totalUsers}\n`;
    report += `Active Users (24h): ${usage.activeUsers}\n`;
    report += `Total Wallets: ${usage.totalWallets}\n`;
    report += `Avg Wallets/User: ${usage.averageWalletsPerUser.toFixed(2)}\n\n`;
    
    report += '📈 **Activity**\n';
    report += `Commands Executed: ${counters.commands}\n`;
    report += `Notifications Sent: ${counters.notifications}\n`;
    report += `Security Scans: ${counters.securityScans}\n\n`;
    
    report += '⚙️ **System Performance**\n';
    report += `Uptime: ${(system.uptime / 3600).toFixed(2)} hours\n`;
    report += `Memory: ${(system.memoryUsage / 1024 / 1024).toFixed(2)} MB\n`;
    report += `RPC Calls: ${system.rpcCalls}\n`;
    report += `Cache Hit Rate: ${system.cacheHitRate.toFixed(2)}%\n`;
    
    if (counters.errors > 0) {
      report += `\n⚠️ Errors: ${counters.errors}\n`;
    }

    return report;
  }

  /**
   * Export analytics data as JSON
   */
  async exportData(): Promise<any> {
    const usage = await this.getUsageMetrics();
    const system = this.getSystemMetrics();
    const counters = this.getCounters();
    const userGrowth = await this.getUserGrowth(30);
    const walletStats = await this.getWalletStats(30);

    return {
      timestamp: new Date().toISOString(),
      usage,
      system,
      counters,
      trends: {
        userGrowth,
        walletStats,
      },
    };
  }
}

// Singleton instance
let analyticsInstance: AnalyticsManager | null = null;

/**
 * Get analytics manager instance
 */
export function getAnalytics(): AnalyticsManager {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsManager();
  }
  return analyticsInstance;
}

/**
 * Initialize analytics
 */
export function initAnalytics(): AnalyticsManager {
  const analytics = getAnalytics();
  logger.info('✅ Analytics initialized');
  return analytics;
}

export default getAnalytics;

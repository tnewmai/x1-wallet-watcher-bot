/**
 * Telegram Alert Integration for Limit Monitoring
 * Sends alerts to admin users when limits are approached
 */

import { Bot } from 'grammy';
import { getLimitMonitor, ResourceLimit, LimitStatus } from './limit-monitor';
import { createLogger } from './logger';
import { config } from './config';

const logger = createLogger('LimitAlerts');

export interface AlertConfig {
  // Admin user IDs to receive alerts
  adminUserIds: number[];
  
  // Enable/disable alerts
  enabled: boolean;
  
  // Send digest instead of individual alerts
  enableDigest: boolean;
  digestIntervalMinutes: number;
}

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  adminUserIds: [],
  enabled: true,
  enableDigest: false,
  digestIntervalMinutes: 60,
};

export class LimitAlertService {
  private bot: Bot;
  private alertConfig: AlertConfig;
  private limitMonitor = getLimitMonitor();
  private digestTimer?: NodeJS.Timeout;
  private pendingAlerts: Array<{ limit: ResourceLimit; status: LimitStatus; timestamp: number }> = [];

  constructor(bot: Bot, alertConfig: Partial<AlertConfig> = {}) {
    this.bot = bot;
    this.alertConfig = { ...DEFAULT_ALERT_CONFIG, ...alertConfig };
    this.setupAlertHandlers();
  }

  /**
   * Setup alert handlers
   */
  private setupAlertHandlers(): void {
    // Register callback with limit monitor
    this.limitMonitor.onAlert((limit, status) => {
      this.handleLimitAlert(limit, status);
    });

    logger.info('Limit alert service initialized', {
      adminCount: this.alertConfig.adminUserIds.length,
      digestEnabled: this.alertConfig.enableDigest,
    });
  }

  /**
   * Handle limit alert
   */
  private async handleLimitAlert(limit: ResourceLimit, status: LimitStatus): Promise<void> {
    if (!this.alertConfig.enabled) {
      return;
    }

    if (this.alertConfig.enableDigest) {
      // Add to pending alerts for digest
      this.pendingAlerts.push({
        limit,
        status,
        timestamp: Date.now(),
      });
    } else {
      // Send immediate alert
      await this.sendImmediateAlert(limit, status);
    }
  }

  /**
   * Send immediate alert
   */
  private async sendImmediateAlert(limit: ResourceLimit, status: LimitStatus): Promise<void> {
    const message = this.formatAlertMessage(limit, status);

    for (const adminId of this.alertConfig.adminUserIds) {
      try {
        await this.bot.api.sendMessage(adminId, message, {
          parse_mode: 'HTML',
          disable_notification: status.status === 'warning',
        });

        logger.info('Sent limit alert to admin', {
          adminId,
          limit: limit.name,
          status: status.status,
        });
      } catch (error) {
        logger.error('Failed to send limit alert', {
          adminId,
          error,
        });
      }
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(limit: ResourceLimit, status: LimitStatus): string {
    const emoji = status.status === 'critical' ? '🚨' : '⚠️';
    const urgency = status.status === 'critical' ? 'CRITICAL' : 'WARNING';

    let message = `${emoji} <b>${urgency}: ${limit.name}</b>\n\n`;
    message += `📊 <b>Current Usage:</b> ${limit.current.toFixed(1)} ${limit.unit}\n`;
    message += `📈 <b>Limit:</b> ${limit.max} ${limit.unit}\n`;
    message += `📉 <b>Percentage:</b> ${status.percentage.toFixed(1)}%\n\n`;

    // Add recommendations based on limit type
    message += this.getRecommendations(limit, status);

    message += `\n🕐 <i>${new Date().toLocaleString()}</i>`;

    return message;
  }

  /**
   * Get recommendations based on limit type
   */
  private getRecommendations(limit: ResourceLimit, status: LimitStatus): string {
    let recommendations = '💡 <b>Recommendations:</b>\n';

    if (limit.name.includes('RPC')) {
      recommendations += '• Increase POLL_INTERVAL\n';
      recommendations += '• Reduce WATCHER_CONCURRENCY\n';
      recommendations += '• Implement caching\n';
      recommendations += '• Consider upgrading RPC provider\n';
    } else if (limit.name.includes('Memory')) {
      recommendations += '• Check for memory leaks\n';
      recommendations += '• Reduce cache sizes\n';
      recommendations += '• Restart the bot\n';
      recommendations += '• Upgrade server resources\n';
    } else if (limit.name.includes('CPU')) {
      recommendations += '• Optimize heavy computations\n';
      recommendations += '• Reduce concurrent operations\n';
      recommendations += '• Check for infinite loops\n';
      recommendations += '• Upgrade server resources\n';
    } else if (limit.name.includes('Telegram')) {
      recommendations += '• Batch notifications\n';
      recommendations += '• Increase delays between messages\n';
      recommendations += '• Implement message queue\n';
      recommendations += '• Use quiet hours feature\n';
    } else if (limit.name.includes('Storage')) {
      recommendations += '• Archive old data\n';
      recommendations += '• Clean up inactive users\n';
      recommendations += '• Implement data retention policy\n';
      recommendations += '• Consider database migration\n';
    }

    return recommendations;
  }

  /**
   * Start digest mode
   */
  startDigest(): void {
    if (this.digestTimer) {
      logger.warn('Digest already running');
      return;
    }

    const intervalMs = this.alertConfig.digestIntervalMinutes * 60 * 1000;

    this.digestTimer = setInterval(() => {
      this.sendDigest().catch(error => {
        logger.error('Error sending digest', { error });
      });
    }, intervalMs);

    logger.info('Started digest mode', {
      interval: this.alertConfig.digestIntervalMinutes,
    });
  }

  /**
   * Stop digest mode
   */
  stopDigest(): void {
    if (this.digestTimer) {
      clearInterval(this.digestTimer);
      this.digestTimer = undefined;
      logger.info('Stopped digest mode');
    }
  }

  /**
   * Send digest of pending alerts
   */
  private async sendDigest(): Promise<void> {
    if (this.pendingAlerts.length === 0) {
      return;
    }

    const message = this.formatDigest();

    for (const adminId of this.alertConfig.adminUserIds) {
      try {
        await this.bot.api.sendMessage(adminId, message, {
          parse_mode: 'HTML',
        });

        logger.info('Sent digest to admin', {
          adminId,
          alertCount: this.pendingAlerts.length,
        });
      } catch (error) {
        logger.error('Failed to send digest', {
          adminId,
          error,
        });
      }
    }

    // Clear pending alerts
    this.pendingAlerts = [];
  }

  /**
   * Format digest message
   */
  private formatDigest(): string {
    let message = '📊 <b>Resource Limit Digest</b>\n\n';

    // Group by status
    const critical = this.pendingAlerts.filter(a => a.status.status === 'critical');
    const warning = this.pendingAlerts.filter(a => a.status.status === 'warning');

    if (critical.length > 0) {
      message += '🚨 <b>CRITICAL Alerts:</b>\n';
      for (const alert of critical) {
        message += `• ${alert.limit.name}: ${alert.status.percentage.toFixed(1)}%\n`;
      }
      message += '\n';
    }

    if (warning.length > 0) {
      message += '⚠️ <b>WARNING Alerts:</b>\n';
      for (const alert of warning) {
        message += `• ${alert.limit.name}: ${alert.status.percentage.toFixed(1)}%\n`;
      }
      message += '\n';
    }

    // Add current status
    message += '📈 <b>Current Status:</b>\n';
    message += this.limitMonitor.getStatusReport();

    return message;
  }

  /**
   * Send status report on demand
   */
  async sendStatusReport(chatId: number): Promise<void> {
    const report = this.limitMonitor.getStatusReport();

    try {
      await this.bot.api.sendMessage(chatId, report, {
        parse_mode: 'HTML',
      });

      logger.info('Sent status report', { chatId });
    } catch (error) {
      logger.error('Failed to send status report', { chatId, error });
      throw error;
    }
  }

  /**
   * Add admin user
   */
  addAdmin(userId: number): void {
    if (!this.alertConfig.adminUserIds.includes(userId)) {
      this.alertConfig.adminUserIds.push(userId);
      logger.info('Added admin user', { userId });
    }
  }

  /**
   * Remove admin user
   */
  removeAdmin(userId: number): void {
    const index = this.alertConfig.adminUserIds.indexOf(userId);
    if (index !== -1) {
      this.alertConfig.adminUserIds.splice(index, 1);
      logger.info('Removed admin user', { userId });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...updates };
    logger.info('Alert configuration updated', { updates });
  }

  /**
   * Test alerts
   */
  async testAlert(chatId: number): Promise<void> {
    const testMessage = 
      '🧪 <b>Test Alert</b>\n\n' +
      'This is a test alert from the limit monitoring system.\n\n' +
      'If you received this, alerts are working correctly! ✅';

    try {
      await this.bot.api.sendMessage(chatId, testMessage, {
        parse_mode: 'HTML',
      });

      logger.info('Sent test alert', { chatId });
    } catch (error) {
      logger.error('Failed to send test alert', { chatId, error });
      throw error;
    }
  }
}

/**
 * Setup limit monitoring and alerts
 */
export async function setupLimitMonitoring(bot: Bot, adminUserIds: number[]): Promise<{
  limitMonitor: ReturnType<typeof getLimitMonitor>;
  alertService: LimitAlertService;
}> {
  const limitMonitor = getLimitMonitor();
  
  const alertService = new LimitAlertService(bot, {
    adminUserIds,
    enabled: true,
    enableDigest: false,
  });

  // Start monitoring
  limitMonitor.start();

  logger.info('Limit monitoring setup complete', {
    adminCount: adminUserIds.length,
  });

  return { limitMonitor, alertService };
}

export default LimitAlertService;

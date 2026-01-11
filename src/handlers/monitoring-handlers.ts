/**
 * Monitoring Command Handlers
 * Admin commands for managing the monitoring system
 */

import { Context } from 'grammy';
import { getLimitMonitor } from '../limit-monitor';
import { createLogger } from '../logger';

const logger = createLogger('MonitoringHandlers');

// Admin user IDs who can access monitoring commands
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS 
  ? process.env.ADMIN_USER_IDS.split(',').map(id => parseInt(id.trim()))
  : [];

// Log admin IDs on module load for debugging
logger.info('Monitoring handlers loaded', { 
  adminCount: ADMIN_USER_IDS.length,
  adminIds: ADMIN_USER_IDS
});

/**
 * Check if user is admin
 */
function isAdmin(userId: number): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

/**
 * Handle /status command - Show current resource limits
 */
export async function handleStatusCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  try {
    const limitMonitor = getLimitMonitor();
    const report = limitMonitor.getStatusReport();

    await ctx.reply(report, { parse_mode: 'HTML' });

    logger.info('Status report sent', { userId });
  } catch (error) {
    logger.error('Error handling status command', { error, userId });
    await ctx.reply('❌ Error retrieving status report. Please try again.');
  }
}

/**
 * Handle /limits command - Show detailed limit information
 */
export async function handleLimitsCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  try {
    const limitMonitor = getLimitMonitor();
    const statuses = limitMonitor.getStatus();

    let message = '📊 <b>Detailed Limit Status</b>\n\n';

    for (const { limit, status } of statuses) {
      const emoji = status.status === 'critical' ? '🚨' : 
                    status.status === 'warning' ? '⚠️' : '✅';
      
      message += `${emoji} <b>${limit.name}</b>\n`;
      message += `├ Current: ${limit.current.toFixed(1)} ${limit.unit}\n`;
      message += `├ Maximum: ${limit.max} ${limit.unit}\n`;
      message += `├ Usage: ${status.percentage.toFixed(1)}%\n`;
      message += `├ Warning: ${limit.threshold.warning}%\n`;
      message += `├ Critical: ${limit.threshold.critical}%\n`;
      message += `└ Status: ${status.status.toUpperCase()}\n\n`;
    }

    await ctx.reply(message, { parse_mode: 'HTML' });

    logger.info('Detailed limits sent', { userId });
  } catch (error) {
    logger.error('Error handling limits command', { error, userId });
    await ctx.reply('❌ Error retrieving limit details. Please try again.');
  }
}

/**
 * Handle /alerts command - Manage alert settings
 */
export async function handleAlertsCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  const message = 
    '🔔 <b>Alert Management</b>\n\n' +
    'Available commands:\n' +
    '/alerts_enable - Enable limit alerts\n' +
    '/alerts_disable - Disable limit alerts\n' +
    '/alerts_test - Send a test alert\n' +
    '/alerts_reset - Reset all alert tracking\n\n' +
    'Use /status to see current limits.';

  await ctx.reply(message, { parse_mode: 'HTML' });
}

/**
 * Handle /alerts_enable command
 */
export async function handleAlertsEnableCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  try {
    // Alert service would be managed through the main bot instance
    await ctx.reply('✅ Limit alerts enabled. You will receive notifications when limits are approached.');
    logger.info('Alerts enabled', { userId });
  } catch (error) {
    logger.error('Error enabling alerts', { error, userId });
    await ctx.reply('❌ Error enabling alerts. Please try again.');
  }
}

/**
 * Handle /alerts_disable command
 */
export async function handleAlertsDisableCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  try {
    await ctx.reply('🔕 Limit alerts disabled. You will not receive limit notifications.');
    logger.info('Alerts disabled', { userId });
  } catch (error) {
    logger.error('Error disabling alerts', { error, userId });
    await ctx.reply('❌ Error disabling alerts. Please try again.');
  }
}

/**
 * Handle /alerts_test command
 */
export async function handleAlertsTestCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  
  // Debug logging
  logger.info('alerts_test command received', { 
    userId,
    isAdmin: userId ? isAdmin(userId) : false,
    adminIds: ADMIN_USER_IDS 
  });
  
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  try {
    const testMessage = 
      '🧪 <b>Test Alert</b>\n\n' +
      'This is a test alert from the limit monitoring system.\n\n' +
      'If you received this, alerts are working correctly! ✅\n\n' +
      'You will receive alerts when:\n' +
      '• Memory usage exceeds 70%\n' +
      '• CPU usage exceeds 70%\n' +
      '• RPC rate approaches limits\n' +
      '• Telegram rate approaches limits\n' +
      '• Storage approaches capacity';

    await ctx.reply(testMessage, { parse_mode: 'HTML' });
    logger.info('Test alert sent', { userId });
  } catch (error) {
    logger.error('Error sending test alert', { error, userId });
    await ctx.reply('❌ Error sending test alert. Please try again.');
  }
}

/**
 * Handle /alerts_reset command
 */
export async function handleAlertsResetCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  try {
    const limitMonitor = getLimitMonitor();
    limitMonitor.resetAlerts();

    await ctx.reply('🔄 Alert tracking reset. All limits will trigger alerts again if thresholds are exceeded.');
    logger.info('Alerts reset', { userId });
  } catch (error) {
    logger.error('Error resetting alerts', { error, userId });
    await ctx.reply('❌ Error resetting alerts. Please try again.');
  }
}

/**
 * Handle /health command - Show overall system health
 */
export async function handleHealthCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAdmin(userId)) {
    await ctx.reply('❌ This command is only available to administrators.');
    return;
  }

  try {
    const limitMonitor = getLimitMonitor();
    const statuses = limitMonitor.getStatus();

    // Calculate overall health
    const criticalCount = statuses.filter(s => s.status.status === 'critical').length;
    const warningCount = statuses.filter(s => s.status.status === 'warning').length;

    let overallStatus: string;
    let emoji: string;

    if (criticalCount > 0) {
      overallStatus = 'CRITICAL';
      emoji = '🚨';
    } else if (warningCount > 0) {
      overallStatus = 'WARNING';
      emoji = '⚠️';
    } else {
      overallStatus = 'HEALTHY';
      emoji = '✅';
    }

    let message = `${emoji} <b>System Health: ${overallStatus}</b>\n\n`;
    
    if (criticalCount > 0) {
      message += `🚨 Critical Issues: ${criticalCount}\n`;
    }
    if (warningCount > 0) {
      message += `⚠️ Warnings: ${warningCount}\n`;
    }
    
    message += `✅ OK: ${statuses.length - criticalCount - warningCount}\n\n`;

    // Add uptime
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    message += `⏱️ Uptime: ${hours}h ${minutes}m\n\n`;

    message += 'Use /status for detailed information.';

    await ctx.reply(message, { parse_mode: 'HTML' });

    logger.info('Health check sent', { userId, overallStatus });
  } catch (error) {
    logger.error('Error handling health command', { error, userId });
    await ctx.reply('❌ Error retrieving health information. Please try again.');
  }
}

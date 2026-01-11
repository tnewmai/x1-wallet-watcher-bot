/**
 * Admin Handlers
 * Administrative commands for bot management
 */

import { Context } from 'grammy';
import { getAnalytics } from '../analytics';
import { getStorage } from '../storage-v2';
import { getWatcherStats } from '../watcher-v2';
import { EMOJI } from '../constants';
import logger from '../logger';

// Admin user IDs (configure via environment variable)
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

/**
 * Check if user is admin
 */
export function isAdmin(userId: number): boolean {
  return ADMIN_IDS.includes(userId);
}

/**
 * Admin middleware
 */
export async function adminMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized. This command is for admins only.`);
    return;
  }
  await next();
}

/**
 * Handle /admin command - Show admin menu
 */
export async function handleAdminCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  const message = `${EMOJI.SETTINGS} <b>Admin Panel</b>\n\n` +
    `Select an option:\n\n` +
    `/stats - Bot statistics\n` +
    `/users - User management\n` +
    `/broadcast - Send message to all users\n` +
    `/analytics - Detailed analytics\n` +
    `/health - System health check\n` +
    `/restart - Restart bot services\n` +
    `/logs - View recent logs`;

  await ctx.reply(message, { parse_mode: 'HTML' });
}

/**
 * Handle /stats command - Show bot statistics
 */
export async function handleStatsCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  try {
    const analytics = getAnalytics();
    const usage = await analytics.getUsageMetrics();
    const system = analytics.getSystemMetrics();
    const counters = analytics.getCounters();
    const watcherStats = getWatcherStats();

    let message = `${EMOJI.CHART} <b>BOT STATISTICS</b>\n\n`;
    
    message += `👥 <b>Users</b>\n`;
    message += `├ Total: ${usage.totalUsers}\n`;
    message += `├ Active (24h): ${usage.activeUsers}\n`;
    message += `└ Avg Wallets: ${usage.averageWalletsPerUser.toFixed(2)}\n\n`;
    
    message += `👛 <b>Wallets</b>\n`;
    message += `├ Total Monitored: ${usage.totalWallets}\n`;
    message += `├ WebSocket: ${watcherStats.websocket || 0}\n`;
    message += `└ Polling: ${watcherStats.polling || 0}\n\n`;
    
    message += `📊 <b>Activity</b>\n`;
    message += `├ Commands: ${counters.commands}\n`;
    message += `├ Notifications: ${counters.notifications}\n`;
    message += `├ Security Scans: ${counters.securityScans}\n`;
    message += `└ RPC Calls: ${counters.rpcCalls}\n\n`;
    
    message += `⚙️ <b>System</b>\n`;
    message += `├ Uptime: ${(system.uptime / 3600).toFixed(2)}h\n`;
    message += `├ Memory: ${(system.memoryUsage / 1024 / 1024).toFixed(2)} MB\n`;
    message += `├ Cache Hit: ${system.cacheHitRate.toFixed(1)}%\n`;
    message += `└ Errors: ${counters.errors}\n`;

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Error getting stats:', error);
    await ctx.reply(`${EMOJI.ERROR} Error retrieving statistics.`);
  }
}

/**
 * Handle /users command - User management
 */
export async function handleUsersCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  try {
    const storage = getStorage();
    const users = await storage.getAllUsers();
    
    let message = `${EMOJI.LIST} <b>USER MANAGEMENT</b>\n\n`;
    message += `Total Users: ${users.size}\n\n`;
    
    // Show top users by wallet count
    const userArray = Array.from(users.entries())
      .map(([id, data]) => ({ id, walletCount: data.wallets.length, username: data.username }))
      .sort((a, b) => b.walletCount - a.walletCount)
      .slice(0, 10);

    message += `<b>Top 10 Users by Wallets:</b>\n\n`;
    
    for (let i = 0; i < userArray.length; i++) {
      const user = userArray[i];
      const username = user.username || 'Unknown';
      message += `${i + 1}. @${username}\n`;
      message += `   ID: <code>${user.id}</code>\n`;
      message += `   Wallets: ${user.walletCount}\n\n`;
    }

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Error getting users:', error);
    await ctx.reply(`${EMOJI.ERROR} Error retrieving users.`);
  }
}

/**
 * Handle /broadcast command - Send message to all users
 */
export async function handleBroadcastCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  const args = ctx.message?.text?.split(' ').slice(1);
  
  if (!args || args.length === 0) {
    await ctx.reply(
      `${EMOJI.INFO} <b>Broadcast Message</b>\n\n` +
      `Usage: /broadcast &lt;message&gt;\n\n` +
      `Example:\n` +
      `/broadcast Hello everyone! The bot has been updated with new features.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const message = args.join(' ');
  
  try {
    const storage = getStorage();
    const users = await storage.getAllUsers();
    
    let successCount = 0;
    let failCount = 0;
    
    for (const [userId] of users) {
      try {
        await ctx.api.sendMessage(userId, message, { parse_mode: 'HTML' });
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit
      } catch (error) {
        failCount++;
        logger.warn(`Failed to send broadcast to user ${userId}:`, error);
      }
    }
    
    await ctx.reply(
      `${EMOJI.SUCCESS} <b>Broadcast Complete</b>\n\n` +
      `✅ Sent: ${successCount}\n` +
      `❌ Failed: ${failCount}`,
      { parse_mode: 'HTML' }
    );
    
    logger.info(`Broadcast sent to ${successCount}/${users.size} users`);
  } catch (error) {
    logger.error('Error broadcasting message:', error);
    await ctx.reply(`${EMOJI.ERROR} Error sending broadcast.`);
  }
}

/**
 * Handle /analytics command - Detailed analytics
 */
export async function handleAnalyticsCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  try {
    const analytics = getAnalytics();
    const report = await analytics.generateReport();
    
    await ctx.reply(report, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error generating analytics:', error);
    await ctx.reply(`${EMOJI.ERROR} Error generating analytics report.`);
  }
}

/**
 * Handle /health command - System health check
 */
export async function handleHealthCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  try {
    const analytics = getAnalytics();
    const system = analytics.getSystemMetrics();
    const watcherStats = getWatcherStats();
    
    // Check system health
    const memoryUsageMB = system.memoryUsage / 1024 / 1024;
    const memoryHealthy = memoryUsageMB < 500; // < 500 MB is healthy
    const cacheHealthy = system.cacheHitRate > 50; // > 50% is healthy
    const watcherHealthy = watcherStats.total > 0;
    
    const overallHealthy = memoryHealthy && cacheHealthy && watcherHealthy;
    
    let message = `${overallHealthy ? '🟢' : '🟡'} <b>SYSTEM HEALTH</b>\n\n`;
    
    message += `<b>Status:</b> ${overallHealthy ? 'Healthy ✅' : 'Needs Attention ⚠️'}\n\n`;
    
    message += `💾 <b>Memory</b>\n`;
    message += `├ Used: ${memoryUsageMB.toFixed(2)} MB\n`;
    message += `└ Status: ${memoryHealthy ? '✅ OK' : '⚠️ High'}\n\n`;
    
    message += `📊 <b>Cache</b>\n`;
    message += `├ Hit Rate: ${system.cacheHitRate.toFixed(1)}%\n`;
    message += `└ Status: ${cacheHealthy ? '✅ OK' : '⚠️ Low'}\n\n`;
    
    message += `🔍 <b>Watcher</b>\n`;
    message += `├ Mode: ${watcherStats.mode}\n`;
    message += `├ Total: ${watcherStats.total}\n`;
    message += `└ Status: ${watcherHealthy ? '✅ Active' : '❌ Inactive'}\n\n`;
    
    message += `⏱️ <b>Uptime:</b> ${(system.uptime / 3600).toFixed(2)} hours`;

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Error checking health:', error);
    await ctx.reply(`${EMOJI.ERROR} Error checking system health.`);
  }
}

/**
 * Handle /logs command - View recent logs
 */
export async function handleLogsCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  await ctx.reply(
    `${EMOJI.DOCUMENT} <b>Logs</b>\n\n` +
    `View log files on your server:\n\n` +
    `• bot_output.log - General logs\n` +
    `• bot_error.log - Error logs\n` +
    `• bot_debug.log - Debug logs\n\n` +
    `<i>Use 'tail -f bot_output.log' on your server to watch live logs.</i>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Handle /restart command - Restart bot services
 */
export async function handleRestartCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  await ctx.reply(
    `${EMOJI.WARNING} <b>Restart Bot</b>\n\n` +
    `⚠️ This will restart the bot process.\n` +
    `All users will experience a brief disconnection.\n\n` +
    `<i>To restart, use your process manager (pm2, systemd, etc.)</i>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Handle /resetcounters command - Reset analytics counters
 */
export async function handleResetCountersCommand(ctx: Context): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply(`${EMOJI.ERROR} Unauthorized.`);
    return;
  }

  try {
    const analytics = getAnalytics();
    analytics.resetCounters();
    
    await ctx.reply(`${EMOJI.SUCCESS} Analytics counters have been reset.`);
    logger.info(`Admin ${ctx.from.id} reset analytics counters`);
  } catch (error) {
    logger.error('Error resetting counters:', error);
    await ctx.reply(`${EMOJI.ERROR} Error resetting counters.`);
  }
}

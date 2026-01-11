import { Bot, session } from 'grammy';
import { config } from './config';
import { setupHandlers, MyContext, SessionData } from './handlers';
import { startWatcher } from './watcher';
import { loadStorage } from './storage';
import { monitoring } from './monitoring';
import { startHealthCheckServer } from './health';
import { setupShutdownHandlers, registerShutdownHook } from './shutdown';
import { createLogger } from './logger';
import { Metrics, startMetricsLogging, metrics } from './metrics';
import { setBotInstance, markReady } from './health';
import { rateLimit } from './ratelimit';
import { setupLimitMonitoring } from './limit-alerts';
import { getLimitMonitor } from './limit-monitor';

const logger = createLogger('Main');

async function main() {
  logger.info('🤖 X1 Wallet Watcher Bot starting...', {
    version: '1.0.0',
    nodeEnv: config.nodeEnv,
    nodeVersion: process.version,
  });

  // Configuration is already validated in config.ts
  logger.info('✅ Configuration validated');

  // Initialize storage
  const { startPeriodicFlush, stopPeriodicFlush, forceFlushStorage } = await import('./storage');
  loadStorage();
  startPeriodicFlush(30000);
  logger.info('💾 Storage initialized with periodic flushing');
  
  // Register storage shutdown hook
  registerShutdownHook('storage', async () => {
    stopPeriodicFlush();
    forceFlushStorage();
    logger.info('Storage flushed and stopped');
  }, 5000);
  
  // Start cache cleanup
  const { startCacheCleanup, stopCacheCleanup } = await import('./cache');
  startCacheCleanup(300000);
  logger.info('🧹 Cache cleanup started');
  
  // Start memory monitoring
  const { startMemoryMonitor, stopMemoryMonitor } = await import('./memory-monitor');
  startMemoryMonitor();
  logger.info('🧠 Memory monitoring started');
  
  // Register cache shutdown hook
  registerShutdownHook('cache', async () => {
    stopCacheCleanup();
    logger.info('Cache cleanup stopped');
  }, 2000);
  
  // Register memory monitor shutdown hook
  registerShutdownHook('memory-monitor', async () => {
    stopMemoryMonitor();
    logger.info('Memory monitor stopped');
  }, 1000);
  
  // Start periodic wallet data cleanup (every 10 minutes)
  const { cleanupOldWalletData } = await import('./watcher');
  const walletCleanupInterval = setInterval(() => {
    cleanupOldWalletData();
  }, 600000); // 10 minutes
  
  registerShutdownHook('wallet-cleanup', async () => {
    clearInterval(walletCleanupInterval);
    logger.info('Wallet cleanup stopped');
  }, 1000);

  // Start monitoring system
  if (config.enablePerformanceMetrics) {
    monitoring.startPeriodicLogging(60000);
    startMetricsLogging(60000);
    logger.info('📊 Performance monitoring and metrics enabled');
  }
  
  // Register monitoring shutdown hook
  registerShutdownHook('monitoring', async () => {
    monitoring.stopPeriodicLogging();
    logger.info('📊 Final metrics:');
    monitoring.logMetricsSummary();
  }, 2000);
  
  // Register metrics shutdown hook
  const { stopMetricsLogging } = await import('./metrics');
  registerShutdownHook('metrics', async () => {
    stopMetricsLogging();
    logger.info('Metrics logging stopped');
  }, 1000);

  // Start health check server
  startHealthCheckServer();
  logger.info('🏥 Health check server started');

  // Create bot instance with proper typing
  const bot = new Bot<MyContext>(config.botToken);
  
  // Set bot instance for health checks
  setBotInstance(bot);

  // Setup middleware
  bot.use(session({ initial: (): SessionData => ({}) }));
  bot.use(rateLimit()); // Rate limiting middleware

  // Setup command and callback handlers
  setupHandlers(bot);
  logger.info('📋 Handlers registered');

  // Error handling with proper logging
  bot.catch((err) => {
    // Safely handle error with proper type checking
    const error = err instanceof Error ? err : new Error(String(err));
    
    logger.error('Bot error occurred', error);
    
    // Update system health
    monitoring.updateSystemHealth(false, `Bot error: ${error.message}`);
    metrics.incrementCounter('bot_errors_total', 1);
    
    // Log error details for debugging
    logger.error('Error details', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  });
  
  // Register bot shutdown hook
  registerShutdownHook('bot', async () => {
    try {
      await bot.stop();
      logger.info('Bot stopped gracefully');
    } catch (error: any) {
      logger.warn('Error stopping bot', error as Error);
    }
  }, 10000);
  
  // Register rate limiter shutdown hook
  const { stopRateLimiters } = await import('./ratelimit');
  registerShutdownHook('ratelimit', async () => {
    stopRateLimiters();
    logger.info('Rate limiters stopped');
  }, 1000);

  // Setup limit monitoring and alerts
  const adminUserIds = config.adminUserIds || [];
  if (adminUserIds.length > 0) {
    try {
      const { limitMonitor, alertService } = await setupLimitMonitoring(bot as any, adminUserIds);
      
      logger.info('🚨 Limit monitoring enabled', {
        adminCount: adminUserIds.length,
        monitors: ['RPC', 'Memory', 'CPU', 'Telegram', 'Storage']
      });

      // Register monitoring handlers
      const monitoringHandlers = await import('./handlers/monitoring-handlers');
      bot.command('status', monitoringHandlers.handleStatusCommand);
      bot.command('limits', monitoringHandlers.handleLimitsCommand);
      bot.command('health', monitoringHandlers.handleHealthCommand);
      bot.command('alerts', monitoringHandlers.handleAlertsCommand);
      bot.command('alerts_enable', monitoringHandlers.handleAlertsEnableCommand);
      bot.command('alerts_disable', monitoringHandlers.handleAlertsDisableCommand);
      bot.command('alerts_test', monitoringHandlers.handleAlertsTestCommand);
      bot.command('alerts_reset', monitoringHandlers.handleAlertsResetCommand);
      
      logger.info('📋 Monitoring commands registered');
    } catch (error) {
      logger.warn('Failed to setup limit monitoring', error as Error);
    }
  } else {
    logger.warn('⚠️ Limit monitoring disabled - no admin user IDs configured');
    logger.warn('   Add ADMIN_USER_IDS to .env to enable monitoring alerts');
  }

  // Start the wallet watcher service (now async with proper initialization)
  await startWatcher(bot);
  logger.info('👀 Wallet watcher service started');

  // Configure menu button and commands
  try {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'commands'
      }
    });
    
    await bot.api.setMyCommands([
      { command: 'start', description: '🏠 Start bot & show main menu' },
      { command: 'watch', description: '👀 Add a wallet to watch' },
      { command: 'list', description: '🔍 View your watched wallets' },
      { command: 'settings', description: '⚙️ Configure notifications' },
      { command: 'stats', description: '📊 View bot statistics' },
      { command: 'status', description: '🔌 Check bot & blockchain status' },
      { command: 'help', description: '❓ Show help & commands' }
    ]);
    
    logger.info('📋 Menu button and commands configured');
  } catch (error: any) {
    logger.warn('Failed to set menu button/commands', error as Error);
  }

  // Start the bot with timeout protection
  logger.info('🚀 Starting bot...');
  
  try {
    // Add startup timeout to detect if bot.start() hangs
    const startupTimeout = setTimeout(() => {
      logger.warn('⚠️ Bot startup taking longer than expected (30s), but continuing...');
      logger.info('⚠️ Bot startup delayed - this may indicate RPC connectivity issues');
    }, 30000);
    
    await bot.start({
      onStart: (botInfo) => {
        clearTimeout(startupTimeout);
        
        logger.info(`✅ Bot @${botInfo.username} is running!`, {
          username: botInfo.username,
          x1RpcUrl: config.x1RpcUrl,
          watcherConcurrency: config.watcherConcurrency,
          pollInterval: config.pollInterval,
        });
        
        logger.info(`\n✅ Bot @${botInfo.username} is running!`);
        logger.info(`📡 Watching X1 Blockchain via ${config.x1RpcUrl}`);
        logger.info(`⚙️  Watcher Concurrency: ${config.watcherConcurrency}`);
        logger.info(`⏱️  Poll Interval: ${config.pollInterval / 1000}s`);
        logger.info(`🏥 Health check: http://localhost:${config.healthCheckPort}/health`);
        logger.info('\nPress Ctrl+C to stop\n');
        
        monitoring.updateSystemHealth(true);
        markReady(); // Mark service as ready for traffic
        
        Metrics.activeUsers(0); // Initialize metrics
      },
    });
    
    // This line should never be reached as bot.start() runs forever
    logger.warn('⚠️ bot.start() returned unexpectedly');
  } catch (error: any) {
    logger.error('❌ bot.start() threw an error', error);
    throw error;
  }
}

// Setup graceful shutdown handlers
setupShutdownHandlers();

// Run the bot
main().catch((error) => {
  logger.error('Fatal error during startup', error);
  logger.error('❌ Fatal error:', error);
  process.exit(1);
});

/**
 * X1 Wallet Watcher Bot - Minimal Edition
 * Ultra-lightweight, fast, and simple
 */
import { Bot } from 'grammy';
import { config } from './config';
import { createLogger } from './logger';
import { loadStorage, startAutoSave, stopAutoSave, forceFlushStorage } from './storage';
import { startCleanup as startCacheCleanup, stopCleanup as stopCacheCleanup } from './cache';
import { initBlockchain } from './blockchain';
import { startWatcher, stopWatcher } from './watcher';
import { setupHandlers } from './handlers';
import { startHealthServer, stopHealthServer, markReady, logStats } from './monitoring';

const logger = createLogger('Main');

let bot: Bot;
let statsInterval: NodeJS.Timeout | null = null;

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Starting X1 Wallet Watcher Bot (Minimal Edition)...\n');
  
  logger.info('Bot starting', {
    version: '2.0.0-minimal',
    nodeVersion: process.version,
    config: {
      rpcUrl: config.x1RpcUrl,
      pollInterval: config.pollInterval,
    },
  });
  
  // Initialize storage
  loadStorage();
  startAutoSave();
  logger.info('✅ Storage initialized');
  
  // Start cache cleanup
  startCacheCleanup();
  logger.info('✅ Cache cleanup started');
  
  // Initialize blockchain connection
  initBlockchain();
  logger.info('✅ Blockchain connection initialized');
  
  // Start health server
  startHealthServer();
  
  // Create bot
  bot = new Bot(config.botToken);
  logger.info('✅ Bot instance created');
  
  // Setup handlers
  setupHandlers(bot);
  logger.info('✅ Handlers registered');
  
  // Error handling
  bot.catch((err) => {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Bot error', error);
  });
  
  // Start watcher service
  await startWatcher(bot);
  logger.info('✅ Watcher service started');
  
  // Configure bot commands
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: '🏠 Start bot & show main menu' },
      { command: 'watch', description: '👀 Add a wallet to watch' },
      { command: 'list', description: '📍 View your watched wallets' },
      { command: 'settings', description: '⚙️ Configure notifications' },
      { command: 'stats', description: '📊 View bot statistics' },
      { command: 'status', description: '🔌 Check bot status' },
      { command: 'help', description: '❓ Show help' },
    ]);
    logger.info('✅ Bot commands configured');
  } catch (error) {
    logger.warn('Failed to set bot commands', error);
  }
  
  // Start periodic stats logging
  statsInterval = setInterval(() => {
    logStats();
  }, 300000); // Every 5 minutes
  
  // Start bot
  logger.info('🚀 Starting bot polling...');
  
  await bot.start({
    onStart: (botInfo) => {
      console.log(`\n✅ Bot @${botInfo.username} is running!`);
      console.log(`📡 X1 RPC: ${config.x1RpcUrl}`);
      console.log(`⏱️  Poll Interval: ${config.pollInterval / 1000}s`);
      console.log(`🏥 Health: http://localhost:${config.healthCheckPort}/health`);
      console.log(`\nPress Ctrl+C to stop\n`);
      
      markReady();
      logStats();
    },
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
  
  logger.info(`Shutdown initiated by ${signal}`);
  
  try {
    // Stop watcher
    stopWatcher();
    logger.info('Watcher stopped');
    
    // Stop bot
    if (bot) {
      await bot.stop();
      logger.info('Bot stopped');
    }
    
    // Stop periodic tasks
    if (statsInterval) {
      clearInterval(statsInterval);
    }
    stopCacheCleanup();
    
    // Save storage
    stopAutoSave();
    forceFlushStorage();
    logger.info('Storage saved');
    
    // Stop health server
    stopHealthServer();
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
});

// Start the bot
main().catch((error) => {
  logger.error('Fatal error during startup', error);
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

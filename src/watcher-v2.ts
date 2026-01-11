/**
 * Watcher V2 - Hybrid WebSocket + Polling
 * Uses WebSocket for real-time updates with polling fallback
 */

import { Bot, Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { config } from './config';
import { 
  getAllUsersWithWallets, 
  updateWalletData, 
  incrementNotificationCount,
  updateTokenBalance
} from './storage';
import { 
  getBalance, 
  getLatestSignatures,
  getRecentTransactions,
  formatValue,
  getTxExplorerUrl,
  getAddressExplorerUrl,
  getTokenBalance,
  formatTokenBalance,
  getTokenExplorerUrl
} from './blockchain';
import { TransactionInfo, NotificationSettings, WatchedWallet, TrackedToken } from './types';
import { batchAsync } from './cache';
import { getRealtimeWatcher, initRealtimeWatcher } from './realtime-watcher';
import { initWebSocketManager } from './websocket-manager';
import logger from './logger';

// Track last checked signature per wallet (for transaction detection)
const lastCheckedSignature: Map<string, string> = new Map();

// Store pending transactions for user review
const pendingTransactions: Map<string, TransactionInfo[]> = new Map();

// WebSocket or Polling mode flag
let useWebSockets = true;
let realtimeWatcher: ReturnType<typeof getRealtimeWatcher> | null = null;

// Export for handlers to access
export function getPendingTransactions(walletAddress: string): TransactionInfo[] {
  return pendingTransactions.get(walletAddress.toLowerCase()) || [];
}

export function clearPendingTransactions(walletAddress: string): void {
  pendingTransactions.set(walletAddress.toLowerCase(), []);
}

/**
 * Start the wallet watcher with WebSocket support
 */
export function startWatcher<C extends Context>(bot: Bot<C>): void {
  logger.info('🔍 Starting Wallet Watcher V2 (WebSocket + Polling)...');
  
  // Check if WebSockets are available (some RPC endpoints don't support it)
  const wsEnabled = checkWebSocketSupport();
  
  if (wsEnabled) {
    logger.info('✅ WebSocket support detected - using real-time subscriptions');
    initWebSocketManager();
    realtimeWatcher = initRealtimeWatcher();
    useWebSockets = true;
    
    // Subscribe all existing wallets to WebSocket
    subscribeAllWalletsToWebSocket(bot);
  } else {
    logger.warn('⚠️ WebSocket not available - using polling fallback');
    useWebSockets = false;
  }
  
  // Start polling as backup (checks transactions, not just balance)
  startPollingBackup(bot);
  
  logger.info('✅ Wallet Watcher V2 started successfully');
}

/**
 * Check if WebSocket is supported
 */
function checkWebSocketSupport(): boolean {
  try {
    const rpcUrl = config.x1RpcUrl;
    // WebSocket URLs typically use wss:// or ws://
    const wsUrl = rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    
    // If RPC URL doesn't support WebSocket, it won't have wss protocol
    if (wsUrl.startsWith('wss://') || wsUrl.startsWith('ws://')) {
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error checking WebSocket support:', error);
    return false;
  }
}

/**
 * Subscribe all existing wallets to WebSocket
 */
async function subscribeAllWalletsToWebSocket<C extends Context>(bot: Bot<C>): Promise<void> {
  if (!realtimeWatcher) return;
  
  try {
    const users = getAllUsersWithWallets();
    let totalWallets = 0;
    
    for (const [userId, userData] of Array.from(users.entries())) {
      for (const wallet of userData.wallets) {
        const success = await realtimeWatcher.subscribeToWallet(
          wallet.address,
          userId,
          (address, newBalance, oldBalance) => {
            handleBalanceChange(bot, userId, address, newBalance, oldBalance);
          }
        );
        
        if (success) {
          totalWallets++;
        }
      }
    }
    
    logger.info(`✅ Subscribed ${totalWallets} wallets to WebSocket`);
  } catch (error) {
    logger.error('Error subscribing wallets to WebSocket:', error);
  }
}

/**
 * Handle balance change from WebSocket
 */
async function handleBalanceChange<C extends Context>(
  bot: Bot<C>,
  userId: number,
  address: string,
  newBalance: string,
  oldBalance: string
): Promise<void> {
  try {
    // Update wallet data
    updateWalletData(userId, address, { lastBalance: newBalance });
    
    // Check for new transactions
    await checkWalletTransactions(bot, userId, address);
    
    logger.debug(`Balance updated for ${address.slice(0, 8)}...: ${oldBalance} → ${newBalance}`);
  } catch (error) {
    logger.error(`Error handling balance change for ${address}:`, error);
  }
}

/**
 * Start polling backup (for transaction detection)
 */
function startPollingBackup<C extends Context>(bot: Bot<C>): void {
  // Polling is still useful for transaction detection
  // WebSocket only tells us about balance changes, not transaction details
  
  let running = false;
  const pollInterval = useWebSockets ? 60000 : config.pollInterval; // 60s for WS, 15s for polling-only
  
  const pollOnce = async () => {
    if (running) {
      logger.debug('⏳ Polling backup skipped (previous run still in progress)');
      return;
    }
    
    running = true;
    const startedAt = Date.now();
    let success = true;
    
    try {
      await checkAllWalletsTransactions(bot);
    } catch (e) {
      logger.error('Polling backup failed:', e);
      success = false;
    } finally {
      const elapsed = Date.now() - startedAt;
      running = false;
      
      if (elapsed > 1000) {
        logger.debug(`Polling backup finished in ${elapsed}ms`);
      }
      
      // Record metrics
      try {
        const { monitoring } = await import('./monitoring');
        monitoring.recordWatcherCycle(elapsed, success);
        monitoring.updateSystemHealth(success);
      } catch (e) {
        // Monitoring not available
      }
    }
  };
  
  // Start after delay
  setTimeout(pollOnce, 10000); // 10 seconds
  setInterval(pollOnce, pollInterval);
  
  logger.info(`✅ Polling backup started (every ${pollInterval / 1000}s)`);
}

/**
 * Check all wallets for new transactions
 */
async function checkAllWalletsTransactions<C extends Context>(bot: Bot<C>): Promise<void> {
  const users = getAllUsersWithWallets();
  
  for (const [userId, userData] of Array.from(users.entries())) {
    const wallets = userData.wallets;
    
    // Process in batches
    const concurrency = config.watcherConcurrency || 3;
    await batchAsync(
      wallets,
      (wallet: any) => checkWalletTransactions(bot, userId, wallet.address),
      concurrency
    );
  }
}

/**
 * Check a single wallet for new transactions
 */
async function checkWalletTransactions<C extends Context>(
  bot: Bot<C>,
  userId: number,
  address: string
): Promise<void> {
  try {
    const lastSig = lastCheckedSignature.get(address.toLowerCase()) || '';
    
    // Get latest signatures
    const latestSigs = await getLatestSignatures(address, 10);
    
    if (latestSigs.length === 0) {
      return;
    }
    
    // Update last checked signature
    lastCheckedSignature.set(address.toLowerCase(), latestSigs[0].signature);
    
    // Find new transactions
    const newSignatures = lastSig 
      ? latestSigs.filter(sig => sig.signature !== lastSig).slice(0, 5)
      : latestSigs.slice(0, 1); // Only notify about most recent on first check
    
    if (newSignatures.length === 0) {
      return;
    }
    
    // Get transaction details
    const txSignatures = Array.isArray(newSignatures) ? newSignatures.map(s => s.signature) : [newSignatures];
    const transactions = await getRecentTransactions(address, txSignatures.join(','));
    
    if (transactions.length > 0) {
      // Notify user
      await notifyUserOfTransactions(bot, userId, address, transactions);
    }
  } catch (error) {
    logger.error(`Error checking transactions for ${address}:`, error);
  }
}

/**
 * Notify user of new transactions
 */
async function notifyUserOfTransactions<C extends Context>(
  bot: Bot<C>,
  userId: number,
  walletAddress: string,
  transactions: TransactionInfo[]
): Promise<void> {
  try {
    // Store pending transactions
    const existing = pendingTransactions.get(walletAddress.toLowerCase()) || [];
    pendingTransactions.set(walletAddress.toLowerCase(), [...existing, ...transactions]);
    
    // Send notification
    const usersMap = getAllUsersWithWallets();
    const userDataArray = Array.from(usersMap.entries());
    const userEntry = userDataArray.find(([uid]) => uid === userId);
    const userData = userEntry ? userEntry[1] : undefined;
    const wallet = userData?.wallets.find((w: any) => w.address === walletAddress);
    const label = wallet?.label || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    
    for (const tx of transactions) {
      const message = formatTransactionNotification(label, walletAddress, tx);
      const keyboard = createTransactionKeyboard(walletAddress, tx);
      
      await bot.api.sendMessage(userId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      
      incrementNotificationCount();
    }
  } catch (error) {
    logger.error(`Error notifying user ${userId}:`, error);
  }
}

/**
 * Format transaction notification message
 */
function formatTransactionNotification(
  label: string,
  address: string,
  tx: TransactionInfo
): string {
  const txAny = tx as any;
  const emoji = txAny.type === 'incoming' ? '📥' : '📤';
  const typeLabel = txAny.type === 'incoming' ? 'Incoming' : 'Outgoing';
  
  let message = `${emoji} <b>${typeLabel} Transaction</b>\n\n`;
  message += `🏷️ <b>Wallet:</b> ${label}\n`;
  message += `💰 <b>Amount:</b> ${formatValue(txAny.amount || tx.value)} ${txAny.token || 'XNT'}\n`;
  
  if (tx.from) {
    message += `📤 <b>From:</b> <code>${tx.from.slice(0, 8)}...${tx.from.slice(-6)}</code>\n`;
  }
  if (tx.to) {
    message += `📥 <b>To:</b> <code>${tx.to.slice(0, 8)}...${tx.to.slice(-6)}</code>\n`;
  }
  
  const timestamp = tx.timestamp || Math.floor(Date.now() / 1000);
  message += `🕐 <b>Time:</b> ${new Date(timestamp * 1000).toLocaleString()}\n`;
  message += `\n🔗 <a href="${getTxExplorerUrl(tx.hash)}">View on Explorer</a>`;
  
  return message;
}

/**
 * Create transaction notification keyboard
 */
function createTransactionKeyboard(walletAddress: string, tx: TransactionInfo): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  keyboard
    .url('🔍 View TX', getTxExplorerUrl(tx.hash))
    .url('👛 View Wallet', getAddressExplorerUrl(walletAddress))
    .row()
    .text('✅ Dismiss', `dismiss_tx_${walletAddress}`);
  
  return keyboard;
}

/**
 * Register a new wallet for watching
 */
export async function registerWalletForWatching(address: string): Promise<void> {
  try {
    // Get initial signature
    const signatures = await getLatestSignatures(address, 1);
    if (signatures.length > 0) {
      lastCheckedSignature.set(address.toLowerCase(), signatures[0].signature);
    } else {
      lastCheckedSignature.set(address.toLowerCase(), '');
    }
    
    pendingTransactions.set(address.toLowerCase(), []);
    
    // Subscribe to WebSocket if available
    if (useWebSockets && realtimeWatcher) {
      const bot = (global as any).bot; // Assuming bot is stored globally
      await realtimeWatcher.subscribeToWallet(
        address,
        0, // We'll get userId from context later
        (addr, newBalance, oldBalance) => {
          logger.info(`Balance changed for ${addr}: ${oldBalance} → ${newBalance}`);
        }
      );
      logger.info(`✅ Registered ${address.slice(0, 8)}... with WebSocket`);
    } else {
      logger.info(`✅ Registered ${address.slice(0, 8)}... with polling`);
    }
  } catch (error) {
    logger.error(`Error registering wallet ${address}:`, error);
  }
}

/**
 * Unregister a wallet from watching
 */
export async function unregisterWalletFromWatching(address: string): Promise<void> {
  lastCheckedSignature.delete(address.toLowerCase());
  pendingTransactions.delete(address.toLowerCase());
  
  // Unsubscribe from WebSocket
  if (useWebSockets && realtimeWatcher) {
    await realtimeWatcher.unsubscribeFromWallet(address);
    logger.info(`✅ Unregistered ${address.slice(0, 8)}... from WebSocket`);
  }
}

/**
 * Get watcher statistics
 */
export function getWatcherStats(): any {
  if (realtimeWatcher) {
    return {
      mode: 'hybrid',
      websockets: useWebSockets,
      ...realtimeWatcher.getStats(),
    };
  }
  
  return {
    mode: 'polling',
    websockets: false,
    total: lastCheckedSignature.size,
  };
}

/**
 * Toggle WebSocket mode
 */
export async function toggleWebSocketMode(enabled: boolean): Promise<void> {
  useWebSockets = enabled;
  
  if (enabled && !realtimeWatcher) {
    initWebSocketManager();
    realtimeWatcher = initRealtimeWatcher();
  } else if (!enabled && realtimeWatcher) {
    await realtimeWatcher.shutdown();
    realtimeWatcher = null;
  }
  
  logger.info(`WebSocket mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Graceful shutdown
 */
export async function shutdownWatcher(): Promise<void> {
  logger.info('Shutting down watcher...');
  
  if (realtimeWatcher) {
    await realtimeWatcher.shutdown();
  }
  
  logger.info('✅ Watcher shutdown complete');
}

/**
 * Efficient Wallet Watcher with Smart Polling
 * Simplified from 600 lines → 250 lines
 */
import { Bot, Context } from 'grammy';
import { getConnection, getRecentTransactions, getBatchBalances, formatXN, getTxUrl, formatAddress } from './blockchain';
import { getAllWatchedWallets, updateWallet, getUser } from './storage';
import { get as cacheGet, set as cacheSet } from './cache';
import { config } from './config';
import { createLogger } from './logger';
import { Transaction, WatchedWallet } from './types';
import { sleep } from './utils';

const logger = createLogger('Watcher');

let bot: Bot;
let watcherInterval: NodeJS.Timeout | null = null;
let isWatching = false;

// Track active wallets for smart polling
const activityTracker = new Map<string, { lastActivity: number; pollInterval: number }>();

/**
 * Start wallet watcher service
 */
export async function startWatcher(botInstance: Bot): Promise<void> {
  bot = botInstance;
  
  if (isWatching) {
    logger.warn('Watcher already running');
    return;
  }
  
  isWatching = true;
  logger.info('Wallet watcher started', { pollInterval: config.pollInterval });
  
  // Initial scan
  await scanWallets();
  
  // Start periodic scanning
  watcherInterval = setInterval(async () => {
    await scanWallets();
  }, config.pollInterval);
}

/**
 * Stop wallet watcher
 */
export function stopWatcher(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
  isWatching = false;
  logger.info('Wallet watcher stopped');
}

/**
 * Scan all watched wallets
 */
async function scanWallets(): Promise<void> {
  try {
    const watchedWallets = getAllWatchedWallets();
    
    if (watchedWallets.length === 0) {
      return;
    }
    
    logger.debug(`Scanning ${watchedWallets.length} wallets`);
    
    // Smart polling: filter wallets that need checking
    const walletsToCheck = watchedWallets.filter(({ wallet }) => {
      return shouldCheckWallet(wallet);
    });
    
    if (walletsToCheck.length === 0) {
      return;
    }
    
    // Batch get balances for all wallets
    const addresses = walletsToCheck.map(w => w.wallet.address);
    const balances = await getBatchBalances(addresses);
    
    // Process each wallet
    const promises = walletsToCheck.map(({ telegramId, wallet }) =>
      checkWallet(telegramId, wallet, balances.get(wallet.address) || 0)
    );
    
    await Promise.allSettled(promises);
    
  } catch (error) {
    logger.error('Error during wallet scan', error);
  }
}

/**
 * Smart polling: determine if wallet needs checking
 */
function shouldCheckWallet(wallet: WatchedWallet): boolean {
  const activity = activityTracker.get(wallet.address);
  
  if (!activity) {
    // New wallet, check it
    return true;
  }
  
  const timeSinceLastCheck = Date.now() - (wallet.lastChecked || 0);
  return timeSinceLastCheck >= activity.pollInterval;
}

/**
 * Update polling interval based on activity
 */
function updatePollingInterval(address: string, hasActivity: boolean): void {
  const current = activityTracker.get(address);
  
  if (hasActivity) {
    // Active wallet: check frequently
    activityTracker.set(address, {
      lastActivity: Date.now(),
      pollInterval: config.pollInterval, // Default interval
    });
  } else if (current) {
    // Inactive wallet: gradually increase interval
    const timeSinceActivity = Date.now() - current.lastActivity;
    
    if (timeSinceActivity > 24 * 60 * 60 * 1000) {
      // No activity for 24h: check every 5 minutes
      current.pollInterval = 300000;
    } else if (timeSinceActivity > 60 * 60 * 1000) {
      // No activity for 1h: check every minute
      current.pollInterval = 60000;
    }
    
    activityTracker.set(address, current);
  } else {
    // First check with no activity
    activityTracker.set(address, {
      lastActivity: 0,
      pollInterval: config.pollInterval,
    });
  }
}

/**
 * Check individual wallet for changes
 */
async function checkWallet(
  telegramId: number,
  wallet: WatchedWallet,
  currentBalance: number
): Promise<void> {
  try {
    const user = getUser(telegramId);
    const { settings } = user;
    
    // Check for new transactions
    const transactions = await getRecentTransactions(wallet.address, 5, wallet.lastSignature);
    
    if (transactions.length > 0) {
      // Has new activity
      updatePollingInterval(wallet.address, true);
      
      // Process transactions (newest first)
      for (const tx of transactions.reverse()) {
        await handleTransaction(telegramId, wallet, tx, settings);
      }
      
      // Update last signature
      updateWallet(telegramId, wallet.address, {
        lastSignature: transactions[0].signature,
        lastChecked: Date.now(),
        lastBalance: currentBalance.toString(),
      });
    } else {
      // No new transactions
      updatePollingInterval(wallet.address, false);
      
      // Check for balance change (without transaction)
      if (wallet.lastBalance !== undefined) {
        const lastBalance = parseFloat(wallet.lastBalance);
        const diff = currentBalance - lastBalance;
        
        if (Math.abs(diff) >= settings.minValueXn && settings.notifyBalanceChange) {
          await notifyBalanceChange(telegramId, wallet, lastBalance, currentBalance, diff);
        }
      }
      
      // Update last checked
      updateWallet(telegramId, wallet.address, {
        lastChecked: Date.now(),
        lastBalance: currentBalance.toString(),
      });
    }
    
  } catch (error) {
    logger.error(`Error checking wallet ${wallet.address}`, error);
  }
}

/**
 * Handle new transaction
 */
async function handleTransaction(
  telegramId: number,
  wallet: WatchedWallet,
  tx: Transaction,
  settings: any
): Promise<void> {
  try {
    // Check if already notified (cache)
    const cacheKey = `notified:${tx.signature}`;
    if (cacheGet(cacheKey)) {
      return;
    }
    
    // Check amount threshold
    if (tx.amount && tx.amount < settings.minValueXn) {
      return;
    }
    
    // Check notification settings
    if (tx.type === 'incoming' && !settings.notifyIncoming) return;
    if (tx.type === 'outgoing' && !settings.notifyOutgoing) return;
    
    // Send notification
    await sendTransactionNotification(telegramId, wallet, tx);
    
    // Mark as notified
    cacheSet(cacheKey, true, 86400); // Cache for 24h
    
  } catch (error) {
    logger.error('Error handling transaction', error);
  }
}

/**
 * Send transaction notification
 */
async function sendTransactionNotification(
  telegramId: number,
  wallet: WatchedWallet,
  tx: Transaction
): Promise<void> {
  try {
    const emoji = tx.type === 'incoming' ? '📥' : tx.type === 'outgoing' ? '📤' : '🔄';
    const color = tx.type === 'incoming' ? '🟢' : '🔴';
    const typeText = tx.type.toUpperCase();
    
    let message = `${color} ${emoji} <b>${typeText} Transaction</b>\n\n`;
    
    if (wallet.label) {
      message += `📍 <b>Wallet:</b> "${wallet.label}"\n`;
    }
    
    if (tx.amount) {
      message += `💰 <b>Amount:</b> ${formatXN(tx.amount)}\n`;
    }
    
    const date = new Date(tx.blockTime * 1000);
    message += `⏰ <b>Time:</b> ${date.toLocaleString()}\n\n`;
    
    if (tx.from && tx.type === 'incoming') {
      message += `<b>From:</b> <code>${formatAddress(tx.from, 8)}</code>\n`;
    }
    
    if (tx.to && tx.type === 'outgoing') {
      message += `<b>To:</b> <code>${formatAddress(tx.to, 8)}</code>\n`;
    }
    
    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔗 View Transaction', url: getTxUrl(tx.signature) },
          ],
        ],
      },
    });
    
    logger.info(`Sent ${tx.type} notification to user ${telegramId}`);
  } catch (error) {
    logger.error('Failed to send transaction notification', error);
  }
}

/**
 * Notify balance change
 */
async function notifyBalanceChange(
  telegramId: number,
  wallet: WatchedWallet,
  oldBalance: number,
  newBalance: number,
  diff: number
): Promise<void> {
  try {
    const emoji = diff > 0 ? '📈' : '📉';
    const color = diff > 0 ? '🟢' : '🔴';
    const sign = diff > 0 ? '+' : '';
    
    let message = `${emoji} <b>Balance Change</b>\n\n`;
    
    if (wallet.label) {
      message += `📍 <b>Wallet:</b> "${wallet.label}"\n`;
    }
    
    message += `💰 <b>Balance ${diff > 0 ? 'increased' : 'decreased'}:</b>\n`;
    message += `   Old: ${formatXN(oldBalance)}\n`;
    message += `   New: ${formatXN(newBalance)}\n`;
    message += `   ${color} ${sign}${formatXN(Math.abs(diff))}`;
    
    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
    });
  } catch (error) {
    logger.error('Failed to send balance change notification', error);
  }
}

/**
 * Get watcher statistics
 */
export function getWatcherStats() {
  return {
    isWatching,
    pollInterval: config.pollInterval,
    activeWallets: activityTracker.size,
  };
}

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
import { createLogger } from './logger';

const logger = createLogger('Watcher');

// Track last checked signature per wallet
const lastCheckedSignature: Map<string, string> = new Map();

// Store pending transactions for user review (walletAddress -> transactions[])
const pendingTransactions: Map<string, TransactionInfo[]> = new Map();

// Store interval reference for cleanup
let watcherInterval: NodeJS.Timeout | null = null;

// Memory management constants
const MAX_PENDING_TRANSACTIONS_PER_WALLET = 100;
const MAX_TRACKED_WALLETS = 10000; // Safety limit

// Export for handlers to access
export function getPendingTransactions(walletAddress: string): TransactionInfo[] {
  return pendingTransactions.get(walletAddress.toLowerCase()) || [];
}

export function clearPendingTransactions(walletAddress: string): void {
  pendingTransactions.set(walletAddress.toLowerCase(), []);
}

// Cleanup old wallet data (call periodically)
export function cleanupOldWalletData(): void {
  // Get all currently active wallets
  const activeWallets = new Set<string>();
  const users = getAllUsersWithWallets();
  
  for (const user of users) {
    for (const wallet of user.wallets) {
      activeWallets.add(wallet.address.toLowerCase());
    }
  }
  
  // Remove data for wallets that are no longer tracked
  let removedSignatures = 0;
  let removedTransactions = 0;
  
  for (const address of lastCheckedSignature.keys()) {
    if (!activeWallets.has(address)) {
      lastCheckedSignature.delete(address);
      removedSignatures++;
    }
  }
  
  for (const address of pendingTransactions.keys()) {
    if (!activeWallets.has(address)) {
      pendingTransactions.delete(address);
      removedTransactions++;
    } else {
      // Limit pending transactions per wallet
      const txs = pendingTransactions.get(address);
      if (txs && txs.length > MAX_PENDING_TRANSACTIONS_PER_WALLET) {
        pendingTransactions.set(address, txs.slice(-MAX_PENDING_TRANSACTIONS_PER_WALLET));
      }
    }
  }
  
  if (removedSignatures > 0 || removedTransactions > 0) {
    logger.info('Cleaned up old wallet data', { removedSignatures, removedTransactions });
  }
}

// Safety check for memory limits
export function checkMemoryLimits(): { ok: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (lastCheckedSignature.size > MAX_TRACKED_WALLETS) {
    warnings.push(`Too many tracked wallets: ${lastCheckedSignature.size}/${MAX_TRACKED_WALLETS}`);
  }
  
  if (pendingTransactions.size > MAX_TRACKED_WALLETS) {
    warnings.push(`Too many pending transaction records: ${pendingTransactions.size}/${MAX_TRACKED_WALLETS}`);
  }
  
  return { ok: warnings.length === 0, warnings };
}

// Watcher initialization state
let watcherInitialized = false;
let watcherInitializing = false;
let initializationError: string | null = null;

// Get watcher initialization status
export function getWatcherStatus(): { initialized: boolean; initializing: boolean; error: string | null } {
  return { initialized: watcherInitialized, initializing: watcherInitializing, error: initializationError };
}

// Start the wallet watcher with proper initialization
export async function startWatcher<C extends Context>(bot: Bot<C>): Promise<void> {
  if (watcherInitialized) {
    logger.info('⚠️  Wallet watcher already started');
    return;
  }
  
  if (watcherInitializing) {
    logger.info('⚠️  Wallet watcher initialization already in progress');
    return;
  }
  
  watcherInitializing = true;
  logger.info('🔍 Starting wallet watcher service...');
  
  try {
    // Wait for initial sync to complete before starting polling
    logger.info('Running initial signature sync...');
    await syncInitialSignatures();
    logger.info('Initial signature sync completed');
    
    watcherInitialized = true;
    initializationError = null;
  } catch (err: any) {
    logger.error('❌ Failed to initialize wallet watcher:', err);
    initializationError = err.message;
    watcherInitializing = false;
    throw new Error(`Wallet watcher initialization failed: ${err.message}`);
  } finally {
    watcherInitializing = false;
  }
  
  // Non-overlapping polling loop:
  // Using setInterval without awaiting can create overlapping runs that hammer the RPC,
  // trigger 429s, and make the bot appear frozen.
  let running = false;
  const pollOnce = async () => {
    if (!watcherInitialized) {
      logger.info('⏳ Watcher tick skipped (not initialized)');
      return;
    }
    
    if (running) {
      logger.info('⏳ Watcher tick skipped (previous run still in progress)');
      return;
    }
    running = true;
    const startedAt = Date.now();
    let success = true;
    try {
      await checkAllWallets(bot);
    } catch (e) {
      logger.error('Watcher tick failed:', e);
      success = false;
    } finally {
      const elapsed = Date.now() - startedAt;
      running = false;
      if (elapsed > 1000) {
        logger.info(`✅ Watcher tick finished in ${elapsed}ms`);
      }
      
      // Record metrics if monitoring is available
      try {
        const { monitoring } = await import('./monitoring');
        monitoring.recordWatcherCycle(elapsed, success);
        monitoring.updateSystemHealth(success);
      } catch (e) {
        // Monitoring not available, skip
      }
    }
  };

  // Kick off first tick after a short delay to let bot fully initialize, then schedule subsequent ticks.
  setTimeout(pollOnce, 5000); // Wait 5 seconds before first tick
  watcherInterval = setInterval(pollOnce, config.pollInterval);
  
  logger.info(`✅ Wallet watcher started (polling every ${config.pollInterval / 1000}s, non-overlapping)`);
}

// Sync initial signatures for all wallets with timeout protection
async function syncInitialSignatures(): Promise<void> {
  const SYNC_TIMEOUT = 10000; // 10 second timeout
  
  try {
    const users = getAllUsersWithWallets();
    logger.info(`📦 Syncing initial signatures for ${users.length} user(s)...`);
    
    // Create a timeout promise
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Initial sync timeout')), SYNC_TIMEOUT);
    });
    
    // Create the sync promise
    const syncPromise = (async () => {
      for (const user of users) {
        for (const wallet of user.wallets) {
          const addressKey = wallet.address.toLowerCase();
          
          if (!lastCheckedSignature.has(addressKey)) {
            try {
              // Add per-wallet timeout with cleanup capability
              const timeoutRef = { timer: null as NodeJS.Timeout | null };
              const walletTimeout = new Promise<never>((_, reject) => {
                timeoutRef.timer = setTimeout(() => reject(new Error('Wallet sync timeout')), 3000);
              });
              
              // Get the latest signature for this wallet with timeout
              let signatures;
              try {
                signatures = await Promise.race([
                  getLatestSignatures(wallet.address, 1),
                  walletTimeout
                ]);
                // Clear timeout on success
                if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
              } catch (raceError) {
                // Clear timeout on error
                if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
                throw raceError;
              }
              
              if (signatures.length > 0) {
                lastCheckedSignature.set(addressKey, signatures[0].signature);
                logger.info(`📦 Synced wallet ${wallet.address.slice(0, 8)}... to signature ${signatures[0].signature.slice(0, 16)}...`);
              } else {
                // No transactions yet, set empty marker
                lastCheckedSignature.set(addressKey, '');
                logger.info(`📦 No transactions for wallet ${wallet.address.slice(0, 8)}...`);
              }
            } catch (walletError: any) {
              // If a single wallet fails, continue with others
              logger.warn(`⚠️ Failed to sync wallet ${wallet.address.slice(0, 8)}...: ${walletError.message}`);
              lastCheckedSignature.set(addressKey, '');
            }
            
            // Initialize empty pending transactions
            pendingTransactions.set(addressKey, []);
          }
        }
      }
    })();
    
    // Race between sync and timeout
    await Promise.race([syncPromise, timeoutPromise]);
    
    logger.info('✅ Initial signature sync complete');
  } catch (error: any) {
    logger.warn(`⚠️ Initial signature sync error (non-fatal): ${error.message}`);
    logger.info('⏭️ Bot will continue without initial sync, signatures will be tracked from now on');
  }
}

// Deduplicate wallets being checked (multiple users might watch the same wallet)
const walletCheckInProgress: Set<string> = new Set();

// Check all wallets for new transactions
async function checkAllWallets<C extends Context>(bot: Bot<C>): Promise<void> {
  try {
    const users = getAllUsersWithWallets();

    // Flatten (user,wallet) into work items so we can cap concurrency.
    const work: Array<{ telegramId: number; wallet: WatchedWallet; settings: NotificationSettings }> = [];
    const seenWallets = new Set<string>();
    
    for (const user of users) {
      for (const wallet of user.wallets) {
        const walletKey = wallet.address.toLowerCase();
        
        // Skip if this wallet is currently being checked
        if (walletCheckInProgress.has(walletKey)) {
          continue;
        }
        
        // Deduplicate wallets within this batch (multiple users watching same wallet)
        if (!seenWallets.has(walletKey)) {
          seenWallets.add(walletKey);
          work.push({ telegramId: user.telegramId, wallet, settings: user.settings });
        }
      }
    }

    // Conservative concurrency to avoid RPC 429 rate limits.
    // Configurable via WATCHER_CONCURRENCY env var
    const WATCHER_CONCURRENCY = config.watcherConcurrency;
    
    if (work.length > 0) {
      logger.info(`🔄 Checking ${work.length} wallet(s) with concurrency ${WATCHER_CONCURRENCY}`);
    }

    await batchAsync(
      work,
      (item) => checkWallet(bot, item.telegramId, item.wallet, item.settings),
      WATCHER_CONCURRENCY
    );
  } catch (error) {
    logger.error('Error checking wallets:', error);
  }
}

// Check a single wallet for new transactions (optimized)
async function checkWallet<C extends Context>(
  bot: Bot<C>,
  telegramId: number,
  wallet: WatchedWallet,
  settings: NotificationSettings
): Promise<void> {
  const addressKey = wallet.address.toLowerCase();
  
  // Mark wallet as being checked
  walletCheckInProgress.add(addressKey);
  
  try {
    // Get last checked signature
    let lastSignature = lastCheckedSignature.get(addressKey);
    
    if (lastSignature === undefined) {
      // First time checking this wallet - sync and get initial balance
      const [signatures, balance] = await Promise.all([
        getLatestSignatures(wallet.address, 1),
        getBalance(wallet.address)
      ]);
      
      if (signatures.length > 0) {
        lastCheckedSignature.set(addressKey, signatures[0].signature);
      } else {
        lastCheckedSignature.set(addressKey, '');
      }
      
      pendingTransactions.set(addressKey, []);
      
      updateWalletData(telegramId, wallet.address, {
        lastBalance: balance,
        lastSignature: signatures[0]?.signature || ''
      });
      
      // Initialize token balances (in parallel)
      if (wallet.trackedTokens && wallet.trackedTokens.length > 0) {
        const tokenBalancePromises = wallet.trackedTokens.map(async (token) => {
          const tokenBalance = await getTokenBalance(token.contractAddress, wallet.address);
          if (tokenBalance) {
            updateTokenBalance(telegramId, wallet.address, token.contractAddress, tokenBalance);
          }
        });
        await Promise.all(tokenBalancePromises);
      }
      
      return;
    }
    
    // Get new transactions since last signature
    const transactions = await getRecentTransactions(
      wallet.address,
      lastSignature || undefined,
      20
    );
    
    // Update last checked signature if we got new transactions
    if (transactions.length > 0) {
      const latestSigs = await getLatestSignatures(wallet.address, 1);
      if (latestSigs.length > 0) {
        lastCheckedSignature.set(addressKey, latestSigs[0].signature);
      }
      
      // Store transactions for later review
      const existing = pendingTransactions.get(addressKey) || [];
      pendingTransactions.set(addressKey, [...existing, ...transactions]);
      
      // Send summary notification
      await sendSummaryNotification(bot, telegramId, wallet, transactions, settings);
    }
    
    // Parallel token balance check and wallet data update
    const updatePromises: Promise<any>[] = [];
    
    if (wallet.trackedTokens && wallet.trackedTokens.length > 0) {
      updatePromises.push(checkTokenBalances(bot, telegramId, wallet, settings));
    }
    
    // Only fetch fresh balance if we had new transactions (optimization)
    if (transactions.length > 0) {
      updatePromises.push(
        (async () => {
          const [currentBalance, latestSigs] = await Promise.all([
            getBalance(wallet.address),
            getLatestSignatures(wallet.address, 1)
          ]);
          updateWalletData(telegramId, wallet.address, {
            lastBalance: currentBalance,
            lastSignature: latestSigs[0]?.signature || wallet.lastSignature
          });
        })()
      );
    }
    
    await Promise.all(updatePromises);
    
  } catch (error) {
    logger.error(`Error checking wallet ${wallet.address}:`, error);
  } finally {
    // Remove from in-progress set
    walletCheckInProgress.delete(addressKey);
  }
}

// Check token balances for changes
async function checkTokenBalances<C extends Context>(
  bot: Bot<C>,
  telegramId: number,
  wallet: WatchedWallet,
  settings: NotificationSettings
): Promise<void> {
  if (!wallet.trackedTokens) return;
  
  for (const token of wallet.trackedTokens) {
    try {
      const currentBalance = await getTokenBalance(token.contractAddress, wallet.address);
      if (!currentBalance) continue;
      
      if (token.lastBalance) {
        const oldBalance = parseFloat(token.lastBalance);
        const newBalance = parseFloat(currentBalance);
        const change = newBalance - oldBalance;
        
        // Use percentage-based threshold for significance (scales with token value)
        const changePercent = oldBalance > 0 ? Math.abs(change / oldBalance) * 100 : (newBalance > 0 ? 100 : 0);
        const minChangePercent = 0.01; // 0.01% minimum change
        
        // Also check absolute minimum for very small balances
        const significantAbsoluteChange = Math.abs(change) > 0.0001;
        
        if (changePercent > minChangePercent || (significantAbsoluteChange && oldBalance < 0.01)) {
          await sendTokenSummaryNotification(bot, telegramId, wallet, token, oldBalance, newBalance);
        }
      }
      
      // Update stored balance
      updateTokenBalance(telegramId, wallet.address, token.contractAddress, currentBalance);
    } catch (error) {
      logger.error(`Error checking token ${token.symbol}:`, error);
    }
  }
}

// Send summary notification (just count + button to view details)
async function sendSummaryNotification<C extends Context>(
  bot: Bot<C>,
  telegramId: number,
  wallet: WatchedWallet,
  transactions: TransactionInfo[],
  settings: NotificationSettings
): Promise<void> {
  // Check if notifications are enabled
  if (!settings.transactionsEnabled) {
    return;
  }
  const walletLabel = wallet.label ? `"${wallet.label}"` : shortenAddress(wallet.address);
  
  // Calculate summary
  const incoming = transactions.filter(tx => tx.to?.toLowerCase() === wallet.address.toLowerCase());
  const outgoing = transactions.filter(tx => tx.from.toLowerCase() === wallet.address.toLowerCase());
  
  // Safely sum values, handling NaN from invalid data
  const incomingValue = incoming.reduce((sum, tx) => {
    const value = parseFloat(tx.value);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
  const outgoingValue = outgoing.reduce((sum, tx) => {
    const value = parseFloat(tx.value);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
  
  let message = `📊 <b>Wallet Activity</b>\n\n`;
  message += `📍 <b>Wallet:</b> ${walletLabel}\n\n`;
  message += `📥 <b>Incoming:</b> ${incoming.length} tx`;
  if (incomingValue > 0) message += ` (+${incomingValue.toFixed(4)} XNT)`;
  message += `\n`;
  message += `📤 <b>Outgoing:</b> ${outgoing.length} tx`;
  if (outgoingValue > 0) message += ` (-${outgoingValue.toFixed(4)} XNT)`;
  message += `\n`;
  message += `📈 <b>Total:</b> ${transactions.length} transactions\n`;
  
  // Create keyboard with button to view details
  const keyboard = new InlineKeyboard()
    .text('📋 View Details', `view_tx_details_${wallet.address}`)
    .text('✅ Dismiss', `dismiss_tx_${wallet.address}`);
  
  try {
    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    incrementNotificationCount();
  } catch (error) {
    logger.error(`Error sending summary notification to ${telegramId}:`, error);
  }
}

// Send token balance change summary
async function sendTokenSummaryNotification<C extends Context>(
  bot: Bot<C>,
  telegramId: number,
  wallet: WatchedWallet,
  token: TrackedToken,
  oldBalance: number,
  newBalance: number
): Promise<void> {
  const change = newBalance - oldBalance;
  const isIncrease = change > 0;
  const emoji = isIncrease ? '🟢' : '🔴';
  const changeStr = isIncrease ? `+${change.toFixed(4)}` : change.toFixed(4);
  
  const walletLabel = wallet.label ? `"${wallet.label}"` : shortenAddress(wallet.address);
  
  let message = `${emoji} <b>Token Balance Changed</b>\n\n`;
  message += `🪙 <b>Token:</b> ${token.symbol}\n`;
  message += `📍 <b>Wallet:</b> ${walletLabel}\n`;
  message += `💰 <b>Change:</b> ${changeStr} ${token.symbol}\n`;
  message += `📊 <b>New Balance:</b> ${newBalance.toFixed(4)} ${token.symbol}\n`;
  
  try {
    await bot.api.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
    });
    incrementNotificationCount();
  } catch (error) {
    logger.error(`Error sending token notification to ${telegramId}:`, error);
  }
}

// Shorten address for display
function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Register a new wallet to watch (update signature tracking)
export async function registerWalletForWatching(address: string): Promise<{ success: boolean; error?: string }> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const signatures = await getLatestSignatures(address, 1);
      
      if (signatures.length > 0) {
        lastCheckedSignature.set(address.toLowerCase(), signatures[0].signature);
      } else {
        lastCheckedSignature.set(address.toLowerCase(), '');
      }
      pendingTransactions.set(address.toLowerCase(), []);
      
      logger.info(`✅ Wallet ${address.slice(0, 8)}... registered successfully`);
      return { success: true };
    } catch (error: any) {
      logger.error(`❌ Failed to register wallet ${address.slice(0, 8)}... (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      
      if (attempt === MAX_RETRIES) {
        return { 
          success: false, 
          error: `Failed to register wallet after ${MAX_RETRIES} attempts: ${error.message}` 
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
    }
  }
  
  return { success: false, error: 'Unknown error during registration' };
}

// Unregister a wallet from watching
export function unregisterWalletFromWatching(address: string): void {
  const addressKey = address.toLowerCase();
  lastCheckedSignature.delete(addressKey);
  pendingTransactions.delete(addressKey);
  // Also remove from in-progress set to prevent leaks
  walletCheckInProgress.delete(addressKey);
  
  // Clear security scan failures tracking
  try {
    const { clearSecurityScanFailures } = require('./security');
    clearSecurityScanFailures(address);
  } catch (e) {
    // Security module not available
  }
  
  logger.info(`✅ Wallet ${address.slice(0, 8)}... unregistered successfully`);
}

// Stop the watcher (cleanup on shutdown)
export function stopWatcher(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    logger.info('✅ Wallet watcher stopped');
  }
}

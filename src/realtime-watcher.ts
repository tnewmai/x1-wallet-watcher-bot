/**
 * Real-time Wallet Watcher
 * Uses WebSocket subscriptions for instant wallet updates
 * Falls back to polling if WebSocket fails
 */

import { AccountInfo, Context, PublicKey } from '@solana/web3.js';
import { getWebSocketManager } from './websocket-manager';
import { getBalance } from './blockchain';
import logger from './logger';
import { config } from './config';

export interface WalletSubscription {
  address: string;
  userId: number;
  lastBalance: string;
  lastChecked: number;
  useWebSocket: boolean;
  pollingFallback: boolean;
  onChange?: (address: string, newBalance: string, oldBalance: string) => void;
}

export class RealtimeWatcher {
  private subscriptions: Map<string, WalletSubscription>;
  private wsManager = getWebSocketManager();
  private pollingTimer: NodeJS.Timeout | null = null;
  private pollingInterval = 30000; // 30 seconds fallback polling
  private enableWebSocket = true;
  private enablePollingFallback = true;

  constructor() {
    this.subscriptions = new Map();
    logger.info('Real-time Wallet Watcher initialized');
  }

  /**
   * Subscribe to wallet updates
   */
  async subscribeToWallet(
    address: string,
    userId: number,
    onChange?: (address: string, newBalance: string, oldBalance: string) => void
  ): Promise<boolean> {
    try {
      // Check if already subscribed
      if (this.subscriptions.has(address)) {
        logger.warn(`Wallet ${address.slice(0, 8)}... already subscribed`);
        return true;
      }

      // Get initial balance
      const initialBalance = await getBalance(address);
      
      const subscription: WalletSubscription = {
        address,
        userId,
        lastBalance: initialBalance,
        lastChecked: Date.now(),
        useWebSocket: this.enableWebSocket,
        pollingFallback: false,
        onChange,
      };

      // Try WebSocket subscription first
      if (this.enableWebSocket) {
        const wsSuccess = await this.wsManager.subscribe(
          address,
          (accountInfo, context) => {
            this.handleAccountChange(address, accountInfo, context);
          }
        );

        if (wsSuccess) {
          subscription.useWebSocket = true;
          subscription.pollingFallback = false;
          logger.info(`✅ WebSocket subscription active for ${address.slice(0, 8)}...`);
        } else {
          // WebSocket failed, use polling
          subscription.useWebSocket = false;
          subscription.pollingFallback = true;
          logger.warn(`⚠️ WebSocket failed for ${address.slice(0, 8)}..., using polling fallback`);
        }
      } else {
        // WebSocket disabled, use polling
        subscription.useWebSocket = false;
        subscription.pollingFallback = true;
      }

      this.subscriptions.set(address, subscription);
      
      // Start polling if needed
      if (subscription.pollingFallback && this.enablePollingFallback) {
        this.startPolling();
      }

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to wallet ${address}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from wallet updates
   */
  async unsubscribeFromWallet(address: string): Promise<boolean> {
    try {
      const subscription = this.subscriptions.get(address);
      if (!subscription) {
        logger.warn(`Wallet ${address} not subscribed`);
        return false;
      }

      // Remove WebSocket subscription if active
      if (subscription.useWebSocket) {
        await this.wsManager.unsubscribe(address);
      }

      this.subscriptions.delete(address);
      
      // Stop polling if no more polling subscriptions
      const hasPollingSubscriptions = Array.from(this.subscriptions.values())
        .some(sub => sub.pollingFallback);
      
      if (!hasPollingSubscriptions) {
        this.stopPolling();
      }

      logger.info(`✅ Unsubscribed from ${address.slice(0, 8)}...`);
      return true;
    } catch (error) {
      logger.error(`Failed to unsubscribe from ${address}:`, error);
      return false;
    }
  }

  /**
   * Handle account change from WebSocket
   */
  private async handleAccountChange(
    address: string,
    accountInfo: AccountInfo<Buffer>,
    context: Context
  ): Promise<void> {
    const subscription = this.subscriptions.get(address);
    if (!subscription) return;

    try {
      // Calculate new balance from lamports
      const lamports = accountInfo.lamports;
      const newBalance = (lamports / 1e9).toFixed(4); // Convert to XNT
      const oldBalance = subscription.lastBalance;

      // Update subscription
      subscription.lastBalance = newBalance;
      subscription.lastChecked = Date.now();

      // Check if balance changed
      if (newBalance !== oldBalance) {
        logger.info(
          `💰 Balance change detected for ${address.slice(0, 8)}...: ` +
          `${oldBalance} → ${newBalance} XNT (slot: ${context.slot})`
        );

        // Call onChange callback if provided
        if (subscription.onChange) {
          subscription.onChange(address, newBalance, oldBalance);
        }
      }
    } catch (error) {
      logger.error(`Error handling account change for ${address}:`, error);
    }
  }

  /**
   * Start polling for wallets that need fallback
   */
  private startPolling(): void {
    if (this.pollingTimer || this.pollingActive) {
      return; // Already polling
    }

    logger.info('🔄 Starting polling fallback...');
    this.pollingActive = true;
    
    this.pollingTimer = setInterval(() => {
      this.pollWallets();
    }, this.pollingInterval);
  }

  /**
   * Stop polling (with flag to prevent race conditions)
   */
  private pollingActive = false;
  
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.pollingActive = false;
      logger.info('⏸️ Polling fallback stopped');
    }
  }

  /**
   * Poll wallets that are using fallback
   */
  private pollingInProgress = false;
  
  private async pollWallets(): Promise<void> {
    // Prevent overlapping polls
    if (this.pollingInProgress) {
      logger.debug('⏳ Poll already in progress, skipping');
      return;
    }
    
    this.pollingInProgress = true;
    
    try {
      const walletsToCheck = Array.from(this.subscriptions.values())
        .filter(sub => sub.pollingFallback);

      if (walletsToCheck.length === 0) {
        this.stopPolling();
        return;
      }

      logger.debug(`Polling ${walletsToCheck.length} wallets...`);

      // Check wallets in batches to avoid overwhelming RPC
      const batchSize = config.watcherConcurrency || 3;
      for (let i = 0; i < walletsToCheck.length; i += batchSize) {
        const batch = walletsToCheck.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(sub => this.checkWalletBalance(sub.address))
        );
      }
    } finally {
      this.pollingInProgress = false;
    }
  }

  /**
   * Check single wallet balance (for polling fallback)
   */
  private async checkWalletBalance(address: string): Promise<void> {
    const subscription = this.subscriptions.get(address);
    if (!subscription) return;

    try {
      const newBalance = await getBalance(address);
      const oldBalance = subscription.lastBalance;

      subscription.lastBalance = newBalance;
      subscription.lastChecked = Date.now();

      // Check if balance changed
      if (newBalance !== oldBalance) {
        logger.info(
          `💰 Balance change detected (polling) for ${address.slice(0, 8)}...: ` +
          `${oldBalance} → ${newBalance} XNT`
        );

        // Call onChange callback if provided
        if (subscription.onChange) {
          subscription.onChange(address, newBalance, oldBalance);
        }
      }
    } catch (error) {
      logger.error(`Error checking balance for ${address}:`, error);
    }
  }

  /**
   * Manually refresh a wallet's balance
   */
  async refreshWallet(address: string): Promise<string | null> {
    const subscription = this.subscriptions.get(address);
    if (!subscription) {
      logger.warn(`Wallet ${address} not subscribed`);
      return null;
    }

    try {
      const newBalance = await getBalance(address);
      subscription.lastBalance = newBalance;
      subscription.lastChecked = Date.now();
      return newBalance;
    } catch (error) {
      logger.error(`Error refreshing wallet ${address}:`, error);
      return null;
    }
  }

  /**
   * Get subscription info for a wallet
   */
  getSubscription(address: string): WalletSubscription | null {
    return this.subscriptions.get(address) || null;
  }

  /**
   * Get all subscribed addresses
   */
  getSubscribedAddresses(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    websocket: number;
    polling: number;
    wsManagerStats: any;
  } {
    let websocket = 0;
    let polling = 0;

    for (const sub of this.subscriptions.values()) {
      if (sub.useWebSocket) {
        websocket++;
      }
      if (sub.pollingFallback) {
        polling++;
      }
    }

    return {
      total: this.subscriptions.size,
      websocket,
      polling,
      wsManagerStats: this.wsManager.getStats(),
    };
  }

  /**
   * Enable/disable WebSocket subscriptions
   */
  setWebSocketEnabled(enabled: boolean): void {
    this.enableWebSocket = enabled;
    logger.info(`WebSocket subscriptions ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable polling fallback
   */
  setPollingFallbackEnabled(enabled: boolean): void {
    this.enablePollingFallback = enabled;
    logger.info(`Polling fallback ${enabled ? 'enabled' : 'disabled'}`);
    
    if (!enabled && this.pollingTimer) {
      this.stopPolling();
    }
  }

  /**
   * Reconnect all WebSocket subscriptions
   */
  async reconnectAllWebSockets(): Promise<void> {
    logger.info('🔄 Reconnecting all WebSocket subscriptions...');
    await this.wsManager.reconnectAll();
  }

  /**
   * Switch a wallet from polling to WebSocket
   */
  async upgradeToWebSocket(address: string): Promise<boolean> {
    const subscription = this.subscriptions.get(address);
    if (!subscription) return false;

    if (subscription.useWebSocket) {
      logger.info(`Wallet ${address.slice(0, 8)}... already using WebSocket`);
      return true;
    }

    try {
      const wsSuccess = await this.wsManager.subscribe(
        address,
        (accountInfo, context) => {
          this.handleAccountChange(address, accountInfo, context);
        }
      );

      if (wsSuccess) {
        subscription.useWebSocket = true;
        subscription.pollingFallback = false;
        logger.info(`✅ Upgraded ${address.slice(0, 8)}... to WebSocket`);
        return true;
      } else {
        logger.warn(`⚠️ Failed to upgrade ${address.slice(0, 8)}... to WebSocket`);
        return false;
      }
    } catch (error) {
      logger.error(`Error upgrading ${address} to WebSocket:`, error);
      return false;
    }
  }

  /**
   * Switch a wallet from WebSocket to polling
   */
  async downgradeToPolling(address: string): Promise<boolean> {
    const subscription = this.subscriptions.get(address);
    if (!subscription) return false;

    if (subscription.pollingFallback && !subscription.useWebSocket) {
      logger.info(`Wallet ${address.slice(0, 8)}... already using polling`);
      return true;
    }

    try {
      if (subscription.useWebSocket) {
        await this.wsManager.unsubscribe(address);
      }

      subscription.useWebSocket = false;
      subscription.pollingFallback = true;
      
      this.startPolling();
      
      logger.info(`✅ Downgraded ${address.slice(0, 8)}... to polling`);
      return true;
    } catch (error) {
      logger.error(`Error downgrading ${address} to polling:`, error);
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Real-time Watcher shutting down...');
    
    this.stopPolling();
    
    // Unsubscribe from all wallets
    const addresses = Array.from(this.subscriptions.keys());
    for (const address of addresses) {
      await this.unsubscribeFromWallet(address);
    }
    
    await this.wsManager.shutdown();
    
    logger.info('✅ Real-time Watcher shutdown complete');
  }
}

// Singleton instance
let realtimeWatcherInstance: RealtimeWatcher | null = null;

/**
 * Get real-time watcher instance
 */
export function getRealtimeWatcher(): RealtimeWatcher {
  if (!realtimeWatcherInstance) {
    realtimeWatcherInstance = new RealtimeWatcher();
  }
  return realtimeWatcherInstance;
}

/**
 * Initialize real-time watcher
 */
export function initRealtimeWatcher(): RealtimeWatcher {
  const watcher = getRealtimeWatcher();
  logger.info('✅ Real-time Watcher initialized');
  return watcher;
}

export default getRealtimeWatcher;

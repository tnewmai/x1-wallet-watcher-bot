/**
 * WebSocket Subscription Manager
 * Manages real-time wallet subscriptions using Solana WebSocket API
 */

import { Connection, PublicKey, AccountChangeCallback } from '@solana/web3.js';
import logger from './logger';
import { config } from './config';

export interface SubscriptionInfo {
  address: string;
  subscriptionId: number | null;
  callback: AccountChangeCallback;
  lastUpdate: number;
  reconnectAttempts: number;
  isActive: boolean;
}

export class WebSocketManager {
  private connection: Connection;
  private subscriptions: Map<string, SubscriptionInfo>;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private healthCheckInterval = 30000; // 30 seconds

  constructor(rpcUrl: string, wsUrl?: string) {
    // If no WebSocket URL provided, derive from RPC URL
    const wsEndpoint = wsUrl || rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    
    this.connection = new Connection(wsEndpoint, {
      commitment: 'confirmed',
      wsEndpoint: wsEndpoint,
    });
    
    this.subscriptions = new Map();
    
    logger.info(`WebSocket Manager initialized with endpoint: ${wsEndpoint}`);
  }

  /**
   * Subscribe to account changes for a wallet address
   */
  async subscribe(
    address: string,
    callback: AccountChangeCallback
  ): Promise<boolean> {
    try {
      // Check if already subscribed
      if (this.subscriptions.has(address)) {
        logger.warn(`Already subscribed to ${address}`);
        return true;
      }

      const publicKey = new PublicKey(address);
      
      // Create subscription
      const subscriptionId = this.connection.onAccountChange(
        publicKey,
        (accountInfo, context) => {
          // Update last activity
          const sub = this.subscriptions.get(address);
          if (sub) {
            sub.lastUpdate = Date.now();
          }
          
          // Call the user's callback
          callback(accountInfo, context);
          
          logger.debug(`Account change detected for ${address.slice(0, 8)}... at slot ${context.slot}`);
        },
        'confirmed'
      );

      // Store subscription info
      this.subscriptions.set(address, {
        address,
        subscriptionId,
        callback,
        lastUpdate: Date.now(),
        reconnectAttempts: 0,
        isActive: true,
      });

      logger.info(`✅ WebSocket subscription created for ${address.slice(0, 8)}... (ID: ${subscriptionId})`);
      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to ${address}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from a wallet address
   */
  async unsubscribe(address: string): Promise<boolean> {
    try {
      const sub = this.subscriptions.get(address);
      if (!sub) {
        logger.warn(`Not subscribed to ${address}`);
        return false;
      }

      if (sub.subscriptionId !== null) {
        await this.connection.removeAccountChangeListener(sub.subscriptionId);
        logger.info(`✅ Unsubscribed from ${address.slice(0, 8)}... (ID: ${sub.subscriptionId})`);
      }

      this.subscriptions.delete(address);
      return true;
    } catch (error) {
      logger.error(`Failed to unsubscribe from ${address}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from all addresses
   */
  async unsubscribeAll(): Promise<void> {
    logger.info(`Unsubscribing from ${this.subscriptions.size} addresses...`);
    
    const addresses = Array.from(this.subscriptions.keys());
    for (const address of addresses) {
      await this.unsubscribe(address);
    }
    
    logger.info('All WebSocket subscriptions removed');
  }

  /**
   * Resubscribe to a specific address (for reconnection)
   */
  private async resubscribe(address: string): Promise<boolean> {
    const sub = this.subscriptions.get(address);
    if (!sub) return false;

    // Increment reconnect attempts
    sub.reconnectAttempts++;

    if (sub.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error(`Max reconnect attempts reached for ${address.slice(0, 8)}...`);
      sub.isActive = false;
      return false;
    }

    logger.info(`Attempting to reconnect ${address.slice(0, 8)}... (attempt ${sub.reconnectAttempts}/${this.maxReconnectAttempts})`);

    // Remove old subscription
    if (sub.subscriptionId !== null) {
      try {
        await this.connection.removeAccountChangeListener(sub.subscriptionId);
      } catch (error) {
        // Ignore errors when removing dead subscriptions
      }
    }

    // Create new subscription
    try {
      const publicKey = new PublicKey(address);
      const subscriptionId = this.connection.onAccountChange(
        publicKey,
        sub.callback,
        'confirmed'
      );

      sub.subscriptionId = subscriptionId;
      sub.lastUpdate = Date.now();
      sub.isActive = true;

      logger.info(`✅ Reconnected to ${address.slice(0, 8)}... (ID: ${subscriptionId})`);
      return true;
    } catch (error) {
      logger.error(`Failed to reconnect ${address.slice(0, 8)}...:`, error);
      return false;
    }
  }

  /**
   * Reconnect all subscriptions
   */
  async reconnectAll(): Promise<void> {
    logger.warn('🔄 Reconnecting all WebSocket subscriptions...');
    
    const addresses = Array.from(this.subscriptions.keys());
    let successCount = 0;
    
    for (const address of addresses) {
      const success = await this.resubscribe(address);
      if (success) successCount++;
      
      // Add small delay between reconnections to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info(`Reconnection complete: ${successCount}/${addresses.length} successful`);
  }

  /**
   * Health check - verify subscriptions are still active
   */
  private async healthCheck(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    let staleCount = 0;
    
    for (const [address, sub] of this.subscriptions) {
      if (!sub.isActive) continue;
      
      const timeSinceUpdate = now - sub.lastUpdate;
      
      // If no updates for 5 minutes, subscription might be dead
      if (timeSinceUpdate > staleThreshold) {
        logger.warn(`Subscription for ${address.slice(0, 8)}... appears stale (${Math.floor(timeSinceUpdate / 1000)}s since last update)`);
        staleCount++;
        
        // Attempt to reconnect stale subscriptions
        await this.resubscribe(address);
      }
    }
    
    if (staleCount > 0) {
      logger.info(`Health check: ${staleCount} stale subscriptions detected and reconnected`);
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.healthCheck();
    }, this.healthCheckInterval);
    
    logger.info(`Health check started (interval: ${this.healthCheckInterval / 1000}s)`);
  }

  /**
   * Stop health checks
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.info('Health check stopped');
    }
  }

  /**
   * Get subscription statistics
   */
  getStats(): {
    total: number;
    active: number;
    inactive: number;
    averageReconnectAttempts: number;
  } {
    let active = 0;
    let inactive = 0;
    let totalReconnects = 0;
    
    for (const sub of this.subscriptions.values()) {
      if (sub.isActive) {
        active++;
      } else {
        inactive++;
      }
      totalReconnects += sub.reconnectAttempts;
    }
    
    return {
      total: this.subscriptions.size,
      active,
      inactive,
      averageReconnectAttempts: this.subscriptions.size > 0 
        ? totalReconnects / this.subscriptions.size 
        : 0,
    };
  }

  /**
   * Get list of subscribed addresses
   */
  getSubscribedAddresses(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Check if address is subscribed
   */
  isSubscribed(address: string): boolean {
    return this.subscriptions.has(address);
  }

  /**
   * Get subscription info for an address
   */
  getSubscriptionInfo(address: string): SubscriptionInfo | null {
    return this.subscriptions.get(address) || null;
  }

  /**
   * Clear all timers safely
   */
  private clearAllTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      logger.debug('Cleared reconnect timer');
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.debug('Cleared health check timer');
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('WebSocket Manager shutting down...');
    
    // Clear all timers first to prevent any new operations
    this.clearAllTimers();
    
    // Unsubscribe from all wallets
    await this.unsubscribeAll();
    
    logger.info('✅ WebSocket Manager shutdown complete');
  }
}

// Singleton instance
let wsManagerInstance: WebSocketManager | null = null;

/**
 * Get WebSocket manager instance
 */
export function getWebSocketManager(): WebSocketManager {
  if (!wsManagerInstance) {
    const rpcUrl = config.x1RpcUrl;
    // Try to derive WebSocket URL from RPC URL
    const wsUrl = rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    wsManagerInstance = new WebSocketManager(rpcUrl, wsUrl);
  }
  return wsManagerInstance;
}

/**
 * Initialize WebSocket manager with health checks
 */
export function initWebSocketManager(): WebSocketManager {
  const manager = getWebSocketManager();
  manager.startHealthCheck();
  return manager;
}

export default getWebSocketManager;

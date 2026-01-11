/**
 * Storage v2 - New storage interface using adapter pattern
 * Replaces the old file-based storage.ts
 */

import { StorageAdapter, AddWalletResult, RemoveWalletResult } from './storage/adapter';
import { PrismaStorageAdapter } from './storage/prisma-adapter';
import { WatchedWallet, UserData } from './types';
import logger from './logger';

// Singleton storage instance
let storageInstance: Storage | null = null;
let initializationPromise: Promise<Storage> | null = null;

export class Storage {
  private adapter: StorageAdapter;
  private initialized: boolean = false;

  constructor(adapter: StorageAdapter) {
    this.adapter = adapter;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.adapter.initialize();
      this.initialized = true;
      logger.info('✅ Storage initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize storage:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) return;
    
    await this.adapter.close();
    this.initialized = false;
  }

  // User operations
  async getUser(telegramId: number): Promise<UserData | null> {
    return await this.adapter.getUser(telegramId);
  }

  async ensureUser(telegramId: number, username?: string): Promise<void> {
    let user = await this.adapter.getUser(telegramId);
    if (!user) {
      await this.adapter.saveUser(telegramId, {
        visibleTelegramId: telegramId,
        username,
        wallets: [],
        settings: {
          transactionsEnabled: false,
          incoming: true,
          outgoing: true,
          minValue: 0.01,
          contractInteractions: false,
          balanceAlerts: false,
          minBalanceChange: 0.01,
        },
        createdAt: Date.now(),
        isActive: true,
      });
    }
  }

  async getAllUsers(): Promise<Map<number, UserData>> {
    return await this.adapter.getAllUsers();
  }

  // Wallet operations
  async addWallet(
    telegramId: number,
    address: string,
    label?: string
  ): Promise<AddWalletResult> {
    try {
      // Ensure user exists
      await this.ensureUser(telegramId);

      // Check if wallet already exists
      const existingWallet = await this.adapter.getWallet(telegramId, address);
      if (existingWallet) {
        return {
          success: false,
          message: '⚠️ This wallet is already being watched!',
        };
      }

      // Get current wallets to check limit
      const wallets = await this.adapter.getWallets(telegramId);
      const MAX_WALLETS = 10;
      
      if (wallets.length >= MAX_WALLETS) {
        return {
          success: false,
          message: `⚠️ Maximum ${MAX_WALLETS} wallets allowed. Remove one first.`,
        };
      }

      // Add the wallet
      const wallet: WatchedWallet = {
        address,
        label,
        addedAt: Date.now(),
        alertsEnabled: true,
      };

      const success = await this.adapter.addWallet(telegramId, wallet);
      
      if (success) {
        logger.info(`✅ Added wallet ${address} for user ${telegramId}`);
        return {
          success: true,
          message: '✅ Wallet added successfully!',
          wallet,
        };
      } else {
        return {
          success: false,
          message: '❌ Failed to add wallet. Please try again.',
        };
      }
    } catch (error) {
      logger.error('Error in addWallet:', error);
      return {
        success: false,
        message: '❌ An error occurred while adding the wallet.',
      };
    }
  }

  async removeWallet(
    telegramId: number,
    address: string
  ): Promise<RemoveWalletResult> {
    try {
      const success = await this.adapter.removeWallet(telegramId, address);
      
      if (success) {
        logger.info(`✅ Removed wallet ${address} for user ${telegramId}`);
        return {
          success: true,
          message: '✅ Wallet removed successfully!',
        };
      } else {
        return {
          success: false,
          message: '❌ Wallet not found.',
        };
      }
    } catch (error) {
      logger.error('Error in removeWallet:', error);
      return {
        success: false,
        message: '❌ An error occurred while removing the wallet.',
      };
    }
  }

  async getWallets(telegramId: number): Promise<WatchedWallet[]> {
    return await this.adapter.getWallets(telegramId);
  }

  async getWallet(telegramId: number, address: string): Promise<WatchedWallet | null> {
    return await this.adapter.getWallet(telegramId, address);
  }

  async updateWalletLabel(
    telegramId: number,
    address: string,
    label: string
  ): Promise<boolean> {
    return await this.adapter.updateWallet(telegramId, address, { label });
  }

  async toggleWalletAlerts(
    telegramId: number,
    address: string
  ): Promise<boolean> {
    const wallet = await this.adapter.getWallet(telegramId, address);
    if (!wallet) return false;

    return await this.adapter.updateWallet(telegramId, address, {
      alertsEnabled: !wallet.alertsEnabled,
    });
  }

  async updateWalletBalance(
    telegramId: number,
    address: string,
    balance: string
  ): Promise<void> {
    await this.adapter.updateWallet(telegramId, address, { lastBalance: balance });
  }

  // Get all users with wallets (for watcher)
  async getAllUsersWithWallets(): Promise<Map<number, UserData>> {
    return await this.adapter.getAllUsers();
  }

  // Update wallet data
  async updateWalletData(
    userId: number,
    address: string,
    data: Partial<WatchedWallet>
  ): Promise<boolean> {
    return await this.adapter.updateWallet(userId, address, data);
  }

  // Increment notification count (delegate to analytics)
  incrementNotificationCount(): void {
    // Use dynamic import to avoid circular dependency
    try {
      import('./analytics').then(analytics => {
        analytics.getAnalytics().incrementNotification();
      }).catch(error => {
        logger.debug('Analytics not available for notification count');
      });
    } catch (error) {
      // Fail silently - analytics is optional
    }
  }

  // Update token balance
  async updateTokenBalance(
    userId: number,
    address: string,
    tokenAddress: string,
    balance: string
  ): Promise<void> {
    // Store token balance as metadata
    logger.info(`Token balance update for ${address}: ${tokenAddress} = ${balance}`);
    // Could be extended to store in a separate tokens table
  }

  // Settings operations
  async getUserSettings(telegramId: number): Promise<any> {
    return await this.adapter.getUserSettings(telegramId);
  }

  async updateUserSettings(telegramId: number, settings: any): Promise<void> {
    await this.adapter.updateUserSettings(telegramId, settings);
  }

  // Security scan cache
  async cacheSecurityScan(address: string, data: any): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await this.adapter.cacheSecurityScan(address, data, expiresAt);
  }

  async getSecurityScanCache(address: string): Promise<any | null> {
    return await this.adapter.getSecurityScanCache(address);
  }

  // Alert operations
  async createAlert(
    telegramId: number,
    address: string,
    type: string,
    severity: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    const wallet = await this.adapter.getWallet(telegramId, address);
    if (!wallet) return;

    // We need the wallet DB ID - this is a limitation of the current design
    // For now, we'll skip this feature until we refactor alerts
    logger.warn('Alert creation not yet implemented in v2 storage');
  }

  async getUnreadAlerts(telegramId: number): Promise<any[]> {
    return await this.adapter.getUnreadAlerts(telegramId);
  }
}

// Factory function to create storage instance
export function createStorage(adapter?: StorageAdapter): Storage {
  if (!adapter) {
    adapter = new PrismaStorageAdapter();
  }
  return new Storage(adapter);
}

// Get singleton instance (synchronous, for backward compatibility)
export function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

// Get storage instance safely (async, prevents race conditions)
export async function getStorageSafe(): Promise<Storage> {
  if (storageInstance && storageInstance['initialized']) {
    return storageInstance;
  }
  
  if (!initializationPromise) {
    initializationPromise = initializeStorage();
  }
  
  return await initializationPromise;
}

// Initialize storage (call this at app startup)
export async function initializeStorage(): Promise<Storage> {
  if (storageInstance && storageInstance['initialized']) {
    return storageInstance;
  }
  
  const storage = getStorage();
  await storage.initialize();
  return storage;
}

// Export for use in other modules
export default getStorage;

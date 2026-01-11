/**
 * Prisma Storage Adapter
 * PostgreSQL implementation using Prisma ORM
 */

import { PrismaClient } from '@prisma/client';
import { StorageAdapter } from './adapter';
import { WatchedWallet, UserData } from '../types';
import logger from '../logger';

export class PrismaStorageAdapter implements StorageAdapter {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('✅ Connected to PostgreSQL database');
    } catch (error) {
      logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
    logger.info('Database connection closed');
  }

  // User operations
  async getUser(telegramId: number): Promise<UserData | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        include: {
          wallets: true,
          settings: true,
        },
      });

      if (!user) return null;

      // Convert Prisma model to UserData format
      const wallets: WatchedWallet[] = user.wallets.map((w: any) => ({
        address: w.address,
        label: w.label || undefined,
        addedAt: w.addedAt.getTime(),
        alertsEnabled: w.alertsEnabled,
        lastBalance: w.lastBalance || undefined,
      }));

      return {
        visibleTelegramId: Number(user.telegramId),
        username: user.username || undefined,
        wallets,
        settings: {
          transactionsEnabled: user.settings?.notifyOnNewToken || false,
          incoming: true,
          outgoing: true,
          minValue: 0.01,
          contractInteractions: user.settings?.notifyOnLargeTransfer || false,
          balanceAlerts: false,
          minBalanceChange: user.settings?.largeTransferThreshold || 0.01,
        },
        createdAt: user.createdAt?.getTime() || Date.now(),
        isActive: true,
      };
    } catch (error) {
      logger.error(`Error getting user ${telegramId}:`, error);
      return null;
    }
  }

  async saveUser(telegramId: number, data: UserData): Promise<void> {
    try {
      await this.prisma.user.upsert({
        where: { telegramId: BigInt(telegramId) },
        create: {
          telegramId: BigInt(telegramId),
          username: data.username,
        },
        update: {
          username: data.username,
        },
      });

      // Update settings if provided
      if (data.settings) {
        const uid = (await this.getUserId(telegramId))!;
        await this.prisma.userSettings.upsert({
          where: { userId: uid },
          create: {
            userId: uid,
            notifyOnNewToken: data.settings.transactionsEnabled,
            notifyOnRugger: false,
            notifyOnLargeTransfer: data.settings.contractInteractions,
            largeTransferThreshold: data.settings.minBalanceChange,
          },
          update: {
            notifyOnNewToken: data.settings.transactionsEnabled,
            notifyOnLargeTransfer: data.settings.contractInteractions,
            largeTransferThreshold: data.settings.minBalanceChange,
          },
        });
      }
    } catch (error) {
      logger.error(`Error saving user ${telegramId}:`, error);
      throw error;
    }
  }

  async deleteUser(telegramId: number): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { telegramId: BigInt(telegramId) },
      });
    } catch (error) {
      logger.error(`Error deleting user ${telegramId}:`, error);
      throw error;
    }
  }

  async getAllUsers(): Promise<Map<number, UserData>> {
    try {
      const users = await this.prisma.user.findMany({
        include: {
          wallets: true,
          settings: true,
        },
      });

      const userMap = new Map<number, UserData>();
      for (const user of users) {
        const wallets = user.wallets.map(w => ({
          address: w.address,
          label: w.label || undefined,
          addedAt: w.addedAt.getTime(),
          alertsEnabled: w.alertsEnabled,
          lastBalance: w.lastBalance || undefined,
        }));

        userMap.set(Number(user.telegramId), {
          visibleTelegramId: Number(user.telegramId),
          username: user.username || undefined,
          wallets,
          settings: {
            transactionsEnabled: user.settings?.notifyOnNewToken || false,
            incoming: true,
            outgoing: true,
            minValue: 0.01,
            contractInteractions: user.settings?.notifyOnLargeTransfer || false,
            balanceAlerts: false,
            minBalanceChange: user.settings?.largeTransferThreshold || 0.01,
          },
          createdAt: user.createdAt?.getTime() || Date.now(),
          isActive: true,
        });
      }

      return userMap;
    } catch (error) {
      logger.error('Error getting all users:', error);
      return new Map();
    }
  }

  // Wallet operations
  async addWallet(telegramId: number, wallet: WatchedWallet): Promise<boolean> {
    try {
      const userId = await this.getUserId(telegramId);
      if (!userId) {
        // Create user first
        await this.saveUser(telegramId, { 
          visibleTelegramId: telegramId, 
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

      const finalUserId = await this.getUserId(telegramId);
      if (!finalUserId) return false;

      await this.prisma.wallet.create({
        data: {
          userId: finalUserId,
          address: wallet.address,
          label: wallet.label,
          addedAt: new Date(wallet.addedAt),
          alertsEnabled: wallet.alertsEnabled ?? true,
        },
      });

      return true;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - wallet already exists
        logger.warn(`Wallet ${wallet.address} already exists for user ${telegramId}`);
        return false;
      }
      logger.error(`Error adding wallet:`, error);
      return false;
    }
  }

  async removeWallet(telegramId: number, address: string): Promise<boolean> {
    try {
      const userId = await this.getUserId(telegramId);
      if (!userId) return false;

      await this.prisma.wallet.delete({
        where: {
          userId_address: {
            userId,
            address,
          },
        },
      });

      return true;
    } catch (error) {
      logger.error(`Error removing wallet:`, error);
      return false;
    }
  }

  async getWallets(telegramId: number): Promise<WatchedWallet[]> {
    try {
      const userId = await this.getUserId(telegramId);
      if (!userId) return [];

      const wallets = await this.prisma.wallet.findMany({
        where: { userId },
        orderBy: { addedAt: 'desc' },
      });

      return wallets.map(w => ({
        address: w.address,
        label: w.label || undefined,
        addedAt: w.addedAt.getTime(),
        alertsEnabled: w.alertsEnabled,
        lastBalance: w.lastBalance || undefined,
      }));
    } catch (error) {
      logger.error(`Error getting wallets:`, error);
      return [];
    }
  }

  async getWallet(telegramId: number, address: string): Promise<WatchedWallet | null> {
    try {
      const userId = await this.getUserId(telegramId);
      if (!userId) return null;

      const wallet = await this.prisma.wallet.findUnique({
        where: {
          userId_address: {
            userId,
            address,
          },
        },
      });

      if (!wallet) return null;

      return {
        address: wallet.address,
        label: wallet.label || undefined,
        addedAt: wallet.addedAt.getTime(),
        alertsEnabled: wallet.alertsEnabled,
        lastBalance: wallet.lastBalance || undefined,
      };
    } catch (error) {
      logger.error(`Error getting wallet:`, error);
      return null;
    }
  }

  async updateWallet(telegramId: number, address: string, updates: Partial<WatchedWallet>): Promise<boolean> {
    try {
      const userId = await this.getUserId(telegramId);
      if (!userId) return false;

      await this.prisma.wallet.update({
        where: {
          userId_address: {
            userId,
            address,
          },
        },
        data: {
          label: updates.label,
          alertsEnabled: updates.alertsEnabled,
          lastBalance: updates.lastBalance,
        },
      });

      return true;
    } catch (error) {
      logger.error(`Error updating wallet:`, error);
      return false;
    }
  }

  // Settings operations
  async getUserSettings(telegramId: number): Promise<any> {
    try {
      const userId = await this.getUserId(telegramId);
      if (!userId) return null;

      const settings = await this.prisma.userSettings.findUnique({
        where: { userId },
      });

      return settings;
    } catch (error) {
      logger.error(`Error getting user settings:`, error);
      return null;
    }
  }

  async updateUserSettings(telegramId: number, settings: any): Promise<void> {
    try {
      const userId = await this.getUserId(telegramId);
      if (!userId) throw new Error('User not found');

      await this.prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...settings,
        },
        update: settings,
      });
    } catch (error) {
      logger.error(`Error updating user settings:`, error);
      throw error;
    }
  }

  // Cache operations
  async cacheSecurityScan(address: string, data: any, expiresAt: Date): Promise<void> {
    try {
      await this.prisma.securityScan.upsert({
        where: { walletAddress: address },
        create: {
          walletAddress: address,
          isRugger: data.isRugger || false,
          riskScore: data.riskScore || 0,
          findings: data.findings || [],
          expiresAt,
        },
        update: {
          isRugger: data.isRugger || false,
          riskScore: data.riskScore || 0,
          findings: data.findings || [],
          scannedAt: new Date(),
          expiresAt,
        },
      });
    } catch (error) {
      logger.error(`Error caching security scan:`, error);
    }
  }

  async getSecurityScanCache(address: string): Promise<any | null> {
    try {
      const scan = await this.prisma.securityScan.findUnique({
        where: { walletAddress: address },
      });

      if (!scan) return null;
      if (scan.expiresAt < new Date()) {
        // Expired - delete it
        await this.prisma.securityScan.delete({
          where: { walletAddress: address },
        });
        return null;
      }

      return {
        isRugger: scan.isRugger,
        riskScore: scan.riskScore,
        findings: scan.findings,
        scannedAt: scan.scannedAt,
      };
    } catch (error) {
      logger.error(`Error getting security scan cache:`, error);
      return null;
    }
  }

  // Alert operations
  async createAlert(walletId: number, type: string, severity: string, message: string, metadata?: any): Promise<void> {
    try {
      await this.prisma.alert.create({
        data: {
          walletId,
          type,
          severity,
          message,
          metadata: metadata || {},
        },
      });
    } catch (error) {
      logger.error(`Error creating alert:`, error);
    }
  }

  async getUnreadAlerts(telegramId: number): Promise<any[]> {
    try {
      const userId = await this.getUserId(telegramId);
      if (!userId) return [];

      const alerts = await this.prisma.alert.findMany({
        where: {
          wallet: { userId },
          read: false,
        },
        include: {
          wallet: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return alerts;
    } catch (error) {
      logger.error(`Error getting unread alerts:`, error);
      return [];
    }
  }

  async markAlertAsRead(alertId: number): Promise<void> {
    try {
      await this.prisma.alert.update({
        where: { id: alertId },
        data: { read: true },
      });
    } catch (error) {
      logger.error(`Error marking alert as read:`, error);
    }
  }

  // Helper methods
  private async getUserId(telegramId: number): Promise<number | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        select: { id: true },
      });
      return user?.id || null;
    } catch (error) {
      return null;
    }
  }
}

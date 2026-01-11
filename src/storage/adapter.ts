/**
 * Storage Adapter Interface
 * Abstraction layer for data persistence
 */

import { WatchedWallet, UserData } from '../types';

export interface StorageAdapter {
  // User operations
  getUser(telegramId: number): Promise<UserData | null>;
  saveUser(telegramId: number, data: UserData): Promise<void>;
  deleteUser(telegramId: number): Promise<void>;
  getAllUsers(): Promise<Map<number, UserData>>;
  
  // Wallet operations
  addWallet(telegramId: number, wallet: WatchedWallet): Promise<boolean>;
  removeWallet(telegramId: number, address: string): Promise<boolean>;
  getWallets(telegramId: number): Promise<WatchedWallet[]>;
  getWallet(telegramId: number, address: string): Promise<WatchedWallet | null>;
  updateWallet(telegramId: number, address: string, updates: Partial<WatchedWallet>): Promise<boolean>;
  
  // Settings operations
  getUserSettings(telegramId: number): Promise<any>;
  updateUserSettings(telegramId: number, settings: any): Promise<void>;
  
  // Cache operations
  cacheSecurityScan(address: string, data: any, expiresAt: Date): Promise<void>;
  getSecurityScanCache(address: string): Promise<any | null>;
  
  // Alert operations
  createAlert(walletId: number, type: string, severity: string, message: string, metadata?: any): Promise<void>;
  getUnreadAlerts(telegramId: number): Promise<any[]>;
  markAlertAsRead(alertId: number): Promise<void>;
  
  // Initialization
  initialize(): Promise<void>;
  close(): Promise<void>;
}

export interface AddWalletResult {
  success: boolean;
  message?: string;
  wallet?: WatchedWallet;
}

export interface RemoveWalletResult {
  success: boolean;
  message?: string;
}

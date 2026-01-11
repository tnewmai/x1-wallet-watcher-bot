/**
 * Minimal Type Definitions for X1 Wallet Watcher Bot
 */

export interface WatchedWallet {
  address: string;
  label?: string;
  addedAt: number;
  lastChecked?: number;
  lastBalance?: string;
  lastSignature?: string;
  alertsEnabled: boolean;
}

export interface UserData {
  telegramId: number;
  username?: string;
  wallets: WatchedWallet[];
  settings: UserSettings;
  createdAt: number;
}

export interface UserSettings {
  notifyIncoming: boolean;
  notifyOutgoing: boolean;
  notifyBalanceChange: boolean;
  minValueXn: number;
}

export interface Transaction {
  signature: string;
  blockTime: number;
  type: 'incoming' | 'outgoing' | 'unknown';
  amount?: number;
  from?: string;
  to?: string;
}

export interface BotConfig {
  botToken: string;
  x1RpcUrl: string;
  pollInterval: number;
  explorerUrl: string;
  maxWalletsPerUser: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  healthCheckPort: number;
}

export interface CacheEntry<T> {
  data: T;
  expires: number;
}

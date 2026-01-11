// Import Grammy Context
import { Context } from 'grammy';

// Extended context for Grammy with session support
export interface MyContext extends Context {
  session?: {
    awaitingWalletAddress?: boolean;
    awaitingWalletLabel?: boolean;
    tempWalletAddress?: string;
    [key: string]: any;
  };
}

// User preferences for notifications
export interface NotificationSettings {
  // Master toggle for transaction notifications
  transactionsEnabled: boolean;
  // Notify on incoming transactions
  incoming: boolean;
  // Notify on outgoing transactions
  outgoing: boolean;
  // Minimum value threshold (in XNT)
  minValue: number;
  // Notify on program interactions (smart contract calls)
  contractInteractions: boolean;
  // Notify on balance changes (even without detected tx)
  balanceAlerts: boolean;
  // Minimum balance change to notify (in XNT)
  minBalanceChange: number;
}

// Token program type
export type TokenProgram = 'spl-token' | 'token-2022';

// Tracked SPL/Token-2022 token for a wallet
export interface TrackedToken {
  // Token mint address
  contractAddress: string;
  // Token symbol (e.g., "USDC")
  symbol: string;
  // Token decimals
  decimals: number;
  // Token program (spl-token or token-2022)
  program: TokenProgram;
  // Last known balance
  lastBalance?: string;
}

// Watched wallet entry
export interface WatchedWallet {
  // Wallet address (Solana public key in base58)
  address: string;
  // Optional label/name for the wallet
  label?: string;
  // When the wallet was added
  addedAt: number;
  // Last known balance (in SOL)
  lastBalance?: string;
  // Last known transaction signature
  lastSignature?: string;
  // Legacy field for compatibility
  lastTxCount?: number;
  // Tracked SPL tokens for this wallet
  trackedTokens?: TrackedToken[];
  
  // Rugger alerts (new feature)
  alertsEnabled?: boolean;
  isKnownRugger?: boolean;
  ruggerScore?: number; // 0-100, higher = more suspicious
  lastAlertSent?: number;
  
  // Pending alert notifications
  pendingAlerts?: {
    type: 'token_deployed' | 'lp_added' | 'lp_removed';
    timestamp: number;
    details: string;
    tokenAddress?: string;
  }[];
}

// User data
export interface UserData {
  // Telegram user ID
  visibleTelegramId: number;
  // Telegram username (if available)
  username?: string;
  // List of watched wallets
  wallets: WatchedWallet[];
  // Notification settings
  settings: NotificationSettings;
  // When user first started the bot
  createdAt: number;
  // Is the user active (can receive notifications)
  isActive: boolean;
}

// Transaction info for notifications
export interface TransactionInfo {
  // Transaction signature (hash)
  hash: string;
  // Sender address
  from: string;
  // Recipient address (null for some program interactions)
  to: string | null;
  // Value transferred in SOL
  value: string;
  // Slot number (equivalent to block number)
  blockNumber: number;
  // Unix timestamp
  timestamp?: number;
  // Whether this involves a program (smart contract) interaction
  isContractInteraction: boolean;
}

// Storage structure
export interface StorageData {
  users: { [telegramId: string]: UserData };
  // Global stats
  stats: {
    totalUsers: number;
    totalWallets: number;
    totalNotificationsSent: number;
  };
}

// Default notification settings
export const defaultNotificationSettings: NotificationSettings = {
  transactionsEnabled: false,  // Master toggle - OFF by default until user enables
  incoming: true,
  outgoing: true,
  minValue: 0.01,  // Ignore tiny transactions by default
  contractInteractions: false,  // Don't spam with every program interaction
  balanceAlerts: false,  // Disable separate balance alerts (tx notifications are enough)
  minBalanceChange: 0.01,
};

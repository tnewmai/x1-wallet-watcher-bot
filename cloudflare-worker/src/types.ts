// Cloudflare Workers Types for X1 Bot

export interface Env {
  BOT_DATA: KVNamespace;
  BOT_TOKEN: string;
  X1_RPC_URL?: string;
  WEBHOOK_SECRET?: string;
  ENVIRONMENT?: string;
}

export interface WalletData {
  address: string;
  label: string;
  userId: number;
  lastBalance: number;
  lastSignature?: string;
  addedAt: number;
  tokens: TokenWatch[];
}

export interface TokenWatch {
  mint: string;
  symbol?: string;
  name?: string;
  decimals: number;
  lastBalance: number;
}

// Alias for compatibility with keyboards
export interface WatchedWallet extends WalletData {
  isKnownRugger?: boolean;
  alertsEnabled?: boolean;
  pendingAlerts?: any[];
}

export interface TrackedToken extends TokenWatch {
  contractAddress: string;
}

export interface NotificationSettings extends UserSettings {
  transactionsEnabled: boolean;
  incoming: boolean;
  outgoing: boolean;
  contractInteractions: boolean;
  balanceAlerts: boolean;
  minValue: number;
}

export interface UserData {
  userId: number;
  username?: string;
  firstName?: string;
  wallets: string[]; // Array of wallet addresses
  settings: UserSettings;
  createdAt: number;
  lastActive: number;
}

export interface UserSettings {
  notifyIncoming: boolean;
  notifyOutgoing: boolean;
  notifyBalance: boolean;
  notifyTokens: boolean;
  minValueFilter: number;
}

export interface WatcherState {
  lastCheck: number;
  walletsChecked: number;
  errors: number;
}

// KV Storage Keys
export const KV_KEYS = {
  USER: (userId: number) => `user:${userId}`,
  WALLET: (address: string) => `wallet:${address}`,
  USER_WALLETS: (userId: number) => `user_wallets:${userId}`,
  WATCHER_STATE: 'watcher:state',
  ALL_WALLETS: 'all_wallets', // List of all monitored wallets
};

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  username?: string;
  first_name?: string;
}

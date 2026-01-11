/**
 * Application Constants
 * Centralized constants to eliminate magic numbers
 */

// Wallet Management
export const MAX_WALLETS_PER_USER = 10;
export const MAX_TOKENS_PER_WALLET = 10;
export const WALLETS_PER_PAGE = 5;

// Transaction Thresholds
export const MAX_TRANSACTIONS_DISPLAY = 50000;
export const RUGGER_TOKEN_THRESHOLD = 10; // Deploying 10+ tokens is suspicious
export const LARGE_TRANSFER_DEFAULT_THRESHOLD = 100; // XNT
export const MIN_VALUE_OPTIONS = [0, 0.1, 1, 10, 100, 1000];

// Security Scan Settings
export const SECURITY_SCAN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms
export const SECURITY_SCAN_TIMEOUT = 10000; // 10 seconds (optimized for speed)
export const STALE_SCAN_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

// WebSocket Settings
export const WEBSOCKET_HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
export const WEBSOCKET_RECONNECT_DELAY = 5000; // 5 seconds
export const WEBSOCKET_MAX_RECONNECT_ATTEMPTS = 5;
export const WEBSOCKET_STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

// Polling Settings
export const DEFAULT_POLL_INTERVAL = 15000; // 15 seconds
export const WEBSOCKET_POLL_INTERVAL = 60000; // 60 seconds (when using WebSocket)
export const WATCHER_CONCURRENCY = 3; // Process 3 wallets simultaneously

// Cache TTL
export const CACHE_TTL_SHORT = 5 * 60 * 1000; // 5 minutes
export const CACHE_TTL_MEDIUM = 30 * 60 * 1000; // 30 minutes
export const CACHE_TTL_LONG = 24 * 60 * 60 * 1000; // 24 hours

// Rate Limiting
export const RATE_LIMIT_COMMANDS = 10; // 10 commands per 10 seconds
export const RATE_LIMIT_SECURITY_SCANS = 3; // 3 scans per minute
export const RATE_LIMIT_WALLET_ADDITIONS = 5; // 5 additions per minute
export const RATE_LIMIT_API_CALLS = 20; // 20 calls per minute

// Display Formatting
export const ADDRESS_SHORT_LENGTH = 8; // First 8 chars
export const ADDRESS_TAIL_LENGTH = 4; // Last 4 chars
export const MAX_DECIMALS_SMALL = 4; // For amounts < 1
export const MAX_DECIMALS_LARGE = 2; // For amounts >= 1
export const THOUSAND = 1000;
export const MILLION = 1000000;
export const BILLION = 1000000000;

// Time Constants (in milliseconds)
export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// Wallet Age Thresholds (in days)
export const WALLET_AGE_NEW = 7; // Less than 7 days old
export const WALLET_AGE_YOUNG = 30; // Less than 30 days old
export const WALLET_AGE_MATURE = 90; // Less than 90 days old

// Transaction Activity Thresholds
export const HIGH_ACTIVITY_THRESHOLD = 100; // 100+ transactions per day
export const MEDIUM_ACTIVITY_THRESHOLD = 10; // 10-100 transactions per day
export const LOW_ACTIVITY_THRESHOLD = 1; // 1-10 transactions per day

// Risk Score Thresholds
export const RISK_SCORE_SAFE = 20;
export const RISK_SCORE_CAUTION = 40;
export const RISK_SCORE_WARNING = 60;
export const RISK_SCORE_DANGER = 80;
export const RISK_SCORE_EXTREME = 90;

// Rugger Detection Thresholds
export const RUGGER_MIN_TOKENS = 3; // Deployed at least 3 tokens
export const RUGGER_MIN_RUG_COUNT = 1; // At least 1 confirmed rug
export const SERIAL_DEPLOYER_THRESHOLD = 5; // 5+ tokens deployed
export const SERIAL_RUGGER_THRESHOLD = 2; // 2+ rugs

// Connected Wallet Thresholds
export const SUSPICIOUS_CONNECTIONS = 1; // Connected to 1+ ruggers
export const DANGEROUS_CONNECTIONS = 3; // Connected to 3+ ruggers

// LP Analysis Thresholds
export const LP_REMOVAL_PERCENTAGE_WARNING = 50; // 50%+ LP removed is suspicious
export const LP_REMOVAL_PERCENTAGE_DANGER = 80; // 80%+ LP removed is highly suspicious

// Token Holder Thresholds
export const MIN_HOLDERS_SAFE = 100;
export const MIN_HOLDERS_WARNING = 50;
export const MIN_HOLDERS_DANGER = 10;

// Liquidity Thresholds (in USD)
export const MIN_LIQUIDITY_SAFE = 10000;
export const MIN_LIQUIDITY_WARNING = 1000;
export const MIN_LIQUIDITY_DANGER = 100;

// Pagination
export const PORTFOLIO_ITEMS_PER_PAGE = 10;
export const TRANSACTION_ITEMS_PER_PAGE = 20;
export const ALERT_ITEMS_PER_PAGE = 5;

// Message Length Limits
export const MAX_MESSAGE_LENGTH = 4096; // Telegram limit
export const MAX_CAPTION_LENGTH = 1024;
export const MAX_BUTTON_TEXT_LENGTH = 64;

// File Size Limits
export const MAX_EXPORT_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_CSV_ROWS = 100000;

// API Retry Settings
export const RPC_MAX_RETRIES = 3;
export const RPC_RETRY_DELAY = 1000; // 1 second
export const RPC_TIMEOUT = 10000; // 10 seconds

// Health Check Settings
export const HEALTH_CHECK_PORT = 3000;
export const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Logging
export const LOG_LEVEL_PRODUCTION = 'info';
export const LOG_LEVEL_DEVELOPMENT = 'debug';
export const LOG_MAX_FILES = 30; // Keep 30 days of logs
export const LOG_MAX_SIZE = 20 * 1024 * 1024; // 20 MB per file

// Database
export const DB_CONNECTION_TIMEOUT = 5000; // 5 seconds
export const DB_QUERY_TIMEOUT = 30000; // 30 seconds
export const DB_POOL_MIN = 2;
export const DB_POOL_MAX = 10;

// Emojis (for consistent use)
export const EMOJI = {
  // Status
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  
  // Actions
  ADD: '➕',
  REMOVE: '➖',
  REFRESH: '🔄',
  SEARCH: '🔍',
  SETTINGS: '⚙️',
  
  // Wallet
  WALLET: '👛',
  BALANCE: '💰',
  TRANSACTION: '💸',
  INCOMING: '📥',
  OUTGOING: '📤',
  
  // Security
  SHIELD: '🛡️',
  DANGER: '🚨',
  ALERT: '🔔',
  MUTE: '🔕',
  
  // Data
  CHART: '📊',
  STATS: '📈',
  LIST: '📋',
  DOCUMENT: '📄',
  
  // Time
  CLOCK: '🕐',
  CALENDAR: '📅',
  TIMER: '⏱️',
  
  // Other
  LINK: '🔗',
  TOKEN: '🪙',
  FIRE: '🔥',
  ROCKET: '🚀',
  STAR: '⭐',
  CHECK: '✓',
  CROSS: '✗',
};

// Message Templates
export const MESSAGES = {
  RATE_LIMIT: '⏱️ Too many requests. Please wait {seconds} seconds.',
  WALLET_ADDED: '✅ Wallet added successfully!',
  WALLET_REMOVED: '✅ Wallet removed successfully!',
  WALLET_NOT_FOUND: '❌ Wallet not found.',
  INVALID_ADDRESS: '❌ Invalid wallet address.',
  MAX_WALLETS_REACHED: '⚠️ Maximum {max} wallets allowed. Remove one first.',
  NO_WALLETS: '📭 No wallets monitored yet.',
  LOADING: '⏳ Loading...',
  ERROR_GENERIC: '❌ An error occurred. Please try again.',
};

// URLs
export const URLS = {
  EXPLORER: 'https://explorer.x1-mainnet.infrafc.org',
  RPC_DEFAULT: 'https://rpc.mainnet.x1.xyz',
  DOCS: 'https://docs.x1.xyz',
};

// Feature Flags
export const FEATURES = {
  WEBSOCKET_ENABLED: true,
  POLLING_FALLBACK_ENABLED: true,
  SECURITY_SCANS_ENABLED: true,
  PORTFOLIO_TRACKING_ENABLED: true,
  EXPORT_ENABLED: true,
  METRICS_ENABLED: true,
};

// Development vs Production
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Export all constants as a single object for convenience
export const CONSTANTS = {
  MAX_WALLETS_PER_USER,
  MAX_TOKENS_PER_WALLET,
  WALLETS_PER_PAGE,
  SECURITY_SCAN_CACHE_TTL,
  WEBSOCKET_HEALTH_CHECK_INTERVAL,
  DEFAULT_POLL_INTERVAL,
  RATE_LIMIT_COMMANDS,
  EMOJI,
  MESSAGES,
  URLS,
  FEATURES,
};

export default CONSTANTS;

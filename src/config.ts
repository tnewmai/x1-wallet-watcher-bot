import dotenv from 'dotenv';
import path from 'path';
import { validateConfiguration, type ValidatedConfig } from './config.validator';

dotenv.config();

// Raw config from environment
const rawConfig = {
  // Telegram Bot Token
  botToken: process.env.BOT_TOKEN || '',
  
  // X1 Blockchain RPC (SVM-based)
  x1RpcUrl: process.env.X1_RPC_URL || 'https://rpc.mainnet.x1.xyz',
  
  // Polling interval for checking transactions (in ms)
  pollInterval: parseInt(process.env.POLL_INTERVAL || '15000', 10),
  
  // Data storage path
  dataPath: path.join(__dirname, '..', 'data'),
  
  // X1 Block Explorer
  explorerUrl: process.env.EXPLORER_URL || 'https://explorer.x1-mainnet.xen.network',
  
  // Maximum wallets per user
  maxWalletsPerUser: 10,
  
  // Native token symbol
  nativeToken: 'XNT',
  
  // Lamports per XNT (1 XNT = 1,000,000,000 lamports, same as Solana)
  lamportsPerXn: 1_000_000_000,
  
  // Rate limiting & performance settings
  watcherConcurrency: parseInt(process.env.WATCHER_CONCURRENCY || '3', 10),
  securityScanTimeout: parseInt(process.env.SECURITY_SCAN_TIMEOUT || '10000', 10),
  cacheTtlShort: parseInt(process.env.CACHE_TTL_SHORT || '300', 10),
  
  // RPC retry settings
  rpcMaxRetries: parseInt(process.env.RPC_MAX_RETRIES || '3', 10),
  rpcRetryDelay: parseInt(process.env.RPC_RETRY_DELAY || '1000', 10),
  
  // Health check settings
  healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3000', 10),
  healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
  
  // Monitoring & logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enablePerformanceMetrics: process.env.ENABLE_PERFORMANCE_METRICS !== 'false',
  enableRpcMetrics: process.env.ENABLE_RPC_METRICS !== 'false',
  adminUserIds: process.env.ADMIN_USER_IDS 
    ? process.env.ADMIN_USER_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    : [],
  
  // Security scan settings
  disableAutoSecurityScan: process.env.DISABLE_AUTO_SECURITY_SCAN === 'true',
  
  // Node environment
  nodeEnv: (process.env.NODE_ENV || 'production') as 'development' | 'production' | 'test',
};

// Validate and export configuration
export const config: ValidatedConfig = validateConfiguration(rawConfig);

// Legacy validation function (now handled by Zod)
export function validateConfig(): void {
  // Configuration is already validated by validateConfiguration()
  // This function kept for backward compatibility
}

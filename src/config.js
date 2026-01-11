"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
var dotenv_1 = __importDefault(require("dotenv"));
var path_1 = __importDefault(require("path"));
var config_validator_1 = require("./config.validator");
dotenv_1.default.config();
// Raw config from environment
var rawConfig = {
    // Telegram Bot Token
    botToken: process.env.BOT_TOKEN || '',
    // X1 Blockchain RPC (SVM-based)
    x1RpcUrl: process.env.X1_RPC_URL || 'https://rpc.mainnet.x1.xyz',
    // Polling interval for checking transactions (in ms)
    pollInterval: parseInt(process.env.POLL_INTERVAL || '15000', 10),
    // Data storage path
    dataPath: path_1.default.join(__dirname, '..', 'data'),
    // X1 Block Explorer
    explorerUrl: process.env.EXPLORER_URL || 'https://explorer.x1-mainnet.xen.network',
    // Maximum wallets per user
    maxWalletsPerUser: 10,
    // Native token symbol
    nativeToken: 'XNT',
    // Lamports per XNT (1 XNT = 1,000,000,000 lamports, same as Solana)
    lamportsPerXn: 1000000000,
    // Rate limiting & performance settings
    watcherConcurrency: parseInt(process.env.WATCHER_CONCURRENCY || '3', 10),
    securityScanTimeout: parseInt(process.env.SECURITY_SCAN_TIMEOUT || '30000', 10),
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
    // Security scan settings
    disableAutoSecurityScan: process.env.DISABLE_AUTO_SECURITY_SCAN === 'true',
    // Node environment
    nodeEnv: (process.env.NODE_ENV || 'production'),
};
// Validate and export configuration
exports.config = (0, config_validator_1.validateConfiguration)(rawConfig);
// Legacy validation function (now handled by Zod)
function validateConfig() {
    // Configuration is already validated by validateConfiguration()
    // This function kept for backward compatibility
}

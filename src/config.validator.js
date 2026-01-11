"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfiguration = validateConfiguration;
exports.sanitizeConfigForLogging = sanitizeConfigForLogging;
// Production-grade configuration validation with Zod
var zod_1 = require("zod");
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)('ConfigValidator');
// Define the configuration schema
var configSchema = zod_1.z.object({
    // Required fields
    botToken: zod_1.z.string().min(1, 'BOT_TOKEN is required. Get one from @BotFather on Telegram.'),
    // X1 Blockchain settings
    x1RpcUrl: zod_1.z.string().url('X1_RPC_URL must be a valid URL').default('https://rpc.mainnet.x1.xyz'),
    // Timing settings
    pollInterval: zod_1.z.number()
        .min(5000, 'POLL_INTERVAL must be at least 5000ms (5 seconds) to avoid rate limiting')
        .max(300000, 'POLL_INTERVAL should not exceed 300000ms (5 minutes)')
        .default(15000),
    // Paths
    dataPath: zod_1.z.string().min(1),
    // URLs
    explorerUrl: zod_1.z.string().url('EXPLORER_URL must be a valid URL').default('https://explorer.x1-mainnet.xen.network'),
    // Limits
    maxWalletsPerUser: zod_1.z.number().min(1).max(100).default(10),
    // Token settings
    nativeToken: zod_1.z.string().default('XNT'),
    lamportsPerXn: zod_1.z.number().positive().default(1000000000),
    // Performance settings
    watcherConcurrency: zod_1.z.number()
        .min(1, 'WATCHER_CONCURRENCY must be at least 1')
        .max(20, 'WATCHER_CONCURRENCY should not exceed 20 to avoid rate limiting')
        .default(3),
    securityScanTimeout: zod_1.z.number()
        .min(5000, 'SECURITY_SCAN_TIMEOUT must be at least 5000ms')
        .max(60000, 'SECURITY_SCAN_TIMEOUT should not exceed 60000ms')
        .default(30000),
    cacheTtlShort: zod_1.z.number()
        .min(60, 'CACHE_TTL_SHORT must be at least 60 seconds')
        .max(3600, 'CACHE_TTL_SHORT should not exceed 3600 seconds')
        .default(300),
    // RPC retry settings
    rpcMaxRetries: zod_1.z.number()
        .min(0, 'RPC_MAX_RETRIES must be at least 0')
        .max(10, 'RPC_MAX_RETRIES should not exceed 10')
        .default(3),
    rpcRetryDelay: zod_1.z.number()
        .min(100, 'RPC_RETRY_DELAY must be at least 100ms')
        .max(10000, 'RPC_RETRY_DELAY should not exceed 10000ms')
        .default(1000),
    // Health check settings
    healthCheckPort: zod_1.z.number()
        .min(1024, 'HEALTH_CHECK_PORT must be at least 1024')
        .max(65535, 'HEALTH_CHECK_PORT must not exceed 65535')
        .default(3000),
    healthCheckEnabled: zod_1.z.boolean().default(true),
    // Monitoring & logging
    logLevel: zod_1.z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
    enablePerformanceMetrics: zod_1.z.boolean().default(true),
    enableRpcMetrics: zod_1.z.boolean().default(true),
    // Security
    disableAutoSecurityScan: zod_1.z.boolean().default(false),
    // Node environment
    nodeEnv: zod_1.z.enum(['development', 'production', 'test']).default('production'),
});
/**
 * Validate configuration and provide helpful error messages
 */
function validateConfiguration(config) {
    logger.info('Validating configuration...');
    try {
        var validated = configSchema.parse(config);
        // Log configuration summary (without sensitive data)
        logger.info('Configuration validated successfully', {
            nodeEnv: validated.nodeEnv,
            x1RpcUrl: validated.x1RpcUrl,
            pollInterval: validated.pollInterval,
            watcherConcurrency: validated.watcherConcurrency,
            logLevel: validated.logLevel,
            healthCheckEnabled: validated.healthCheckEnabled,
        });
        // Warnings for production environment
        if (validated.nodeEnv === 'production') {
            if (validated.logLevel === 'debug') {
                logger.warn('Debug logging is enabled in production - this may impact performance');
            }
            if (validated.pollInterval < 10000) {
                logger.warn('Poll interval is less than 10 seconds in production - watch for rate limiting');
            }
            if (validated.watcherConcurrency > 5) {
                logger.warn('High watcher concurrency in production - ensure your RPC can handle the load');
            }
        }
        return validated;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            logger.error('Configuration validation failed', error);
            // Format validation errors in a user-friendly way
            var errors = error.issues.map(function (err) {
                var path = err.path.join('.');
                return "  \u274C ".concat(path, ": ").concat(err.message);
            }).join('\n');
            var errorMessage = "\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551           CONFIGURATION VALIDATION FAILED                  \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\nThe following configuration errors were found:\n\n".concat(errors, "\n\nPlease check your .env file and ensure all required variables are set correctly.\n\nRequired variables:\n  - BOT_TOKEN: Get from @BotFather on Telegram\n\nOptional variables (with defaults):\n  - X1_RPC_URL (default: https://rpc.mainnet.x1.xyz)\n  - POLL_INTERVAL (default: 15000)\n  - WATCHER_CONCURRENCY (default: 3)\n  - LOG_LEVEL (default: info)\n  - HEALTH_CHECK_PORT (default: 3000)\n\nFor a complete list, see .env.example\n\nExiting...\n");
            logger.error(errorMessage);
            process.exit(1);
        }
        throw error;
    }
}
/**
 * Create a safe config object for logging (removes sensitive data)
 */
function sanitizeConfigForLogging(config) {
    return __assign(__assign({}, config), { botToken: '***REDACTED***' });
}

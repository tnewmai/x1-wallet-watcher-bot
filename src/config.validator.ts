// Production-grade configuration validation with Zod
import { z } from 'zod';
import { createLogger } from './logger';

const logger = createLogger('ConfigValidator');

// Define the configuration schema
const configSchema = z.object({
  // Required fields
  botToken: z.string().min(1, 'BOT_TOKEN is required. Get one from @BotFather on Telegram.'),
  
  // X1 Blockchain settings
  x1RpcUrl: z.string().url('X1_RPC_URL must be a valid URL').default('https://rpc.mainnet.x1.xyz'),
  
  // Timing settings
  pollInterval: z.number()
    .min(5000, 'POLL_INTERVAL must be at least 5000ms (5 seconds) to avoid rate limiting')
    .max(300000, 'POLL_INTERVAL should not exceed 300000ms (5 minutes)')
    .default(15000),
  
  // Paths
  dataPath: z.string().min(1),
  
  // URLs
  explorerUrl: z.string().url('EXPLORER_URL must be a valid URL').default('https://explorer.x1-mainnet.xen.network'),
  
  // Limits
  maxWalletsPerUser: z.number().min(1).max(100).default(10),
  
  // Token settings
  nativeToken: z.string().default('XNT'),
  lamportsPerXn: z.number().positive().default(1_000_000_000),
  
  // Performance settings
  watcherConcurrency: z.number()
    .min(1, 'WATCHER_CONCURRENCY must be at least 1')
    .max(20, 'WATCHER_CONCURRENCY should not exceed 20 to avoid rate limiting')
    .default(3),
  
  securityScanTimeout: z.number()
    .min(5000, 'SECURITY_SCAN_TIMEOUT must be at least 5000ms')
    .max(60000, 'SECURITY_SCAN_TIMEOUT should not exceed 60000ms')
    .default(30000),
  
  cacheTtlShort: z.number()
    .min(60, 'CACHE_TTL_SHORT must be at least 60 seconds')
    .max(3600, 'CACHE_TTL_SHORT should not exceed 3600 seconds')
    .default(300),
  
  // RPC retry settings
  rpcMaxRetries: z.number()
    .min(0, 'RPC_MAX_RETRIES must be at least 0')
    .max(10, 'RPC_MAX_RETRIES should not exceed 10')
    .default(3),
  
  rpcRetryDelay: z.number()
    .min(100, 'RPC_RETRY_DELAY must be at least 100ms')
    .max(10000, 'RPC_RETRY_DELAY should not exceed 10000ms')
    .default(1000),
  
  // Health check settings
  healthCheckPort: z.number()
    .min(1024, 'HEALTH_CHECK_PORT must be at least 1024')
    .max(65535, 'HEALTH_CHECK_PORT must not exceed 65535')
    .default(3000),
  
  healthCheckEnabled: z.boolean().default(true),
  
  // Monitoring & logging
  logLevel: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  enablePerformanceMetrics: z.boolean().default(true),
  enableRpcMetrics: z.boolean().default(true),
  adminUserIds: z.array(z.number()).default([]),
  
  // Security
  disableAutoSecurityScan: z.boolean().default(false),
  
  // Node environment
  nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
});

export type ValidatedConfig = z.infer<typeof configSchema>;

/**
 * Validate configuration and provide helpful error messages
 */
export function validateConfiguration(config: any): ValidatedConfig {
  logger.info('Validating configuration...');
  
  try {
    const validated = configSchema.parse(config);
    
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Configuration validation failed', error as Error);
      
      // Format validation errors in a user-friendly way
      const errors = error.issues.map((err: any) => {
        const path = err.path.join('.');
        return `  ❌ ${path}: ${err.message}`;
      }).join('\n');
      
      const errorMessage = `
╔════════════════════════════════════════════════════════════╗
║           CONFIGURATION VALIDATION FAILED                  ║
╚════════════════════════════════════════════════════════════╝

The following configuration errors were found:

${errors}

Please check your .env file and ensure all required variables are set correctly.

Required variables:
  - BOT_TOKEN: Get from @BotFather on Telegram

Optional variables (with defaults):
  - X1_RPC_URL (default: https://rpc.mainnet.x1.xyz)
  - POLL_INTERVAL (default: 15000)
  - WATCHER_CONCURRENCY (default: 3)
  - LOG_LEVEL (default: info)
  - HEALTH_CHECK_PORT (default: 3000)

For a complete list, see .env.example

Exiting...
`;
      
      logger.error(errorMessage);
      process.exit(1);
    }
    
    throw error;
  }
}

/**
 * Create a safe config object for logging (removes sensitive data)
 */
export function sanitizeConfigForLogging(config: ValidatedConfig): Record<string, any> {
  return {
    ...config,
    botToken: '***REDACTED***',
  };
}

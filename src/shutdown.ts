// Production-grade graceful shutdown handler
import { createLogger } from './logger';
import { markNotReady, stopHealthCheckServer } from './health';

const logger = createLogger('Shutdown');

interface ShutdownHook {
  name: string;
  handler: () => Promise<void>;
  timeout: number;
}

const shutdownHooks: ShutdownHook[] = [];
let isShuttingDown = false;
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds total shutdown timeout

/**
 * Register a shutdown hook
 */
export function registerShutdownHook(name: string, handler: () => Promise<void>, timeout: number = 10000): void {
  shutdownHooks.push({ name, handler, timeout });
  logger.debug(`Registered shutdown hook: ${name}`, { timeout });
}

/**
 * Execute all shutdown hooks with timeout
 */
async function executeShutdownHooks(): Promise<void> {
  logger.info(`Executing ${shutdownHooks.length} shutdown hooks...`);
  
  for (const hook of shutdownHooks) {
    try {
      logger.info(`Running shutdown hook: ${hook.name}`);
      
      // Run hook with timeout
      await Promise.race([
        hook.handler(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${hook.timeout}ms`)), hook.timeout)
        ),
      ]);
      
      logger.info(`✓ Shutdown hook completed: ${hook.name}`);
    } catch (error: any) {
      logger.error(`✗ Shutdown hook failed: ${hook.name}`, error);
      // Continue with other hooks even if one fails
    }
  }
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal');
    return;
  }
  
  isShuttingDown = true;
  logger.info(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  // Start shutdown timeout
  const shutdownTimer = setTimeout(() => {
    logger.error(`Shutdown timeout (${SHUTDOWN_TIMEOUT}ms) exceeded, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
  
  try {
    // Step 1: Mark service as not ready (stop accepting new requests)
    logger.info('Step 1/5: Marking service as not ready...');
    markNotReady();
    
    // Step 2: Wait a bit for load balancers to notice
    logger.info('Step 2/5: Waiting for load balancers to drain (2s)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Execute all registered shutdown hooks
    logger.info('Step 3/5: Executing shutdown hooks...');
    await executeShutdownHooks();
    
    // Step 4: Stop health check server
    logger.info('Step 4/5: Stopping health check server...');
    await stopHealthCheckServer();
    
    // Step 5: Final cleanup
    logger.info('Step 5/5: Final cleanup...');
    clearTimeout(shutdownTimer);
    
    logger.info('✅ Graceful shutdown completed successfully');
    
    // Give logger time to flush
    await new Promise(resolve => setTimeout(resolve, 100));
    
    process.exit(0);
  } catch (error: any) {
    logger.error('Error during graceful shutdown', error);
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

/**
 * Setup shutdown handlers for all common signals
 */
export function setupShutdownHandlers(): void {
  // SIGINT (Ctrl+C)
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // SIGTERM (Kubernetes, Docker, systemd)
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  // SIGQUIT
  process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
  
  // Uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception, shutting down...', error);
    gracefulShutdown('uncaughtException');
  });
  
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled promise rejection, shutting down...', reason);
    gracefulShutdown('unhandledRejection');
  });
  
  logger.info('Shutdown handlers registered (SIGINT, SIGTERM, SIGQUIT)');
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

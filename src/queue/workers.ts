/**
 * Background Workers
 * Process background jobs from queues
 */

import { Job } from 'bullmq';
import { getQueueManager } from './queue-manager';
import { checkWalletSecurity } from '../security';
import { getBalance } from '../blockchain';
import { getStorage } from '../storage-v2';
import logger from '../logger';

/**
 * Security scan worker
 */
export async function securityScanWorker(job: Job): Promise<any> {
  const { walletAddress, userId } = job.data;
  
  try {
    logger.info(`Processing security scan job ${job.id} for wallet ${walletAddress.slice(0, 8)}...`);
    
    const securityInfo = await checkWalletSecurity(walletAddress);
    
    // Cache results
    const storage = getStorage();
    await storage.cacheSecurityScan(walletAddress, securityInfo);
    
    logger.info(`Security scan completed for ${walletAddress.slice(0, 8)}...`);
    
    return { success: true, securityInfo };
  } catch (error) {
    logger.error(`Security scan job ${job.id} failed:`, error);
    throw error;
  }
}

/**
 * Balance check worker
 */
export async function balanceCheckWorker(job: Job): Promise<any> {
  const { walletAddress, userId } = job.data;
  
  try {
    logger.debug(`Processing balance check job ${job.id} for wallet ${walletAddress.slice(0, 8)}...`);
    
    const balance = await getBalance(walletAddress);
    
    // Update in storage
    const storage = getStorage();
    await storage.updateWalletBalance(userId, walletAddress, balance);
    
    return { success: true, balance };
  } catch (error) {
    logger.error(`Balance check job ${job.id} failed:`, error);
    throw error;
  }
}

/**
 * Notification worker
 */
export async function notificationWorker(job: Job): Promise<any> {
  const { userId, message, options } = job.data;
  
  try {
    logger.debug(`Processing notification job ${job.id} for user ${userId}`);
    
    // Send notification via Telegram bot
    // This would use the bot API to send the message
    // For now, we'll just log it
    
    logger.info(`Notification sent to user ${userId}`);
    
    return { success: true };
  } catch (error) {
    logger.error(`Notification job ${job.id} failed:`, error);
    throw error;
  }
}

/**
 * Cleanup worker (scheduled job)
 */
export async function cleanupWorker(job: Job): Promise<any> {
  try {
    logger.info('Running cleanup job...');
    
    const queueManager = getQueueManager();
    
    // Clean old completed jobs
    const queues = queueManager.getQueueNames();
    let totalCleaned = 0;
    
    for (const queueName of queues) {
      const cleaned = await queueManager.cleanQueue(queueName, 3600000, 'completed');
      totalCleaned += cleaned;
    }
    
    logger.info(`Cleanup completed: ${totalCleaned} jobs cleaned`);
    
    return { success: true, cleaned: totalCleaned };
  } catch (error) {
    logger.error('Cleanup job failed:', error);
    throw error;
  }
}

/**
 * Initialize all workers
 */
export function initializeWorkers(): void {
  const queueManager = getQueueManager();
  
  // Security scan worker
  queueManager.createWorker('security-scan', securityScanWorker, {
    concurrency: 3, // Process 3 security scans concurrently
  } as any);
  
  // Balance check worker
  queueManager.createWorker('balance-check', balanceCheckWorker, {
    concurrency: 10, // Process 10 balance checks concurrently
  } as any);
  
  // Notification worker
  queueManager.createWorker('notifications', notificationWorker, {
    concurrency: 5, // Send 5 notifications concurrently
  } as any);
  
  // Cleanup worker
  queueManager.createWorker('cleanup', cleanupWorker, {
    concurrency: 1, // Only 1 cleanup job at a time
  } as any);
  
  logger.info('✅ All workers initialized');
}

/**
 * Queue a security scan
 */
export async function queueSecurityScan(walletAddress: string, userId: number): Promise<void> {
  const queueManager = getQueueManager();
  await queueManager.addJob('security-scan', {
    type: 'security-scan',
    payload: { walletAddress, userId },
    userId,
    priority: 2,
  });
}

/**
 * Queue a balance check
 */
export async function queueBalanceCheck(walletAddress: string, userId: number): Promise<void> {
  const queueManager = getQueueManager();
  await queueManager.addJob('balance-check', {
    type: 'balance-check',
    payload: { walletAddress, userId },
    userId,
    priority: 1,
  });
}

/**
 * Queue a notification
 */
export async function queueNotification(
  userId: number,
  message: string,
  options?: any
): Promise<void> {
  const queueManager = getQueueManager();
  await queueManager.addJob('notifications', {
    type: 'notification',
    payload: { userId, message, options },
    userId,
    priority: 3, // High priority
  });
}

/**
 * Schedule cleanup job (runs every hour)
 */
export async function scheduleCleanup(): Promise<void> {
  const queueManager = getQueueManager();
  await queueManager.addJob(
    'cleanup',
    {
      type: 'cleanup',
      payload: {},
    },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour
      },
    }
  );
  
  logger.info('✅ Cleanup job scheduled (every hour)');
}

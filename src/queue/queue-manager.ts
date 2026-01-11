/**
 * Queue Manager
 * Message queue for background job processing with Bull
 */

import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import logger from '../logger';

export interface JobData {
  type: string;
  payload: any;
  userId?: number;
  priority?: number;
}

export interface QueueConfig {
  name: string;
  connection: {
    host: string;
    port: number;
    password?: string;
  };
  defaultJobOptions?: {
    attempts?: number;
    backoff?: number | { type: string; delay: number };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  };
}

/**
 * Queue Manager for background jobs
 */
export class QueueManager {
  private queues: Map<string, Queue>;
  private workers: Map<string, Worker>;
  private connection: QueueConfig['connection'];

  constructor(redisUrl?: string) {
    this.queues = new Map();
    this.workers = new Map();

    // Parse Redis URL
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(url);
    
    this.connection = {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
    };

    logger.info('Queue Manager initialized');
  }

  /**
   * Create or get a queue
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500,     // Keep last 500 failed jobs
        },
      });

      this.queues.set(name, queue);
      logger.info(`Queue created: ${name}`);
    }

    return this.queues.get(name)!;
  }

  /**
   * Add job to queue
   */
  async addJob(
    queueName: string,
    jobData: JobData,
    options?: {
      delay?: number;
      priority?: number;
      repeat?: { pattern: string };
    }
  ): Promise<Job | null> {
    try {
      const queue = this.getQueue(queueName);
      
      const job = await queue.add(
        jobData.type,
        jobData.payload,
        {
          priority: options?.priority || jobData.priority,
          delay: options?.delay,
          repeat: options?.repeat,
        }
      );

      logger.debug(`Job added to queue ${queueName}: ${job.id}`);
      return job;
    } catch (error) {
      logger.error(`Error adding job to queue ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Create worker for processing jobs
   */
  createWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    options?: WorkerOptions
  ): Worker {
    if (this.workers.has(queueName)) {
      logger.warn(`Worker already exists for queue: ${queueName}`);
      return this.workers.get(queueName)!;
    }

    const worker = new Worker(
      queueName,
      processor,
      {
        connection: this.connection,
        concurrency: options?.concurrency || 5,
        ...options,
      }
    );

    // Event handlers
    worker.on('completed', (job) => {
      logger.debug(`Job completed: ${job.id} in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Job failed: ${job?.id} in queue ${queueName}`, err);
    });

    worker.on('error', (err) => {
      logger.error(`Worker error in queue ${queueName}:`, err);
    });

    this.workers.set(queueName, worker);
    logger.info(`Worker created for queue: ${queueName}`);

    return worker;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const queue = this.getQueue(queueName);
      
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      logger.error(`Error getting queue stats for ${queueName}:`, error);
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      await queue.pause();
      logger.info(`Queue paused: ${queueName}`);
    } catch (error) {
      logger.error(`Error pausing queue ${queueName}:`, error);
    }
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      await queue.resume();
      logger.info(`Queue resumed: ${queueName}`);
    } catch (error) {
      logger.error(`Error resuming queue ${queueName}:`, error);
    }
  }

  /**
   * Clean old jobs
   */
  async cleanQueue(
    queueName: string,
    grace: number = 3600000, // 1 hour
    status: 'completed' | 'failed' = 'completed'
  ): Promise<number> {
    try {
      const queue = this.getQueue(queueName);
      const jobs = await queue.clean(grace, 100, status);
      logger.info(`Cleaned ${jobs.length} ${status} jobs from queue ${queueName}`);
      return jobs.length;
    } catch (error) {
      logger.error(`Error cleaning queue ${queueName}:`, error);
      return 0;
    }
  }

  /**
   * Retry failed jobs
   */
  async retryFailedJobs(queueName: string): Promise<number> {
    try {
      const queue = this.getQueue(queueName);
      const failedJobs = await queue.getFailed();
      
      let retried = 0;
      for (const job of failedJobs) {
        await job.retry();
        retried++;
      }

      logger.info(`Retried ${retried} failed jobs in queue ${queueName}`);
      return retried;
    } catch (error) {
      logger.error(`Error retrying failed jobs in queue ${queueName}:`, error);
      return 0;
    }
  }

  /**
   * Get all queue names
   */
  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Close all queues and workers
   */
  async closeAll(): Promise<void> {
    logger.info('Closing all queues and workers...');

    // Close workers
    for (const [name, worker] of this.workers) {
      try {
        await worker.close();
        logger.info(`Worker closed: ${name}`);
      } catch (error) {
        logger.error(`Error closing worker ${name}:`, error);
      }
    }

    // Close queues
    for (const [name, queue] of this.queues) {
      try {
        await queue.close();
        logger.info(`Queue closed: ${name}`);
      } catch (error) {
        logger.error(`Error closing queue ${name}:`, error);
      }
    }

    this.queues.clear();
    this.workers.clear();
    
    logger.info('✅ All queues and workers closed');
  }
}

// Singleton instance
let queueManagerInstance: QueueManager | null = null;

/**
 * Get queue manager instance
 */
export function getQueueManager(): QueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new QueueManager();
  }
  return queueManagerInstance;
}

/**
 * Initialize queue manager
 */
export function initQueueManager(): QueueManager {
  const manager = getQueueManager();
  logger.info('✅ Queue Manager initialized');
  return manager;
}

export default getQueueManager;

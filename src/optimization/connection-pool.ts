/**
 * Connection Pool Optimization
 * Optimized connection management for RPC and database
 */

import { Connection, ConnectionConfig } from '@solana/web3.js';
import logger from '../logger';

export interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeout: number; // milliseconds
  connectionTimeout: number;
  maxRetries: number;
}

/**
 * RPC Connection Pool Manager
 */
export class RPCConnectionPool {
  private connections: Connection[] = [];
  private availableConnections: Connection[] = [];
  private inUseConnections: Set<Connection> = new Set();
  private config: PoolConfig;
  private rpcUrl: string;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    rpcUrl: string,
    config: Partial<PoolConfig> = {}
  ) {
    this.rpcUrl = rpcUrl;
    this.config = {
      maxConnections: config.maxConnections || 10,
      minConnections: config.minConnections || 2,
      idleTimeout: config.idleTimeout || 60000,
      connectionTimeout: config.connectionTimeout || 10000,
      maxRetries: config.maxRetries || 3,
    };

    logger.info(`RPC Connection Pool initialized: ${this.rpcUrl}`);
  }

  /**
   * Initialize minimum connections
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      logger.info(`Initializing ${this.config.minConnections} RPC connections...`);
      
      for (let i = 0; i < this.config.minConnections; i++) {
        const connection = await this.createConnection();
        this.connections.push(connection);
        this.availableConnections.push(connection);
      }

      logger.info(`✅ RPC Connection Pool ready with ${this.connections.length} connections`);
    })();

    return this.initializationPromise;
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<Connection> {
    return new Connection(this.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: this.config.connectionTimeout,
    });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<Connection> {
    await this.initialize();

    // Try to get an available connection
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.pop()!;
      this.inUseConnections.add(connection);
      return connection;
    }

    // Create new connection if under max limit
    if (this.connections.length < this.config.maxConnections) {
      const connection = await this.createConnection();
      this.connections.push(connection);
      this.inUseConnections.add(connection);
      logger.debug(`Created new RPC connection (${this.connections.length}/${this.config.maxConnections})`);
      return connection;
    }

    // Wait for a connection to become available
    return await this.waitForConnection();
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: Connection): void {
    if (!this.inUseConnections.has(connection)) {
      logger.warn('Attempting to release unknown connection');
      return;
    }

    this.inUseConnections.delete(connection);
    this.availableConnections.push(connection);
  }

  /**
   * Wait for a connection to become available
   */
  private async waitForConnection(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, this.config.connectionTimeout);

      const checkInterval = setInterval(() => {
        if (this.availableConnections.length > 0) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          const connection = this.availableConnections.pop()!;
          this.inUseConnections.add(connection);
          resolve(connection);
        }
      }, 100);
    });
  }

  /**
   * Execute function with a pooled connection
   */
  async execute<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    const connection = await this.acquire();
    
    try {
      return await fn(connection);
    } finally {
      this.release(connection);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    available: number;
    inUse: number;
    maxConnections: number;
  } {
    return {
      total: this.connections.length,
      available: this.availableConnections.length,
      inUse: this.inUseConnections.size,
      maxConnections: this.config.maxConnections,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    logger.info('Closing RPC connection pool...');
    
    // Wait for all in-use connections to be released
    while (this.inUseConnections.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.connections = [];
    this.availableConnections = [];
    
    logger.info('✅ RPC Connection Pool closed');
  }
}

/**
 * Database Connection Pool Configuration
 */
export function getDatabasePoolConfig() {
  return {
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    },
  };
}

// Singleton instances
let rpcPoolInstance: RPCConnectionPool | null = null;

/**
 * Get RPC connection pool instance
 */
export function getRPCPool(): RPCConnectionPool {
  if (!rpcPoolInstance) {
    const rpcUrl = process.env.X1_RPC_URL || 'https://rpc.mainnet.x1.xyz';
    rpcPoolInstance = new RPCConnectionPool(rpcUrl);
  }
  return rpcPoolInstance;
}

/**
 * Initialize RPC connection pool
 */
export async function initRPCPool(): Promise<RPCConnectionPool> {
  const pool = getRPCPool();
  await pool.initialize();
  return pool;
}

export default getRPCPool;

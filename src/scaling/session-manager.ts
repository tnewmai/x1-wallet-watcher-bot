/**
 * Session Manager for Horizontal Scaling
 * Manages user sessions across multiple bot instances
 */

import { getRedisCache } from '../cache/redis-cache';
import logger from '../logger';

export interface UserSession {
  userId: number;
  data: any;
  lastActivity: number;
  instanceId: string;
}

/**
 * Session Manager using Redis for distributed state
 */
export class SessionManager {
  private cache = getRedisCache();
  private readonly sessionTTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly instanceId: string;

  constructor() {
    this.instanceId = process.env.INSTANCE_ID || `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`Session Manager initialized for instance: ${this.instanceId}`);
  }

  /**
   * Get session key
   */
  private getSessionKey(userId: number): string {
    return `session:${userId}`;
  }

  /**
   * Get or create session
   */
  async getSession(userId: number): Promise<UserSession | null> {
    try {
      const session = await this.cache.get<UserSession>(
        this.getSessionKey(userId),
        { ttl: this.sessionTTL }
      );

      if (session) {
        // Update last activity
        session.lastActivity = Date.now();
        await this.setSession(userId, session.data);
      }

      return session;
    } catch (error) {
      logger.error(`Error getting session for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Set session data
   */
  async setSession(userId: number, data: any): Promise<boolean> {
    try {
      const session: UserSession = {
        userId,
        data,
        lastActivity: Date.now(),
        instanceId: this.instanceId,
      };

      return await this.cache.set(
        this.getSessionKey(userId),
        session,
        { ttl: this.sessionTTL }
      );
    } catch (error) {
      logger.error(`Error setting session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Update session data
   */
  async updateSession(userId: number, updates: Partial<any>): Promise<boolean> {
    try {
      const session = await this.getSession(userId);
      if (!session) {
        return await this.setSession(userId, updates);
      }

      const updatedData = { ...session.data, ...updates };
      return await this.setSession(userId, updatedData);
    } catch (error) {
      logger.error(`Error updating session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(userId: number): Promise<boolean> {
    try {
      return await this.cache.delete(this.getSessionKey(userId));
    } catch (error) {
      logger.error(`Error deleting session for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if session exists
   */
  async hasSession(userId: number): Promise<boolean> {
    return await this.cache.exists(this.getSessionKey(userId));
  }

  /**
   * Get instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Register instance heartbeat
   */
  async registerHeartbeat(): Promise<void> {
    try {
      await this.cache.set(
        `instance:${this.instanceId}`,
        {
          instanceId: this.instanceId,
          timestamp: Date.now(),
          pid: process.pid,
        },
        { ttl: 60000 } // 1 minute TTL
      );
    } catch (error) {
      logger.error('Error registering instance heartbeat:', error);
    }
  }

  /**
   * Get active instances
   */
  async getActiveInstances(): Promise<string[]> {
    try {
      // This would scan for all instance:* keys
      // Simplified version for now
      return [this.instanceId];
    } catch (error) {
      logger.error('Error getting active instances:', error);
      return [];
    }
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat(): NodeJS.Timeout {
    const interval = setInterval(() => {
      this.registerHeartbeat();
    }, 30000); // Every 30 seconds

    logger.info('Instance heartbeat started');
    return interval;
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

/**
 * Get session manager instance
 */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}

export default getSessionManager;

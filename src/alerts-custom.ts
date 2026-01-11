/**
 * Custom Alert System
 * Advanced alert filtering and conditions
 */

import { WatchedWallet } from './types';
import logger from './logger';

export interface AlertCondition {
  id: string;
  type: 'balance' | 'transaction' | 'value' | 'token' | 'address';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains';
  value: string | number;
  enabled: boolean;
}

export interface CustomAlert {
  id: string;
  walletAddress: string;
  name: string;
  description?: string;
  conditions: AlertCondition[];
  enabled: boolean;
  cooldown?: number; // Minutes between alerts
  lastTriggered?: number;
  priority: 'low' | 'medium' | 'high';
  notifyMethod: 'telegram' | 'email' | 'both';
}

export interface QuietHours {
  enabled: boolean;
  startHour: number; // 0-23
  endHour: number; // 0-23
  timezone: string;
  allowCritical: boolean; // Allow critical alerts during quiet hours
}

/**
 * Alert Manager
 */
export class AlertManager {
  private customAlerts: Map<string, CustomAlert>;
  private quietHours: Map<number, QuietHours>; // userId -> QuietHours

  constructor() {
    this.customAlerts = new Map();
    this.quietHours = new Map();
  }

  /**
   * Create custom alert
   */
  createAlert(userId: number, alert: CustomAlert): string {
    const alertId = `${userId}_${Date.now()}`;
    alert.id = alertId;
    
    this.customAlerts.set(alertId, alert);
    logger.info(`Created custom alert ${alertId} for user ${userId}`);
    
    return alertId;
  }

  /**
   * Update custom alert
   */
  updateAlert(alertId: string, updates: Partial<CustomAlert>): boolean {
    const alert = this.customAlerts.get(alertId);
    if (!alert) return false;

    Object.assign(alert, updates);
    logger.info(`Updated custom alert ${alertId}`);
    
    return true;
  }

  /**
   * Delete custom alert
   */
  deleteAlert(alertId: string): boolean {
    const deleted = this.customAlerts.delete(alertId);
    if (deleted) {
      logger.info(`Deleted custom alert ${alertId}`);
    }
    return deleted;
  }

  /**
   * Get user's custom alerts
   */
  getUserAlerts(userId: number): CustomAlert[] {
    return Array.from(this.customAlerts.values())
      .filter(alert => alert.id.startsWith(`${userId}_`));
  }

  /**
   * Check if alert conditions are met
   */
  checkAlertConditions(alert: CustomAlert, transaction: any): boolean {
    if (!alert.enabled) return false;

    // Check cooldown
    if (alert.cooldown && alert.lastTriggered) {
      const cooldownMs = alert.cooldown * 60 * 1000;
      const timeSinceLastTrigger = Date.now() - alert.lastTriggered;
      
      if (timeSinceLastTrigger < cooldownMs) {
        return false; // Still in cooldown
      }
    }

    // Check all conditions
    for (const condition of alert.conditions) {
      if (!condition.enabled) continue;

      if (!this.evaluateCondition(condition, transaction)) {
        return false; // One condition failed
      }
    }

    return true; // All conditions passed
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: AlertCondition, transaction: any): boolean {
    const { type, operator, value } = condition;

    switch (type) {
      case 'balance':
        return this.compareValues(transaction.balance, operator, value);
      
      case 'transaction':
        return this.compareValues(transaction.amount, operator, value);
      
      case 'value':
        return this.compareValues(transaction.valueUSD, operator, value);
      
      case 'token':
        if (operator === 'contains') {
          return transaction.token?.toLowerCase().includes(String(value).toLowerCase());
        } else if (operator === 'not_contains') {
          return !transaction.token?.toLowerCase().includes(String(value).toLowerCase());
        } else if (operator === 'eq') {
          return transaction.token?.toLowerCase() === String(value).toLowerCase();
        }
        return false;
      
      case 'address':
        if (operator === 'contains') {
          return transaction.from?.includes(String(value)) || 
                 transaction.to?.includes(String(value));
        } else if (operator === 'eq') {
          return transaction.from === value || transaction.to === value;
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    actual: any, 
    operator: AlertCondition['operator'], 
    expected: string | number
  ): boolean {
    const actualNum = typeof actual === 'string' ? parseFloat(actual) : Number(actual);
    const expectedNum = typeof expected === 'string' ? parseFloat(expected) : Number(expected);

    switch (operator) {
      case 'gt':
        return actualNum > expectedNum;
      case 'lt':
        return actualNum < expectedNum;
      case 'eq':
        return actualNum === expectedNum;
      case 'gte':
        return actualNum >= expectedNum;
      case 'lte':
        return actualNum <= expectedNum;
      default:
        return false;
    }
  }

  /**
   * Mark alert as triggered
   */
  markAlertTriggered(alertId: string): void {
    const alert = this.customAlerts.get(alertId);
    if (alert) {
      alert.lastTriggered = Date.now();
    }
  }

  /**
   * Set quiet hours for user
   */
  setQuietHours(userId: number, quietHours: QuietHours): void {
    this.quietHours.set(userId, quietHours);
    logger.info(`Set quiet hours for user ${userId}: ${quietHours.startHour}-${quietHours.endHour}`);
  }

  /**
   * Get quiet hours for user
   */
  getQuietHours(userId: number): QuietHours | null {
    return this.quietHours.get(userId) || null;
  }

  /**
   * Check if user is in quiet hours
   */
  isInQuietHours(userId: number): boolean {
    const quietHours = this.quietHours.get(userId);
    if (!quietHours || !quietHours.enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();

    // Simple check (doesn't account for timezone yet)
    if (quietHours.startHour <= quietHours.endHour) {
      // Normal range (e.g., 10:00 - 22:00)
      return currentHour >= quietHours.startHour && currentHour < quietHours.endHour;
    } else {
      // Overnight range (e.g., 22:00 - 08:00 next day)
      return currentHour >= quietHours.startHour || currentHour < quietHours.endHour;
    }
  }

  /**
   * Should send alert (considering quiet hours and priority)
   */
  shouldSendAlert(userId: number, priority: 'low' | 'medium' | 'high' | 'critical'): boolean {
    const inQuietHours = this.isInQuietHours(userId);
    
    if (!inQuietHours) return true;

    const quietHours = this.quietHours.get(userId);
    if (!quietHours) return true;

    // Allow critical alerts during quiet hours if configured
    if (priority === 'critical' && quietHours.allowCritical) {
      return true;
    }

    return false; // In quiet hours, don't send non-critical alerts
  }

  /**
   * Get alert summary for user
   */
  getAlertSummary(userId: number): string {
    const alerts = this.getUserAlerts(userId);
    const enabled = alerts.filter(a => a.enabled).length;
    const quietHours = this.quietHours.get(userId);

    let summary = `📊 Alert Summary\n\n`;
    summary += `Custom Alerts: ${alerts.length} (${enabled} enabled)\n`;
    
    if (quietHours && quietHours.enabled) {
      summary += `Quiet Hours: ${quietHours.startHour}:00 - ${quietHours.endHour}:00\n`;
    } else {
      summary += `Quiet Hours: Disabled\n`;
    }

    return summary;
  }
}

// Singleton instance
let alertManagerInstance: AlertManager | null = null;

/**
 * Get alert manager instance
 */
export function getAlertManager(): AlertManager {
  if (!alertManagerInstance) {
    alertManagerInstance = new AlertManager();
  }
  return alertManagerInstance;
}

export default getAlertManager;

// Advanced alerting system: Price alerts, whale alerts, volume spikes
import { WatchedWallet, UserData } from './types';
import { getTokenPrice } from './prices';
import { getBalance } from './blockchain';
import { createLogger } from './logger';

const logger = createLogger('Alerts');

export type AlertType = 'price_above' | 'price_below' | 'whale_incoming' | 'whale_outgoing' | 'volume_spike';

export interface PriceAlert {
  id: string;
  type: 'price_above' | 'price_below';
  tokenSymbol: string; // 'XN' for native token, or token symbol
  targetPrice: number; // USD price
  currentPrice?: number;
  enabled: boolean;
  lastTriggered?: number; // Timestamp
  walletAddress?: string; // Optional: specific wallet
}

export interface WhaleAlert {
  id: string;
  type: 'whale_incoming' | 'whale_outgoing';
  walletAddress: string;
  minAmount: number; // Minimum XNT amount to trigger
  enabled: boolean;
  lastTriggered?: number;
}

export interface VolumeAlert {
  id: string;
  type: 'volume_spike';
  walletAddress: string;
  thresholdMultiplier: number; // e.g., 3x normal volume
  enabled: boolean;
  lastTriggered?: number;
}

export type Alert = PriceAlert | WhaleAlert | VolumeAlert;

export interface AlertSettings {
  priceAlerts: PriceAlert[];
  whaleAlerts: WhaleAlert[];
  volumeAlerts: VolumeAlert[];
  cooldownMinutes: number; // Minimum minutes between same alert triggers
}

// Default alert settings
export const defaultAlertSettings: AlertSettings = {
  priceAlerts: [],
  whaleAlerts: [],
  volumeAlerts: [],
  cooldownMinutes: 60, // 1 hour cooldown
};

/**
 * Check if an alert should be triggered based on cooldown
 */
export function shouldTriggerAlert(alert: Alert, cooldownMinutes: number): boolean {
  if (!alert.enabled) return false;
  if (!alert.lastTriggered) return true;
  
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const timeSinceLastTrigger = Date.now() - alert.lastTriggered;
  
  return timeSinceLastTrigger >= cooldownMs;
}

/**
 * Check price alerts
 */
export async function checkPriceAlerts(alerts: PriceAlert[]): Promise<PriceAlert[]> {
  const triggered: PriceAlert[] = [];
  
  for (const alert of alerts) {
    if (!alert.enabled) continue;
    
    try {
      const currentPrice = await getTokenPrice(alert.tokenSymbol);
      alert.currentPrice = currentPrice;
      
      let shouldTrigger = false;
      
      if (alert.type === 'price_above' && currentPrice >= alert.targetPrice) {
        shouldTrigger = true;
      } else if (alert.type === 'price_below' && currentPrice <= alert.targetPrice) {
        shouldTrigger = true;
      }
      
      if (shouldTrigger) {
        triggered.push(alert);
        alert.lastTriggered = Date.now();
      }
    } catch (error) {
      logger.warn(`Failed to check price alert for ${alert.tokenSymbol}`, { error });
    }
  }
  
  return triggered;
}

/**
 * Check if a transaction is a whale transaction
 */
export function isWhaleTransaction(
  amount: number,
  type: 'incoming' | 'outgoing',
  alerts: WhaleAlert[]
): WhaleAlert | null {
  for (const alert of alerts) {
    if (!alert.enabled) continue;
    
    if (
      (alert.type === 'whale_incoming' && type === 'incoming' && amount >= alert.minAmount) ||
      (alert.type === 'whale_outgoing' && type === 'outgoing' && amount >= alert.minAmount)
    ) {
      return alert;
    }
  }
  
  return null;
}

/**
 * Create a price alert
 */
export function createPriceAlert(
  type: 'price_above' | 'price_below',
  tokenSymbol: string,
  targetPrice: number,
  walletAddress?: string
): PriceAlert {
  return {
    id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    tokenSymbol,
    targetPrice,
    enabled: true,
    walletAddress,
  };
}

/**
 * Create a whale alert
 */
export function createWhaleAlert(
  type: 'whale_incoming' | 'whale_outgoing',
  walletAddress: string,
  minAmount: number
): WhaleAlert {
  return {
    id: `whale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    walletAddress,
    minAmount,
    enabled: true,
  };
}

/**
 * Format alert message
 */
export function formatAlertMessage(alert: Alert): string {
  if (alert.type === 'price_above' || alert.type === 'price_below') {
    const priceAlert = alert as PriceAlert;
    const emoji = alert.type === 'price_above' ? '🚀' : '📉';
    const direction = alert.type === 'price_above' ? 'above' : 'below';
    
    return (
      `${emoji} <b>Price Alert Triggered!</b>\n\n` +
      `💰 <b>Token:</b> ${priceAlert.tokenSymbol}\n` +
      `📊 <b>Current Price:</b> $${priceAlert.currentPrice?.toFixed(6) || 'N/A'}\n` +
      `🎯 <b>Target:</b> ${direction} $${priceAlert.targetPrice.toFixed(6)}\n`
    );
  } else if (alert.type === 'whale_incoming' || alert.type === 'whale_outgoing') {
    const whaleAlert = alert as WhaleAlert;
    const emoji = alert.type === 'whale_incoming' ? '🐋📥' : '🐋📤';
    const direction = alert.type === 'whale_incoming' ? 'Incoming' : 'Outgoing';
    
    return (
      `${emoji} <b>Whale Alert!</b>\n\n` +
      `📍 <b>Type:</b> ${direction}\n` +
      `💰 <b>Minimum:</b> ${whaleAlert.minAmount} XNT\n` +
      `📍 <b>Wallet:</b> <code>${whaleAlert.walletAddress.slice(0, 8)}...${whaleAlert.walletAddress.slice(-6)}</code>\n`
    );
  }
  
  return 'Alert triggered';
}

/**
 * Update alert status
 */
export function toggleAlert(alerts: Alert[], alertId: string, enabled?: boolean): boolean {
  const alert = alerts.find(a => a.id === alertId);
  if (!alert) return false;
  
  alert.enabled = enabled !== undefined ? enabled : !alert.enabled;
  return true;
}

/**
 * Remove an alert
 */
export function removeAlert(alerts: Alert[], alertId: string): boolean {
  const index = alerts.findIndex(a => a.id === alertId);
  if (index === -1) return false;
  
  alerts.splice(index, 1);
  return true;
}

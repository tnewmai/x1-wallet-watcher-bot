/**
 * Minimal Configuration Module
 */
import dotenv from 'dotenv';
import { BotConfig } from './types';

dotenv.config();

// Validate and export configuration
export const config: BotConfig = {
  botToken: process.env.BOT_TOKEN || '',
  x1RpcUrl: process.env.X1_RPC_URL || 'https://rpc.mainnet.x1.xyz',
  pollInterval: parseInt(process.env.POLL_INTERVAL || '15000', 10),
  explorerUrl: process.env.EXPLORER_URL || 'https://explorer.x1-mainnet.xen.network',
  maxWalletsPerUser: 10,
  logLevel: (process.env.LOG_LEVEL as any) || 'info',
  healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3000', 10),
};

// Validate required config
if (!config.botToken) {
  throw new Error('❌ BOT_TOKEN is required in .env file');
}

if (config.pollInterval < 5000) {
  console.warn('⚠️ POLL_INTERVAL too low, setting to 5000ms');
  config.pollInterval = 5000;
}

export const LAMPORTS_PER_XN = 1_000_000_000;
export const NATIVE_TOKEN = 'XN';

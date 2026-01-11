/**
 * X1 Wallet Watcher Bot - Cloudflare Workers Edition
 * 
 * This worker handles:
 * 1. Telegram webhook requests (bot commands)
 * 2. Scheduled wallet checks via Cron Triggers
 * 3. Data storage in Cloudflare Workers KV
 */

import { Bot, webhookCallback } from 'grammy';
import { CloudflareStorage } from './storage';
import { X1Blockchain } from './blockchain';
import { BotHandlers } from './handlers';
import { WalletWatcher } from './watcher';
import { Env } from './types';

export default {
  /**
   * Fetch handler - processes HTTP requests
   * This handles Telegram webhook updates
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle different routes first (before expensive initialization)
      const url = new URL(request.url);
      
      // Health check endpoint - minimal dependencies
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: Date.now(),
          environment: env.ENVIRONMENT || 'unknown',
          hasToken: !!env.BOT_TOKEN,
          hasKV: !!env.BOT_DATA
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Validate environment variables for other endpoints
      if (!env.BOT_TOKEN) {
        return new Response(JSON.stringify({
          error: 'BOT_TOKEN not configured',
          endpoint: url.pathname
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!env.BOT_DATA) {
        return new Response(JSON.stringify({
          error: 'BOT_DATA KV namespace not bound',
          endpoint: url.pathname
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Stats endpoint - lightweight, no bot initialization
      if (url.pathname === '/stats') {
        try {
          const storage = new CloudflareStorage(env.BOT_DATA);
          const stats = await storage.getStats();
          const watcherState = await storage.getWatcherState();
          
          return new Response(JSON.stringify({
            ...stats,
            watcher: watcherState,
            timestamp: Date.now()
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({
            error: 'Failed to get stats',
            message: error.message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      
      // Debug endpoint - test bot initialization and get webhook info
      if (url.pathname === '/debug') {
        try {
          const rpcUrl = env.X1_RPC_URL || 'https://x1-mainnet.infrafc.org';
          const bot = new Bot(env.BOT_TOKEN);
          const storage = new CloudflareStorage(env.BOT_DATA);
          const blockchain = new X1Blockchain(rpcUrl);
          
          // Try to get bot info
          const botInfo = await bot.api.getMe();
          
          // Get webhook info
          const webhookInfo = await bot.api.getWebhookInfo();
          
          return new Response(JSON.stringify({
            success: true,
            bot: {
              username: botInfo.username,
              id: botInfo.id,
              first_name: botInfo.first_name
            },
            webhook: {
              url: webhookInfo.url,
              has_custom_certificate: webhookInfo.has_custom_certificate,
              pending_update_count: webhookInfo.pending_update_count,
              last_error_date: webhookInfo.last_error_date,
              last_error_message: webhookInfo.last_error_message,
              max_connections: webhookInfo.max_connections,
              allowed_updates: webhookInfo.allowed_updates
            },
            message: 'Bot initialized successfully!',
            rpcUrl: rpcUrl
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (debugError: any) {
          return new Response(JSON.stringify({
            success: false,
            error: debugError.message,
            stack: debugError.stack,
            name: debugError.name
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      const rpcUrl = env.X1_RPC_URL || 'https://x1-mainnet.infrafc.org';
      
      // Initialize bot with error handling
      let bot: Bot;
      let storage: CloudflareStorage;
      let blockchain: X1Blockchain;
      
      try {
        bot = new Bot(env.BOT_TOKEN);
        storage = new CloudflareStorage(env.BOT_DATA);
        blockchain = new X1Blockchain(rpcUrl);
        
        // Set up handlers
        new BotHandlers(bot, storage, blockchain);
      } catch (initError: any) {
        console.error('Initialization error:', initError);
        return new Response(JSON.stringify({
          error: 'Failed to initialize bot',
          message: initError.message,
          stack: initError.stack,
          endpoint: url.pathname
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Webhook setup endpoint (call this once to set up webhook)
      if (url.pathname === '/setup' && request.method === 'POST') {
        const webhookUrl = `${url.origin}/webhook`;
        const webhookOptions: any = {
          drop_pending_updates: true,
          allowed_updates: ['message', 'callback_query']
        };
        
        // Include secret token if configured
        if (env.WEBHOOK_SECRET) {
          webhookOptions.secret_token = env.WEBHOOK_SECRET;
        }
        
        await bot.api.setWebhook(webhookUrl, webhookOptions);
        
        return new Response(JSON.stringify({
          success: true,
          webhook: webhookUrl,
          message: 'Webhook set successfully',
          hasSecret: !!env.WEBHOOK_SECRET
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Main webhook endpoint - handle both root and /webhook for Telegram updates
      // Telegram sends updates to whatever URL is configured, we'll accept both
      const isWebhookRequest = request.method === 'POST' && (url.pathname === '/' || url.pathname === '/webhook');
      
      if (isWebhookRequest) {
        // Initialize bot and handlers
        const rpcUrl = env.X1_RPC_URL || 'https://x1-mainnet.infrafc.org';
        const bot = new Bot(env.BOT_TOKEN);
        const storage = new CloudflareStorage(env.BOT_DATA);
        const blockchain = new X1Blockchain(rpcUrl);
        
        // Register handlers
        new BotHandlers(bot, storage, blockchain);
        
        // Verify webhook secret if configured (optional security measure)
        if (env.WEBHOOK_SECRET && env.WEBHOOK_SECRET.length > 0) {
          const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
          if (secret !== env.WEBHOOK_SECRET) {
            console.log('Webhook secret mismatch - Expected:', env.WEBHOOK_SECRET, 'Got:', secret);
            return new Response(JSON.stringify({
              error: 'Unauthorized',
              message: 'Invalid webhook secret'
            }), { 
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // Handle Telegram update using grammy's webhook adapter
        try {
          console.log('📨 Processing webhook update from Telegram');
          const callback = webhookCallback(bot, 'cloudflare-mod');
          return await callback(request);
        } catch (webhookError: any) {
          console.error('Webhook processing error:', webhookError);
          return new Response(JSON.stringify({
            error: 'Webhook processing failed',
            message: webhookError.message
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Info endpoint for GET requests to root
      if (url.pathname === '/' && request.method === 'GET') {
        return new Response(JSON.stringify({
          name: 'X1 Wallet Watcher Bot',
          platform: 'Cloudflare Workers',
          version: '2.0.0',
          status: 'running',
          endpoints: {
            health: '/health',
            stats: '/stats',
            webhook: '/ (POST)',
            debug: '/debug'
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Unknown endpoint
      return new Response(JSON.stringify({
        error: 'Unknown endpoint',
        path: url.pathname,
        availableEndpoints: {
          health: '/health',
          stats: '/stats',
          webhook: '/webhook',
          setup: '/setup (POST)',
          root: '/'
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error: any) {
      console.error('Error in fetch handler:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Scheduled handler - runs on Cron Triggers
   * Checks all wallets for new transactions and balance changes
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('⏰ Cron trigger fired:', new Date(event.scheduledTime).toISOString());
    
    try {
      // Validate environment variables
      if (!env.BOT_TOKEN) {
        console.error('BOT_TOKEN not configured');
        return;
      }
      
      const rpcUrl = env.X1_RPC_URL || 'https://x1-mainnet.infrafc.org';
      
      // Initialize bot, storage, and blockchain
      const bot = new Bot(env.BOT_TOKEN);
      const storage = new CloudflareStorage(env.BOT_DATA);
      const blockchain = new X1Blockchain(rpcUrl);
      
      // Create watcher and check wallets
      const watcher = new WalletWatcher(storage, blockchain, bot);
      
      // Use waitUntil to ensure the check completes even after response
      ctx.waitUntil(watcher.checkAllWallets());
      
      console.log('✅ Wallet check initiated');
    } catch (error) {
      console.error('Error in scheduled handler:', error);
      throw error;
    }
  }
};

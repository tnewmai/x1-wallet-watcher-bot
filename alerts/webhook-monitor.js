/**
 * Simple Webhook-based Health Monitor
 * 
 * Monitors the bot's health endpoint and sends alerts via webhook
 * Supports: Slack, Discord, generic webhooks
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  // Bot health endpoint
  healthUrl: process.env.HEALTH_URL || 'http://localhost:3000/health',
  
  // Check interval in milliseconds
  checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000, // 1 minute
  
  // Number of consecutive failures before alerting
  failureThreshold: parseInt(process.env.FAILURE_THRESHOLD) || 3,
  
  // Webhook URL (Slack, Discord, etc.)
  webhookUrl: process.env.WEBHOOK_URL,
  
  // Webhook type: 'slack', 'discord', or 'generic'
  webhookType: process.env.WEBHOOK_TYPE || 'slack',
};

// State tracking
let consecutiveFailures = 0;
let lastStatus = 'unknown';
let lastAlertTime = 0;
const ALERT_COOLDOWN = 300000; // 5 minutes

/**
 * Check bot health
 */
async function checkHealth() {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.healthUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.get(CONFIG.healthUrl, { timeout: 5000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve(health);
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Send alert via webhook
 */
async function sendAlert(alert) {
  if (!CONFIG.webhookUrl) {
    console.error('No webhook URL configured');
    return;
  }
  
  // Cooldown check
  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN && alert.level !== 'recovery') {
    console.log('Alert cooldown active, skipping...');
    return;
  }
  
  let payload;
  
  if (CONFIG.webhookType === 'slack') {
    payload = formatSlackMessage(alert);
  } else if (CONFIG.webhookType === 'discord') {
    payload = formatDiscordMessage(alert);
  } else {
    payload = formatGenericMessage(alert);
  }
  
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.webhookUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };
    
    const req = client.request(options, (res) => {
      console.log(`Alert sent (HTTP ${res.statusCode})`);
      lastAlertTime = now;
      resolve();
    });
    
    req.on('error', (error) => {
      console.error('Failed to send alert:', error.message);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Format Slack message
 */
function formatSlackMessage(alert) {
  const emoji = {
    critical: ':red_circle:',
    warning: ':warning:',
    recovery: ':white_check_mark:',
  }[alert.level] || ':information_source:';
  
  const color = {
    critical: '#FF0000',
    warning: '#FF9900',
    recovery: '#36a64f',
  }[alert.level] || '#808080';
  
  return {
    attachments: [{
      color,
      title: `${emoji} X1 Wallet Watcher Bot Alert`,
      text: alert.message,
      fields: [
        {
          title: 'Level',
          value: alert.level.toUpperCase(),
          short: true,
        },
        {
          title: 'Time',
          value: new Date().toISOString(),
          short: true,
        },
        {
          title: 'Consecutive Failures',
          value: consecutiveFailures.toString(),
          short: true,
        },
      ],
      footer: 'X1 Bot Monitor',
      ts: Math.floor(Date.now() / 1000),
    }],
  };
}

/**
 * Format Discord message
 */
function formatDiscordMessage(alert) {
  const color = {
    critical: 0xFF0000,
    warning: 0xFF9900,
    recovery: 0x36a64f,
  }[alert.level] || 0x808080;
  
  return {
    embeds: [{
      title: '🤖 X1 Wallet Watcher Bot Alert',
      description: alert.message,
      color,
      fields: [
        {
          name: 'Level',
          value: alert.level.toUpperCase(),
          inline: true,
        },
        {
          name: 'Time',
          value: new Date().toISOString(),
          inline: true,
        },
        {
          name: 'Consecutive Failures',
          value: consecutiveFailures.toString(),
          inline: true,
        },
      ],
      footer: {
        text: 'X1 Bot Monitor',
      },
      timestamp: new Date().toISOString(),
    }],
  };
}

/**
 * Format generic message
 */
function formatGenericMessage(alert) {
  return {
    level: alert.level,
    message: alert.message,
    timestamp: new Date().toISOString(),
    consecutiveFailures,
    bot: 'X1 Wallet Watcher Bot',
  };
}

/**
 * Main monitoring loop
 */
async function monitor() {
  try {
    const health = await checkHealth();
    
    // Check status
    if (health.status === 'healthy') {
      // Bot recovered
      if (lastStatus !== 'healthy' && consecutiveFailures > 0) {
        console.log('✅ Bot has recovered');
        await sendAlert({
          level: 'recovery',
          message: `Bot has recovered after ${consecutiveFailures} consecutive failures`,
        });
      }
      
      consecutiveFailures = 0;
      lastStatus = 'healthy';
      console.log(`✅ Health check passed: ${JSON.stringify(health.checks)}`);
      
    } else {
      // Bot degraded
      consecutiveFailures++;
      
      console.log(`⚠️  Health check warning: status=${health.status}, failures=${consecutiveFailures}`);
      
      if (consecutiveFailures >= CONFIG.failureThreshold) {
        await sendAlert({
          level: 'warning',
          message: `Bot health is degraded: ${health.status}\nRPC: ${health.checks.rpc.status}, Memory: ${health.checks.memory.status}`,
        });
      }
      
      lastStatus = health.status;
    }
    
  } catch (error) {
    // Bot unreachable
    consecutiveFailures++;
    
    console.error(`❌ Health check failed: ${error.message} (failures: ${consecutiveFailures})`);
    
    if (consecutiveFailures >= CONFIG.failureThreshold) {
      await sendAlert({
        level: 'critical',
        message: `Bot is unreachable!\nError: ${error.message}\nConsecutive failures: ${consecutiveFailures}`,
      });
    }
    
    lastStatus = 'error';
  }
}

/**
 * Start monitoring
 */
function start() {
  console.log('========================================');
  console.log('  X1 Wallet Bot Health Monitor');
  console.log('========================================');
  console.log(`Health URL: ${CONFIG.healthUrl}`);
  console.log(`Check Interval: ${CONFIG.checkInterval / 1000}s`);
  console.log(`Failure Threshold: ${CONFIG.failureThreshold}`);
  console.log(`Webhook Type: ${CONFIG.webhookType}`);
  console.log(`Webhook Configured: ${!!CONFIG.webhookUrl}`);
  console.log('========================================\n');
  
  if (!CONFIG.webhookUrl) {
    console.warn('⚠️  No webhook URL configured. Alerts will only be logged to console.');
    console.warn('   Set WEBHOOK_URL environment variable to enable alerts.\n');
  }
  
  // Initial check
  monitor();
  
  // Start interval
  setInterval(monitor, CONFIG.checkInterval);
  
  console.log('Monitor started. Press Ctrl+C to stop.\n');
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nMonitor stopped.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nMonitor stopped.');
  process.exit(0);
});

// Start
start();

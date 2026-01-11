/**
 * Simple Telegram Alert Monitor
 * 
 * Watches the bot and sends YOU a Telegram message if it crashes
 */

const https = require('https');
const http = require('http');

// ===== CONFIGURATION =====
// You need to fill these in (I'll show you how below)
const TELEGRAM_BOT_TOKEN = process.env.ALERT_BOT_TOKEN || '8565791243:AAFDUKEkAS-LhOTAy1Lgt4UCrs3rx2bBcw4';
const YOUR_TELEGRAM_ID = process.env.YOUR_TELEGRAM_ID || '468177122';

// How often to check (in seconds)
const CHECK_INTERVAL_SECONDS = 60; // Check every minute

// ========================

let consecutiveFailures = 0;
let lastStatus = 'unknown';
let botWasHealthy = false;

/**
 * Check if bot is healthy
 */
async function checkBotHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/health', { timeout: 5000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve(health);
        } catch (error) {
          reject(new Error('Invalid response'));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

/**
 * Send message to YOUR Telegram
 */
async function sendTelegramMessage(message) {
  // Check if configured
  if (TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' || YOUR_TELEGRAM_ID === 'YOUR_TELEGRAM_ID_HERE') {
    console.log('⚠️  Telegram not configured yet!');
    console.log('   Please follow the setup instructions.');
    return;
  }

  const text = encodeURIComponent(message);
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${YOUR_TELEGRAM_ID}&text=${text}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Alert sent to your Telegram!');
        resolve();
      } else {
        console.error('❌ Failed to send Telegram message');
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    }).on('error', (error) => {
      console.error('❌ Error sending message:', error.message);
      reject(error);
    });
  });
}

/**
 * Main monitoring loop
 */
async function monitor() {
  const now = new Date().toLocaleString();
  
  try {
    const health = await checkBotHealth();
    
    if (health.status === 'healthy' || health.status === 'degraded') {
      // Bot is working
      consecutiveFailures = 0;
      
      // Send recovery message if bot was down
      if (lastStatus === 'error' && botWasHealthy) {
        console.log('✅ Bot has recovered!');
        await sendTelegramMessage(
          '✅ GOOD NEWS!\n\n' +
          'Your X1 Wallet Bot has recovered and is working again!\n\n' +
          `Time: ${now}`
        );
      }
      
      lastStatus = 'healthy';
      botWasHealthy = true;
      console.log(`✅ [${now}] Bot is healthy`);
      
    } else {
      // Bot is having issues
      consecutiveFailures++;
      console.log(`⚠️  [${now}] Bot health: ${health.status} (failures: ${consecutiveFailures})`);
      
      // Alert after 3 failures (3 minutes of problems)
      if (consecutiveFailures === 3) {
        await sendTelegramMessage(
          '⚠️ WARNING!\n\n' +
          'Your X1 Wallet Bot is having problems!\n\n' +
          `Status: ${health.status}\n` +
          `Time: ${now}\n\n` +
          'It might need your attention.'
        );
      }
      
      lastStatus = 'degraded';
    }
    
  } catch (error) {
    // Bot is completely down
    consecutiveFailures++;
    console.error(`❌ [${now}] Bot is DOWN! ${error.message} (failures: ${consecutiveFailures})`);
    
    // Alert after 3 failures (3 minutes down)
    if (consecutiveFailures === 3 && botWasHealthy) {
      await sendTelegramMessage(
        '🚨 ALERT!\n\n' +
        'Your X1 Wallet Bot has STOPPED WORKING!\n\n' +
        `Error: ${error.message}\n` +
        `Time: ${now}\n\n` +
        'Please check on it!'
      );
    }
    
    lastStatus = 'error';
  }
}

/**
 * Start monitoring
 */
function start() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Telegram Alert Monitor Started!     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  
  // Check configuration
  if (TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' || YOUR_TELEGRAM_ID === 'YOUR_TELEGRAM_ID_HERE') {
    console.log('⚠️  NOT CONFIGURED YET!');
    console.log('');
    console.log('Please follow these steps:');
    console.log('');
    console.log('1. Open Telegram');
    console.log('2. Search for @BotFather');
    console.log('3. Send: /newbot');
    console.log('4. Follow instructions to create a SECOND bot (for alerts)');
    console.log('5. Copy the bot token');
    console.log('6. Search for @userinfobot');
    console.log('7. Send it any message');
    console.log('8. Copy your Telegram ID');
    console.log('');
    console.log('Then edit this file or use environment variables:');
    console.log('  ALERT_BOT_TOKEN=your_token');
    console.log('  YOUR_TELEGRAM_ID=your_id');
    console.log('');
    console.log('Press Ctrl+C to stop this script.');
    console.log('');
  } else {
    console.log('✅ Configured and ready!');
    console.log(`   Checking bot every ${CHECK_INTERVAL_SECONDS} seconds`);
    console.log('   You will get alerts on Telegram if bot crashes');
    console.log('');
    console.log('Press Ctrl+C to stop monitoring.');
    console.log('');
  }
  
  // Test alert on startup
  if (TELEGRAM_BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE' && YOUR_TELEGRAM_ID !== 'YOUR_TELEGRAM_ID_HERE') {
    sendTelegramMessage(
      '🤖 Alert Monitor Started!\n\n' +
      'Your X1 Wallet Bot is now being monitored.\n' +
      'You will receive alerts if it stops working.\n\n' +
      `Started at: ${new Date().toLocaleString()}`
    ).catch(() => {
      console.log('⚠️  Could not send test message. Check your configuration.');
    });
  }
  
  // Start monitoring
  monitor();
  setInterval(monitor, CHECK_INTERVAL_SECONDS * 1000);
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\nMonitor stopped.');
  process.exit(0);
});

// Start!
start();

#!/usr/bin/env node

/**
 * Configuration Optimizer
 * 
 * Analyzes your bot usage and recommends optimal configuration settings
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('========================================');
  console.log('  X1 Bot Configuration Optimizer');
  console.log('========================================\n');
  
  // Gather information
  console.log('Please answer a few questions to optimize your configuration:\n');
  
  const userCount = parseInt(await question('How many users will use the bot? (estimate): '));
  const avgWalletsPerUser = parseInt(await question('Average wallets per user? (1-5): '));
  const notificationSpeed = await question('Notification speed preference? (fast/balanced/slow): ');
  const rpcIssues = (await question('Experiencing RPC rate limits? (yes/no): ')).toLowerCase() === 'yes';
  const resourceConstrained = (await question('Running on limited resources (low RAM/CPU)? (yes/no): ')).toLowerCase() === 'yes';
  
  console.log('\n========================================');
  console.log('  Analysis & Recommendations');
  console.log('========================================\n');
  
  // Calculate metrics
  const totalWallets = userCount * avgWalletsPerUser;
  
  // Determine recommendations
  let config = {
    POLL_INTERVAL: 15000,
    WATCHER_CONCURRENCY: 3,
    RPC_MAX_RETRIES: 3,
    RPC_RETRY_DELAY: 1000,
    CACHE_TTL_SHORT: 300,
    LOG_LEVEL: 'info',
    ENABLE_PERFORMANCE_METRICS: true,
  };
  
  let reasons = [];
  
  // Adjust based on user count
  if (userCount > 100 || totalWallets > 300) {
    config.WATCHER_CONCURRENCY = 5;
    config.CACHE_TTL_SHORT = 600;
    reasons.push('High user count detected - increased concurrency and cache duration');
  } else if (userCount < 10 || totalWallets < 30) {
    config.WATCHER_CONCURRENCY = 2;
    reasons.push('Low user count - reduced concurrency to save resources');
  }
  
  // Adjust based on notification speed preference
  if (notificationSpeed === 'fast') {
    config.POLL_INTERVAL = 10000;
    config.WATCHER_CONCURRENCY = Math.max(config.WATCHER_CONCURRENCY, 5);
    reasons.push('Fast notifications enabled - reduced poll interval');
  } else if (notificationSpeed === 'slow') {
    config.POLL_INTERVAL = 30000;
    config.WATCHER_CONCURRENCY = Math.min(config.WATCHER_CONCURRENCY, 2);
    reasons.push('Slower notifications - increased poll interval to reduce load');
  }
  
  // Adjust for RPC issues
  if (rpcIssues) {
    config.POLL_INTERVAL = Math.max(config.POLL_INTERVAL, 30000);
    config.WATCHER_CONCURRENCY = Math.min(config.WATCHER_CONCURRENCY, 2);
    config.RPC_RETRY_DELAY = 2000;
    config.RPC_MAX_RETRIES = 2;
    reasons.push('RPC rate limiting detected - conservative settings applied');
  }
  
  // Adjust for resource constraints
  if (resourceConstrained) {
    config.POLL_INTERVAL = Math.max(config.POLL_INTERVAL, 30000);
    config.WATCHER_CONCURRENCY = Math.min(config.WATCHER_CONCURRENCY, 2);
    config.CACHE_TTL_SHORT = 180;
    config.LOG_LEVEL = 'warn';
    config.ENABLE_PERFORMANCE_METRICS = false;
    reasons.push('Resource constraints detected - optimized for low resource usage');
  }
  
  // Display recommendations
  console.log('📊 Your Usage Profile:');
  console.log(`   Users: ${userCount}`);
  console.log(`   Total Wallets: ~${totalWallets}`);
  console.log(`   Speed Preference: ${notificationSpeed}`);
  console.log(`   RPC Issues: ${rpcIssues ? 'Yes' : 'No'}`);
  console.log(`   Resource Constrained: ${resourceConstrained ? 'Yes' : 'No'}`);
  console.log('');
  
  console.log('⚙️  Recommended Configuration:');
  console.log('');
  for (const [key, value] of Object.entries(config)) {
    const valueStr = typeof value === 'boolean' ? value.toString() : value;
    console.log(`   ${key}=${valueStr}`);
  }
  console.log('');
  
  console.log('💡 Reasoning:');
  reasons.forEach(reason => {
    console.log(`   • ${reason}`);
  });
  console.log('');
  
  // Performance estimate
  const checkTime = Math.ceil(totalWallets / config.WATCHER_CONCURRENCY) * 0.5; // ~0.5s per wallet check
  const cyclesPerMinute = 60000 / config.POLL_INTERVAL;
  
  console.log('📈 Performance Estimate:');
  console.log(`   Time to check all wallets: ~${checkTime.toFixed(1)}s`);
  console.log(`   Check cycles per minute: ~${cyclesPerMinute.toFixed(1)}`);
  
  if (checkTime > config.POLL_INTERVAL / 1000) {
    console.log(`   ⚠️  Warning: Wallet checks may take longer than poll interval!`);
    console.log(`       Consider increasing WATCHER_CONCURRENCY or POLL_INTERVAL`);
  } else {
    console.log(`   ✅ Configuration should handle load comfortably`);
  }
  console.log('');
  
  // Offer to save
  const save = (await question('Save configuration to .env.optimized? (yes/no): ')).toLowerCase() === 'yes';
  
  if (save) {
    const envContent = Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const header = `# Optimized Configuration
# Generated: ${new Date().toISOString()}
# Users: ${userCount}, Wallets: ~${totalWallets}
# Profile: ${notificationSpeed} notifications, ${rpcIssues ? 'RPC-limited' : 'normal RPC'}, ${resourceConstrained ? 'low-resource' : 'normal resources'}

# Core Settings (copy BOT_TOKEN from your .env)
BOT_TOKEN=your_bot_token_here

# Blockchain
X1_RPC_URL=https://rpc.mainnet.x1.xyz
EXPLORER_URL=https://explorer.x1-mainnet.xen.network

# Optimized Performance Settings
`;
    
    const fullContent = header + envContent + '\n\n# Other Settings\nDISABLE_AUTO_SECURITY_SCAN=true\nHEALTH_CHECK_ENABLED=true\nHEALTH_CHECK_PORT=3000\nENABLE_RPC_METRICS=true\n';
    
    fs.writeFileSync('.env.optimized', fullContent);
    console.log('\n✅ Configuration saved to .env.optimized');
    console.log('');
    console.log('To use this configuration:');
    console.log('   1. Review .env.optimized');
    console.log('   2. Copy your BOT_TOKEN from .env');
    console.log('   3. Backup your current .env: mv .env .env.backup');
    console.log('   4. Use optimized config: mv .env.optimized .env');
    console.log('   5. Restart the bot');
    console.log('');
  }
  
  console.log('========================================');
  console.log('  Optimization Complete!');
  console.log('========================================\n');
  
  rl.close();
}

main().catch(error => {
  console.error('Error:', error.message);
  rl.close();
  process.exit(1);
});

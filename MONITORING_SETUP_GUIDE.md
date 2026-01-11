# 🚨 Limit Monitoring & Alert System Setup Guide

This guide will help you set up comprehensive monitoring and alerting for resource limits in your X1 Wallet Watcher Bot.

## 📋 Overview

The monitoring system tracks and alerts on:
- **RPC Rate Limits** - Prevents hitting blockchain API limits
- **Memory Usage** - Monitors RAM consumption
- **CPU Usage** - Tracks processor load
- **Telegram Rate Limits** - Prevents bot API throttling
- **Storage Capacity** - Monitors database growth

## 🚀 Quick Setup

### 1. Configure Admin Users

Add your Telegram user ID to receive alerts:

```bash
# Edit .env file
ADMIN_USER_IDS=123456789,987654321
```

To find your Telegram user ID, message @userinfobot on Telegram.

### 2. Configure Resource Limits

Edit your `.env` file to set appropriate limits:

```bash
# RPC Settings
RPC_REQUESTS_PER_MINUTE=50
X1_RPC_URL=https://rpc.mainnet.x1.xyz

# Memory Settings (in MB)
MAX_MEMORY_MB=512

# CPU Settings (percentage)
MAX_CPU_PERCENT=80

# Telegram Settings
TELEGRAM_MESSAGES_PER_SECOND=20

# Storage Settings
MAX_STORAGE_RECORDS=10000

# Monitoring Settings
MONITORING_CHECK_INTERVAL=30
ALERT_COOLDOWN_MINUTES=15
```

### 3. Integrate with Bot

Add monitoring to your bot startup in `src/index.ts`:

```typescript
import { setupLimitMonitoring } from './limit-alerts';
import { getLimitMonitor } from './limit-monitor';

// After bot initialization
const adminUserIds = process.env.ADMIN_USER_IDS
  ?.split(',')
  .map(id => parseInt(id.trim())) || [];

const { limitMonitor, alertService } = await setupLimitMonitoring(
  bot, 
  adminUserIds
);

// Track RPC requests
import { connection } from './blockchain';
const originalGetBalance = connection.getBalance;
connection.getBalance = function(...args) {
  limitMonitor.trackRpcRequest();
  return originalGetBalance.apply(this, args);
};

// Track Telegram messages
bot.api.config.use((prev, method, payload, signal) => {
  if (method === 'sendMessage') {
    limitMonitor.trackTelegramMessage();
  }
  return prev(method, payload, signal);
});
```

## 📊 Available Commands

Once set up, admins can use these commands:

### Status Commands
- `/status` - Show current resource usage
- `/limits` - Show detailed limit information
- `/health` - Show overall system health

### Alert Commands
- `/alerts` - View alert management options
- `/alerts_enable` - Enable limit alerts
- `/alerts_disable` - Disable limit alerts
- `/alerts_test` - Send a test alert
- `/alerts_reset` - Reset alert tracking

## 🧪 Testing the System

Run the test script to verify monitoring works:

```bash
# Test all limits
npm run test:monitoring

# Test specific scenarios
npx ts-node test-monitoring.ts rpc      # Test RPC limits
npx ts-node test-monitoring.ts memory   # Test memory limits
npx ts-node test-monitoring.ts cpu      # Test CPU limits
npx ts-node test-monitoring.ts telegram # Test Telegram limits
npx ts-node test-monitoring.ts all      # Test everything
```

## 📈 Prometheus Integration

### Setup with Docker Compose

The bot includes Prometheus configuration. Start with:

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

This starts:
- **Prometheus** - Metrics collection (port 9090)
- **Alertmanager** - Alert routing (port 9093)
- **Grafana** - Visualization (port 3001)

### Access Dashboards

- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Grafana: http://localhost:3001 (admin/admin)

## ⚙️ Alert Thresholds

Default thresholds (customize in code):

| Resource | Warning | Critical |
|----------|---------|----------|
| Memory | 70% | 90% |
| CPU | 70% | 90% |
| RPC Rate | 70% | 90% |
| Telegram Rate | 70% | 90% |
| Storage | 80% | 95% |

## 🔔 Alert Types

### Warning Alerts (⚠️)
- Sent when usage reaches 70-89% of limit
- Notification without sound
- Cooldown: 15 minutes (configurable)

### Critical Alerts (🚨)
- Sent when usage reaches 90%+ of limit
- Notification with sound
- Cooldown: 15 minutes (configurable)

## 🛠️ Customization

### Adjust Thresholds

```typescript
import { getLimitMonitor } from './limit-monitor';

const monitor = getLimitMonitor({
  rpcRequestsPerMinute: 100,  // Increase if you have paid RPC
  maxMemoryMB: 1024,          // Increase for larger servers
  maxCpuPercent: 80,
  checkIntervalSeconds: 30,
  alertCooldownMinutes: 10,   // More frequent alerts
});
```

### Custom Alert Actions

```typescript
monitor.onAlert((limit, status) => {
  if (status.status === 'critical') {
    // Custom action: restart bot, scale up, etc.
    console.log(`CRITICAL: ${limit.name} at ${status.percentage}%`);
  }
});
```

## 📱 Telegram Alert Format

Alerts include:
- Current usage value
- Maximum limit
- Usage percentage
- Status level
- Actionable recommendations
- Timestamp

Example:
```
🚨 CRITICAL: Memory Usage

📊 Current Usage: 465.3 MB
📈 Limit: 512 MB
📉 Percentage: 90.8%

💡 Recommendations:
• Check for memory leaks
• Reduce cache sizes
• Restart the bot
• Upgrade server resources

🕐 2026-01-11 14:30:00
```

## 🔍 Troubleshooting

### Not Receiving Alerts?

1. Check admin user IDs are correct:
   ```bash
   echo $ADMIN_USER_IDS
   ```

2. Test alert system:
   ```
   /alerts_test
   ```

3. Check bot logs:
   ```bash
   tail -f logs/bot.log | grep -i alert
   ```

### False Positives?

Adjust thresholds higher:
```typescript
monitor.updateConfig({
  alertCooldownMinutes: 30,  // Less frequent
});
```

### Missing Metrics?

Ensure tracking is integrated:
```typescript
// Every RPC call should call:
limitMonitor.trackRpcRequest();

// Every Telegram message should call:
limitMonitor.trackTelegramMessage();
```

## 📊 Metrics Collected

The system tracks:
- `memory_used_mb` - Heap memory usage
- `memory_percent` - Memory usage percentage
- `cpu_percent` - CPU usage percentage
- `rpc_requests_per_minute` - RPC request rate
- `telegram_messages_per_second` - Message send rate
- `storage_records` - Total database records
- `limit_alert_warning` - Warning alert count
- `limit_alert_critical` - Critical alert count

## 🎯 Best Practices

1. **Set Conservative Limits** - Leave headroom for spikes
2. **Monitor Trends** - Watch for gradual increases
3. **Test Regularly** - Run test script monthly
4. **Review Alerts** - Adjust thresholds based on real usage
5. **Multiple Admins** - Add backup admin users
6. **Log Rotation** - Prevent log files from filling disk

## 🆘 Emergency Response

If you receive critical alerts:

### High Memory (>90%)
```bash
# Quick fix: restart bot
pm2 restart x1-wallet-bot

# Long-term: upgrade server or optimize code
```

### High RPC Rate (>90%)
```bash
# Increase poll interval
export POLL_INTERVAL=30000

# Reduce concurrency
export WATCHER_CONCURRENCY=2
```

### High CPU (>90%)
```bash
# Check for infinite loops
pm2 logs --lines 100

# Restart if stuck
pm2 restart x1-wallet-bot
```

## 📞 Support

For issues:
1. Check logs: `pm2 logs x1-wallet-bot`
2. Run diagnostics: `npm run test:monitoring`
3. Review Prometheus: http://localhost:9090

## 🔄 Updates

Keep monitoring system updated:
```bash
git pull origin main
npm install
pm2 restart x1-wallet-bot
```

---

**Last Updated:** 2026-01-11  
**Version:** 1.0.0

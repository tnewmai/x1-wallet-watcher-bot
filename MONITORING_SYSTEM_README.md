# 🚨 Monitoring & Alert System - Complete Implementation

## ✅ What's Been Set Up

Your X1 Wallet Watcher Bot now has a **comprehensive monitoring and alert system** that tracks resource limits and alerts you **before** you hit them!

### 📦 New Files Created

1. **Core Monitoring System**
   - `src/limit-monitor.ts` - Main monitoring engine
   - `src/limit-alerts.ts` - Telegram alert integration
   - `src/handlers/monitoring-handlers.ts` - Bot command handlers

2. **Configuration**
   - `.env.monitoring` - Example monitoring config
   - `monitoring/alert-rules.yml` - Prometheus alert rules

3. **Documentation**
   - `MONITORING_SETUP_GUIDE.md` - Complete setup guide
   - `QUICK_START_MONITORING.md` - 5-minute quick start

4. **Testing & Scripts**
   - `test-monitoring.ts` - Comprehensive test suite
   - `scripts/start-with-monitoring.sh` - Linux/Mac startup
   - `scripts/start-with-monitoring.ps1` - Windows startup

### 🎯 What Gets Monitored

✅ **RPC Rate Limits** (50 req/min default)
- Tracks blockchain API calls
- Alerts at 70% (35 req/min)
- Critical at 90% (45 req/min)

✅ **Memory Usage** (512 MB default)
- Monitors heap memory
- Alerts at 70% (358 MB)
- Critical at 90% (460 MB)

✅ **CPU Usage** (80% default)
- Tracks processor load
- Alerts at 70% (56%)
- Critical at 90% (72%)

✅ **Telegram Rate Limits** (20 msg/sec default)
- Prevents bot throttling
- Alerts at 70% (14 msg/sec)
- Critical at 90% (18 msg/sec)

✅ **Storage Capacity** (10,000 records default)
- Monitors database size
- Alerts at 80% (8,000 records)
- Critical at 95% (9,500 records)

## 🚀 Quick Start (5 Minutes)

### 1. Get Your Telegram ID
Message @userinfobot on Telegram to get your user ID.

### 2. Add to .env
```bash
# Add this line with YOUR user ID
ADMIN_USER_IDS=123456789
```

### 3. Start the Bot
```bash
npm run build
npm start
```

### 4. Test It!
Send `/alerts_test` to your bot - you should get an alert! 🎉

## 📱 Available Commands

Once running, send these to your bot:

| Command | Description |
|---------|-------------|
| `/status` | 📊 View current resource usage |
| `/limits` | 📋 Detailed limit information |
| `/health` | 🏥 Overall system health check |
| `/alerts` | 🔔 Alert management menu |
| `/alerts_test` | 🧪 Send test alert |
| `/alerts_enable` | ✅ Enable alerts |
| `/alerts_disable` | 🔕 Disable alerts |
| `/alerts_reset` | 🔄 Reset alert tracking |

## 🧪 Testing the System

Run comprehensive tests:

```bash
# Test all monitoring systems
npm run test:monitoring

# Test specific components
npm run test:monitoring:rpc      # RPC rate limits
npm run test:monitoring:memory   # Memory usage
npm run test:monitoring:cpu      # CPU usage
```

## 🔔 What Alerts Look Like

### Warning Alert (70% threshold)
```
⚠️ WARNING: Memory Usage

📊 Current Usage: 365.8 MB
📈 Limit: 512 MB
📉 Percentage: 71.4%

💡 Recommendations:
• Check for memory leaks
• Reduce cache sizes
• Monitor trends
• Consider optimization

🕐 2026-01-11 14:30:00
```

### Critical Alert (90% threshold)
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

## ⚙️ Customization

### Adjust Limits in .env

```bash
# Resource Limits
MAX_MEMORY_MB=1024              # Increase for larger servers
MAX_CPU_PERCENT=80              # CPU threshold
RPC_REQUESTS_PER_MINUTE=100     # Higher for paid RPC
TELEGRAM_MESSAGES_PER_SECOND=20
MAX_STORAGE_RECORDS=10000

# Alert Behavior
ALERT_COOLDOWN_MINUTES=15       # Time between same alerts
MONITORING_CHECK_INTERVAL=30    # Check frequency (seconds)

# Thresholds
ALERT_THRESHOLD_WARNING=70      # Warning at 70%
ALERT_THRESHOLD_CRITICAL=90     # Critical at 90%
```

### Advanced Configuration

Edit monitoring setup in `src/index.ts` or create custom configurations:

```typescript
import { getLimitMonitor } from './limit-monitor';

const monitor = getLimitMonitor({
  rpcRequestsPerMinute: 100,
  maxMemoryMB: 1024,
  checkIntervalSeconds: 30,
  alertCooldownMinutes: 10,
});
```

## 📊 Prometheus Integration (Optional)

For advanced metrics and dashboards:

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d
```

Access:
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Grafana**: http://localhost:3001 (admin/admin)

## 🔍 How It Works

1. **Continuous Monitoring** - Checks every 30 seconds (configurable)
2. **Smart Thresholds** - Warning at 70%, Critical at 90%
3. **Alert Cooldown** - Prevents spam (15 min default)
4. **Actionable Recommendations** - Each alert includes fix suggestions
5. **Telegram Integration** - Instant notifications to admins

## 🆘 Troubleshooting

### Not receiving alerts?

1. Check user ID:
   ```bash
   grep ADMIN_USER_IDS x1-wallet-watcher-bot/.env
   ```

2. Test system:
   ```
   /alerts_test
   ```

3. Check logs:
   ```bash
   pm2 logs x1-wallet-bot | grep -i alert
   ```

### False positives?

Increase thresholds:
```bash
ALERT_THRESHOLD_WARNING=80
ALERT_THRESHOLD_CRITICAL=95
```

### Want more frequent checks?

```bash
MONITORING_CHECK_INTERVAL=15  # Check every 15 seconds
```

## 📈 Metrics Collected

The system tracks and records:
- `memory_used_mb` - Heap memory in MB
- `memory_percent` - Memory usage percentage
- `cpu_percent` - CPU usage percentage
- `rpc_requests_per_minute` - RPC call rate
- `telegram_messages_per_second` - Message send rate
- `storage_records` - Database record count
- `limit_alert_warning` - Warning count
- `limit_alert_critical` - Critical alert count

## 🎯 Best Practices

1. ✅ **Set Conservative Limits** - Leave 20-30% headroom
2. ✅ **Test Regularly** - Run `npm run test:monitoring` monthly
3. ✅ **Monitor Trends** - Watch for gradual increases over time
4. ✅ **Act on Alerts** - Don't ignore warnings
5. ✅ **Multiple Admins** - Add backup contacts
6. ✅ **Review Logs** - Check for patterns when alerts fire

## 🔐 Security Notes

- Admin user IDs are only used for sending alerts
- No sensitive data is sent in alerts
- Alerts include only resource usage stats
- All monitoring data stays on your server

## 📚 Further Reading

- **Full Setup Guide**: `MONITORING_SETUP_GUIDE.md`
- **Quick Start**: `QUICK_START_MONITORING.md`
- **Prometheus Alerts**: `monitoring/alert-rules.yml`
- **Test Suite**: `test-monitoring.ts`

## 🔄 Updates & Maintenance

Keep the system updated:

```bash
git pull origin main
npm install
npm run build
pm2 restart x1-wallet-bot
```

## 💡 Pro Tips

1. **Start with defaults** - Adjust after observing real usage
2. **Enable digest mode** for less critical alerts
3. **Use quiet hours** to avoid nighttime alerts
4. **Set up Prometheus** for historical data
5. **Create alert runbooks** for your team

## 📞 Support

If you encounter issues:

1. Check logs: `pm2 logs x1-wallet-bot`
2. Run tests: `npm run test:monitoring`
3. Review config: `.env` and `.env.monitoring`
4. Check Prometheus: http://localhost:9090

---

## 🎉 You're All Set!

Your bot now has enterprise-grade monitoring! You'll be alerted **before** problems occur, with actionable recommendations to fix them.

**Next Steps:**
1. Run `/alerts_test` to verify it's working
2. Monitor for a day to see normal usage patterns
3. Adjust thresholds if needed
4. Set up Prometheus for long-term tracking

**Version:** 1.0.0  
**Last Updated:** 2026-01-11

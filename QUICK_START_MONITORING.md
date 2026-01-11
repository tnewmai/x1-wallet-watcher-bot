# ⚡ Quick Start: Monitoring & Alerts

Get monitoring and alerts running in **5 minutes**!

## 🎯 Prerequisites

- Bot already set up and running
- Your Telegram user ID (message @userinfobot to get it)

## 📝 Step 1: Add Your User ID (2 min)

Edit your `.env` file:

```bash
# Add this line with YOUR Telegram user ID
ADMIN_USER_IDS=123456789
```

**Multiple admins:** Separate with commas
```bash
ADMIN_USER_IDS=123456789,987654321
```

## 🚀 Step 2: Start the Bot (1 min)

### Option A: Simple Start
```bash
npm run build
npm start
```

### Option B: With PM2
```bash
npm run build
pm2 start ecosystem.config.js
```

### Option C: Use the monitoring script
```bash
chmod +x scripts/start-with-monitoring.sh
./scripts/start-with-monitoring.sh
```

## ✅ Step 3: Test It (2 min)

Send these commands to your bot:

1. **Test alerts are working:**
   ```
   /alerts_test
   ```
   You should receive a test alert immediately! 🧪

2. **Check current status:**
   ```
   /status
   ```
   Shows all resource usage 📊

3. **View overall health:**
   ```
   /health
   ```
   System health check 🏥

## 🎉 Done!

You'll now receive alerts when:
- ⚠️ **Warning** at 70% of any limit
- 🚨 **Critical** at 90% of any limit

## 📱 Available Commands

| Command | What It Does |
|---------|-------------|
| `/status` | Current resource usage |
| `/limits` | Detailed limit info |
| `/health` | Overall system health |
| `/alerts` | Alert management menu |
| `/alerts_test` | Send test alert |
| `/alerts_reset` | Reset alert tracking |

## 🔧 Customize Limits (Optional)

Add to your `.env`:

```bash
# Increase limits for bigger servers
MAX_MEMORY_MB=1024
MAX_CPU_PERCENT=80
RPC_REQUESTS_PER_MINUTE=100

# Alert behavior
ALERT_COOLDOWN_MINUTES=15
MONITORING_CHECK_INTERVAL=30
```

## 🧪 Test the Monitoring

Run stress tests:

```bash
# Test all limits
npm run test:monitoring

# Test specific limits
npm run test:monitoring:rpc
npm run test:monitoring:memory
npm run test:monitoring:cpu
```

## 🆘 Troubleshooting

### Not receiving alerts?

1. **Check your user ID is correct:**
   ```bash
   grep ADMIN_USER_IDS .env
   ```

2. **Test the alert system:**
   ```
   /alerts_test
   ```

3. **Check bot logs:**
   ```bash
   pm2 logs x1-wallet-bot
   # or
   tail -f logs/bot.log
   ```

### Alerts too frequent?

Increase cooldown period in `.env`:
```bash
ALERT_COOLDOWN_MINUTES=30
```

### Want to disable alerts temporarily?

Send to your bot:
```
/alerts_disable
```

Re-enable with:
```
/alerts_enable
```

## 📊 What Gets Monitored

✅ **RPC Rate Limits** - Prevents blockchain API throttling  
✅ **Memory Usage** - Alerts before running out of RAM  
✅ **CPU Usage** - Catches performance issues  
✅ **Telegram API Limits** - Prevents bot getting blocked  
✅ **Storage Capacity** - Warns before database fills up  

## 🔥 Example Alert

When limits are approached, you'll get:

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

## 🎓 Learn More

- [Full Monitoring Guide](MONITORING_SETUP_GUIDE.md)
- [Prometheus Setup](monitoring/README.md)
- [Troubleshooting](MONITORING_SETUP_GUIDE.md#troubleshooting)

---

**Need help?** Check the bot logs or review the full setup guide.

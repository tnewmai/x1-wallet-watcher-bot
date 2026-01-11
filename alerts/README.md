# Bot Monitoring & Alerts

Simple webhook-based monitoring for the X1 Wallet Watcher Bot.

## Quick Start

### 1. Setup Webhook

**For Slack:**
1. Go to https://api.slack.com/messaging/webhooks
2. Create a new webhook
3. Copy the webhook URL

**For Discord:**
1. Go to your Discord server settings
2. Integrations → Webhooks → New Webhook
3. Copy the webhook URL

### 2. Run Monitor

```bash
# With Slack
WEBHOOK_URL="https://hooks.slack.com/..." WEBHOOK_TYPE=slack node webhook-monitor.js

# With Discord
WEBHOOK_URL="https://discord.com/api/webhooks/..." WEBHOOK_TYPE=discord node webhook-monitor.js

# Without webhook (console only)
node webhook-monitor.js
```

### 3. Configuration

Set these environment variables:

```bash
HEALTH_URL=http://localhost:3000/health    # Bot health endpoint
CHECK_INTERVAL=60000                        # Check every 60 seconds
FAILURE_THRESHOLD=3                         # Alert after 3 failures
WEBHOOK_URL=your_webhook_url                # Slack/Discord webhook
WEBHOOK_TYPE=slack                          # or 'discord' or 'generic'
```

## Features

- ✅ Monitors bot health every minute
- ✅ Sends alerts on failures (with threshold)
- ✅ Sends recovery notifications
- ✅ 5-minute cooldown between alerts
- ✅ Supports Slack, Discord, and generic webhooks
- ✅ Tracks consecutive failures

## Alert Levels

- **🔴 Critical:** Bot is unreachable
- **🟡 Warning:** Bot health degraded
- **🟢 Recovery:** Bot has recovered

## Running as a Service

### Using PM2

```bash
cd alerts
pm2 start webhook-monitor.js --name bot-monitor
pm2 save
```

### Using systemd (Linux)

```ini
# /etc/systemd/system/x1-bot-monitor.service
[Unit]
Description=X1 Bot Health Monitor
After=network.target

[Service]
Type=simple
Environment="WEBHOOK_URL=your_webhook_url"
Environment="WEBHOOK_TYPE=slack"
WorkingDirectory=/path/to/x1-wallet-watcher-bot/alerts
ExecStart=/usr/bin/node webhook-monitor.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable x1-bot-monitor
sudo systemctl start x1-bot-monitor
```

## Testing

Test your webhook:

```bash
# Test Slack webhook
curl -X POST -H 'Content-Type: application/json' \
  -d '{"text":"Test alert from X1 Bot Monitor"}' \
  YOUR_SLACK_WEBHOOK_URL

# Test Discord webhook
curl -X POST -H 'Content-Type: application/json' \
  -d '{"content":"Test alert from X1 Bot Monitor"}' \
  YOUR_DISCORD_WEBHOOK_URL
```

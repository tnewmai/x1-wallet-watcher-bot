# 📊 Monitoring & Alerting Guide

Complete guide for monitoring the X1 Wallet Watcher Bot and setting up alerts.

---

## Built-in Health Endpoints

The bot exposes several HTTP endpoints for monitoring:

### Health Check (Detailed)
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-09T12:00:00.000Z",
  "uptime": 3600000,
  "checks": {
    "rpc": {
      "status": "ok",
      "latencyMs": 537
    },
    "storage": {
      "status": "ok"
    },
    "memory": {
      "status": "ok",
      "usedMB": 85,
      "percentUsed": 34
    },
    "bot": {
      "status": "ok"
    }
  },
  "version": "1.0.0",
  "environment": "production"
}
```

### Readiness Check
```bash
curl http://localhost:3000/ready
```
Returns HTTP 200 when bot is ready to serve traffic.

### Liveness Check
```bash
curl http://localhost:3000/live
```
Returns HTTP 200 when bot is alive (basic process check).

### Metrics Endpoint
```bash
curl http://localhost:3000/metrics
```
Returns Prometheus-format metrics.

---

## Quick Monitoring Scripts

### 1. Continuous Health Monitor (PowerShell)

Already created: `monitor_bot.ps1`

```bash
# Run it
.\monitor_bot.ps1
```

### 2. Watch Health Status (Linux/Mac)

```bash
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

### 3. Simple Uptime Monitor

```bash
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
  if [ "$STATUS" -eq 200 ]; then
    echo "$(date): ✅ Bot is healthy"
  else
    echo "$(date): ❌ Bot health check failed (HTTP $STATUS)"
  fi
  sleep 30
done
```

---

## Advanced Monitoring Setup

### Option 1: Uptime Monitoring with UptimeRobot

**Free tier includes:**
- 50 monitors
- 5-minute check intervals
- Email/SMS alerts
- Public status pages

**Setup:**
1. Go to https://uptimerobot.com
2. Create account
3. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: X1 Wallet Bot
   - URL: http://your-server:3000/health
   - Monitoring Interval: 5 minutes
4. Set up alert contacts (email, SMS, Slack, etc.)

### Option 2: Self-Hosted with Prometheus + Grafana

**Setup Prometheus:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'x1-wallet-bot'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

**Run Prometheus:**
```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

**Setup Grafana:**
```bash
docker run -d \
  --name grafana \
  -p 3001:3000 \
  grafana/grafana
```

Access Grafana at http://localhost:3001 (admin/admin)

### Option 3: Simple Webhook Alerting

See `alert-webhook.js` script below.

---

## Alert Configuration Examples

### 1. Email Alerts via SendGrid

```javascript
// alert-email.js
const sgMail = require('@sendgrid/mail');
const axios = require('axios');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
    
    if (response.data.status !== 'healthy') {
      await sendAlert('Bot health degraded', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    await sendAlert('Bot health check failed', error.message);
  }
}

async function sendAlert(subject, body) {
  const msg = {
    to: 'your-email@example.com',
    from: 'alerts@yourdomain.com',
    subject: `[ALERT] ${subject}`,
    text: body,
  };
  
  await sgMail.send(msg);
  console.log(`Alert sent: ${subject}`);
}

// Check every 60 seconds
setInterval(checkHealth, 60000);
checkHealth(); // Initial check
```

### 2. Slack Alerts

```javascript
// alert-slack.js
const axios = require('axios');

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const CHECK_INTERVAL = 60000; // 1 minute

let lastStatus = 'healthy';
let consecutiveFailures = 0;

async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
    
    const currentStatus = response.data.status;
    
    // Alert on status change or consecutive failures
    if (currentStatus !== 'healthy') {
      consecutiveFailures++;
      
      if (currentStatus !== lastStatus || consecutiveFailures >= 3) {
        await sendSlackAlert({
          status: 'warning',
          message: `Bot health: ${currentStatus}`,
          details: response.data,
        });
      }
    } else {
      // Alert when recovering
      if (lastStatus !== 'healthy' && consecutiveFailures > 0) {
        await sendSlackAlert({
          status: 'good',
          message: 'Bot has recovered',
          details: response.data,
        });
      }
      consecutiveFailures = 0;
    }
    
    lastStatus = currentStatus;
  } catch (error) {
    consecutiveFailures++;
    
    if (consecutiveFailures >= 3) {
      await sendSlackAlert({
        status: 'danger',
        message: 'Bot health check failed',
        error: error.message,
      });
    }
  }
}

async function sendSlackAlert(alert) {
  const color = {
    good: '#36a64f',
    warning: '#ff9900',
    danger: '#ff0000',
  }[alert.status] || '#808080';
  
  const payload = {
    attachments: [{
      color,
      title: '🤖 X1 Wallet Watcher Bot Alert',
      text: alert.message,
      fields: [
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
      footer: 'X1 Wallet Bot Monitor',
    }],
  };
  
  if (alert.details) {
    payload.attachments[0].fields.push({
      title: 'Details',
      value: `\`\`\`${JSON.stringify(alert.details, null, 2)}\`\`\``,
      short: false,
    });
  }
  
  await axios.post(SLACK_WEBHOOK_URL, payload);
}

setInterval(checkHealth, CHECK_INTERVAL);
checkHealth();
```

### 3. Discord Webhook

```javascript
// alert-discord.js
const axios = require('axios');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

async function sendDiscordAlert(title, message, color = 0xFF0000) {
  const embed = {
    embeds: [{
      title: `🤖 ${title}`,
      description: message,
      color,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'X1 Wallet Watcher Bot',
      },
    }],
  };
  
  await axios.post(DISCORD_WEBHOOK_URL, embed);
}

// Usage
async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
    
    if (response.data.status !== 'healthy') {
      await sendDiscordAlert(
        'Health Alert',
        `Bot status: ${response.data.status}`,
        0xFF9900 // Orange
      );
    }
  } catch (error) {
    await sendDiscordAlert(
      'Critical Alert',
      `Health check failed: ${error.message}`,
      0xFF0000 // Red
    );
  }
}

setInterval(checkHealth, 60000);
```

---

## Monitoring Metrics to Track

### Essential Metrics

| Metric | Endpoint | Threshold | Action |
|--------|----------|-----------|--------|
| **Bot Status** | `/health` | status !== "healthy" | Alert immediately |
| **Uptime** | `/health` | < 60s (unexpected restart) | Investigate |
| **Memory Usage** | `/health` | > 90% | Alert, consider restart |
| **RPC Latency** | `/health` | > 2000ms | Check network/RPC |
| **HTTP Response** | `/health` | Timeout or 500+ | Bot may be down |

### Advanced Metrics

- Wallet check cycles completed
- Notifications sent
- RPC call success rate
- Error rate
- Cache hit rate

---

## Alerting Rules

### Severity Levels

**🔴 CRITICAL** - Immediate action required
- Bot completely down (no HTTP response)
- Consecutive failures > 3
- Memory > 95%

**🟡 WARNING** - Monitor closely
- Status "degraded"
- Memory > 80%
- RPC latency > 1000ms
- Unexpected restarts

**🟢 INFO** - For awareness
- Status recovered
- Configuration changes
- Routine maintenance

---

## Log Monitoring

### View Logs in Real-Time

**Docker:**
```bash
docker-compose logs -f x1-wallet-bot
```

**Native:**
```bash
# Windows PowerShell
Get-Content bot_output.log -Wait

# Linux/Mac
tail -f bot_output.log
```

### Search Logs for Errors

```bash
# Docker
docker-compose logs x1-wallet-bot | grep -i error

# Native
cat bot_output.log | grep -i error
```

### Log Patterns to Monitor

```bash
# Critical errors
grep "CRITICAL\|FATAL\|uncaughtException" bot_output.log

# RPC errors
grep "RPC\|rate limit\|429" bot_output.log

# Memory warnings
grep "memory\|heap" bot_output.log

# Bot crashes
grep "crash\|exit\|shutdown" bot_output.log
```

---

## Automated Recovery

### Systemd Service (Linux)

```ini
# /etc/systemd/system/x1-wallet-bot.service
[Unit]
Description=X1 Wallet Watcher Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/x1-wallet-watcher-bot
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=append:/var/log/x1-wallet-bot.log
StandardError=append:/var/log/x1-wallet-bot-error.log

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable x1-wallet-bot
sudo systemctl start x1-wallet-bot
sudo systemctl status x1-wallet-bot
```

### PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start npm --name "x1-wallet-bot" -- start

# Enable auto-restart on server reboot
pm2 startup
pm2 save

# Monitor
pm2 monit

# View logs
pm2 logs x1-wallet-bot
```

### Windows Service with NSSM

```bash
# Download NSSM from https://nssm.cc/

# Install service
nssm install X1WalletBot "C:\Program Files\nodejs\node.exe"
nssm set X1WalletBot AppDirectory "C:\path\to\bot"
nssm set X1WalletBot AppParameters "dist/index.js"
nssm set X1WalletBot AppStdout "C:\path\to\bot\logs\output.log"
nssm set X1WalletBot AppStderr "C:\path\to\bot\logs\error.log"

# Start service
nssm start X1WalletBot
```

---

## Dashboard Examples

### Simple HTML Dashboard

```html
<!DOCTYPE html>
<html>
<head>
    <title>X1 Bot Monitor</title>
    <script>
        async function updateStatus() {
            try {
                const response = await fetch('http://localhost:3000/health');
                const data = await response.json();
                
                document.getElementById('status').textContent = data.status;
                document.getElementById('uptime').textContent = Math.floor(data.uptime / 60000) + ' minutes';
                document.getElementById('memory').textContent = data.checks.memory.usedMB + ' MB';
                document.getElementById('rpc').textContent = data.checks.rpc.latencyMs + ' ms';
            } catch (error) {
                document.getElementById('status').textContent = 'ERROR';
            }
        }
        
        setInterval(updateStatus, 5000);
        updateStatus();
    </script>
</head>
<body>
    <h1>X1 Wallet Watcher Bot Status</h1>
    <p>Status: <span id="status">Loading...</span></p>
    <p>Uptime: <span id="uptime">-</span></p>
    <p>Memory: <span id="memory">-</span></p>
    <p>RPC Latency: <span id="rpc">-</span></p>
</body>
</html>
```

---

## Monitoring Checklist

- [ ] Health endpoint accessible externally (if needed)
- [ ] Alerting configured (email/Slack/Discord)
- [ ] Log rotation enabled
- [ ] Auto-restart configured (systemd/PM2/Docker)
- [ ] Backup strategy for data directory
- [ ] Recovery procedures documented
- [ ] Monitoring dashboard set up (optional)
- [ ] Alert escalation defined

---

## Best Practices

1. **Check health every 30-60 seconds** - Frequent enough to detect issues quickly
2. **Alert on 3+ consecutive failures** - Avoid false positives
3. **Monitor trends** - Track memory/CPU over time
4. **Set up escalation** - Critical alerts to phone, warnings to email
5. **Test alerts** - Verify they work before you need them
6. **Document procedures** - What to do when alerts fire
7. **Review regularly** - Adjust thresholds based on actual behavior

---

## Support

For monitoring issues:
- Check health endpoint: `curl http://localhost:3000/health`
- Review logs: `docker-compose logs -f` or `cat bot_output.log`
- Check bot process: `ps aux | grep node` or `Get-Process node`

# X1 Wallet Watcher Bot - Cloudflare Workers Edition

## 🚀 Features

This is a serverless version of the X1 Wallet Watcher Bot, optimized for Cloudflare Workers with:

- ✅ **Webhook-based** (no polling, more efficient)
- ✅ **Cloudflare Workers KV** for data storage
- ✅ **Cron Triggers** for wallet monitoring (every minute)
- ✅ **Global edge deployment** (low latency worldwide)
- ✅ **100,000 requests/day FREE**
- ✅ **Scales to 1000+ users easily**
- ✅ **$0/month for most use cases**

## 📋 Prerequisites

1. **Cloudflare Account** (free) - https://dash.cloudflare.com/sign-up
2. **Telegram Bot Token** - from @BotFather
3. **Node.js 18+** installed locally
4. **npm** or **yarn** package manager

## 🛠️ Setup Instructions

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Step 2: Create KV Namespace

```bash
# Create production KV namespace
wrangler kv:namespace create "BOT_DATA"

# Create preview KV namespace (for development)
wrangler kv:namespace create "BOT_DATA" --preview
```

You'll get output like:
```
{ binding = "BOT_DATA", id = "abc123...", preview_id = "xyz789..." }
```

**Copy these IDs and update `wrangler.toml`**

### Step 3: Configure Environment

Edit `wrangler.toml` and update:

```toml
# Add your KV namespace IDs
kv_namespaces = [
  { binding = "BOT_DATA", id = "YOUR_KV_ID_HERE", preview_id = "YOUR_PREVIEW_ID_HERE" }
]
```

### Step 4: Set Secrets

```bash
# Set your Telegram Bot Token
wrangler secret put BOT_TOKEN
# Enter your bot token when prompted

# Set X1 RPC URL
wrangler secret put X1_RPC_URL
# Enter: https://x1-mainnet.infrafc.org

# Optional: Set webhook secret for security
wrangler secret put WEBHOOK_SECRET
# Enter a random secure string
```

### Step 5: Install Dependencies

```bash
cd cloudflare-worker
npm install
```

### Step 6: Deploy to Cloudflare

```bash
# Deploy to production
npm run deploy

# Or use wrangler directly
wrangler deploy
```

You'll get a URL like: `https://x1-wallet-watcher-bot.YOUR-SUBDOMAIN.workers.dev`

### Step 7: Set Up Telegram Webhook

After deployment, call the setup endpoint:

```bash
curl -X POST https://x1-wallet-watcher-bot.YOUR-SUBDOMAIN.workers.dev/setup
```

This tells Telegram to send updates to your worker.

## ✅ Verify Deployment

1. **Check health:**
   ```bash
   curl https://x1-wallet-watcher-bot.YOUR-SUBDOMAIN.workers.dev/health
   ```

2. **Test bot on Telegram:**
   - Open your bot on Telegram
   - Send `/start`
   - You should get a welcome message!

## 📊 How It Works

### Architecture

```
User sends message → Telegram API → Cloudflare Worker (webhook)
                                          ↓
                                    Process command
                                          ↓
                                    Store in KV
                                          ↓
                                    Send response

Every 1 minute → Cron Trigger → Check all wallets → Send notifications
```

### Key Differences from Original Bot

| Feature | Original (Polling) | Cloudflare (Webhook) |
|---------|-------------------|---------------------|
| **Architecture** | Long-running process | Serverless functions |
| **Telegram API** | Polling | Webhooks |
| **Storage** | data.json file | Cloudflare KV |
| **Wallet Check** | Continuous loop | Cron triggers |
| **Cost** | Requires VPS ($5-20/mo) | Free tier (100k req/day) |
| **Scaling** | Limited by server | Auto-scales |
| **Latency** | Single location | Global edge |

## ⚙️ Configuration

### Cron Trigger Frequency

By default, wallets are checked **every 1 minute** (Cloudflare's minimum).

To change frequency, edit `wrangler.toml`:

```toml
[triggers]
crons = ["* * * * *"]  # Every 1 minute (default)
# crons = ["*/5 * * * *"]  # Every 5 minutes
# crons = ["*/15 * * * *"]  # Every 15 minutes
```

**Note:** More frequent = more executions = higher costs (but free tier is generous)

### Multiple Cron Jobs (Workaround for Sub-Minute)

If you need checks faster than 1 minute, deploy multiple workers:

```toml
# Worker 1: Check wallets 0, 2, 4, 6... (even indices)
# Worker 2: Check wallets 1, 3, 5, 7... (odd indices)
```

This gives you 30-second effective frequency.

## 🔧 Development

### Local Development

```bash
# Run locally
npm run dev

# This starts a local server at http://localhost:8787
```

**Note:** Local testing requires setting up a local tunnel for Telegram webhooks:
```bash
# Using ngrok or cloudflared
cloudflared tunnel --url http://localhost:8787
```

### View Logs

```bash
# Stream live logs
npm run tail

# Or
wrangler tail
```

### Testing

```bash
# Run tests (if implemented)
npm test
```

## 📈 Monitoring

### Cloudflare Dashboard

- Go to https://dash.cloudflare.com
- Navigate to Workers & Pages → Your Worker
- View metrics:
  - Requests per second
  - Success rate
  - CPU time
  - Errors

### Custom Stats Endpoint

```bash
curl https://x1-wallet-watcher-bot.YOUR-SUBDOMAIN.workers.dev/stats
```

Returns:
```json
{
  "totalWallets": 25,
  "watcher": {
    "lastCheck": 1234567890,
    "walletsChecked": 25,
    "errors": 0
  },
  "timestamp": 1234567890
}
```

## 💰 Pricing & Limits

### Free Tier (Generous!)

- ✅ 100,000 requests/day
- ✅ Unlimited workers
- ✅ 1GB KV storage
- ✅ 100,000 KV reads/day
- ✅ 1,000 KV writes/day
- ✅ Cron triggers included

### Example Usage (100 Users)

```
100 users × 10 commands/day = 1,000 requests/day
Cron: 1,440 checks/day (every minute)
KV reads: ~3,000/day
KV writes: ~500/day

Total: Well within free tier! ✅
```

### Paid Tier ($5/month)

- 10 million requests/month
- Unlimited KV operations
- Better for 500+ active users

## 🆘 Troubleshooting

### Bot not responding

1. Check webhook is set:
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
   ```

2. Check worker logs:
   ```bash
   wrangler tail
   ```

3. Re-deploy:
   ```bash
   npm run deploy
   ```

### Wallet notifications not working

1. Check cron triggers are enabled in `wrangler.toml`
2. Verify KV namespace is created and linked
3. Check logs during cron execution:
   ```bash
   wrangler tail
   ```

### KV errors

1. Verify KV namespace IDs in `wrangler.toml`
2. Check KV namespace exists:
   ```bash
   wrangler kv:namespace list
   ```

## 🔐 Security Best Practices

1. **Use webhook secret:**
   ```bash
   wrangler secret put WEBHOOK_SECRET
   ```

2. **Rotate bot token** if exposed

3. **Monitor usage** in Cloudflare Dashboard

4. **Set rate limits** (Cloudflare handles most DDoS automatically)

## 🚀 Advanced Features

### Custom Domain

1. Add a custom domain in Cloudflare Dashboard
2. Update webhook URL accordingly

### Multiple Environments

```bash
# Deploy to staging
wrangler deploy --env development

# Deploy to production
wrangler deploy --env production
```

### Database Migration from Original Bot

If migrating from the original bot:

```bash
# Export data from original bot
# Convert data.json to KV format
# Import using wrangler kv:key put
```

(Migration script coming soon)

## 📚 Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Grammy Framework](https://grammy.dev/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## 🤝 Contributing

Contributions welcome! Please open issues or PRs on GitHub.

## 📄 License

MIT

---

**Questions?** Open an issue or contact the maintainer.

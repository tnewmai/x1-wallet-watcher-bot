# ⚡ Quick Start - X1 Wallet Watcher Bot

## 🚀 Deploy in 3 Steps

### Step 1: Configure
```bash
# Copy environment template
cp .env.example .env

# Edit and add your bot token
nano .env
```

**Required:** Set `BOT_TOKEN=your_token_from_botfather`

### Step 2: Deploy
```bash
# Make scripts executable (Linux/Mac)
chmod +x deploy.sh monitor.sh

# Deploy with Docker
./deploy.sh
```

**Or manually:**
```bash
docker-compose up -d --build
```

### Step 3: Verify
```bash
# Check health
curl http://localhost:3000/health

# View logs
docker-compose logs -f
```

---

## 📊 Monitor Performance

```bash
# Live monitoring dashboard
./monitor.sh

# Or check health endpoint
curl http://localhost:3000/health | jq

# Or view detailed metrics
curl http://localhost:3000/metrics | jq
```

---

## 🔧 Common Adjustments

### Rate Limiting Issues?
Edit `.env`:
```env
WATCHER_CONCURRENCY=2       # Lower = less RPC pressure
POLL_INTERVAL=20000         # Higher = slower updates
```

Then restart:
```bash
docker-compose restart
```

### Check Performance
```bash
# View RPC statistics
curl http://localhost:3000/metrics | jq '.metrics.rpcCalls'

# View watcher performance
curl http://localhost:3000/metrics | jq '.metrics.watcherCycles'
```

---

## 📋 Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart bot
docker-compose restart

# Stop bot
docker-compose down

# Check container health
docker ps | grep x1-wallet

# View resource usage
docker stats x1-wallet-watcher-bot
```

---

## 🆘 Troubleshooting

### Bot not responding?
1. Check health: `curl http://localhost:3000/health`
2. Check logs: `docker-compose logs | tail -50`
3. Check RPC: `curl http://localhost:3000/rpc-check`

### Rate limit errors?
1. Lower `WATCHER_CONCURRENCY` in `.env`
2. Increase `POLL_INTERVAL` in `.env`
3. Restart: `docker-compose restart`

### Need help?
See `DEPLOYMENT.md` for detailed troubleshooting guide.

---

## ✅ Success Indicators

Your bot is working correctly if:
- ✅ Health endpoint returns `"status": "healthy"`
- ✅ RPC success rate > 90%
- ✅ Cache hit rate > 70%
- ✅ Bot responds to `/start` in Telegram
- ✅ Logs show watcher cycles completing

Enjoy your X1 Wallet Watcher Bot! 🎉

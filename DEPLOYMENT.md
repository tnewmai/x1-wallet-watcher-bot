# 🚀 Deployment Guide - X1 Wallet Watcher Bot

## Quick Start (Docker - Recommended)

### 1. Prerequisites
- Docker & Docker Compose installed
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)

### 2. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
# OR
vim .env
```

**Required settings:**
```env
BOT_TOKEN=your_telegram_bot_token_here
```

**Optional tuning (already set to safe defaults):**
```env
WATCHER_CONCURRENCY=3          # Lower = less RPC pressure
SECURITY_SCAN_TIMEOUT=30000    # Timeout for security scans (ms)
CACHE_TTL_SHORT=300            # Cache duration (seconds)
```

### 3. Deploy

**Option A: Using deployment script (recommended)**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Option B: Manual Docker Compose**
```bash
# Build and start
docker-compose up -d --build

# Check logs
docker-compose logs -f

# Check health
curl http://localhost:3000/health
```

---

## 📊 Monitoring & Health Checks

### Health Check Endpoints

The bot exposes several HTTP endpoints for monitoring:

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Overall health status | `200` (healthy), `503` (unhealthy) |
| `/live` | Liveness probe (for K8s) | `200` if process alive |
| `/ready` | Readiness probe | `200` if ready to serve |
| `/metrics` | Detailed metrics | Full metrics JSON |
| `/rpc-check` | RPC connectivity | Connection status |

### Using the Monitor Script

```bash
chmod +x monitor.sh
./monitor.sh
```

This displays live metrics that update every 5 seconds:
- ✅ Health status
- 🔌 RPC call statistics
- 👀 Watcher cycle performance
- 🛡️ Security scan metrics
- 📬 Notification counts
- 💾 Memory usage

### Manual Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed metrics
curl http://localhost:3000/metrics | jq

# RPC connectivity
curl http://localhost:3000/rpc-check
```

---

## ⚙️ Performance Tuning

### Rate Limiting Issues?

If you see many `429 Rate Limit` errors:

1. **Reduce concurrency** (lower = gentler on RPC):
   ```env
   WATCHER_CONCURRENCY=2  # Default: 3
   ```

2. **Increase poll interval** (wait longer between checks):
   ```env
   POLL_INTERVAL=20000  # Default: 15000 (15s)
   ```

3. **Use a dedicated RPC endpoint** with higher limits:
   ```env
   X1_RPC_URL=https://your-dedicated-rpc-endpoint.com
   ```

### Bot Running Slow?

If security scans are slow:

1. **Increase timeout** (allow more time):
   ```env
   SECURITY_SCAN_TIMEOUT=45000  # Default: 30000 (30s)
   ```

2. **Increase cache duration** (reduce repeated scans):
   ```env
   CACHE_TTL_SHORT=600  # Default: 300 (5 minutes)
   ```

### Memory Issues?

Monitor memory usage:
```bash
# View container memory
docker stats x1-wallet-watcher-bot

# Check bot memory via metrics
curl http://localhost:3000/metrics | jq '.metrics.systemHealth.memoryUsage'
```

If memory is high, adjust Docker limits:
```yaml
# docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M  # Increase from 256M
```

---

## 🔧 Common Issues & Fixes

### Bot is Frozen / Not Responding

**Check health status:**
```bash
curl http://localhost:3000/health
```

**Check logs for 429 errors:**
```bash
docker-compose logs | grep "429"
```

**Fix:** Lower `WATCHER_CONCURRENCY` or increase `POLL_INTERVAL`

### Health Check Failing

**Check if endpoint is accessible:**
```bash
curl -v http://localhost:3000/health
```

**If port is blocked:**
```bash
# Check if container port is exposed
docker ps | grep x1-wallet

# Ensure docker-compose.yml has port mapping
ports:
  - "3000:3000"
```

### RPC Connection Issues

**Test RPC manually:**
```bash
curl http://localhost:3000/rpc-check
```

**Try different RPC endpoint:**
```env
# .env
X1_RPC_URL=https://rpc.mainnet.x1.xyz
# OR
X1_RPC_URL=https://x1-mainnet.infrafc.org
```

---

## 📋 Useful Commands

### Docker Operations
```bash
# View logs (follow mode)
docker-compose logs -f

# View logs (last 100 lines)
docker-compose logs --tail=100

# Restart bot
docker-compose restart

# Stop bot
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# View container stats
docker stats x1-wallet-watcher-bot
```

### Health & Monitoring
```bash
# Quick health check
curl http://localhost:3000/health | jq

# Watch metrics in real-time
watch -n 5 'curl -s http://localhost:3000/metrics | jq ".metrics"'

# Check if bot is alive
curl http://localhost:3000/live

# Check RPC connectivity
curl http://localhost:3000/rpc-check | jq
```

### Troubleshooting
```bash
# Check container status
docker ps -a | grep x1-wallet

# View container resource usage
docker stats x1-wallet-watcher-bot --no-stream

# Enter container for debugging
docker exec -it x1-wallet-watcher-bot sh

# View full logs since start
docker-compose logs --no-color > bot-logs.txt
```

---

## 🔄 Updates & Maintenance

### Updating the Bot

```bash
# Pull latest code
git pull

# Rebuild and restart
./deploy.sh
```

### Backup User Data

```bash
# User data is stored in ./data/data.json
cp data/data.json data/data.json.backup

# Or use automated backup
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

### Cleaning Up

```bash
# Remove stopped containers
docker-compose down

# Remove with volumes (WARNING: deletes data)
docker-compose down -v

# Clean up old images
docker image prune -f
```

---

## 📞 Support

If you encounter issues:

1. **Check logs**: `docker-compose logs -f`
2. **Check health**: `curl http://localhost:3000/health`
3. **Check metrics**: `curl http://localhost:3000/metrics`
4. **Review configuration**: Ensure `.env` is properly set
5. **Check resources**: `docker stats x1-wallet-watcher-bot`

For persistent issues, please open a GitHub issue with:
- Health check output
- Relevant log excerpts
- Your configuration (with secrets redacted)
- Metrics output

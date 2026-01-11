# 🚀 Deployment Improvements Guide

## Overview
This guide covers the new deployment enhancements including monitoring, backups, and production best practices.

---

## 📊 Monitoring Setup

### Using Docker Compose with Monitoring Stack

We've added a comprehensive monitoring stack with Prometheus and Grafana:

```bash
# Start bot with monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# Access dashboards
# Grafana: http://localhost:3001 (admin/admin123)
# Prometheus: http://localhost:9090
# Bot Health: http://localhost:3000/health
```

### Components

1. **Prometheus** (Port 9090)
   - Metrics collection and storage
   - Scrapes bot health endpoint every 30s
   - 30-day retention period

2. **Grafana** (Port 3001)
   - Visualization dashboards
   - Default credentials: `admin/admin123`
   - Change password on first login

3. **Loki + Promtail** (Optional)
   - Log aggregation and querying
   - Centralized log management

### Monitoring Endpoints

```
GET /health - Health check endpoint
Response:
{
  "status": "healthy",
  "uptime": 12345,
  "timestamp": "2026-01-09T16:00:00.000Z"
}
```

---

## 💾 Automated Backups

### Backup Script Usage

```bash
# Make script executable
chmod +x backup.sh

# Run manual backup
./backup.sh

# Output example:
# 🔄 Starting backup at Wed Jan  9 16:00:00 UTC 2026
# 📦 Backing up data directory...
# ✅ Data backed up
# 📋 Backing up recent logs...
# ✅ Logs backed up
# 🗜️  Compressing backup...
# ✅ Backup created: x1_bot_backup_20260109_160000.tar.gz (1.2M)
```

### Automated Daily Backups

Add to crontab for daily backups at 3 AM:

```bash
# Edit crontab
crontab -e

# Add this line
0 3 * * * cd /path/to/x1-wallet-watcher-bot && ./backup.sh >> ./logs/backup.log 2>&1
```

### Backup Configuration

Edit `backup.sh` to customize:

```bash
BACKUP_DIR="./backups"      # Where to store backups
RETENTION_DAYS=7            # Keep backups for 7 days
```

### Cloud Backup Integration

The script includes commented examples for cloud providers:

**AWS S3:**
```bash
aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" s3://your-bucket/backups/
```

**Google Cloud Storage:**
```bash
gsutil cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" gs://your-bucket/backups/
```

**Azure Blob Storage:**
```bash
az storage blob upload \
  --account-name youraccount \
  --container-name backups \
  --file "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
  --name "${BACKUP_NAME}.tar.gz"
```

### Restore from Backup

```bash
# Extract backup
tar -xzf backups/x1_bot_backup_20260109_160000.tar.gz

# Restore data
cp -r x1_bot_backup_20260109_160000/data/* ./data/

# Restart bot
docker-compose restart
```

---

## 🔒 Security Improvements

### 1. Environment Variables Security

**Before deploying to production:**

```bash
# 1. Generate new bot token from @BotFather
# 2. Update .env file
nano .env

# 3. Verify .env is in .gitignore
git status
# .env should NOT appear

# 4. Set restrictive permissions
chmod 600 .env
```

### 2. Docker Secrets (Production)

For production, use Docker secrets instead of environment variables:

```yaml
# docker-compose.production.yml
services:
  x1-wallet-bot:
    secrets:
      - bot_token
    environment:
      - BOT_TOKEN_FILE=/run/secrets/bot_token

secrets:
  bot_token:
    external: true
```

Create secret:
```bash
echo "your_bot_token" | docker secret create bot_token -
```

### 3. Network Isolation

The monitoring stack uses an isolated network:

```yaml
networks:
  monitoring:
    driver: bridge
```

---

## 📈 Scaling Considerations

### Current Capacity
- **Single instance:** 100-500 users
- **Resource limits:** 256MB RAM, 0.5 CPU
- **Poll interval:** 15 seconds

### When to Scale

**Scale UP (vertical) when:**
- CPU usage consistently > 70%
- Memory usage > 200MB
- Watcher lag > 30 seconds

**Scale OUT (horizontal) when:**
- User count > 500
- Wallet count > 5,000
- Need for high availability

### Horizontal Scaling Setup

For multi-instance deployment, add Redis for shared state:

```yaml
services:
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - monitoring

volumes:
  redis_data:
```

---

## 🏥 Health Checks & Alerts

### Docker Health Checks

Built-in health checks every 30 seconds:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  start_period: 30s
  retries: 3
```

### Check Container Health

```bash
# View health status
docker ps

# View health check logs
docker inspect --format='{{json .State.Health}}' x1-wallet-watcher-bot | jq
```

### Alerting (Advanced)

Set up Prometheus Alertmanager for notifications:

```yaml
# monitoring/alerts.yml
groups:
  - name: bot_alerts
    rules:
      - alert: BotDown
        expr: up{job="x1-wallet-bot"} == 0
        for: 2m
        annotations:
          summary: "Bot is down"
          
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes > 200000000
        for: 5m
        annotations:
          summary: "High memory usage"
```

---

## 🔄 Update Strategy

### Zero-Downtime Updates

```bash
# 1. Build new image
docker-compose build

# 2. Pull data backup (automatic with backup.sh)
./backup.sh

# 3. Rolling update
docker-compose up -d --no-deps --build x1-wallet-bot

# 4. Verify health
curl http://localhost:3000/health
```

### Rollback Procedure

```bash
# 1. Stop current version
docker-compose down

# 2. Restore from backup
tar -xzf backups/x1_bot_backup_YYYYMMDD_HHMMSS.tar.gz
cp -r x1_bot_backup_*/data/* ./data/

# 3. Deploy previous version
docker-compose up -d
```

---

## 📊 Performance Optimization

### Current Settings (Recommended)

```env
POLL_INTERVAL=15000          # 15 seconds
WATCHER_CONCURRENCY=3        # 3 parallel checks
CACHE_TTL_SHORT=300          # 5 minutes
RPC_MAX_RETRIES=3            # 3 retry attempts
```

### High-Traffic Optimization

For > 500 users:

```env
POLL_INTERVAL=20000          # 20 seconds (reduce RPC load)
WATCHER_CONCURRENCY=5        # 5 parallel checks
CACHE_TTL_SHORT=600          # 10 minutes
RPC_MAX_RETRIES=5            # More retries
```

### Low-Traffic Optimization

For < 50 users:

```env
POLL_INTERVAL=10000          # 10 seconds (faster updates)
WATCHER_CONCURRENCY=2        # 2 parallel checks
```

---

## 🎯 Quick Reference

### Common Commands

```bash
# Start with monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# View logs
docker-compose logs -f x1-wallet-bot

# Run backup
./backup.sh

# Check health
curl http://localhost:3000/health

# Restart bot
docker-compose restart x1-wallet-bot

# View resource usage
docker stats x1-wallet-watcher-bot
```

### Monitoring URLs

- **Bot Health:** http://localhost:3000/health
- **Grafana:** http://localhost:3001 (admin/admin123)
- **Prometheus:** http://localhost:9090

---

## ✅ Production Checklist

Before deploying to production:

- [ ] Revoke old bot token and generate new one
- [ ] Set strong Grafana password
- [ ] Configure automated backups (cron)
- [ ] Set up cloud backup storage (S3/GCS/Azure)
- [ ] Configure firewall rules (limit port access)
- [ ] Enable SSL/TLS for monitoring dashboards
- [ ] Set up log rotation
- [ ] Configure alerting (optional)
- [ ] Test backup restore procedure
- [ ] Document rollback procedure
- [ ] Set up monitoring dashboards
- [ ] Configure resource limits appropriately

---

**Need help?** Check the main README.md or open an issue.

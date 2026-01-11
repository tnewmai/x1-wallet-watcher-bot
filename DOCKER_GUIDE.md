# 🐳 Docker Deployment Guide

Complete guide for deploying the X1 Wallet Watcher Bot using Docker.

---

## Quick Start

### 1. Build and Run

```bash
# Build the Docker image
docker-compose build

# Start the bot
docker-compose up -d

# Check logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 2. Stop the Bot

```bash
# Stop the bot
docker-compose down

# Stop and remove volumes (will delete data!)
docker-compose down -v
```

---

## Production Deployment

### Using Production Configuration

```bash
# Build and run with production settings
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f x1-wallet-bot

# Monitor health
watch -n 5 'curl -s http://localhost:3000/health | jq'
```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Required
BOT_TOKEN=your_bot_token_here

# Optional (with defaults)
X1_RPC_URL=https://rpc.mainnet.x1.xyz
POLL_INTERVAL=15000
WATCHER_CONCURRENCY=3
HEALTH_CHECK_PORT=3000
LOG_LEVEL=info
ENABLE_PERFORMANCE_METRICS=true
```

---

## Health Monitoring

### Check Bot Health

```bash
# Simple health check
curl http://localhost:3000/health

# Pretty formatted
curl -s http://localhost:3000/health | jq

# Check readiness
curl http://localhost:3000/ready

# Check liveness
curl http://localhost:3000/live

# View metrics
curl http://localhost:3000/metrics
```

### Docker Health Status

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' x1-wallet-watcher-bot

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' x1-wallet-watcher-bot
```

---

## Logs Management

### View Logs

```bash
# Follow logs (live tail)
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Since specific time
docker-compose logs --since 2024-01-09T12:00:00

# Specific service
docker-compose logs x1-wallet-bot
```

### Log Rotation

Logs are automatically rotated with these settings:
- Maximum size: 10MB per file
- Maximum files: 5
- Compression: Enabled
- Total max size: ~50MB

---

## Data Persistence

### Data Volume

User data is stored in `./data` directory and mounted into the container:

```yaml
volumes:
  - ./data:/app/data
```

### Backup Data

```bash
# Backup data directory
tar -czf bot-data-backup-$(date +%Y%m%d).tar.gz data/

# Restore from backup
tar -xzf bot-data-backup-20240109.tar.gz
```

---

## Resource Management

### Current Limits

```yaml
resources:
  limits:
    cpus: '1.0'      # Maximum 1 CPU core
    memory: 512M     # Maximum 512MB RAM
  reservations:
    cpus: '0.25'     # Guaranteed 0.25 CPU cores
    memory: 128M     # Guaranteed 128MB RAM
```

### Monitor Resource Usage

```bash
# Real-time stats
docker stats x1-wallet-watcher-bot

# Check memory usage
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" x1-wallet-watcher-bot

# Check CPU usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}" x1-wallet-watcher-bot
```

### Adjust Limits

Edit `docker-compose.production.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'     # Increase CPU limit
      memory: 1G      # Increase memory limit
```

---

## Troubleshooting

### Bot Not Starting

1. **Check logs:**
   ```bash
   docker-compose logs x1-wallet-bot
   ```

2. **Check environment variables:**
   ```bash
   docker-compose config
   ```

3. **Verify BOT_TOKEN is set:**
   ```bash
   cat .env | grep BOT_TOKEN
   ```

### Health Check Failing

1. **Check health endpoint directly:**
   ```bash
   docker exec x1-wallet-watcher-bot wget -O- http://localhost:3000/health
   ```

2. **Check if port 3000 is accessible:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **View health check logs:**
   ```bash
   docker inspect x1-wallet-watcher-bot | jq '.[0].State.Health'
   ```

### High Memory Usage

1. **Check current usage:**
   ```bash
   docker stats --no-stream x1-wallet-watcher-bot
   ```

2. **Restart container:**
   ```bash
   docker-compose restart
   ```

3. **Increase memory limit if needed:**
   Edit `docker-compose.production.yml` and increase memory limit.

### Container Keeps Restarting

1. **Check restart count:**
   ```bash
   docker inspect --format='{{.RestartCount}}' x1-wallet-watcher-bot
   ```

2. **View recent logs:**
   ```bash
   docker-compose logs --tail=50 x1-wallet-bot
   ```

3. **Check for OOM (Out of Memory) kills:**
   ```bash
   docker inspect x1-wallet-watcher-bot | jq '.[0].State.OOMKilled'
   ```

---

## Multi-Platform Build

### Build for Multiple Architectures

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build for AMD64 and ARM64
docker buildx build --platform linux/amd64,linux/arm64 -t x1-wallet-bot:latest .

# Push to registry
docker buildx build --platform linux/amd64,linux/arm64 -t your-registry/x1-wallet-bot:latest --push .
```

---

## Security Best Practices

### Current Security Features

✅ **Non-root user** - Bot runs as `botuser` (UID 1001)  
✅ **Read-only filesystem** (except /app/data)  
✅ **No privileged mode**  
✅ **Resource limits** enforced  
✅ **Health checks** configured  
✅ **Network isolation** via bridge network  

### Additional Security (Optional)

```yaml
# Add to docker-compose.production.yml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
```

---

## Updates & Maintenance

### Update Bot

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify
docker-compose logs -f
```

### Cleanup Old Images

```bash
# Remove unused images
docker image prune -a

# Remove all stopped containers
docker container prune

# Full cleanup
docker system prune -a --volumes
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy Bot

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker-compose build
      
      - name: Run tests
        run: docker-compose run --rm x1-wallet-bot npm test
      
      - name: Deploy
        run: |
          docker-compose down
          docker-compose up -d
```

---

## Monitoring with External Tools

### Prometheus Integration

Health metrics are available at `/metrics` endpoint in Prometheus format.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'x1-wallet-bot'
    static_configs:
      - targets: ['x1-wallet-bot:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard

Create a dashboard with these metrics:
- Bot uptime
- Memory usage
- RPC call success rate
- Wallet check cycles
- Error rate

---

## Production Checklist

Before deploying to production:

- [ ] Set strong BOT_TOKEN in `.env`
- [ ] Review resource limits
- [ ] Configure log rotation
- [ ] Set up external monitoring
- [ ] Configure backups for data directory
- [ ] Test health checks
- [ ] Document recovery procedures
- [ ] Set up alerting (email, Slack, etc.)

---

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review health endpoint: `curl http://localhost:3000/health`
- See main README.md for bot-specific troubleshooting

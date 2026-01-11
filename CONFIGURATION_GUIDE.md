# ⚙️ Configuration Guide

Complete guide to configuring the X1 Wallet Watcher Bot for optimal performance.

---

## Configuration Files

### 1. `.env` - Main Configuration

Primary configuration file. Copy from `.env.example`:

```bash
cp .env.example .env
```

### 2. Environment Variables

All settings can be configured via environment variables.

---

## Core Settings

### Bot Token (Required)

```bash
BOT_TOKEN=your_bot_token_from_botfather
```

**How to get:**
1. Message @BotFather on Telegram
2. Use `/newbot` command
3. Follow prompts
4. Copy the token

---

## Blockchain Settings

### RPC URL

```bash
X1_RPC_URL=https://rpc.mainnet.x1.xyz
```

**Options:**
- `https://rpc.mainnet.x1.xyz` - Official X1 mainnet RPC (default)
- Custom RPC endpoint if available

**Considerations:**
- Default RPC may have rate limits
- Consider using your own RPC node for heavy usage

### Explorer URL

```bash
EXPLORER_URL=https://explorer.x1-mainnet.xen.network
```

Used for transaction and address links in notifications.

---

## Polling & Performance

### Poll Interval

```bash
POLL_INTERVAL=15000  # 15 seconds (default)
```

**How often to check wallets for new transactions.**

**Recommendations:**
- `10000` (10s) - High frequency, more RPC calls
- `15000` (15s) - ✅ **Recommended** - Good balance
- `30000` (30s) - Lower frequency, fewer RPC calls
- `60000` (60s) - Minimal RPC usage

**Trade-offs:**
- Lower interval = Faster notifications, more RPC load
- Higher interval = Slower notifications, less RPC load

### Watcher Concurrency

```bash
WATCHER_CONCURRENCY=3  # Check 3 wallets simultaneously (default)
```

**How many wallets to check in parallel.**

**Recommendations:**
- `1` - Sequential (slowest, safest for rate limits)
- `3` - ✅ **Recommended** - Good balance
- `5` - Faster for many wallets, may hit rate limits
- `10` - Very fast, high RPC load

**Formula:** If checking N wallets takes longer than POLL_INTERVAL, increase concurrency.

---

## Rate Limiting & Retries

### RPC Max Retries

```bash
RPC_MAX_RETRIES=3  # Retry failed RPC calls 3 times (default)
```

**How many times to retry failed RPC calls.**

**Recommendations:**
- `1` - Fail fast
- `3` - ✅ **Recommended** - Good resilience
- `5` - Maximum resilience, slower failures

### RPC Retry Delay

```bash
RPC_RETRY_DELAY=1000  # Wait 1 second between retries (default)
```

**Milliseconds to wait between retry attempts.**

**Recommendations:**
- `500` - Quick retries
- `1000` - ✅ **Recommended**
- `2000` - Conservative, better for rate limits

---

## Caching

### Cache TTL (Short)

```bash
CACHE_TTL_SHORT=300  # 5 minutes (default)
```

**Cache duration for frequently-changing data (balances, prices).**

**Recommendations:**
- `60` - Fresh data, more RPC calls
- `300` - ✅ **Recommended** - Good balance
- `600` - Less accurate, fewer RPC calls

---

## Security Scanning

### Disable Auto Security Scan

```bash
DISABLE_AUTO_SECURITY_SCAN=true  # Disable automatic scans (default)
```

**Automatically scan contracts for security issues.**

⚠️ **Security scans are resource-intensive and hit external APIs.**

**Recommendations:**
- `true` - ✅ **Recommended** - Manual scans only
- `false` - Auto-scan all contracts (slow, may hit rate limits)

### Security Scan Timeout

```bash
SECURITY_SCAN_TIMEOUT=30000  # 30 seconds (default)
```

**Maximum time to wait for security scan results.**

---

## Health Check & Monitoring

### Health Check Enabled

```bash
HEALTH_CHECK_ENABLED=true  # Enable health endpoints (default)
```

**Enable HTTP health check endpoints.**

**Endpoints:**
- `/health` - Detailed health status
- `/ready` - Readiness check
- `/live` - Liveness check
- `/metrics` - Prometheus metrics

### Health Check Port

```bash
HEALTH_CHECK_PORT=3000  # Default port
```

**Port for health check HTTP server.**

**Recommendations:**
- `3000` - ✅ **Default**
- Any available port

---

## Logging & Metrics

### Log Level

```bash
LOG_LEVEL=info  # Logging verbosity (default)
```

**Options:**
- `error` - Errors only
- `warn` - Warnings and errors
- `info` - ✅ **Recommended** - Informational messages
- `debug` - Detailed debugging (verbose)

### Enable Performance Metrics

```bash
ENABLE_PERFORMANCE_METRICS=true  # Track performance (default)
```

**Track and log performance metrics.**

**Includes:**
- CPU usage
- Memory usage
- Event loop lag
- RPC call latency

### Enable RPC Metrics

```bash
ENABLE_RPC_METRICS=true  # Track RPC calls (default)
```

**Track RPC call statistics.**

**Includes:**
- Success rate
- Failure rate
- Rate limit hits
- Latency

---

## Notification Settings

### User-Configurable Settings

Users can configure their own notification preferences via `/settings`:

**Transaction Notifications:**
- Enabled/Disabled
- Incoming transactions
- Outgoing transactions
- Minimum value threshold
- Contract interactions

**Balance Alerts:**
- Enabled/Disabled
- Minimum change threshold

---

## Configuration Profiles

### Development Profile

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
POLL_INTERVAL=30000
WATCHER_CONCURRENCY=1
ENABLE_PERFORMANCE_METRICS=true
```

### Production Profile

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=info
POLL_INTERVAL=15000
WATCHER_CONCURRENCY=3
ENABLE_PERFORMANCE_METRICS=true
DISABLE_AUTO_SECURITY_SCAN=true
```

### High-Traffic Profile

```bash
# .env.high-traffic
NODE_ENV=production
LOG_LEVEL=warn
POLL_INTERVAL=10000
WATCHER_CONCURRENCY=5
RPC_MAX_RETRIES=5
CACHE_TTL_SHORT=600
```

### Low-Resource Profile

```bash
# .env.low-resource
NODE_ENV=production
LOG_LEVEL=error
POLL_INTERVAL=30000
WATCHER_CONCURRENCY=2
ENABLE_PERFORMANCE_METRICS=false
```

---

## Optimization Guide

### Scenario 1: Many Users (100+)

**Problem:** Bot is slow to check all wallets

**Solution:**
```bash
POLL_INTERVAL=15000        # Keep default
WATCHER_CONCURRENCY=5      # Increase concurrency
RPC_MAX_RETRIES=3          # Keep default
CACHE_TTL_SHORT=600        # Increase cache time
```

### Scenario 2: RPC Rate Limiting

**Problem:** Hitting rate limits (429 errors)

**Solution:**
```bash
POLL_INTERVAL=30000        # Increase interval
WATCHER_CONCURRENCY=2      # Decrease concurrency
RPC_RETRY_DELAY=2000       # Increase retry delay
RPC_MAX_RETRIES=2          # Reduce retries
```

### Scenario 3: High Memory Usage

**Problem:** Bot using too much memory

**Solution:**
```bash
CACHE_TTL_SHORT=180        # Shorter cache
ENABLE_PERFORMANCE_METRICS=false  # Disable metrics
LOG_LEVEL=warn             # Less logging
```

### Scenario 4: Slow Notifications

**Problem:** Users complain about delayed notifications

**Solution:**
```bash
POLL_INTERVAL=10000        # Decrease interval
WATCHER_CONCURRENCY=5      # Increase concurrency
RPC_MAX_RETRIES=1          # Fail fast
```

---

## Configuration Validation

The bot validates configuration on startup:

```typescript
✅ Validates BOT_TOKEN format
✅ Checks X1_RPC_URL accessibility
✅ Ensures POLL_INTERVAL is reasonable (>= 5000ms)
✅ Validates WATCHER_CONCURRENCY (>= 1, <= 10)
✅ Checks port availability
```

**If validation fails:**
- Bot will not start
- Error message will indicate the issue
- Fix the configuration and restart

---

## Environment-Specific Configuration

### Using Different Configs

```bash
# Development
NODE_ENV=development npm start

# Production
NODE_ENV=production npm start

# Custom
NODE_ENV=custom npm start
```

### Config File Priority

1. Environment variables (highest priority)
2. `.env.{NODE_ENV}` (e.g., `.env.production`)
3. `.env` (default)
4. Built-in defaults (lowest priority)

---

## Advanced Configuration

### Custom RPC Endpoints

```bash
# Multiple RPC endpoints (failover)
X1_RPC_URL=https://rpc1.x1.xyz,https://rpc2.x1.xyz
```

**Note:** Current version uses single RPC endpoint. Multi-RPC support can be added if needed.

### Custom Data Directory

```bash
DATA_DIR=/path/to/custom/data
```

**Default:** `./data`

### Custom Log Directory

```bash
LOG_DIR=/path/to/custom/logs
```

**Default:** `./` (root directory)

---

## Configuration Best Practices

1. **Never commit `.env` to git** - Use `.env.example` as template
2. **Use strong bot tokens** - Keep them secret
3. **Start conservative** - Use default settings first
4. **Monitor metrics** - Adjust based on actual usage
5. **Test changes** - Verify after configuration changes
6. **Document custom settings** - Note why you changed defaults
7. **Backup configuration** - Keep `.env` backup

---

## Configuration Checklist

Before going to production:

- [ ] BOT_TOKEN is set correctly
- [ ] X1_RPC_URL is accessible
- [ ] POLL_INTERVAL is appropriate for user count
- [ ] WATCHER_CONCURRENCY is optimized
- [ ] Log level is set to `info` or `warn`
- [ ] Health check is enabled
- [ ] Metrics are enabled for monitoring
- [ ] Security scan is disabled (unless needed)
- [ ] Configuration is backed up
- [ ] Environment-specific config is used

---

## Troubleshooting Configuration

### Bot won't start

1. Check BOT_TOKEN is valid
2. Verify X1_RPC_URL is accessible: `curl https://rpc.mainnet.x1.xyz`
3. Check port 3000 is not in use
4. Review startup logs for validation errors

### Slow performance

1. Increase WATCHER_CONCURRENCY
2. Decrease POLL_INTERVAL (if acceptable)
3. Check RPC latency: `curl -w "@curl-format.txt" https://rpc.mainnet.x1.xyz`

### Rate limit errors (429)

1. Increase POLL_INTERVAL
2. Decrease WATCHER_CONCURRENCY
3. Increase RPC_RETRY_DELAY
4. Consider using own RPC node

### High memory usage

1. Decrease CACHE_TTL_SHORT
2. Disable metrics temporarily
3. Lower log level to `warn`
4. Check for memory leaks (restart periodically)

---

## Getting Help

For configuration issues:
- Check this guide
- Review `.env.example` for all options
- See bot startup logs for validation errors
- Test with default configuration first

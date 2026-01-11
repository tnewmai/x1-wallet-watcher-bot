# 🔍 Production Monitoring Guide - Cloudflare Workers

**Last Updated:** January 11, 2026  
**Deployment URL:** https://x1-wallet-watcher-bot-production.tnewmai.workers.dev

---

## 📊 Current Production Status

### ✅ Deployment Information
- **Status:** 🟢 LIVE & HEALTHY
- **Account:** tnewmai@gmail.com
- **Account ID:** da7f366fa0a5c4b7e889d4c9953e9b96
- **Worker Name:** x1-wallet-watcher-bot
- **Environment:** Production
- **Latest Deployment:** 2026-01-11 07:00:44 UTC
- **Version ID:** 66421e88-24e3-4e09-a523-8d9585ce9566

### ✅ Health Check
```json
{
  "status": "ok",
  "timestamp": 1768133517347,
  "environment": "production",
  "hasToken": true,
  "hasKV": true
}
```

---

## 🛠️ Monitoring Commands

### **1. View Live Logs**
```bash
cd x1-wallet-watcher-bot/cloudflare-worker
wrangler tail --env production --format pretty
```
**What it shows:**
- Real-time request logs
- User interactions
- Errors and warnings
- Performance metrics

### **2. Check Deployment Status**
```bash
wrangler deployments list --env production
```
**Shows:**
- Deployment history
- Version IDs
- Deployment times
- Authors

### **3. View Worker Metrics**
```bash
wrangler metrics --env production
```
**Metrics include:**
- Request count
- Error rate
- CPU time
- Duration statistics

### **4. Check Health Endpoint**
```bash
curl https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/health
```
**Returns:**
- Worker status
- Environment info
- Configuration check

### **5. Test Webhook**
```bash
curl https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/test
```

---

## 📈 Key Performance Indicators (KPIs)

### **Monitor These Metrics:**

1. **Response Time**
   - Target: < 100ms
   - Current: ~20ms startup + processing
   - Edge computing advantage

2. **Success Rate**
   - Target: > 99%
   - Monitor: Error rate in logs
   - Alert if > 1% errors

3. **User Activity**
   - Active users per day
   - Commands per user
   - Peak usage times

4. **Storage Usage**
   - KV namespace size
   - Data per user
   - Growth rate

5. **API Calls**
   - Telegram API calls
   - X1 RPC calls
   - Rate limit usage

---

## 🚨 Alerting & Notifications

### **Set Up Alerts For:**

1. **High Error Rate**
   - > 5% error rate for 5 minutes
   - Action: Check logs, investigate

2. **Slow Response Time**
   - > 500ms for 5 minutes
   - Action: Check RPC endpoint

3. **Storage Limits**
   - > 80% of KV storage
   - Action: Clean old data

4. **API Rate Limits**
   - Approaching Telegram limits
   - Action: Implement backoff

---

## 🔧 Common Monitoring Tasks

### **Daily Checks:**
```bash
# 1. Quick health check
curl https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/health

# 2. Check recent deployments
wrangler deployments list --env production

# 3. View last hour of logs
wrangler tail --env production --format pretty --once
```

### **Weekly Reviews:**
```bash
# 1. View metrics summary
wrangler metrics --env production

# 2. Check storage usage
# View KV namespace in Cloudflare Dashboard

# 3. Review error patterns
# Analyze logs for recurring issues
```

### **Monthly Maintenance:**
```bash
# 1. Review and clean old KV data
# 2. Update dependencies if needed
# 3. Check for new Cloudflare features
# 4. Review user feedback
```

---

## 📊 Cloudflare Dashboard Monitoring

### **Access Dashboard:**
https://dash.cloudflare.com/

**Navigate to:**
1. Workers & Pages → x1-wallet-watcher-bot
2. View real-time metrics
3. Check error rates
4. Monitor request volume

### **Dashboard Metrics:**
- **Requests:** Total requests over time
- **Errors:** 4xx and 5xx errors
- **Success Rate:** Percentage of successful requests
- **CPU Time:** Worker execution time
- **Duration:** End-to-end request time

---

## 🐛 Troubleshooting Guide

### **Issue: Bot Not Responding**
```bash
# 1. Check health endpoint
curl https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/health

# 2. View live logs
wrangler tail --env production

# 3. Check webhook status
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### **Issue: High Error Rate**
```bash
# 1. View recent errors
wrangler tail --env production --format pretty

# 2. Check deployment history
wrangler deployments list --env production

# 3. Rollback if needed (see below)
```

### **Issue: Slow Response**
```bash
# 1. Check X1 RPC status
curl https://rpc.mainnet.x1.xyz -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# 2. View performance logs
wrangler tail --env production --format pretty

# 3. Check Cloudflare status
# Visit https://www.cloudflarestatus.com/
```

---

## 🔄 Rollback Procedure

### **If Issues Occur After Deployment:**

```bash
# 1. View deployment history
wrangler deployments list --env production

# 2. Find the last working version ID
# Example: 7a186531-8a6a-4879-8b2f-a75cb11358d6

# 3. Rollback to that version
wrangler rollback --env production --version-id <version-id>

# 4. Verify rollback
curl https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/health
```

---

## 📱 User Testing Checklist

### **Weekly User Flow Tests:**

1. **Basic Commands**
   - [ ] `/start` - Bot responds
   - [ ] `/help` - Help message shown
   - [ ] `/wallets` - Shows wallet list

2. **Wallet Management**
   - [ ] Add wallet - Success
   - [ ] View wallet - Shows details
   - [ ] Remove wallet - Works correctly

3. **Security Scanner**
   - [ ] "🚨 SNIFF FOR RUGS" button works
   - [ ] Scan completes successfully
   - [ ] Results are accurate

4. **Notifications**
   - [ ] Transaction alerts work
   - [ ] Balance updates work
   - [ ] Timing is correct

---

## 🔐 Security Monitoring

### **Monitor For:**

1. **Unusual Traffic Patterns**
   - Sudden spike in requests
   - Geographic anomalies
   - Suspicious user behavior

2. **Failed Authentication**
   - Invalid webhook signatures
   - Unauthorized access attempts

3. **Data Access**
   - Unusual KV read/write patterns
   - Large data exports
   - Unexpected deletions

---

## 📊 Performance Baselines

### **Normal Operation:**
```
Requests per day: 1,000 - 10,000
Average response time: 20-50ms
Error rate: < 0.1%
CPU time: 5-20ms per request
Success rate: > 99.9%
```

### **Alert If:**
```
Response time: > 200ms (sustained)
Error rate: > 1% (5 minutes)
CPU time: > 50ms (sustained)
Success rate: < 99%
Request spike: > 10x normal
```

---

## 🎯 Optimization Tips

### **Performance:**
1. Use KV caching for frequently accessed data
2. Batch RPC calls when possible
3. Minimize external API calls
4. Use edge caching headers

### **Cost:**
1. Monitor KV operations
2. Optimize cron job frequency
3. Use conditional requests
4. Clean up old data regularly

### **Reliability:**
1. Implement retry logic
2. Add timeout protection
3. Graceful error handling
4. Fallback mechanisms

---

## 📞 Support Resources

### **Cloudflare Support:**
- Dashboard: https://dash.cloudflare.com/
- Docs: https://developers.cloudflare.com/workers/
- Community: https://community.cloudflare.com/
- Status: https://www.cloudflarestatus.com/

### **Bot Support:**
- Telegram API: https://core.telegram.org/bots/api
- X1 Blockchain: https://docs.x1.xyz/
- GitHub Issues: (your repo)

---

## ✅ Production Checklist

### **Daily:**
- [ ] Check health endpoint
- [ ] Review error logs
- [ ] Monitor user activity

### **Weekly:**
- [ ] Review metrics dashboard
- [ ] Test user flows
- [ ] Check storage usage
- [ ] Review performance

### **Monthly:**
- [ ] Update dependencies
- [ ] Review security
- [ ] Clean old data
- [ ] Capacity planning

---

## 🎉 Your Production Bot is Monitored!

**All monitoring tools are ready to use!**

Start with:
```bash
cd x1-wallet-watcher-bot/cloudflare-worker
wrangler tail --env production --format pretty
```

This gives you real-time visibility into your production bot! 🚀

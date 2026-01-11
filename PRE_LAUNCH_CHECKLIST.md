# 🚀 Pre-Launch Checklist - X1 Wallet Watcher Bot

**Target:** Real user release  
**Date:** January 10, 2026

---

## ✅ MUST DO (Before Launch)

### 1. Update Docker Memory Limit
```bash
# Edit docker-compose.yml
nano docker-compose.yml

# Change memory limit:
limits:
  memory: 512M  # Was 256M
```

### 2. Verify Bot Token
- [ ] Confirm bot token is valid
- [ ] Test bot responds to `/start`
- [ ] Verify bot username is correct

### 3. Set Environment for Production
```bash
# Check .env file
NODE_ENV=production  # ✅
LOG_LEVEL=info       # ✅
DISABLE_AUTO_SECURITY_SCAN=true  # ✅ (intentional)
```

### 4. Test Core Features
- [ ] `/start` - Welcome message works
- [ ] `/watch <address>` - Add wallet works
- [ ] `/list` - Shows watched wallets
- [ ] `/settings` - Enable notifications
- [ ] Verify notifications arrive

### 5. Set Up Monitoring
- [ ] Health endpoint accessible: `curl http://localhost:3000/health`
- [ ] Logs directory exists and writable: `./logs/`
- [ ] Set up log rotation (optional but recommended)

### 6. Backup Strategy
```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
cp data/data.json backups/data_$DATE.json
```
- [ ] Create backup directory
- [ ] Test backup/restore process
- [ ] Schedule daily backups (cron or Task Scheduler)

---

## 🟡 SHOULD DO (First Week)

### 7. Monitor Performance
```bash
# Watch resource usage
docker stats x1-wallet-watcher-bot

# Watch logs for errors
tail -f logs/error.log
```
- [ ] Monitor memory usage daily
- [ ] Check for error patterns
- [ ] Track user growth

### 8. User Communication
- [ ] Create bot description in BotFather
- [ ] Set bot commands in BotFather:
  ```
  start - Start the bot
  watch - Watch a wallet
  list - List watched wallets
  settings - Configure notifications
  status - Check bot status
  help - Get help
  ```
- [ ] Prepare announcement message

### 9. Feedback Collection
- [ ] Add feedback command: `/feedback <message>`
- [ ] Monitor user issues
- [ ] Track feature requests

---

## 🟢 NICE TO HAVE (First Month)

### 10. Analytics
- [ ] Track daily active users
- [ ] Track total wallets monitored
- [ ] Track notification volume

### 11. Documentation for Users
- [ ] Create quick start guide (Telegram message)
- [ ] FAQs for common questions
- [ ] Troubleshooting guide

### 12. Scaling Preparation
- [ ] Plan for 500+ users
- [ ] PostgreSQL setup ready
- [ ] Redis cache strategy

---

## 🚨 Known Limitations (Document for Users)

### What to Tell Users:

**1. Security Scans Are Manual**
```
⚠️ Auto security scanning is disabled to reduce load.
✅ Use /security <address> to manually scan a wallet.
```

**2. Wallet Limit**
```
📊 Maximum: 10 wallets per user
💡 Keeps the bot fast and responsive
```

**3. Notification Delays**
```
⏱️ Poll interval: 15 seconds
💡 Notifications arrive within 15-30 seconds of transaction
```

**4. RPC Reliability**
```
⚠️ Bot depends on X1 RPC availability
🔄 Built-in retry logic handles temporary failures
```

---

## 📊 Success Metrics

Track these in first month:

| Metric | Target |
|--------|--------|
| Uptime | >99% |
| Response time | <2s |
| Error rate | <1% |
| User retention | >50% |
| Average wallets/user | 2-5 |

---

## 🎯 Launch Phases

### Phase 1: Soft Launch (Week 1)
- 10-50 beta testers
- Monitor closely
- Fix critical bugs quickly
- Gather feedback

### Phase 2: Limited Release (Week 2-4)
- 50-200 users
- Monitor performance
- Optimize based on usage patterns
- Add requested features

### Phase 3: Public Launch (Month 2+)
- Open to all
- Marketing push
- Scale as needed
- Consider premium features

---

## 🛟 Emergency Procedures

### If Bot Crashes:
```bash
# Check process
docker ps -a | grep x1-wallet

# View recent logs
docker logs --tail 100 x1-wallet-watcher-bot

# Restart
docker-compose restart

# Nuclear option (rebuild)
docker-compose down && docker-compose up -d --build
```

### If Users Report Issues:
1. Check health endpoint
2. Check recent logs
3. Verify RPC endpoint is up
4. Test with your own wallet
5. Communicate status to users

### If Database Corrupts:
```bash
# Restore from backup
cp backups/data_YYYYMMDD.json data/data.json

# Restart bot
docker-compose restart
```

---

## ✅ Sign-Off

Before launching to real users, confirm:

- [ ] All MUST DO items completed
- [ ] Bot tested with real wallets
- [ ] Emergency procedures documented
- [ ] Team knows how to access logs
- [ ] Backup/restore tested
- [ ] Monitoring in place

**Signed:** _________________________  
**Date:** _________________________

---

## 📞 Support Plan

- **Response time target:** <24 hours
- **Critical issues:** <2 hours
- **Maintenance window:** Sundays 2-4 AM (low traffic)
- **Status updates:** Announce in bot if downtime expected

---

**Ready to launch? Let's go! 🚀**

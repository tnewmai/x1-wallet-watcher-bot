# 🚀 Deploy Your Bot NOW - Quick Commands

**Total time:** 30 minutes | **Difficulty:** Easy | **Cost:** ₹0/month

---

## 📋 What You Need (5 minutes)

### 1. Get Telegram Bot Token
```
1. Open Telegram
2. Search for: @BotFather
3. Send: /newbot
4. Follow prompts to create bot
5. Copy the token (looks like: 1234567890:ABCdefGHI...)
```

### 2. Create Oracle Cloud VM
- Sign up: https://oracle.com/cloud/free
- Region: **Mumbai** (ap-mumbai-1)
- Create VM: **VM.Standard.A1.Flex** (1 OCPU, 6GB RAM)
- Image: **Ubuntu 22.04**
- Save SSH key as `oracle-bot-key.pem`
- Note Public IP: `___________________`

---

## ⚡ One-Command Deployment

### Step 1: Connect to Your VM

**Mac/Linux:**
```bash
chmod 400 oracle-bot-key.pem
ssh -i oracle-bot-key.pem ubuntu@YOUR_PUBLIC_IP
```

**Windows (PuTTY):**
- Convert `.pem` to `.ppk` using PuTTYgen
- Connect: `ubuntu@YOUR_PUBLIC_IP`

---

### Step 2: Deploy Bot (One Command!)

```bash
# Download and run deployment script
wget -O deploy.sh https://raw.githubusercontent.com/YOUR_REPO/main/deploy-oracle-cloud.sh
chmod +x deploy.sh
./deploy.sh
```

**OR if you have the files locally:**

```bash
# Clone repository
git clone YOUR_REPO_URL x1-wallet-watcher-bot
cd x1-wallet-watcher-bot

# Run deployment
chmod +x deploy-oracle-cloud.sh
./deploy-oracle-cloud.sh
```

---

### Step 3: Enter Your Bot Token

When prompted:
```
Enter your BOT_TOKEN: [paste your token]
Enter X1 RPC URL: [press Enter for default]
```

---

### Step 4: Wait & Verify (15 minutes)

The script will automatically:
- ✅ Update system
- ✅ Install Docker
- ✅ Configure firewall
- ✅ Build bot
- ✅ Start bot
- ✅ Setup monitoring

**Verify it's working:**
```bash
# Check container
docker ps

# Check health
curl http://localhost:3000/health

# View logs
docker compose -f docker-compose.production.yml logs -f
```

---

## 🎉 Test Your Bot

1. Open Telegram
2. Find your bot: `@YOUR_BOT_USERNAME`
3. Send: `/start`
4. Add wallet: `/watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU Test`
5. Wait 30 seconds
6. You should see: "✅ Wallet added successfully!"

**Done! Your bot is live!** 🚀

---

## 📱 Essential Commands

### View Logs (Live)
```bash
docker compose -f docker-compose.production.yml logs -f
```

### Restart Bot
```bash
docker compose -f docker-compose.production.yml restart
```

### Stop Bot
```bash
docker compose -f docker-compose.production.yml down
```

### Check Status
```bash
docker ps
curl http://localhost:3000/health
```

### View Dashboard
```bash
./dashboard.sh
```

---

## 🆘 Quick Fixes

### Bot Not Responding?
```bash
# Check logs for errors
docker compose -f docker-compose.production.yml logs --tail=50

# Restart
docker compose -f docker-compose.production.yml restart
```

### Invalid Token Error?
```bash
# Edit .env file
nano .env
# Update BOT_TOKEN line
# Save: Ctrl+X, Y, Enter

# Restart
docker compose -f docker-compose.production.yml restart
```

### Out of Memory?
```bash
# Check memory
free -h

# Restart container to free memory
docker compose -f docker-compose.production.yml restart
```

---

## 📊 Monitoring Setup (5 minutes)

### Add External Monitoring (Free)

1. **UptimeRobot** (Recommended):
   - Go to: https://uptimerobot.com
   - Sign up (free)
   - Add Monitor: `http://YOUR_PUBLIC_IP:3000/health`
   - Add email alert
   - Done!

2. **Setup Advanced Monitoring**:
```bash
cd ~/x1-wallet-watcher-bot
chmod +x setup-monitoring.sh
./setup-monitoring.sh
```

This adds:
- ✅ Health checks every 2 minutes
- ✅ Resource monitoring every 5 minutes
- ✅ Auto-restart on failure
- ✅ Log rotation
- ✅ Live dashboard

---

## 🔒 Security (2 minutes)

```bash
# Setup firewall (already done by script)
sudo ufw status

# Setup fail2ban (optional)
sudo apt-get install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 📈 Performance Tips

### For 10-50 Wallets (Default)
```env
# .env settings
WATCHER_CONCURRENCY=3
POLL_INTERVAL=15000
```

### For 50-100 Wallets
```env
WATCHER_CONCURRENCY=5
POLL_INTERVAL=12000
```

### For 100+ Wallets
```env
WATCHER_CONCURRENCY=7
POLL_INTERVAL=10000
```

**Apply changes:**
```bash
docker compose -f docker-compose.production.yml restart
```

---

## 🎯 Troubleshooting Decision Tree

```
Bot not working?
│
├─ Cannot connect to Telegram?
│  └─ Check BOT_TOKEN in .env
│
├─ Container not running?
│  └─ Run: docker compose -f docker-compose.production.yml up -d
│
├─ Health check failing?
│  ├─ Check logs: docker compose -f docker-compose.production.yml logs
│  └─ Restart: docker compose -f docker-compose.production.yml restart
│
├─ High memory usage?
│  └─ Restart: docker compose -f docker-compose.production.yml restart
│
└─ Still not working?
   └─ Generate report: ./generate-health-report.sh
      Send report for support
```

---

## 📚 Full Documentation

- **Complete Guide:** `ORACLE_CLOUD_QUICK_START.md`
- **Pre-deployment Checklist:** `PRE_DEPLOYMENT_CHECKLIST.md`
- **Monitoring Setup:** `UPTIME_MONITORING.md` (created after running setup-monitoring.sh)
- **Configuration:** `CONFIGURATION_GUIDE.md`
- **Bot Commands:** `README.md`

---

## 💡 Pro Tips

1. **Backup your .env file:**
   ```bash
   cp .env .env.backup
   ```

2. **Setup daily backups:**
   ```bash
   echo "0 2 * * * tar -czf ~/backups/bot-\$(date +\%Y\%m\%d).tar.gz ~/x1-wallet-watcher-bot/data" | crontab -
   ```

3. **Monitor from phone:**
   - Install UptimeRobot app
   - Get push notifications

4. **View logs remotely:**
   ```bash
   ssh -i oracle-bot-key.pem ubuntu@YOUR_PUBLIC_IP "docker logs x1-wallet-watcher-bot --tail=50"
   ```

---

## 🎊 Success Checklist

After deployment, verify:

- [ ] Container running: `docker ps` shows `x1-wallet-watcher-bot`
- [ ] Health check works: `curl http://localhost:3000/health` returns OK
- [ ] Telegram bot responds to `/start`
- [ ] Can add wallet with `/watch`
- [ ] Bot auto-restarts: `sudo systemctl status x1-wallet-bot`
- [ ] Monitoring active: `tail -f monitor.log` shows activity
- [ ] Firewall configured: `sudo ufw status` shows rules
- [ ] External monitoring setup (UptimeRobot)

**All checked? Congratulations! Your bot is production-ready!** 🎉

---

## 📊 Cost Breakdown

| Item | Cost |
|------|------|
| Oracle Cloud VM (A1.Flex) | ₹0/month |
| Bandwidth (1-5GB/month) | ₹0/month |
| Monitoring (UptimeRobot) | ₹0/month |
| Domain (optional) | ₹50-500/year |
| **Total** | **₹0/month** ✅ |

**Annual Savings vs Paid Hosting:** ₹6,000-12,000 💰

---

## 🚀 What's Next?

### Customize Your Bot
1. Edit handlers: `vim src/handlers.ts`
2. Add features: See `README.md`
3. Test locally: `npm run dev`
4. Deploy: Rebuild Docker image

### Scale to Multiple Bots
Your free tier can run 3-5 bots! Just:
1. Clone bot directory
2. Change port in docker-compose
3. Use different BOT_TOKEN
4. Deploy!

### Add Paid Features
- Token price tracking
- Portfolio analytics
- Custom alerts
- Multi-language support

---

## 📞 Support

### Self-Help Resources
1. Check logs first: `docker compose -f docker-compose.production.yml logs`
2. Review `ORACLE_CLOUD_QUICK_START.md`
3. Run health report: `./generate-health-report.sh`

### Common Issues
- **Bot not starting:** Check BOT_TOKEN
- **High memory:** Reduce WATCHER_CONCURRENCY
- **Slow responses:** Increase POLL_INTERVAL
- **RPC errors:** Try alternative RPC endpoint

### Still Stuck?
Generate detailed report:
```bash
./generate-health-report.sh
```
Share the output for troubleshooting.

---

## 🎓 Learning Resources

- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Docker Docs:** https://docs.docker.com
- **X1 Blockchain:** https://x1.xyz
- **Oracle Cloud:** https://docs.oracle.com/iaas

---

## ⭐ Quick Reference Card

```bash
# ESSENTIAL COMMANDS - Print and keep handy!

# View logs
docker compose -f docker-compose.production.yml logs -f

# Restart bot
docker compose -f docker-compose.production.yml restart

# Check health
curl http://localhost:3000/health

# View dashboard
./dashboard.sh

# Check container
docker ps

# Edit config
nano .env

# Apply config changes
docker compose -f docker-compose.production.yml restart

# Full rebuild (after code changes)
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d

# View monitoring
tail -f monitor.log

# Generate report
./generate-health-report.sh

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Check disk space
df -h

# Check memory
free -h
```

---

**🎉 That's it! You're now running a production-grade Telegram bot on Oracle Cloud Free Tier!**

**Questions?** Review the full guides in the repository.

**Happy monitoring!** 🚀🤖

# 🎁 Oracle Cloud Deployment Package - Complete Setup

**Everything you need to deploy your X1 Wallet Watcher Bot on Oracle Cloud Free Tier**

---

## 📦 What's Included

This deployment package contains **5 essential files** to get your bot running on Oracle Cloud:

### 1️⃣ **deploy-oracle-cloud.sh** (Main Deployment Script)
- ✅ Fully automated deployment
- ✅ Installs Docker & dependencies
- ✅ Configures firewall & security
- ✅ Builds and starts bot
- ✅ Sets up auto-restart
- ✅ Configures basic monitoring
- ⏱️ Runtime: ~15 minutes

### 2️⃣ **ORACLE_CLOUD_QUICK_START.md** (Complete Guide)
- 📖 Step-by-step instructions
- 🖼️ Detailed explanations
- 🔧 Troubleshooting section
- 💡 Pro tips & best practices
- 📊 Performance tuning
- 🆘 Common issues & solutions

### 3️⃣ **PRE_DEPLOYMENT_CHECKLIST.md** (Preparation Checklist)
- ✅ Prerequisites verification
- 📝 Checklist format
- 🔍 Pre-flight checks
- ⚠️ Common mistakes prevention
- 📋 Information gathering

### 4️⃣ **setup-monitoring.sh** (Advanced Monitoring)
- 📊 Resource usage monitoring
- 🚨 Automated alerts
- 📈 Live dashboard
- 🔄 Auto-recovery
- 📝 Log rotation
- 🌐 External monitoring guide

### 5️⃣ **DEPLOY_NOW.md** (Quick Reference)
- ⚡ Quick commands
- 🎯 Essential info only
- 🔧 Troubleshooting flowchart
- 📱 Mobile-friendly format
- 🆘 Quick fixes

---

## 🚀 3-Step Deployment Process

### Step 1: Prepare (5 minutes)
```bash
☑️ Create Oracle Cloud account
☑️ Get Telegram Bot Token from @BotFather
☑️ Create Ubuntu VM (1 OCPU, 6GB RAM)
☑️ Save SSH key and note Public IP
```

### Step 2: Deploy (15 minutes)
```bash
# Connect to VM
ssh -i oracle-bot-key.pem ubuntu@YOUR_PUBLIC_IP

# Run deployment
wget https://raw.githubusercontent.com/YOUR_REPO/main/deploy-oracle-cloud.sh
chmod +x deploy-oracle-cloud.sh
./deploy-oracle-cloud.sh

# Enter your BOT_TOKEN when prompted
```

### Step 3: Verify (5 minutes)
```bash
# Check bot is running
docker ps
curl http://localhost:3000/health

# Test in Telegram
# Send /start to your bot
# Add a wallet with /watch
```

**Total Time: 25 minutes** ⏱️

---

## 📂 File Structure After Deployment

```
~/x1-wallet-watcher-bot/
├── deploy-oracle-cloud.sh          # Main deployment script
├── setup-monitoring.sh             # Monitoring setup
├── docker-compose.production.yml   # Docker configuration
├── Dockerfile                      # Container image
├── .env                           # Your configuration (created during setup)
├── data/                          # Bot data (persistent)
├── src/                           # Bot source code
├── monitor-bot-advanced.sh        # Monitoring script (created)
├── dashboard.sh                   # Live dashboard (created)
├── monitor.log                    # Monitoring logs
├── alerts.log                     # Alert logs
└── UPTIME_MONITORING.md          # External monitoring guide (created)
```

---

## 💰 Cost Analysis

### Oracle Cloud Free Tier (Forever Free)

| Resource | Allocation | Monthly Cost |
|----------|------------|--------------|
| **VM Instance** | VM.Standard.A1.Flex | ₹0 |
| **CPU** | 1-4 OCPUs (ARM) | ₹0 |
| **Memory** | 6-24GB | ₹0 |
| **Storage** | 50-200GB | ₹0 |
| **Bandwidth** | 10TB/month | ₹0 |
| **Public IP** | 1 IPv4 | ₹0 |
| **Monitoring** | UptimeRobot Free | ₹0 |
| **Total** | | **₹0/month** ✅ |

### Comparison with Paid Hosting

| Provider | Monthly Cost | Annual Cost |
|----------|-------------|-------------|
| **Oracle Cloud (Free)** | **₹0** | **₹0** ⭐ |
| DigitalOcean | ₹500 | ₹6,000 |
| AWS t2.micro | ₹650 | ₹7,800 |
| Google Cloud | ₹700 | ₹8,400 |
| Hetzner | ₹370 | ₹4,440 |

**Your Savings: ₹4,440 - ₹8,400/year!** 💰

---

## 🌍 Performance Expectations

### India-based Hosting (Mumbai Region)

| User Location | Latency | Performance |
|---------------|---------|-------------|
| **India** | 8-15ms | ⚡ Excellent |
| **Southeast Asia** | 30-60ms | ✅ Great |
| **Europe** | 150-200ms | ✅ Good |
| **USA East** | 180-220ms | ✅ Good |
| **USA West** | 220-280ms | ✅ Acceptable |

### Why Latency Doesn't Matter

Your bot uses **polling** (checks every 15 seconds), not webhooks:
- ✅ User commands: < 500ms response time globally
- ✅ Telegram has edge servers worldwide
- ✅ Blockchain RPC location matters more than bot location
- ✅ 200ms latency = imperceptible to users

**Verdict:** Mumbai hosting is perfect for global users! 🌏

---

## 📊 Capacity & Scaling

### Single VM (1 OCPU, 6GB RAM)

| Metric | Capacity |
|--------|----------|
| **Bots** | 3-5 simultaneous bots |
| **Users per bot** | 50-100 active users |
| **Wallets per bot** | 100-200 watched wallets |
| **Transactions** | 1000+ per hour |
| **Memory usage** | 128-512MB per bot |
| **CPU usage** | 10-30% typical |

### Scaling Options (Still Free!)

**Option 1: Multiple Containers**
```bash
# Run 3-5 bots on same VM
# Each with different BOT_TOKEN
# Total cost: ₹0
```

**Option 2: Multiple VMs**
```bash
# Oracle Free Tier allows:
# - Up to 4 ARM instances
# - Total: 24GB RAM, 4 OCPUs
# - Run 12-20 bots total!
# Total cost: ₹0
```

**Option 3: Upgrade Resources**
```bash
# If needed (rare):
# 2 OCPUs, 12GB RAM = Still FREE
# 4 OCPUs, 24GB RAM = Still FREE
# Total cost: ₹0
```

---

## 🔧 Features Included

### ✅ Automated Setup
- System updates
- Docker installation
- Firewall configuration
- Security hardening
- Network optimization

### ✅ Bot Deployment
- Docker containerization
- Production configuration
- Data persistence
- Auto-restart on failure
- Resource limits

### ✅ Monitoring & Alerts
- Health checks (every 2 min)
- Resource monitoring (every 5 min)
- Auto-recovery on failure
- Log rotation
- Live dashboard
- External uptime monitoring

### ✅ Security
- UFW firewall (configured)
- Minimal attack surface
- Secure environment variables
- Regular security updates
- Best practices applied

### ✅ Maintenance
- Automatic restarts
- System reboot recovery
- Log management
- Backup scripts
- Health reporting

---

## 🎯 Deployment Checklist

### Before You Start
- [ ] Read `PRE_DEPLOYMENT_CHECKLIST.md`
- [ ] Have Oracle Cloud account
- [ ] Have Telegram Bot Token
- [ ] Have 30 minutes free time

### During Deployment
- [ ] VM created (Ubuntu 22.04)
- [ ] SSH key downloaded
- [ ] Can connect to VM
- [ ] Ran `deploy-oracle-cloud.sh`
- [ ] Entered BOT_TOKEN
- [ ] Script completed successfully

### After Deployment
- [ ] Container running (`docker ps`)
- [ ] Health check works (`curl localhost:3000/health`)
- [ ] Bot responds in Telegram (`/start`)
- [ ] Can add wallets (`/watch`)
- [ ] Monitoring active (`tail -f monitor.log`)
- [ ] Setup external monitoring (UptimeRobot)

### Optimization (Optional)
- [ ] Run `setup-monitoring.sh` for advanced monitoring
- [ ] Setup UptimeRobot or similar
- [ ] Configure backup script
- [ ] Review performance settings
- [ ] Add fail2ban for security

---

## 📚 Documentation Map

**Start Here:**
1. **DEPLOY_NOW.md** ← Quick start (read this first!)
2. **PRE_DEPLOYMENT_CHECKLIST.md** ← Verify prerequisites
3. **ORACLE_CLOUD_QUICK_START.md** ← Detailed walkthrough

**Advanced:**
4. **setup-monitoring.sh** ← Advanced monitoring setup
5. **UPTIME_MONITORING.md** ← External monitoring (created after setup-monitoring.sh)
6. **CONFIGURATION_GUIDE.md** ← Bot configuration options
7. **README.md** ← Bot features & commands

**Reference:**
- `docker-compose.production.yml` ← Container configuration
- `.env.example` ← Environment variables template
- Bot source code in `src/` directory

---

## 🆘 Support & Troubleshooting

### Quick Diagnostics

**Bot not starting?**
```bash
docker compose -f docker-compose.production.yml logs --tail=50
```

**Health check failing?**
```bash
curl http://localhost:3000/health
docker ps -a
```

**High resource usage?**
```bash
docker stats
free -h
df -h
```

**Generate full report:**
```bash
./generate-health-report.sh
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Invalid BOT_TOKEN | Edit `.env`, restart container |
| Container not running | `docker compose -f docker-compose.production.yml up -d` |
| Out of memory | Reduce WATCHER_CONCURRENCY in `.env` |
| RPC timeout | Try alternative RPC in `.env` |
| Can't connect SSH | Check Security List in Oracle Console |
| Port 3000 blocked | Update Security List ingress rules |

### Decision Tree

```
Problem?
│
├─ Cannot deploy?
│  └─ Review PRE_DEPLOYMENT_CHECKLIST.md
│
├─ Bot not responding?
│  ├─ Check logs
│  ├─ Verify BOT_TOKEN
│  └─ Restart container
│
├─ Performance issues?
│  ├─ Check resource usage
│  ├─ Adjust .env settings
│  └─ Run dashboard.sh
│
└─ Still stuck?
   └─ Generate health report
      Share for support
```

---

## 🎓 Next Steps After Deployment

### 1. Setup External Monitoring (5 min)
```bash
# Read the guide
cat UPTIME_MONITORING.md

# Sign up for UptimeRobot
# Add monitor: http://YOUR_IP:3000/health
```

### 2. Configure Advanced Monitoring (5 min)
```bash
chmod +x setup-monitoring.sh
./setup-monitoring.sh
```

### 3. Test Your Bot (10 min)
```
# In Telegram:
/start
/watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU Test Wallet
/list
/settings
```

### 4. Customize Settings
```bash
# Edit configuration
nano .env

# Adjust for your needs:
# - POLL_INTERVAL (transaction check frequency)
# - WATCHER_CONCURRENCY (parallel wallet checks)
# - LOG_LEVEL (info, debug, warn, error)

# Apply changes
docker compose -f docker-compose.production.yml restart
```

### 5. Setup Backups (Optional)
```bash
# Create backup script
cat > ~/backup-bot.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf ~/backups/bot-$DATE.tar.gz \
  ~/x1-wallet-watcher-bot/.env \
  ~/x1-wallet-watcher-bot/data/
# Keep last 7 backups
ls -t ~/backups/bot-*.tar.gz | tail -n +8 | xargs rm -f
EOF

chmod +x ~/backup-bot.sh
mkdir -p ~/backups

# Run daily at 2 AM
(crontab -l; echo "0 2 * * * ~/backup-bot.sh") | crontab -
```

---

## 🌟 Success Stories & Benefits

### What You've Achieved

✅ **Production-grade bot** running 24/7  
✅ **Zero monthly costs** (save ₹6,000+/year)  
✅ **Auto-restart** on failures  
✅ **Monitoring** with alerts  
✅ **Scalable** to multiple bots  
✅ **Global reach** from India  
✅ **Professional setup** in 30 minutes  

### Your Bot Can Now:

- 📊 Monitor 100+ wallets simultaneously
- ⚡ Detect transactions within 15 seconds
- 🔔 Send instant Telegram notifications
- 💰 Track token balances and changes
- 🔒 Perform security scans on tokens
- 📈 Scale to 50-100 users
- 🌍 Serve users globally

### Potential Use Cases:

- **Personal:** Monitor your crypto wallets
- **Team:** Track organization wallets
- **Service:** Offer monitoring to clients
- **Development:** Build on top of this bot
- **Learning:** Understand blockchain monitoring

---

## 📈 Roadmap & Future Enhancements

### Immediate (Week 1)
- [ ] Deploy and test bot
- [ ] Setup monitoring
- [ ] Add your wallets
- [ ] Invite team members

### Short-term (Month 1)
- [ ] Customize notifications
- [ ] Add more wallets
- [ ] Setup backups
- [ ] Monitor performance

### Medium-term (Month 2-3)
- [ ] Deploy additional bots (if needed)
- [ ] Add custom features
- [ ] Integrate with other tools
- [ ] Optimize performance

### Long-term (Month 4+)
- [ ] Scale to multiple VMs
- [ ] Add premium features
- [ ] Monetize (optional)
- [ ] Build community

---

## 🎁 Bonus Resources

### Included Scripts
- `deploy-oracle-cloud.sh` - Main deployment
- `setup-monitoring.sh` - Advanced monitoring
- `monitor-bot-advanced.sh` - Created during deployment
- `dashboard.sh` - Created during deployment
- `generate-health-report.sh` - Created during monitoring setup

### Documentation
- Complete setup guides (5 files)
- Troubleshooting guides
- Performance tuning tips
- Security best practices
- Scaling strategies

### Community Resources
- X1 Discord server
- Telegram Bot API docs
- Oracle Cloud documentation
- Docker best practices

---

## ✨ Why This Package is Special

### 🎯 Optimized for India + Global Users
- Mumbai region hosting (best for India)
- Acceptable latency for USA/Europe
- Cost-effective (₹0/month)
- Reliable infrastructure

### 🚀 Fully Automated
- One-command deployment
- No manual configuration
- Error handling built-in
- Idempotent scripts (safe to re-run)

### 📊 Production-Ready
- Docker containerization
- Health checks
- Auto-restart
- Monitoring & alerts
- Log management
- Security hardening

### 💰 Cost-Effective
- Forever free hosting
- No hidden costs
- Scales for free
- Save ₹6,000-8,000/year

### 📚 Well-Documented
- 5 comprehensive guides
- Step-by-step instructions
- Troubleshooting sections
- Quick reference cards
- Pro tips included

---

## 🏆 Final Checklist

Before closing this guide, ensure:

- [ ] I understand the 3-step deployment process
- [ ] I have all prerequisites ready
- [ ] I've read `DEPLOY_NOW.md` for quick reference
- [ ] I know where to find detailed guides
- [ ] I understand the cost (₹0/month)
- [ ] I'm ready to deploy

**If all checked, you're ready!** 🎉

---

## 🚀 Let's Deploy!

### Your Next Action:

1. **Open:** `DEPLOY_NOW.md`
2. **Follow:** The quick commands
3. **Deploy:** Your bot in 30 minutes
4. **Enjoy:** Free, professional monitoring!

---

## 📞 Getting Help

### Self-Help (Try First)
1. Check `DEPLOY_NOW.md` troubleshooting section
2. Run `./generate-health-report.sh`
3. Review logs: `docker compose -f docker-compose.production.yml logs`

### Documentation
- `ORACLE_CLOUD_QUICK_START.md` - Detailed guide
- `PRE_DEPLOYMENT_CHECKLIST.md` - Prerequisites
- `CONFIGURATION_GUIDE.md` - Configuration options

### Community
- X1 Discord server
- Oracle Cloud forums
- Telegram Bot API community

---

## 🎊 Congratulations!

You now have everything needed to deploy a **production-grade Telegram bot** on **Oracle Cloud Free Tier**!

**Key Takeaways:**
- ✅ Complete automated setup
- ✅ Zero monthly costs
- ✅ Production-ready monitoring
- ✅ Global performance
- ✅ Fully documented
- ✅ Easy to maintain

**Total Value:** ₹6,000-8,000/year saved! 💰

---

## 📝 Quick Start Command

```bash
# One command to rule them all!
ssh -i oracle-bot-key.pem ubuntu@YOUR_IP "wget -O - https://raw.githubusercontent.com/YOUR_REPO/main/deploy-oracle-cloud.sh | bash"
```

*Replace YOUR_IP and YOUR_REPO with your values*

---

**Ready to deploy? Open `DEPLOY_NOW.md` and let's go!** 🚀

**Good luck with your bot!** 🤖💙

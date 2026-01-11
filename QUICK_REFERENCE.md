# 📚 Quick Reference Guide - Oracle Cloud Deployment

## 🗺️ Document Map

Use this guide to navigate all deployment documentation:

### 🆕 New to Oracle Cloud?
**Start here:** [`ORACLE_SIGNUP_INDIA.md`](ORACLE_SIGNUP_INDIA.md)
- Complete signup walkthrough for Indian users
- Card verification process
- Troubleshooting common issues
- Post-signup verification
- Time: 15-20 minutes

### 🚀 Ready to Deploy?
**Main guide:** [`ORACLE_CLOUD_DEPLOYMENT.md`](ORACLE_CLOUD_DEPLOYMENT.md)
- Step-by-step instance creation
- Docker installation
- Single and multi-bot deployment
- Troubleshooting
- Time: 20-30 minutes

### 🤖 Running Multiple Bots?
**Use these files:**
- [`docker-compose.multibot.yml`](docker-compose.multibot.yml) - Multi-bot configuration
- [`setup-multibot.sh`](setup-multibot.sh) - Automated setup script
- Supports 3-10 bots on one instance

---

## ⚡ Quick Commands Cheat Sheet

### First-Time Setup
```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/x1-wallet-watcher-bot.git
cd x1-wallet-watcher-bot

# 2. Setup single bot
cp .env.example .env
nano .env  # Add your BOT_TOKEN

# 3. Deploy
docker-compose up -d

# 4. Check logs
docker-compose logs -f
```

### Multi-Bot Setup
```bash
# 1. Run setup wizard
bash setup-multibot.sh

# 2. Edit bot tokens
nano .env.bot1
nano .env.bot2
nano .env.bot3

# 3. Deploy all bots
docker-compose -f docker-compose.multibot.yml build
docker-compose -f docker-compose.multibot.yml up -d

# 4. Monitor all bots
docker-compose -f docker-compose.multibot.yml logs -f
```

### Daily Operations
```bash
# View logs
docker-compose logs -f [service_name]

# Restart bot
docker-compose restart

# Stop bot
docker-compose down

# Update bot code
git pull
docker-compose build
docker-compose up -d

# Check resource usage
docker stats
free -h
df -h
```

---

## 🔗 Important URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Oracle Console** | https://cloud.oracle.com/ | Manage instances |
| **Billing** | https://cloud.oracle.com/billing | Check costs (₹0!) |
| **Support** | https://www.oracle.com/cloud/free/ | Get help |
| **BotFather** | https://t.me/BotFather | Create Telegram bots |
| **X1 Explorer** | https://explorer.x1-mainnet.infrafc.org | View transactions |

---

## 💰 Cost Reference

| Solution | Monthly Cost | Bots | RAM | Best For |
|----------|--------------|------|-----|----------|
| **Oracle Free (ARM)** | ₹0 | 5-10 | 6-24GB | Everyone! |
| **HostingRaja VPS** | ₹149 | 5-10 | 1GB | Paid option |
| **DigitalOcean** | ₹330 | 5-10 | 1GB | Need support |
| **Fly.io Free** | ₹0 | 3 | 256MB each | Simple projects |

---

## 🐛 Quick Troubleshooting

### Bot Not Starting
```bash
# Check logs for errors
docker-compose logs

# Verify environment variables
cat .env

# Check Docker is running
docker ps

# Restart Docker service
sudo systemctl restart docker
```

### Can't SSH to Oracle Instance
```bash
# Check correct username
# Ubuntu image: ssh -i key.key ubuntu@IP
# Oracle Linux: ssh -i key.key opc@IP

# Verify key permissions
chmod 400 your-key.key

# Check Security List has port 22 open
# Oracle Console → Networking → Security Lists
```

### Out of Memory
```bash
# Check memory usage
free -h

# Stop unused bots
docker-compose stop bot3

# Or upgrade to 24GB (still free!)
# Oracle Console → Instance → Edit → Change Memory to 24GB
```

### Port Already in Use
```bash
# Check what's using port
sudo netstat -tulpn | grep 3000

# Kill process or change bot port in docker-compose.yml
```

---

## 📊 Resource Monitoring

### Check System Resources
```bash
# Memory usage
free -h

# Disk usage
df -h

# CPU usage
top
# Or install htop: sudo apt install htop

# Docker container stats
docker stats
```

### Expected Usage per Bot
```
RAM: 50-150 MB
CPU: 1-5%
Disk: 50-100 MB
Network: Minimal (<1 GB/month)
```

---

## 🔐 Security Checklist

- [ ] SSH keys stored securely (local + backup)
- [ ] Oracle Security List configured (ports 22, 3000)
- [ ] Instance firewall configured (`ufw` or `iptables`)
- [ ] Using non-root user (default: ubuntu/opc)
- [ ] Environment files not committed to Git
- [ ] MFA enabled on Oracle account (recommended)
- [ ] Regular system updates (`sudo apt update && sudo apt upgrade`)

---

## 📱 Mobile Management (Optional)

### SSH from Android
**App:** Termux
```bash
pkg install openssh
ssh -i key.key ubuntu@YOUR_IP
```

### SSH from iOS
**App:** Terminus
- Import SSH key
- Add server connection
- Connect and manage

---

## 🎯 Scaling Guide

| Bots | RAM Needed | Oracle Instance Config |
|------|------------|------------------------|
| 1-3 | 2GB | 1 OCPU, 6GB RAM (free) |
| 4-6 | 4GB | 1 OCPU, 6GB RAM (free) |
| 7-10 | 6GB | 2 OCPU, 12GB RAM (free) |
| 10+ | 12GB+ | 4 OCPU, 24GB RAM (free) |

**All configs above are FREE on Oracle Cloud!**

---

## 🆘 Getting Help

### Documentation Order
1. Check this Quick Reference first
2. Review specific guide (Signup or Deployment)
3. Check troubleshooting sections
4. Search error messages online
5. Contact Oracle support (chat is fastest)

### Support Channels
- **Oracle Cloud:** https://www.oracle.com/cloud/free/ (chat icon)
- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Docker:** https://docs.docker.com/
- **X1 Blockchain:** Check their official docs

---

## ✅ Deployment Checklist

### Phase 1: Account Setup
- [ ] Oracle Cloud account created
- [ ] Mumbai region selected
- [ ] Card verified (₹0 charged)
- [ ] Can login to console

### Phase 2: Instance Creation
- [ ] ARM instance created
- [ ] Security rules configured
- [ ] SSH connection working
- [ ] Public IP noted down

### Phase 3: Software Installation
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Git installed
- [ ] User added to docker group

### Phase 4: Bot Deployment
- [ ] Repository cloned
- [ ] Environment variables set
- [ ] Docker image built
- [ ] Containers running
- [ ] Logs show successful connection

### Phase 5: Verification
- [ ] Bot responds to /start
- [ ] Wallet watching works
- [ ] Notifications received
- [ ] Health check accessible
- [ ] Auto-restart on reboot enabled

---

## 🎓 Learning Resources

### Beginner Friendly
- **Docker Basics:** https://docker-curriculum.com/
- **Linux Commands:** https://linuxjourney.com/
- **SSH Tutorial:** https://www.ssh.com/academy/ssh

### Advanced
- **Docker Compose:** https://docs.docker.com/compose/
- **Oracle Cloud:** https://docs.oracle.com/en-us/iaas/
- **Telegram Bot API:** https://core.telegram.org/bots

---

## 🚀 Pro Tips

1. **Bookmark cloud.oracle.com** - You'll use it often
2. **Save SSH keys in 3 places** - Local, cloud backup, USB
3. **Use screen/tmux** - Keep sessions alive
4. **Set up monitoring** - Know when bots go down
5. **Regular backups** - Export bot data weekly
6. **Test on testnet first** - Before mainnet deployment
7. **Use Docker logs** - Don't SSH in just to check logs
8. **Label your bots clearly** - bot1, bot2 helps organization

---

## 📈 Next Level (Advanced)

Once comfortable with basics:

- [ ] Set up automated backups to Oracle Object Storage
- [ ] Implement Prometheus + Grafana monitoring
- [ ] Create custom alerts (email/Telegram when bot down)
- [ ] Deploy across multiple regions for redundancy
- [ ] Set up CI/CD with GitHub Actions
- [ ] Implement health check monitoring service
- [ ] Add rate limiting and caching (already in code!)
- [ ] Create admin dashboard for bot management

---

**Remember:** The Oracle Free Tier is genuinely free forever. Take your time, experiment, and don't worry about costs!

**Questions?** Re-read the relevant guide or contact Oracle support. They're very helpful! 🙂

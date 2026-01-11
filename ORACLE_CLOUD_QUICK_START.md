# 🚀 Oracle Cloud Quick Start Guide - X1 Wallet Watcher Bot

Complete guide to deploy your bot on Oracle Cloud Free Tier in **under 30 minutes**.

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- [ ] Oracle Cloud account (sign up at [oracle.com/cloud/free](https://oracle.com/cloud/free))
- [ ] Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- [ ] SSH key pair (or willing to generate one)
- [ ] 30 minutes of time

---

## 🌟 Why Oracle Cloud Free Tier?

| Feature | Oracle Cloud Free Tier |
|---------|----------------------|
| **Cost** | ₹0/month **FOREVER** |
| **RAM** | 6-24GB (across VMs) |
| **CPU** | 1-4 ARM cores |
| **Storage** | 200GB total |
| **Bandwidth** | 10TB/month |
| **Perfect for** | Running 3-5 bots simultaneously |

---

## 📖 Step-by-Step Deployment

### Part 1️⃣ - Create Oracle Cloud VM (10 minutes)

#### 1. Sign Up for Oracle Cloud

1. Go to [oracle.com/cloud/free](https://oracle.com/cloud/free)
2. Click **Start for free**
3. Fill in your details:
   - Country: **India**
   - Email: Your email
   - Verify via OTP
4. Enter credit/debit card (for verification only - **₹2 charge, will be refunded**)
5. Complete verification

#### 2. Create Compute Instance

1. **Login** to Oracle Cloud Console
2. Click **Create a VM Instance** (or navigate to: Compute → Instances → Create Instance)

3. **Configure Instance:**
   ```
   Name: x1-wallet-bot
   
   Placement:
   - Availability Domain: Choose any (AD-1, AD-2, or AD-3)
   
   Image:
   - Click "Change Image"
   - Select: Canonical Ubuntu 22.04 (or latest)
   - Image build: Latest
   
   Shape:
   - Click "Change Shape"
   - Select: VM.Standard.A1.Flex (Ampere ARM)
   - OCPUs: 1-2 (start with 1)
   - Memory (GB): 6-12 (start with 6)
   ```

4. **Networking:**
   ```
   - Create new Virtual Cloud Network: Yes (default)
   - Assign public IPv4 address: Yes ✅
   ```

5. **SSH Keys:**
   - Select: **Generate SSH key pair**
   - Click: **Save Private Key** (save as `oracle-bot-key.pem`)
   - Click: **Save Public Key** (optional)

6. Click **Create** button

7. **Wait 2-3 minutes** for instance to provision
   - Status will change from "Provisioning" → "Running"
   - Note down the **Public IP Address** (e.g., 150.230.x.x)

#### 3. Configure Network Security

1. In your instance page, click **Virtual Cloud Network** name
2. Click **Security Lists** → **Default Security List**
3. Click **Add Ingress Rules**

4. **Add Rule 1 (Health Check):**
   ```
   Source Type: CIDR
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port Range: 3000
   Description: Bot Health Check
   ```

5. Click **Add Ingress Rules** again

6. **Add Rule 2 (SSH - if not exists):**
   ```
   Source Type: CIDR
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port Range: 22
   Description: SSH Access
   ```

7. Click **Add Ingress Rules**

✅ **VM is ready!**

---

### Part 2️⃣ - Connect to Your VM (2 minutes)

#### For Windows Users:

1. **Download PuTTY** from [putty.org](https://www.putty.org/)

2. **Convert Key** (use PuTTYgen):
   - Open PuTTYgen
   - Click "Load" → select `oracle-bot-key.pem`
   - Click "Save private key" → save as `oracle-bot-key.ppk`

3. **Connect with PuTTY:**
   - Host Name: `ubuntu@YOUR_PUBLIC_IP`
   - Port: 22
   - Connection → SSH → Auth: Browse and select `oracle-bot-key.ppk`
   - Click Open

#### For Mac/Linux Users:

1. **Set permissions:**
   ```bash
   chmod 400 oracle-bot-key.pem
   ```

2. **Connect:**
   ```bash
   ssh -i oracle-bot-key.pem ubuntu@YOUR_PUBLIC_IP
   ```

   Replace `YOUR_PUBLIC_IP` with your instance's public IP.

3. Type `yes` when asked about fingerprint

✅ **You're now connected to your VM!**

---

### Part 3️⃣ - Deploy Bot with Automated Script (15 minutes)

#### 1. Upload Bot Code to VM

**Option A: Clone from Git (Recommended)**
```bash
cd ~
git clone YOUR_GIT_REPO_URL x1-wallet-watcher-bot
cd x1-wallet-watcher-bot
```

**Option B: Manual Upload (if you have files locally)**
```bash
# On your local machine:
scp -i oracle-bot-key.pem -r x1-wallet-watcher-bot ubuntu@YOUR_PUBLIC_IP:~/

# Then on VM:
cd ~/x1-wallet-watcher-bot
```

**Option C: Direct Download (if files are on GitHub)**
```bash
wget https://github.com/YOUR_USERNAME/x1-wallet-watcher-bot/archive/refs/heads/main.zip
unzip main.zip
mv x1-wallet-watcher-bot-main x1-wallet-watcher-bot
cd x1-wallet-watcher-bot
```

#### 2. Make Script Executable

```bash
chmod +x deploy-oracle-cloud.sh
```

#### 3. Run Automated Deployment

```bash
./deploy-oracle-cloud.sh
```

#### 4. Follow the Prompts

The script will ask you:

```
Continue with deployment? (y/N): y

Enter your BOT_TOKEN: [paste your token from @BotFather]

Enter X1 RPC URL (press Enter for default): [press Enter]
```

#### 5. Wait for Deployment

The script will automatically:
- ✅ Update system packages (2 min)
- ✅ Install Docker (3 min)
- ✅ Configure firewall (30 sec)
- ✅ Setup bot directory (30 sec)
- ✅ Build Docker image (5 min)
- ✅ Deploy bot (2 min)
- ✅ Setup auto-restart (30 sec)
- ✅ Setup monitoring (30 sec)

**Total time: ~15 minutes**

#### 6. Verify Deployment

After script completes:

```bash
# Check if container is running
docker ps

# View bot logs
docker compose -f docker-compose.production.yml logs -f

# Check health
curl http://localhost:3000/health
```

✅ **Bot is now live!**

---

### Part 4️⃣ - Test Your Bot (3 minutes)

1. **Open Telegram** on your phone/desktop

2. **Find your bot:**
   - Search for your bot username (the one you set in @BotFather)
   - Or use the link: `https://t.me/YOUR_BOT_USERNAME`

3. **Start the bot:**
   ```
   /start
   ```

4. **Add a wallet to watch:**
   ```
   /watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU My Test Wallet
   ```

5. **Wait 15-30 seconds** for the first check

6. **You should see:**
   ```
   ✅ Wallet added successfully!
   📍 Watching: My Test Wallet
   ```

✅ **Your bot is working!**

---

## 🔧 Essential Commands

### Bot Management

```bash
# View live logs
docker compose -f docker-compose.production.yml logs -f

# Stop bot
docker compose -f docker-compose.production.yml down

# Restart bot
docker compose -f docker-compose.production.yml restart

# Rebuild and restart (after code changes)
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d

# Check bot health
curl http://localhost:3000/health

# View metrics
curl http://localhost:3000/metrics
```

### System Management

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
htop

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# View monitoring logs
tail -f monitor.log
```

---

## 📊 Monitoring Your Bot

### Built-in Health Check

Access from anywhere:
```
http://YOUR_PUBLIC_IP:3000/health
```

### Automated Monitoring (Already Setup)

The deployment script created a monitoring cron job that:
- Runs every **5 minutes**
- Checks if container is running
- Checks health endpoint
- Auto-restarts if issues detected
- Logs to `monitor.log`

View monitoring logs:
```bash
tail -f ~/x1-wallet-watcher-bot/monitor.log
```

### Manual Health Check

```bash
cd ~/x1-wallet-watcher-bot
./monitor-bot.sh
```

---

## 🔒 Security Best Practices

### 1. Secure Your .env File

Already done by script (permissions set to 600), but verify:
```bash
ls -la .env
# Should show: -rw------- (only owner can read/write)
```

### 2. Keep System Updated

Set up automatic updates:
```bash
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 3. Monitor Failed Login Attempts

```bash
sudo tail /var/log/auth.log
```

### 4. Change SSH Port (Optional but Recommended)

```bash
sudo nano /etc/ssh/sshd_config
# Change: Port 22 → Port 2222
sudo systemctl restart sshd

# Update Oracle Cloud Security List to allow port 2222
```

### 5. Setup Fail2Ban (Optional)

```bash
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 🐛 Troubleshooting

### Bot Not Starting

**Check logs:**
```bash
docker compose -f docker-compose.production.yml logs
```

**Common issues:**
1. **Invalid BOT_TOKEN**
   - Get new token from @BotFather
   - Update `.env` file
   - Restart: `docker compose -f docker-compose.production.yml restart`

2. **RPC connection issues**
   - Test RPC: `curl https://rpc.mainnet.x1.xyz`
   - Try alternative: `https://x1-mainnet.infrafc.org`

3. **Docker permission denied**
   - Log out and back in: `exit` then reconnect
   - Or use: `sudo docker compose ...`

### Health Check Failing

```bash
# Check if port 3000 is listening
sudo netstat -tlnp | grep 3000

# Check container status
docker ps -a

# Restart container
docker compose -f docker-compose.production.yml restart
```

### Container Keeps Restarting

```bash
# View crash logs
docker compose -f docker-compose.production.yml logs --tail=100

# Check disk space (might be full)
df -h

# Check memory
free -h
```

### Cannot Connect via SSH

1. **Check Security List** in Oracle Cloud Console
2. **Verify public IP** hasn't changed
3. **Check VM status** (should be "Running")
4. **Try from different network** (your ISP might block Oracle IPs)

### VM Running Out of Memory

**Increase swap space:**
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 📈 Scaling & Optimization

### Running Multiple Bots

Your Oracle Cloud Free Tier can run **3-5 bots** simultaneously!

1. **Clone additional bot directories:**
   ```bash
   cp -r x1-wallet-watcher-bot x1-wallet-watcher-bot-2
   cd x1-wallet-watcher-bot-2
   ```

2. **Update .env file** with different BOT_TOKEN

3. **Change health check port:**
   ```bash
   # In .env file:
   HEALTH_CHECK_PORT=3001
   ```

4. **Update docker-compose.production.yml:**
   ```yaml
   container_name: x1-wallet-watcher-bot-2
   ports:
     - "3001:3000"
   ```

5. **Deploy:**
   ```bash
   docker compose -f docker-compose.production.yml up -d
   ```

### Performance Tuning

**For more wallets (100+):**
```env
WATCHER_CONCURRENCY=5
POLL_INTERVAL=10000
```

**For better reliability:**
```env
RPC_MAX_RETRIES=5
RPC_RETRY_DELAY=2000
```

---

## 💰 Cost Analysis

### Oracle Cloud Free Tier (Current Setup)

| Resource | Usage | Cost |
|----------|-------|------|
| **Compute** | 1 OCPU, 6GB RAM | ₹0 |
| **Storage** | 50GB | ₹0 |
| **Bandwidth** | ~1GB/month | ₹0 |
| **Total** | | **₹0/month** |

### If You Need More (Paid Tiers)

| Scenario | Resources | Cost/Month |
|----------|-----------|------------|
| **100+ users** | 2 OCPU, 12GB RAM | ₹0 (Free Tier) |
| **500+ users** | 4 OCPU, 24GB RAM | ~₹1,500 |
| **1000+ users** | Multiple VMs + Load Balancer | ~₹3,500 |

---

## 🎓 Next Steps

### 1. Customize Your Bot

Edit source code in `src/` directory:
```bash
vim src/handlers.ts  # Modify command handlers
vim src/watcher.ts   # Modify wallet watching logic
vim src/keyboards.ts # Modify Telegram keyboards
```

After changes:
```bash
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
```

### 2. Setup Domain Name (Optional)

1. Get free domain from [Freenom](https://freenom.com) or buy from [Namecheap](https://namecheap.com)
2. Point A record to your Oracle Cloud Public IP
3. Setup Nginx reverse proxy (optional)

### 3. Setup Backup

```bash
# Create backup script
cat > ~/backup-bot.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf ~/backups/bot-backup-$DATE.tar.gz \
  ~/x1-wallet-watcher-bot/.env \
  ~/x1-wallet-watcher-bot/data/
# Keep only last 7 backups
ls -t ~/backups/bot-backup-*.tar.gz | tail -n +8 | xargs rm -f
EOF

chmod +x ~/backup-bot.sh
mkdir -p ~/backups

# Add to crontab (daily at 2 AM)
(crontab -l; echo "0 2 * * * ~/backup-bot.sh") | crontab -
```

### 4. Setup Alerts

Use [UptimeRobot](https://uptimerobot.com) (free):
1. Add HTTP monitor for `http://YOUR_IP:3000/health`
2. Set check interval to 5 minutes
3. Add email/Telegram alerts

---

## 🆘 Support & Resources

### Documentation
- **Bot Commands:** See README.md in bot directory
- **Configuration:** See CONFIGURATION_GUIDE.md
- **Troubleshooting:** See docs/bugs/ directory

### Useful Links
- **Oracle Cloud Docs:** https://docs.oracle.com/en-us/iaas/
- **Docker Docs:** https://docs.docker.com/
- **X1 Blockchain:** https://x1.xyz/
- **Telegram Bot API:** https://core.telegram.org/bots/api

### Get Help
- **Oracle Cloud Support:** https://support.oracle.com/
- **X1 Discord:** Check X1 official channels
- **Telegram:** @YourSupportChannel

---

## ✅ Deployment Checklist

Use this to verify everything is working:

- [ ] Oracle Cloud VM created and running
- [ ] SSH access working
- [ ] Docker installed and running
- [ ] Bot deployed and container running
- [ ] Health check accessible: `http://YOUR_IP:3000/health`
- [ ] Telegram bot responding to `/start`
- [ ] Can add wallets with `/watch`
- [ ] Receiving transaction notifications (test with a transaction)
- [ ] Auto-restart enabled (systemd service)
- [ ] Monitoring cron job running
- [ ] .env file secured (600 permissions)
- [ ] Firewall configured (UFW enabled)
- [ ] Backup script created (optional)
- [ ] External monitoring setup (optional)

---

## 🎉 Congratulations!

Your X1 Wallet Watcher Bot is now running on Oracle Cloud Free Tier!

**You're saving ₹6,000-10,000/year** compared to paid hosting! 🎊

### What's Working:
✅ Bot runs 24/7 with auto-restart  
✅ Health monitoring every 5 minutes  
✅ Survives server reboots  
✅ Logs all activity  
✅ Secured with firewall  
✅ Optimized for performance  

**Enjoy your bot!** 🚀🤖

---

**Questions or issues?** Check the troubleshooting section or review the logs!

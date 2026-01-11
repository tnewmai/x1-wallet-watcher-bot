# 🆓 Oracle Cloud Free Tier Deployment Guide

## Complete guide to deploy your Telegram bot on Oracle Cloud's FOREVER FREE tier

**Cost: ₹0/month forever** | **Location: Mumbai Region** | **Runs 3-5 bots easily**

---

## 📋 Prerequisites

- Oracle Cloud account (free) - **New to Oracle Cloud? See `ORACLE_SIGNUP_INDIA.md` first!**
- SSH key pair (we'll generate one)
- Your bot's environment variables ready

---

## 🚀 Step-by-Step Deployment

### Step 1: Create Oracle Cloud Account

1. Go to https://www.oracle.com/cloud/free/
2. Click "Start for free"
3. Select **India** as country
4. Choose **Mumbai (ap-mumbai-1)** region
5. Complete signup (requires credit/debit card for verification)
   - ⚠️ Card is for verification only, won't be charged
   - Free tier is permanent, no auto-upgrade

### Step 2: Create ARM Instance (Free Forever)

1. **Login to Oracle Cloud Console**
   - https://cloud.oracle.com/

2. **Create Compute Instance**
   - Navigate to: `☰ Menu` → `Compute` → `Instances`
   - Click `Create Instance`

3. **Configure Instance:**
   ```
   Name: telegram-bot-server
   
   Image and Shape:
   - Image: Oracle Linux 8 (or Ubuntu 22.04)
   - Click "Change Shape"
   - Select: VM.Standard.A1.Flex (Ampere ARM)
   - OCPUs: 1
   - Memory: 6 GB (you can use up to 24GB free!)
   
   Networking:
   - VCN: Create new (default)
   - Subnet: Create new public subnet (default)
   - Assign public IPv4: ✅ YES
   
   SSH Keys:
   - Generate SSH key pair → Download both private and public key
   - Save the private key as: oracle-bot-server.key
   
   Boot Volume:
   - 50 GB (maximum free tier)
   ```

4. **Click "Create"**
   - Wait 2-3 minutes for instance to provision
   - Note down the **Public IP Address**

### Step 3: Configure Firewall Rules

Oracle blocks all ports by default. We need to open them:

1. **In Oracle Console:**
   - Go to your instance details
   - Click on the **Subnet** link
   - Click on **Default Security List**
   - Click **Add Ingress Rules**

   Add these rules:

   ```
   Rule 1 - SSH:
   Source CIDR: 0.0.0.0/0
   Destination Port: 22
   Description: SSH access
   
   Rule 2 - HTTP (for health checks):
   Source CIDR: 0.0.0.0/0
   Destination Port: 3000
   Description: Bot health check
   ```

2. **On the instance itself (we'll do this after SSH):**
   ```bash
   # Disable Oracle's internal firewall (easier) OR open ports
   sudo iptables -F
   sudo netfilter-persistent save
   ```

### Step 4: Connect to Your Instance

**On Windows (PowerShell):**
```powershell
# Set correct permissions
icacls oracle-bot-server.key /inheritance:r
icacls oracle-bot-server.key /grant:r "%username%":"(R)"

# Connect
ssh -i oracle-bot-server.key ubuntu@YOUR_PUBLIC_IP
# Or if Oracle Linux: ssh -i oracle-bot-server.key opc@YOUR_PUBLIC_IP
```

**On Mac/Linux:**
```bash
chmod 400 oracle-bot-server.key
ssh -i oracle-bot-server.key ubuntu@YOUR_PUBLIC_IP
```

### Step 5: Install Docker on Oracle Instance

Once connected via SSH:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (no sudo needed)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes
exit
# Then reconnect with SSH command above
```

### Step 6: Deploy Your Bot

```bash
# Install Git if needed
sudo apt install git -y

# Clone your repository
git clone https://github.com/YOUR_USERNAME/x1-wallet-watcher-bot.git
cd x1-wallet-watcher-bot

# Create environment file
nano .env
```

**Paste your configuration:**
```env
BOT_TOKEN=your_bot_token_here
X1_RPC_URL=https://x1-mainnet.infrafc.org
POLL_INTERVAL=15000
EXPLORER_URL=https://explorer.x1-mainnet.infrafc.org
LOG_LEVEL=info
```

**Save:** `Ctrl+X`, then `Y`, then `Enter`

### Step 7: Build and Run (ARM-compatible)

```bash
# Build the Docker image (automatically builds for ARM)
docker-compose build

# Start the bot
docker-compose up -d

# Check if it's running
docker-compose ps
docker-compose logs -f
```

**Expected output:**
```
✓ Container running
✓ Bot connected to Telegram
✓ Watching wallets...
```

---

## 🎯 Running Multiple Bots on Same Instance

Create a multi-bot docker-compose file:

```bash
# Create separate folders for each bot
mkdir -p ~/bots/bot1 ~/bots/bot2 ~/bots/bot3

# For each bot:
cd ~/bots/bot1
git clone https://github.com/YOUR_USERNAME/x1-wallet-watcher-bot.git .
nano .env  # Add bot1 token

cd ~/bots/bot2
git clone https://github.com/YOUR_USERNAME/x1-wallet-watcher-bot.git .
nano .env  # Add bot2 token

# Start each bot
cd ~/bots/bot1 && docker-compose up -d
cd ~/bots/bot2 && docker-compose up -d
```

**OR use a single docker-compose.yml:**

```yaml
# ~/bots/docker-compose.yml
version: '3.8'

services:
  bot1:
    build: ./x1-wallet-watcher-bot
    env_file: ./bot1.env
    volumes:
      - ./bot1-data:/app/data
    restart: unless-stopped
    
  bot2:
    build: ./x1-wallet-watcher-bot
    env_file: ./bot2.env
    volumes:
      - ./bot2-data:/app/data
    restart: unless-stopped
    
  bot3:
    build: ./x1-wallet-watcher-bot
    env_file: ./bot3.env
    volumes:
      - ./bot3-data:/app/data
    restart: unless-stopped
```

```bash
# Start all bots at once
docker-compose up -d
```

---

## 🔧 Useful Commands

```bash
# View logs
docker-compose logs -f

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

# System resource usage
free -h
df -h
htop  # Install: sudo apt install htop
```

---

## 📊 Resource Monitoring

Your Oracle Free Tier ARM instance:
- **1 OCPU** (4 cores equivalent)
- **6 GB RAM** (can upgrade to 24GB free!)
- **50 GB storage**

**Each bot uses approximately:**
- RAM: 50-150 MB per bot
- CPU: <5% per bot
- Storage: <100 MB per bot

**You can easily run 5-10 bots simultaneously!**

---

## 🛡️ Security Best Practices

```bash
# 1. Setup automatic security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades

# 2. Configure UFW firewall
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw enable

# 3. Disable root SSH
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd

# 4. Setup fail2ban (optional)
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

---

## 🔄 Auto-Start on Reboot

Your docker-compose already has `restart: unless-stopped`, but ensure Docker starts on boot:

```bash
sudo systemctl enable docker
```

---

## 📈 Scaling to 24GB RAM (Still Free!)

If you need more RAM for many bots:

1. Go to Oracle Console → Compute → Instances
2. Click your instance → More Actions → Edit
3. Change Memory: 24 GB (still free!)
4. Save changes (requires instance restart)

---

## 💰 Cost Verification

**Ensure you stay in FREE tier:**

1. Oracle Console → Billing → Cost Analysis
2. Should show: **₹0.00 estimated monthly cost**
3. Check "Always Free" label on your instance

**Free Tier Limits (Mumbai):**
- ✅ Up to 4 ARM cores (A1 Flex)
- ✅ Up to 24 GB RAM total
- ✅ 200 GB block storage
- ✅ 10 TB outbound traffic/month

---

## 🐛 Troubleshooting

### Bot not starting:
```bash
# Check logs
docker-compose logs

# Check if port 3000 is available
sudo netstat -tulpn | grep 3000

# Restart Docker
sudo systemctl restart docker
```

### Can't connect via SSH:
- Check Security List in Oracle Console has port 22 open
- Verify you're using correct username (ubuntu or opc)
- Check public IP hasn't changed

### ARM compatibility issues:
```bash
# Verify ARM architecture
uname -m
# Should show: aarch64

# Check Docker platform
docker info | grep Architecture
# Should show: aarch64
```

### Out of memory:
```bash
# Check memory usage
free -h

# Stop unused bots
docker-compose down

# Or upgrade to 24GB free RAM (see scaling section)
```

---

## ✅ Success Checklist

- [ ] Oracle Cloud account created
- [ ] ARM instance created in Mumbai region
- [ ] SSH connection working
- [ ] Docker and Docker Compose installed
- [ ] Bot repository cloned
- [ ] Environment variables configured
- [ ] Bot running successfully
- [ ] Health check accessible (http://YOUR_IP:3000/health)
- [ ] Telegram bot responding to /start command
- [ ] Auto-restart on reboot enabled

---

## 🎉 You're Done!

Your bot is now running **FREE FOREVER** on Oracle Cloud!

**What you achieved:**
- ✅ ₹0/month hosting cost
- ✅ ARM-compatible deployment
- ✅ 99.9% uptime SLA
- ✅ Mumbai datacenter (low latency)
- ✅ Can run 5-10 bots simultaneously
- ✅ 24GB RAM available if needed

---

## 📞 Need Help?

Common issues and solutions documented above. For bot-specific issues, check the main README.md.

**Useful links:**
- Oracle Cloud Console: https://cloud.oracle.com/
- Oracle Free Tier: https://www.oracle.com/cloud/free/
- Docker Docs: https://docs.docker.com/

---

**Next Steps:**
1. Monitor your bot for 24 hours
2. Set up additional bots if needed
3. Configure monitoring/alerting
4. Enjoy your free hosting! 🎊

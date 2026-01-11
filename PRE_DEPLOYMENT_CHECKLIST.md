# ✅ Pre-Deployment Checklist - X1 Wallet Watcher Bot

Complete this checklist **before** running the deployment script to ensure a smooth deployment.

---

## 🎯 Prerequisites

### 1. Oracle Cloud Account

- [ ] Signed up at [oracle.com/cloud/free](https://oracle.com/cloud/free)
- [ ] Email verified
- [ ] Credit card verified (₹2 charge - will be refunded)
- [ ] Can access Oracle Cloud Console
- [ ] Home Region selected: **Mumbai (ap-mumbai-1)** recommended for India

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### 2. Telegram Bot Setup

- [ ] Have Telegram account
- [ ] Talked to [@BotFather](https://t.me/BotFather)
- [ ] Created new bot with `/newbot` command
- [ ] Have BOT_TOKEN (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)
- [ ] Bot username is set
- [ ] Bot is not already running elsewhere (stop other instances)

**Bot Token:** `_________________________________` (keep this secure!)

**Bot Username:** `@__________________`

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### 3. Oracle Cloud VM Setup

- [ ] Created Compute Instance (VM)
- [ ] Instance type: **VM.Standard.A1.Flex** (ARM - Free Tier)
- [ ] Image: **Ubuntu 22.04** (or latest)
- [ ] Resources: Minimum **1 OCPU, 6GB RAM**
- [ ] Public IP assigned: `_________________`
- [ ] SSH key downloaded: `oracle-bot-key.pem` (or `.ppk` for Windows)
- [ ] Can connect via SSH
- [ ] Instance status: **Running** (green)

**Public IP Address:** `_________________` (you'll need this!)

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### 4. Network Configuration

- [ ] Virtual Cloud Network (VCN) created
- [ ] Security List configured with ingress rules:
  - [ ] Port **22** (SSH) - Source: `0.0.0.0/0`
  - [ ] Port **3000** (Health Check) - Source: `0.0.0.0/0`
- [ ] Internet Gateway attached
- [ ] Subnet is public

**VCN Name:** `_________________`

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### 5. Local Requirements (Your Computer)

- [ ] Have SSH client:
  - Windows: PuTTY or Windows Terminal
  - Mac/Linux: Built-in terminal
- [ ] Have Git (to clone repository) - optional
- [ ] Have text editor (to create/edit files) - optional
- [ ] Can copy/paste commands
- [ ] Have 30 minutes of uninterrupted time

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

## 🔧 Technical Verification

### Test SSH Connection

**Before deploying**, verify you can connect to your VM:

```bash
# Mac/Linux
ssh -i oracle-bot-key.pem ubuntu@YOUR_PUBLIC_IP

# Windows (PuTTY)
# Use PuTTY GUI with .ppk key file
```

- [ ] SSH connection successful
- [ ] Can run commands: `ls`, `pwd`, `whoami`
- [ ] Have sudo access: `sudo whoami` (should return "root")

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### Test Internet Connectivity

From your VM, test these commands:

```bash
# Test general internet
ping -c 3 google.com

# Test X1 RPC endpoint
curl -s https://rpc.mainnet.x1.xyz

# Test Telegram API
curl -s https://api.telegram.org
```

- [ ] Can ping external hosts
- [ ] X1 RPC responds
- [ ] Telegram API reachable

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

## 📁 Bot Files Preparation

### Option A: Using Git (Recommended)

- [ ] Have Git repository URL
- [ ] Repository is public (or SSH key configured)
- [ ] Bot code is in repository
- [ ] `deploy-oracle-cloud.sh` script is in repository

**Repository URL:** `_________________________________`

---

### Option B: Manual Upload

- [ ] Bot files ready on local computer
- [ ] Know how to use `scp` or WinSCP
- [ ] Files include:
  - [ ] `deploy-oracle-cloud.sh`
  - [ ] `docker-compose.production.yml`
  - [ ] `Dockerfile` or `Dockerfile.production`
  - [ ] `package.json`
  - [ ] `src/` directory
  - [ ] `.env.example`

---

### Option C: Direct Download

- [ ] Bot files are in a downloadable archive (`.zip` or `.tar.gz`)
- [ ] Have download URL
- [ ] Can use `wget` or `curl` to download

**Download URL:** `_________________________________`

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

## 🔍 Final Verification

### System Requirements Check

From your VM, run:

```bash
# Check OS
lsb_release -a

# Check available memory
free -h

# Check disk space
df -h

# Check CPU
nproc
```

Minimum requirements:
- [ ] Ubuntu 20.04+ or Debian 10+
- [ ] At least **512MB free RAM**
- [ ] At least **5GB free disk space**
- [ ] At least **1 CPU core**

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### X1 Blockchain RPC

Test X1 RPC endpoint:

```bash
curl -X POST https://rpc.mainnet.x1.xyz \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

- [ ] RPC responds
- [ ] Response includes `"result": "ok"` or similar
- [ ] No timeout errors

**Alternative RPC (if needed):** `https://x1-mainnet.infrafc.org`

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

## 🚀 Ready to Deploy?

### Pre-Flight Checklist

Review all sections above:

- [ ] ✅ Oracle Cloud Account (Section 1)
- [ ] ✅ Telegram Bot Setup (Section 2)
- [ ] ✅ Oracle Cloud VM Setup (Section 3)
- [ ] ✅ Network Configuration (Section 4)
- [ ] ✅ Local Requirements (Section 5)
- [ ] ✅ Technical Verification (Section 6)
- [ ] ✅ Bot Files Preparation (Section 7)
- [ ] ✅ Final Verification (Section 8)

### Information Summary

Before you start, have these ready:

| Item | Value | Status |
|------|-------|--------|
| Oracle Cloud Public IP | `________________` | ⬜ |
| Bot Token | `________________` | ⬜ |
| SSH Key File | `oracle-bot-key.pem` | ⬜ |
| X1 RPC URL | `https://rpc.mainnet.x1.xyz` | ⬜ |

---

## 🎬 Next Steps

### If ALL checks are ✅ Complete:

1. **Connect to your VM:**
   ```bash
   ssh -i oracle-bot-key.pem ubuntu@YOUR_PUBLIC_IP
   ```

2. **Upload/Clone bot files:**
   ```bash
   # Option A: Git
   git clone YOUR_REPO_URL x1-wallet-watcher-bot
   
   # Option B: Download
   wget YOUR_DOWNLOAD_URL
   unzip bot-files.zip
   
   # Option C: Already uploaded via SCP
   ```

3. **Navigate to bot directory:**
   ```bash
   cd x1-wallet-watcher-bot
   ```

4. **Make script executable:**
   ```bash
   chmod +x deploy-oracle-cloud.sh
   ```

5. **Run deployment:**
   ```bash
   ./deploy-oracle-cloud.sh
   ```

6. **Follow the prompts** and enter your BOT_TOKEN when asked

---

### If ANY checks are ⬜ Not Complete:

**STOP!** Complete those sections first. Do not proceed with deployment until all prerequisites are met.

Common issues if you skip steps:
- ❌ Deployment script fails
- ❌ Bot cannot start
- ❌ Network connectivity issues
- ❌ Cannot connect to VM after deployment
- ❌ Wasted time troubleshooting

---

## 📚 Additional Resources

- **Detailed deployment guide:** See `ORACLE_CLOUD_QUICK_START.md`
- **Oracle Cloud docs:** https://docs.oracle.com/en-us/iaas/
- **Telegram Bot API:** https://core.telegram.org/bots
- **X1 Blockchain:** https://x1.xyz/

---

## 🆘 Troubleshooting

### Cannot Create Oracle Cloud VM

**Issue:** "Out of host capacity" error

**Solution:** 
- Try different Availability Domain (AD-1, AD-2, AD-3)
- Try different region (but Mumbai is best for India)
- Wait 1-2 hours and try again
- Use AMD shape (VM.Standard.E2.1.Micro) instead

---

### Cannot Connect via SSH

**Issue:** "Connection timed out" or "Connection refused"

**Solution:**
1. Check Security List has port 22 open
2. Check VM is in "Running" state
3. Check you're using correct public IP
4. Check SSH key file permissions: `chmod 400 oracle-bot-key.pem`
5. Try from different network (mobile hotspot)

---

### Bot Token Invalid

**Issue:** Bot doesn't respond in Telegram

**Solution:**
1. Go back to @BotFather
2. Use `/mybots` command
3. Select your bot
4. Select "API Token"
5. Copy the FULL token (including `:`)
6. Token format: `1234567890:ABCdefGHI...`

---

### X1 RPC Not Responding

**Issue:** RPC timeout or connection errors

**Solution:**
- Try alternative: `https://x1-mainnet.infrafc.org`
- Try: `https://x1-mainnet.xen.network/rpc`
- Check X1 network status (Discord/Twitter)
- Use VPN if your country blocks certain IPs

---

## ✅ Final Confirmation

I confirm that:

- [ ] I have read this entire checklist
- [ ] All prerequisites are complete
- [ ] All tests have passed
- [ ] I have all required information ready
- [ ] I have 30 minutes of uninterrupted time
- [ ] I am ready to deploy

**Signature:** `________________`  **Date:** `________________`

---

## 🚀 Good Luck!

You're ready to deploy! Follow the **ORACLE_CLOUD_QUICK_START.md** guide for step-by-step instructions.

**Estimated deployment time:** 30 minutes  
**Difficulty:** Easy (fully automated script)  
**Success rate:** 95%+ when checklist is complete

---

**Pro Tip:** Keep this checklist open in a tab while deploying. Check off items as you go! ✅

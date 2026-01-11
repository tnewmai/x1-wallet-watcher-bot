# 🔄 Bot Update Guide

## How to Update Your Live Bot

### ✅ Safe Update Process

```bash
# 1. BACKUP (Always do this first!)
cp data/data.json backups/data_$(date +%Y%m%d_%H%M%S).json

# 2. Upload new code to server
# - Use FTP/SCP to upload files
# - Or use Git: git pull origin main

# 3. Rebuild
npm install  # if dependencies changed
npm run build

# 4. Restart (20 seconds downtime)
docker-compose down
docker-compose up -d --build

# 5. Verify
docker ps
docker logs --tail 20 x1-wallet-watcher-bot
curl http://localhost:3000/health

# 6. Test in Telegram
# Send /start to verify
```

---

## 🧪 Practice Update (Safe Test)

Try this to practice updating:

### Change Bot Welcome Message:

**1. Edit file:**
```bash
nano src/handlers.ts
# Find the /start command handler
# Change welcome message text
```

**2. Build:**
```bash
npm run build
```

**3. Restart:**
```bash
docker-compose restart
```

**4. Test:**
```bash
# Send /start to bot
# See your new message!
```

**Result:** You just did your first update! 🎉

---

## 🔐 What's Safe During Updates

### ✅ ALWAYS PRESERVED:
- User data (data/data.json)
- Watched wallets
- User settings
- Logs

### ⚠️ TEMPORARILY LOST:
- In-memory cache (rebuilds)
- Active websockets (reconnect)

---

## 📞 If Something Goes Wrong

### Rollback Steps:

```bash
# 1. Stop broken bot
docker-compose down

# 2. Restore backup
cp backups/data_backup.json data/data.json

# 3. Revert code
git checkout previous-version
# or restore old files

# 4. Rebuild old version
npm run build

# 5. Start
docker-compose up -d
```

---

## 💡 Pro Tips

1. **Always backup before updates**
2. **Test locally first**
3. **Update during low traffic**
4. **Monitor logs after update**
5. **Have rollback plan ready**

---

## 📋 Update Checklist

Before ANY update:

- [ ] Backup data.json
- [ ] Test changes locally
- [ ] Check disk space on server
- [ ] Note current bot version
- [ ] Announce to users (if major)

After update:

- [ ] Verify bot starts
- [ ] Check health endpoint
- [ ] Test core commands
- [ ] Monitor logs for 15 minutes
- [ ] Announce completion (if major)

---

## 🎯 Common Update Scenarios

### Scenario 1: Fix a Bug
```bash
# Edit code
nano src/file.ts

# Build & restart
npm run build
docker-compose restart
# Downtime: 10 seconds
```

### Scenario 2: Add New Command
```bash
# Edit handlers
nano src/handlers.ts

# Build & restart
npm run build
docker-compose down
docker-compose up -d --build
# Downtime: 20 seconds
```

### Scenario 3: Update Dependencies
```bash
npm update
npm run build
docker-compose up -d --build
# Downtime: 30 seconds
```

### Scenario 4: Change Config
```bash
# Edit .env
nano .env

# Just restart (no rebuild)
docker-compose restart
# Downtime: 10 seconds
```

---

## 🔄 Automation Script

Create `update.sh`:

```bash
#!/bin/bash
set -e

echo "🔄 Starting update process..."

# Backup
echo "💾 Creating backup..."
cp data/data.json backups/data_$(date +%Y%m%d_%H%M%S).json

# Pull code (if using Git)
echo "📥 Pulling latest code..."
git pull origin main

# Install & build
echo "🔨 Building..."
npm install
npm run build

# Restart
echo "♻️ Restarting bot..."
docker-compose down
docker-compose up -d --build

# Wait a bit
sleep 5

# Check status
echo "✅ Checking status..."
docker ps | grep x1-wallet
curl -s http://localhost:3000/health | jq .

echo "🎉 Update complete!"
echo "📊 Check logs: docker logs x1-wallet-watcher-bot"
```

Make executable:
```bash
chmod +x update.sh
```

Use it:
```bash
./update.sh
```

---

## 📊 Monitoring After Updates

```bash
# Watch logs live
docker logs -f x1-wallet-watcher-bot

# Check resource usage
docker stats x1-wallet-watcher-bot

# Check health
watch -n 5 'curl -s http://localhost:3000/health | jq .'
```

---

**Remember:** Updates are NORMAL and SAFE when done carefully!

**Practice makes perfect!** 🚀

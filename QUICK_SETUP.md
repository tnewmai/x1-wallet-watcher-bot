# 🚀 Quick Setup Guide

Get your X1 Wallet Watcher Bot running in 5 minutes!

---

## Prerequisites

- Node.js 18+ installed
- Telegram Bot Token (from @BotFather)
- 5 minutes of your time

---

## Step 1: Install Dependencies

```bash
npm install
```

---

## Step 2: Configure Bot Token

```bash
# Copy example config
cp .env.example .env

# Edit .env and add your bot token
# Windows: notepad .env
# Linux/Mac: nano .env
```

Set your bot token:
```bash
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
```

---

## Step 3: Start the Bot

**Option A: Quick Start (Recommended)**
```bash
# Windows
START_BOT.bat

# Linux/Mac
./START_BOT.sh
```

**Option B: Manual Start**
```bash
npm run build
npm start
```

**Option C: Development Mode**
```bash
npm run dev
```

---

## Step 4: Verify It's Running

Open your browser and check health:
```
http://localhost:3000/health
```

You should see:
```json
{
  "status": "healthy",
  "checks": { ... }
}
```

---

## Step 5: Use Your Bot!

1. Open Telegram
2. Search for your bot
3. Send `/start`
4. Follow the menu to add wallets

---

## Common Commands

```bash
# Check if bot is running
.\monitor_bot.ps1  # Windows
curl http://localhost:3000/health  # Linux/Mac

# View logs
npm start  # (logs to console)

# Stop bot
Ctrl+C

# Restart bot
# Stop with Ctrl+C, then start again
```

---

## Next Steps

### Optimize Configuration
```bash
node config-optimizer.js
```

### Set Up Docker
```bash
# Windows
docker-start.bat

# Linux/Mac
./docker-start.sh
```

### Set Up Monitoring
```bash
cd alerts
node webhook-monitor.js
```

---

## Troubleshooting

### Bot won't start?

1. **Check BOT_TOKEN is set correctly**
   ```bash
   # View your .env (Windows)
   type .env
   
   # View your .env (Linux/Mac)
   cat .env
   ```

2. **Verify Node.js is installed**
   ```bash
   node --version  # Should show v18 or higher
   ```

3. **Check port 3000 is available**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Linux/Mac
   lsof -i :3000
   ```

### Bot starts but doesn't respond?

1. **Verify bot token is correct**
   - Message @BotFather on Telegram
   - Use `/mybots` → Select your bot → API Token

2. **Check bot logs**
   - Look for error messages in console

3. **Test health endpoint**
   ```bash
   curl http://localhost:3000/health
   ```

---

## Documentation

- **Full Documentation:** See README.md
- **Configuration Guide:** See CONFIGURATION_GUIDE.md
- **Docker Deployment:** See DOCKER_GUIDE.md
- **Monitoring Setup:** See MONITORING_GUIDE.md
- **Debug Results:** See DEBUG_RESOLUTION.md

---

## Support

If you need help:
1. Check the troubleshooting section above
2. Review the full documentation
3. Check bot logs for error messages
4. Verify your configuration settings

---

**That's it! Your bot should now be running. Happy monitoring! 🎉**

# 🚀 START MONITORING NOW - Quick Commands

Your monitoring system is **ready to go**! Here's how to start:

## ⚡ 3-Step Setup (2 minutes)

### Step 1: Get Your Telegram ID
Message **@userinfobot** on Telegram, copy your ID.

### Step 2: Edit .env
```bash
# Open your .env file and add this line:
ADMIN_USER_IDS=YOUR_ID_HERE
```

### Step 3: Start the Bot
```bash
npm run build && npm start
```

## ✅ Verify It's Working

Send to your bot:
```
/alerts_test
```

You should get a test alert immediately! 🎉

## 📊 Check Status Anytime

```
/status    - Current resource usage
/health    - System health check
/limits    - Detailed information
```

## 🎯 What Happens Now

- ⚠️ **70% usage** → Warning alert
- 🚨 **90% usage** → Critical alert
- ⏰ **15 min cooldown** between alerts

You'll be alerted for:
- Memory usage
- CPU usage
- RPC rate limits
- Telegram API limits
- Storage capacity

## 📁 All Documentation

- `QUICK_START_MONITORING.md` - 5-minute guide
- `MONITORING_SETUP_GUIDE.md` - Complete reference
- `MONITORING_SYSTEM_README.md` - System overview
- `.env.monitoring` - Config examples

## 🧪 Test Everything

```bash
npm run test:monitoring
```

---

**That's it!** You're now protected from hitting resource limits. 🛡️

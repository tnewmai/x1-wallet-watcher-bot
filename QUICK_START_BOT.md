# 🚀 Quick Start - Run Your Bot

**Last Updated:** January 10, 2026

---

## ⚡ Quick Start (Windows)

### **Option 1: Use the Start Script (Easiest)**

1. **Double-click** `start-bot.bat` in the `x1-wallet-watcher-bot` folder
2. Wait for compilation to complete
3. Bot will start automatically
4. You'll see: `Bot started successfully!`

---

### **Option 2: Manual Start**

1. Open **Command Prompt** (not PowerShell)
2. Navigate to bot folder:
   ```cmd
   cd x1-wallet-watcher-bot
   ```

3. Compile TypeScript:
   ```cmd
   npm run build
   ```

4. Start the bot:
   ```cmd
   npm start
   ```

---

## ✅ **How to Know Bot is Running**

You should see output like:
```
[INFO] Bot started successfully!
[INFO] Enhanced security scanner loaded: 60 rug pullers
[INFO] Listening for updates...
```

---

## 📱 **Test in Telegram**

1. Open Telegram
2. Search for your bot (the name you gave @BotFather)
3. Click **Start**
4. Try command: `/start`
5. You should get a welcome message!

---

## 🧪 **Test the Enhanced Scanner**

1. In your bot, type: `/watch AAaiKNsCrvDvpMfJaq33QcqsXqMHjWFvcCpfpimj1Rbo`
2. Bot will add the wallet
3. Click the **"Security"** button
4. You should see: **🚨 BLOCKLIST ALERT** with rug puller warning!

---

## 🛑 **How to Stop the Bot**

Press `Ctrl+C` in the Command Prompt window

---

## ❌ **Troubleshooting**

### **Problem: "Scripts are disabled"**
**Solution:** Use Command Prompt (cmd.exe) instead of PowerShell, or run the batch file

### **Problem: "npm not recognized"**
**Solution:** Install Node.js from https://nodejs.org/

### **Problem: "BOT_TOKEN not found"**
**Solution:** Check your `.env` file has `BOT_TOKEN=your_actual_token`

### **Problem: Compilation errors**
**Solution:** 
```cmd
npm install
npm run build
```

### **Problem: Bot doesn't respond in Telegram**
**Solution:** 
1. Check bot is running (you should see console output)
2. Verify BOT_TOKEN in `.env` is correct
3. Make sure you clicked "Start" in the bot chat

---

## 📊 **What You'll See When Running**

```
========================================
Starting X1 Wallet Watcher Bot
========================================

Step 1: Compiling TypeScript...

> x1-wallet-watcher-bot@2.0.0 build
> tsc

✓ TypeScript compiled successfully!

Step 2: Starting bot...

[INFO] Loading enhanced security scanner...
[INFO] Blocklist loaded: 60 rug pullers, 1 funder, 1 network
[INFO] Bot started successfully!
[INFO] Bot username: @YourBotName
[INFO] Listening for updates...

Bot is now running! Press Ctrl+C to stop.
```

---

## 🎯 **Commands to Test**

Once bot is running, try these in Telegram:

```
/start          - Welcome message
/help           - Command list
/watch <addr>   - Add wallet to watch
/list           - Show watched wallets
/stats          - Bot statistics
```

**Test the enhanced scanner:**
```
/watch AAaiKNsCrvDvpMfJaq33QcqsXqMHjWFvcCpfpimj1Rbo
Then click: Security button
Result: 🚨 BLOCKLIST ALERT!
```

---

## 🔧 **Configuration**

If you need to change settings, edit `.env` file:

```env
# Your bot token from @BotFather
BOT_TOKEN=8286862350:your_actual_token_here

# X1 RPC endpoint
X1_RPC_URL=https://rpc.mainnet.x1.xyz

# Polling interval (15 seconds)
POLL_INTERVAL=15000
```

---

## 📝 **Keep Bot Running 24/7 (Production)**

### **Option A: Install PM2**
```cmd
npm install -g pm2
pm2 start dist/index.js --name x1-bot
pm2 save
pm2 startup
```

### **Option B: Use Windows Service**
Use a tool like NSSM (Non-Sucking Service Manager)

### **Option C: Keep Terminal Open**
Just leave the Command Prompt window running

---

## 🎉 **Success Checklist**

- [ ] Bot token configured in `.env`
- [ ] TypeScript compiled (`npm run build`)
- [ ] Bot started (`npm start`)
- [ ] Console shows "Bot started successfully"
- [ ] Bot responds to `/start` in Telegram
- [ ] Enhanced scanner shows blocklist alerts
- [ ] All features working

---

## 💡 **Quick Tips**

- **Always use Command Prompt, not PowerShell** (to avoid script execution issues)
- **Keep the terminal window open** while bot is running
- **Check console output** for any errors
- **Test with the rug puller address** to verify enhanced scanner works
- **Restart bot** after any code changes

---

## 📞 **Need Help?**

Check these files:
- `INTEGRATION_COMPLETE.md` - What was integrated
- `IMPLEMENTATION_GUIDE.md` - Detailed guide
- `LIVE_TEST_RESULTS.md` - Test documentation

---

**Your bot with enhanced security scanner is ready to run!** 🛡️

*Just double-click `start-bot.bat` to begin!*

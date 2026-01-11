# 🚀 Quick Start Guide - Local Development for Cloudflare Bot

**For:** Making updates to your Cloudflare-hosted bot  
**Location:** Keep this folder on your PC for development

---

## 📁 What You Have

This folder contains everything you need to develop and update your bot:

### **✨ ONE-CLICK SCRIPTS:**

1. **`START_HERE.bat`** ⭐ **START WITH THIS!**
   - Interactive menu with all options
   - Easy point-and-click interface
   - Perfect for beginners

2. **`DEV_MODE.bat`** - Test Locally
   - Run bot on your PC for testing
   - Live reload (save code = instant update)
   - See changes immediately
   - **Your PC only** (doesn't affect production)

3. **`DEPLOY_NOW.bat`** - Push to Production
   - Deploy your changes to Cloudflare
   - Updates live bot instantly
   - Users see changes immediately

4. **`WATCH_LOGS.bat`** - Monitor Production
   - See real-time user activity
   - Watch bot responses
   - Debug issues live

5. **`CHECK_STATUS.bat`** - Health Check
   - Verify bot is running
   - Check webhook status
   - View recent deployments

---

## 🎯 How to Use (Simple Workflow)

### **When You Want to Update Your Bot:**

#### **Step 1: Open START_HERE.bat** ⭐
```
Double-click: START_HERE.bat
```
You'll see a menu with all options!

#### **Step 2: Choose What You Want:**

**🔧 Option 1 - DEV MODE (Testing)**
- Want to test changes before deploying?
- Click `1` for Dev Mode
- Edit code in `src/` folder
- Save = instant reload
- Test locally on your PC

**🚀 Option 2 - DEPLOY (Go Live)**
- Ready to update the live bot?
- Click `2` to Deploy
- Changes go to Cloudflare instantly
- Users see updates immediately

**📊 Option 3 - WATCH LOGS (Monitor)**
- Want to see what users are doing?
- Click `3` for Live Logs
- See every command in real-time
- Great for debugging

**✅ Option 4 - CHECK STATUS (Health)**
- Is my bot working?
- Click `4` to Check Status
- See health, webhook, deployments

---

## 📝 Making Changes (Step by Step)

### **Complete Workflow:**

1. **Open START_HERE.bat**
   ```
   Double-click START_HERE.bat
   ```

2. **Choose "Dev Mode" (Option 1)**
   - This starts a test version on your PC
   - Bot runs at http://localhost:8787

3. **Edit Your Code**
   - Open folder: `src/`
   - Edit any `.ts` file (TypeScript)
   - Save the file

4. **See Changes Instantly**
   - Dev mode auto-reloads
   - Test immediately
   - No deployment needed yet

5. **When Happy, Deploy**
   - Press Ctrl+C to stop dev mode
   - Run START_HERE.bat again
   - Choose "Deploy" (Option 2)
   - Your changes go live!

---

## 🗂️ Folder Structure

```
cloudflare-worker/
├── START_HERE.bat          ⭐ YOUR MAIN ENTRY POINT
├── DEV_MODE.bat            🔧 Local testing
├── DEPLOY_NOW.bat          🚀 Push to production
├── WATCH_LOGS.bat          📊 Live monitoring
├── CHECK_STATUS.bat        ✅ Health check
├── src/                    📝 YOUR CODE HERE
│   ├── index.ts           (Main bot logic)
│   ├── handlers.ts        (Command handlers)
│   ├── watcher.ts         (Wallet monitoring)
│   ├── security.ts        (Security scanner)
│   └── ...more files
├── wrangler.toml          (Cloudflare config)
└── package.json           (Dependencies)
```

---

## 💡 Common Tasks

### **Task: Add a New Feature**

1. Open `START_HERE.bat`
2. Choose Option 1 (Dev Mode)
3. Edit files in `src/` folder
4. Test locally
5. When working, choose Option 2 (Deploy)
6. Feature is live!

### **Task: Fix a Bug**

1. Open `START_HERE.bat`
2. Choose Option 3 (Watch Logs) - See the error
3. Stop logs (Ctrl+C)
4. Choose Option 1 (Dev Mode)
5. Fix the bug in `src/` folder
6. Test locally
7. Choose Option 2 (Deploy)
8. Bug is fixed!

### **Task: Check If Bot is Working**

1. Open `START_HERE.bat`
2. Choose Option 4 (Check Status)
3. See health report
4. Done!

### **Task: See User Activity**

1. Open `START_HERE.bat`
2. Choose Option 3 (Watch Logs)
3. See real-time activity
4. Press Ctrl+C when done

---

## 🎨 Editing Code

### **Main Files to Edit:**

1. **`src/index.ts`** - Main bot entry point
2. **`src/handlers.ts`** - Command handlers (/start, /help, etc.)
3. **`src/watcher.ts`** - Wallet monitoring logic
4. **`src/security.ts`** - Security scanner
5. **`src/keyboards.ts`** - Telegram keyboard buttons

### **How to Edit:**

1. Open any file with your favorite editor:
   - Notepad
   - VS Code (recommended)
   - Sublime Text
   - Any text editor

2. Make your changes

3. Save the file

4. If in Dev Mode - changes reload automatically
5. If not - deploy to see changes

---

## 🚀 Deployment Process

### **What Happens When You Deploy:**

1. Your code is uploaded to Cloudflare
2. Bot is updated instantly (< 30 seconds)
3. Users see changes immediately
4. No downtime
5. Old version remains available during deploy

### **Deploy Command:**
```
Double-click DEPLOY_NOW.bat
```

**Or from START_HERE.bat menu:**
```
Choose Option 2
```

---

## 📊 Monitoring Production

### **Live Logs:**

Shows you:
- Every user command
- Bot responses
- Errors
- Performance metrics

**How to access:**
```
Double-click WATCH_LOGS.bat
```

**Or from START_HERE.bat menu:**
```
Choose Option 3
```

---

## 🛠️ Development Tips

### **Best Practices:**

1. **Always test in Dev Mode first**
   - Never deploy untested code
   - Use local testing

2. **Watch logs after deploying**
   - Make sure no errors
   - Verify changes work

3. **Keep backups**
   - Git is your friend
   - Cloudflare keeps deployment history

4. **Test with real Telegram account**
   - Message your bot: @X1_Wallet_Watcher_Bot
   - Try all commands

### **If Something Goes Wrong:**

1. Check logs: `WATCH_LOGS.bat`
2. Check status: `CHECK_STATUS.bat`
3. Rollback if needed:
   ```bash
   wrangler rollback --env production --version-id <previous-id>
   ```

---

## 🎯 Quick Reference

| Want to... | Use this... | Click... |
|------------|-------------|----------|
| **Start working** | START_HERE.bat | Double-click |
| **Test changes** | Dev Mode | Option 1 |
| **Push to production** | Deploy | Option 2 |
| **See user activity** | Watch Logs | Option 3 |
| **Check health** | Check Status | Option 4 |
| **Edit code** | Any editor | Open `src/` folder |

---

## 📖 Example Session

### **"I want to add a new command"**

```
1. Double-click START_HERE.bat
2. Choose "1" (Dev Mode)
3. Wait for server to start
4. Open src/handlers.ts
5. Add your new command handler
6. Save the file
7. Test in browser: http://localhost:8787
8. When working, press Ctrl+C
9. Run START_HERE.bat again
10. Choose "2" (Deploy)
11. New command is live!
```

### **"I want to see what users are doing"**

```
1. Double-click START_HERE.bat
2. Choose "3" (Watch Logs)
3. See real-time activity
4. Press Ctrl+C when done
```

### **"I want to check if my bot is running"**

```
1. Double-click START_HERE.bat
2. Choose "4" (Check Status)
3. See health report
```

---

## 🔧 Advanced Usage

### **Manual Commands:**

If you prefer command line:

```bash
# Dev mode
wrangler dev --env production --local

# Deploy
wrangler deploy --env production

# Logs
wrangler tail --env production --format pretty

# Status
wrangler whoami
wrangler deployments list --env production
```

But the `.bat` files make it easier! ⭐

---

## 💾 Where to Keep This

### **Recommended Setup:**

1. Keep this entire `cloudflare-worker` folder on your PC
2. Create a shortcut to `START_HERE.bat` on your desktop
3. When you want to work on the bot, double-click the shortcut
4. That's it!

### **You Can:**
- Turn off your PC anytime (bot keeps running)
- Turn on PC when you want to update
- Work from anywhere (just need this folder + internet)

---

## ✅ Quick Checklist

Before making changes:
- [ ] Open START_HERE.bat
- [ ] Choose Dev Mode (Option 1)
- [ ] Make changes in src/
- [ ] Test locally
- [ ] Stop dev mode (Ctrl+C)
- [ ] Choose Deploy (Option 2)
- [ ] Watch logs to verify (Option 3)
- [ ] Done!

---

## 🎉 You're Ready!

### **Everything You Need:**

✅ **START_HERE.bat** - Your main control panel  
✅ **Dev Mode** - Test changes locally  
✅ **Deploy** - Push to production  
✅ **Logs** - Monitor live activity  
✅ **Status** - Check health  

### **Next Steps:**

1. **Right now:** Double-click `START_HERE.bat`
2. **Try it:** Choose Option 4 (Check Status)
3. **Get familiar:** Explore the menu
4. **Start coding:** When ready, use Dev Mode!

---

## 📞 Need Help?

### **Common Issues:**

**"wrangler: command not found"**
- Install: `npm install -g wrangler`
- Or reinstall Node.js

**"Not logged in to Cloudflare"**
- Run: `wrangler login`
- Follow browser prompts

**"Changes not showing"**
- Make sure you deployed (Option 2)
- Check logs (Option 3)
- Try: Ctrl+Shift+R in Telegram

---

## 🎊 Summary

**You now have a complete local development environment for your Cloudflare bot!**

✅ **Easy scripts** for everything  
✅ **Local testing** before deploying  
✅ **One-click deployment** to production  
✅ **Live monitoring** of your bot  
✅ **Simple workflow** for updates  

**Just open START_HERE.bat and choose what you want to do!** ⭐

---

**Happy coding! Your bot is waiting for your awesome updates!** 🚀

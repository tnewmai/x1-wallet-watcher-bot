# 📱 Setup Phone Alerts - Super Easy Guide!

Get alerts on your phone when your bot crashes. Takes just 5 minutes!

---

## 🎯 What You'll Get

- A message on your phone if the bot stops working
- A message when the bot recovers
- Peace of mind! 😊

---

## 📝 Step-by-Step Setup (EASY!)

### Step 1: Create an Alert Bot

We need a SECOND bot just for sending you alerts. Don't worry, it's easy!

1. **Open Telegram on your phone**

2. **Search for @BotFather** (yes, the same one you used before)

3. **Start a chat with BotFather**

4. **Type:** `/newbot`

5. **BotFather will ask:** "What's the name of your bot?"
   - **Type something like:** "My Alert Bot" or "X1 Alerts"

6. **BotFather will ask:** "What's the username?"
   - **Type something like:** "myalerts_bot" or "x1alerts_bot"
   - Must end with "bot"

7. **BotFather gives you a TOKEN** - looks like:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
   - **Copy this!** You'll need it in a moment

8. **Important:** Start a chat with your NEW alert bot
   - Search for the bot name you just created
   - Click "Start" button
   - This is important! (The bot needs permission to message you)

### Step 2: Get Your Telegram ID

1. **Still in Telegram, search for:** @userinfobot

2. **Start a chat with it**

3. **Send it ANY message** (just type "hi")

4. **It will reply with your information**
   - Look for the line that says: `Id: 123456789`
   - **Copy this number!**

### Step 3: Configure the Alert System

Now we put those two pieces together:

**Option A: Easy Way (Windows)**

1. Open the folder where your bot is installed

2. Find the `alerts` folder and open it

3. Right-click on `telegram-alert.js` and choose "Edit" or "Open with Notepad"

4. Find these two lines near the top:
   ```javascript
   const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
   const YOUR_TELEGRAM_ID = 'YOUR_TELEGRAM_ID_HERE';
   ```

5. Replace them with YOUR information:
   ```javascript
   const TELEGRAM_BOT_TOKEN = '1234567890:ABCdefGHI...'; // Paste your token here
   const YOUR_TELEGRAM_ID = '123456789'; // Paste your ID here
   ```

6. **Save the file** (Ctrl+S or File → Save)

**Option B: Using Environment Variables (Slightly More Secure)**

1. Create a file called `.env` in the `alerts` folder

2. Add these two lines:
   ```
   ALERT_BOT_TOKEN=1234567890:ABCdefGHI...
   YOUR_TELEGRAM_ID=123456789
   ```

3. Save the file

### Step 4: Start the Alert Monitor

1. **Open Command Prompt or PowerShell**
   - Press Windows key, type "cmd", press Enter

2. **Navigate to the alerts folder:**
   ```
   cd path\to\x1-wallet-watcher-bot\alerts
   ```
   
   Replace `path\to\` with the actual location

3. **Run the alert monitor:**
   ```
   node telegram-alert.js
   ```

4. **You should see:**
   - "Alert Monitor Started!"
   - You'll get a test message on your phone in Telegram!

5. **Leave this window open!**
   - Just like the bot, this needs to run in the background
   - Minimize it, but don't close it

---

## ✅ Testing It Works

### Test 1: Check You Got the Test Message

When you started the monitor, you should have received a message on your phone in Telegram that says:
```
🤖 Alert Monitor Started!

Your X1 Wallet Bot is now being monitored.
You will receive alerts if it stops working.
```

**Got it?** ✅ Great! It's working!

**Didn't get it?** Double-check:
- Did you click "Start" on your alert bot?
- Is the token correct?
- Is your ID correct?

### Test 2: Simulate a Crash (Optional)

Want to see what an alert looks like?

1. Stop your main bot (close the bot window)
2. Wait 3 minutes
3. You should get a message: "🚨 ALERT! Your X1 Wallet Bot has STOPPED WORKING!"
4. Start your bot again
5. You should get: "✅ GOOD NEWS! Your bot has recovered!"

---

## 📱 What the Alerts Look Like

### When Bot Crashes:
```
🚨 ALERT!

Your X1 Wallet Bot has STOPPED WORKING!

Error: Connection refused
Time: 2026-01-09 12:30:45

Please check on it!
```

### When Bot Recovers:
```
✅ GOOD NEWS!

Your X1 Wallet Bot has recovered 
and is working again!

Time: 2026-01-09 12:35:20
```

### When Bot Has Issues:
```
⚠️ WARNING!

Your X1 Wallet Bot is having problems!

Status: degraded
Time: 2026-01-09 12:32:10

It might need your attention.
```

---

## 🔧 Troubleshooting

### "I didn't get the test message"

**Check these:**
1. Did you start a chat with your alert bot? (Click the "Start" button)
2. Is your bot token correct?
3. Is your Telegram ID correct?
4. Did you save the file after editing?

**Try this:**
1. Stop the monitor (Ctrl+C in the window)
2. Check your configuration again
3. Start it again: `node telegram-alert.js`

### "It says 'NOT CONFIGURED YET'"

You need to edit the configuration! See Step 3 above.

### "The monitor keeps stopping"

You need to keep that window open, just like the main bot.

**Better solution:** Set it up to run as a background service (I can help with this)

---

## 💡 Pro Tips

### Keep Both Windows Open

You need TWO windows running:
1. **Main bot window** (from START_BOT.bat)
2. **Alert monitor window** (from telegram-alert.js)

Both need to stay open!

### Create a Shortcut

Make it easier to start:

1. Create a file called `START_ALERTS.bat` in the `alerts` folder
2. Put this inside:
   ```batch
   @echo off
   node telegram-alert.js
   pause
   ```
3. Double-click it to start the alert monitor!

### Run on Startup (Advanced)

Want alerts to start automatically when your computer starts?

1. Press Win+R
2. Type: `shell:startup`
3. Copy your `START_ALERTS.bat` shortcut into this folder
4. Done! It will start with Windows

---

## ❓ Common Questions

**Q: Do I need to pay for this?**
A: No! It's completely free.

**Q: Will I get too many alerts?**
A: No! It only alerts after 3 minutes of problems, so you won't get spammed.

**Q: Can I use my existing bot instead of creating a new one?**
A: Technically yes, but it's better to have a separate bot for alerts.

**Q: What if I turn off my phone?**
A: The messages will be waiting when you turn it back on!

**Q: Can I add more people to get alerts?**
A: Yes! Just give them the alert bot token and have them start the monitor with their own Telegram ID.

---

## 🎉 Done!

You're all set! Now you'll get alerts on your phone if anything goes wrong. 

**Next steps:**
- Keep both windows open (main bot + alert monitor)
- Check your phone - you should have received a test message
- Relax! You'll be notified if anything goes wrong

**Need help?** Just ask! 😊

# 🧪 Bot Testing Guide - Complete Checklist

**Bot:** @X1_Wallet_Watcher_Bot  
**Status:** ✅ Live on Cloudflare  
**Version:** 3c4b40d5 (with blockchain scanning)

---

## ✅ **Automated Tests - PASSED**

### **Test 1: Health Endpoint** ✅
- Status: `ok`
- Environment: `production`
- Token: ✅ Configured
- KV Storage: ✅ Connected

### **Test 2: Webhook** ✅
- URL: `https://x1-wallet-watcher-bot-production.tnewmai.workers.dev`
- Status: ✅ Active
- Pending Updates: 0
- Errors: None
- IP: 104.21.37.221

### **Test 3: Bot Identity** ✅
- Username: @X1_Wallet_Watcher_Bot
- Name: X1 Wallet Sniffer
- ID: 8286862350
- Status: ✅ Operational

---

## 📱 **Manual Testing in Telegram**

### **How to Test:**

1. **Open Telegram**
2. **Search:** `@X1_Wallet_Watcher_Bot`
3. **Start chat** (or send `/start`)
4. **Follow tests below**

---

## 🧪 **Test Checklist**

### **TEST 1: Basic Commands** ⬜

#### **1.1 Start Command**
```
Send: /start
Expected: Welcome message with bot introduction
Status: [ ]
```

#### **1.2 Help Command**
```
Send: /help
Expected: List of all available commands
Status: [ ]
```

---

### **TEST 2: Wallet Management** ⬜

#### **2.1 Add Wallet**
```
Send: /add
Expected: Prompt to enter wallet address
Action: Send a wallet address (e.g., 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb)
Expected: Confirmation message, wallet added
Status: [ ]
```

#### **2.2 View Wallets**
```
Send: /wallets
Expected: List of your monitored wallets (should show the one you just added)
Status: [ ]
```

#### **2.3 Remove Wallet**
```
Send: /remove
Expected: List of wallets with remove buttons
Action: Click remove button
Expected: Wallet removed confirmation
Status: [ ]
```

---

### **TEST 3: Security Scanner** ⬜ **CRITICAL TEST**

#### **3.1 Click "🚨 SNIFF FOR RUGS" Button**
```
Location: Shown in wallet list (/wallets command)
Action: Click "🚨 SNIFF FOR RUGS" button next to a wallet
Expected: 
  - "Scanning..." message appears
  - After 3-8 seconds, detailed report shown with:
    ✓ Blocklist check results
    ✓ Blockchain analysis results
    ✓ Funding source information
    ✓ Token deployment status
    ✓ Risk score and level
    ✓ Recommendations
Status: [ ]
```

**Test Wallets to Try:**

**Safe Wallet (should be clean):**
```
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Expected: LOW risk, no threats detected
```

**Known Deployer (if any in blocklist):**
```
Use any wallet from your ENHANCED_RUGGER_BLOCKLIST.json
Expected: CRITICAL risk, known rug puller detected
```

---

### **TEST 4: Wallet Monitoring** ⬜

#### **4.1 Add Active Wallet**
```
Add a wallet that has activity on X1 blockchain
Expected: Bot monitors it and sends notifications for new transactions
Status: [ ]
```

**Note:** You may need to wait for actual transactions to test notifications.

---

### **TEST 5: Settings** ⬜

#### **5.1 Settings Command**
```
Send: /settings
Expected: Settings menu with notification options
Status: [ ]
```

---

### **TEST 6: Performance** ⬜

#### **6.1 Response Time**
```
Send any command (e.g., /help)
Expected: Response within 1-2 seconds
Status: [ ]
```

#### **6.2 Security Scan Time**
```
Click "🚨 SNIFF FOR RUGS"
Expected: Results within 3-8 seconds
Status: [ ]
```

---

## 🎯 **Critical Tests**

### **MUST PASS:**

1. ✅ **Bot responds to /start**
2. ✅ **Can add wallet**
3. ✅ **"🚨 SNIFF FOR RUGS" button works**
4. ✅ **Security scan shows blockchain data** (not just blocklist)
5. ✅ **Bot is fast** (< 2 sec for commands, < 8 sec for scans)

---

## 🔍 **What to Look For in Security Scan**

### **Should Show:**

✅ **Blocklist Results:**
- "Known Rug Puller: YES/NO"
- "In Scam Network: YES/NO"
- "Suspicious Funder: YES/NO"

✅ **Blockchain Analysis (NEW!):**
- "Token Deployer: YES/NO"
- "Deployed Tokens: [count]"
- "Funding Source: [address or Unknown]"
- "Transaction History: [analyzed]"
- "Suspicious Patterns: [detected patterns]"

✅ **Risk Assessment:**
- "Risk Score: [0-100]"
- "Risk Level: LOW/MEDIUM/HIGH/CRITICAL"
- "Recommendation: [action to take]"

---

## ❌ **Common Issues & Fixes**

### **Issue: Bot not responding**
```
Fix: Check webhook status (should be active)
Command: Already verified in automated tests ✅
```

### **Issue: Security scan returns "Error"**
```
Fix: Check if RPC URL is working
Test: Visit https://rpc.mainnet.x1.xyz in browser
```

### **Issue: Scan only shows blocklist, no blockchain data**
```
Fix: This was the old version - should be fixed now!
Verify: Scan should show "Transaction History" and "Funding Source"
```

### **Issue: Scan takes too long (>30 seconds)**
```
Fix: May be RPC issue or too much data
Check: Try a wallet with less transaction history
```

---

## 📊 **Expected Results Summary**

### **For Clean Wallet:**
```
✅ Blocklist: Not in blocklist
✅ Blockchain: Normal activity or no activity
✅ Risk Score: 0-20
✅ Risk Level: LOW
✅ Recommendation: Safe to interact
```

### **For Known Rug Puller:**
```
⚠️ Blocklist: FOUND in known rug pullers
⚠️ Blockchain: May show token deployments
⚠️ Risk Score: 80-100
⚠️ Risk Level: CRITICAL
⚠️ Recommendation: DO NOT INTERACT - KNOWN SCAMMER
```

### **For Token Deployer (not in blocklist):**
```
⚠️ Blocklist: Not in blocklist
⚠️ Blockchain: Deployed [N] tokens
⚠️ Risk Score: 30-60
⚠️ Risk Level: MEDIUM/HIGH
⚠️ Recommendation: CAUTION - Monitor closely
```

---

## 🎯 **Testing Checklist Summary**

Use this quick checklist:

- [ ] Bot responds to /start
- [ ] Bot responds to /help
- [ ] Can add wallet
- [ ] Can view wallets
- [ ] Can remove wallet
- [ ] "🚨 SNIFF FOR RUGS" button appears
- [ ] Security scan completes
- [ ] Scan shows blocklist results
- [ ] Scan shows blockchain analysis (NEW!)
- [ ] Scan shows funding source (NEW!)
- [ ] Scan shows risk score
- [ ] Scan completes in < 8 seconds
- [ ] Settings menu works
- [ ] All responses are fast (< 2 sec)

---

## 📝 **How to Report Results**

After testing, tell me:

1. **What worked:** List tests that passed ✅
2. **What didn't work:** List tests that failed ❌
3. **Any errors:** Copy exact error messages
4. **Scan results:** Did you see blockchain data?

---

## 🎉 **Ready to Test!**

**Start here:**
1. Open Telegram
2. Search: @X1_Wallet_Watcher_Bot
3. Send: /start
4. Follow the tests above
5. Report back results!

**Most Important Test:**
- Add a wallet
- Click "🚨 SNIFF FOR RUGS"
- Verify you see **both blocklist AND blockchain data**

---

**Good luck with testing!** 🚀

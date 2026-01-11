# 🚀 GitHub Quick Commands - tnewmai

**Repository:** https://github.com/tnewmai/x1-wallet-watcher-bot

---

## ⚡ Quick Push (For You!)

### **Step 1: Create Repository on GitHub**

1. Go to: **https://github.com/new**
2. Repository name: **`x1-wallet-watcher-bot`**
3. Description: **"X1 Blockchain wallet monitoring bot with security scanning"**
4. Choose: **Private** (recommended) or Public
5. **DON'T** check "Initialize this repository with a README"
6. Click **"Create repository"**

### **Step 2: Push Your Code**

**Option A: Use the Script (Easiest)**
```
Double-click: PUSH_TO_GITHUB.bat
```

**Option B: Command Line**
```bash
cd x1-wallet-watcher-bot
git branch -M main
git push -u origin main
```

---

## 🔐 Authentication

If Git asks for credentials:

### **Option 1: GitHub CLI (Recommended)**
```bash
# Install GitHub CLI from: https://cli.github.com/
gh auth login
```

### **Option 2: Personal Access Token**
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (all)
4. Generate and copy token
5. Use token as password when pushing

### **Option 3: GitHub Desktop**
- Download: https://desktop.github.com/
- Login automatically
- Add repository
- Push with one click

---

## 📊 Your Repository Info

```
Username: tnewmai
Repository: x1-wallet-watcher-bot
URL: https://github.com/tnewmai/x1-wallet-watcher-bot
Remote: origin
Branch: main
```

---

## 🔄 Daily Workflow

### **After Making Changes:**

```bash
# Check what changed
git status

# Add all changes
git add .

# Commit with message
git commit -m "Your change description"

# Push to GitHub
git push
```

**Or just use PUSH_TO_GITHUB.bat!**

---

## ✅ Verify Push Success

After pushing, check:
1. Go to: https://github.com/tnewmai/x1-wallet-watcher-bot
2. You should see all your files
3. Check commit message
4. Verify sensitive files are NOT there (.env, data.json)

---

## 🆘 Troubleshooting

### **"Repository not found"**
→ Create repository first: https://github.com/new

### **"Authentication failed"**
→ Use `gh auth login` or create personal access token

### **"Remote origin already exists"**
```bash
git remote remove origin
git remote add origin https://github.com/tnewmai/x1-wallet-watcher-bot.git
```

### **"Push rejected"**
```bash
git pull origin main --rebase
git push
```

---

## 📝 Commands Ready to Use

All set up for username: **tnewmai**

Just create the repo and push! 🚀

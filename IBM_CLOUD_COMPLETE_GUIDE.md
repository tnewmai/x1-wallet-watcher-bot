# IBM Cloud Kubernetes - Complete Beginner's Guide

## 🎯 What We're Going to Do

Deploy your X1 Wallet Watcher Bot on IBM Cloud's FREE Kubernetes cluster that:
- Runs 24/7 forever
- Costs $0/month (truly free)
- Handles 100-150 users easily
- Has 4GB RAM and 2 vCPUs
- Located in Dallas (great for USA/EU users)

**Total Time:** 1-2 hours (including waiting time)
**Difficulty:** Beginner-friendly (I'll explain everything!)
**Cost:** $0 (no credit card needed)

---

## 📋 Prerequisites

Before we start, make sure you have:

- [ ] A computer (Windows, Mac, or Linux)
- [ ] Internet connection
- [ ] Your Telegram Bot Token (from @BotFather)
- [ ] X1 RPC URL (https://x1-mainnet.infrafc.org)
- [ ] Email address (for IBM Cloud signup)
- [ ] 1-2 hours of time

**You DO NOT need:**
- ❌ Credit card
- ❌ Previous Kubernetes experience
- ❌ Server management experience
- ❌ Money!

---

## 🚀 STEP-BY-STEP GUIDE

---

## STEP 1: Sign Up for IBM Cloud (5-10 minutes)

### 1.1 Go to IBM Cloud Website

Open your browser and go to: **https://cloud.ibm.com/registration**

### 1.2 Fill Out Registration Form

```
Email: your-email@gmail.com (use your real email)
Password: Create a strong password (save it!)
Country: India
```

Click **"Next"**

### 1.3 Verify Your Email

1. Check your email inbox
2. Look for email from IBM Cloud
3. Click the verification link
4. You'll be redirected back to IBM Cloud

### 1.4 Complete Your Profile

```
First Name: Your first name
Last Name: Your last name
Country: India
Phone: Your mobile number (+91...)
```

**Important:** You'll receive an SMS verification code.

### 1.5 Accept Terms

- Check the box for Terms and Conditions
- Click **"Create Account"**

### 1.6 Skip Payment Information

When asked for payment method:
- Click **"Skip for now"** or "Maybe later"
- Or just close the popup

**You don't need a credit card for the free tier!**

### ✅ Checkpoint 1: You should now be on the IBM Cloud Dashboard

The URL will be: `https://cloud.ibm.com/`

---

## STEP 2: Create Free Kubernetes Cluster (5 min setup + 20-30 min wait)

### 2.1 Go to Kubernetes Service

From the IBM Cloud Dashboard:

1. Click the **"☰" menu** (hamburger icon) in top-left
2. Navigate to: **"Kubernetes"** → **"Clusters"**
3. Or go directly to: https://cloud.ibm.com/kubernetes/catalog/create

### 2.2 Choose Free Cluster

You'll see two options:
- **Free cluster** ← Choose this!
- Standard cluster (costs money)

Click on **"Free"** plan

### 2.3 Configure Your Cluster

```yaml
Cluster name: x1-bot-cluster (or any name you like)

Location: 
  - Geography: North America
  - Region: Dallas (us-south)
  - Zones: Automatically selected

Resource group: Default

Kubernetes version: Latest stable (usually 1.28 or higher)
```

### 2.4 Review & Create

1. Review your selections:
   - Plan: Free
   - Location: Dallas
   - Name: x1-bot-cluster
   
2. Click **"Create"** button

### 2.5 Wait for Cluster Provisioning

**This takes 20-30 minutes** ⏰

You'll see:
```
Status: Provisioning... (orange dot)
```

**What to do while waiting:**
- ✅ Keep the browser tab open
- ✅ Proceed to Step 3 (install CLI tools)
- ✅ Grab a coffee ☕
- ✅ Don't close the browser

The status will change to:
```
Status: Normal (green dot) ✅
```

When you see the green dot, your cluster is ready!

### ✅ Checkpoint 2: Cluster is provisioning (or ready)

---

## STEP 3: Install IBM Cloud CLI (10-15 minutes)

While your cluster is provisioning, let's install the tools you need.

### 3.1 Choose Your Operating System

#### **For Windows:**

**Option A: Using PowerShell (Recommended)**

1. Open **PowerShell as Administrator**
   - Press `Win + X`
   - Click "Windows PowerShell (Admin)"

2. Run this command:
```powershell
Set-ExecutionPolicy Unrestricted -Scope Process
Invoke-Expression (Invoke-WebRequest -Uri "https://clis.cloud.ibm.com/install/powershell" -UseBasicParsing).Content
```

3. Wait for installation (5-10 minutes)

**Option B: Download Installer**

1. Go to: https://github.com/IBM-Cloud/ibm-cloud-cli-release/releases
2. Download: `IBM_Cloud_CLI_x.x.x_windows_amd64.exe` (latest version)
3. Run the installer
4. Click Next → Next → Install

#### **For Mac:**

Open Terminal and run:
```bash
curl -fsSL https://clis.cloud.ibm.com/install/osx | sh
```

#### **For Linux:**

Open Terminal and run:
```bash
curl -fsSL https://clis.cloud.ibm.com/install/linux | sh
```

### 3.2 Verify Installation

Close and reopen your terminal/PowerShell, then run:
```bash
ibmcloud --version
```

You should see:
```
ibmcloud version 2.x.x
```

✅ If you see a version number, it's installed correctly!

### 3.3 Install Kubernetes Plugin

Run:
```bash
ibmcloud plugin install kubernetes-service
```

Type `y` when prompted, then wait for installation.

### 3.4 Install kubectl (Kubernetes CLI)

**For Windows (PowerShell as Admin):**
```powershell
curl.exe -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"
mkdir "$env:USERPROFILE\bin"
move kubectl.exe "$env:USERPROFILE\bin\"
$env:Path += ";$env:USERPROFILE\bin"
[System.Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
```

**For Mac:**
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

**For Linux:**
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### 3.5 Verify kubectl Installation

```bash
kubectl version --client
```

You should see version information.

### ✅ Checkpoint 3: IBM Cloud CLI and kubectl are installed

---

## STEP 4: Login to IBM Cloud (5 minutes)

### 4.1 Login via CLI

Open your terminal/PowerShell and run:

```bash
ibmcloud login
```

### 4.2 Enter Your Credentials

You'll be prompted:

```
Email: [Enter your IBM Cloud email]
Password: [Enter your password]
```

**If you have multiple accounts:**
```
Select an account:
1. Your Account Name
> 1
```

**Select region:**
```
Select a region:
1. us-south (Dallas)
2. us-east
...
> 1
```

Choose **us-south (Dallas)** - where your cluster is!

### 4.3 Confirm Login

You should see:
```
Targeted account Your Account Name (xxx)
API endpoint:   https://cloud.ibm.com
Region:         us-south
...
```

✅ You're now logged in!

### ✅ Checkpoint 4: Successfully logged into IBM Cloud via CLI

---

## STEP 5: Connect to Your Kubernetes Cluster (5 minutes)

### 5.1 Check Cluster Status

First, verify your cluster is ready:

```bash
ibmcloud ks clusters
```

You should see:
```
Name              ID        State    Created      Workers   Location   Version
x1-bot-cluster    xxxxx     normal   X hours ago  1         dal10      1.28.x
```

**State must be "normal"** (green) before proceeding!

If it says "provisioning", wait a few more minutes and check again.

### 5.2 Connect to Your Cluster

Run this command (replace cluster name if you used a different one):

```bash
ibmcloud ks cluster config --cluster x1-bot-cluster
```

You'll see:
```
OK
The configuration for x1-bot-cluster was downloaded successfully.

Export environment variables to start using Kubernetes:
export KUBECONFIG=/path/to/.bluemix/plugins/...
```

**Copy and run the export command** shown in your output.

**For Windows PowerShell**, it will show:
```powershell
$env:KUBECONFIG = "C:\path\to\config"
```

Run that command!

### 5.3 Verify Connection

```bash
kubectl get nodes
```

You should see:
```
NAME           STATUS   ROLES    AGE   VERSION
10.x.x.x       Ready    <none>   1h    v1.28.x
```

✅ You're connected to your Kubernetes cluster!

### ✅ Checkpoint 5: Connected to Kubernetes cluster

---

## STEP 6: Prepare Your Bot for Deployment (15 minutes)

### 6.1 Understand What We're Doing

We need to create Kubernetes configuration files that tell the cluster:
- What Docker image to run (your bot)
- What environment variables to use (BOT_TOKEN, etc.)
- How much memory/CPU to allocate
- How to keep the bot running 24/7

### 6.2 Create Kubernetes Deployment File

I'll help you create the necessary files. First, let's check if you already have Kubernetes configs:

```bash
cd x1-wallet-watcher-bot
ls kubernetes/
```

If you see `deployment.yaml`, great! If not, we'll create it.

### 6.3 Create or Update deployment.yaml

Create/update file: `kubernetes/deployment.yaml`

This file is already in your project! Let me show you what's important in it.

### 6.4 Create Secret for Environment Variables

We need to store your sensitive information (BOT_TOKEN) securely.

**Create a file:** `kubernetes/secret.yaml`

But first, we need to encode your credentials. Let me help you with that.

### ✅ Checkpoint 6: Kubernetes files prepared

---

## STEP 7: Deploy Your Bot (10 minutes)

### 7.1 Create Namespace (Optional but Recommended)

```bash
kubectl create namespace x1-bot
```

This creates an isolated space for your bot.

### 7.2 Set Default Namespace

```bash
kubectl config set-context --current --namespace=x1-bot
```

### 7.3 Create Secret with Your Credentials

Replace with your actual values:

```bash
kubectl create secret generic x1-bot-secrets \
  --from-literal=BOT_TOKEN='your_actual_bot_token_here' \
  --from-literal=X1_RPC_URL='https://x1-mainnet.infrafc.org' \
  -n x1-bot
```

**For Windows PowerShell, use:**
```powershell
kubectl create secret generic x1-bot-secrets `
  --from-literal=BOT_TOKEN='your_actual_bot_token_here' `
  --from-literal=X1_RPC_URL='https://x1-mainnet.infrafc.org' `
  -n x1-bot
```

### 7.4 Deploy the Bot

```bash
kubectl apply -f kubernetes/deployment.yaml -n x1-bot
```

You should see:
```
deployment.apps/x1-wallet-watcher created
```

### 7.5 Check Deployment Status

```bash
kubectl get pods -n x1-bot
```

You'll see:
```
NAME                                 READY   STATUS    RESTARTS   AGE
x1-wallet-watcher-xxxxxxxxx-xxxxx    0/1     Pending   0          10s
```

Status will change:
1. `Pending` → Pod is being scheduled
2. `ContainerCreating` → Docker image is being pulled
3. `Running` → Bot is live! ✅

**This can take 2-5 minutes for first deployment**

Keep checking:
```bash
kubectl get pods -n x1-bot -w
```

(The `-w` flag watches for changes. Press Ctrl+C to stop)

### ✅ Checkpoint 7: Bot is deployed and running!

---

## STEP 8: Verify Bot is Working (5 minutes)

### 8.1 Check Pod Logs

```bash
# Get the pod name
kubectl get pods -n x1-bot

# View logs (replace POD_NAME with actual name)
kubectl logs -f x1-wallet-watcher-xxxxxxxxx-xxxxx -n x1-bot
```

You should see your bot's startup logs:
```
🤖 Starting X1 Wallet Watcher Bot...
✅ Connected to X1 RPC
✅ Bot initialized
📡 Listening for commands...
```

### 8.2 Test on Telegram

1. Open Telegram
2. Find your bot
3. Send `/start`
4. You should get a response!

### 8.3 Test Basic Commands

Try these:
```
/start - Should show welcome message
/help - Should show help
/status - Should show bot status
```

### ✅ Checkpoint 8: Bot is working on Telegram!

---

## STEP 9: Set Up Monitoring (10 minutes)

### 9.1 Check Resource Usage

```bash
kubectl top pods -n x1-bot
```

You'll see:
```
NAME                                CPU   MEMORY
x1-wallet-watcher-xxx               50m   150Mi
```

### 9.2 View IBM Cloud Dashboard

1. Go to https://cloud.ibm.com/kubernetes/clusters
2. Click on your cluster: `x1-bot-cluster`
3. Click "Kubernetes dashboard" button
4. Explore the visual interface

### 9.3 Set Up Alerts (Optional)

IBM Cloud has basic monitoring built-in. You can view:
- CPU usage
- Memory usage
- Network traffic
- Pod health

### ✅ Checkpoint 9: Monitoring is set up

---

## 🎉 CONGRATULATIONS!

Your bot is now running on IBM Cloud Kubernetes!

### What You've Accomplished:

✅ Created free IBM Cloud account (no card needed)
✅ Deployed free Kubernetes cluster (4GB RAM, 2 vCPU)
✅ Learned basic Kubernetes commands
✅ Deployed your bot to production
✅ Set up monitoring
✅ Running 24/7 for FREE forever!

### Quick Reference Commands:

```bash
# View pods
kubectl get pods -n x1-bot

# View logs
kubectl logs -f POD_NAME -n x1-bot

# Restart bot
kubectl rollout restart deployment/x1-wallet-watcher -n x1-bot

# Check resource usage
kubectl top pods -n x1-bot

# Describe pod (for debugging)
kubectl describe pod POD_NAME -n x1-bot
```

---

## 🔧 Common Issues & Solutions

### Issue 1: Pod stuck in "Pending"

**Check why:**
```bash
kubectl describe pod POD_NAME -n x1-bot
```

**Common causes:**
- Insufficient resources (unlikely on free cluster)
- Image pull issues

**Solution:**
```bash
# Check events
kubectl get events -n x1-bot --sort-by='.lastTimestamp'
```

### Issue 2: Pod in "CrashLoopBackOff"

**This means your bot is crashing on startup.**

**Check logs:**
```bash
kubectl logs POD_NAME -n x1-bot
```

**Common causes:**
- Missing BOT_TOKEN
- Invalid environment variables
- Code errors

**Solution:**
1. Check your secret:
```bash
kubectl get secret x1-bot-secrets -n x1-bot -o yaml
```

2. Delete and recreate secret with correct values
3. Restart deployment

### Issue 3: Can't connect to cluster

**Solution:**
```bash
# Re-login
ibmcloud login

# Re-configure cluster
ibmcloud ks cluster config --cluster x1-bot-cluster

# Export the KUBECONFIG (shown in output)
```

### Issue 4: Image pull errors

**If using private Docker image:**

You need to create an image pull secret. Let me know if you need help with this.

---

## 📚 What's Next?

### Learn More Kubernetes:
- `kubectl get` - View resources
- `kubectl describe` - Detailed info
- `kubectl logs` - View logs
- `kubectl exec` - Run commands in pod
- `kubectl delete` - Delete resources

### Optimize Your Deployment:
- Add health checks (liveness/readiness probes)
- Set resource limits
- Add horizontal pod autoscaling
- Deploy to multiple regions

### Add Features:
- Set up Redis for caching
- Add PostgreSQL database
- Implement webhooks (instead of polling)
- Add metrics with Prometheus

---

## 💰 Cost Reminder

**Your free tier includes:**
- ✅ 1 worker node (2 vCPU, 4GB RAM)
- ✅ Unlimited pods (within resource limits)
- ✅ Free forever (no expiration)
- ✅ No credit card required

**Limitations:**
- Only 1 free cluster per account
- Can't upgrade free cluster (must create new paid one)
- Free cluster expires after 30 days of inactivity (just restart it)

**To keep free cluster active:**
- Use it regularly
- Or just run `kubectl get nodes` once a week

---

## 🆘 Need Help?

If you encounter issues:

1. **Check pod logs:**
```bash
kubectl logs -f POD_NAME -n x1-bot
```

2. **Describe pod for events:**
```bash
kubectl describe pod POD_NAME -n x1-bot
```

3. **Check IBM Cloud status:**
https://cloud.ibm.com/status

4. **IBM Cloud Docs:**
https://cloud.ibm.com/docs/containers

---

You're all set! Your bot is running on enterprise-grade infrastructure for FREE! 🚀

# IBM Cloud Kubernetes Deployment Script (PowerShell)
# Run this after you've created your cluster and logged in

Write-Host "🚀 IBM Cloud X1 Bot Deployment Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if required commands exist
$kubectlExists = Get-Command kubectl -ErrorAction SilentlyContinue
$ibmcloudExists = Get-Command ibmcloud -ErrorAction SilentlyContinue

if (-not $kubectlExists) {
    Write-Host "❌ kubectl is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

if (-not $ibmcloudExists) {
    Write-Host "❌ ibmcloud CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Prompt for cluster name
$CLUSTER_NAME = Read-Host "Enter your cluster name [default: x1-bot-cluster]"
if ([string]::IsNullOrWhiteSpace($CLUSTER_NAME)) {
    $CLUSTER_NAME = "x1-bot-cluster"
}

Write-Host "📡 Connecting to cluster: $CLUSTER_NAME" -ForegroundColor Blue
ibmcloud ks cluster config --cluster $CLUSTER_NAME

Write-Host ""
Write-Host "📋 Creating namespace..." -ForegroundColor Blue
kubectl create namespace x1-bot --dry-run=client -o yaml | kubectl apply -f -

Write-Host ""
Write-Host "🔑 Please enter your bot credentials:" -ForegroundColor Yellow
$BOT_TOKEN = Read-Host "Telegram Bot Token"
$X1_RPC_URL = Read-Host "X1 RPC URL [default: https://x1-mainnet.infrafc.org]"
if ([string]::IsNullOrWhiteSpace($X1_RPC_URL)) {
    $X1_RPC_URL = "https://x1-mainnet.infrafc.org"
}

Write-Host ""
Write-Host "🔐 Creating secrets..." -ForegroundColor Blue
kubectl create secret generic x1-bot-secrets `
  --from-literal=BOT_TOKEN="$BOT_TOKEN" `
  --namespace=x1-bot `
  --dry-run=client -o yaml | kubectl apply -f -

Write-Host ""
Write-Host "📦 Applying configurations..." -ForegroundColor Blue
kubectl apply -f kubernetes/deployment-ibm-simple.yaml

Write-Host ""
Write-Host "⏳ Waiting for deployment..." -ForegroundColor Blue
kubectl wait --for=condition=available --timeout=300s deployment/x1-wallet-watcher -n x1-bot

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Pod status:" -ForegroundColor Blue
kubectl get pods -n x1-bot

Write-Host ""
Write-Host "📝 View logs with:" -ForegroundColor Blue
$POD_NAME = kubectl get pods -n x1-bot -l app=x1-wallet-watcher -o jsonpath='{.items[0].metadata.name}'
Write-Host "kubectl logs -f $POD_NAME -n x1-bot"

Write-Host ""
Write-Host "🎉 Your bot should now be running!" -ForegroundColor Green
Write-Host "Test it on Telegram by sending /start to your bot" -ForegroundColor Yellow

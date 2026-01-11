# Start X1 Wallet Watcher Bot with Monitoring Enabled
# PowerShell version

Write-Host "🚀 Starting X1 Wallet Watcher Bot with Monitoring..." -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env from .env.example"
    exit 1
}

# Check if ADMIN_USER_IDS is set
$envContent = Get-Content .env -Raw
if ($envContent -notmatch "ADMIN_USER_IDS=") {
    Write-Host "⚠️  Warning: ADMIN_USER_IDS not set in .env" -ForegroundColor Yellow
    Write-Host "You won't receive monitoring alerts!"
    Write-Host ""
    Write-Host "To fix:"
    Write-Host "1. Find your Telegram ID by messaging @userinfobot"
    Write-Host "2. Add to .env: ADMIN_USER_IDS=your_telegram_id"
    Write-Host ""
    
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Build TypeScript
Write-Host "📦 Building TypeScript..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Start monitoring stack with Docker (optional)
if ($args[0] -eq "--with-prometheus") {
    Write-Host "📊 Starting Prometheus monitoring stack..." -ForegroundColor Cyan
    docker-compose -f docker-compose.monitoring.yml up -d
    Write-Host "✅ Prometheus: http://localhost:9090" -ForegroundColor Green
    Write-Host "✅ Alertmanager: http://localhost:9093" -ForegroundColor Green
    Write-Host "✅ Grafana: http://localhost:3001" -ForegroundColor Green
    Write-Host ""
}

# Start the bot
Write-Host "🤖 Starting bot..." -ForegroundColor Cyan

if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    # Use PM2 if available
    pm2 start ecosystem.config.js --env production
    Write-Host ""
    Write-Host "✅ Bot started with PM2!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Commands:" -ForegroundColor Cyan
    Write-Host "  pm2 logs x1-wallet-bot    - View logs"
    Write-Host "  pm2 monit                 - Monitor resources"
    Write-Host "  pm2 restart x1-wallet-bot - Restart bot"
    Write-Host "  pm2 stop x1-wallet-bot    - Stop bot"
} else {
    # Run directly
    node dist/index.js
}

Write-Host ""
Write-Host "🎉 Bot is running with monitoring enabled!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Admin commands (send to your bot):" -ForegroundColor Cyan
Write-Host "  /status       - View current resource usage"
Write-Host "  /limits       - Detailed limit information"
Write-Host "  /health       - Overall system health"
Write-Host "  /alerts_test  - Test alert system"
Write-Host ""

# X1 Wallet Watcher Bot - Windows Deployment Script
# PowerShell deployment script for Windows users

Write-Host "🚀 X1 Wallet Watcher Bot - Windows Deployment Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "📝 Please copy .env.example to .env and configure it:" -ForegroundColor Yellow
    Write-Host "   copy .env.example .env" -ForegroundColor White
    Write-Host "   notepad .env" -ForegroundColor White
    exit 1
}

# Check if BOT_TOKEN is set
$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch "BOT_TOKEN=.+") {
    Write-Host "❌ BOT_TOKEN not set in .env file!" -ForegroundColor Red
    Write-Host "📝 Please edit .env and add your Telegram bot token" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Configuration file found" -ForegroundColor Green
Write-Host ""

# Function to check if container is running
function Test-ContainerRunning {
    $container = docker ps --format "{{.Names}}" | Select-String "x1-wallet-watcher-bot"
    return $null -ne $container
}

# Function to check health endpoint
function Test-Health {
    $port = if ($env:HEALTH_CHECK_PORT) { $env:HEALTH_CHECK_PORT } else { 3000 }
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/health" -TimeoutSec 5 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Stop existing container if running
if (Test-ContainerRunning) {
    Write-Host "⏹️  Stopping existing container..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "✅ Container stopped" -ForegroundColor Green
    Write-Host ""
}

# Build and start the container
Write-Host "🔨 Building Docker image..." -ForegroundColor Cyan
docker-compose build --no-cache

Write-Host ""
Write-Host "🚀 Starting container..." -ForegroundColor Cyan
docker-compose up -d

Write-Host ""
Write-Host "⏳ Waiting for bot to start (30 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check if container is running
if (Test-ContainerRunning) {
    Write-Host "✅ Container is running" -ForegroundColor Green
} else {
    Write-Host "❌ Container failed to start" -ForegroundColor Red
    Write-Host "📋 Check logs with: docker-compose logs" -ForegroundColor Yellow
    exit 1
}

# Check health endpoint
Write-Host ""
Write-Host "🔍 Checking bot health..." -ForegroundColor Cyan
if (Test-Health) {
    Write-Host "✅ Bot is healthy!" -ForegroundColor Green
    
    # Show health status
    Write-Host ""
    Write-Host "📊 Health Status:" -ForegroundColor Cyan
    $port = if ($env:HEALTH_CHECK_PORT) { $env:HEALTH_CHECK_PORT } else { 3000 }
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$port/health"
        $health | ConvertTo-Json
    } catch {
        Write-Host "Could not fetch detailed health info" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Health check endpoint not responding (this may be normal if disabled)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Useful commands:" -ForegroundColor Cyan
Write-Host "   View logs:        docker-compose logs -f" -ForegroundColor White
Write-Host "   Stop bot:         docker-compose down" -ForegroundColor White
Write-Host "   Restart bot:      docker-compose restart" -ForegroundColor White
$port = if ($env:HEALTH_CHECK_PORT) { $env:HEALTH_CHECK_PORT } else { 3000 }
Write-Host "   Check health:     Invoke-WebRequest http://localhost:$port/health" -ForegroundColor White
Write-Host "   View metrics:     Invoke-WebRequest http://localhost:$port/metrics" -ForegroundColor White
Write-Host ""

# Bot Diagnostic Script
# This script checks if your bot is properly configured

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   X1 Bot Diagnostics Tool" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Get bot token from secrets (secure way)
Write-Host "Getting BOT_TOKEN from Wrangler secrets..." -ForegroundColor Yellow
$secretsList = wrangler secret list --env production | ConvertFrom-Json

$hasToken = $secretsList | Where-Object { $_.name -eq "BOT_TOKEN" }

if (-not $hasToken) {
    Write-Host "❌ BOT_TOKEN secret not found!" -ForegroundColor Red
    exit
}

Write-Host "✅ BOT_TOKEN secret exists" -ForegroundColor Green

# Ask user to provide token for testing (won't be stored)
Write-Host "`nTo test the bot, please enter your BOT_TOKEN:" -ForegroundColor Yellow
Write-Host "(It won't be saved, only used for testing)" -ForegroundColor Gray
$token = Read-Host "BOT_TOKEN"

if (-not $token -or $token -eq "") {
    Write-Host "❌ No token provided. Exiting." -ForegroundColor Red
    exit
}

Write-Host "`n=== Testing Bot Token ===" -ForegroundColor Cyan

try {
    $botInfo = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getMe" -Method GET
    
    if ($botInfo.ok) {
        Write-Host "✅ Bot Token is VALID!" -ForegroundColor Green
        Write-Host "   Username: @$($botInfo.result.username)" -ForegroundColor White
        Write-Host "   Name: $($botInfo.result.first_name)" -ForegroundColor White
        Write-Host "   ID: $($botInfo.result.id)" -ForegroundColor White
    } else {
        Write-Host "❌ Bot Token is INVALID" -ForegroundColor Red
        exit
    }
} catch {
    Write-Host "❌ Error checking bot token: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

Write-Host "`n=== Checking Webhook Status ===" -ForegroundColor Cyan

try {
    $webhookInfo = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo" -Method GET
    
    Write-Host "   Webhook URL: $($webhookInfo.result.url)" -ForegroundColor White
    Write-Host "   Pending Updates: $($webhookInfo.result.pending_update_count)" -ForegroundColor White
    
    if ($webhookInfo.result.last_error_message) {
        Write-Host "   ❌ Last Error: $($webhookInfo.result.last_error_message)" -ForegroundColor Red
        Write-Host "   Error Date: $([DateTimeOffset]::FromUnixTimeSeconds($webhookInfo.result.last_error_date).LocalDateTime)" -ForegroundColor Red
    } else {
        Write-Host "   ✅ No errors reported" -ForegroundColor Green
    }
    
    Write-Host "   Has Custom Certificate: $($webhookInfo.result.has_custom_certificate)" -ForegroundColor White
    Write-Host "   Max Connections: $($webhookInfo.result.max_connections)" -ForegroundColor White
    
    if ($webhookInfo.result.allowed_updates) {
        Write-Host "   Allowed Updates: $($webhookInfo.result.allowed_updates -join ', ')" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Error checking webhook: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Testing Webhook Endpoint ===" -ForegroundColor Cyan

# Send a test message
Write-Host "Sending test /getMe command to verify bot works..." -ForegroundColor Yellow

try {
    $testMe = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getMe" -Method GET
    Write-Host "✅ Bot API is responding correctly" -ForegroundColor Green
} catch {
    Write-Host "❌ Bot API error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Recommendations ===" -ForegroundColor Cyan

if ($webhookInfo.result.last_error_message) {
    Write-Host "`n⚠️  Telegram is reporting errors when calling your webhook!" -ForegroundColor Yellow
    Write-Host "   This means:" -ForegroundColor White
    Write-Host "   1. Telegram IS trying to send updates to your worker" -ForegroundColor White
    Write-Host "   2. But something is failing on your worker's side" -ForegroundColor White
    Write-Host "`n   Error: $($webhookInfo.result.last_error_message)" -ForegroundColor Red
    Write-Host "`n   Possible causes:" -ForegroundColor Yellow
    Write-Host "   - grammy library not compatible with Cloudflare Workers" -ForegroundColor White
    Write-Host "   - @solana/web3.js causing issues" -ForegroundColor White
    Write-Host "   - Initialization errors in the worker" -ForegroundColor White
} elseif ($webhookInfo.result.pending_update_count -gt 0) {
    Write-Host "`n⚠️  There are $($webhookInfo.result.pending_update_count) pending updates!" -ForegroundColor Yellow
    Write-Host "   This means Telegram has messages waiting to be processed." -ForegroundColor White
} else {
    Write-Host "`n✅ Webhook looks healthy!" -ForegroundColor Green
    Write-Host "   Try sending /start to @$($botInfo.result.username) now" -ForegroundColor White
}

Write-Host "`n========================================`n" -ForegroundColor Cyan

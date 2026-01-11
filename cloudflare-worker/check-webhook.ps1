# Quick script to check webhook status using the API
$botUsername = "X1_Wallet_Watcher_Bot"

Write-Host "`n=== Checking Webhook Status for @$botUsername ===" -ForegroundColor Cyan

# Get webhook info through our worker's API
try {
    Write-Host "`nCalling Telegram API through our worker..." -ForegroundColor Yellow
    
    # We'll use a debug endpoint to get webhook info
    $result = Invoke-RestMethod -Uri "https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/debug"
    
    Write-Host "✅ Bot is configured: @$($result.bot.username)" -ForegroundColor Green
    Write-Host "`nNow let's check if Telegram is calling our webhook..." -ForegroundColor Yellow
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Instructions to Check Webhook ===" -ForegroundColor Cyan
Write-Host "`n1. Open this URL in your browser:" -ForegroundColor Yellow
Write-Host "   https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo" -ForegroundColor White
Write-Host "`n2. Replace <YOUR_TOKEN> with your actual BOT_TOKEN" -ForegroundColor Gray
Write-Host "`n3. Look for:" -ForegroundColor Yellow
Write-Host "   - 'url': Should be https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/webhook" -ForegroundColor White
Write-Host "   - 'last_error_message': Any errors from Telegram" -ForegroundColor White
Write-Host "   - 'pending_update_count': Number of waiting messages" -ForegroundColor White

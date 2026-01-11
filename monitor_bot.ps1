# Quick bot status checker
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  X1 Wallet Watcher Bot - Status Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Find bot process
$botProcess = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
    $cmd -like "*dist/index.js*"
}

if (-not $botProcess) {
    Write-Host "`n❌ Bot is NOT running" -ForegroundColor Red
    Write-Host "`nTo start the bot, run:" -ForegroundColor Yellow
    Write-Host "  npm start" -ForegroundColor White
    Write-Host "  or" -ForegroundColor Yellow
    Write-Host "  START_BOT.bat" -ForegroundColor White
    exit 1
}

# Bot is running - get stats
$uptime = (Get-Date) - $botProcess.StartTime
$memoryMB = [math]::Round($botProcess.WorkingSet / 1MB, 1)
$cpuSeconds = [math]::Round($botProcess.CPU, 2)

Write-Host "`n✅ Bot is RUNNING" -ForegroundColor Green
Write-Host "`nProcess Info:" -ForegroundColor Yellow
Write-Host "  PID:         $($botProcess.Id)" -ForegroundColor White
Write-Host "  Started:     $($botProcess.StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
Write-Host "  Uptime:      $($uptime.Days)d $($uptime.Hours)h $($uptime.Minutes)m $($uptime.Seconds)s" -ForegroundColor White
Write-Host "  Memory:      $memoryMB MB" -ForegroundColor White
Write-Host "  CPU Time:    $cpuSeconds seconds" -ForegroundColor White

# Check health endpoint
Write-Host "`nHealth Check:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $health = $response.Content | ConvertFrom-Json
    
    $statusColor = switch ($health.status) {
        "healthy" { "Green" }
        "degraded" { "Yellow" }
        default { "Red" }
    }
    
    Write-Host "  Status:      $($health.status.ToUpper())" -ForegroundColor $statusColor
    Write-Host "  RPC:         $($health.checks.rpc.status)" -ForegroundColor $(if ($health.checks.rpc.status -eq "ok") { "Green" } else { "Red" })
    Write-Host "  Storage:     $($health.checks.storage.status)" -ForegroundColor $(if ($health.checks.storage.status -eq "ok") { "Green" } else { "Red" })
    Write-Host "  Bot:         $($health.checks.bot.status)" -ForegroundColor $(if ($health.checks.bot.status -eq "ok") { "Green" } else { "Red" })
    Write-Host "  Memory:      $($health.checks.memory.status)" -ForegroundColor $(if ($health.checks.memory.status -eq "ok" -or $health.checks.memory.status -eq "warning") { "Yellow" } else { "Red" })
    
    Write-Host "`n✅ Health endpoint is responsive" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Health endpoint not responding" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nEndpoints:" -ForegroundColor Yellow
Write-Host "  Health:      http://localhost:3000/health" -ForegroundColor White
Write-Host "  Ready:       http://localhost:3000/ready" -ForegroundColor White
Write-Host "  Live:        http://localhost:3000/live" -ForegroundColor White
Write-Host "  Metrics:     http://localhost:3000/metrics" -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host ""

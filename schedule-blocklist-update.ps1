# Schedule Blocklist Update (Windows)
# 
# This script sets up a Windows Task Scheduler job to automatically update the blocklist daily at 3 AM
# 
# Usage:
#   Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File schedule-blocklist-update.ps1

param(
    [string]$Time = "03:00",  # 3 AM by default
    [string]$Frequency = "Daily"
)

$ErrorActionPreference = 'Stop'

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   X1 Wallet Watcher - Blocklist Update Scheduler" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Get script directory
$ScriptDir = $PSScriptRoot
$LogDir = Join-Path $ScriptDir "logs"
$LogFile = Join-Path $LogDir "blocklist-update.log"

# Create logs directory if it doesn't exist
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Task details
$TaskName = "X1-WalletWatcher-BlocklistUpdate"
$TaskDescription = "Automatically updates the X1 Wallet Watcher blocklist with new rug pullers from xDEX"

# Check if task already exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "⚠️  Task '$TaskName' already exists!" -ForegroundColor Yellow
    Write-Host ""
    $Response = Read-Host "Do you want to recreate it? (Y/N)"
    
    if ($Response -ne "Y" -and $Response -ne "y") {
        Write-Host "Cancelled. Existing task kept." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the scheduled task action
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$ScriptDir'; npm run update-blocklist >> '$LogFile' 2>&1`"" `
    -WorkingDirectory $ScriptDir

# Create the trigger (daily at specified time)
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time

# Task settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Create the principal (run whether user is logged on or not)
$Principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType S4U `
    -RunLevel Limited

# Register the scheduled task
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Description $TaskDescription `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Force | Out-Null
    
    Write-Host "✅ Blocklist update scheduled successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  Name: $TaskName" -ForegroundColor White
    Write-Host "  Schedule: $Frequency at $Time" -ForegroundColor White
    Write-Host "  Command: npm run update-blocklist" -ForegroundColor White
    Write-Host "  Log File: $LogFile" -ForegroundColor White
    Write-Host ""
    Write-Host "Management:" -ForegroundColor Cyan
    Write-Host "  View: taskschd.msc (Task Scheduler)" -ForegroundColor White
    Write-Host "  Run now: " -NoNewline -ForegroundColor White
    Write-Host "Get-ScheduledTask -TaskName '$TaskName' | Start-ScheduledTask" -ForegroundColor Yellow
    Write-Host "  Remove: " -NoNewline -ForegroundColor White
    Write-Host "Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "❌ Failed to create scheduled task: $_" -ForegroundColor Red
    exit 1
}

# Test if we can run npm
Write-Host "Testing npm availability..." -ForegroundColor Yellow
try {
    $NpmVersion = & npm --version 2>&1
    Write-Host "✅ npm version: $NpmVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Warning: npm not found in PATH" -ForegroundColor Yellow
    Write-Host "   The scheduled task may fail. Ensure Node.js is installed and in PATH." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

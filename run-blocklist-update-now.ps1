# Run Blocklist Update Manually (Windows)
# 
# Usage:
#   powershell -File run-blocklist-update-now.ps1

$ErrorActionPreference = 'Continue'

$ScriptDir = $PSScriptRoot
$LogDir = Join-Path $ScriptDir "logs"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "blocklist-update-manual-$Timestamp.log"

# Create logs directory
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Running Blocklist Update Manually" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
Write-Host "Log file: $LogFile`n" -ForegroundColor Yellow

cd $ScriptDir

# Run the update and capture output
$Output = & npm run update-blocklist 2>&1 | Tee-Object -FilePath $LogFile

$ExitCode = $LASTEXITCODE

Write-Host ""
if ($ExitCode -eq 0) {
    Write-Host "✅ Update completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Update failed with exit code: $ExitCode" -ForegroundColor Red
    Write-Host "Check log file for details: $LogFile" -ForegroundColor Yellow
}

exit $ExitCode

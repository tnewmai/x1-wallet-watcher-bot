@echo off
REM Quick start script for bot monitoring (Windows)

echo ========================================
echo   X1 Bot Health Monitor - Setup
echo ========================================
echo.

REM Check if alerts directory exists
if not exist alerts (
    echo Error: alerts directory not found!
    pause
    exit /b 1
)

cd alerts

REM Check if webhook-monitor.js exists
if not exist webhook-monitor.js (
    echo Error: webhook-monitor.js not found!
    pause
    exit /b 1
)

echo Select monitoring type:
echo   1. Console only (no alerts)
echo   2. Slack alerts
echo   3. Discord alerts
echo.
set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    echo Starting console-only monitor...
    node webhook-monitor.js
) else if "%choice%"=="2" (
    set /p webhook="Enter Slack webhook URL: "
    echo Starting Slack monitor...
    set WEBHOOK_URL=%webhook%
    set WEBHOOK_TYPE=slack
    node webhook-monitor.js
) else if "%choice%"=="3" (
    set /p webhook="Enter Discord webhook URL: "
    echo Starting Discord monitor...
    set WEBHOOK_URL=%webhook%
    set WEBHOOK_TYPE=discord
    node webhook-monitor.js
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

@echo off
title X1 Wallet Watcher Bot (Auto-Restart)
cd /d "%~dp0"

REM Set Node.js memory limit to 512MB
set NODE_OPTIONS=--max-old-space-size=512

echo ========================================
echo   X1 Wallet Watcher Bot
echo   Auto-Restart Enabled
echo   Memory Limit: 512MB
echo ========================================
echo.

:BUILD
echo Building project...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    timeout /t 10
    goto BUILD
)

:START
echo.
echo Starting bot... (will auto-restart on crash)
echo Press Ctrl+C to stop permanently
echo.

node dist/index.js

REM If bot exits, wait 5 seconds and restart
echo.
echo Bot stopped. Restarting in 5 seconds...
echo Press Ctrl+C now to cancel restart
echo.
timeout /t 5
goto START

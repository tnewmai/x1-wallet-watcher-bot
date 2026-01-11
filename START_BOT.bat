@echo off
title X1 Wallet Watcher Bot
cd /d "%~dp0"

REM Set Node.js memory limit to 512MB to prevent crashes
set NODE_OPTIONS=--max-old-space-size=512

echo ========================================
echo   X1 Wallet Watcher Bot
echo   Memory Limit: 512MB
echo ========================================
echo.
echo Building project...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo.
echo Starting bot with memory protection...
echo.
call npm start

@echo off
echo ========================================
echo Restarting X1 Wallet Watcher Bot
echo ========================================
echo.

cd /d "%~dp0"

echo Stopping any running instances...
taskkill /F /FI "WINDOWTITLE eq X1 Wallet Watcher Bot*" 2>nul

echo.
echo Recompiling...
call npm run build

echo.
echo Starting bot with optimizations...
echo.
echo ⚡ INSTANT BLOCKLIST ALERTS NOW ENABLED! ⚡
echo Known rug pullers will be flagged in < 1 second!
echo.

node dist/index.js

pause

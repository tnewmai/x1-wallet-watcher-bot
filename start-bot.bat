@echo off
echo ========================================
echo Starting X1 Wallet Watcher Bot
echo ========================================
echo.

cd /d "%~dp0"

REM Set Node.js memory limit to 512MB to prevent crashes
set NODE_OPTIONS=--max-old-space-size=512

echo Step 1: Compiling TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: TypeScript compilation failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Starting bot with 512MB memory limit...
echo.
echo Bot is now running! Press Ctrl+C to stop.
echo Logs are saved to bot-output.log and bot-error.log
echo.

node dist/index.js

pause

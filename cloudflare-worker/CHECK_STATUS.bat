@echo off
title X1 Bot - Status Check
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║        BOT STATUS CHECK                               ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

echo Checking Cloudflare account...
wrangler whoami
echo.

echo Checking bot health...
curl -s https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/health
echo.
echo.

echo Checking recent deployments...
wrangler deployments list --env production
echo.

echo Checking webhook status...
cd ..
for /f "tokens=2 delims==" %%a in ('findstr /b "BOT_TOKEN=" .env') do set BOT_TOKEN=%%a
curl -s "https://api.telegram.org/bot%BOT_TOKEN%/getWebhookInfo"
echo.
echo.

echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║        STATUS CHECK COMPLETE                          ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

pause

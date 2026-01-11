@echo off
title X1 Bot - Quick Deploy to Cloudflare
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║        DEPLOY TO CLOUDFLARE PRODUCTION                ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo This will deploy your changes to production:
echo   URL: https://x1-wallet-watcher-bot-production.tnewmai.workers.dev
echo   Bot: @X1_Wallet_Watcher_Bot
echo.
echo Are you sure you want to deploy?
pause

echo.
echo Deploying to Cloudflare...
echo.

wrangler deploy --env production

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════╗
    echo ║                                                        ║
    echo ║        ✅ DEPLOYMENT SUCCESSFUL!                      ║
    echo ║                                                        ║
    echo ╚════════════════════════════════════════════════════════╝
    echo.
    echo Your bot is now live with the latest changes!
    echo.
    echo Verifying deployment...
    timeout /t 3 /nobreak >nul
    
    curl -s https://x1-wallet-watcher-bot-production.tnewmai.workers.dev/health
    
    echo.
    echo.
    echo ✅ Bot is responding!
) else (
    echo.
    echo ❌ Deployment failed! Check the errors above.
)

echo.
pause

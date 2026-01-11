@echo off
title X1 Bot - Live Production Logs
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║        LIVE PRODUCTION LOGS                           ║
echo ║        Real-time monitoring                           ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Connecting to Cloudflare production logs...
echo You'll see every request in real-time!
echo.
echo Press Ctrl+C to stop monitoring
echo.
pause

wrangler tail --env production --format pretty

pause

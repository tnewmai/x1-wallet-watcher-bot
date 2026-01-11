@echo off
title X1 Bot - Development Mode (Live Preview)
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║        X1 Wallet Watcher Bot - DEV MODE               ║
echo ║        Live Preview with Hot Reload                   ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo This will start a local development server with:
echo   - Live code reloading (save = instant update)
echo   - Local testing environment
echo   - Same environment as production
echo.
echo Press Ctrl+C to stop when done testing
echo.
pause

echo.
echo Starting development server...
echo.

wrangler dev --env production --local

pause

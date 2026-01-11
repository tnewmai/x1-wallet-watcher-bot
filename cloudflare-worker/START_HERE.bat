@echo off
title X1 Bot - Quick Start Menu
cd /d "%~dp0"
color 0A

:MENU
cls
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║        X1 WALLET WATCHER BOT - CONTROL PANEL          ║
echo ║        Bot: @X1_Wallet_Watcher_Bot                    ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo    Choose an option:
echo.
echo    [1] 🔧 DEV MODE - Test changes locally
echo        (Live reload, instant feedback)
echo.
echo    [2] 🚀 DEPLOY - Push to production
echo        (Update live bot on Cloudflare)
echo.
echo    [3] 📊 WATCH LOGS - Monitor production
echo        (See real-time bot activity)
echo.
echo    [4] ✅ CHECK STATUS - View bot health
echo        (Check deployment, webhook, health)
echo.
echo    [5] 📝 EDIT CODE - Open in VS Code
echo        (Quick access to source files)
echo.
echo    [6] 📖 DOCUMENTATION - View guides
echo        (Open documentation folder)
echo.
echo    [0] ❌ EXIT
echo.
echo ════════════════════════════════════════════════════════
echo.

set /p choice="Enter your choice (0-6): "

if "%choice%"=="1" goto DEV
if "%choice%"=="2" goto DEPLOY
if "%choice%"=="3" goto LOGS
if "%choice%"=="4" goto STATUS
if "%choice%"=="5" goto EDIT
if "%choice%"=="6" goto DOCS
if "%choice%"=="0" goto END

echo Invalid choice! Please try again.
timeout /t 2 >nul
goto MENU

:DEV
cls
echo.
echo Starting Development Mode...
echo.
call DEV_MODE.bat
goto MENU

:DEPLOY
cls
echo.
echo Deploying to Production...
echo.
call DEPLOY_NOW.bat
goto MENU

:LOGS
cls
echo.
echo Opening Live Logs...
echo.
call WATCH_LOGS.bat
goto MENU

:STATUS
cls
echo.
echo Checking Status...
echo.
call CHECK_STATUS.bat
goto MENU

:EDIT
cls
echo.
echo Opening code in VS Code...
echo.
if exist "C:\Program Files\Microsoft VS Code\Code.exe" (
    start "" "C:\Program Files\Microsoft VS Code\Code.exe" "%~dp0src"
) else (
    start "" "%~dp0src"
)
echo.
echo Code editor opened!
timeout /t 2 >nul
goto MENU

:DOCS
cls
echo.
echo Opening documentation...
echo.
start "" "%~dp0.."
echo.
echo Documentation folder opened!
timeout /t 2 >nul
goto MENU

:END
cls
echo.
echo ════════════════════════════════════════════════════════
echo.
echo    Thanks for using X1 Wallet Watcher Bot!
echo    Your bot is running 24/7 on Cloudflare ☁️
echo.
echo ════════════════════════════════════════════════════════
echo.
timeout /t 2 >nul
exit

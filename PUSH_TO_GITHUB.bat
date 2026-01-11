@echo off
title Push to GitHub - x1-wallet-watcher-bot
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║                                                        ║
echo ║        PUSH TO GITHUB                                 ║
echo ║        Repository: tnewmai/x1-wallet-watcher-bot      ║
echo ║                                                        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

echo This will push your code to GitHub.
echo.
echo Repository: https://github.com/tnewmai/x1-wallet-watcher-bot
echo.
echo IMPORTANT: You need to create the repository on GitHub first!
echo Go to: https://github.com/new
echo.
echo Have you created the repository on GitHub? (Y/N)
set /p confirm="Enter Y to continue: "

if /i NOT "%confirm%"=="Y" (
    echo.
    echo Cancelled. Please create the repository first.
    echo.
    pause
    exit /b 1
)

echo.
echo Pushing to GitHub...
echo.

git branch -M main
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════╗
    echo ║                                                        ║
    echo ║        ✅ PUSH SUCCESSFUL!                            ║
    echo ║                                                        ║
    echo ╚════════════════════════════════════════════════════════╝
    echo.
    echo Your code is now on GitHub!
    echo View at: https://github.com/tnewmai/x1-wallet-watcher-bot
    echo.
) else (
    echo.
    echo ❌ Push failed!
    echo.
    echo Common issues:
    echo 1. Repository doesn't exist - Create it at: https://github.com/new
    echo 2. Authentication needed - Run: gh auth login
    echo 3. Wrong permissions - Check repository settings
    echo.
)

pause

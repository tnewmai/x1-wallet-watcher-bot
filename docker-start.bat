@echo off
REM Quick Docker deployment script for Windows

echo =========================================
echo   X1 Wallet Watcher Bot - Docker Setup
echo =========================================
echo.

REM Check if .env exists
if not exist .env (
    echo Warning: No .env file found. Creating from .env.example...
    if exist .env.example (
        copy .env.example .env
        echo Created .env file
        echo.
        echo IMPORTANT: Edit .env and set your BOT_TOKEN!
        echo    notepad .env
        echo.
        pause
    ) else (
        echo Error: No .env.example found. Please create .env manually.
        exit /b 1
    )
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

echo Building Docker image...
docker-compose -f docker-compose.production.yml build

echo.
echo Starting bot...
docker-compose -f docker-compose.production.yml up -d

echo.
echo Waiting for bot to start...
timeout /t 5 /nobreak >nul

echo.
echo Checking bot status...
docker-compose -f docker-compose.production.yml ps

echo.
echo Health check...
curl -s http://localhost:3000/health 2>nul
if errorlevel 1 (
    echo Health check not responding yet (this is normal during startup)
) else (
    echo Bot is healthy!
)

echo.
echo =========================================
echo   Bot Deployment Complete!
echo =========================================
echo.
echo Useful commands:
echo   View logs:    docker-compose -f docker-compose.production.yml logs -f
echo   Stop bot:     docker-compose -f docker-compose.production.yml down
echo   Restart:      docker-compose -f docker-compose.production.yml restart
echo   Health:       curl http://localhost:3000/health
echo.
pause

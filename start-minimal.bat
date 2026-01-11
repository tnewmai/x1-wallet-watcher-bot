@echo off
REM Quick start script for minimal edition (Windows)

echo 🚀 Starting X1 Wallet Watcher Bot - Minimal Edition
echo.

REM Check if package-minimal.json exists
if not exist "package-minimal.json" (
    echo ❌ Error: package-minimal.json not found
    exit /b 1
)

REM Check if .env exists
if not exist ".env" (
    echo ⚠️  .env file not found, copying from example...
    if exist ".env-minimal.example" (
        copy .env-minimal.example .env
        echo ✅ Created .env from example
        echo ⚠️  Please edit .env and add your BOT_TOKEN
        pause
        exit /b 1
    ) else (
        echo ❌ Error: .env-minimal.example not found
        pause
        exit /b 1
    )
)

REM Copy minimal configs
echo 📦 Setting up minimal configuration...
copy /Y package-minimal.json package.json
copy /Y tsconfig-minimal.json tsconfig.json
echo ✅ Configuration files updated

REM Install dependencies
echo 📦 Installing dependencies...
call npm install --production

REM Build
echo 🔨 Building...
call npm run build

REM Check if build succeeded
if not exist "dist" (
    echo ❌ Build failed
    pause
    exit /b 1
)

REM Create data directory
if not exist "data" mkdir data

echo.
echo ✅ Setup complete!
echo.
echo Starting bot...
echo.

REM Start bot
call npm start

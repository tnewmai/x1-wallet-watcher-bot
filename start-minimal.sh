#!/bin/bash

# Quick start script for minimal edition

echo "🚀 Starting X1 Wallet Watcher Bot - Minimal Edition"
echo ""

# Check if package-minimal.json exists
if [ ! -f "package-minimal.json" ]; then
    echo "❌ Error: package-minimal.json not found"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found, copying from example..."
    if [ -f ".env-minimal.example" ]; then
        cp .env-minimal.example .env
        echo "✅ Created .env from example"
        echo "⚠️  Please edit .env and add your BOT_TOKEN"
        exit 1
    else
        echo "❌ Error: .env-minimal.example not found"
        exit 1
    fi
fi

# Check if BOT_TOKEN is set
source .env
if [ -z "$BOT_TOKEN" ] || [ "$BOT_TOKEN" = "your_telegram_bot_token_here" ]; then
    echo "❌ Error: BOT_TOKEN not set in .env"
    echo "Please edit .env and add your Telegram bot token"
    exit 1
fi

# Copy minimal configs if not already done
if [ ! -f "package.json" ] || ! grep -q "minimal" package.json; then
    echo "📦 Setting up minimal configuration..."
    cp package-minimal.json package.json
    cp tsconfig-minimal.json tsconfig.json
    echo "✅ Configuration files updated"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build
echo "🔨 Building..."
npm run build

# Check if build succeeded
if [ ! -d "dist" ]; then
    echo "❌ Build failed"
    exit 1
fi

# Create data directory
mkdir -p data

echo ""
echo "✅ Setup complete!"
echo ""
echo "Starting bot..."
echo ""

# Start bot
npm start

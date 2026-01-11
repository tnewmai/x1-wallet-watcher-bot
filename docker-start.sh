#!/bin/bash
# Quick Docker deployment script for X1 Wallet Watcher Bot

set -e

echo "========================================="
echo "  X1 Wallet Watcher Bot - Docker Setup"
echo "========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env and set your BOT_TOKEN!"
        echo "   nano .env"
        echo ""
        read -p "Press Enter after setting BOT_TOKEN to continue..."
    else
        echo "❌ No .env.example found. Please create .env manually."
        exit 1
    fi
fi

# Check if BOT_TOKEN is set
if ! grep -q "BOT_TOKEN=.*[^[:space:]]" .env; then
    echo "❌ BOT_TOKEN not set in .env file!"
    echo "   Please edit .env and set your bot token."
    exit 1
fi

echo "📦 Building Docker image..."
docker-compose -f docker-compose.production.yml build

echo ""
echo "🚀 Starting bot..."
docker-compose -f docker-compose.production.yml up -d

echo ""
echo "⏳ Waiting for bot to start..."
sleep 5

echo ""
echo "🔍 Checking bot status..."
docker-compose -f docker-compose.production.yml ps

echo ""
echo "📊 Health check..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Bot is healthy!"
    curl -s http://localhost:3000/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/health
else
    echo "⚠️  Health check not responding yet (this is normal during startup)"
fi

echo ""
echo "========================================="
echo "  Bot Deployment Complete!"
echo "========================================="
echo ""
echo "Useful commands:"
echo "  View logs:    docker-compose -f docker-compose.production.yml logs -f"
echo "  Stop bot:     docker-compose -f docker-compose.production.yml down"
echo "  Restart:      docker-compose -f docker-compose.production.yml restart"
echo "  Health:       curl http://localhost:3000/health"
echo ""

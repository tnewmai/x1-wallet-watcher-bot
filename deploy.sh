#!/bin/bash

# X1 Wallet Watcher Bot - Deployment Script
# This script helps deploy or restart the bot with proper checks

set -e

echo "🚀 X1 Wallet Watcher Bot - Deployment Script"
echo "============================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Please copy .env.example to .env and configure it:"
    echo "   cp .env.example .env"
    echo "   nano .env"
    exit 1
fi

# Check if BOT_TOKEN is set
if ! grep -q "BOT_TOKEN=.*[a-zA-Z0-9]" .env; then
    echo "❌ BOT_TOKEN not set in .env file!"
    echo "📝 Please edit .env and add your Telegram bot token"
    exit 1
fi

echo "✅ Configuration file found"
echo ""

# Function to check if container is running
check_container_status() {
    if docker ps --format '{{.Names}}' | grep -q "x1-wallet-watcher-bot"; then
        return 0
    else
        return 1
    fi
}

# Function to check health endpoint
check_health() {
    local port=${HEALTH_CHECK_PORT:-3000}
    if curl -sf "http://localhost:${port}/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Stop existing container if running
if check_container_status; then
    echo "⏹️  Stopping existing container..."
    docker-compose down
    echo "✅ Container stopped"
    echo ""
fi

# Build and start the container
echo "🔨 Building Docker image..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting container..."
docker-compose up -d

echo ""
echo "⏳ Waiting for bot to start (30 seconds)..."
sleep 30

# Check if container is running
if check_container_status; then
    echo "✅ Container is running"
else
    echo "❌ Container failed to start"
    echo "📋 Check logs with: docker-compose logs"
    exit 1
fi

# Check health endpoint
echo ""
echo "🔍 Checking bot health..."
if check_health; then
    echo "✅ Bot is healthy!"
    
    # Show health status
    echo ""
    echo "📊 Health Status:"
    curl -s http://localhost:${HEALTH_CHECK_PORT:-3000}/health | jq '.'
else
    echo "⚠️  Health check endpoint not responding (this may be normal if disabled)"
fi

echo ""
echo "============================================"
echo "✅ Deployment complete!"
echo ""
echo "📋 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop bot:         docker-compose down"
echo "   Restart bot:      docker-compose restart"
echo "   Check health:     curl http://localhost:${HEALTH_CHECK_PORT:-3000}/health"
echo "   View metrics:     curl http://localhost:${HEALTH_CHECK_PORT:-3000}/metrics"
echo ""

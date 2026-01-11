#!/bin/bash
# Start X1 Wallet Watcher Bot with Monitoring Enabled

set -e

echo "🚀 Starting X1 Wallet Watcher Bot with Monitoring..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env from .env.example"
    exit 1
fi

# Check if ADMIN_USER_IDS is set
if ! grep -q "ADMIN_USER_IDS=" .env; then
    echo "⚠️  Warning: ADMIN_USER_IDS not set in .env"
    echo "You won't receive monitoring alerts!"
    echo ""
    echo "To fix:"
    echo "1. Find your Telegram ID by messaging @userinfobot"
    echo "2. Add to .env: ADMIN_USER_IDS=your_telegram_id"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Load environment
source .env

# Build TypeScript
echo "📦 Building TypeScript..."
npm run build || {
    echo "❌ Build failed!"
    exit 1
}

# Start monitoring stack with Docker (optional)
if [ "$1" = "--with-prometheus" ]; then
    echo "📊 Starting Prometheus monitoring stack..."
    docker-compose -f docker-compose.monitoring.yml up -d
    echo "✅ Prometheus: http://localhost:9090"
    echo "✅ Alertmanager: http://localhost:9093"
    echo "✅ Grafana: http://localhost:3001"
    echo ""
fi

# Start the bot
echo "🤖 Starting bot..."

if command -v pm2 &> /dev/null; then
    # Use PM2 if available
    pm2 start ecosystem.config.js --env production
    echo ""
    echo "✅ Bot started with PM2!"
    echo ""
    echo "📋 Commands:"
    echo "  pm2 logs x1-wallet-bot    - View logs"
    echo "  pm2 monit                 - Monitor resources"
    echo "  pm2 restart x1-wallet-bot - Restart bot"
    echo "  pm2 stop x1-wallet-bot    - Stop bot"
else
    # Run directly
    node dist/index.js
fi

echo ""
echo "🎉 Bot is running with monitoring enabled!"
echo ""
echo "📱 Admin commands (send to your bot):"
echo "  /status  - View current resource usage"
echo "  /limits  - Detailed limit information"
echo "  /health  - Overall system health"
echo "  /alerts_test - Test alert system"
echo ""

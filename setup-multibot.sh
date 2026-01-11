#!/bin/bash

# Multi-Bot Setup Script for Oracle Cloud
# This script helps you quickly set up multiple Telegram bots on one server

set -e  # Exit on error

echo "🤖 X1 Wallet Watcher - Multi-Bot Setup"
echo "======================================="
echo ""

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker first:"
    echo "  curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed!"
    echo "Please install Docker Compose first:"
    echo "  sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
    echo "  sudo chmod +x /usr/local/bin/docker-compose"
    exit 1
fi

# Ask how many bots to set up
echo "How many bots do you want to run? (1-10)"
read -p "Number of bots: " BOT_COUNT

if ! [[ "$BOT_COUNT" =~ ^[0-9]+$ ]] || [ "$BOT_COUNT" -lt 1 ] || [ "$BOT_COUNT" -gt 10 ]; then
    echo "❌ Please enter a number between 1 and 10"
    exit 1
fi

echo ""
echo "Setting up $BOT_COUNT bot(s)..."
echo ""

# Create data directories
echo "📁 Creating data directories..."
for i in $(seq 1 $BOT_COUNT); do
    mkdir -p "data/bot$i"
    echo "  ✓ Created data/bot$i"
done

# Create environment files
echo ""
echo "📝 Creating environment files..."
for i in $(seq 1 $BOT_COUNT); do
    if [ ! -f ".env.bot$i" ]; then
        cp .env.example ".env.bot$i"
        echo "  ✓ Created .env.bot$i (please edit with your bot token)"
    else
        echo "  ⚠ .env.bot$i already exists, skipping"
    fi
done

echo ""
echo "📋 Next steps:"
echo ""
echo "1. Edit each environment file with the correct BOT_TOKEN:"
for i in $(seq 1 $BOT_COUNT); do
    echo "   nano .env.bot$i"
done

echo ""
echo "2. Make sure each file has a unique BOT_TOKEN from @BotFather"
echo ""
echo "3. Build and start all bots:"
echo "   docker-compose -f docker-compose.multibot.yml build"
echo "   docker-compose -f docker-compose.multibot.yml up -d"
echo ""
echo "4. View logs:"
echo "   docker-compose -f docker-compose.multibot.yml logs -f"
echo ""
echo "✅ Setup preparation complete!"
echo ""
echo "💡 Tip: Each bot will use approximately 50-150 MB RAM"
echo "   Oracle Free Tier ARM instance (6GB RAM) can easily run all $BOT_COUNT bots!"

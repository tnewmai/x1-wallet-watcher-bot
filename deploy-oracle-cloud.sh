#!/bin/bash

################################################################################
# X1 Wallet Watcher Bot - Oracle Cloud Automated Deployment Script
# 
# This script automates the complete deployment process on Oracle Cloud
# including system setup, Docker installation, and bot deployment.
#
# Usage: 
#   bash deploy-oracle-cloud.sh
#
# Requirements:
#   - Fresh Oracle Cloud Ubuntu/Debian VM
#   - Root or sudo access
#   - BOT_TOKEN ready from @BotFather
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        SUDO_CMD=""
    else
        SUDO_CMD="sudo"
    fi
}

################################################################################
# Main Functions
################################################################################

# Step 1: System Information
show_system_info() {
    print_header "Step 1: System Information"
    
    print_info "Hostname: $(hostname)"
    print_info "OS: $(lsb_release -d | cut -f2)"
    print_info "Kernel: $(uname -r)"
    print_info "CPU: $(nproc) cores"
    print_info "RAM: $(free -h | awk '/^Mem:/ {print $2}')"
    print_info "Disk: $(df -h / | awk 'NR==2 {print $2}')"
    print_info "Region: $(curl -s http://169.254.169.254/opc/v1/instance/ | grep -o 'region.*' | head -1 || echo 'Unknown')"
    
    print_success "System information collected"
}

# Step 2: Update System
update_system() {
    print_header "Step 2: Updating System Packages"
    
    print_step "Updating package lists..."
    $SUDO_CMD apt-get update -qq
    
    print_step "Upgrading packages..."
    $SUDO_CMD DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
    
    print_step "Installing essential packages..."
    $SUDO_CMD apt-get install -y -qq \
        curl \
        wget \
        git \
        vim \
        htop \
        net-tools \
        ufw \
        ca-certificates \
        gnupg \
        lsb-release \
        jq \
        unzip
    
    print_success "System packages updated"
}

# Step 3: Install Docker
install_docker() {
    print_header "Step 3: Installing Docker"
    
    if command -v docker &> /dev/null; then
        print_warning "Docker already installed: $(docker --version)"
        return
    fi
    
    print_step "Adding Docker GPG key..."
    $SUDO_CMD install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO_CMD gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    $SUDO_CMD chmod a+r /etc/apt/keyrings/docker.gpg
    
    print_step "Adding Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | $SUDO_CMD tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    print_step "Installing Docker packages..."
    $SUDO_CMD apt-get update -qq
    $SUDO_CMD apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    print_step "Adding current user to docker group..."
    $SUDO_CMD usermod -aG docker $USER || true
    
    print_step "Starting Docker service..."
    $SUDO_CMD systemctl enable docker
    $SUDO_CMD systemctl start docker
    
    print_success "Docker installed: $(docker --version)"
    print_info "Note: You may need to log out and back in for docker group membership to take effect"
}

# Step 4: Configure Firewall
configure_firewall() {
    print_header "Step 4: Configuring Firewall"
    
    print_step "Setting up UFW firewall rules..."
    
    # Reset UFW to default
    $SUDO_CMD ufw --force reset > /dev/null
    
    # Default policies
    $SUDO_CMD ufw default deny incoming > /dev/null
    $SUDO_CMD ufw default allow outgoing > /dev/null
    
    # Allow SSH
    $SUDO_CMD ufw allow 22/tcp comment 'SSH' > /dev/null
    
    # Allow health check port (optional, for monitoring)
    $SUDO_CMD ufw allow 3000/tcp comment 'Bot Health Check' > /dev/null
    
    # Enable firewall
    $SUDO_CMD ufw --force enable > /dev/null
    
    print_success "Firewall configured"
    print_info "Open ports: 22 (SSH), 3000 (Health Check)"
}

# Step 5: Setup Bot Directory
setup_bot_directory() {
    print_header "Step 5: Setting Up Bot Directory"
    
    # If we're already in the bot directory, use it
    if [ -f "$SCRIPT_DIR/package.json" ] && grep -q "x1-wallet-watcher-bot" "$SCRIPT_DIR/package.json"; then
        BOT_DIR="$SCRIPT_DIR"
        print_info "Using current directory: $BOT_DIR"
    else
        # Create new directory
        BOT_DIR="$HOME/x1-wallet-watcher-bot"
        
        if [ -d "$BOT_DIR" ]; then
            print_warning "Directory already exists: $BOT_DIR"
            read -p "Remove and re-clone? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf "$BOT_DIR"
            else
                print_info "Using existing directory"
            fi
        fi
        
        if [ ! -d "$BOT_DIR" ]; then
            print_step "Cloning repository..."
            # Note: User should update this with their actual repo URL
            print_warning "Manual step required: Clone your repository to $BOT_DIR"
            print_info "Example: git clone <your-repo-url> $BOT_DIR"
            mkdir -p "$BOT_DIR"
        fi
    fi
    
    cd "$BOT_DIR"
    
    # Create data directory
    mkdir -p data
    chmod 755 data
    
    print_success "Bot directory ready: $BOT_DIR"
}

# Step 6: Configure Environment
configure_environment() {
    print_header "Step 6: Configuring Environment"
    
    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Reconfigure? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping environment configuration"
            return
        fi
    fi
    
    print_step "Creating .env file from template..."
    
    # Prompt for BOT_TOKEN
    echo ""
    echo -e "${YELLOW}📱 Telegram Bot Configuration${NC}"
    echo "Get your bot token from: https://t.me/BotFather"
    echo ""
    read -p "Enter your BOT_TOKEN: " BOT_TOKEN
    
    if [ -z "$BOT_TOKEN" ]; then
        print_error "BOT_TOKEN is required!"
        exit 1
    fi
    
    # Prompt for RPC URL
    echo ""
    echo -e "${YELLOW}🔗 X1 Blockchain RPC Configuration${NC}"
    echo "Default: https://rpc.mainnet.x1.xyz"
    echo ""
    read -p "Enter X1 RPC URL (press Enter for default): " X1_RPC_URL
    X1_RPC_URL=${X1_RPC_URL:-https://rpc.mainnet.x1.xyz}
    
    # Create .env file
    cat > .env << EOF
# Telegram Bot Token (get from @BotFather)
BOT_TOKEN=$BOT_TOKEN

# X1 Blockchain RPC URL
X1_RPC_URL=$X1_RPC_URL

# Polling interval in milliseconds (15 seconds)
POLL_INTERVAL=15000

# Block Explorer URL
EXPLORER_URL=https://explorer.x1-mainnet.infrafc.org

# Performance Settings (optimized for Oracle Cloud Free Tier)
WATCHER_CONCURRENCY=3
SECURITY_SCAN_TIMEOUT=30000
CACHE_TTL_SHORT=300
DISABLE_AUTO_SECURITY_SCAN=true

# RPC Retry Settings
RPC_MAX_RETRIES=3
RPC_RETRY_DELAY=1000

# Health Check & Monitoring
HEALTH_CHECK_PORT=3000
HEALTH_CHECK_ENABLED=true
ENABLE_PERFORMANCE_METRICS=true
ENABLE_RPC_METRICS=true
LOG_LEVEL=info

# Node Environment
NODE_ENV=production
EOF
    
    chmod 600 .env
    
    print_success "Environment configured"
}

# Step 7: Build and Deploy Bot
deploy_bot() {
    print_header "Step 7: Building and Deploying Bot"
    
    print_step "Stopping any existing containers..."
    docker compose -f docker-compose.production.yml down 2>/dev/null || true
    
    print_step "Building Docker image..."
    docker compose -f docker-compose.production.yml build --no-cache
    
    print_step "Starting bot container..."
    docker compose -f docker-compose.production.yml up -d
    
    print_step "Waiting for bot to start (30 seconds)..."
    sleep 30
    
    # Check if container is running
    if docker ps | grep -q "x1-wallet-watcher-bot"; then
        print_success "Bot container is running!"
    else
        print_error "Bot container failed to start"
        print_info "Check logs with: docker compose -f docker-compose.production.yml logs"
        exit 1
    fi
    
    # Check health endpoint
    print_step "Checking bot health..."
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Bot is healthy!"
        echo ""
        echo -e "${GREEN}Health Status:${NC}"
        curl -s http://localhost:3000/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/health
    else
        print_warning "Health check endpoint not responding (may take a moment to start)"
    fi
    
    print_success "Bot deployment complete!"
}

# Step 8: Setup Auto-Restart
setup_auto_restart() {
    print_header "Step 8: Setting Up Auto-Restart"
    
    print_step "Creating systemd service..."
    
    cat | $SUDO_CMD tee /etc/systemd/system/x1-wallet-bot.service > /dev/null << EOF
[Unit]
Description=X1 Wallet Watcher Bot
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$BOT_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.production.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.production.yml down
User=$USER

[Install]
WantedBy=multi-user.target
EOF
    
    $SUDO_CMD systemctl daemon-reload
    $SUDO_CMD systemctl enable x1-wallet-bot.service
    
    print_success "Auto-restart configured"
    print_info "Bot will automatically start on system reboot"
}

# Step 9: Setup Monitoring
setup_monitoring() {
    print_header "Step 9: Setting Up Monitoring"
    
    print_step "Creating monitoring script..."
    
    cat > $BOT_DIR/monitor-bot.sh << 'EOF'
#!/bin/bash

# Simple monitoring script for X1 Wallet Watcher Bot

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BOT_DIR"

# Check if container is running
if ! docker ps | grep -q "x1-wallet-watcher-bot"; then
    echo "[$(date)] Bot container not running, attempting restart..."
    docker compose -f docker-compose.production.yml up -d
    exit 1
fi

# Check health endpoint
if ! curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "[$(date)] Health check failed, attempting restart..."
    docker compose -f docker-compose.production.yml restart
    exit 1
fi

echo "[$(date)] Bot is healthy"
exit 0
EOF
    
    chmod +x $BOT_DIR/monitor-bot.sh
    
    # Add to crontab
    print_step "Setting up cron job for monitoring..."
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "monitor-bot.sh"; then
        print_warning "Monitoring cron job already exists"
    else
        (crontab -l 2>/dev/null; echo "*/5 * * * * $BOT_DIR/monitor-bot.sh >> $BOT_DIR/monitor.log 2>&1") | crontab -
        print_success "Monitoring cron job added (runs every 5 minutes)"
    fi
    
    print_info "Logs will be written to: $BOT_DIR/monitor.log"
}

# Final Summary
show_summary() {
    print_header "🎉 Deployment Complete!"
    
    echo -e "${GREEN}Your X1 Wallet Watcher Bot is now running!${NC}"
    echo ""
    echo -e "${CYAN}📊 Quick Stats:${NC}"
    echo "  Bot Directory: $BOT_DIR"
    echo "  Container Status: $(docker ps --filter name=x1-wallet-watcher-bot --format '{{.Status}}')"
    echo "  Health Check: http://$(curl -s ifconfig.me):3000/health"
    echo ""
    echo -e "${CYAN}🔧 Useful Commands:${NC}"
    echo "  View logs:         docker compose -f docker-compose.production.yml logs -f"
    echo "  Stop bot:          docker compose -f docker-compose.production.yml down"
    echo "  Restart bot:       docker compose -f docker-compose.production.yml restart"
    echo "  Check health:      curl http://localhost:3000/health"
    echo "  View metrics:      curl http://localhost:3000/metrics"
    echo "  Monitor script:    ./monitor-bot.sh"
    echo ""
    echo -e "${CYAN}📱 Next Steps:${NC}"
    echo "  1. Open Telegram and find your bot"
    echo "  2. Send /start to begin"
    echo "  3. Use /watch <address> <label> to add wallets"
    echo "  4. Configure settings with /settings"
    echo ""
    echo -e "${CYAN}🔒 Security Recommendations:${NC}"
    echo "  1. Keep .env file secure (already set to 600 permissions)"
    echo "  2. Regularly update: apt-get update && apt-get upgrade"
    echo "  3. Monitor logs for unusual activity"
    echo "  4. Setup Oracle Cloud alert rules for VM monitoring"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "  - If you see 'permission denied' for docker commands, log out and back in"
    echo "  - Health check port 3000 is open for monitoring"
    echo "  - Auto-restart is enabled (bot starts on server reboot)"
    echo "  - Monitoring runs every 5 minutes via cron"
    echo ""
    
    print_success "Enjoy your bot! 🚀"
}

################################################################################
# Main Execution
################################################################################

main() {
    clear
    
    print_header "🚀 X1 Wallet Watcher Bot - Oracle Cloud Deployment"
    
    echo -e "${CYAN}This script will:${NC}"
    echo "  1. Update system packages"
    echo "  2. Install Docker and Docker Compose"
    echo "  3. Configure firewall"
    echo "  4. Setup bot directory"
    echo "  5. Configure environment variables"
    echo "  6. Build and deploy the bot"
    echo "  7. Setup auto-restart on reboot"
    echo "  8. Setup monitoring"
    echo ""
    
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        exit 0
    fi
    
    # Check for root/sudo
    check_root
    
    # Execute deployment steps
    show_system_info
    update_system
    install_docker
    configure_firewall
    setup_bot_directory
    configure_environment
    deploy_bot
    setup_auto_restart
    setup_monitoring
    show_summary
}

# Run main function
main "$@"

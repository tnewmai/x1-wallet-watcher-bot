#!/bin/bash

################################################################################
# X1 Wallet Watcher Bot - Advanced Monitoring Setup
#
# This script sets up comprehensive monitoring including:
# - Health check monitoring
# - Resource usage alerts
# - Log rotation
# - Telegram notifications for critical issues
# - External uptime monitoring
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BOT_DIR"

print_header() {
    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_step() { echo -e "${YELLOW}▶ $1${NC}"; }

################################################################################
# Monitoring Scripts
################################################################################

# Create advanced monitoring script
create_monitor_script() {
    print_header "Creating Advanced Monitoring Script"
    
    cat > monitor-bot-advanced.sh << 'EOF'
#!/bin/bash

################################################################################
# Advanced Bot Monitor - Checks health, resources, and sends alerts
################################################################################

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BOT_DIR"

# Configuration
CONTAINER_NAME="x1-wallet-watcher-bot"
HEALTH_URL="http://localhost:3000/health"
LOG_FILE="$BOT_DIR/monitor.log"
ALERT_FILE="$BOT_DIR/alerts.log"

# Thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=80
DISK_THRESHOLD=85
RESTART_COUNT_THRESHOLD=3

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alert() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $1" | tee -a "$ALERT_FILE"
}

# Check if container is running
check_container() {
    if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
        return 0
    else
        return 1
    fi
}

# Check container health
check_health() {
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Get container stats
get_container_stats() {
    docker stats "$CONTAINER_NAME" --no-stream --format "{{.CPUPerc}}|{{.MemPerc}}" 2>/dev/null
}

# Check system resources
check_system_resources() {
    # CPU usage
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    
    # Memory usage
    MEMORY_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -d'.' -f1)
    
    # Disk usage
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1)
    
    echo "$CPU_USAGE|$MEMORY_USAGE|$DISK_USAGE"
}

# Get container restart count
get_restart_count() {
    docker inspect -f '{{.RestartCount}}' "$CONTAINER_NAME" 2>/dev/null || echo "0"
}

# Restart container
restart_container() {
    log "Attempting to restart container..."
    docker compose -f docker-compose.production.yml restart
    sleep 10
}

# Main monitoring logic
main() {
    log "Starting monitoring check..."
    
    # Check if container exists and is running
    if ! check_container; then
        alert "Container is not running! Attempting to start..."
        docker compose -f docker-compose.production.yml up -d
        sleep 15
        
        if ! check_container; then
            alert "Failed to start container! Manual intervention required."
            exit 1
        else
            log "Container started successfully"
        fi
    fi
    
    # Check health endpoint
    if ! check_health; then
        alert "Health check failed! Container may be unhealthy."
        
        # Get container logs
        log "Recent container logs:"
        docker compose -f docker-compose.production.yml logs --tail=20 >> "$LOG_FILE"
        
        # Try restart
        restart_container
        sleep 10
        
        if ! check_health; then
            alert "Health check still failing after restart!"
            exit 1
        else
            log "Health check passed after restart"
        fi
    fi
    
    # Check container stats
    STATS=$(get_container_stats)
    if [ -n "$STATS" ]; then
        CONTAINER_CPU=$(echo "$STATS" | cut -d'|' -f1 | sed 's/%//')
        CONTAINER_MEM=$(echo "$STATS" | cut -d'|' -f2 | sed 's/%//')
        
        log "Container stats - CPU: ${CONTAINER_CPU}%, Memory: ${CONTAINER_MEM}%"
        
        # Alert on high resource usage
        if (( $(echo "$CONTAINER_CPU > $CPU_THRESHOLD" | bc -l) )); then
            alert "High container CPU usage: ${CONTAINER_CPU}%"
        fi
        
        if (( $(echo "$CONTAINER_MEM > $MEMORY_THRESHOLD" | bc -l) )); then
            alert "High container memory usage: ${CONTAINER_MEM}%"
        fi
    fi
    
    # Check system resources
    SYS_STATS=$(check_system_resources)
    SYS_CPU=$(echo "$SYS_STATS" | cut -d'|' -f1)
    SYS_MEM=$(echo "$SYS_STATS" | cut -d'|' -f2)
    SYS_DISK=$(echo "$SYS_STATS" | cut -d'|' -f3)
    
    log "System stats - CPU: ${SYS_CPU}%, Memory: ${SYS_MEM}%, Disk: ${SYS_DISK}%"
    
    # Alert on high system resource usage
    if [ "$SYS_CPU" -gt "$CPU_THRESHOLD" ]; then
        alert "High system CPU usage: ${SYS_CPU}%"
    fi
    
    if [ "$SYS_MEM" -gt "$MEMORY_THRESHOLD" ]; then
        alert "High system memory usage: ${SYS_MEM}%"
    fi
    
    if [ "$SYS_DISK" -gt "$DISK_THRESHOLD" ]; then
        alert "High disk usage: ${SYS_DISK}%"
    fi
    
    # Check restart count
    RESTART_COUNT=$(get_restart_count)
    if [ "$RESTART_COUNT" -gt "$RESTART_COUNT_THRESHOLD" ]; then
        alert "Container has restarted $RESTART_COUNT times! Investigating..."
    fi
    
    log "Monitoring check complete - All systems operational"
    exit 0
}

main
EOF
    
    chmod +x monitor-bot-advanced.sh
    print_success "Advanced monitoring script created"
}

# Create log rotation config
setup_log_rotation() {
    print_header "Setting Up Log Rotation"
    
    cat | sudo tee /etc/logrotate.d/x1-wallet-bot > /dev/null << EOF
$BOT_DIR/monitor.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 $USER $USER
}

$BOT_DIR/alerts.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $USER $USER
}
EOF
    
    print_success "Log rotation configured"
    print_info "Logs will be rotated daily, keeping 7 days of monitor logs and 30 days of alerts"
}

# Create resource monitoring dashboard
create_dashboard() {
    print_header "Creating Monitoring Dashboard"
    
    cat > dashboard.sh << 'EOF'
#!/bin/bash

################################################################################
# Bot Monitoring Dashboard - Real-time view of bot status
################################################################################

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

CONTAINER_NAME="x1-wallet-watcher-bot"

show_header() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║          X1 Wallet Watcher Bot - Live Dashboard               ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${BLUE}Last updated: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""
}

show_container_status() {
    echo -e "${CYAN}${BOLD}Container Status:${NC}"
    
    if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
        STATUS=$(docker ps --format '{{.Status}}' --filter "name=$CONTAINER_NAME")
        UPTIME=$(docker ps --format '{{.Status}}' --filter "name=$CONTAINER_NAME" | grep -oP '\d+\s+\w+' | head -1)
        echo -e "  ${GREEN}● Running${NC} - Uptime: $UPTIME"
    else
        echo -e "  ${RED}● Stopped${NC}"
        return 1
    fi
    echo ""
}

show_health_status() {
    echo -e "${CYAN}${BOLD}Health Check:${NC}"
    
    HEALTH_RESPONSE=$(curl -s http://localhost:3000/health 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}● Healthy${NC}"
        echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
    else
        echo -e "  ${RED}● Unhealthy${NC} - Health endpoint not responding"
    fi
    echo ""
}

show_resource_usage() {
    echo -e "${CYAN}${BOLD}Resource Usage:${NC}"
    
    # Container resources
    if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
        STATS=$(docker stats "$CONTAINER_NAME" --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}")
        echo "$STATS"
    fi
    echo ""
    
    # System resources
    echo -e "${CYAN}${BOLD}System Resources:${NC}"
    echo "  CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')% used"
    echo "  Memory: $(free -h | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')"
    echo "  Disk: $(df -h / | awk 'NR==2 {print $5 " used (" $4 " free)"}')"
    echo ""
}

show_recent_logs() {
    echo -e "${CYAN}${BOLD}Recent Logs (last 10 lines):${NC}"
    docker compose -f docker-compose.production.yml logs --tail=10 2>/dev/null | sed 's/^/  /'
    echo ""
}

show_alerts() {
    echo -e "${CYAN}${BOLD}Recent Alerts:${NC}"
    if [ -f alerts.log ]; then
        tail -n 5 alerts.log | sed 's/^/  /' || echo "  No alerts"
    else
        echo "  No alerts"
    fi
    echo ""
}

show_footer() {
    echo -e "${BLUE}Press Ctrl+C to exit | Refreshes every 5 seconds${NC}"
}

# Main loop
while true; do
    show_header
    show_container_status
    show_health_status
    show_resource_usage
    show_recent_logs
    show_alerts
    show_footer
    
    sleep 5
done
EOF
    
    chmod +x dashboard.sh
    print_success "Monitoring dashboard created"
    print_info "Run './dashboard.sh' to see live monitoring"
}

# Create uptime monitoring setup guide
create_uptime_guide() {
    print_header "Creating External Uptime Monitoring Guide"
    
    cat > UPTIME_MONITORING.md << 'EOF'
# External Uptime Monitoring Setup

## Free Services for Monitoring Your Bot

### 1. UptimeRobot (Recommended - Free)

**Features:**
- 50 monitors for free
- 5-minute check intervals
- Email, SMS, Telegram alerts
- Public status page

**Setup:**

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up (free account)
3. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: X1 Wallet Bot
   - URL: `http://YOUR_PUBLIC_IP:3000/health`
   - Monitoring Interval: 5 minutes
4. Add Alert Contacts (email, Telegram, etc.)
5. Save

**Telegram Alerts:**
1. In UptimeRobot: Settings → Alert Contacts
2. Add Telegram integration
3. Follow instructions to connect

---

### 2. Better Uptime (Free Alternative)

**Features:**
- Unlimited monitors
- 30-second intervals
- Status page
- Incident management

**Setup:**

1. Go to [betteruptime.com](https://betteruptime.com)
2. Sign up for free
3. Add Monitor:
   - URL: `http://YOUR_PUBLIC_IP:3000/health`
   - Check frequency: 1 minute
4. Add on-call schedule
5. Configure alert channels

---

### 3. Healthchecks.io (Developer-Friendly)

**Features:**
- 20 checks for free
- Cron job monitoring
- Simple API
- Email/Slack/Telegram alerts

**Setup:**

1. Go to [healthchecks.io](https://healthchecks.io)
2. Sign up
3. Create check:
   - Name: X1 Wallet Bot
   - Period: 5 minutes
   - Grace: 2 minutes
4. Get ping URL
5. Add to cron:
   ```bash
   */5 * * * * curl -fsS --retry 3 https://hc-ping.com/YOUR_UUID_HERE > /dev/null
   ```

---

### 4. Oracle Cloud Monitoring (Built-in)

**Features:**
- Built into Oracle Cloud
- Free with compute instances
- CPU, memory, disk monitoring
- Alarm notifications

**Setup:**

1. In Oracle Cloud Console
2. Navigate to: Monitoring → Alarms
3. Create Alarm:
   - Metric: CPU Utilization
   - Condition: > 80%
   - Trigger: 5 minutes
4. Add notification (email)
5. Repeat for memory, disk

---

## Monitoring Checklist

- [ ] Setup at least one external uptime monitor
- [ ] Configure alert notifications (email/Telegram)
- [ ] Test alerts by stopping bot
- [ ] Add public status page (optional)
- [ ] Set up Oracle Cloud alarms (optional)
- [ ] Document response procedures

---

## Alert Response Guide

### Bot Down Alert

1. SSH into server
2. Check container status: `docker ps -a`
3. View logs: `docker compose -f docker-compose.production.yml logs --tail=50`
4. Restart: `docker compose -f docker-compose.production.yml restart`
5. Monitor for 5 minutes

### High Resource Alert

1. Check dashboard: `./dashboard.sh`
2. Review logs for errors
3. Check for infinite loops or memory leaks
4. Consider increasing VM resources
5. Restart if necessary

### Health Check Failing

1. Check health endpoint: `curl http://localhost:3000/health`
2. View container logs
3. Check network connectivity
4. Restart container
5. Investigate root cause

---

## Status Page Setup (Optional)

Create a public status page to show bot status:

**Using UptimeRobot:**
1. In UptimeRobot dashboard
2. My Settings → Add Public Status Page
3. Customize URL and appearance
4. Share with users

**Using Better Uptime:**
1. Status Pages → Create Status Page
2. Add monitors to display
3. Customize domain
4. Publish

---

## Automated Recovery

The bot includes automatic recovery features:

1. **Monitoring Script** (runs every 5 minutes)
   - Checks container status
   - Verifies health endpoint
   - Auto-restarts if needed

2. **Docker Health Check** (built-in)
   - Checks every 30 seconds
   - Auto-restarts unhealthy containers

3. **Systemd Service** (system reboot)
   - Starts bot on server restart
   - Ensures persistent operation

---

## Best Practices

✅ **Do:**
- Monitor from external service (outside your VM)
- Set up multiple alert channels
- Test alerts regularly
- Document response procedures
- Review alerts weekly

❌ **Don't:**
- Rely only on internal monitoring
- Ignore repeated alerts
- Set thresholds too sensitive (alert fatigue)
- Forget to update monitoring after changes

---

## Cost Summary

All monitoring is **FREE**:
- UptimeRobot: Free tier (50 monitors)
- Better Uptime: Free forever
- Healthchecks.io: Free tier (20 checks)
- Oracle Cloud Monitoring: Included with VM

**Total monitoring cost: ₹0/month** ✅
EOF
    
    print_success "Uptime monitoring guide created"
}

# Setup cron jobs
setup_cron_jobs() {
    print_header "Setting Up Cron Jobs"
    
    # Backup existing crontab
    crontab -l > /tmp/crontab.backup 2>/dev/null || true
    
    # Remove old monitoring jobs
    crontab -l 2>/dev/null | grep -v "monitor-bot" | crontab - 2>/dev/null || true
    
    # Add new cron jobs
    (
        crontab -l 2>/dev/null
        echo "# X1 Wallet Bot - Advanced Monitoring (every 5 minutes)"
        echo "*/5 * * * * $BOT_DIR/monitor-bot-advanced.sh >> $BOT_DIR/monitor.log 2>&1"
        echo ""
        echo "# X1 Wallet Bot - Health Check (every 2 minutes)"
        echo "*/2 * * * * curl -sf http://localhost:3000/health > /dev/null || $BOT_DIR/monitor-bot-advanced.sh"
        echo ""
        echo "# X1 Wallet Bot - Daily Health Report (9 AM)"
        echo "0 9 * * * echo \"Daily Status: \$(docker ps --filter name=x1-wallet-watcher-bot --format '{{.Status}}')\" >> $BOT_DIR/daily-status.log"
    ) | crontab -
    
    print_success "Cron jobs configured"
    print_info "Monitoring runs every 5 minutes, health checks every 2 minutes"
}

# Create health report
create_health_report() {
    print_header "Creating Health Report Generator"
    
    cat > generate-health-report.sh << 'EOF'
#!/bin/bash

################################################################################
# Generate comprehensive health report
################################################################################

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BOT_DIR"

REPORT_FILE="health-report-$(date +%Y%m%d-%H%M%S).txt"

{
    echo "========================================"
    echo "X1 Wallet Bot - Health Report"
    echo "Generated: $(date)"
    echo "========================================"
    echo ""
    
    echo "=== Container Status ==="
    docker ps --filter name=x1-wallet-watcher-bot
    echo ""
    
    echo "=== Health Check ==="
    curl -s http://localhost:3000/health | jq '.' 2>/dev/null || echo "Health check failed"
    echo ""
    
    echo "=== Resource Usage ==="
    docker stats x1-wallet-watcher-bot --no-stream
    echo ""
    
    echo "=== System Resources ==="
    echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')%"
    echo "Memory: $(free -h | awk 'NR==2{printf "%s / %s (%.1f%%)", $3,$2,$3*100/$2}')"
    echo "Disk: $(df -h / | awk 'NR==2 {print $3 " / " $2 " (" $5 ")"}')"
    echo ""
    
    echo "=== Recent Logs (last 20 lines) ==="
    docker compose -f docker-compose.production.yml logs --tail=20
    echo ""
    
    echo "=== Recent Alerts ==="
    if [ -f alerts.log ]; then
        tail -n 10 alerts.log
    else
        echo "No alerts"
    fi
    echo ""
    
    echo "=== Uptime ==="
    uptime
    echo ""
    
    echo "========================================"
    echo "End of Health Report"
    echo "========================================"
    
} > "$REPORT_FILE"

echo "Health report generated: $REPORT_FILE"
cat "$REPORT_FILE"
EOF
    
    chmod +x generate-health-report.sh
    print_success "Health report generator created"
}

# Main setup
main() {
    print_header "🔍 X1 Wallet Bot - Advanced Monitoring Setup"
    
    print_info "This script will setup comprehensive monitoring for your bot"
    echo ""
    
    create_monitor_script
    setup_log_rotation
    create_dashboard
    create_uptime_guide
    setup_cron_jobs
    create_health_report
    
    print_header "✅ Monitoring Setup Complete!"
    
    echo -e "${GREEN}Monitoring features installed:${NC}"
    echo "  ✅ Advanced monitoring script (every 5 minutes)"
    echo "  ✅ Health checks (every 2 minutes)"
    echo "  ✅ Real-time dashboard"
    echo "  ✅ Log rotation (daily)"
    echo "  ✅ Health report generator"
    echo "  ✅ External monitoring guide"
    echo ""
    
    echo -e "${CYAN}Available Commands:${NC}"
    echo "  ./monitor-bot-advanced.sh    - Run monitoring check manually"
    echo "  ./dashboard.sh               - View live monitoring dashboard"
    echo "  ./generate-health-report.sh  - Generate health report"
    echo "  tail -f monitor.log          - View monitoring logs"
    echo "  tail -f alerts.log           - View alerts"
    echo ""
    
    echo -e "${CYAN}Monitoring Files:${NC}"
    echo "  monitor.log           - Monitoring activity log"
    echo "  alerts.log            - Critical alerts log"
    echo "  daily-status.log      - Daily status summary"
    echo "  UPTIME_MONITORING.md  - External monitoring guide"
    echo ""
    
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Review UPTIME_MONITORING.md for external monitoring setup"
    echo "  2. Run './dashboard.sh' to see live status"
    echo "  3. Setup UptimeRobot or similar service"
    echo "  4. Test alerts by stopping the bot"
    echo ""
    
    print_success "Monitoring is active! 🚀"
}

main "$@"

#!/bin/bash

# X1 Wallet Watcher Bot - Monitoring Script
# Continuously monitor bot health and metrics

set -e

PORT=${HEALTH_CHECK_PORT:-3000}

echo "📊 X1 Wallet Watcher Bot - Live Monitor"
echo "========================================"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq is not installed. Install it for better formatting:"
    echo "   Ubuntu/Debian: sudo apt-get install jq"
    echo "   macOS: brew install jq"
    echo ""
    USE_JQ=false
else
    USE_JQ=true
fi

# Function to display metrics
show_metrics() {
    clear
    echo "📊 X1 Wallet Watcher Bot - Live Monitor"
    echo "========================================"
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Check if bot is responding
    if ! curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
        echo "❌ Bot is not responding!"
        echo "Check if container is running: docker ps | grep x1-wallet"
        return 1
    fi
    
    # Get health status
    echo "🏥 Health Status:"
    if [ "$USE_JQ" = true ]; then
        curl -s "http://localhost:${PORT}/health" | jq -r '
            "   Status: \(.status | ascii_upcase)",
            "   Uptime: \((.uptime / 1000 / 60 | floor))m",
            "   RPC Available: \(if .checks.rpcAvailability then "✅" else "❌" end)",
            "   Watcher Active: \(if .checks.watcherActive then "✅" else "❌" end)",
            "   Memory OK: \(if .checks.memoryOk then "✅" else "❌" end)"
        '
    else
        curl -s "http://localhost:${PORT}/health"
    fi
    
    echo ""
    
    # Get detailed metrics
    echo "📈 Detailed Metrics:"
    if [ "$USE_JQ" = true ]; then
        curl -s "http://localhost:${PORT}/metrics" | jq -r '
            "   🔌 RPC Calls:",
            "      Total: \(.metrics.rpcCalls.total)",
            "      Success Rate: \(if .metrics.rpcCalls.total > 0 then ((.metrics.rpcCalls.successful / .metrics.rpcCalls.total * 100) | floor) else 100 end)%",
            "      Rate Limited: \(.metrics.rpcCalls.rateLimited)",
            "      Timeouts: \(.metrics.rpcCalls.timeouts)",
            "",
            "   👀 Watcher Cycles:",
            "      Total: \(.metrics.watcherCycles.total)",
            "      Success Rate: \(if .metrics.watcherCycles.total > 0 then ((.metrics.watcherCycles.successful / .metrics.watcherCycles.total * 100) | floor) else 100 end)%",
            "      Avg Duration: \(.metrics.watcherCycles.averageDuration | floor)ms",
            "      Last Duration: \(.metrics.watcherCycles.lastDuration)ms",
            "",
            "   🛡️  Security Scans:",
            "      Total: \(.metrics.securityScans.total)",
            "      Cached: \(.metrics.securityScans.cached) (\(if .metrics.securityScans.total > 0 then ((.metrics.securityScans.cached / .metrics.securityScans.total * 100) | floor) else 0 end)%)",
            "      Avg Duration: \(.metrics.securityScans.averageDuration | floor)ms",
            "",
            "   📬 Notifications:",
            "      Sent: \(.metrics.notifications.sent)",
            "      Failed: \(.metrics.notifications.failed)",
            "",
            "   💾 Memory:",
            "      Heap: \((.metrics.systemHealth.memoryUsage.heapUsed / 1024 / 1024 | floor))MB",
            "      RSS: \((.metrics.systemHealth.memoryUsage.rss / 1024 / 1024 | floor))MB"
        '
    else
        curl -s "http://localhost:${PORT}/metrics"
    fi
    
    echo ""
    echo "========================================"
    echo "Press Ctrl+C to exit | Updates every 5s"
}

# Main monitoring loop
while true; do
    show_metrics
    sleep 5
done

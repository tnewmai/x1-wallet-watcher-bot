#!/bin/bash
# Schedule Blocklist Update (Linux/Mac)
# 
# This script sets up a cron job to automatically update the blocklist daily at 3 AM
# 
# Usage:
#   chmod +x schedule-blocklist-update.sh
#   ./schedule-blocklist-update.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/blocklist-update.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# The command to run
UPDATE_COMMAND="cd $SCRIPT_DIR && npm run update-blocklist >> $LOG_FILE 2>&1"

# Create a temporary cron file
TEMP_CRON=$(mktemp)

# Get current crontab
crontab -l > "$TEMP_CRON" 2>/dev/null || true

# Check if our job already exists
if grep -q "npm run update-blocklist" "$TEMP_CRON"; then
    echo "⚠️  Blocklist update cron job already exists"
    echo "Existing cron jobs:"
    crontab -l | grep "update-blocklist"
else
    # Add the new cron job (daily at 3 AM)
    echo "" >> "$TEMP_CRON"
    echo "# X1 Wallet Watcher - Automated Blocklist Update (Daily at 3 AM)" >> "$TEMP_CRON"
    echo "0 3 * * * $UPDATE_COMMAND" >> "$TEMP_CRON"
    
    # Install the new crontab
    crontab "$TEMP_CRON"
    
    echo "✅ Blocklist update scheduled successfully!"
    echo ""
    echo "Schedule: Daily at 3:00 AM"
    echo "Command: npm run update-blocklist"
    echo "Logs: $LOG_FILE"
    echo ""
    echo "To view scheduled jobs: crontab -l"
    echo "To remove: crontab -e (then delete the line)"
fi

# Clean up
rm "$TEMP_CRON"

echo ""
echo "📋 Current cron schedule:"
crontab -l

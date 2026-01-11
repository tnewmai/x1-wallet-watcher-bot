#!/bin/bash
# Run Blocklist Update Manually (Linux/Mac)
# 
# Usage:
#   chmod +x run-blocklist-update-now.sh
#   ./run-blocklist-update-now.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/blocklist-update-manual-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory
mkdir -p "$LOG_DIR"

echo "═══════════════════════════════════════════════════════════"
echo "   Running Blocklist Update Manually"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Log file: $LOG_FILE"
echo ""

cd "$SCRIPT_DIR"
npm run update-blocklist 2>&1 | tee "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Update completed successfully!"
else
    echo "❌ Update failed with exit code: $EXIT_CODE"
    echo "Check log file for details: $LOG_FILE"
fi

exit $EXIT_CODE

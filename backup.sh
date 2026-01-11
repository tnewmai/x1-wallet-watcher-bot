#!/bin/bash
# Automated backup script for X1 Wallet Watcher Bot

# Configuration
BACKUP_DIR="./backups"
DATA_DIR="./data"
LOGS_DIR="./logs"
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="x1_bot_backup_${TIMESTAMP}"

# Create temporary backup directory
TEMP_BACKUP="${BACKUP_DIR}/${BACKUP_NAME}"
mkdir -p "$TEMP_BACKUP"

echo "🔄 Starting backup at $(date)"

# Backup data directory
if [ -d "$DATA_DIR" ]; then
    echo "📦 Backing up data directory..."
    cp -r "$DATA_DIR" "$TEMP_BACKUP/"
    echo "✅ Data backed up"
else
    echo "⚠️  Data directory not found"
fi

# Backup logs (last 24 hours only)
if [ -d "$LOGS_DIR" ]; then
    echo "📋 Backing up recent logs..."
    mkdir -p "$TEMP_BACKUP/logs"
    find "$LOGS_DIR" -type f -mtime -1 -exec cp {} "$TEMP_BACKUP/logs/" \;
    echo "✅ Logs backed up"
fi

# Backup environment file (without sensitive data)
if [ -f ".env" ]; then
    echo "⚙️  Backing up configuration template..."
    # Remove sensitive tokens from backup
    grep -v "BOT_TOKEN=" .env > "$TEMP_BACKUP/.env.template" || true
    echo "✅ Configuration template backed up"
fi

# Compress backup
echo "🗜️  Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"
cd ..

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
echo "✅ Backup created: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# Clean up old backups
echo "🧹 Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "x1_bot_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
REMAINING_BACKUPS=$(ls -1 "$BACKUP_DIR"/x1_bot_backup_*.tar.gz 2>/dev/null | wc -l)
echo "✅ Cleanup complete. ${REMAINING_BACKUPS} backup(s) retained"

echo "✅ Backup completed successfully at $(date)"

# Optional: Upload to cloud storage (uncomment and configure)
# Example for AWS S3:
# aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" s3://your-bucket/backups/

# Example for Google Cloud Storage:
# gsutil cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" gs://your-bucket/backups/

# Example for Azure Blob Storage:
# az storage blob upload --account-name youraccount --container-name backups --file "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" --name "${BACKUP_NAME}.tar.gz"

exit 0

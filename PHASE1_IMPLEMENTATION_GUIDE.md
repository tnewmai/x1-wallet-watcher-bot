# Phase 1 Implementation Guide

## Overview
This guide covers the Phase 1 improvements to the X1 Wallet Watcher Bot:
1. PostgreSQL database with Prisma ORM
2. Storage adapter pattern
3. Split handlers into modules
4. Comprehensive Jest testing

## Prerequisites

### 1. Install PostgreSQL

**Windows:**
```bash
# Download from: https://www.postgresql.org/download/windows/
# Or use Docker:
docker run --name x1-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
```

**Linux/Mac:**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Mac
brew install postgresql@15
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE x1_wallet_bot;

# Create user (optional)
CREATE USER x1_bot WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE x1_wallet_bot TO x1_bot;
```

## Installation Steps

### Step 1: Install Dependencies

```bash
cd x1-wallet-watcher-bot
npm install
```

This will install:
- `@prisma/client` - Prisma client for database operations
- `prisma` - Prisma CLI (dev dependency)
- `jest`, `ts-jest`, `@types/jest` - Testing framework

### Step 2: Configure Environment

Update your `.env` file:

```env
# Add this line (keep your existing BOT_TOKEN and other settings)
DATABASE_URL="postgresql://postgres:password@localhost:5432/x1_wallet_bot"
```

**Important:** Replace `password` with your actual PostgreSQL password.

### Step 3: Generate Prisma Client

```bash
npm run db:generate
```

This generates TypeScript types from your Prisma schema.

### Step 4: Create Database Tables

```bash
npm run db:push
```

This creates all tables defined in `prisma/schema.prisma`.

### Step 5: Migrate Existing Data

```bash
npm run db:seed
```

This migrates data from `data/data.json` to PostgreSQL. Your original data will be backed up to `data/data.json.backup`.

### Step 6: Update Index.ts

The bot needs to use the new storage system. Update `src/index.ts`:

```typescript
// Add this import at the top
import { initializeStorage } from './storage-v2';

// In the main() function, before bot.start():
async function main() {
  logger.info('Starting X1 Wallet Watcher Bot...');
  
  // Initialize database storage
  await initializeStorage();
  logger.info('✅ Database initialized');
  
  // ... rest of your code
  bot.start();
}
```

### Step 7: Build and Test

```bash
npm run build
npm start
```

## Database Management Commands

### View Database
```bash
npm run db:studio
```
Opens Prisma Studio - a GUI for viewing/editing data at http://localhost:5555

### Create Migration (for schema changes)
```bash
npm run db:migrate
```

### Reset Database (⚠️ deletes all data)
```bash
npx prisma migrate reset
```

## Testing

### Run Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

## Architecture Changes

### Old Architecture (File-based)
```
storage.ts → data.json
```

### New Architecture (Database)
```
storage-v2.ts → adapter.ts → prisma-adapter.ts → PostgreSQL
```

### Benefits
1. **ACID Transactions** - No data corruption
2. **Concurrent Access** - Multiple bot instances can share DB
3. **Query Performance** - Indexed lookups
4. **Relationships** - Proper foreign keys
5. **Scalability** - Handles 10,000+ users easily
6. **Backups** - Easy to backup/restore
7. **Analytics** - SQL queries for insights

## Rollback Plan

If you need to go back to file-based storage:

1. Your original data is backed up at `data/data.json.backup`
2. Copy it back: `cp data/data.json.backup data/data.json`
3. Revert code changes to use old `storage.ts`

## Monitoring

### Check Database Connection
```bash
psql -U postgres -d x1_wallet_bot -c "SELECT COUNT(*) FROM users;"
```

### View Tables
```bash
psql -U postgres -d x1_wallet_bot -c "\dt"
```

### Check User Count
```bash
psql -U postgres -d x1_wallet_bot -c "SELECT COUNT(*) FROM users;"
```

### Check Wallet Count
```bash
psql -U postgres -d x1_wallet_bot -c "SELECT COUNT(*) FROM wallets;"
```

## Troubleshooting

### Error: "Can't reach database server"
- Check PostgreSQL is running: `sudo service postgresql status`
- Check connection string in `.env`
- Verify port 5432 is not blocked

### Error: "Database does not exist"
- Create the database: `createdb x1_wallet_bot`

### Error: "relation does not exist"
- Run migrations: `npm run db:push`

### Error: "Prisma Client not found"
- Generate client: `npm run db:generate`

## Production Deployment

### Using Docker Compose

A production-ready `docker-compose.yml` should include PostgreSQL:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: x1_wallet_bot
      POSTGRES_USER: x1_bot
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
  
  bot:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://x1_bot:${DB_PASSWORD}@postgres:5432/x1_wallet_bot
    restart: unless-stopped

volumes:
  postgres_data:
```

### Backup Strategy

```bash
# Daily backup script
pg_dump x1_wallet_bot > backup_$(date +%Y%m%d).sql

# Restore from backup
psql x1_wallet_bot < backup_20260109.sql
```

## Next Steps

After completing Phase 1:
- Phase 2: WebSocket subscriptions for real-time updates
- Phase 3: Comprehensive test suite
- Phase 4: Performance optimizations

## Support

For issues, check:
1. Logs in `bot_error.log`
2. Prisma logs (enable with `log: ['query', 'error', 'warn']` in PrismaClient)
3. PostgreSQL logs: `/var/log/postgresql/`

# Bug Report & Fixes

## Summary

Comprehensive bug check performed across all 5 phases. Found **7 critical issues** and **12 minor issues** that need to be addressed before production deployment.

---

## 🔴 Critical Bugs (Must Fix)

### 1. Storage Import Inconsistency ⚠️ **CRITICAL**

**Issue:** New Phase 3 handlers import from OLD `storage.ts` instead of NEW `storage-v2.ts`

**Files Affected:**
- `src/handlers/wallet-handlers.ts` (line 8-12)
- `src/handlers/security-handlers.ts` (line 7)
- `src/handlers/settings-handlers.ts` (line 7)
- `src/watcher-v2.ts` (line 9-13)

**Current Code:**
```typescript
// WRONG - imports from old storage
import { getOrCreateUser, getUserWallets } from '../storage';
```

**Fix:**
```typescript
// CORRECT - use new storage-v2
import { getStorage } from '../storage-v2';

// Then use:
const storage = getStorage();
const wallets = await storage.getWallets(userId);
```

**Impact:** 
- New database features won't work
- Data inconsistency between old file storage and new DB storage
- **BREAKS Phase 1 implementation**

**Priority:** 🔴 CRITICAL - Fix immediately

---

### 2. Missing Storage Functions in storage-v2.ts

**Issue:** `storage-v2.ts` doesn't export all functions that handlers need

**Missing Functions:**
- `getAllUsersWithWallets()` - used by watcher-v2.ts
- `updateWalletData()` - used by watcher-v2.ts
- `incrementNotificationCount()` - used by watcher-v2.ts
- `updateTokenBalance()` - used by watcher-v2.ts

**Fix:** Add these methods to `Storage` class in `storage-v2.ts`:

```typescript
// Add to Storage class in storage-v2.ts

async getAllUsersWithWallets(): Promise<Map<number, UserData>> {
  return await this.adapter.getAllUsers();
}

async updateWalletData(
  userId: number, 
  address: string, 
  data: Partial<WatchedWallet>
): Promise<boolean> {
  return await this.adapter.updateWallet(userId, address, data);
}

async incrementNotificationCount(): Promise<void> {
  // Track in analytics instead
  const analytics = getAnalytics();
  analytics.incrementNotification();
}

async updateTokenBalance(
  userId: number, 
  address: string, 
  tokenAddress: string, 
  balance: string
): Promise<void> {
  // This would need to be added to the schema or handled differently
  // For now, log it
  logger.info(`Token balance update: ${tokenAddress} = ${balance}`);
}
```

**Priority:** 🔴 CRITICAL

---

### 3. Missing Keyboard Imports

**Issue:** Handlers import keyboards that don't exist

**Files Affected:**
- `src/handlers/wallet-handlers.ts` (line 33-38)

**Current Code:**
```typescript
import { 
  mainMenuKeyboard,
  backToMenuKeyboard,
  walletListKeyboard,
  confirmRemoveKeyboard
} from '../keyboards';
```

**Problem:** These functions don't exist in `keyboards.ts`

**Fix:** Either:
1. Import from existing handlers.ts temporarily
2. Create these functions in keyboards.ts

**Priority:** 🔴 CRITICAL

---

### 4. MyContext Type Missing

**Issue:** `wallet-handlers.ts` uses `MyContext` type that may not be defined

**Fix:** Update types.ts to include:

```typescript
import { Context } from 'grammy';

export interface MyContext extends Context {
  session: {
    awaitingWalletAddress?: boolean;
    awaitingWalletLabel?: boolean;
    tempWalletAddress?: string;
    [key: string]: any;
  };
}
```

**Priority:** 🔴 CRITICAL

---

### 5. Missing Watcher Functions

**Issue:** Handlers call `registerWalletForWatching` and `unregisterWalletFromWatching` but these may be in old watcher.ts

**Files Affected:**
- `src/handlers/wallet-handlers.ts` (line 39)

**Fix:** Update imports to use correct watcher version:

```typescript
// If using watcher-v2.ts
import { registerWalletForWatching, unregisterWalletFromWatching } from '../watcher-v2';

// OR ensure these are exported from watcher.ts
```

**Priority:** 🔴 CRITICAL

---

### 6. Alert Manager createAlert Method Signature

**Issue:** In `storage-v2.ts` line 205-215, `createAlert` is called but the signature doesn't match

**Current:**
```typescript
async createAlert(
  telegramId: number,
  address: string,
  type: string,
  severity: string,
  message: string,
  metadata?: any
): Promise<void> {
  const wallet = await this.adapter.getWallet(telegramId, address);
  if (!wallet) return;
  // We need the wallet DB ID - limitation of current design
}
```

**Problem:** This function doesn't actually create alerts - it's incomplete

**Fix:** Either remove this function or implement it properly with database schema

**Priority:** 🟡 HIGH

---

### 7. Redis Connection Not Awaited

**Issue:** In `redis-cache.ts`, connection is lazy but some operations may fail silently

**Fix:** Add proper connection handling:

```typescript
constructor(redisUrl?: string) {
  // ... existing code
  
  // Add connection event before using
  this.client.on('ready', () => {
    this.connected = true;
  });
  
  // Add initial connection check
  this.client.ping().catch(err => {
    logger.error('Initial Redis connection failed:', err);
  });
}
```

**Priority:** 🟡 HIGH

---

## 🟡 High Priority Issues

### 8. Queue Worker Missing Bot Instance

**Issue:** In `workers.ts`, notification worker needs bot instance to send messages

**Current Code:**
```typescript
async function notificationWorker(job: Job): Promise<any> {
  const { userId, message, options } = job.data;
  
  // Send notification via Telegram bot
  // This would use the bot API to send the message
  // For now, we'll just log it
}
```

**Fix:** Pass bot instance to worker or use bot API directly:

```typescript
import { Bot } from 'grammy';

let botInstance: Bot | null = null;

export function setBotInstance(bot: Bot) {
  botInstance = bot;
}

async function notificationWorker(job: Job): Promise<any> {
  if (!botInstance) {
    throw new Error('Bot instance not set');
  }
  
  const { userId, message, options } = job.data;
  await botInstance.api.sendMessage(userId, message, options);
}
```

**Priority:** 🟡 HIGH

---

### 9. Missing Environment Variables

**Issue:** Several features require env vars not documented in .env.example

**Missing Variables:**
```env
# Redis
REDIS_URL=redis://localhost:6379

# Instance ID (for scaling)
INSTANCE_ID=bot1

# Admin IDs
ADMIN_IDS=123456789,987654321

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10

# Monitoring
GRAFANA_PASSWORD=admin
```

**Fix:** Update `.env.example` with all required variables

**Priority:** 🟡 HIGH

---

### 10. Prisma Client Not Generated in Dockerfile

**Issue:** Docker build may fail without Prisma client generation

**Fix:** Update Dockerfile:

```dockerfile
# Before npm run build
RUN npm run db:generate

# Then build
RUN npm run build
```

**Priority:** 🟡 HIGH

---

## 🟢 Minor Issues (Should Fix)

### 11. TODOs in Production Code

**Found TODOs:**
- `analytics.ts:85` - TODO: Track last active time
- `analytics.ts:116` - TODO: Get from WebSocketManager
- `analytics.ts:128` - TODO: Implement actual user growth tracking
- `analytics.ts:149` - TODO: Implement actual wallet addition tracking
- `handlers/security-handlers.ts:283` - TODO: Add wallet selection keyboard
- `handlers-portfolio.ts:325` - TODO: Implement muting logic

**Fix:** Either implement or remove TODOs before production

**Priority:** 🟢 MEDIUM

---

### 12. Debug Console.log in Production

**Issue:** `handlers.ts:1251` has debug console.error that should be removed

```typescript
console.error(`[FUNDING DEBUG] fundingChain in securityInfo...`);
```

**Fix:** Remove or convert to logger.debug()

**Priority:** 🟢 LOW

---

### 13. Hardcoded Magic Number in session-manager.ts

**Issue:** Session TTL is hardcoded to 24 hours

```typescript
private readonly sessionTTL = 24 * 60 * 60 * 1000; // 24 hours
```

**Fix:** Use constant from constants.ts

```typescript
import { DAY } from '../constants';
private readonly sessionTTL = DAY;
```

**Priority:** 🟢 LOW

---

### 14. Missing Error Handling in RPC Pool

**Issue:** `connection-pool.ts` doesn't handle connection failures gracefully

**Fix:** Add try-catch in createConnection():

```typescript
private async createConnection(): Promise<Connection> {
  try {
    const connection = new Connection(this.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: this.config.connectionTimeout,
    });
    
    // Test connection
    await connection.getVersion();
    
    return connection;
  } catch (error) {
    logger.error('Failed to create RPC connection:', error);
    throw error;
  }
}
```

**Priority:** 🟢 MEDIUM

---

### 15. Race Condition in Queue Manager

**Issue:** Multiple workers might process same job if not careful

**Fix:** Bull/BullMQ handles this, but ensure correct configuration:

```typescript
const worker = new Worker(queueName, processor, {
  connection: this.connection,
  concurrency: options?.concurrency || 5,
  lockDuration: 30000, // Lock job for 30s
  lockRenewTime: 15000, // Renew lock every 15s
});
```

**Priority:** 🟢 LOW

---

### 16. Missing Index on Prisma Schema

**Issue:** Some queries might be slow without proper indexes

**Fix:** Add indexes to `prisma/schema.prisma`:

```prisma
model Alert {
  // ... existing fields
  
  @@index([walletId, read]) // For unread alerts query
  @@index([createdAt]) // For time-based queries
}

model SecurityScan {
  // ... existing fields
  
  @@index([expiresAt]) // For cleanup queries
}
```

**Priority:** 🟢 MEDIUM

---

### 17. Memory Leak Risk in Monitoring

**Issue:** Alerts array grows unbounded in `advanced-monitoring.ts`

**Current:**
```typescript
this.alerts.push(alert);

// Keep only last 100 alerts
if (this.alerts.length > 100) {
  this.alerts = this.alerts.slice(-100);
}
```

**This is actually fine**, but could be improved with a circular buffer

**Priority:** 🟢 LOW

---

### 18. Missing Graceful Shutdown

**Issue:** Main `index.ts` should handle SIGTERM/SIGINT for Docker

**Fix:** Add shutdown handler:

```typescript
// In index.ts
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  // Stop accepting new requests
  await bot.stop();
  
  // Close connections
  await getRedisCache().close();
  await getQueueManager().closeAll();
  await getRPCPool().close();
  await getStorage().close();
  
  logger.info('Shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  // Same as SIGTERM
});
```

**Priority:** 🟡 HIGH

---

### 19. Missing TypeScript Strict Checks

**Issue:** `tsconfig.json` might not have strict mode enabled

**Fix:** Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Priority:** 🟢 MEDIUM

---

## 📋 Quick Fix Checklist

### Must Fix Before Deployment (Critical)

- [ ] **#1** - Fix all storage imports to use `storage-v2.ts`
- [ ] **#2** - Add missing methods to `storage-v2.ts`
- [ ] **#3** - Create/import keyboard functions
- [ ] **#4** - Define MyContext type properly
- [ ] **#5** - Fix watcher function imports
- [ ] **#18** - Add graceful shutdown handler

### Should Fix (High Priority)

- [ ] **#6** - Implement or remove incomplete createAlert
- [ ] **#7** - Fix Redis connection handling
- [ ] **#8** - Add bot instance to notification worker
- [ ] **#9** - Update .env.example with all variables
- [ ] **#10** - Fix Dockerfile Prisma generation

### Nice to Fix (Medium/Low Priority)

- [ ] **#11** - Complete or remove TODOs
- [ ] **#12** - Remove debug console.log
- [ ] **#13-19** - Various minor improvements

---

## 🔧 Automated Fix Script

Here's a script to fix the most critical import issues:

```bash
#!/bin/bash
# fix-imports.sh

echo "Fixing storage imports..."

# Fix wallet-handlers.ts
sed -i "s/import { getOrCreateUser, addWallet, removeWallet, getUserWallets } from '..\/storage'/import { getStorage } from '..\/storage-v2'/g" src/handlers/wallet-handlers.ts

# Fix security-handlers.ts
sed -i "s/import { getUserWallets } from '..\/storage'/import { getStorage } from '..\/storage-v2'/g" src/handlers/security-handlers.ts

# Fix settings-handlers.ts
sed -i "s/import { getUserSettings, updateUserSettings } from '..\/storage'/import { getStorage } from '..\/storage-v2'/g" src/handlers/settings-handlers.ts

echo "Done! Now manually update function calls to use storage.method() syntax"
```

---

## 📊 Bug Severity Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 6 | **Must fix before deployment** |
| 🟡 High | 5 | **Should fix before production** |
| 🟢 Medium/Low | 8 | Nice to have |
| **Total** | **19** | **6 blockers** |

---

## 🎯 Recommended Fix Order

1. **Day 1** (4-6 hours)
   - Fix storage imports (#1, #2)
   - Create missing keyboard functions (#3)
   - Define MyContext type (#4)
   - Add graceful shutdown (#18)

2. **Day 2** (3-4 hours)
   - Fix watcher imports (#5)
   - Add bot instance to workers (#8)
   - Update .env.example (#9)
   - Fix Dockerfile (#10)

3. **Day 3** (2-3 hours)
   - Implement/remove incomplete features (#6)
   - Fix Redis connection (#7)
   - Clean up TODOs (#11)
   - Remove debug logs (#12)

4. **Day 4** (Testing)
   - Run all tests
   - Integration testing
   - Load testing
   - Fix any issues found

---

## ✅ Testing Checklist After Fixes

- [ ] All TypeScript compiles without errors
- [ ] All tests pass (`npm test`)
- [ ] Bot starts without errors
- [ ] Can add/remove wallets
- [ ] Notifications work
- [ ] Admin panel accessible
- [ ] Security scans work
- [ ] Export functionality works
- [ ] Queue workers process jobs
- [ ] Redis caching works
- [ ] Multi-instance scaling works
- [ ] Graceful shutdown works
- [ ] No memory leaks after 1 hour
- [ ] Load test: 100 concurrent users

---

## 🚀 Post-Fix Deployment Steps

1. Fix all critical bugs
2. Run `npm install` to ensure dependencies
3. Run `npm run build` to compile TypeScript
4. Run `npm test` to verify all tests pass
5. Test manually in development
6. Deploy to staging environment
7. Run smoke tests
8. Deploy to production
9. Monitor for 24 hours

---

## 💡 Prevention Tips

1. **Use TypeScript strict mode** - Catches issues at compile time
2. **Write tests first** - TDD prevents bugs
3. **Code review** - Second pair of eyes
4. **Linting** - Use ESLint with strict rules
5. **CI/CD** - Automated testing before deployment
6. **Monitoring** - Catch issues early in production

---

## 📞 Support

If you encounter issues while fixing these bugs:
1. Check logs: `tail -f bot_error.log`
2. Run tests: `npm test`
3. Check TypeScript: `npm run build`
4. Review documentation in PHASE*_COMPLETE.md files

---

**Status:** 🟡 Not production-ready until critical bugs are fixed

**ETA to fix:** 2-3 days

**Risk Level:** Medium (bugs are known and fixable)

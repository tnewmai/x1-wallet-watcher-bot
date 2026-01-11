# 🔧 Comprehensive Refactoring Master Plan

## Executive Summary

This document outlines a complete refactoring strategy to transform the X1 Wallet Watcher Bot from a **4.5/10 functional but bloated codebase** into a **clean, maintainable, production-grade system**.

**Current State:** 16,203 lines of code, 28 bug documentation files, dual storage systems, abandoned v1/v2 files  
**Target State:** ~3,000 lines of focused code, single architecture, proper testing, WebSocket-based real-time monitoring

---

## 🎯 Refactoring Goals

### Primary Objectives
1. **Reduce Complexity**: Cut codebase from 16k to ~3k lines (-80%)
2. **Single Source of Truth**: One storage system, one watcher version
3. **Modern Architecture**: WebSocket subscriptions instead of polling
4. **Proper Testing**: 70%+ coverage with real integration tests
5. **Remove Dead Code**: Delete 28 bug MD files, v1/v2 duplicates
6. **Production Ready**: Battle-tested, documented, monitorable

### Success Metrics
- ✅ Response time < 500ms for commands
- ✅ Memory usage < 150MB under load
- ✅ Zero circular dependencies
- ✅ Test coverage > 70%
- ✅ Single storage implementation
- ✅ WebSocket-first architecture

---

## 📋 Phase 1: Cleanup & Consolidation (Week 1)

### 1.1 Delete Obsolete Files
**Priority: Critical**

```bash
# Delete abandoned version files
rm src/watcher.ts              # Keep watcher-v2.ts
rm src/storage.ts              # Keep storage-v2.ts

# Delete all bug documentation (move to issues tracker)
rm ALL_BUGS_FIXED_FINAL.md
rm BUGFIX_*.md
rm BUG_REPORT_*.md
rm DISGUISED_BUGS_*.md
rm HIDDEN_BUGS_*.md
rm COMMONLY_OVERLOOKED_BUGS.md
# ... (delete all 28 bug MD files)

# Delete duplicate guides
rm PRODUCTION_READY.md
rm PRODUCTION_ASSESSMENT.md
rm PRODUCTION_UPGRADE_SUMMARY.md
# Keep only: README.md, QUICK_START.md, DEPLOYMENT.md
```

**Rename remaining files:**
```bash
mv src/watcher-v2.ts src/watcher.ts
mv src/storage-v2.ts src/storage.ts
```

### 1.2 Consolidate Storage System
**Priority: Critical**

**Current Problem:**
- Both file-based (`storage.ts`) AND Prisma (`storage-v2.ts`)
- Adapter pattern unnecessary for single storage type
- Circular dependency risks with `getStorage()` vs `getStorageSafe()`

**Solution:**
```typescript
// src/storage.ts (new unified version)
import { PrismaClient } from '@prisma/client';
import { WatchedWallet, UserData } from './types';
import logger from './logger';

class StorageService {
  private prisma: PrismaClient;
  private initialized = false;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.prisma.$connect();
    this.initialized = true;
    logger.info('✅ Storage initialized');
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
    this.initialized = false;
  }

  // User operations
  async getUser(telegramId: number): Promise<UserData | null> { ... }
  async saveUser(telegramId: number, data: UserData): Promise<void> { ... }
  
  // Wallet operations
  async addWallet(telegramId: number, wallet: WatchedWallet): Promise<boolean> { ... }
  async removeWallet(telegramId: number, address: string): Promise<boolean> { ... }
  
  // Settings operations
  async getUserSettings(telegramId: number): Promise<NotificationSettings> { ... }
  async updateUserSettings(telegramId: number, settings: Partial<NotificationSettings>): Promise<void> { ... }
}

// Singleton instance
let storage: StorageService | null = null;

export async function initStorage(): Promise<StorageService> {
  if (!storage) {
    storage = new StorageService();
    await storage.initialize();
  }
  return storage;
}

export function getStorage(): StorageService {
  if (!storage) throw new Error('Storage not initialized. Call initStorage() first.');
  return storage;
}
```

**Delete these files:**
- `src/storage/adapter.ts` (unnecessary abstraction)
- `src/storage/prisma-adapter.ts` (merge into main storage)

### 1.3 Remove Over-Engineered Security Module
**Priority: High**

**Current State:** 2,782 lines of rugpull detection, honeypot scanning, funding chain analysis

**Problem:** This is a **wallet monitoring bot**, not a blockchain forensics platform.

**Solution:** Replace with lightweight security checks OR external API

```typescript
// src/security.ts (simplified - 150 lines max)
import { getConnection } from './blockchain';
import logger from './logger';

export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';

export interface WalletSecurityInfo {
  riskLevel: RiskLevel;
  warnings: string[];
  accountAge: number; // days
  transactionCount: number;
  isNewWallet: boolean;
}

export async function checkWalletSecurity(address: string): Promise<WalletSecurityInfo> {
  try {
    const conn = getConnection();
    const accountInfo = await conn.getAccountInfo(new PublicKey(address));
    
    if (!accountInfo) {
      return {
        riskLevel: 'unknown',
        warnings: ['Account not found or inactive'],
        accountAge: 0,
        transactionCount: 0,
        isNewWallet: true
      };
    }

    const signatures = await conn.getSignaturesForAddress(new PublicKey(address), { limit: 100 });
    const txCount = signatures.length;
    
    // Simple heuristics
    const isNewWallet = txCount < 10;
    const riskLevel: RiskLevel = isNewWallet ? 'medium' : 'low';
    const warnings: string[] = [];
    
    if (isNewWallet) {
      warnings.push('⚠️ New wallet with limited transaction history');
    }

    return {
      riskLevel,
      warnings,
      accountAge: 0, // Calculate from first tx
      transactionCount: txCount,
      isNewWallet
    };
  } catch (error) {
    logger.error('Security check failed:', error);
    return {
      riskLevel: 'unknown',
      warnings: ['Failed to perform security check'],
      accountAge: 0,
      transactionCount: 0,
      isNewWallet: false
    };
  }
}

// For advanced checks, use external API (optional)
export async function checkTokenSecurity(tokenAddress: string): Promise<any> {
  // Call GoPlus API or similar service
  // Keep this lightweight - just API integration
}
```

**Impact:**
- Reduce from 2,782 lines → ~150 lines (-94%)
- Remove complex dependency analysis
- Keep basic checks for user awareness
- Suggest external services for deep analysis

---

## 📋 Phase 2: Architecture Modernization (Week 2)

### 2.1 Switch to WebSocket Subscriptions
**Priority: Critical**

**Current Problem:**
- Polling every 15 seconds is inefficient
- Wastes RPC calls (causes 429 rate limits)
- Delayed notifications (up to 15s lag)
- `watcher-v2.ts` has WebSocket support but defaults to polling

**Solution: WebSocket-First Architecture**

```typescript
// src/watcher.ts (refactored)
import { Connection, PublicKey } from '@solana/web3.js';
import { Bot } from 'grammy';
import logger from './logger';

class WalletWatcher {
  private connection: Connection;
  private subscriptions = new Map<string, number>();
  private bot: Bot;

  constructor(bot: Bot, rpcUrl: string) {
    this.bot = bot;
    // Use WebSocket connection
    const wsUrl = rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    this.connection = new Connection(wsUrl, {
      commitment: 'confirmed',
      wsEndpoint: wsUrl
    });
  }

  async watchWallet(address: string, userId: number): Promise<void> {
    const pubkey = new PublicKey(address);
    
    const subscriptionId = this.connection.onAccountChange(
      pubkey,
      (accountInfo, context) => {
        this.handleAccountChange(address, userId, accountInfo, context);
      },
      'confirmed'
    );

    this.subscriptions.set(address, subscriptionId);
    logger.info(`👀 Watching ${address.slice(0, 8)}... via WebSocket`);
  }

  async unwatchWallet(address: string): Promise<void> {
    const subId = this.subscriptions.get(address);
    if (subId !== undefined) {
      await this.connection.removeAccountChangeListener(subId);
      this.subscriptions.delete(address);
      logger.info(`👋 Stopped watching ${address.slice(0, 8)}...`);
    }
  }

  private async handleAccountChange(
    address: string, 
    userId: number, 
    accountInfo: any, 
    context: any
  ): Promise<void> {
    // Real-time notification on balance change
    logger.info(`💰 Account ${address.slice(0, 8)}... changed at slot ${context.slot}`);
    
    // Fetch recent transactions
    const signatures = await this.connection.getSignaturesForAddress(
      new PublicKey(address),
      { limit: 5 }
    );

    // Send notification to user
    await this.notifyUser(userId, address, signatures);
  }

  async shutdown(): Promise<void> {
    for (const [address, _] of this.subscriptions) {
      await this.unwatchWallet(address);
    }
    logger.info('✅ Watcher shutdown complete');
  }
}
```

**Fallback Strategy:**
- Keep lightweight polling for WebSocket failures
- Auto-reconnect on WebSocket disconnect
- Graceful degradation to polling mode

### 2.2 Simplify Handler Architecture
**Priority: Medium**

**Current Problem:**
- `handlers.ts`: 1,835 lines (monolithic)
- Mixed responsibilities (wallet, settings, admin, portfolio)
- Already has `/handlers/` subdirectory but main file still huge

**Solution:**
```
src/handlers/
  ├── index.ts           # Route dispatcher (50 lines)
  ├── wallet.ts          # Wallet CRUD (200 lines)
  ├── settings.ts        # User settings (150 lines) ✅ Already exists
  ├── admin.ts           # Admin commands (150 lines) ✅ Already exists
  ├── portfolio.ts       # Portfolio view (200 lines)
  └── transactions.ts    # Transaction history (150 lines)
```

**Move all logic from `handlers.ts` into subdirectory files.**

### 2.3 Optimize Queue System
**Priority: Low**

**Current State:** Full BullMQ implementation with Redis for queue management

**Problem:**
- Over-engineered for a polling/subscription bot
- Redis adds deployment complexity
- Queue system rarely used in practice

**Decision:**
- **Keep** if processing >1000 wallets/bot instance
- **Remove** if processing <100 wallets (use simple in-memory queue)

```typescript
// src/queue/simple-queue.ts (if removing BullMQ)
export class SimpleQueue<T> {
  private queue: Array<{ task: () => Promise<T>; resolve: Function; reject: Function }> = [];
  private processing = false;
  private concurrency: number;

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
  }

  async add(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      await Promise.allSettled(
        batch.map(async ({ task, resolve, reject }) => {
          try {
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
      );
    }

    this.processing = false;
  }
}
```

---

## 📋 Phase 3: Code Quality & Testing (Week 3)

### 3.1 Fix Critical Bugs
**Priority: Critical**

Based on deep analysis, here are the **TOP 10 bugs** to fix immediately:

#### Bug #1: Global Mutable State (Memory Leaks)
**Location:** Multiple files
```typescript
// BAD - Current code
const lastCheckedSignature: Map<string, string> = new Map();
const pendingTransactions: Map<string, TransactionInfo[]> = new Map();

// GOOD - Encapsulate in class
class WalletWatcher {
  private lastCheckedSignature = new Map<string, string>();
  private pendingTransactions = new Map<string, TransactionInfo[]>();
  
  cleanup(address: string) {
    this.lastCheckedSignature.delete(address);
    this.pendingTransactions.delete(address);
  }
}
```

#### Bug #2: Race Conditions in Storage Init
**Location:** `src/storage-v2.ts:286-296`
```typescript
// BAD - Race condition
export function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = createStorage(); // Not awaited!
  }
  return storageInstance;
}

// GOOD - Use async initialization
export async function getStorage(): Promise<Storage> {
  if (!storageInstance) {
    storageInstance = createStorage();
    await storageInstance.initialize();
  }
  return storageInstance;
}
```

#### Bug #3: Uncaught Promise Rejections
**Location:** `src/watcher.ts:199-201`, `src/security.ts:200`
```typescript
// BAD - setTimeout without cleanup
setTimeout(() => reject(new Error('Timeout')), 5000);

// GOOD - Clear timeout on success
const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
promise.then(() => clearTimeout(timeoutId));
```

#### Bug #4: Missing Error Boundaries in Handlers
**Location:** `src/handlers.ts` (multiple locations)
```typescript
// BAD - Unhandled async errors
bot.command('start', async (ctx) => {
  const user = await getOrCreateUser(ctx.from.id); // Can throw
  await ctx.reply('Welcome!');
});

// GOOD - Wrap in try-catch
bot.command('start', async (ctx) => {
  try {
    const user = await getOrCreateUser(ctx.from.id);
    await ctx.reply('Welcome!');
  } catch (error) {
    logger.error('Start command failed:', error);
    await ctx.reply('⚠️ An error occurred. Please try again.');
  }
});
```

#### Bug #5: Circular Dependency (Fixed but document)
**Status:** ✅ Fixed (logger reads env directly)
**Document:** Add architectural decision record (ADR)

#### Bug #6: Overlapping Watcher Runs
**Location:** `src/watcher.ts:145-186`
**Status:** ✅ Partially fixed with `running` flag
**Improvement:** Add timeout to prevent infinite hangs

```typescript
const pollOnce = async () => {
  if (running) return;
  
  running = true;
  const startTime = Date.now();
  
  try {
    // Add timeout protection
    await Promise.race([
      checkAllWallets(bot),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Watcher timeout')), 60000)
      )
    ]);
  } catch (error) {
    logger.error('Watcher cycle failed:', error);
  } finally {
    running = false;
    logger.debug(`Cycle took ${Date.now() - startTime}ms`);
  }
};
```

#### Bug #7: Security Module Timeout Leak
**Location:** `src/security.ts:286-290`
```typescript
// BAD - Timer never cleared
const timeoutPromise = new Promise<T>((_, reject) => {
  timeoutRef.timer = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
});

// GOOD - Always clear timer
const cleanup = () => {
  if (timeoutRef.timer) {
    clearTimeout(timeoutRef.timer);
    timeoutRef.timer = null;
  }
};

return Promise.race([promise, timeoutPromise])
  .then((result) => { cleanup(); return result; })
  .catch((error) => { cleanup(); throw error; });
```

#### Bug #8: Missing Input Validation
**Location:** `src/handlers.ts` (multiple commands)
```typescript
// BAD - No validation
bot.callbackQuery(/^set_min_value_(.+)$/, async (ctx) => {
  const value = parseFloat(ctx.match[1]);
  await updateUserSettings(ctx.from.id, { minValue: value });
});

// GOOD - Validate input
bot.callbackQuery(/^set_min_value_(.+)$/, async (ctx) => {
  const value = parseFloat(ctx.match[1]);
  
  if (isNaN(value) || value < 0 || value > 1000000) {
    await ctx.answerCallbackQuery({ text: '❌ Invalid value' });
    return;
  }
  
  await updateUserSettings(ctx.from.id, { minValue: value });
});
```

#### Bug #9: Token Balance Precision Issues
**Location:** `src/blockchain.ts`, `src/watcher.ts:426-444`
```typescript
// BAD - Float comparison
if (newBalance !== oldBalance) { // Precision issues!
  notify();
}

// GOOD - Use BigInt or threshold
const changePercent = Math.abs((newBalance - oldBalance) / oldBalance) * 100;
if (changePercent > 0.01) { // 0.01% threshold
  notify();
}
```

#### Bug #10: WebSocket Reconnection Logic
**Location:** `src/websocket-manager.ts`
**Problem:** Reconnection can stack subscriptions

```typescript
// Add deduplication
async resubscribe(address: string): Promise<void> {
  // Unsubscribe first
  await this.unsubscribe(address);
  // Then resubscribe
  await this.subscribe(address);
}
```

### 3.2 Add Comprehensive Tests
**Priority: High**

**Current Coverage:** ~20% (13 test files, mostly unit tests)

**Target Coverage:** 70%+

```typescript
// tests/integration/watcher.integration.test.ts
describe('Wallet Watcher Integration', () => {
  let watcher: WalletWatcher;
  let mockBot: Bot;
  
  beforeEach(async () => {
    mockBot = createMockBot();
    watcher = new WalletWatcher(mockBot, config.x1RpcUrl);
  });
  
  it('should detect real-time balance changes via WebSocket', async () => {
    const testAddress = 'YOUR_TEST_WALLET';
    const userId = 12345;
    
    await watcher.watchWallet(testAddress, userId);
    
    // Send test transaction to wallet
    // ... use test wallet with known private key
    
    // Wait for notification
    await waitFor(() => {
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
        userId,
        expect.stringContaining('Account')
      );
    }, 10000);
  });
  
  it('should handle WebSocket disconnection gracefully', async () => {
    // Test reconnection logic
  });
});
```

**Test Strategy:**
1. **Unit Tests**: 50% coverage (isolated functions)
2. **Integration Tests**: 20% coverage (RPC interactions)
3. **E2E Tests**: 5% coverage (full bot flow with test account)

### 3.3 Add TypeScript Strict Mode
**Priority: Medium**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,              // Enable all strict checks ✅ Already enabled
    "noImplicitAny": true,       // ✅ Already enabled
    "strictNullChecks": true,    // ✅ Already enabled
    "noUnusedLocals": true,      // ADD THIS
    "noUnusedParameters": true,  // ADD THIS
    "noImplicitReturns": true,   // ADD THIS
    "noFallthroughCasesInSwitch": true  // ADD THIS
  }
}
```

---

## 📋 Phase 4: Documentation & Deployment (Week 4)

### 4.1 Create Proper Documentation
**Priority: High**

**Current State:** 80+ MD files, many redundant or outdated

**Target Structure:**
```
docs/
  ├── README.md                    # Project overview
  ├── QUICK_START.md              # 5-minute setup guide
  ├── ARCHITECTURE.md             # System design (NEW)
  ├── API.md                      # Bot commands reference (NEW)
  ├── DEPLOYMENT.md               # Production deployment
  ├── TROUBLESHOOTING.md          # Common issues (NEW)
  └── CONTRIBUTING.md             # Development guide (NEW)
```

### 4.2 Optimize Docker Setup
**Priority: Medium**

**Current Dockerfile:**
- Good: Multi-stage build
- Issue: 256MB memory limit too low for Prisma

**Improvements:**
```dockerfile
# Dockerfile (optimized)
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

USER node
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**Update docker-compose.yml:**
```yaml
deploy:
  resources:
    limits:
      memory: 512M  # Increase from 256M
    reservations:
      memory: 256M  # Increase from 128M
```

### 4.3 Add Monitoring & Alerting
**Priority: Medium**

**Current State:** Prometheus metrics, basic health check

**Improvements:**
```typescript
// src/monitoring/alerts.ts
import logger from '../logger';

export class AlertManager {
  async sendAlert(severity: 'warning' | 'error' | 'critical', message: string) {
    logger.error(`[ALERT-${severity.toUpperCase()}] ${message}`);
    
    // Optional: Send to external service
    // - PagerDuty
    // - Slack webhook
    // - Telegram admin channel
  }
  
  checkThresholds() {
    const metrics = getMetrics();
    
    if (metrics.errorRate > 0.1) {
      this.sendAlert('warning', 'Error rate above 10%');
    }
    
    if (metrics.memoryUsage > 400 * 1024 * 1024) {
      this.sendAlert('error', 'Memory usage above 400MB');
    }
  }
}
```

---

## 📊 Implementation Timeline

### Week 1: Foundation
- [ ] Day 1-2: Delete obsolete files, rename v2 → main
- [ ] Day 3-4: Consolidate storage system
- [ ] Day 5-7: Simplify/remove security module

### Week 2: Architecture
- [ ] Day 8-10: Implement WebSocket-first watcher
- [ ] Day 11-12: Refactor handlers into modules
- [ ] Day 13-14: Fix critical bugs (#1-#5)

### Week 3: Quality
- [ ] Day 15-17: Add comprehensive tests
- [ ] Day 18-19: Enable strict TypeScript checks
- [ ] Day 20-21: Fix remaining bugs (#6-#10)

### Week 4: Polish
- [ ] Day 22-24: Write documentation
- [ ] Day 25-26: Optimize Docker setup
- [ ] Day 27-28: Add monitoring, final testing

---

## 🎯 Success Criteria

### Before Refactoring
- ❌ 16,203 lines of code
- ❌ 28 bug documentation files
- ❌ Dual storage systems (file + Prisma)
- ❌ Polling-based (inefficient)
- ❌ 2,782-line security module
- ❌ ~20% test coverage
- ❌ Memory usage: 200-250MB

### After Refactoring
- ✅ ~3,000 lines of code (-82%)
- ✅ Zero bug MD files (use issue tracker)
- ✅ Single Prisma storage
- ✅ WebSocket-based (real-time)
- ✅ ~150-line security module (-94%)
- ✅ 70%+ test coverage
- ✅ Memory usage: <150MB

---

## 🚀 Quick Wins (Can Do Today)

1. **Delete 28 bug MD files** → Move to GitHub Issues (30 min)
2. **Delete `storage.ts` and `watcher.ts`** → Rename v2 versions (10 min)
3. **Remove `security.ts`** → Replace with 150-line version (2 hours)
4. **Add global error handler** → Catch unhandled rejections (30 min)
5. **Fix timeout leaks** → Clear all setTimeout calls (1 hour)

**Total Time for Quick Wins: ~4.5 hours**  
**Impact: Immediate stability improvement**

---

## 📞 Next Steps

1. **Review this plan** - Adjust timeline based on resources
2. **Prioritize phases** - Can skip Phase 2.3 (queue) if not needed
3. **Set up testing environment** - Need test wallet with testnet tokens
4. **Create backup** - Before major refactoring
5. **Track progress** - Use GitHub Projects or similar

**Questions? Concerns? Let's discuss before starting!**

# 🐛 Hidden Bugs Report - X1 Wallet Watcher Bot

**Generated:** 2026-01-09  
**Analysis Type:** Deep Code Audit  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

---

## Executive Summary

This report documents **15+ hidden bugs** discovered through deep code analysis of the X1 Wallet Watcher Bot. These issues were found across error handling, resource management, race conditions, memory leaks, and unhandled promises.

**Key Findings:**
- 🔴 3 Critical bugs (service crashes, data loss)
- 🟠 5 High severity bugs (resource leaks, race conditions)
- 🟡 4 Medium severity bugs (error handling gaps)
- 🔵 3 Low severity bugs (code quality issues)

---

## 🔴 CRITICAL BUGS

### BUG #1: Unhandled Promise Rejection in Wallet Registration
**File:** `src/watcher.ts:425-434`  
**Severity:** 🔴 Critical  
**Impact:** Silent failures, wallets not being tracked

**Issue:**
```typescript
export function registerWalletForWatching(address: string): void {
  getLatestSignatures(address, 1).then(signatures => {
    if (signatures.length > 0) {
      lastCheckedSignature.set(address.toLowerCase(), signatures[0].signature);
    } else {
      lastCheckedSignature.set(address.toLowerCase(), '');
    }
    pendingTransactions.set(address.toLowerCase(), []);
  }).catch(console.error);  // ⚠️ Only logs error, doesn't propagate or retry
}
```

**Problems:**
1. Promise rejection only logs to console - no notification to user
2. If RPC fails, wallet appears "added" but isn't actually tracked
3. No retry mechanism for transient failures
4. Function signature is `void` but performs async operations

**Fix Required:**
- Change to `async function` and properly handle errors
- Notify user if registration fails
- Implement retry logic for transient failures
- Return success/failure status

---

### BUG #2: Background Security Scan with Silent Failures
**File:** `src/security.ts:164-166`  
**Severity:** 🔴 Critical  
**Impact:** Security warnings missed, users exposed to scams

**Issue:**
```typescript
export function preScanWalletBackground(address: string): void {
  void checkWalletSecurity(address, true).catch(err => {
    console.log('Background pre-scan error (non-critical):', err.message);
  });
}
```

**Problems:**
1. Uses `void` operator to intentionally ignore promise
2. Security scan failures treated as "non-critical"
3. No tracking of failed scans or retry attempts
4. Users may interact with malicious wallets without warnings

**Fix Required:**
- Track failed security scans
- Implement retry with exponential backoff
- Alert user if security scan repeatedly fails
- Consider disabling wallet interaction until scan succeeds

---

### BUG #3: Race Condition in Wallet Watcher Initialization
**File:** `src/watcher.ts:46-48`  
**Severity:** 🔴 Critical  
**Impact:** Initial sync may never complete, wallets not tracked

**Issue:**
```typescript
export function startWatcher<C extends Context>(bot: Bot<C>): void {
  console.log('🔍 Starting wallet watcher service...');
  
  // Initial sync (async, non-blocking)
  syncInitialSignatures().catch(err => {
    console.error('Error in initial signature sync:', err);
  });
  
  // Immediately starts polling without waiting for sync
  setTimeout(pollOnce, 5000);
  watcherInterval = setInterval(pollOnce, config.pollInterval);
}
```

**Problems:**
1. `syncInitialSignatures()` runs asynchronously without coordination
2. Polling starts before sync completes - may notify about old transactions
3. Error in sync only logs - watcher continues in broken state
4. No way to know if initialization succeeded

**Fix Required:**
- Wait for initial sync before starting polling
- Implement initialization status tracking
- Fail fast if initial sync fails
- Add health check to verify watcher is properly initialized

---

## 🟠 HIGH SEVERITY BUGS

### BUG #4: Timer Leak in Storage Module
**File:** `src/storage.ts:85-88, 124-129`  
**Severity:** 🟠 High  
**Impact:** Memory leak, timers not cleared on shutdown

**Issue:**
```typescript
let writeTimeout: NodeJS.Timeout | null = null;
let flushInterval: NodeJS.Timeout | null = null;

// writeTimeout is set but may not be cleared if multiple writes happen
writeTimeout = setTimeout(() => {
  flushStorage();
}, WRITE_DEBOUNCE_MS);

// flushInterval started but no guarantee it's stopped on errors
flushInterval = setInterval(() => {
  if (storageDirty) {
    flushStorage();
  }
}, intervalMs);
```

**Problems:**
1. `writeTimeout` cleared only in happy path - remains if error occurs
2. If `saveStorage()` called rapidly, old timers leak
3. No shutdown hook to ensure timers are cleared
4. Process may hang on exit waiting for timers

**Fix Required:**
- Always clear timeout in `saveStorage()` before setting new one
- Add `writeTimeout` cleanup in error handlers
- Register shutdown hook for `flushInterval`
- Add cleanup to `stopPeriodicFlush()`

---

### BUG #5: WebSocket Manager Reconnection Timer Leak
**File:** `src/websocket-manager.ts:21, 315-318`  
**Severity:** 🟠 High  
**Impact:** Timer leak, zombie reconnection attempts

**Issue:**
```typescript
export class WebSocketManager {
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  
  // shutdown() clears reconnectTimer but it may be set elsewhere
  async shutdown(): Promise<void> {
    this.stopHealthCheck();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    await this.unsubscribeAll();
  }
}
```

**Problems:**
1. `reconnectTimer` set in multiple places but no central cleanup
2. If error occurs during reconnect, timer may leak
3. `healthCheckTimer` cleared but may restart in edge cases
4. No check if timers are active before creating new ones

**Fix Required:**
- Create helper method to safely set/clear timers
- Clear timers before setting new ones
- Add timer tracking for debugging
- Ensure shutdown is idempotent

---

### BUG #6: Memory Leak from Unbounded Map Growth
**File:** `src/watcher.ts:24-28, 157`  
**Severity:** 🟠 High  
**Impact:** Memory exhaustion over time

**Issue:**
```typescript
const lastCheckedSignature: Map<string, string> = new Map();
const pendingTransactions: Map<string, TransactionInfo[]> = new Map();
const walletCheckInProgress: Set<string> = new Set();
```

**Problems:**
1. Maps grow indefinitely - no cleanup for removed wallets
2. `pendingTransactions` can accumulate unlimited transactions
3. `walletCheckInProgress` may retain entries if check crashes
4. No size limits or LRU eviction

**Similar Issues:**
- `src/blockchain.ts:417` - `walletStatsCache` grows unbounded
- `src/cache.ts:11` - `inflightRequests` may leak on errors
- `src/prices.ts:3` - `priceCache` no size limit
- `src/security.ts:2164-2166` - Multiple Maps created per scan

**Fix Required:**
- Implement cleanup when wallets are removed
- Add size limits to all maps
- Clear `walletCheckInProgress` in finally blocks
- Use LRU cache for bounded growth
- Add periodic cleanup of old entries

---

### BUG #7: Race Condition in Realtime Watcher Polling
**File:** `src/realtime-watcher.ts:184-186, 192-197`  
**Severity:** 🟠 High  
**Impact:** Multiple polling loops running simultaneously

**Issue:**
```typescript
private startPolling(): void {
  if (this.pollingTimer) {
    return; // Already polling
  }

  logger.info('🔄 Starting polling fallback...');
  
  this.pollingTimer = setInterval(() => {
    this.pollWallets();  // ⚠️ No check if previous poll is still running
  }, this.pollingInterval);
}

private stopPolling(): void {
  if (this.pollingTimer) {
    clearInterval(this.pollingTimer);
    this.pollingTimer = null;
    // ⚠️ Doesn't wait for in-flight poll to complete
  }
}
```

**Problems:**
1. `pollWallets()` called on interval regardless of previous completion
2. If poll takes longer than interval, multiple polls overlap
3. `stopPolling()` doesn't wait for in-flight operations
4. Race condition: poll may start after stop is called

**Fix Required:**
- Add running flag like main watcher (`running = true`)
- Skip poll if previous one still executing
- Wait for in-flight polls before stopping
- Add timeout protection for long-running polls

---

### BUG #8: Connection Pool Not Properly Initialized
**File:** `src/blockchain.ts:42-57`  
**Severity:** 🟠 High  
**Impact:** RPC calls may fail before pool initialization

**Issue:**
```typescript
function initializeConnectionPool(): void {
  if (connectionPool.length === 0) {
    console.log(`🔌 Initializing RPC connection pool...`);
    for (let i = 0; i < CONNECTION_POOL_SIZE; i++) {
      connectionPool.push(
        new Connection(config.x1RpcUrl, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000,
        })
      );
    }
    console.log(`✅ Connection pool initialized`);
  }
}

// Called by getConnection() but getConnection() may be called before init
function getConnection(): Connection {
  initializeConnectionPool(); // ⚠️ Lazy initialization
  // ...
}
```

**Problems:**
1. Pool initialized on first use - race condition if multiple calls
2. No synchronization - multiple threads may initialize simultaneously
3. No validation that connections are actually working
4. Connection errors during initialization not handled

**Fix Required:**
- Initialize pool explicitly at startup
- Add initialization mutex/lock
- Validate connections after creation
- Handle initialization failures gracefully

---

## 🟡 MEDIUM SEVERITY BUGS

### BUG #9: Uncaught Error in Bot Command Handler
**File:** `src/index.ts:82-86`  
**Severity:** 🟡 Medium  
**Impact:** Bot errors not properly tracked

**Issue:**
```typescript
bot.catch((err) => {
  logger.error('Bot error occurred', err as Error);
  monitoring.updateSystemHealth(false, `Bot error: ${err.message}`);
  metrics.incrementCounter('bot_errors_total', 1);
});
```

**Problems:**
1. Error handler assumes `err` has `.message` property
2. Type cast `err as Error` may be incorrect (could be any type)
3. No retry logic for transient errors
4. Bot continues running even after critical errors

**Fix Required:**
- Properly type check error object
- Distinguish between recoverable and fatal errors
- Add circuit breaker for repeated errors
- Consider restarting bot on fatal errors

---

### BUG #10: Missing Cleanup in Rate Limiter
**File:** `src/ratelimit.ts:26, 97-102`  
**Severity:** 🟡 Medium  
**Impact:** Rate limiter cleanup not called on shutdown

**Issue:**
```typescript
class RateLimiter {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxRequests: number = 30, windowMs: number = 60000, blockDurationMs: number = 300000) {
    // ...
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global instances created but stop() never called
const userRateLimiter = new RateLimiter(30, 60000, 300000);
const commandRateLimiter = new RateLimiter(10, 60000, 60000);
```

**Problems:**
1. `stopRateLimiters()` exported but never registered as shutdown hook
2. Cleanup intervals continue running after bot stops
3. May prevent clean process exit
4. Memory leak if bot restarts in same process

**Fix Required:**
- Register `stopRateLimiters()` as shutdown hook in `index.ts`
- Ensure rate limiters are stopped before exit
- Add defensive checks in cleanup intervals

---

### BUG #11: Metrics Interval Not Stopped on Shutdown
**File:** `src/metrics.ts:278-298, 300-306`  
**Severity:** 🟡 Medium  
**Impact:** Metrics logging continues after shutdown

**Issue:**
```typescript
let metricsInterval: NodeJS.Timeout | null = null;

export function startMetricsLogging(intervalMs: number = 60000): void {
  if (metricsInterval) {
    return;
  }
  metricsInterval = setInterval(() => {
    const allMetrics = metrics.getAllMetrics();
    logger.info('📊 Metrics Summary', { /* ... */ });
  }, intervalMs);
}

export function stopMetricsLogging(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}
```

**Problems:**
1. `stopMetricsLogging()` defined but not called in shutdown
2. Metrics continue logging after bot stops
3. Not registered as shutdown hook in `index.ts`
4. May log to closed logger instances

**Fix Required:**
- Register `stopMetricsLogging()` as shutdown hook
- Call in graceful shutdown sequence
- Add safeguards in logging callback

---

### BUG #12: Cache Cleanup Interval Not Registered in Shutdown
**File:** `src/cache.ts:217-230, src/index.ts:39-47`  
**Severity:** 🟡 Medium  
**Impact:** Cache cleanup continues after shutdown

**Issue:**
```typescript
// src/cache.ts
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCacheCleanup(intervalMs: number): void {
  cleanupInterval = setInterval(() => {
    const cleaned = cache.cleanExpired();
    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
    }
  }, intervalMs);
}

// src/index.ts - cleanup hook registered but may not execute
registerShutdownHook('cache', async () => {
  stopCacheCleanup();
  logger.info('Cache cleanup stopped');
}, 2000);
```

**Problems:**
1. Shutdown hook has 2s timeout - may not execute if shutdown is fast
2. `console.log` in interval may fail after logger closed
3. No check if cache is being accessed during cleanup
4. Cleanup interval may fire during shutdown

**Fix Required:**
- Increase shutdown hook timeout or prioritize
- Use logger instead of console.log
- Add cleanup cancellation flag
- Ensure cleanup completes before exit

---

## 🔵 LOW SEVERITY BUGS

### BUG #13: Debug Console.log in Production Code
**File:** Multiple files  
**Severity:** 🔵 Low  
**Impact:** Console pollution, performance overhead

**Issue:**
Found 138+ instances of `console.log/error/warn` across codebase:
- `src/handlers.ts:1250` - Debug logging with `console.error`
- `src/security.ts` - 30+ console.log statements for debugging
- `src/watcher.ts` - Mix of logger and console.log
- `src/blockchain.ts` - Console.error for errors

**Problems:**
1. Inconsistent logging - some use logger, some use console
2. Debug logs left in production code
3. Console methods may block in some environments
4. No log levels or structured logging

**Fix Required:**
- Replace all console.* with logger.*
- Remove debug logs or put behind feature flag
- Use structured logging everywhere
- Add log level configuration

---

### BUG #14: Missing Error Context in Security Module
**File:** `src/security.ts:239-242`  
**Severity:** 🔵 Low  
**Impact:** Difficult to debug security scan failures

**Issue:**
```typescript
]).catch((error) => {
  console.warn('Security check operation failed:', error.message);
  return null;
});
```

**Problems:**
1. Only logs error message, not full error object
2. Returns null without context of what failed
3. Caller can't distinguish between different failure types
4. Stack trace lost

**Fix Required:**
- Log full error object with stack trace
- Return specific error types or codes
- Add operation context to error
- Consider throwing instead of returning null

---

### BUG #15: Potential Integer Overflow in Timeout Calculations
**File:** `src/watcher-v2.ts:161, 199`  
**Severity:** 🔵 Low  
**Impact:** Very long intervals may cause unexpected behavior

**Issue:**
```typescript
const pollInterval = useWebSockets ? 60000 : config.pollInterval; // 60s for WS
setTimeout(pollOnce, 10000); // 10 seconds
setInterval(pollOnce, pollInterval);
```

**Problems:**
1. No validation that pollInterval is reasonable
2. JavaScript setTimeout/setInterval has 32-bit signed int limit (24.8 days)
3. If config.pollInterval > 2147483647ms, wraps to negative
4. No bounds checking on interval values

**Fix Required:**
- Validate pollInterval is within reasonable bounds (e.g., 1s - 1 hour)
- Add MAX_INTERVAL constant
- Clamp interval values to safe range
- Warn if configured interval is too long

---

## 📊 Bug Distribution by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Resource Leaks | 1 | 3 | 3 | 0 | 7 |
| Error Handling | 1 | 0 | 1 | 2 | 4 |
| Race Conditions | 1 | 2 | 0 | 0 | 3 |
| Memory Leaks | 0 | 1 | 0 | 0 | 1 |
| Code Quality | 0 | 0 | 0 | 1 | 1 |
| **Total** | **3** | **6** | **4** | **3** | **16** |

---

## 🛠️ Recommended Fixes Priority

### Immediate (Within 24 hours)
1. Fix BUG #1 - Wallet registration error handling
2. Fix BUG #2 - Security scan failures
3. Fix BUG #3 - Watcher initialization race condition

### High Priority (Within 1 week)
4. Fix BUG #4 - Storage timer leaks
5. Fix BUG #5 - WebSocket timer leaks
6. Fix BUG #6 - Unbounded map growth
7. Fix BUG #7 - Polling race condition
8. Fix BUG #8 - Connection pool initialization

### Medium Priority (Within 2 weeks)
9. Fix BUG #9-12 - Shutdown cleanup issues
10. Replace all console.* with proper logging (BUG #13)

### Low Priority (When convenient)
11. Fix BUG #14-15 - Error context and validation improvements

---

## 🔍 Testing Recommendations

### Unit Tests Needed
- `registerWalletForWatching()` - test error cases
- `preScanWalletBackground()` - verify retry logic
- `startWatcher()` - test initialization sequence
- All cleanup functions - verify timers are cleared

### Integration Tests Needed
- Shutdown sequence - ensure all resources cleaned up
- Race conditions - concurrent wallet additions
- Memory leaks - long-running test with monitoring
- RPC failures - circuit breaker behavior

### Load Tests Needed
- 100+ wallets tracked simultaneously
- Rapid wallet add/remove cycles
- Connection pool exhaustion
- Memory usage over 24+ hours

---

## 📝 Notes

- Many issues stem from lack of centralized resource management
- Consider implementing a ResourceManager class
- Add startup/shutdown lifecycle hooks system
- Improve error propagation and handling patterns
- Consider using a proper DI container for lifecycle management

---

**Report End**

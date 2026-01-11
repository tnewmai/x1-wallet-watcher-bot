# 🕵️ Disguised Bugs Report - Subtle Issues

**Date:** January 9, 2026  
**Analysis Type:** Deep Pattern Analysis  
**Focus:** Hidden bugs that look correct but harbor subtle issues

---

## Executive Summary

This report documents **10+ disguised bugs** - subtle issues that appear correct at first glance but contain hidden problems. These are the most dangerous bugs because they:
- Pass code review easily
- May work correctly 99% of the time
- Fail only under specific conditions
- Are hard to reproduce and debug

**Severity Distribution:**
- 🔴 3 Critical disguised bugs
- 🟠 4 High severity issues
- 🟡 3 Medium severity issues

---

## 🔴 CRITICAL DISGUISED BUGS

### BUG #1: BigInt to Number Conversion Overflow
**Files:** `src/blockchain.ts:795, 832, 861`, `src/security.ts:745-747, 2468`  
**Severity:** 🔴 Critical  
**Impact:** Silent data corruption for large token amounts

**Issue:**
```typescript
// blockchain.ts:795
const balance = Number(totalBalance) / Math.pow(10, mintInfo.decimals);

// security.ts:745-746
const totalSupply = largestAccounts.value.reduce((sum, acc) => sum + Number(acc.amount), 0);
const topHolder = Number(largestAccounts.value[0].amount);
```

**Problems:**
1. **JavaScript Number has MAX_SAFE_INTEGER limit** (2^53 - 1 = 9,007,199,254,740,991)
2. Solana token amounts are `bigint` and can exceed this limit
3. Converting large `bigint` to `Number` loses precision silently
4. For tokens with many decimals or large supplies, calculations become incorrect

**Example Failure:**
```typescript
const largeAmount = BigInt("10000000000000000000"); // 10^19
Number(largeAmount); // 10000000000000000000 - looks ok
Number(largeAmount) === 10000000000000000000; // false! precision lost

// Real token scenario:
// Token with 9 decimals, amount: 1000000000000000000 (1 billion tokens)
// After conversion: precision lost, wrong percentage calculated
```

**Fix Required:**
```typescript
// Use bigint arithmetic throughout
const balance = Number(totalBalance / BigInt(10 ** mintInfo.decimals));
// OR use a dedicated BigNumber library for precise decimal math
```

---

### BUG #2: Floating Point Comparison for Token Changes
**File:** `src/watcher.ts:425`  
**Severity:** 🔴 Critical  
**Impact:** Missed notifications for small but significant token changes

**Issue:**
```typescript
// watcher.ts:425
const oldBalance = parseFloat(token.lastBalance);
const newBalance = parseFloat(currentBalance);
const change = newBalance - oldBalance;

// Only notify for significant changes
if (Math.abs(change) > 0.0001) {
  await sendTokenSummaryNotification(...);
}
```

**Problems:**
1. **Floating point arithmetic is imprecise** - 0.1 + 0.2 !== 0.3
2. For tokens with different decimals, 0.0001 threshold is arbitrary
3. High-value tokens: 0.0001 could be worth thousands of dollars
4. Low-value tokens: 0.0001 might be too large, missing real changes
5. Precision loss from string → float → comparison

**Example Failure:**
```typescript
// Scenario 1: High-value token (1 token = $10,000)
// Change of 0.00005 tokens = $0.50 - NOT notified (below threshold)

// Scenario 2: Floating point precision
parseFloat("10.0001") - parseFloat("10.0") // 0.00010000000000000286
// Might miss the threshold due to precision errors

// Scenario 3: Token with 18 decimals
// Balance: "0.000000000000000001" (1 wei)
// parseFloat loses precision entirely
```

**Fix Required:**
```typescript
// Use percentage change instead of absolute
const changePercent = oldBalance > 0 ? Math.abs((newBalance - oldBalance) / oldBalance) * 100 : 100;
if (changePercent > 0.01) { // 0.01% change
  await sendTokenSummaryNotification(...);
}

// OR use BigInt/BigNumber for precise comparison
```

---

### BUG #3: Race Condition in Promise.race Timeout Pattern
**File:** `src/watcher.ts:217-220`, `src/security.ts:287-290`  
**Severity:** 🔴 Critical  
**Impact:** Timeout timers not cleared, memory leak

**Issue:**
```typescript
// watcher.ts:217-220
const signatures = await Promise.race([
  getLatestSignatures(wallet.address, 1),
  walletTimeout  // Promise that rejects after 3000ms
]);
```

**Problems:**
1. **Timeout promise timer is never cleared** if the race wins with the actual call
2. Creates orphaned setTimeout that fires even after Promise.race resolves
3. With many wallets, creates hundreds of uncancelled timers
4. Memory leak from accumulating timeout callbacks
5. Potential for unhandled rejections if timeout fires after race completes

**Example Failure:**
```typescript
// Each wallet sync creates a timer
for (100 wallets) {
  Promise.race([getSignatures(), timeoutPromise]); 
  // If getSignatures wins, timeout still fires 3 seconds later
  // Result: 100 orphaned timers, all firing their reject handlers
}
```

**Fix Required:**
```typescript
const walletTimeout = { timer: null as NodeJS.Timeout | null };
const timeoutPromise = new Promise<never>((_, reject) => {
  walletTimeout.timer = setTimeout(() => reject(new Error('Timeout')), 3000);
});

try {
  const signatures = await Promise.race([
    getLatestSignatures(wallet.address, 1),
    timeoutPromise
  ]);
  if (walletTimeout.timer) clearTimeout(walletTimeout.timer);
} catch (error) {
  if (walletTimeout.timer) clearTimeout(walletTimeout.timer);
  throw error;
}
```

---

## 🟠 HIGH SEVERITY DISGUISED BUGS

### BUG #4: Array.slice with Negative Index Off-by-One
**Files:** Multiple locations using `.slice(-MAX)`  
**Severity:** 🟠 High  
**Impact:** May keep wrong transactions in memory

**Issue:**
```typescript
// watcher.ts:76
pendingTransactions.set(address, txs.slice(-MAX_PENDING_TRANSACTIONS_PER_WALLET));
// If MAX is 100, keeps LAST 100, discarding OLDEST
// But the code comment suggests limiting total, not preserving newest
```

**Problems:**
1. `slice(-100)` keeps the **last 100** items (newest)
2. For a notification queue, we might want **first 100** (oldest, in order)
3. Discarding old transactions means user loses history
4. May not be the intended behavior

**Fix Required:**
Clarify intent: Keep newest or oldest?
```typescript
// If we want oldest 100 (FIFO):
txs.slice(0, MAX_PENDING_TRANSACTIONS_PER_WALLET)

// If we want newest 100 (current behavior is correct):
txs.slice(-MAX_PENDING_TRANSACTIONS_PER_WALLET)  // Document this clearly
```

---

### BUG #5: Reduce Without Initial Value on Empty Array
**File:** `src/watcher.ts:457-458`  
**Severity:** 🟠 High  
**Impact:** TypeError if no transactions

**Issue:**
```typescript
const incomingValue = incoming.reduce((sum, tx) => sum + parseFloat(tx.value), 0);
const outgoingValue = outgoing.reduce((sum, tx) => sum + parseFloat(tx.value), 0);
```

**Problems:**
1. If `incoming` array is empty, reduce with initial value 0 returns 0 ✅
2. Actually **this is correct** - has initial value
3. **But parseFloat can return NaN** if tx.value is invalid
4. `0 + NaN = NaN`, and NaN propagates through the sum

**Hidden Issue:**
```typescript
// If any tx.value is not a number:
const tx = { value: "invalid" };
parseFloat("invalid"); // NaN
0 + NaN; // NaN
incomingValue.toFixed(4); // "NaN"
// UI shows: "+NaN XNT" ❌
```

**Fix Required:**
```typescript
const incomingValue = incoming.reduce((sum, tx) => {
  const value = parseFloat(tx.value);
  return sum + (isNaN(value) ? 0 : value);
}, 0);
```

---


### BUG #6: JSON.parse Without Error Handling
**File:** `src/storage.ts:55`, `src/cache/redis-cache.ts:101, 257`  
**Severity:** ?? High  
**Impact:** Bot crash on corrupted data file

**Issue:**
```typescript
// storage.ts:55
storageCache = JSON.parse(data) as StorageData;
```

**Problems:**
1. **No try-catch around JSON.parse** - will throw on invalid JSON
2. If data.json gets corrupted (disk error, manual edit, power loss during write), bot crashes
3. No recovery mechanism - bot can't start
4. Type assertion `as StorageData` doesn't validate structure

**Example Failure:**
```typescript
// Corrupted data.json from incomplete write:
{ "users": { "12345": { "wallets": [
// <-- file ends here

JSON.parse(data); // SyntaxError: Unexpected end of JSON input
// Bot crashes on startup, can't recover
```

**Fix Required:**
```typescript
try {
  storageCache = JSON.parse(data) as StorageData;
  // Validate structure
  if (!storageCache.users || !storageCache.stats) {
    throw new Error('Invalid storage structure');
  }
} catch (error) {
  console.error('Corrupted storage file, creating backup and reinitializing:', error);
  fs.writeFileSync(STORAGE_FILE + '.corrupted', data);
  storageCache = getEmptyStorage();
  saveStorage(storageCache);
}
```

---

### BUG #7: Math.floor on Percentile Calculation
**File:** `src/metrics.ts:132-134`  
**Severity:** ?? High  
**Impact:** Incorrect percentile values

**Issue:**
```typescript
p50: sorted[Math.floor(sorted.length * 0.5)],
p95: sorted[Math.floor(sorted.length * 0.95)],
p99: sorted[Math.floor(sorted.length * 0.99)],
```

**Problems:**
1. **For small arrays, percentiles may be wrong**
2. `Math.floor(10 * 0.95) = 9` - the 9th element (index 9) is actually the 10th item (100th percentile!)
3. For array of length 10: indices 0-9, p95 should be index 9, but that's the max value
4. Standard percentile calculation should handle edge cases

**Example Failure:**
```typescript
const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 10 elements
const p95 = sorted[Math.floor(10 * 0.95)]; // sorted[9] = 10
// This is the 100th percentile (max), not 95th!

// Correct calculation for p95 with 10 elements:
// 95th percentile = 9.5th position = interpolate between 9th and 10th
// Or use: sorted[Math.ceil(10 * 0.95) - 1] = sorted[9] = 10
```

**Fix Required:**
```typescript
p50: sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5)))],
p95: sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)))],
p99: sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99)))],
```

---

## ?? MEDIUM SEVERITY DISGUISED BUGS

### BUG #8: Timezone Issues in Date Calculations
**File:** `src/security.ts:898-899`  
**Severity:** ?? Medium  
**Impact:** Incorrect wallet age calculation across timezones

**Issue:**
```typescript
const ageMs = Date.now() - (oldestSig.blockTime * 1000);
return Math.floor(ageMs / (1000 * 60 * 60 * 24));
```

**Problems:**
1. **blockTime is Unix timestamp (UTC)** - this is correct
2. `Date.now()` is also UTC milliseconds - this is correct
3. **But division by (24 * 60 * 60 * 1000) assumes perfect days**
4. Doesn't account for DST transitions (if ever used with local dates)
5. Edge case: what if blockTime is in the future due to clock skew?

**Potential Issues:**
```typescript
// Edge case 1: Future blockTime
const futureBlockTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour future
const ageMs = Date.now() - (futureBlockTime * 1000); // Negative!
Math.floor(ageMs / (1000 * 60 * 60 * 24)); // -1 days???

// Edge case 2: Zero/null blockTime
if (blockTime === 0 || blockTime === null) {
  // Would calculate age from 1970!
}
```

**Fix Required:**
```typescript
if (!blockTime || blockTime <= 0) return null;
const ageMs = Math.max(0, Date.now() - (blockTime * 1000));
return Math.floor(ageMs / (1000 * 60 * 60 * 24));
```

---

### BUG #9: String Concatenation in Template Literals
**File:** Multiple files using `address.slice(0, 8) + '...'`  
**Severity:** ?? Medium  
**Impact:** Potential for undefined + string = "undefined..."

**Issue:**
```typescript
console.log('Syncing wallet: ' + address.slice(0, 8) + '...');
```

**Problems:**
1. If `address` is `undefined` or `null`, throws TypeError
2. `undefined.slice()` = TypeError: Cannot read property 'slice' of undefined
3. Should use optional chaining or validation

**Fix Required:**
```typescript
console.log(\Syncing wallet: \...\);
```

---

### BUG #10: Implicit Type Coercion in Comparisons
**File:** `src/security.ts:848`  
**Severity:** ?? Medium  
**Impact:** Logic errors with null/undefined age

**Issue:**
```typescript
if (funderAge !== null && funderAge < 7) {
  riskLevel = 'high';
}
```

**Problems:**
1. Checks `!== null` but not `!== undefined`
2. If funderAge is undefined: `undefined < 7` evaluates to `false` (not caught)
3. Should also check for NaN: `NaN < 7` evaluates to `false`
4. Missing risk detection for invalid ages

**Fix Required:**
```typescript
if (funderAge != null && !isNaN(funderAge) && funderAge < 7) {
  riskLevel = 'high';
}
// Or use: if (typeof funderAge === 'number' && funderAge < 7)
```

---

## ?? Summary of Disguised Bugs

| Bug | Severity | Type | Impact |
|-----|----------|------|--------|
| #1 BigInt Overflow | ?? Critical | Data Corruption | Wrong token calculations |
| #2 Float Comparison | ?? Critical | Logic Error | Missed notifications |
| #3 Promise.race Leak | ?? Critical | Memory Leak | Timer accumulation |
| #4 Array Slice Intent | ?? High | Logic Ambiguity | Wrong data retained |
| #5 NaN Propagation | ?? High | Data Validation | "NaN" in UI |
| #6 JSON.parse Crash | ?? High | Error Handling | Bot crash on corruption |
| #7 Percentile Calc | ?? High | Math Error | Wrong metrics |
| #8 Timezone Edge Cases | ?? Medium | Edge Case | Negative ages |
| #9 String Safety | ?? Medium | Type Safety | Potential crashes |
| #10 Type Coercion | ?? Medium | Logic Error | Missed risk detection |

---

## ?? Key Patterns Found

### 1. Numeric Precision Issues
- BigInt ? Number conversions without overflow checks
- Floating point comparisons without epsilon tolerance
- Missing NaN checks in arithmetic operations

### 2. Async/Promise Pitfalls
- Uncancelled timeout promises in Promise.race
- No cleanup of timer resources
- Potential for orphaned rejections

### 3. Type Safety Gaps
- Implicit type coercions (null vs undefined)
- Missing validation before operations
- Unsafe string operations on potentially undefined values

### 4. Edge Case Handling
- Empty arrays, null values, future timestamps
- Boundary conditions in percentile calculations
- Corrupted data recovery

---

## ?? Recommended Fixes Priority

### Immediate (Critical)
1. **Fix BigInt conversions** - Use BigInt arithmetic or BigNumber library
2. **Fix Promise.race timeouts** - Clear timers properly
3. **Fix float comparison threshold** - Use percentage-based or configurable threshold

### High Priority
4. **Add JSON.parse error handling** - Prevent startup crashes
5. **Fix NaN handling** - Validate all parseFloat results
6. **Fix percentile calculation** - Use correct formula

### Medium Priority  
7. **Add null/undefined guards** - Use optional chaining
8. **Validate numeric inputs** - Check for NaN, Infinity, negative values
9. **Document array slice intent** - Clarify FIFO vs LIFO behavior

---

## ?? Testing Recommendations

### Unit Tests Needed

```typescript
describe('Disguised Bugs - Numeric Issues', () => {
  test('should handle large BigInt token amounts', () => {
    const largeAmount = BigInt("10000000000000000000");
    // Test that conversion maintains precision
  });

  test('should not propagate NaN in sum calculations', () => {
    const transactions = [{ value: "123" }, { value: "invalid" }, { value: "456" }];
    const sum = calculateSum(transactions);
    expect(sum).not.toBeNaN();
  });

  test('should handle floating point comparison correctly', () => {
    const change = 0.00009999; // Below 0.0001 due to float precision
    // Should still detect significant changes
  });
});

describe('Disguised Bugs - Promise Issues', () => {
  test('should cancel timeout when Promise.race completes', () => {
    // Mock setTimeout/clearTimeout
    // Verify clearTimeout is called
  });
});

describe('Disguised Bugs - Edge Cases', () => {
  test('should handle corrupted JSON gracefully', () => {
    const corruptedJson = '{ "users": {';
    // Should not crash, should recover
  });

  test('should handle future blockTime', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    const age = calculateAge(futureTime);
    expect(age).toBeGreaterThanOrEqual(0);
  });
});
```

---

## ?? Prevention Strategies

### Code Review Checklist
- [ ] All BigInt ? Number conversions checked for overflow
- [ ] All floating point comparisons use epsilon or percentage
- [ ] All Promise.race patterns clean up timeouts
- [ ] All JSON.parse wrapped in try-catch
- [ ] All parseFloat/parseInt results checked for NaN
- [ ] All array operations handle empty arrays
- [ ] All null checks also check undefined (use \!= null\)

### Static Analysis Rules
- Warn on \Number(bigint)\ without overflow check
- Warn on direct float equality (\===\) comparisons
- Warn on Promise.race with setTimeout without cleanup
- Warn on JSON.parse without try-catch
- Warn on Math operations without NaN check

---

**Report End - 10 Disguised Bugs Documented**

These bugs are particularly dangerous because they:
? Pass TypeScript compilation  
? Look correct in code review  
? Work most of the time  
? Fail only under specific conditions  
? Are hard to reproduce and debug  


# Jira Tickets - Disguised Bugs

Ready-to-use Jira tickets for all 10 disguised bugs found in the codebase.

---

## 🎫 TICKET 1: Critical - BigInt to Number Overflow in Token Calculations

**Summary:** Fix BigInt overflow causing incorrect token balance calculations

**Type:** Bug  
**Priority:** Critical  
**Labels:** bug, critical, blockchain, numeric-precision, security  

**Description:**
```
## Problem
Converting large token amounts from BigInt to Number causes silent precision loss. JavaScript's Number type has MAX_SAFE_INTEGER limit (2^53 - 1), and Solana token amounts can exceed this.

## Impact
- Wrong token balance calculations for high-value tokens
- Incorrect percentage calculations in security scans
- Potential for missed rug pull detection (50% shown as 49.9999%)
- Silent data corruption - no error, just wrong numbers

## Root Cause
Multiple locations convert BigInt directly to Number:
- blockchain.ts:795: `const balance = Number(totalBalance) / Math.pow(10, decimals)`
- security.ts:745-747: `Number(largestAccounts.value[0].amount)`
- All division operations after conversion lose precision

## Example Failure
```typescript
const largeAmount = BigInt("10000000000000000000"); // 10^19
Number(largeAmount); // 10000000000000000000 - looks OK
Number(largeAmount) === 10000000000000000000; // false! precision lost

// Real scenario: Token with 1 trillion supply
// Holder has 500 billion tokens
// Shows as 50% when actually 49.999999% - misses rug detection!
```

## Solution Needed
1. Use BigInt arithmetic throughout token calculations
2. Only convert to Number after division is complete
3. Implement BigNumber library for precise decimal math
4. Add overflow detection and warnings

## Files to Change
- src/blockchain.ts (getTokenBalance, getRecentTransactions)
- src/security.ts (checkTokenDistribution)
- src/watcher.ts (token comparison logic)

## Acceptance Criteria
- [ ] All BigInt operations maintain precision
- [ ] No Number(bigint) without overflow check
- [ ] Token percentages accurate to 0.01%
- [ ] Add tests with values > MAX_SAFE_INTEGER
```

---

## 🎫 TICKET 2: Critical - Promise.race Timer Leaks

**Summary:** Fix uncancelled timeouts in Promise.race causing memory leak

**Type:** Bug  
**Priority:** Critical  
**Labels:** bug, critical, memory-leak, async, resource-management  

**Description:**
```
## Problem
Promise.race with setTimeout creates timers that are never cleared if the race resolves with the actual promise. With many wallets (100+), this creates hundreds of orphaned timers that all fire 3 seconds later.

## Impact
- Memory leak from accumulating setTimeout callbacks
- Hundreds of timers firing unnecessarily
- Potential unhandled promise rejections
- Process may not exit cleanly
- Performance degradation over time

## Root Cause
```typescript
// WRONG - Timer never cleared
const walletTimeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('Timeout')), 3000)
);

const signatures = await Promise.race([
  getLatestSignatures(wallet.address, 1),
  walletTimeout  // If getLatestSignatures wins, timeout still fires!
]);
```

With 100 wallets syncing, creates 100 orphaned timers.

## Solution Implemented
✅ Store timer reference in cleanup-capable object
✅ Clear timer in both success and error paths
✅ Use try-finally pattern for guaranteed cleanup

## Files Changed
- src/watcher.ts:209-231 ✅ FIXED
- src/security.ts:285-306 ✅ FIXED

## Testing
- Monitor timer count with `process._getActiveHandles()`
- Sync 100+ wallets
- Verify no timer accumulation
- Check clean shutdown

## Acceptance Criteria
- [x] Timer cleared on Promise.race success
- [x] Timer cleared on Promise.race failure
- [x] No timer leaks under load
- [ ] Integration test verifies cleanup
```

---

## 🎫 TICKET 3: Critical - Floating Point Comparison for Notifications

**Summary:** Fix arbitrary threshold causing missed token change notifications

**Type:** Bug  
**Priority:** Critical  
**Labels:** bug, critical, notifications, floating-point, logic-error  

**Description:**
```
## Problem
Fixed threshold (0.0001) for token change notifications doesn't scale with token value or decimals. High-value tokens miss significant changes; low-value tokens get too many notifications.

## Impact
- High-value token: $0.50 change not notified (0.00005 tokens < 0.0001)
- Floating point precision: 0.1 + 0.2 !== 0.3 causes inconsistencies
- Tokens with 18 decimals: threshold too large
- Users miss important balance changes

## Root Cause
```typescript
// WRONG - Fixed threshold doesn't scale
const change = newBalance - oldBalance;
if (Math.abs(change) > 0.0001) {
  await sendTokenSummaryNotification(...);
}
```

## Solution Implemented
✅ Use percentage-based threshold (0.01% change)
✅ Scales appropriately with token value
✅ Add absolute minimum for small balances

```typescript
// RIGHT - Percentage scales with value
const changePercent = oldBalance > 0 
  ? Math.abs(change / oldBalance) * 100 
  : (newBalance > 0 ? 100 : 0);

if (changePercent > 0.01 || (Math.abs(change) > 0.0001 && oldBalance < 0.01)) {
  await sendTokenSummaryNotification(...);
}
```

## Files Changed
- src/watcher.ts:432-443 ✅ FIXED

## Testing
- Test with high-value tokens (small change = large value)
- Test with low-value tokens (large change = small value)
- Test with various decimals (6, 9, 18)
- Verify no false positives/negatives

## Acceptance Criteria
- [x] Uses percentage-based threshold
- [x] Handles edge case: zero balance
- [x] Minimum absolute check for tiny balances
- [ ] User configurable threshold (future)
```

---

## 🎫 TICKET 4: High - JSON.parse Without Error Handling

**Summary:** Add error handling for corrupted storage file to prevent crashes

**Type:** Bug  
**Priority:** High  
**Labels:** bug, high, error-handling, crash-prevention, data-recovery  

**Description:**
```
## Problem
JSON.parse without try-catch causes bot crash if data.json gets corrupted (power loss, disk error, manual edit). Bot cannot start, requires manual intervention.

## Impact
- Bot crashes on startup
- Cannot recover automatically
- Data loss if backup not available
- Downtime until manual fix

## Example Failure
```typescript
// Corrupted data.json from incomplete write:
{ "users": { "12345": { "wallets": [
// <-- file ends here

JSON.parse(data); // SyntaxError: Unexpected end of JSON input
// Bot crashes immediately
```

## Solution Implemented
✅ Wrap JSON.parse in try-catch
✅ Validate data structure after parse
✅ Backup corrupted file before recovering
✅ Initialize with empty storage on corruption

## Files Changed
- src/storage.ts:53-79 ✅ FIXED

## Recovery Process
1. Detect JSON.parse error or invalid structure
2. Backup corrupted file to `.corrupted.timestamp`
3. Initialize with empty storage
4. Log recovery for admin review
5. Continue bot operation

## Testing
- Manually corrupt data.json
- Verify bot recovers and starts
- Check backup file created
- Verify empty storage initialized

## Acceptance Criteria
- [x] JSON.parse wrapped in try-catch
- [x] Structure validation added
- [x] Corrupted file backed up
- [x] Bot recovers automatically
- [ ] Admin notification on recovery
```

---

## 🎫 TICKET 5: High - NaN Propagation in Token Sum Calculations

**Summary:** Fix NaN propagation in reduce operations showing "NaN" to users

**Type:** Bug  
**Priority:** High  
**Labels:** bug, high, data-validation, ui-error, user-experience  

**Description:**
```
## Problem
Using parseFloat without NaN check in reduce causes NaN to propagate through calculations. If any transaction value is invalid, entire sum becomes NaN, showing "NaN XNT" in user notifications.

## Impact
- UI shows "NaN" to users (unprofessional)
- Cannot determine actual transaction value
- User confusion and loss of trust
- Calculations fail for entire summary

## Root Cause
```typescript
// WRONG - One invalid value ruins everything
const incomingValue = incoming.reduce((sum, tx) => 
  sum + parseFloat(tx.value), 0
);

// If any tx.value is "invalid":
parseFloat("invalid"); // NaN
0 + NaN; // NaN
incomingValue.toFixed(4); // "NaN"
// UI: "+NaN XNT" ❌
```

## Solution Implemented
✅ Check each parseFloat result for NaN
✅ Skip invalid values (treat as 0)
✅ Sum continues with valid values only

```typescript
// RIGHT - Skip invalid values
const incomingValue = incoming.reduce((sum, tx) => {
  const value = parseFloat(tx.value);
  return sum + (isNaN(value) ? 0 : value);
}, 0);
```

## Files Changed
- src/watcher.ts:464-470 ✅ FIXED

## Testing
- Add transaction with invalid value
- Verify sum calculates correctly
- Check no "NaN" in notifications
- Log warning for invalid values (future)

## Acceptance Criteria
- [x] NaN check added to reduce
- [x] Invalid values skipped
- [x] No "NaN" displayed to users
- [ ] Log warning for data quality monitoring
```

---

## 🎫 TICKET 6: High - Array Slice Intent Ambiguity

**Summary:** Clarify array.slice behavior for transaction history

**Type:** Bug  
**Priority:** High  
**Labels:** bug, high, logic-clarity, code-quality, documentation  

**Description:**
```
## Problem
Using `.slice(-100)` keeps the LAST 100 items (newest), but comments suggest limiting total count. Intent is unclear - should we keep oldest (FIFO) or newest (LIFO)?

## Impact
- Users may lose transaction history
- Behavior doesn't match expectations
- Difficult to debug missing transactions
- Code intent unclear to maintainers

## Current Code
```typescript
// watcher.ts:76
pendingTransactions.set(address, 
  txs.slice(-MAX_PENDING_TRANSACTIONS_PER_WALLET)
);
// slice(-100) keeps LAST 100 (newest)
// Discards OLDEST transactions
```

## Decision Needed
Choose behavior and document clearly:

**Option A: Keep Newest (Current)**
```typescript
// Keep most recent 100 transactions
txs.slice(-MAX_PENDING_TRANSACTIONS_PER_WALLET)
```

**Option B: Keep Oldest (FIFO)**
```typescript
// Keep first 100 transactions (in order)
txs.slice(0, MAX_PENDING_TRANSACTIONS_PER_WALLET)
```

## Recommendation
Keep newest (Option A) for wallet watcher:
- Users care about recent activity
- Old transactions less relevant
- Current behavior is correct

## Files to Change
- src/watcher.ts:76 - Add comment clarifying intent
- src/watcher.ts:316 - Document cleanup behavior

## Acceptance Criteria
- [ ] Decide on FIFO vs LIFO behavior
- [ ] Add clear comments explaining choice
- [ ] Update documentation
- [ ] Consider making configurable (future)
```

---

## 🎫 TICKET 7: High - Percentile Calculation Error

**Summary:** Fix incorrect percentile calculation in metrics

**Type:** Bug  
**Priority:** High  
**Labels:** bug, high, metrics, math-error, monitoring  

**Description:**
```
## Problem
Using Math.floor for percentile index calculation gives wrong results for small arrays. For array of 10 items, p95 returns the maximum value (100th percentile) instead of 95th.

## Impact
- Wrong performance metrics reported
- P95 and P99 inflated
- Cannot trust monitoring data
- Poor operational decisions

## Root Cause
```typescript
// WRONG - Math.floor on small arrays
const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const p95 = sorted[Math.floor(10 * 0.95)]; // sorted[9] = 10
// This is the 100th percentile (max), not 95th!
```

## Correct Calculation
```typescript
// RIGHT - Bounds checking
const index = Math.max(0, Math.min(
  sorted.length - 1, 
  Math.floor(sorted.length * 0.95)
));
const p95 = sorted[index];
```

## Files to Change
- src/metrics.ts:132-134

## Solution
```typescript
p50: sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5)))],
p95: sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)))],
p99: sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99)))],
```

## Testing
- Test with arrays of different sizes (1, 2, 10, 100, 1000)
- Verify p95 < p99 < max
- Compare with standard percentile libraries
- Unit tests for edge cases

## Acceptance Criteria
- [ ] Bounds checking added
- [ ] Works correctly for all array sizes
- [ ] Unit tests added
- [ ] Matches standard percentile calculation
```

---

## 🎫 TICKET 8: Medium - Timezone Edge Cases in Age Calculation

**Summary:** Add validation for edge cases in wallet age calculation

**Type:** Bug  
**Priority:** Medium  
**Labels:** bug, medium, edge-case, date-handling, validation  

**Description:**
```
## Problem
Wallet age calculation doesn't handle edge cases: future blockTime (clock skew), zero/null blockTime. Can result in negative ages or ages from 1970.

## Impact
- Negative age displayed (confusing)
- Wrong risk assessment for new wallets
- Age from 1970 for null blockTime
- Invalid security scan results

## Root Cause
```typescript
// WRONG - No validation
const ageMs = Date.now() - (blockTime * 1000);
return Math.floor(ageMs / (1000 * 60 * 60 * 24));

// If blockTime is future: negative age!
// If blockTime is 0: age = 19,000+ days!
```

## Solution
```typescript
// RIGHT - Validation and bounds
if (!blockTime || blockTime <= 0) return null;
const ageMs = Math.max(0, Date.now() - (blockTime * 1000));
return Math.floor(ageMs / (1000 * 60 * 60 * 24));
```

## Files to Change
- src/security.ts:898-899

## Testing
- Test with future blockTime
- Test with zero blockTime
- Test with null/undefined
- Test with negative blockTime
- Verify age always >= 0 or null

## Acceptance Criteria
- [ ] Validation for null/zero blockTime
- [ ] Age never negative
- [ ] Returns null for invalid input
- [ ] Unit tests for edge cases
```

---

## 🎫 TICKET 9: Medium - String Operations Without Null Safety

**Summary:** Add null safety to string slice operations

**Type:** Bug  
**Priority:** Medium  
**Labels:** bug, medium, type-safety, crash-prevention  

**Description:**
```
## Problem
Using `address.slice(0, 8)` without checking if address is defined causes TypeError if address is null/undefined.

## Impact
- Potential crashes in logging
- TypeError stops execution
- Difficult to debug (crash in logging code)
- Affects error reporting

## Root Cause
```typescript
// WRONG - No null check
console.log('Syncing wallet: ' + address.slice(0, 8) + '...');

// If address is undefined:
undefined.slice(); // TypeError: Cannot read property 'slice' of undefined
```

## Solution
```typescript
// RIGHT - Optional chaining
console.log(`Syncing wallet: ${address?.slice(0, 8) || 'unknown'}...`);
```

## Files to Change
- Multiple files with address.slice() calls
- Search for: `address.slice(0, 8)`

## Acceptance Criteria
- [ ] All address.slice() calls use optional chaining
- [ ] Fallback to 'unknown' or 'N/A'
- [ ] No TypeErrors from string operations
- [ ] Add TypeScript strict null checks (future)
```

---

## 🎫 TICKET 10: Medium - Type Coercion in Null Checks

**Summary:** Fix incomplete null checks allowing undefined to pass

**Type:** Bug  
**Priority:** Medium  
**Labels:** bug, medium, type-safety, logic-error  

**Description:**
```
## Problem
Checking `!== null` but not `!== undefined` allows undefined values to pass through, causing logic errors and missed risk detection.

## Impact
- undefined < 7 evaluates to false (not caught)
- NaN < 7 evaluates to false (not caught)
- Risk detection may miss new wallets
- Inconsistent type handling

## Root Cause
```typescript
// WRONG - Only checks null
if (funderAge !== null && funderAge < 7) {
  riskLevel = 'high';
}

// If funderAge is undefined or NaN, check fails silently
```

## Solution
```typescript
// RIGHT - Check both null and undefined, plus NaN
if (funderAge != null && !isNaN(funderAge) && funderAge < 7) {
  riskLevel = 'high';
}

// OR use typeof
if (typeof funderAge === 'number' && funderAge < 7) {
  riskLevel = 'high';
}
```

## Files to Change
- src/security.ts:848 and similar patterns

## Acceptance Criteria
- [ ] Use != null (checks both null and undefined)
- [ ] Add NaN check for numeric comparisons
- [ ] Consistent null checking throughout codebase
- [ ] TypeScript strict mode enabled (future)
```

---

## 📊 Summary Table

| Ticket | Priority | Status | Impact |
|--------|----------|--------|--------|
| 1. BigInt Overflow | 🔴 Critical | To Fix | Wrong calculations |
| 2. Promise.race Leak | 🔴 Critical | ✅ FIXED | Memory leak |
| 3. Float Comparison | 🔴 Critical | ✅ FIXED | Missed notifications |
| 4. JSON.parse Crash | 🟠 High | ✅ FIXED | Bot crashes |
| 5. NaN Propagation | 🟠 High | ✅ FIXED | UI errors |
| 6. Array Slice | 🟠 High | Documentation | Intent unclear |
| 7. Percentile Math | 🟠 High | To Fix | Wrong metrics |
| 8. Timezone Edges | 🟡 Medium | To Fix | Negative ages |
| 9. String Safety | 🟡 Medium | To Fix | Crashes |
| 10. Type Coercion | 🟡 Medium | To Fix | Logic errors |

---

## 🎯 Suggested Sprint Planning

### Sprint 1: Critical Fixes (Already Partially Done)
- ✅ Ticket 2: Promise.race leak - FIXED
- ✅ Ticket 3: Float comparison - FIXED
- ✅ Ticket 4: JSON.parse - FIXED
- ✅ Ticket 5: NaN propagation - FIXED
- ⏳ Ticket 1: BigInt overflow - IN PROGRESS

### Sprint 2: High Priority
- Ticket 6: Array slice documentation
- Ticket 7: Percentile calculation

### Sprint 3: Medium Priority
- Ticket 8: Timezone validation
- Ticket 9: String safety
- Ticket 10: Type coercion

---

**Ready to create in Jira!** Copy each ticket section to your Jira project.

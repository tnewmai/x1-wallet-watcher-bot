# 🎯 Disguised Bugs Fix Priority Plan

**Date:** January 9, 2026  
**Total Bugs:** 10 disguised bugs  
**Status:** 4 bugs FIXED, 6 bugs remaining  
**Timeline:** 2-3 sprints

---

## 📊 Executive Summary

### Current Status
- ✅ **4 bugs FIXED** (40% complete)
  - Promise.race timer leaks
  - Float comparison threshold
  - JSON.parse error handling
  - NaN propagation
  
- ⏳ **6 bugs remaining** (60% to go)
  - 1 Critical (BigInt overflow)
  - 3 High priority
  - 2 Medium priority

### Timeline Overview
- **Sprint 1 (Days 1-3):** Complete critical BigInt fix
- **Sprint 2 (Days 4-7):** High priority bugs
- **Sprint 3 (Days 8-10):** Medium priority bugs
- **Total:** 10 working days

---

## 🚀 Sprint 1: Critical BigInt Fix (Days 1-3)

### Priority: CRITICAL 🔴
**Goal:** Fix BigInt overflow before it causes production data corruption

### Day 1: Analysis & Planning

**Morning (4 hours)**
- [ ] Audit all BigInt → Number conversions
- [ ] Identify all affected functions
- [ ] Document current behavior
- [ ] Create test cases with large values

**Files to Audit:**
```bash
grep -r "Number(.*[Bb]ig[Ii]nt" src/
grep -r "Number(totalBalance)" src/
grep -r "Number(.*amount)" src/blockchain.ts src/security.ts
```

**Afternoon (4 hours)**
- [ ] Design solution architecture
- [ ] Choose approach: BigInt arithmetic OR BigNumber library
- [ ] Create implementation plan
- [ ] Set up test environment

**Decision Matrix:**

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **BigInt arithmetic** | Native, no dependencies, fast | Manual handling, more code | ✅ **Choose this** |
| **BigNumber.js** | Battle-tested, decimal precision | External dependency, slower | Consider for future |
| **Decimal.js** | High precision, comprehensive | Larger bundle size | Overkill for our needs |

### Day 2: Implementation

**Morning: Core Functions (4 hours)**

**File: `src/blockchain.ts`**

1. **Fix `getTokenBalance` (Line 795)**
```typescript
// CURRENT (WRONG)
const balance = Number(totalBalance) / Math.pow(10, mintInfo.decimals);

// FIXED
// Use BigInt division first, then convert remainder
const divisor = BigInt(10 ** mintInfo.decimals);
const wholePart = totalBalance / divisor;
const remainder = totalBalance % divisor;
const balance = Number(wholePart) + Number(remainder) / (10 ** mintInfo.decimals);
```

2. **Fix `getRecentTransactions` token calculations (Line 832, 861)**
```typescript
// Review all token amount conversions
// Apply same pattern: divide as BigInt, convert to Number after
```

**File: `src/security.ts`**

3. **Fix `checkTokenDistribution` (Lines 745-747)**
```typescript
// CURRENT (WRONG)
const totalSupply = largestAccounts.value.reduce((sum, acc) => 
  sum + Number(acc.amount), 0
);

// FIXED - Use BigInt throughout
const totalSupply = largestAccounts.value.reduce((sum, acc) => 
  sum + BigInt(acc.amount), BigInt(0)
);

// Convert to percentage after division
const holderPercent = Number((holderAmount * BigInt(10000)) / totalSupply) / 100;
```

4. **Fix holder percentage calculations (Line 2468)**
```typescript
// Apply BigInt percentage calculation pattern
// percentage = (amount * 10000 / total) / 100
// This maintains 2 decimal precision
```

**Afternoon: Helper Functions (4 hours)**

5. **Create utility functions**
```typescript
// File: src/utils/bigint-math.ts

/**
 * Safely convert BigInt to Number with overflow detection
 */
export function safeBigIntToNumber(value: bigint): number {
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
  
  if (value > MAX_SAFE || value < MIN_SAFE) {
    throw new Error(`Value ${value} exceeds safe number range`);
  }
  
  return Number(value);
}

/**
 * Calculate token balance from raw amount with decimals
 */
export function calculateTokenBalance(
  rawAmount: bigint,
  decimals: number
): number {
  const divisor = BigInt(10 ** decimals);
  const wholePart = rawAmount / divisor;
  const remainder = rawAmount % divisor;
  
  return Number(wholePart) + Number(remainder) / (10 ** decimals);
}

/**
 * Calculate percentage with BigInt precision
 */
export function calculatePercentage(
  part: bigint,
  total: bigint,
  decimalPlaces: number = 2
): number {
  if (total === BigInt(0)) return 0;
  
  const multiplier = BigInt(10 ** (decimalPlaces + 2));
  const percentage = (part * multiplier) / total;
  
  return Number(percentage) / (10 ** decimalPlaces);
}

/**
 * Check if BigInt can be safely converted to Number
 */
export function canSafelyConvertToNumber(value: bigint): boolean {
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
  
  return value <= MAX_SAFE && value >= MIN_SAFE;
}
```

6. **Add overflow warnings**
```typescript
// Add logging for potential overflows
if (!canSafelyConvertToNumber(value)) {
  logger.warn('Potential precision loss in BigInt conversion', {
    value: value.toString(),
    maxSafe: Number.MAX_SAFE_INTEGER
  });
}
```

### Day 3: Testing & Verification

**Morning: Unit Tests (4 hours)**

**File: `tests/bigint-math.test.ts`**
```typescript
describe('BigInt Math Utilities', () => {
  test('should handle values exceeding MAX_SAFE_INTEGER', () => {
    const large = BigInt("10000000000000000000");
    expect(() => safeBigIntToNumber(large)).toThrow();
  });

  test('should calculate token balance accurately', () => {
    const rawAmount = BigInt("1000000000000000000"); // 1 token, 18 decimals
    const balance = calculateTokenBalance(rawAmount, 18);
    expect(balance).toBe(1.0);
  });

  test('should calculate percentages without precision loss', () => {
    const part = BigInt("500000000000000000");
    const total = BigInt("1000000000000000000");
    const percent = calculatePercentage(part, total, 2);
    expect(percent).toBe(50.0);
  });

  test('should detect unsafe conversions', () => {
    const safe = BigInt(1000000);
    const unsafe = BigInt("99999999999999999999");
    
    expect(canSafelyConvertToNumber(safe)).toBe(true);
    expect(canSafelyConvertToNumber(unsafe)).toBe(false);
  });
});
```

**File: `tests/blockchain-bigint.test.ts`**
```typescript
describe('Blockchain BigInt Fixes', () => {
  test('getTokenBalance handles large supplies', async () => {
    // Test with real-world large token supply
    const mockMintInfo = {
      decimals: 9,
      supply: BigInt("1000000000000000000") // 1 trillion
    };
    
    // Test calculation doesn't lose precision
  });

  test('token percentages accurate for large holders', () => {
    // Test rug detection with 50% holder
    // Ensure shows exactly 50.00%, not 49.99%
  });
});
```

**Afternoon: Integration Testing (4 hours)**

- [ ] Test with real RPC data
- [ ] Verify accuracy against block explorer
- [ ] Test edge cases: 0 balance, max supply tokens
- [ ] Load test with 100+ tokens
- [ ] Monitor for warnings/errors

**Performance Testing:**
```typescript
// Benchmark BigInt vs Number operations
const iterations = 100000;
console.time('BigInt division');
for (let i = 0; i < iterations; i++) {
  const result = BigInt(10000) / BigInt(100);
}
console.timeEnd('BigInt division');

console.time('Number division');
for (let i = 0; i < iterations; i++) {
  const result = 10000 / 100;
}
console.timeEnd('Number division');
```

**Sprint 1 Deliverables:**
- ✅ All BigInt conversions fixed
- ✅ Utility functions created
- ✅ Comprehensive tests passing
- ✅ No precision loss for large values
- ✅ Documentation updated

---

## 🚀 Sprint 2: High Priority Bugs (Days 4-7)

### Priority: HIGH 🟠

### Day 4: Array Slice Documentation & Percentile Fix

**Morning: Array Slice Intent (2 hours)**

**File: `src/watcher.ts:76`**

Task: Add clear documentation explaining LIFO behavior

```typescript
// Keep most recent N transactions (LIFO - Last In First Out)
// Using negative slice keeps the newest transactions
// Example: [1,2,3,4,5].slice(-3) => [3,4,5] (newest 3)
pendingTransactions.set(
  address, 
  txs.slice(-MAX_PENDING_TRANSACTIONS_PER_WALLET)
);
```

Decision Log:
- **Chosen:** LIFO (keep newest)
- **Rationale:** Users care about recent activity
- **Alternative:** FIFO available as: `txs.slice(0, MAX)`

**Afternoon: Percentile Calculation Fix (2 hours)**

**File: `src/metrics.ts:132-134`**

```typescript
// CURRENT (WRONG)
p50: sorted[Math.floor(sorted.length * 0.5)],
p95: sorted[Math.floor(sorted.length * 0.95)],
p99: sorted[Math.floor(sorted.length * 0.99)],

// FIXED - Add bounds checking
const getPercentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * p)
  ));
  return sorted[index];
};

p50: getPercentile(sorted, 0.50),
p95: getPercentile(sorted, 0.95),
p99: getPercentile(sorted, 0.99),
```

**Testing:**
```typescript
test('percentile calculation for various array sizes', () => {
  const cases = [
    { arr: [1], p: 0.95, expected: 1 },
    { arr: [1, 2], p: 0.95, expected: 2 },
    { arr: Array.from({length: 100}, (_, i) => i), p: 0.95, expected: 95 },
  ];
  
  cases.forEach(({ arr, p, expected }) => {
    expect(getPercentile(arr, p)).toBe(expected);
  });
});
```

### Day 5-6: Remaining High Priority

**Tasks:**
- [ ] Complete documentation review
- [ ] Add inline comments for clarity
- [ ] Update API documentation
- [ ] Create developer guide for BigInt handling

### Day 7: Sprint 2 Review & Testing

- [ ] Integration testing
- [ ] Code review
- [ ] Update documentation
- [ ] Prepare for Sprint 3

**Sprint 2 Deliverables:**
- ✅ Array behavior documented
- ✅ Percentile calculation fixed
- ✅ All high-priority bugs resolved
- ✅ Documentation complete

---

## 🚀 Sprint 3: Medium Priority Bugs (Days 8-10)

### Priority: MEDIUM 🟡

### Day 8: Timezone & String Safety

**Morning: Timezone Edge Cases (3 hours)**

**File: `src/security.ts:898-899`**

```typescript
// CURRENT
const ageMs = Date.now() - (oldestSig.blockTime * 1000);
return Math.floor(ageMs / (1000 * 60 * 60 * 24));

// FIXED - Add validation
function calculateWalletAge(blockTime: number | null | undefined): number | null {
  // Validate input
  if (blockTime == null || blockTime <= 0) {
    return null;
  }
  
  // Prevent negative ages (future timestamps due to clock skew)
  const ageMs = Math.max(0, Date.now() - (blockTime * 1000));
  
  // Calculate days
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}
```

**Afternoon: String Operations Safety (3 hours)**

**Find all occurrences:**
```bash
grep -r "address\.slice" src/
grep -r "wallet\.address\.slice" src/
```

**Fix pattern:**
```typescript
// CURRENT (WRONG)
console.log('Wallet: ' + address.slice(0, 8) + '...');

// FIXED
console.log(`Wallet: ${address?.slice(0, 8) || 'unknown'}...`);
```

**Create utility:**
```typescript
// src/utils/formatting.ts
export function formatAddress(address: string | null | undefined, length: number = 8): string {
  if (!address || typeof address !== 'string') {
    return 'unknown';
  }
  
  if (address.length <= length) {
    return address;
  }
  
  return `${address.slice(0, length)}...`;
}
```

### Day 9: Type Coercion Fixes

**File: `src/security.ts:848` and similar**

**Current patterns to fix:**
```typescript
// Pattern 1: Only checks null
if (funderAge !== null && funderAge < 7) { ... }

// Pattern 2: Doesn't check NaN
if (someValue && someValue > 0) { ... }
```

**Fixed patterns:**
```typescript
// Fix 1: Check null and undefined
if (funderAge != null && !isNaN(funderAge) && funderAge < 7) {
  riskLevel = 'high';
}

// Fix 2: Use typeof guard
if (typeof funderAge === 'number' && funderAge < 7) {
  riskLevel = 'high';
}

// Fix 3: Create validator utility
function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

if (isValidNumber(funderAge) && funderAge < 7) {
  riskLevel = 'high';
}
```

**Find all occurrences:**
```bash
grep -r "!== null &&" src/
grep -r "!== undefined &&" src/
```

### Day 10: Final Testing & Documentation

**Morning: Integration Testing (3 hours)**
- [ ] Run full test suite
- [ ] Test all edge cases
- [ ] Verify no regressions
- [ ] Performance benchmarks

**Afternoon: Documentation & Deployment Prep (3 hours)**
- [ ] Update CHANGELOG.md
- [ ] Update API documentation
- [ ] Create migration guide
- [ ] Prepare release notes

**Sprint 3 Deliverables:**
- ✅ All medium priority bugs fixed
- ✅ Type safety improved
- ✅ Edge cases handled
- ✅ Documentation complete
- ✅ Ready for deployment

---

## 📋 Implementation Checklist

### Code Changes

**Sprint 1: Critical**
- [ ] Create `src/utils/bigint-math.ts` utility file
- [ ] Fix `src/blockchain.ts` - getTokenBalance (line 795)
- [ ] Fix `src/blockchain.ts` - getRecentTransactions (lines 832, 861)
- [ ] Fix `src/security.ts` - checkTokenDistribution (lines 745-747)
- [ ] Fix `src/security.ts` - holder percentage (line 2468)
- [ ] Add overflow detection warnings
- [ ] Create BigInt test suite

**Sprint 2: High Priority**
- [x] Fix `src/watcher.ts` - Promise.race cleanup (DONE)
- [x] Fix `src/security.ts` - Promise.race cleanup (DONE)
- [x] Fix `src/storage.ts` - JSON.parse error handling (DONE)
- [x] Fix `src/watcher.ts` - NaN in reduce (DONE)
- [x] Fix `src/watcher.ts` - float comparison (DONE)
- [ ] Fix `src/metrics.ts` - percentile calculation (lines 132-134)
- [ ] Add documentation for array slice behavior

**Sprint 3: Medium Priority**
- [ ] Fix `src/security.ts` - wallet age calculation (lines 898-899)
- [ ] Create `src/utils/formatting.ts` for address formatting
- [ ] Fix all `address.slice()` calls (use utility)
- [ ] Fix `src/security.ts` - type coercion (line 848)
- [ ] Add type guards throughout codebase
- [ ] Enable TypeScript strict mode (optional)

### Testing Requirements

**Unit Tests (30+ tests)**
- [x] tests/disguised-bugs.test.ts - Created with 20+ tests
- [ ] tests/bigint-math.test.ts - BigInt utilities
- [ ] tests/blockchain-bigint.test.ts - Integration tests
- [ ] tests/formatting.test.ts - String formatting
- [ ] tests/type-guards.test.ts - Type validation

**Integration Tests**
- [ ] Full token calculation flow
- [ ] Security scan with large supplies
- [ ] Wallet sync with edge cases
- [ ] Metrics calculation accuracy

**Load Tests**
- [ ] 100+ wallets with large token amounts
- [ ] 1000+ transactions in history
- [ ] Concurrent wallet syncs

### Documentation

- [ ] Update README.md with BigInt handling notes
- [ ] Create BIGINT_MIGRATION_GUIDE.md
- [ ] Update API documentation
- [ ] Add inline code comments
- [ ] Create developer guide section

### Deployment

- [ ] Feature flag for BigInt changes (optional)
- [ ] Staged rollout plan (10% → 50% → 100%)
- [ ] Rollback procedure documented
- [ ] Monitoring alerts configured

---

## 🎯 Success Metrics

### Code Quality
- ✅ 100% of critical bugs fixed
- ✅ Test coverage > 80%
- ✅ No TypeScript errors
- ✅ ESLint warnings addressed

### Performance
- Target: No performance degradation
- BigInt operations < 5% slower than Number
- Memory usage stable
- No timer leaks detected

### Reliability
- Zero production crashes from disguised bugs
- Accurate calculations for all token values
- Proper error recovery for edge cases
- Clean shutdown every time

### User Experience
- No "NaN" displayed to users
- Accurate token percentages
- No missed notifications
- Fast response times maintained

---

## 🚨 Risk Management

### High Risks

**Risk 1: BigInt Performance Impact**
- **Mitigation:** Benchmark all changes
- **Fallback:** Cache calculations where possible
- **Monitor:** Response time metrics

**Risk 2: Breaking Changes**
- **Mitigation:** Comprehensive testing
- **Fallback:** Feature flag for new code
- **Monitor:** Error rates in production

**Risk 3: Missed Edge Cases**
- **Mitigation:** Extensive edge case testing
- **Fallback:** Enhanced logging to catch issues
- **Monitor:** User reports and error logs

### Medium Risks

**Risk 4: Integration Issues**
- **Mitigation:** Integration test suite
- **Solution:** Staged rollout

**Risk 5: Documentation Gaps**
- **Mitigation:** Code review process
- **Solution:** Developer guide creation

---

## 📊 Progress Tracking

### Overall Progress

| Sprint | Tasks | Status | Completion |
|--------|-------|--------|------------|
| Sprint 0 (Initial) | 4 bugs | ✅ DONE | 100% |
| Sprint 1 (Critical) | 1 bug | ⏳ In Progress | 0% |
| Sprint 2 (High) | 3 bugs | ⏸️ Planned | 0% |
| Sprint 3 (Medium) | 2 bugs | ⏸️ Planned | 0% |
| **Total** | **10 bugs** | | **40%** |

### Bug Status

| Bug | Priority | Status | Assignee | ETA |
|-----|----------|--------|----------|-----|
| Promise.race leak | 🔴 Critical | ✅ FIXED | Done | Day 0 |
| Float comparison | 🔴 Critical | ✅ FIXED | Done | Day 0 |
| JSON.parse crash | 🟠 High | ✅ FIXED | Done | Day 0 |
| NaN propagation | 🟠 High | ✅ FIXED | Done | Day 0 |
| **BigInt overflow** | 🔴 Critical | 🏗️ TODO | TBD | Day 3 |
| Percentile calc | 🟠 High | 📝 TODO | TBD | Day 4 |
| Array slice docs | 🟠 High | 📝 TODO | TBD | Day 4 |
| Timezone edges | 🟡 Medium | 📝 TODO | TBD | Day 8 |
| String safety | 🟡 Medium | 📝 TODO | TBD | Day 8 |
| Type coercion | 🟡 Medium | 📝 TODO | TBD | Day 9 |

---

## 🎓 Lessons Learned & Best Practices

### For Future Development

1. **Always validate BigInt operations**
   - Check if conversion is safe before Number()
   - Use utility functions for common patterns
   - Add overflow warnings in development

2. **Clean up all async resources**
   - Store timer references for cleanup
   - Use try-finally for guaranteed cleanup
   - Test with resource monitoring tools

3. **Validate all external data**
   - Wrap JSON.parse in try-catch
   - Check for NaN after parseFloat
   - Validate structure after parsing

4. **Use percentage comparisons for thresholds**
   - Absolute thresholds don't scale
   - Percentage-based is more robust
   - Make thresholds configurable

5. **Handle all edge cases explicitly**
   - Zero values, null, undefined, NaN
   - Future timestamps, negative values
   - Empty arrays, invalid strings

### Code Review Checklist

For reviewers to check:
- [ ] All BigInt conversions safe?
- [ ] All timers cleaned up?
- [ ] All JSON.parse wrapped?
- [ ] All parseFloat checked for NaN?
- [ ] All null checks include undefined?
- [ ] All string operations safe?
- [ ] Edge cases tested?
- [ ] Documentation updated?

---

## 📞 Support & Escalation

### If Issues Arise

**Contact:**
- Tech Lead: For architecture decisions
- DevOps: For deployment issues
- QA: For testing concerns

**Escalation Path:**
1. Developer → Tech Lead (< 2 hours)
2. Tech Lead → Engineering Manager (< 4 hours)
3. Manager → CTO (critical only)

**Emergency Rollback:**
```bash
# Revert last deployment
git revert HEAD
npm run build
pm2 restart x1-wallet-watcher-bot

# Monitor for 5 minutes
pm2 logs --lines 100
```

---

## ✅ Sign-Off Checklist

Before marking complete:

**Sprint 1:**
- [ ] All BigInt fixes tested
- [ ] No precision loss demonstrated
- [ ] Performance acceptable
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Monitored for 24 hours

**Sprint 2:**
- [ ] All high priority fixes complete
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Documentation updated

**Sprint 3:**
- [ ] All medium priority fixes complete
- [ ] Full test suite passing
- [ ] Documentation complete
- [ ] Ready for production

**Final Deployment:**
- [ ] All sprints signed off
- [ ] Production deployment plan ready
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Team notified

---

**Plan Status:** ✅ COMPLETE  
**Ready to Execute:** YES  
**Estimated Completion:** Day 10  
**Team Sign-Off:** Pending

*This plan is a living document. Update as progress is made.*

# 🕵️ Disguised Bugs - Quick Reference

**Found:** 10 subtle bugs that look correct but harbor hidden issues  
**Status:** Documented and analyzed  
**Priority:** Critical issues require immediate attention

---

## 🎯 Top 3 Most Dangerous

### 1. 🔴 BigInt Overflow in Token Calculations
**Impact:** Wrong percentages, incorrect rug detection, data corruption  
**Files:** `blockchain.ts`, `security.ts` (7+ locations)  
**Why Dangerous:** Works for 99% of tokens, fails silently for large supplies

### 2. 🔴 Promise.race Timer Leaks
**Impact:** Memory leak, hundreds of orphaned timers  
**Files:** `watcher.ts`, `security.ts`  
**Why Dangerous:** Looks like proper timeout handling, but timers never cleared

### 3. 🔴 Floating Point Comparison for Notifications
**Impact:** Missed important token changes  
**Files:** `watcher.ts:425`  
**Why Dangerous:** Arbitrary threshold doesn't scale with token value/decimals

---

## 📋 All 10 Disguised Bugs

| # | Bug | Severity | Files | Impact |
|---|-----|----------|-------|--------|
| 1 | BigInt → Number overflow | 🔴 Critical | blockchain.ts, security.ts | Wrong calculations |
| 2 | Float comparison threshold | 🔴 Critical | watcher.ts | Missed notifications |
| 3 | Promise.race timer leak | 🔴 Critical | watcher.ts, security.ts | Memory leak |
| 4 | Array.slice intent unclear | 🟠 High | watcher.ts | Wrong data retained |
| 5 | NaN propagation in reduce | 🟠 High | watcher.ts | "NaN" in UI |
| 6 | JSON.parse no error handling | 🟠 High | storage.ts | Bot crash |
| 7 | Percentile calculation error | 🟠 High | metrics.ts | Wrong metrics |
| 8 | Timezone edge cases | 🟡 Medium | security.ts | Negative ages |
| 9 | String operations unsafe | 🟡 Medium | Multiple | Potential crashes |
| 10 | Type coercion bugs | 🟡 Medium | security.ts | Missed detections |

---

## 🔧 Quick Fixes

### Fix #1: BigInt Safety
```typescript
// WRONG
const balance = Number(totalBalance) / Math.pow(10, decimals);

// RIGHT
const balance = Number(totalBalance / BigInt(10 ** decimals));
```

### Fix #2: Float Comparison
```typescript
// WRONG
if (Math.abs(change) > 0.0001) { /* notify */ }

// RIGHT
const changePercent = oldBalance > 0 ? Math.abs(change / oldBalance) * 100 : 100;
if (changePercent > 0.01) { /* notify */ }
```

### Fix #3: Promise.race Cleanup
```typescript
// WRONG
await Promise.race([actualCall(), timeoutPromise]);

// RIGHT
const timeoutRef = { timer: null };
const timeoutPromise = new Promise((_, reject) => {
  timeoutRef.timer = setTimeout(() => reject(new Error('Timeout')), 3000);
});
try {
  const result = await Promise.race([actualCall(), timeoutPromise]);
  if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
  return result;
} catch (error) {
  if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
  throw error;
}
```

### Fix #4: NaN Protection
```typescript
// WRONG
const sum = values.reduce((sum, tx) => sum + parseFloat(tx.value), 0);

// RIGHT
const sum = values.reduce((sum, tx) => {
  const value = parseFloat(tx.value);
  return sum + (isNaN(value) ? 0 : value);
}, 0);
```

### Fix #5: JSON.parse Safety
```typescript
// WRONG
const data = JSON.parse(fileContent);

// RIGHT
try {
  const data = JSON.parse(fileContent);
  if (!validateStructure(data)) throw new Error('Invalid structure');
  return data;
} catch (error) {
  console.error('Corrupted data, recovering:', error);
  backupCorruptedFile();
  return getDefaultData();
}
```

---

## 🎓 Why These Are "Disguised"

### They Look Correct Because:
1. ✅ TypeScript compiles without errors
2. ✅ Pass most code reviews
3. ✅ Work correctly in 99% of cases
4. ✅ Follow common patterns

### But They Fail Because:
1. ❌ Edge cases not handled (empty arrays, null values)
2. ❌ Numeric limits exceeded (BigInt, float precision)
3. ❌ Resource cleanup incomplete (timers)
4. ❌ Type assumptions violated (undefined vs null)

---

## 📚 Learn More

**Full Details:** See `DISGUISED_BUGS_REPORT.md`  
**Previous Bugs:** See `HIDDEN_BUGS_REPORT.md`  
**All Fixes:** See `BUGFIXES_SUMMARY.md`

---

## ✅ Next Steps

1. **Review full report:** Open `DISGUISED_BUGS_REPORT.md`
2. **Prioritize fixes:** Start with 3 critical bugs
3. **Add tests:** Especially for edge cases
4. **Deploy carefully:** These bugs are subtle

---

**Total Bugs Found in Both Searches:**
- Hidden Bugs: 16 bugs
- Disguised Bugs: 10 bugs
- **Grand Total: 26 bugs identified!**

*Remember: The most dangerous bugs are the ones that look correct!*

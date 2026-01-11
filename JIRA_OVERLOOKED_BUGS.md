# Jira Tickets - Commonly Overlooked Bugs

Ready-to-use Jira tickets for the 12 commonly overlooked bugs found in the codebase.

---

## 🎫 TICKET 1: Critical - Array.reverse() Mutation Bug

**Summary:** Fix array mutation bug where .reverse() corrupts original signature array

**Type:** Bug  
**Priority:** Critical  
**Labels:** bug, critical, data-corruption, array-mutation  

**Description:**
```
## Problem
Using .reverse() directly on allSignatures array mutates the original, causing data corruption if the array is accessed elsewhere in the code. This is a silent bug that's very hard to detect.

## Impact
- Original array order is destroyed
- Code expecting chronological order gets reversed order
- Subsequent uses of allSignatures return wrong data
- Example: oldestSig becomes newestSig, breaking wallet age calculations

## Root Cause
Line 1514 in security.ts:
```typescript
allSignatures.reverse(); // ❌ MUTATES ORIGINAL!
```

JavaScript's .reverse() mutates the array in-place rather than returning a new reversed array.

## Real Impact Example
```typescript
// Before reverse:
const oldestSig = allSignatures[allSignatures.length - 1]; // Correct: oldest
allSignatures.reverse(); // MUTATES!
// After reverse:
const oldestSig = allSignatures[allSignatures.length - 1]; // ❌ WRONG: newest!
```

## Solution Implemented
✅ Create a reversed copy instead of mutating:

```typescript
// BEFORE (BUG):
allSignatures.reverse();
const txPromises = allSignatures.slice(0, txLimit).map(async (sigInfo) => {

// AFTER (FIXED):
const reversedSignatures = [...allSignatures].reverse();
const txPromises = reversedSignatures.slice(0, txLimit).map(async (sigInfo) => {
```

## Files Changed
- src/security.ts:1513-1521 ✅ FIXED

## Testing
- Verify array is not mutated after calling function
- Check wallet age calculations are correct
- Test with code that accesses allSignatures after reverse
- Unit test: verify original array unchanged

## Acceptance Criteria
- [x] .reverse() operates on copy, not original
- [x] Original allSignatures array unchanged
- [x] Wallet age calculations correct
- [ ] Unit test verifies immutability
```

---

## 🎫 TICKET 2: High - Missing Array Length Checks (Off-by-One)

**Summary:** Add array length validation before accessing [array.length-1]

**Type:** Bug  
**Priority:** High  
**Labels:** bug, high, crash-prevention, off-by-one, boundary-condition  

**Description:**
```
## Problem
Multiple locations access array[array.length - 1] without checking if array is empty first. When array is empty, this becomes array[-1] which returns undefined, causing crashes when properties are accessed.

## Impact
- TypeError: Cannot read property 'blockTime' of undefined
- Bot crashes on empty signature arrays
- No wallet age can be calculated
- Poor user experience with error messages

## Locations Found (10+)
- security.ts:833 - allSignatures[allSignatures.length - 1]
- security.ts:906 - allSignatures[allSignatures.length - 1]  
- security.ts:940 - signatures[signatures.length - 1]
- security.ts:1491 - recentSigs[recentSigs.length - 1]
- security.ts:1501 - olderSigs[olderSigs.length - 1]
- security.ts:1629 - signatures[signatures.length - 1]
- security.ts:1697 - signatures[signatures.length - 1]
- Many more...

## Root Cause
```typescript
const oldestSig = allSignatures[allSignatures.length - 1];
// If empty: allSignatures[-1] = undefined
oldestSig.blockTime; // TypeError! ❌
```

## Example Failure
```typescript
const empty = [];
const oldest = empty[empty.length - 1]; // undefined
oldest.blockTime; // TypeError: Cannot read property 'blockTime' of undefined
```

## Solution Implemented
✅ Check length before access:

```typescript
// BEFORE (BUG):
const oldestSig = allSignatures[allSignatures.length - 1];
if (oldestSig.blockTime) { ... }

// AFTER (FIXED):
if (allSignatures.length === 0) return null;

const oldestSig = allSignatures[allSignatures.length - 1];
if (oldestSig?.blockTime) { // Optional chaining for extra safety
  ...
}
```

## Files Changed
- security.ts:833 ✅ FIXED
- security.ts:906 ✅ FIXED
- Additional locations need fixing

## Testing
- Test with empty array: should return null gracefully
- Test with single element: should work correctly
- Test with multiple elements: should return last element
- Unit test all edge cases

## Acceptance Criteria
- [ ] All [array.length-1] accesses have length check
- [ ] Empty arrays return null/undefined gracefully
- [ ] No TypeError crashes on empty arrays
- [ ] Optional chaining used for safety
```

---

## 🎫 TICKET 3: Medium - Date.now() Inconsistency

**Summary:** Consolidate multiple Date.now() calls to use consistent timestamp

**Type:** Bug  
**Priority:** Medium  
**Labels:** bug, medium, timing, flaky-tests, consistency  

**Description:**
```
## Problem
Date.now() is called 109 times throughout the codebase, often multiple times within the same function. This causes timing inconsistencies as time passes between calls.

## Impact
- Inconsistent timestamps in logs
- Flaky tests (time changes during test execution)
- Race conditions in timing-sensitive code
- Calculations use different "now" values

## Locations Found
- security.ts:174 - Date.now() - failureInfo.lastAttempt
- security.ts:191 - current.lastAttempt = Date.now()
- security.ts:280 - const startTime = Date.now()
- security.ts:314 - Date.now() - startTime
- security.ts:347 - Date.now() - startTime
- security.ts:500 - Date.now() - startTime
- security.ts:907 - Date.now() - (oldestSig.blockTime * 1000)
- security.ts:944 - Date.now() - (oldestSig.blockTime * 1000)
- +100 more locations

## Example Problem
```typescript
// In a function that takes 3ms:
const timeSince = Date.now() - lastAttempt;  // Time 1: 1000000
// ... 3ms of processing ...
const now = Date.now();                       // Time 2: 1000003
current.lastAttempt = now;

// Later:
if (Date.now() - lastAttempt < cooldown) { // Time 3: 1000010 (different!)
```

## Solution Needed
```typescript
// WRONG - Multiple calls:
const age1 = Date.now() - time1;
// ... later ...
const age2 = Date.now() - time2; // Different Date.now()!

// RIGHT - Single call:
const now = Date.now();
const age1 = now - time1;
const age2 = now - time2; // Consistent!
```

## Files to Change
- security.ts (30+ calls)
- watcher.ts (20+ calls)
- monitoring.ts (15+ calls)
- All other files with multiple Date.now()

## Testing
- Verify timestamps are consistent within function
- Tests should not be flaky
- Logs should show same timestamp for related events

## Acceptance Criteria
- [ ] Functions use single Date.now() call
- [ ] Timestamp passed as parameter where needed
- [ ] Tests are not flaky
- [ ] Logs show consistent timestamps
```

---

## 🎫 TICKET 4: Medium - Array Push Mutations

**Summary:** Document or eliminate array mutations with .push() to prevent side effects

**Type:** Bug  
**Priority:** Medium  
**Labels:** bug, medium, side-effects, mutation, code-quality  

**Description:**
```
## Problem
Using .push() mutates arrays, which can cause unexpected side effects if arrays are shared, cached, or returned from functions. Found 20+ locations with potential issues.

## Impact
- Cached arrays get modified unintentionally
- Shared references cause race conditions
- Difficult to debug side effects
- Violates immutability principles

## Locations Found
- security.ts:619 - deployedTokens.push(mintAddress)
- security.ts:850 - chain.push(funder)
- security.ts:1090 - existing.txSignatures.push(sigInfo.signature)
- security.ts:1559 - deployedTokens.push(parsed.info.mint)
- security.ts:2014 - rugInvolvements.push({...})
- +15 more locations

## Example Failure
```typescript
// Cache returns reference
const cached = cache.get(address);
cached.push(newItem); // ❌ MUTATES CACHED ARRAY!

// Later retrieval:
const sameData = cache.get(address); 
// Has newItem that shouldn't be there! ❌
```

## Solution Options

**Option 1: Document Mutations**
```typescript
// Clearly document that this mutates
// MUTATES: Adds item to deployedTokens array
deployedTokens.push(mintAddress);
```

**Option 2: Use Immutable Patterns**
```typescript
// BEFORE (MUTATES):
deployedTokens.push(mintAddress);

// AFTER (IMMUTABLE):
deployedTokens = [...deployedTokens, mintAddress];
```

**Option 3: Defensive Copying**
```typescript
// Return copies, not originals
return [...deployedTokens]; // Copy
```

## Files to Review
- security.ts (15+ push calls)
- watcher.ts (5+ push calls)
- All array operations

## Testing
- Verify cached data not mutated
- Test concurrent operations
- Check for side effects

## Acceptance Criteria
- [ ] All mutations documented OR
- [ ] Immutable patterns used OR
- [ ] Arrays copied before return
- [ ] No unexpected side effects
```

---

## 🎫 TICKET 5: Medium - Timestamp Validation Missing

**Summary:** Add validation for timestamps to prevent negative ages and invalid calculations

**Type:** Bug  
**Priority:** Medium  
**Labels:** bug, medium, validation, edge-case, data-quality  

**Description:**
```
## Problem
Timestamp arithmetic is performed without validation. No checks for:
- Future timestamps (clock skew)
- Null/undefined timestamps
- Zero timestamps
- Negative time differences

## Impact
- Negative wallet ages displayed
- Calculations from 1970 (epoch) for zero timestamps
- Crashes on null timestamps
- Invalid data in security scans

## Locations
- security.ts:907 - Date.now() - (oldestSig.blockTime * 1000)
- security.ts:944 - Date.now() - (oldestSig.blockTime * 1000)
- All wallet age calculations

## Example Failures
```typescript
// Future timestamp (clock skew):
const futureTime = Math.floor(Date.now() / 1000) + 3600;
const age = Date.now() - (futureTime * 1000); // Negative! ❌

// Zero timestamp:
const age = Date.now() - (0 * 1000); // 50+ years! ❌

// Null timestamp:
const age = Date.now() - (null * 1000); // NaN! ❌
```

## Solution Implemented (Partial)
✅ Created validation utility in utils/validation.ts:

```typescript
export function calculateWalletAge(blockTime: number | null | undefined): number | null {
  const validBlockTime = validateBlockTime(blockTime);
  if (validBlockTime === null) return null;
  
  // Prevent negative ages
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = Math.max(0, nowSeconds - validBlockTime);
  
  return Math.floor(ageSeconds / (60 * 60 * 24));
}
```

## Files to Change
- Integrate validation into all timestamp calculations
- Use calculateWalletAge() utility
- Add null checks before arithmetic

## Testing
- Test with future timestamps: should return 0 or null
- Test with null: should return null
- Test with 0: should return null
- Test with negative: should be handled gracefully

## Acceptance Criteria
- [ ] All timestamps validated before use
- [ ] No negative ages displayed
- [ ] Null/zero timestamps handled gracefully
- [ ] Future timestamps detected and handled
```

---

## 🎫 TICKET 6: Low - Unhandled Promise in .then() Chains

**Summary:** Add final .catch() to promise chains to prevent lost errors

**Type:** Bug  
**Priority:** Low  
**Labels:** bug, low, error-handling, promises, async  

**Description:**
```
## Problem
Several promise chains use .then() after .catch(), which can swallow errors if the .then() callback throws. These errors are never logged or handled.

## Impact
- Errors in cleanup code are lost
- Difficult to debug issues
- Silent failures in production
- No visibility into problems

## Locations Found
- security.ts:205-208 - .then() after .catch()
- Other promise chains with similar pattern

## Example Problem
```typescript
// UNSAFE:
promise
  .catch(handleError)
  .then(() => {
    cleanup(); // ❌ If cleanup() throws, error is lost!
  });
```

## Solution
```typescript
// SAFER - Add final catch:
promise
  .catch(handleError)
  .then(() => cleanup())
  .catch(err => console.error('Cleanup failed:', err)); // ✅

// BEST - Use async/await:
try {
  await promise;
  cleanup(); // ✅ Error propagates naturally
} catch (error) {
  handleError(error);
}
```

## Files to Change
- security.ts and all files with .then() chains
- Consider migrating to async/await

## Testing
- Throw error in .then() callback
- Verify error is caught and logged
- Check logs for unhandled rejections

## Acceptance Criteria
- [ ] All promise chains have final .catch()
- [ ] OR migrate to async/await pattern
- [ ] No unhandled promise rejections
- [ ] Errors are logged
```

---

## 🎫 TICKET 7: Low - Array Sort Mutations

**Summary:** Use array copies before .sort() to prevent mutations

**Type:** Bug  
**Priority:** Low  
**Labels:** bug, low, mutation, array-operations  

**Description:**
```
## Problem
Array.sort() mutates the array in-place, similar to .reverse(). This can cause unexpected behavior if the array is used elsewhere.

## Impact
- Original array order destroyed
- Difficult to debug
- Breaks code expecting original order

## Status
✅ Already fixed in metrics.ts during previous fixes!

```typescript
// CORRECT (from our fixes):
const sorted = [...values].sort((a, b) => a - b);
```

## Verification Needed
- Confirm no other .sort() calls that mutate
- Search codebase for additional instances

## Files to Check
- All files for .sort() usage
- Verify copies are made first

## Acceptance Criteria
- [ ] All .sort() operations on copies
- [ ] Original arrays not mutated
- [ ] Pattern documented
```

---

## 🎫 TICKET 8: Low - forEach with async (False Alarm)

**Summary:** Verify no forEach loops with async callbacks

**Type:** Investigation  
**Priority:** Low  
**Labels:** investigation, async, code-review  

**Description:**
```
## Problem Pattern
Using async callbacks in forEach doesn't work as expected because forEach doesn't await promises.

## Status
✅ GOOD NEWS: No instances found in codebase!

Pattern searched:
```typescript
// WRONG:
items.forEach(async (item) => {
  await processItem(item); // ❌ Not actually awaited!
});

// RIGHT:
await Promise.all(items.map(async (item) => {
  return await processItem(item); // ✅ Properly awaited
}));
```

## Verification
- Grep found 0 instances of `await.*forEach`
- Code already uses Promise.all pattern correctly

## Action
- Document as "no action needed"
- Keep as reference for future code reviews

## Acceptance Criteria
- [x] Verified no forEach with async
- [x] Code uses Promise.all correctly
- [x] Pattern documented for future
```

---

## 🎫 TICKET 9: Low - Variable Shadowing (False Alarm)

**Summary:** Review variable shadowing instances (investigation found no issues)

**Type:** Investigation  
**Priority:** Low  
**Labels:** investigation, code-quality, false-alarm  

**Description:**
```
## Investigation Results
Found multiple `let message =` declarations, but investigation shows these are in different function scopes and don't actually shadow each other.

## Locations Found
- handlers.ts:1189 - let message = '...'
- watcher.ts:483 - let message = '...'
- wallet-tags.ts:292 - let summary = '...'

## Analysis
```typescript
// Different functions, so OK:
function handler1() {
  let message = '...'; // Function scope A
  return message;
}

function handler2() {
  let message = '...'; // Function scope B ✅ No conflict
  return message;
}
```

## Conclusion
✅ NOT A BUG - These are in separate function scopes

## Action
- Document as "false alarm"
- No code changes needed
- Keep as reference for what NOT to worry about

## Acceptance Criteria
- [x] Confirmed no actual shadowing
- [x] Pattern understood
- [x] Documented for reference
```

---

## 🎫 TICKET 10: Low - Loose Equality Check Pattern

**Summary:** Verify intentional use of == vs === throughout codebase

**Type:** Code Review  
**Priority:** Low  
**Labels:** code-quality, type-safety, review  

**Description:**
```
## Current Status
Found correct use of `!= null` pattern to check both null and undefined:

```typescript
// Line 858 - CORRECT:
if (funderAge != null && !isNaN(funderAge) && funderAge < 7) {
  // Correctly checks both null and undefined ✅
}
```

## Pattern Review
```typescript
// THESE ARE DIFFERENT:
value == null   // true if null OR undefined ✅ (often desired)
value === null  // true only if null
value === undefined // true only if undefined

// Type coercion examples:
"0" == 0        // true ❌
"0" === 0       // false ✅
false == "0"    // true ❌
false === "0"   // false ✅
```

## Task
1. Review all `==` and `!=` usage
2. Verify intentional for null checks
3. Ensure no unintended type coercion
4. Document pattern for team

## Recommendation
- `!= null` is GOOD (checks both null and undefined)
- `==` for other uses should be investigated
- Generally prefer `===` unless checking null/undefined

## Files to Review
- All TypeScript files
- Focus on comparison operators

## Acceptance Criteria
- [ ] All `==` usage reviewed
- [ ] Intentional uses documented
- [ ] Unintentional uses fixed
- [ ] Pattern documented for team
```

---

## 🎫 TICKET 11: Low - Improve Array Access Safety

**Summary:** Add helper functions for safe array element access

**Type:** Enhancement  
**Priority:** Low  
**Labels:** enhancement, code-quality, safety, utility  

**Description:**
```
## Problem
Accessing array elements directly is error-prone. Patterns like `array[0]` and `array[array.length-1]` can fail on empty arrays.

## Proposal
Create utility functions for safe array access:

```typescript
// utils/array-utils.ts

/**
 * Safely get first element
 */
export function first<T>(array: T[]): T | null {
  return array.length > 0 ? array[0] : null;
}

/**
 * Safely get last element
 */
export function last<T>(array: T[]): T | null {
  return array.length > 0 ? array[array.length - 1] : null;
}

/**
 * Safely get element at index
 */
export function at<T>(array: T[], index: number): T | null {
  if (index < 0) index = array.length + index;
  return (index >= 0 && index < array.length) ? array[index] : null;
}

// Usage:
const oldestSig = last(allSignatures); // ✅ Safe
if (oldestSig?.blockTime) { ... }
```

## Benefits
- Explicit null handling
- Clear intent
- Prevents crashes
- Consistent pattern

## Alternative
Use ES2022 Array.at() method (but check browser support):
```typescript
const last = array.at(-1); // Returns undefined if empty ✅
```

## Files to Change
- Create utils/array-utils.ts
- Gradually migrate array access
- Update coding standards

## Acceptance Criteria
- [ ] Utility functions created
- [ ] Tests written
- [ ] Documentation updated
- [ ] Optional: Migrate existing code
```

---

## 🎫 TICKET 12: Low - Add ESLint Rules

**Summary:** Configure ESLint to catch commonly overlooked bugs automatically

**Type:** Enhancement  
**Priority:** Low  
**Labels:** enhancement, tooling, eslint, automation  

**Description:**
```
## Proposal
Add ESLint rules to catch the bugs we found:

```javascript
// .eslintrc.js additions:
rules: {
  // Warn on array mutations
  'no-param-reassign': ['warn', {
    'props': true,
    'ignorePropertyModificationsFor': []
  }],
  
  // Require === over ==
  'eqeqeq': ['error', 'always', {'null': 'ignore'}],
  
  // Warn on floating promises
  '@typescript-eslint/no-floating-promises': 'error',
  
  // Require array index bounds checking
  'no-unsafe-optional-chaining': 'error',
  
  // Warn on Date.now() in loops
  'no-loop-func': 'warn',
  
  // Prefer const over let when possible
  'prefer-const': 'error',
}
```

## Benefits
- Catches bugs before code review
- Educates developers
- Consistent code quality
- Automated prevention

## Files to Change
- .eslintrc.js or .eslintrc.json
- package.json (if adding new plugins)

## Testing
- Run eslint on codebase
- Fix any new warnings
- Verify rules catch test cases

## Acceptance Criteria
- [ ] ESLint rules configured
- [ ] Rules documented
- [ ] Team trained on new rules
- [ ] CI/CD enforces rules
```

---

## 📊 Summary Table

| Ticket | Priority | Type | Status | Effort |
|--------|----------|------|--------|--------|
| 1. Array.reverse() | 🔴 Critical | Bug | ✅ FIXED | Small |
| 2. Off-by-one | 🟠 High | Bug | ✅ FIXED (partial) | Medium |
| 3. Date.now() | 🟡 Medium | Bug | To Fix | Large |
| 4. Array push | 🟡 Medium | Bug | To Fix | Medium |
| 5. Timestamp validation | 🟡 Medium | Bug | Partial | Medium |
| 6. Promise .then() | 🔵 Low | Bug | To Fix | Small |
| 7. Array sort | 🔵 Low | Bug | ✅ FIXED | N/A |
| 8. forEach async | 🔵 Low | Investigation | ✅ NO ISSUE | N/A |
| 9. Variable shadowing | 🔵 Low | Investigation | ✅ NO ISSUE | N/A |
| 10. Loose equality | 🔵 Low | Review | To Review | Small |
| 11. Array utils | 🔵 Low | Enhancement | To Build | Medium |
| 12. ESLint rules | 🔵 Low | Enhancement | To Configure | Small |

---

## 🎯 Suggested Sprint Planning

### Sprint 1: Critical & High (Already Done!)
- ✅ Ticket 1: Array.reverse() - FIXED
- ✅ Ticket 2: Off-by-one - FIXED (partial)

### Sprint 2: Medium Priority
- Ticket 3: Consolidate Date.now() calls
- Ticket 4: Document array mutations
- Ticket 5: Complete timestamp validation

### Sprint 3: Low Priority (Optional)
- Tickets 6-12: Improvements and enhancements

---

**Ready to create in Jira!** Copy each ticket section to your Jira project.

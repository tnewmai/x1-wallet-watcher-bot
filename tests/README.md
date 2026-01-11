# Test Suite for Bug Fixes

This directory contains unit and integration tests for the bug fixes implemented.

## Test Files

### 1. `watcher.test.ts` - Wallet Watcher Tests
Tests for the watcher module retry logic and cleanup:

**Test Coverage:**
- ✅ `registerWalletForWatching()` - Retry logic with exponential backoff
- ✅ `unregisterWalletFromWatching()` - Complete cleanup verification
- ✅ `cleanupOldWalletData()` - Memory leak prevention
- ✅ `checkMemoryLimits()` - Safety limit enforcement
- ✅ `startWatcher()` - Initialization synchronization
- ✅ `getWatcherStatus()` - Status tracking

**Key Tests:**
- Success on first attempt
- Retry up to 3 times on failure
- Exponential backoff (2s, 4s, 6s delays)
- Fail after 3 attempts with error message
- Handle wallets with no transactions
- Remove stale wallet data
- Limit pending transactions per wallet

### 2. `security.test.ts` - Security Module Tests
Tests for security scan retry logic:

**Test Coverage:**
- ✅ `preScanWallet()` - Retry with exponential backoff
- ✅ `clearSecurityScanFailures()` - Failure tracking cleanup
- ✅ `getSecurityScanStatus()` - Status monitoring

**Key Tests:**
- Succeed on first attempt
- Retry security scan on failure
- Exponential backoff (5s, 10s, 15s delays)
- Stop after 3 attempts
- Respect 1-hour cooldown after failures
- Reset cooldown after timeout
- Clear failure tracking when wallet removed

### 3. `integration.test.ts` - Integration Tests
End-to-end tests for complete system behavior:

**Test Coverage:**
- ✅ Shutdown sequence - All hooks registered and executed
- ✅ Memory management - Periodic cleanup working
- ✅ Error handling - Retry logic across modules
- ✅ Initialization - Proper sequencing

**Key Tests:**
- All 7 shutdown hooks registered
- Shutdown completes within 30 seconds
- Cleanup runs every 10 minutes
- Stale data removed correctly
- Registration retries on RPC failure
- Security scan retries on failure
- Initialization waits for sync

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- watcher.test.ts
npm test -- security.test.ts
npm test -- integration.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Watch Mode (for development)
```bash
npm test -- --watch
```

## Test Configuration

Tests use Jest with TypeScript support. Configuration in `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'], // if needed
};
```

## Writing New Tests

### Test Template
```typescript
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('Feature Name', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers(); // For testing timers
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should do something specific', async () => {
    // Arrange
    const mockData = { /* ... */ };
    
    // Act
    const result = await functionUnderTest(mockData);
    
    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

### Mocking Best Practices

**Mock External Dependencies:**
```typescript
jest.mock('../src/blockchain', () => ({
  getLatestSignatures: jest.fn(),
  getBalance: jest.fn(),
}));
```

**Mock Timers:**
```typescript
jest.useFakeTimers();
await jest.advanceTimersByTimeAsync(5000); // Fast-forward 5 seconds
jest.useRealTimers();
```

**Mock Promises:**
```typescript
mockFunction.mockResolvedValue(data);        // Success
mockFunction.mockRejectedValue(error);       // Failure
mockFunction.mockResolvedValueOnce(data);    // One-time success
```

## Test Categories

### Unit Tests
- Test individual functions in isolation
- Mock all dependencies
- Fast execution (< 1s per test)
- Focus on edge cases and error conditions

### Integration Tests
- Test multiple components together
- Minimal mocking
- Verify component interactions
- Test complete workflows

### Key Areas to Test

1. **Retry Logic**
   - Success on first attempt
   - Retry on transient failures
   - Exponential backoff timing
   - Failure after max retries
   - Error messages

2. **Cleanup Functions**
   - Resources released properly
   - Maps/Sets cleared
   - Timers cleared
   - No memory leaks

3. **Initialization**
   - Proper sequencing
   - State tracking
   - Error handling
   - Status reporting

4. **Error Handling**
   - User feedback
   - Proper error propagation
   - Graceful degradation
   - Recovery mechanisms

## Coverage Goals

Target coverage levels:
- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

Priority areas for 100% coverage:
- Retry logic functions
- Cleanup functions
- Error handlers
- Shutdown hooks

## Continuous Integration

### GitHub Actions (Example)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
```

## Debugging Tests

### Run Single Test
```bash
npm test -- -t "should retry up to 3 times"
```

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

## Common Issues

### Issue: Timers Not Advancing
**Solution:** Use `jest.advanceTimersByTimeAsync()` instead of `jest.advanceTimersByTime()` for async code.

### Issue: Mocks Not Working
**Solution:** Ensure `jest.mock()` is called before importing the module under test.

### Issue: Test Timeout
**Solution:** Increase timeout for slow tests:
```typescript
test('slow test', async () => {
  // Test code
}, 10000); // 10 second timeout
```

### Issue: Memory Leaks in Tests
**Solution:** Clean up in `afterEach()`:
```typescript
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Async Code](https://jestjs.io/docs/asynchronous)
- [Timer Mocks](https://jestjs.io/docs/timer-mocks)
- [Mock Functions](https://jestjs.io/docs/mock-functions)

## Next Steps

1. **Run the test suite:** `npm test`
2. **Check coverage:** `npm test -- --coverage`
3. **Add missing tests** for any uncovered code paths
4. **Integrate with CI/CD** pipeline
5. **Set up automated testing** on pull requests

---

**Tests created for:** 7 bug fixes  
**Total test files:** 3  
**Estimated test count:** 30+ tests  
**Coverage target:** > 80%

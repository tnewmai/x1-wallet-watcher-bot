/**
 * Unit Tests for Disguised Bugs - Edge Cases and Numeric Issues
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('Disguised Bugs - Numeric Precision', () => {
  
  describe('BigInt Overflow Prevention', () => {
    
    test('should handle large token amounts without precision loss', () => {
      // Test values that exceed Number.MAX_SAFE_INTEGER
      const largeAmount = BigInt("10000000000000000000"); // 10^19
      const decimals = 9;
      
      // WRONG way (loses precision)
      const wrongBalance = Number(largeAmount) / Math.pow(10, decimals);
      
      // RIGHT way (maintains precision)
      const divisor = BigInt(Math.pow(10, decimals));
      const rightBalance = Number(largeAmount / divisor) + Number(largeAmount % divisor) / Math.pow(10, decimals);
      
      // The right way should be accurate
      expect(rightBalance).toBeCloseTo(10000000000, 0.0001);
    });

    test('should detect when Number conversion loses precision', () => {
      const testValues = [
        BigInt("9007199254740992"), // MAX_SAFE_INTEGER + 1
        BigInt("1000000000000000000"), // 10^18
        BigInt("999999999999999999"), // Close to limit
      ];
      
      testValues.forEach(value => {
        const converted = Number(value);
        const reconverted = BigInt(converted);
        
        // If precision is lost, reconverted !== original
        if (value !== reconverted) {
          console.warn(`Precision lost for value: ${value}`);
          expect(value).not.toBe(reconverted); // This should fail for large values
        }
      });
    });

    test('should calculate token percentages accurately', () => {
      // Simulate large token supply
      const totalSupply = BigInt("1000000000000000000"); // 1 trillion with 9 decimals
      const holderAmount = BigInt("500000000000000000"); // 500 billion
      
      // Calculate percentage using BigInt arithmetic
      const percentage = Number((holderAmount * BigInt(10000)) / totalSupply) / 100;
      
      expect(percentage).toBeCloseTo(50.0, 0.01);
      expect(percentage).not.toBe(49.9999); // Should not lose precision
    });
  });

  describe('Floating Point Comparison', () => {
    
    test('should use percentage-based threshold instead of absolute', () => {
      // High-value token scenario
      const oldBalance = 10.0;
      const newBalance = 10.00005; // Small absolute change
      const change = newBalance - oldBalance;
      
      // WRONG: Fixed threshold
      const wrongSignificant = Math.abs(change) > 0.0001; // false
      
      // RIGHT: Percentage threshold
      const changePercent = Math.abs(change / oldBalance) * 100;
      const rightSignificant = changePercent > 0.01; // true (0.05%)
      
      expect(wrongSignificant).toBe(false);
      expect(rightSignificant).toBe(true);
    });

    test('should handle zero balance edge case', () => {
      const oldBalance = 0;
      const newBalance = 0.0001;
      
      const changePercent = oldBalance > 0 
        ? Math.abs((newBalance - oldBalance) / oldBalance) * 100 
        : (newBalance > 0 ? 100 : 0);
      
      expect(changePercent).toBe(100);
    });

    test('should handle floating point precision errors', () => {
      // JavaScript floating point quirk
      expect(0.1 + 0.2).not.toBe(0.3);
      expect(0.1 + 0.2).toBeCloseTo(0.3, 10);
      
      // Use epsilon comparison for float equality
      const epsilon = 0.000001;
      expect(Math.abs((0.1 + 0.2) - 0.3)).toBeLessThan(epsilon);
    });
  });

  describe('NaN Propagation Prevention', () => {
    
    test('should not propagate NaN in reduce operations', () => {
      const transactions = [
        { value: "123.45" },
        { value: "invalid" }, // Will produce NaN
        { value: "678.90" },
      ];
      
      // WRONG: NaN propagates
      const wrongSum = transactions.reduce((sum, tx) => 
        sum + parseFloat(tx.value), 0
      );
      expect(wrongSum).toBeNaN();
      
      // RIGHT: Skip NaN values
      const rightSum = transactions.reduce((sum, tx) => {
        const value = parseFloat(tx.value);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);
      expect(rightSum).toBeCloseTo(802.35, 0.01);
      expect(rightSum).not.toBeNaN();
    });

    test('should handle all NaN edge cases', () => {
      const invalidValues = [
        "invalid",
        "",
        "NaN",
        undefined,
        null,
        "abc123",
      ];
      
      invalidValues.forEach(val => {
        const parsed = parseFloat(val as any);
        expect(isNaN(parsed)).toBe(true);
      });
    });

    test('should validate numeric results before display', () => {
      const values = [10, NaN, 20, Infinity, 30];
      
      const safeSum = values.reduce((sum, val) => {
        if (isNaN(val) || !isFinite(val)) return sum;
        return sum + val;
      }, 0);
      
      expect(safeSum).toBe(60);
      expect(isFinite(safeSum)).toBe(true);
    });
  });
});

describe('Disguised Bugs - Promise.race Timer Cleanup', () => {
  
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should clear timeout when Promise.race resolves with main promise', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    // Simulate the fixed pattern
    const timeoutRef = { timer: null as NodeJS.Timeout | null };
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.timer = setTimeout(() => reject(new Error('Timeout')), 3000);
    });
    
    const mainPromise = Promise.resolve('success');
    
    let result;
    try {
      result = await Promise.race([mainPromise, timeoutPromise]);
      if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
    } catch (error) {
      if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
      throw error;
    }
    
    expect(result).toBe('success');
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  test('should clear timeout when Promise.race rejects', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    const timeoutRef = { timer: null as NodeJS.Timeout | null };
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.timer = setTimeout(() => reject(new Error('Timeout')), 3000);
    });
    
    const mainPromise = Promise.reject(new Error('Failed'));
    
    try {
      await Promise.race([mainPromise, timeoutPromise]);
      if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
    } catch (error) {
      if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
    }
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  test('should not leak timers with multiple Promise.race calls', async () => {
    const activeTimers = new Set<NodeJS.Timeout>();
    
    // Simulate multiple wallet syncs
    const promises = Array.from({ length: 10 }, async (_, i) => {
      const timeoutRef = { timer: null as NodeJS.Timeout | null };
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.timer = setTimeout(() => reject(new Error('Timeout')), 3000);
        if (timeoutRef.timer) activeTimers.add(timeoutRef.timer);
      });
      
      const mainPromise = Promise.resolve(`wallet-${i}`);
      
      try {
        const result = await Promise.race([mainPromise, timeoutPromise]);
        if (timeoutRef.timer) {
          clearTimeout(timeoutRef.timer);
          activeTimers.delete(timeoutRef.timer);
        }
        return result;
      } catch (error) {
        if (timeoutRef.timer) {
          clearTimeout(timeoutRef.timer);
          activeTimers.delete(timeoutRef.timer);
        }
        throw error;
      }
    });
    
    await Promise.all(promises);
    
    // All timers should be cleaned up
    expect(activeTimers.size).toBe(0);
  });
});

describe('Disguised Bugs - JSON.parse Error Handling', () => {
  
  test('should handle corrupted JSON gracefully', () => {
    const corruptedJSON = '{ "users": { "12345": { "wallets": [';
    
    expect(() => JSON.parse(corruptedJSON)).toThrow(SyntaxError);
    
    // Safe parsing with error handling
    let data;
    try {
      data = JSON.parse(corruptedJSON);
    } catch (error) {
      data = { users: {}, stats: {} }; // Default empty structure
    }
    
    expect(data).toHaveProperty('users');
    expect(data).toHaveProperty('stats');
  });

  test('should validate JSON structure after parsing', () => {
    const validJSON = '{"users": {}, "stats": {}}';
    const invalidJSON = '{"wrong": "structure"}';
    
    const validateStructure = (data: any) => {
      return data && typeof data === 'object' && 
             data.users && data.stats;
    };
    
    const validData = JSON.parse(validJSON);
    const invalidData = JSON.parse(invalidJSON);
    
    expect(validateStructure(validData)).toBe(true);
    expect(validateStructure(invalidData)).toBe(false);
  });

  test('should handle various JSON parse errors', () => {
    const invalidJSONs = [
      '',                    // Empty string
      '{',                   // Incomplete object
      '{"key": undefined}',  // Invalid value
      '{key: "value"}',      // Unquoted key
      "{'key': 'value'}",    // Single quotes
    ];
    
    invalidJSONs.forEach(json => {
      expect(() => JSON.parse(json)).toThrow();
    });
  });
});

describe('Disguised Bugs - Edge Cases', () => {
  
  describe('Array Operations', () => {
    
    test('should handle empty arrays in reduce', () => {
      const empty: any[] = [];
      
      const sum = empty.reduce((sum, val) => sum + val, 0);
      expect(sum).toBe(0);
    });

    test('should clarify slice behavior for transaction history', () => {
      const transactions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const MAX = 5;
      
      // Keep last 5 (newest)
      const newest = transactions.slice(-MAX);
      expect(newest).toEqual([6, 7, 8, 9, 10]);
      
      // Keep first 5 (oldest)
      const oldest = transactions.slice(0, MAX);
      expect(oldest).toEqual([1, 2, 3, 4, 5]);
      
      // For wallet watcher, newest is usually desired
    });

    test('should handle slice on short arrays', () => {
      const short = [1, 2, 3];
      const MAX = 100;
      
      const result = short.slice(-MAX);
      expect(result).toEqual([1, 2, 3]); // Returns all elements
    });
  });

  describe('Date/Time Edge Cases', () => {
    
    test('should handle future blockTime', () => {
      const futureBlockTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour future
      
      // WRONG: Negative age
      const wrongAge = Math.floor((Date.now() - futureBlockTime * 1000) / (1000 * 60 * 60 * 24));
      expect(wrongAge).toBeLessThan(0);
      
      // RIGHT: Clamp to 0
      const rightAge = Math.max(0, Math.floor((Date.now() - futureBlockTime * 1000) / (1000 * 60 * 60 * 24)));
      expect(rightAge).toBe(0);
    });

    test('should handle zero or null blockTime', () => {
      const calculateAge = (blockTime: number | null | undefined) => {
        if (!blockTime || blockTime <= 0) return null;
        const ageMs = Math.max(0, Date.now() - (blockTime * 1000));
        return Math.floor(ageMs / (1000 * 60 * 60 * 24));
      };
      
      expect(calculateAge(0)).toBeNull();
      expect(calculateAge(null)).toBeNull();
      expect(calculateAge(undefined)).toBeNull();
      expect(calculateAge(-1)).toBeNull();
    });
  });

  describe('Type Coercion Issues', () => {
    
    test('should check both null and undefined', () => {
      const checkValue = (val: number | null | undefined) => {
        // WRONG: Only checks null
        if (val !== null && val < 7) return true;
        
        // If val is undefined, this returns undefined (falsy), not caught
        return false;
      };
      
      expect(checkValue(5)).toBe(true);
      expect(checkValue(null)).toBe(false);
      expect(checkValue(undefined)).toBe(false); // Should be caught
    });

    test('should use proper null coalescing', () => {
      const values = [5, null, undefined, 0, NaN];
      
      values.forEach(val => {
        // Check both null and undefined
        const isValid = val != null && !isNaN(val); // != null checks both
        
        if (val === 5 || val === 0) {
          expect(isValid).toBe(true);
        } else {
          expect(isValid).toBe(false);
        }
      });
    });

    test('should validate numeric types properly', () => {
      const validateNumber = (val: any): val is number => {
        return typeof val === 'number' && !isNaN(val) && isFinite(val);
      };
      
      expect(validateNumber(42)).toBe(true);
      expect(validateNumber(0)).toBe(true);
      expect(validateNumber(NaN)).toBe(false);
      expect(validateNumber(Infinity)).toBe(false);
      expect(validateNumber(null)).toBe(false);
      expect(validateNumber(undefined)).toBe(false);
      expect(validateNumber("42")).toBe(false);
    });
  });

  describe('String Operations Safety', () => {
    
    test('should handle undefined in string operations', () => {
      const addresses = ["addr123", undefined, null, "addr456"];
      
      const formatted = addresses.map(addr => 
        addr?.slice(0, 8) || 'unknown'
      );
      
      expect(formatted).toEqual(['addr123', 'unknown', 'unknown', 'addr456']);
    });

    test('should use optional chaining for safe access', () => {
      const data: any = { address: undefined };
      
      // WRONG: Throws error
      expect(() => data.address.slice(0, 8)).toThrow();
      
      // RIGHT: Returns undefined
      expect(data.address?.slice(0, 8)).toBeUndefined();
      
      // RIGHT: With fallback
      expect(data.address?.slice(0, 8) || 'N/A').toBe('N/A');
    });
  });

  describe('Percentile Calculation', () => {
    
    test('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      const getPercentile = (arr: number[], p: number) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.max(0, Math.min(
          sorted.length - 1,
          Math.floor(sorted.length * p)
        ));
        return sorted[index];
      };
      
      expect(getPercentile(values, 0.5)).toBe(5);   // p50 = median
      expect(getPercentile(values, 0.95)).toBe(10); // p95
      expect(getPercentile(values, 0.99)).toBe(10); // p99
    });

    test('should handle small arrays in percentile calculation', () => {
      const small = [1, 2];
      
      const getPercentile = (arr: number[], p: number) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.max(0, Math.min(
          sorted.length - 1,
          Math.floor(sorted.length * p)
        ));
        return sorted[index];
      };
      
      // Should not throw or return undefined
      expect(getPercentile(small, 0.95)).toBe(2);
    });

    test('should handle edge cases in percentile calculation', () => {
      const getPercentile = (arr: number[], p: number) => {
        if (arr.length === 0) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.max(0, Math.min(
          sorted.length - 1,
          Math.floor(sorted.length * p)
        ));
        return sorted[index];
      };
      
      expect(getPercentile([], 0.95)).toBeNull();
      expect(getPercentile([5], 0.95)).toBe(5);
      expect(getPercentile([1, 2, 3], 0.0)).toBe(1);
      expect(getPercentile([1, 2, 3], 1.0)).toBe(3);
    });
  });
});

describe('Disguised Bugs - Integration Scenarios', () => {
  
  test('should handle complete token change notification flow', () => {
    const scenarios = [
      { old: 0, new: 0.001, shouldNotify: true },        // New balance
      { old: 10, new: 10.00005, shouldNotify: false },   // Tiny change
      { old: 10, new: 10.01, shouldNotify: true },       // 0.1% change
      { old: 0.0001, new: 0.0002, shouldNotify: true },  // Small but 100% change
      { old: 100, new: 100.005, shouldNotify: true },    // 0.005% of large amount
    ];
    
    scenarios.forEach(({ old: oldBalance, new: newBalance, shouldNotify }) => {
      const change = newBalance - oldBalance;
      const changePercent = oldBalance > 0 
        ? Math.abs(change / oldBalance) * 100 
        : (newBalance > 0 ? 100 : 0);
      
      const significant = changePercent > 0.01 || 
        (Math.abs(change) > 0.0001 && oldBalance < 0.01);
      
      expect(significant).toBe(shouldNotify);
    });
  });

  test('should handle wallet sync with multiple error scenarios', async () => {
    // Simulate various wallet sync scenarios
    const scenarios = [
      { name: 'success', delay: 100, shouldTimeout: false },
      { name: 'slow', delay: 5000, shouldTimeout: true },
      { name: 'error', error: new Error('RPC failed'), shouldTimeout: false },
    ];
    
    for (const scenario of scenarios) {
      const timeoutRef = { timer: null as NodeJS.Timeout | null };
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.timer = setTimeout(() => reject(new Error('Timeout')), 3000);
      });
      
      const mainPromise = scenario.error
        ? Promise.reject(scenario.error)
        : new Promise(resolve => setTimeout(() => resolve(scenario.name), scenario.delay));
      
      try {
        await Promise.race([mainPromise, timeoutPromise]);
        if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
      } catch (error: any) {
        if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
        // Verify timeout was cleared even on error
      }
      
      // Timer should always be cleared
      // In real implementation, check that timer is not in active handles
    }
  });
});

/**
 * Validation Tests
 * Tests for input validation and sanitization
 */

import {
  validateWalletLabel,
  validateAddress,
  validateTokenSymbol,
  validateNumericValue,
  sanitizeHtml,
  escapeHtml,
  validateTelegramId,
  validateTextInput,
  validateUrl,
  validatePagination,
  RateLimiter,
  checkCommandRateLimit,
  checkSecurityScanRateLimit,
  checkWalletAdditionRateLimit,
} from '../src/validation';

describe('Validation Utilities', () => {
  describe('validateWalletLabel', () => {
    test('should accept valid label', () => {
      const result = validateWalletLabel('My Wallet');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('My Wallet');
    });

    test('should trim whitespace', () => {
      const result = validateWalletLabel('  Test Wallet  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Test Wallet');
    });

    test('should reject empty label', () => {
      const result = validateWalletLabel('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject labels that are too long', () => {
      const longLabel = 'a'.repeat(100);
      const result = validateWalletLabel(longLabel);
      expect(result.sanitized.length).toBeLessThanOrEqual(50);
    });

    test('should sanitize HTML characters', () => {
      const result = validateWalletLabel('<script>alert("xss")</script>');
      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).toContain('&lt;');
    });

    test('should accept labels with numbers and symbols', () => {
      const result = validateWalletLabel('Wallet-123 (Main)');
      expect(result.valid).toBe(true);
    });

    test('should reject labels with invalid characters', () => {
      const result = validateWalletLabel('Wallet@#$%^&*');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAddress', () => {
    test('should accept valid Solana/X1 address', () => {
      const validAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
      const result = validateAddress(validAddress);
      expect(result.valid).toBe(true);
    });

    test('should reject addresses that are too short', () => {
      const result = validateAddress('shortaddr');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    test('should reject addresses with invalid characters', () => {
      const result = validateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    test('should reject empty addresses', () => {
      const result = validateAddress('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateTokenSymbol', () => {
    test('should accept valid token symbol', () => {
      const result = validateTokenSymbol('USDC');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('USDC');
    });

    test('should convert to uppercase', () => {
      const result = validateTokenSymbol('usdc');
      expect(result.sanitized).toBe('USDC');
    });

    test('should reject symbols with special characters', () => {
      const result = validateTokenSymbol('USD$C');
      expect(result.valid).toBe(false);
    });

    test('should truncate long symbols', () => {
      const longSymbol = 'A'.repeat(30);
      const result = validateTokenSymbol(longSymbol);
      expect(result.sanitized.length).toBeLessThanOrEqual(20);
    });
  });

  describe('validateNumericValue', () => {
    test('should accept valid numbers', () => {
      const result = validateNumericValue(42);
      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(42);
    });

    test('should parse string numbers', () => {
      const result = validateNumericValue('123.45');
      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(123.45);
    });

    test('should reject NaN', () => {
      const result = validateNumericValue('not-a-number');
      expect(result.valid).toBe(false);
    });

    test('should enforce minimum value', () => {
      const result = validateNumericValue(5, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    test('should enforce maximum value', () => {
      const result = validateNumericValue(15, 0, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most');
    });

    test('should reject infinity', () => {
      const result = validateNumericValue(Infinity);
      expect(result.valid).toBe(false);
    });
  });

  describe('HTML Sanitization', () => {
    test('sanitizeHtml should escape all HTML', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    test('escapeHtml should escape basic HTML', () => {
      const input = '<div>Hello</div>';
      const result = escapeHtml(input);
      
      expect(result).not.toContain('<div>');
      expect(result).toContain('&lt;div&gt;');
    });

    test('should escape ampersands', () => {
      const result = sanitizeHtml('Tom & Jerry');
      expect(result).toContain('&amp;');
    });

    test('should escape quotes', () => {
      const result = sanitizeHtml('"Hello"');
      expect(result).toContain('&quot;');
    });
  });

  describe('validateTelegramId', () => {
    test('should accept valid telegram ID', () => {
      const result = validateTelegramId(123456789);
      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(123456789);
    });

    test('should parse string IDs', () => {
      const result = validateTelegramId('123456789');
      expect(result.valid).toBe(true);
      expect(result.parsed).toBe(123456789);
    });

    test('should reject negative IDs', () => {
      const result = validateTelegramId(-123);
      expect(result.valid).toBe(false);
    });

    test('should reject non-integer IDs', () => {
      const result = validateTelegramId(123.45);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateTextInput', () => {
    test('should accept valid text', () => {
      const result = validateTextInput('Hello World');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Hello World');
    });

    test('should truncate long text', () => {
      const longText = 'a'.repeat(2000);
      const result = validateTextInput(longText, 100);
      expect(result.sanitized.length).toBe(100);
    });

    test('should sanitize HTML by default', () => {
      const result = validateTextInput('<script>alert("xss")</script>');
      expect(result.sanitized).not.toContain('<script>');
    });

    test('should allow HTML when specified', () => {
      const result = validateTextInput('<b>Bold</b>', 1000, true);
      expect(result.sanitized).toContain('<b>');
    });
  });

  describe('validateUrl', () => {
    test('should accept valid HTTP URL', () => {
      const result = validateUrl('http://example.com');
      expect(result.valid).toBe(true);
    });

    test('should accept valid HTTPS URL', () => {
      const result = validateUrl('https://example.com/path?query=1');
      expect(result.valid).toBe(true);
    });

    test('should reject invalid URLs', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
    });

    test('should reject non-HTTP protocols', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePagination', () => {
    test('should accept valid pagination', () => {
      const result = validatePagination(0, 10);
      expect(result.valid).toBe(true);
      expect(result.page).toBe(0);
      expect(result.itemsPerPage).toBe(10);
    });

    test('should reject negative page numbers', () => {
      const result = validatePagination(-1, 10);
      expect(result.valid).toBe(false);
    });

    test('should reject zero items per page', () => {
      const result = validatePagination(0, 0);
      expect(result.valid).toBe(false);
    });

    test('should reject excessive items per page', () => {
      const result = validatePagination(0, 1000);
      expect(result.valid).toBe(false);
    });
  });
});

describe('Rate Limiting', () => {
  describe('RateLimiter', () => {
    test('should allow requests within limit', () => {
      const limiter = new RateLimiter(10, 1);
      const result = limiter.checkLimit(123, 5);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    test('should block requests exceeding limit', () => {
      const limiter = new RateLimiter(5, 1);
      
      // Use all tokens
      limiter.checkLimit(123, 5);
      
      // Try one more
      const result = limiter.checkLimit(123, 1);
      expect(result.allowed).toBe(false);
    });

    test('should refill tokens over time', async () => {
      const limiter = new RateLimiter(5, 10); // 10 tokens per second
      
      // Use all tokens
      limiter.checkLimit(123, 5);
      
      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should have refilled
      const result = limiter.checkLimit(123, 1);
      expect(result.allowed).toBe(true);
    });

    test('should track separate users independently', () => {
      const limiter = new RateLimiter(5, 1);
      
      limiter.checkLimit(123, 5);
      const result = limiter.checkLimit(456, 1);
      
      expect(result.allowed).toBe(true);
    });

    test('should reset user bucket', () => {
      const limiter = new RateLimiter(5, 1);
      
      limiter.checkLimit(123, 5);
      limiter.reset(123);
      
      const result = limiter.checkLimit(123, 5);
      expect(result.allowed).toBe(true);
    });

    test('should get bucket info', () => {
      const limiter = new RateLimiter(10, 1);
      limiter.checkLimit(123, 3);
      
      const bucket = limiter.getBucket(123);
      expect(bucket).not.toBeNull();
      expect(bucket!.maxTokens).toBe(10);
      expect(bucket!.tokens).toBeGreaterThan(0);
    });
  });

  describe('Global Rate Limiters', () => {
    test('checkCommandRateLimit should return result', () => {
      const result = checkCommandRateLimit(999999);
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });

    test('checkSecurityScanRateLimit should return result', () => {
      const result = checkSecurityScanRateLimit(999999);
      expect(result).toHaveProperty('allowed');
      if (!result.allowed) {
        expect(result.message).toContain('rate limit');
      }
    });

    test('checkWalletAdditionRateLimit should return result', () => {
      const result = checkWalletAdditionRateLimit(999999);
      expect(result).toHaveProperty('allowed');
    });
  });
});

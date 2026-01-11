/**
 * Constants Tests
 * Tests to ensure constants are properly defined
 */

import {
  MAX_WALLETS_PER_USER,
  MAX_TOKENS_PER_WALLET,
  SECURITY_SCAN_CACHE_TTL,
  EMOJI,
  MESSAGES,
  URLS,
  FEATURES,
  SECOND,
  MINUTE,
  HOUR,
  DAY,
} from '../src/constants';

describe('Constants', () => {
  describe('Numeric Constants', () => {
    test('MAX_WALLETS_PER_USER should be positive', () => {
      expect(MAX_WALLETS_PER_USER).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_WALLETS_PER_USER)).toBe(true);
    });

    test('MAX_TOKENS_PER_WALLET should be positive', () => {
      expect(MAX_TOKENS_PER_WALLET).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_TOKENS_PER_WALLET)).toBe(true);
    });

    test('SECURITY_SCAN_CACHE_TTL should be 24 hours', () => {
      expect(SECURITY_SCAN_CACHE_TTL).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('Time Constants', () => {
    test('time constants should be correct', () => {
      expect(SECOND).toBe(1000);
      expect(MINUTE).toBe(60 * SECOND);
      expect(HOUR).toBe(60 * MINUTE);
      expect(DAY).toBe(24 * HOUR);
    });

    test('DAY should be 86400000 milliseconds', () => {
      expect(DAY).toBe(86400000);
    });
  });

  describe('EMOJI Object', () => {
    test('should have success emoji', () => {
      expect(EMOJI.SUCCESS).toBeDefined();
      expect(typeof EMOJI.SUCCESS).toBe('string');
    });

    test('should have error emoji', () => {
      expect(EMOJI.ERROR).toBeDefined();
    });

    test('should have wallet emoji', () => {
      expect(EMOJI.WALLET).toBeDefined();
    });

    test('should have all essential emojis', () => {
      const required = [
        'SUCCESS', 'ERROR', 'WARNING', 'INFO',
        'WALLET', 'BALANCE', 'TRANSACTION',
        'SHIELD', 'DANGER', 'ALERT'
      ];

      required.forEach(key => {
        expect(EMOJI[key as keyof typeof EMOJI]).toBeDefined();
      });
    });
  });

  describe('MESSAGES Object', () => {
    test('should have rate limit message', () => {
      expect(MESSAGES.RATE_LIMIT).toBeDefined();
      expect(MESSAGES.RATE_LIMIT).toContain('{seconds}');
    });

    test('should have wallet messages', () => {
      expect(MESSAGES.WALLET_ADDED).toBeDefined();
      expect(MESSAGES.WALLET_REMOVED).toBeDefined();
      expect(MESSAGES.WALLET_NOT_FOUND).toBeDefined();
    });

    test('should have error message', () => {
      expect(MESSAGES.ERROR_GENERIC).toBeDefined();
    });
  });

  describe('URLS Object', () => {
    test('should have explorer URL', () => {
      expect(URLS.EXPLORER).toBeDefined();
      expect(URLS.EXPLORER).toMatch(/^https?:\/\//);
    });

    test('should have RPC URL', () => {
      expect(URLS.RPC_DEFAULT).toBeDefined();
      expect(URLS.RPC_DEFAULT).toMatch(/^https?:\/\//);
    });
  });

  describe('FEATURES Object', () => {
    test('should have feature flags', () => {
      expect(typeof FEATURES.WEBSOCKET_ENABLED).toBe('boolean');
      expect(typeof FEATURES.SECURITY_SCANS_ENABLED).toBe('boolean');
      expect(typeof FEATURES.PORTFOLIO_TRACKING_ENABLED).toBe('boolean');
    });

    test('all features should be boolean', () => {
      Object.values(FEATURES).forEach(value => {
        expect(typeof value).toBe('boolean');
      });
    });
  });
});

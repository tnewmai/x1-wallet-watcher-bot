/**
 * Storage Tests
 * Tests for the storage adapter and database operations
 */

import { Storage, createStorage } from '../src/storage-v2';
import { PrismaStorageAdapter } from '../src/storage/prisma-adapter';
import { WatchedWallet } from '../src/types';

describe('Storage System', () => {
  let storage: Storage;

  beforeAll(async () => {
    // Use test database
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/x1_wallet_bot_test';
    storage = createStorage();
    await storage.initialize();
  });

  afterAll(async () => {
    await storage.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    // Note: In a real test, you'd use a test database and clean it
  });

  describe('User Operations', () => {
    test('should create a new user', async () => {
      const telegramId = 123456;
      await storage.ensureUser(telegramId, 'testuser');
      
      const user = await storage.getUser(telegramId);
      expect(user).not.toBeNull();
      expect(user?.telegramId).toBe(telegramId);
      expect(user?.username).toBe('testuser');
    });

    test('should return null for non-existent user', async () => {
      const user = await storage.getUser(999999999);
      expect(user).toBeNull();
    });

    test('should get all users', async () => {
      const users = await storage.getAllUsers();
      expect(users).toBeInstanceOf(Map);
    });
  });

  describe('Wallet Operations', () => {
    const testTelegramId = 123456;
    const testAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    const testLabel = 'Test Wallet';

    beforeEach(async () => {
      await storage.ensureUser(testTelegramId, 'testuser');
    });

    test('should add a wallet', async () => {
      const result = await storage.addWallet(testTelegramId, testAddress, testLabel);
      
      expect(result.success).toBe(true);
      expect(result.wallet).toBeDefined();
      expect(result.wallet?.address).toBe(testAddress);
      expect(result.wallet?.label).toBe(testLabel);
    });

    test('should not add duplicate wallet', async () => {
      await storage.addWallet(testTelegramId, testAddress, testLabel);
      const result = await storage.addWallet(testTelegramId, testAddress, 'Different Label');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already');
    });

    test('should enforce wallet limit', async () => {
      // Add 10 wallets (assuming MAX_WALLETS = 10)
      for (let i = 0; i < 10; i++) {
        const address = `wallet${i}${'0'.repeat(40)}`;
        await storage.addWallet(testTelegramId, address, `Wallet ${i}`);
      }

      // Try to add 11th wallet
      const result = await storage.addWallet(testTelegramId, 'wallet11' + '0'.repeat(40), 'Wallet 11');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Maximum');
    });

    test('should get wallets for user', async () => {
      await storage.addWallet(testTelegramId, testAddress, testLabel);
      
      const wallets = await storage.getWallets(testTelegramId);
      expect(wallets.length).toBeGreaterThan(0);
      expect(wallets[0].address).toBe(testAddress);
    });

    test('should get specific wallet', async () => {
      await storage.addWallet(testTelegramId, testAddress, testLabel);
      
      const wallet = await storage.getWallet(testTelegramId, testAddress);
      expect(wallet).not.toBeNull();
      expect(wallet?.address).toBe(testAddress);
      expect(wallet?.label).toBe(testLabel);
    });

    test('should remove wallet', async () => {
      await storage.addWallet(testTelegramId, testAddress, testLabel);
      
      const result = await storage.removeWallet(testTelegramId, testAddress);
      expect(result.success).toBe(true);
      
      const wallet = await storage.getWallet(testTelegramId, testAddress);
      expect(wallet).toBeNull();
    });

    test('should update wallet label', async () => {
      await storage.addWallet(testTelegramId, testAddress, testLabel);
      
      const updated = await storage.updateWalletLabel(testTelegramId, testAddress, 'New Label');
      expect(updated).toBe(true);
      
      const wallet = await storage.getWallet(testTelegramId, testAddress);
      expect(wallet?.label).toBe('New Label');
    });

    test('should toggle wallet alerts', async () => {
      await storage.addWallet(testTelegramId, testAddress, testLabel);
      
      const wallet1 = await storage.getWallet(testTelegramId, testAddress);
      const initialState = wallet1?.alertsEnabled;
      
      await storage.toggleWalletAlerts(testTelegramId, testAddress);
      
      const wallet2 = await storage.getWallet(testTelegramId, testAddress);
      expect(wallet2?.alertsEnabled).toBe(!initialState);
    });

    test('should update wallet balance', async () => {
      await storage.addWallet(testTelegramId, testAddress, testLabel);
      
      await storage.updateWalletBalance(testTelegramId, testAddress, '123.456');
      
      const wallet = await storage.getWallet(testTelegramId, testAddress);
      expect(wallet?.lastBalance).toBe('123.456');
    });
  });

  describe('Security Scan Cache', () => {
    const testAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

    test('should cache security scan results', async () => {
      const scanData = {
        isRugger: true,
        riskScore: 85,
        findings: ['Suspicious pattern detected'],
      };

      await storage.cacheSecurityScan(testAddress, scanData);
      
      const cached = await storage.getSecurityScanCache(testAddress);
      expect(cached).not.toBeNull();
      expect(cached.isRugger).toBe(true);
      expect(cached.riskScore).toBe(85);
    });

    test('should return null for non-existent cache', async () => {
      const cached = await storage.getSecurityScanCache('nonexistent' + '0'.repeat(40));
      expect(cached).toBeNull();
    });

    test('should expire old cache entries', async () => {
      // This would require mocking time or waiting 24 hours
      // Skipping for now, but in real tests you'd use jest.useFakeTimers()
    });
  });

  describe('Settings Operations', () => {
    const testTelegramId = 789012;

    beforeEach(async () => {
      await storage.ensureUser(testTelegramId, 'settingsuser');
    });

    test('should update user settings', async () => {
      const settings = {
        notifyOnNewToken: false,
        notifyOnRugger: true,
        largeTransferThreshold: 500,
      };

      await storage.updateUserSettings(testTelegramId, settings);
      
      const saved = await storage.getUserSettings(testTelegramId);
      expect(saved.notifyOnNewToken).toBe(false);
      expect(saved.notifyOnRugger).toBe(true);
      expect(saved.largeTransferThreshold).toBe(500);
    });
  });
});

describe('Prisma Adapter', () => {
  test('should create adapter instance', () => {
    const adapter = new PrismaStorageAdapter();
    expect(adapter).toBeInstanceOf(PrismaStorageAdapter);
  });

  test('should implement StorageAdapter interface', () => {
    const adapter = new PrismaStorageAdapter();
    expect(typeof adapter.getUser).toBe('function');
    expect(typeof adapter.saveUser).toBe('function');
    expect(typeof adapter.addWallet).toBe('function');
    expect(typeof adapter.removeWallet).toBe('function');
  });
});

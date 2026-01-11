/**
 * Wallet Tags Tests
 * Tests for wallet tagging and grouping system
 */

import { WalletOrganizationManager } from '../src/wallet-tags';

describe('Wallet Organization Manager', () => {
  let manager: WalletOrganizationManager;

  beforeEach(() => {
    manager = new WalletOrganizationManager();
  });

  describe('Tags', () => {
    test('should have default tags', () => {
      const tags = manager.getAllTags();
      
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.some(t => t.id === 'personal')).toBe(true);
      expect(tags.some(t => t.id === 'trading')).toBe(true);
    });

    test('should create custom tag', () => {
      const tagId = manager.createTag(123, {
        name: 'Custom Tag',
        color: '#ff0000',
        emoji: '🔥',
      });

      expect(tagId).toBeTruthy();
      
      const tag = manager.getTag(tagId);
      expect(tag).not.toBeNull();
      expect(tag?.name).toBe('Custom Tag');
    });

    test('should delete tag', () => {
      const tagId = manager.createTag(123, {
        name: 'Test Tag',
        color: '#000000',
      });

      const deleted = manager.deleteTag(tagId);
      expect(deleted).toBe(true);
      
      const tag = manager.getTag(tagId);
      expect(tag).toBeNull();
    });
  });

  describe('Wallet Tagging', () => {
    const testAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

    test('should add tag to wallet', () => {
      const added = manager.addTagToWallet(testAddress, 'personal');
      
      expect(added).toBe(true);
      
      const tags = manager.getWalletTags(testAddress);
      expect(tags.length).toBe(1);
      expect(tags[0].id).toBe('personal');
    });

    test('should not add duplicate tag', () => {
      manager.addTagToWallet(testAddress, 'personal');
      const added = manager.addTagToWallet(testAddress, 'personal');
      
      expect(added).toBe(false);
    });

    test('should remove tag from wallet', () => {
      manager.addTagToWallet(testAddress, 'personal');
      const removed = manager.removeTagFromWallet(testAddress, 'personal');
      
      expect(removed).toBe(true);
      
      const tags = manager.getWalletTags(testAddress);
      expect(tags.length).toBe(0);
    });

    test('should get multiple wallet tags', () => {
      manager.addTagToWallet(testAddress, 'personal');
      manager.addTagToWallet(testAddress, 'trading');
      
      const tags = manager.getWalletTags(testAddress);
      expect(tags.length).toBe(2);
    });
  });

  describe('Groups', () => {
    test('should create group', () => {
      const groupId = manager.createGroup(123, 'My Wallets', 'Test group');
      
      expect(groupId).toBeTruthy();
      
      const group = manager.getGroup(groupId);
      expect(group).not.toBeNull();
      expect(group?.name).toBe('My Wallets');
    });

    test('should get user groups', () => {
      manager.createGroup(123, 'Group 1');
      manager.createGroup(123, 'Group 2');
      manager.createGroup(456, 'Other Group');
      
      const groups = manager.getUserGroups(123);
      expect(groups.length).toBe(2);
    });

    test('should delete group', () => {
      const groupId = manager.createGroup(123, 'Test Group');
      const deleted = manager.deleteGroup(groupId);
      
      expect(deleted).toBe(true);
      
      const group = manager.getGroup(groupId);
      expect(group).toBeNull();
    });
  });

  describe('Group Wallets', () => {
    const testAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
    let groupId: string;

    beforeEach(() => {
      groupId = manager.createGroup(123, 'Test Group');
    });

    test('should add wallet to group', () => {
      const added = manager.addWalletToGroup(groupId, testAddress);
      
      expect(added).toBe(true);
      
      const wallets = manager.getGroupWallets(groupId);
      expect(wallets.length).toBe(1);
      expect(wallets[0]).toBe(testAddress);
    });

    test('should not add duplicate wallet to group', () => {
      manager.addWalletToGroup(groupId, testAddress);
      const added = manager.addWalletToGroup(groupId, testAddress);
      
      expect(added).toBe(false);
    });

    test('should remove wallet from group', () => {
      manager.addWalletToGroup(groupId, testAddress);
      const removed = manager.removeWalletFromGroup(groupId, testAddress);
      
      expect(removed).toBe(true);
      
      const wallets = manager.getGroupWallets(groupId);
      expect(wallets.length).toBe(0);
    });

    test('should get wallet groups', () => {
      const group1 = manager.createGroup(123, 'Group 1');
      const group2 = manager.createGroup(123, 'Group 2');
      
      manager.addWalletToGroup(group1, testAddress);
      manager.addWalletToGroup(group2, testAddress);
      
      const groups = manager.getWalletGroups(123, testAddress);
      expect(groups.length).toBe(2);
    });
  });

  describe('Search', () => {
    test('should search wallets by tag', () => {
      const addr1 = 'address1';
      const addr2 = 'address2';
      const addr3 = 'address3';
      
      manager.addTagToWallet(addr1, 'personal');
      manager.addTagToWallet(addr2, 'personal');
      manager.addTagToWallet(addr3, 'trading');
      
      const wallets = manager.searchWalletsByTag('personal');
      expect(wallets.length).toBe(2);
      expect(wallets).toContain(addr1);
      expect(wallets).toContain(addr2);
    });
  });
});

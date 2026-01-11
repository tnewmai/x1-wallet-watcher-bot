/**
 * Wallet Tagging and Grouping System
 * Organize wallets with tags and groups
 */

import logger from './logger';

export interface WalletTag {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  description?: string;
}

export interface WalletGroup {
  id: string;
  name: string;
  description?: string;
  walletAddresses: string[];
  tags: string[];
  createdAt: number;
}

/**
 * Wallet Organization Manager
 */
export class WalletOrganizationManager {
  private tags: Map<string, WalletTag>;
  private groups: Map<string, WalletGroup>;
  private walletTags: Map<string, string[]>; // walletAddress -> tagIds[]

  constructor() {
    this.tags = new Map();
    this.groups = new Map();
    this.walletTags = new Map();
    
    // Initialize default tags
    this.initializeDefaultTags();
  }

  /**
   * Initialize default tags
   */
  private initializeDefaultTags(): void {
    const defaultTags: WalletTag[] = [
      { id: 'personal', name: 'Personal', color: '#3498db', emoji: '👤' },
      { id: 'trading', name: 'Trading', color: '#e74c3c', emoji: '📈' },
      { id: 'savings', name: 'Savings', color: '#2ecc71', emoji: '💰' },
      { id: 'business', name: 'Business', color: '#f39c12', emoji: '💼' },
      { id: 'monitoring', name: 'Monitoring', color: '#9b59b6', emoji: '🔍' },
      { id: 'suspicious', name: 'Suspicious', color: '#e67e22', emoji: '⚠️' },
      { id: 'vip', name: 'VIP', color: '#f1c40f', emoji: '⭐' },
    ];

    defaultTags.forEach(tag => this.tags.set(tag.id, tag));
  }

  /**
   * Create custom tag
   */
  createTag(userId: number, tag: Omit<WalletTag, 'id'>): string {
    const tagId = `${userId}_${Date.now()}`;
    const fullTag: WalletTag = { id: tagId, ...tag };
    
    this.tags.set(tagId, fullTag);
    logger.info(`Created tag ${tagId} for user ${userId}`);
    
    return tagId;
  }

  /**
   * Get all tags
   */
  getAllTags(): WalletTag[] {
    return Array.from(this.tags.values());
  }

  /**
   * Get tag by ID
   */
  getTag(tagId: string): WalletTag | null {
    return this.tags.get(tagId) || null;
  }

  /**
   * Delete tag
   */
  deleteTag(tagId: string): boolean {
    // Remove tag from all wallets
    for (const [address, tags] of this.walletTags) {
      const filtered = tags.filter(t => t !== tagId);
      if (filtered.length !== tags.length) {
        this.walletTags.set(address, filtered);
      }
    }
    
    const deleted = this.tags.delete(tagId);
    if (deleted) {
      logger.info(`Deleted tag ${tagId}`);
    }
    return deleted;
  }

  /**
   * Add tag to wallet
   */
  addTagToWallet(walletAddress: string, tagId: string): boolean {
    if (!this.tags.has(tagId)) {
      logger.warn(`Tag ${tagId} does not exist`);
      return false;
    }

    const existingTags = this.walletTags.get(walletAddress) || [];
    
    if (existingTags.includes(tagId)) {
      return false; // Already tagged
    }

    this.walletTags.set(walletAddress, [...existingTags, tagId]);
    logger.info(`Added tag ${tagId} to wallet ${walletAddress.slice(0, 8)}...`);
    
    return true;
  }

  /**
   * Remove tag from wallet
   */
  removeTagFromWallet(walletAddress: string, tagId: string): boolean {
    const existingTags = this.walletTags.get(walletAddress);
    if (!existingTags) return false;

    const filtered = existingTags.filter(t => t !== tagId);
    
    if (filtered.length === existingTags.length) {
      return false; // Tag wasn't present
    }

    if (filtered.length === 0) {
      this.walletTags.delete(walletAddress);
    } else {
      this.walletTags.set(walletAddress, filtered);
    }

    logger.info(`Removed tag ${tagId} from wallet ${walletAddress.slice(0, 8)}...`);
    return true;
  }

  /**
   * Get wallet tags
   */
  getWalletTags(walletAddress: string): WalletTag[] {
    const tagIds = this.walletTags.get(walletAddress) || [];
    return tagIds.map(id => this.tags.get(id)).filter(tag => tag !== undefined) as WalletTag[];
  }

  /**
   * Create group
   */
  createGroup(userId: number, name: string, description?: string): string {
    const groupId = `${userId}_${Date.now()}`;
    
    const group: WalletGroup = {
      id: groupId,
      name,
      description,
      walletAddresses: [],
      tags: [],
      createdAt: Date.now(),
    };

    this.groups.set(groupId, group);
    logger.info(`Created group ${groupId} for user ${userId}`);
    
    return groupId;
  }

  /**
   * Get all groups for user
   */
  getUserGroups(userId: number): WalletGroup[] {
    return Array.from(this.groups.values())
      .filter(group => group.id.startsWith(`${userId}_`));
  }

  /**
   * Get group by ID
   */
  getGroup(groupId: string): WalletGroup | null {
    return this.groups.get(groupId) || null;
  }

  /**
   * Update group
   */
  updateGroup(groupId: string, updates: Partial<WalletGroup>): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    Object.assign(group, updates);
    logger.info(`Updated group ${groupId}`);
    
    return true;
  }

  /**
   * Delete group
   */
  deleteGroup(groupId: string): boolean {
    const deleted = this.groups.delete(groupId);
    if (deleted) {
      logger.info(`Deleted group ${groupId}`);
    }
    return deleted;
  }

  /**
   * Add wallet to group
   */
  addWalletToGroup(groupId: string, walletAddress: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    if (group.walletAddresses.includes(walletAddress)) {
      return false; // Already in group
    }

    group.walletAddresses.push(walletAddress);
    logger.info(`Added wallet ${walletAddress.slice(0, 8)}... to group ${groupId}`);
    
    return true;
  }

  /**
   * Remove wallet from group
   */
  removeWalletFromGroup(groupId: string, walletAddress: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const index = group.walletAddresses.indexOf(walletAddress);
    if (index === -1) return false;

    group.walletAddresses.splice(index, 1);
    logger.info(`Removed wallet ${walletAddress.slice(0, 8)}... from group ${groupId}`);
    
    return true;
  }

  /**
   * Get wallets in group
   */
  getGroupWallets(groupId: string): string[] {
    const group = this.groups.get(groupId);
    return group ? group.walletAddresses : [];
  }

  /**
   * Find groups containing wallet
   */
  getWalletGroups(userId: number, walletAddress: string): WalletGroup[] {
    return this.getUserGroups(userId)
      .filter(group => group.walletAddresses.includes(walletAddress));
  }

  /**
   * Search wallets by tag
   */
  searchWalletsByTag(tagId: string): string[] {
    const wallets: string[] = [];
    
    for (const [address, tags] of this.walletTags) {
      if (tags.includes(tagId)) {
        wallets.push(address);
      }
    }

    return wallets;
  }

  /**
   * Get wallet organization summary
   */
  getOrganizationSummary(userId: number): string {
    const groups = this.getUserGroups(userId);
    const totalWallets = new Set<string>();
    
    groups.forEach(group => {
      group.walletAddresses.forEach(addr => totalWallets.add(addr));
    });

    let summary = `📁 Wallet Organization\n\n`;
    summary += `Groups: ${groups.length}\n`;
    summary += `Organized Wallets: ${totalWallets.size}\n`;
    summary += `Total Tags: ${this.tags.size}\n`;

    return summary;
  }
}

// Singleton instance
let organizationInstance: WalletOrganizationManager | null = null;

/**
 * Get wallet organization manager instance
 */
export function getWalletOrganization(): WalletOrganizationManager {
  if (!organizationInstance) {
    organizationInstance = new WalletOrganizationManager();
  }
  return organizationInstance;
}

export default getWalletOrganization;

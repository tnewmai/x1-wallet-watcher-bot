// Cloudflare KV Storage Layer
// Replaces the file-based storage with KV storage

import { Env, UserData, WalletData, KV_KEYS, UserSettings } from './types';

export class CloudflareStorage {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  // User operations
  async getUser(userId: number): Promise<UserData | null> {
    const data = await this.kv.get(KV_KEYS.USER(userId), 'json');
    return data as UserData | null;
  }

  async saveUser(userData: UserData): Promise<void> {
    await this.kv.put(KV_KEYS.USER(userData.userId), JSON.stringify(userData));
  }

  async createUser(userId: number, username?: string, firstName?: string): Promise<UserData> {
    const userData: UserData = {
      userId,
      username,
      firstName,
      wallets: [],
      settings: {
        notifyIncoming: true,
        notifyOutgoing: true,
        notifyBalance: true,
        notifyTokens: true,
        minValueFilter: 0,
      },
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    await this.saveUser(userData);
    return userData;
  }

  async getUserOrCreate(userId: number, username?: string, firstName?: string): Promise<UserData> {
    let user = await this.getUser(userId);
    if (!user) {
      user = await this.createUser(userId, username, firstName);
    } else {
      // Update last active
      user.lastActive = Date.now();
      await this.saveUser(user);
    }
    return user;
  }

  async updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.settings = { ...user.settings, ...settings };
      await this.saveUser(user);
    }
  }

  // Wallet operations
  async getWallet(address: string): Promise<WalletData | null> {
    const data = await this.kv.get(KV_KEYS.WALLET(address), 'json');
    return data as WalletData | null;
  }

  async saveWallet(walletData: WalletData): Promise<void> {
    await this.kv.put(KV_KEYS.WALLET(walletData.address), JSON.stringify(walletData));
    
    // Update all wallets list
    await this.addToAllWallets(walletData.address);
  }

  async addWallet(
    userId: number,
    address: string,
    label: string,
    initialBalance: number
  ): Promise<WalletData> {
    // Check if wallet already exists
    let wallet = await this.getWallet(address);
    
    if (!wallet) {
      wallet = {
        address,
        label,
        userId,
        lastBalance: initialBalance,
        addedAt: Date.now(),
        tokens: [],
      };
      await this.saveWallet(wallet);
    }

    // Add to user's wallet list
    const user = await this.getUser(userId);
    if (user && !user.wallets.includes(address)) {
      user.wallets.push(address);
      await this.saveUser(user);
    }

    return wallet;
  }

  async removeWallet(userId: number, address: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    const index = user.wallets.indexOf(address);
    if (index === -1) return false;

    user.wallets.splice(index, 1);
    await this.saveUser(user);

    // Check if any other user is watching this wallet
    const stillWatched = await this.isWalletWatchedByOthers(address, userId);
    
    if (!stillWatched) {
      // Remove wallet data
      await this.kv.delete(KV_KEYS.WALLET(address));
      await this.removeFromAllWallets(address);
    }

    return true;
  }

  async getUserWallets(userId: number): Promise<WalletData[]> {
    const user = await this.getUser(userId);
    if (!user || user.wallets.length === 0) return [];

    const wallets: WalletData[] = [];
    for (const address of user.wallets) {
      const wallet = await this.getWallet(address);
      if (wallet) {
        wallets.push(wallet);
      }
    }
    return wallets;
  }

  async getAllWallets(): Promise<string[]> {
    const data = await this.kv.get(KV_KEYS.ALL_WALLETS, 'json');
    return (data as string[]) || [];
  }

  private async addToAllWallets(address: string): Promise<void> {
    const wallets = await this.getAllWallets();
    if (!wallets.includes(address)) {
      wallets.push(address);
      await this.kv.put(KV_KEYS.ALL_WALLETS, JSON.stringify(wallets));
    }
  }

  private async removeFromAllWallets(address: string): Promise<void> {
    const wallets = await this.getAllWallets();
    const filtered = wallets.filter(w => w !== address);
    await this.kv.put(KV_KEYS.ALL_WALLETS, JSON.stringify(filtered));
  }

  private async isWalletWatchedByOthers(address: string, excludeUserId: number): Promise<boolean> {
    // This is inefficient for large scale, but works for now
    // In production, maintain a reverse index: wallet -> [userIds]
    const wallet = await this.getWallet(address);
    if (!wallet) return false;

    // For now, we'll just check if the wallet belongs to the excluded user
    // In a better implementation, track all users watching each wallet
    return wallet.userId !== excludeUserId;
  }

  // Token operations
  async addTokenToWallet(
    address: string,
    mint: string,
    symbol: string,
    name: string,
    decimals: number,
    initialBalance: number
  ): Promise<void> {
    const wallet = await this.getWallet(address);
    if (!wallet) return;

    const existingToken = wallet.tokens.find(t => t.mint === mint);
    if (!existingToken) {
      wallet.tokens.push({
        mint,
        symbol,
        name,
        decimals,
        lastBalance: initialBalance,
      });
      await this.saveWallet(wallet);
    }
  }

  async updateWalletBalance(address: string, newBalance: number): Promise<void> {
    const wallet = await this.getWallet(address);
    if (wallet) {
      wallet.lastBalance = newBalance;
      await this.saveWallet(wallet);
    }
  }

  async updateWalletSignature(address: string, signature: string): Promise<void> {
    const wallet = await this.getWallet(address);
    if (wallet) {
      wallet.lastSignature = signature;
      await this.saveWallet(wallet);
    }
  }

  async updateTokenBalance(address: string, mint: string, newBalance: number): Promise<void> {
    const wallet = await this.getWallet(address);
    if (wallet) {
      const token = wallet.tokens.find(t => t.mint === mint);
      if (token) {
        token.lastBalance = newBalance;
        await this.saveWallet(wallet);
      }
    }
  }

  // Watcher state
  async getWatcherState() {
    const data = await this.kv.get(KV_KEYS.WATCHER_STATE, 'json');
    return data || { lastCheck: 0, walletsChecked: 0, errors: 0 };
  }

  async updateWatcherState(state: any) {
    await this.kv.put(KV_KEYS.WATCHER_STATE, JSON.stringify(state));
  }

  // Utility: Get total stats
  async getStats() {
    const allWallets = await this.getAllWallets();
    // Note: Getting all users is expensive in KV
    // For production, maintain a counter
    return {
      totalWallets: allWallets.length,
      // totalUsers: await this.countUsers(), // Implement if needed
    };
  }
}

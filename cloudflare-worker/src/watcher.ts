// Wallet Watcher for Cloudflare Workers
// Uses Cron Triggers to check wallets periodically

import { Bot } from 'grammy';
import { CloudflareStorage } from './storage';
import { X1Blockchain } from './blockchain';
import { Env, WalletData } from './types';

export class WalletWatcher {
  private storage: CloudflareStorage;
  private blockchain: X1Blockchain;
  private bot: Bot;

  constructor(storage: CloudflareStorage, blockchain: X1Blockchain, bot: Bot) {
    this.storage = storage;
    this.blockchain = blockchain;
    this.bot = bot;
  }

  /**
   * Main function called by Cron Trigger
   * Checks all wallets for new transactions and balance changes
   */
  async checkAllWallets(): Promise<void> {
    console.log('🔍 Starting wallet check cycle...');
    
    try {
      const allWallets = await this.storage.getAllWallets();
      console.log(`Checking ${allWallets.length} wallets...`);

      const checkPromises = allWallets.map(address => 
        this.checkWallet(address).catch(error => {
          console.error(`Error checking wallet ${address}:`, error);
          return null;
        })
      );

      await Promise.all(checkPromises);

      // Update watcher state
      await this.storage.updateWatcherState({
        lastCheck: Date.now(),
        walletsChecked: allWallets.length,
        errors: 0,
      });

      console.log('✅ Wallet check cycle completed');
    } catch (error) {
      console.error('Error in checkAllWallets:', error);
      throw error;
    }
  }

  /**
   * Check a single wallet for changes
   */
  private async checkWallet(address: string): Promise<void> {
    try {
      const walletData = await this.storage.getWallet(address);
      if (!walletData) {
        console.log(`Wallet ${address} not found in storage`);
        return;
      }

      // Get user settings
      const user = await this.storage.getUser(walletData.userId);
      if (!user) {
        console.log(`User ${walletData.userId} not found for wallet ${address}`);
        return;
      }

      // Check for new transactions
      if (user.settings.notifyIncoming || user.settings.notifyOutgoing) {
        await this.checkTransactions(walletData, user.settings);
      }

      // Check balance changes
      if (user.settings.notifyBalance) {
        await this.checkBalanceChange(walletData);
      }

      // Check token balances
      if (user.settings.notifyTokens && walletData.tokens.length > 0) {
        await this.checkTokenBalances(walletData);
      }
    } catch (error) {
      console.error(`Error checking wallet ${address}:`, error);
      throw error;
    }
  }

  /**
   * Check for new transactions
   */
  private async checkTransactions(walletData: WalletData, settings: any): Promise<void> {
    try {
      const newTxs = await this.blockchain.getNewTransactionsSince(
        walletData.address,
        walletData.lastSignature
      );

      if (newTxs.length === 0) return;

      console.log(`Found ${newTxs.length} new transactions for ${walletData.address}`);

      // Update last signature
      if (newTxs.length > 0) {
        await this.storage.updateWalletSignature(walletData.address, newTxs[0].signature);
      }

      // Process each transaction
      for (const tx of newTxs.reverse()) {
        const analysis = this.blockchain.analyzeTransaction(tx.transaction, walletData.address);
        
        // Apply min value filter
        if (analysis.amount < settings.minValueFilter) {
          continue;
        }

        // Send notification based on type
        if (analysis.type === 'incoming' && settings.notifyIncoming) {
          await this.sendIncomingNotification(walletData, tx, analysis);
        } else if (analysis.type === 'outgoing' && settings.notifyOutgoing) {
          await this.sendOutgoingNotification(walletData, tx, analysis);
        }
      }
    } catch (error) {
      console.error('Error checking transactions:', error);
      throw error;
    }
  }

  /**
   * Check for balance changes
   */
  private async checkBalanceChange(walletData: WalletData): Promise<void> {
    try {
      const currentBalance = await this.blockchain.getBalance(walletData.address);
      const previousBalance = walletData.lastBalance;

      if (Math.abs(currentBalance - previousBalance) > 0.000001) {
        // Balance changed
        await this.storage.updateWalletBalance(walletData.address, currentBalance);
        
        const change = currentBalance - previousBalance;
        await this.sendBalanceChangeNotification(walletData, previousBalance, currentBalance, change);
      }
    } catch (error) {
      console.error('Error checking balance:', error);
      throw error;
    }
  }

  /**
   * Check token balances
   */
  private async checkTokenBalances(walletData: WalletData): Promise<void> {
    try {
      for (const token of walletData.tokens) {
        const currentBalance = await this.blockchain.getTokenBalance(
          walletData.address,
          token.mint
        );
        
        const previousBalance = token.lastBalance;
        
        if (Math.abs(currentBalance - previousBalance) > 0.000001) {
          // Token balance changed
          await this.storage.updateTokenBalance(
            walletData.address,
            token.mint,
            currentBalance
          );
          
          const change = currentBalance - previousBalance;
          await this.sendTokenBalanceNotification(
            walletData,
            token,
            previousBalance,
            currentBalance,
            change
          );
        }
      }
    } catch (error) {
      console.error('Error checking token balances:', error);
      throw error;
    }
  }

  /**
   * Send incoming transaction notification
   */
  private async sendIncomingNotification(
    walletData: WalletData,
    tx: any,
    analysis: any
  ): Promise<void> {
    const explorerUrl = `https://explorer.x1-mainnet.infrafc.org/tx/${tx.signature}`;
    const timestamp = new Date(tx.timestamp * 1000).toUTCString();

    const message =
      `🟢 📥 *INCOMING Transaction*\n\n` +
      `📍 Wallet: "${walletData.label}"\n` +
      `💰 Value: ${analysis.amount.toFixed(6)} XN\n` +
      `📦 Slot: ${tx.slot}\n` +
      `⏰ Time: ${timestamp}\n\n` +
      `${analysis.from ? `From: \`${analysis.from}\`\n\n` : ''}` +
      `[🔗 View Transaction](${explorerUrl})`;

    try {
      await this.bot.api.sendMessage(walletData.userId, message, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Send outgoing transaction notification
   */
  private async sendOutgoingNotification(
    walletData: WalletData,
    tx: any,
    analysis: any
  ): Promise<void> {
    const explorerUrl = `https://explorer.x1-mainnet.infrafc.org/tx/${tx.signature}`;
    const timestamp = new Date(tx.timestamp * 1000).toUTCString();

    const message =
      `🔴 📤 *OUTGOING Transaction*\n\n` +
      `📍 Wallet: "${walletData.label}"\n` +
      `💸 Value: ${analysis.amount.toFixed(6)} XN\n` +
      `📦 Slot: ${tx.slot}\n` +
      `⏰ Time: ${timestamp}\n\n` +
      `${analysis.to ? `To: \`${analysis.to}\`\n\n` : ''}` +
      `[🔗 View Transaction](${explorerUrl})`;

    try {
      await this.bot.api.sendMessage(walletData.userId, message, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Send balance change notification
   */
  private async sendBalanceChangeNotification(
    walletData: WalletData,
    oldBalance: number,
    newBalance: number,
    change: number
  ): Promise<void> {
    const emoji = change > 0 ? '📈' : '📉';
    const changeEmoji = change > 0 ? '🟢' : '🔴';
    const changeSign = change > 0 ? '+' : '';

    const message =
      `${emoji} *Balance Change Detected*\n\n` +
      `📍 Wallet: "${walletData.label}"\n` +
      `💰 Old Balance: ${oldBalance.toFixed(6)} XN\n` +
      `💰 New Balance: ${newBalance.toFixed(6)} XN\n` +
      `${changeEmoji} Change: ${changeSign}${change.toFixed(6)} XN`;

    try {
      await this.bot.api.sendMessage(walletData.userId, message, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Send token balance change notification
   */
  private async sendTokenBalanceNotification(
    walletData: WalletData,
    token: any,
    oldBalance: number,
    newBalance: number,
    change: number
  ): Promise<void> {
    const emoji = change > 0 ? '📈' : '📉';
    const changeSign = change > 0 ? '+' : '';

    const message =
      `${emoji} *Token Balance Change*\n\n` +
      `📍 Wallet: "${walletData.label}"\n` +
      `🔷 Token: ${token.symbol || token.name || 'Unknown'}\n` +
      `💰 Old Balance: ${oldBalance.toFixed(6)}\n` +
      `💰 New Balance: ${newBalance.toFixed(6)}\n` +
      `Change: ${changeSign}${change.toFixed(6)}\n\n` +
      `Mint: \`${token.mint}\``;

    try {
      await this.bot.api.sendMessage(walletData.userId, message, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
}

// X1 Blockchain interactions for Cloudflare Workers
// Adapted from the original blockchain.ts

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

export class X1Blockchain {
  private connection: Connection;
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  getRpcUrl(): string {
    return this.rpcUrl;
  }

  async getBalance(address: string): Promise<number> {
    try {
      const pubKey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  async getRecentTransactions(address: string, limit: number = 10) {
    try {
      const pubKey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(pubKey, { limit });
      
      const transactions = [];
      for (const sig of signatures) {
        const tx = await this.connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (tx) {
          transactions.push({
            signature: sig.signature,
            slot: sig.slot,
            timestamp: sig.blockTime || 0,
            transaction: tx,
          });
        }
      }
      
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  async getLatestSignature(address: string): Promise<string | null> {
    try {
      const pubKey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(pubKey, { limit: 1 });
      return signatures.length > 0 ? signatures[0].signature : null;
    } catch (error) {
      console.error('Error fetching latest signature:', error);
      return null;
    }
  }

  async getNewTransactionsSince(address: string, lastSignature?: string) {
    try {
      const pubKey = new PublicKey(address);
      const options: any = { limit: 100 };
      
      if (lastSignature) {
        options.until = lastSignature;
      }
      
      const signatures = await this.connection.getSignaturesForAddress(pubKey, options);
      
      // Filter out the last known signature if present
      const newSignatures = lastSignature 
        ? signatures.filter(s => s.signature !== lastSignature)
        : signatures;
      
      const transactions = [];
      for (const sig of newSignatures) {
        const tx = await this.connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (tx) {
          transactions.push({
            signature: sig.signature,
            slot: sig.slot,
            timestamp: sig.blockTime || 0,
            transaction: tx,
          });
        }
      }
      
      return transactions;
    } catch (error) {
      console.error('Error fetching new transactions:', error);
      return [];
    }
  }

  async getTokenAccounts(walletAddress: string) {
    try {
      const pubKey = new PublicKey(walletAddress);
      
      // Get SPL token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(pubKey, {
        programId: TOKEN_PROGRAM_ID,
      });
      
      // Get Token-2022 accounts
      const token2022Accounts = await this.connection.getParsedTokenAccountsByOwner(pubKey, {
        programId: TOKEN_2022_PROGRAM_ID,
      });
      
      const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];
      
      return allAccounts.map(account => ({
        mint: account.account.data.parsed.info.mint,
        balance: account.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: account.account.data.parsed.info.tokenAmount.decimals,
      }));
    } catch (error) {
      console.error('Error fetching token accounts:', error);
      return [];
    }
  }

  async getTokenBalance(walletAddress: string, tokenMint: string): Promise<number> {
    try {
      const accounts = await this.getTokenAccounts(walletAddress);
      const account = accounts.find(acc => acc.mint === tokenMint);
      return account ? account.balance : 0;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return 0;
    }
  }

  analyzeTransaction(tx: any, walletAddress: string) {
    try {
      const pubKey = new PublicKey(walletAddress);
      const preBalances = tx.meta?.preBalances || [];
      const postBalances = tx.meta?.postBalances || [];
      const accountKeys = tx.transaction.message.accountKeys || [];
      
      // Find wallet's position in accountKeys
      let walletIndex = -1;
      for (let i = 0; i < accountKeys.length; i++) {
        const key = accountKeys[i];
        const keyPubkey = typeof key === 'string' ? new PublicKey(key) : key.pubkey;
        if (keyPubkey.equals(pubKey)) {
          walletIndex = i;
          break;
        }
      }
      
      if (walletIndex === -1) {
        return { type: 'unknown', amount: 0, from: null, to: null };
      }
      
      const preBalance = preBalances[walletIndex] || 0;
      const postBalance = postBalances[walletIndex] || 0;
      const balanceChange = (postBalance - preBalance) / LAMPORTS_PER_SOL;
      
      if (balanceChange > 0) {
        return {
          type: 'incoming',
          amount: Math.abs(balanceChange),
          from: this.findSender(accountKeys, preBalances, postBalances, walletIndex),
          to: walletAddress,
        };
      } else if (balanceChange < 0) {
        return {
          type: 'outgoing',
          amount: Math.abs(balanceChange),
          from: walletAddress,
          to: this.findRecipient(accountKeys, preBalances, postBalances, walletIndex),
        };
      }
      
      return { type: 'no-change', amount: 0, from: null, to: null };
    } catch (error) {
      console.error('Error analyzing transaction:', error);
      return { type: 'error', amount: 0, from: null, to: null };
    }
  }

  private findSender(accountKeys: any[], preBalances: number[], postBalances: number[], excludeIndex: number): string | null {
    for (let i = 0; i < accountKeys.length; i++) {
      if (i === excludeIndex) continue;
      const balanceChange = postBalances[i] - preBalances[i];
      if (balanceChange < 0) {
        const key = accountKeys[i];
        return typeof key === 'string' ? key : key.pubkey.toString();
      }
    }
    return null;
  }

  private findRecipient(accountKeys: any[], preBalances: number[], postBalances: number[], excludeIndex: number): string | null {
    for (let i = 0; i < accountKeys.length; i++) {
      if (i === excludeIndex) continue;
      const balanceChange = postBalances[i] - preBalances[i];
      if (balanceChange > 0) {
        const key = accountKeys[i];
        return typeof key === 'string' ? key : key.pubkey.toString();
      }
    }
    return null;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      return !!version;
    } catch (error) {
      return false;
    }
  }
}

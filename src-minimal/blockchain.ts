/**
 * Lightweight Blockchain Module (X1/SVM)
 * Simplified from 900 lines → 200 lines
 */
import { Connection, PublicKey, ParsedTransactionWithMeta, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config, LAMPORTS_PER_XN } from './config';
import { Transaction } from './types';
import { createLogger } from './logger';

const logger = createLogger('Blockchain');

let connection: Connection;

export function initBlockchain(): Connection {
  connection = new Connection(config.x1RpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
  
  logger.info('Blockchain connection initialized', { rpcUrl: config.x1RpcUrl });
  return connection;
}

export function getConnection(): Connection {
  if (!connection) {
    return initBlockchain();
  }
  return connection;
}

/**
 * Get wallet balance in XN (lamports / 1e9)
 */
export async function getBalance(address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_XN;
  } catch (error) {
    logger.error(`Failed to get balance for ${address}`, error);
    throw error;
  }
}

/**
 * Get recent transactions for an address
 */
export async function getRecentTransactions(
  address: string,
  limit: number = 10,
  beforeSignature?: string
): Promise<Transaction[]> {
  try {
    const pubkey = new PublicKey(address);
    
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit,
      before: beforeSignature,
    });
    
    if (signatures.length === 0) {
      return [];
    }
    
    // Get parsed transactions
    const txs = await connection.getParsedTransactions(
      signatures.map(sig => sig.signature),
      { maxSupportedTransactionVersion: 0 }
    );
    
    const transactions: Transaction[] = [];
    
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const sig = signatures[i];
      
      if (!tx || !tx.meta) continue;
      
      const transaction = parseTransaction(address, sig.signature, tx);
      if (transaction) {
        transactions.push(transaction);
      }
    }
    
    return transactions;
  } catch (error) {
    logger.error(`Failed to get transactions for ${address}`, error);
    return [];
  }
}

/**
 * Parse transaction to determine type and amount
 */
function parseTransaction(
  walletAddress: string,
  signature: string,
  tx: ParsedTransactionWithMeta
): Transaction | null {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    
    // Get pre and post balances
    const accountIndex = tx.transaction.message.accountKeys.findIndex(
      key => key.pubkey.equals(walletPubkey)
    );
    
    if (accountIndex === -1) {
      return null;
    }
    
    const preBalance = tx.meta?.preBalances[accountIndex] || 0;
    const postBalance = tx.meta?.postBalances[accountIndex] || 0;
    const balanceChange = postBalance - preBalance;
    
    // Determine transaction type
    let type: 'incoming' | 'outgoing' | 'unknown' = 'unknown';
    let from: string | undefined;
    let to: string | undefined;
    
    if (balanceChange > 0) {
      type = 'incoming';
      // Try to find sender
      const instructions = tx.transaction.message.instructions;
      if (instructions.length > 0) {
        const firstInstruction = instructions[0];
        if ('parsed' in firstInstruction && firstInstruction.parsed?.type === 'transfer') {
          from = firstInstruction.parsed.info?.source;
        }
      }
    } else if (balanceChange < 0) {
      type = 'outgoing';
      // Try to find recipient
      const instructions = tx.transaction.message.instructions;
      if (instructions.length > 0) {
        const firstInstruction = instructions[0];
        if ('parsed' in firstInstruction && firstInstruction.parsed?.type === 'transfer') {
          to = firstInstruction.parsed.info?.destination;
        }
      }
    }
    
    return {
      signature,
      blockTime: tx.blockTime || Date.now() / 1000,
      type,
      amount: Math.abs(balanceChange) / LAMPORTS_PER_XN,
      from,
      to,
    };
  } catch (error) {
    logger.error('Failed to parse transaction', error);
    return null;
  }
}

/**
 * Check if address is valid
 */
export function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format address (truncate middle)
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format XN amount
 */
export function formatXN(amount: number): string {
  return `${amount.toFixed(6)} XN`;
}

/**
 * Get transaction explorer URL
 */
export function getTxUrl(signature: string): string {
  return `${config.explorerUrl}/tx/${signature}`;
}

/**
 * Get wallet explorer URL
 */
export function getWalletUrl(address: string): string {
  return `${config.explorerUrl}/address/${address}`;
}

/**
 * Test RPC connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const version = await connection.getVersion();
    logger.info('RPC connection test successful', { version });
    return true;
  } catch (error) {
    logger.error('RPC connection test failed', error);
    return false;
  }
}

/**
 * Batch get balances for multiple addresses
 */
export async function getBatchBalances(addresses: string[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  
  try {
    const pubkeys = addresses.map(addr => new PublicKey(addr));
    const results = await connection.getMultipleAccountsInfo(pubkeys);
    
    for (let i = 0; i < results.length; i++) {
      const balance = results[i]?.lamports || 0;
      balances.set(addresses[i], balance / LAMPORTS_PER_XN);
    }
  } catch (error) {
    logger.error('Failed to get batch balances', error);
    // Fallback to individual requests
    for (const address of addresses) {
      try {
        const balance = await getBalance(address);
        balances.set(address, balance);
      } catch (err) {
        balances.set(address, 0);
      }
    }
  }
  
  return balances;
}

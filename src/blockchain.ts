import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  ConfirmedSignatureInfo
} from '@solana/web3.js';
import { 
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  AccountLayout,
  getTokenMetadata
} from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  fetchDigitalAsset,
  mplTokenMetadata 
} from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from '@metaplex-foundation/umi';
import { config } from './config';
import { TransactionInfo } from './types';
import { createLogger } from './logger';

const logger = createLogger('Blockchain');

// X1 connection pool (SVM-based) for better concurrency
const CONNECTION_POOL_SIZE = 3;
const connectionPool: Connection[] = [];
let currentConnectionIndex = 0;
let connectionAttempts = 0;
let lastConnectionAttempt = 0;
const CONNECTION_RETRY_DELAY = 5000; // 5 seconds between reconnection attempts

// Circuit breaker state
let circuitBreakerOpen = false;
let circuitBreakerOpenUntil = 0;
const CIRCUIT_BREAKER_THRESHOLD = 10; // Open after 10 consecutive failures
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

// Error tracking (must be declared before getConnection)
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

// Initialize connection pool
function initializeConnectionPool(): void {
  if (connectionPool.length === 0) {
    logger.info(`Initializing RPC connection pool (${CONNECTION_POOL_SIZE} connections)...`);
    for (let i = 0; i < CONNECTION_POOL_SIZE; i++) {
      connectionPool.push(new Connection(config.x1RpcUrl, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: true,
        confirmTransactionInitialTimeout: 30_000,
        wsEndpoint: undefined, // Disable WebSocket for stability
        // Remove problematic keep-alive headers that cause RPC errors
        httpHeaders: undefined,
        fetch: undefined, // Use native fetch
        fetchMiddleware: undefined
      }));
    }
    logger.info(`Connection pool initialized with ${CONNECTION_POOL_SIZE} connections`);
  }
}

export function getConnection(): Connection {
  const now = Date.now();
  
  // Check circuit breaker
  if (circuitBreakerOpen) {
    if (now < circuitBreakerOpenUntil) {
      logger.warn('Circuit breaker is open, using fallback connection');
      // Return a temporary lightweight connection
      return new Connection(config.x1RpcUrl, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: true,
        confirmTransactionInitialTimeout: 15_000,
      });
    } else {
      // Try to close circuit breaker
      logger.info('Attempting to close circuit breaker...');
      circuitBreakerOpen = false;
      consecutiveErrors = 0;
    }
  }
  
  // Initialize pool if needed
  initializeConnectionPool();
  
  // Rate limit reconnection attempts
  if (connectionAttempts > 0 && now - lastConnectionAttempt < CONNECTION_RETRY_DELAY) {
    // Return existing connection from pool
    return connectionPool[currentConnectionIndex % CONNECTION_POOL_SIZE];
  }
  
  // Round-robin connection selection for load distribution
  currentConnectionIndex = (currentConnectionIndex + 1) % CONNECTION_POOL_SIZE;
  return connectionPool[currentConnectionIndex];
}

// Reset connection pool (useful after prolonged errors)
export function resetConnection(): void {
  connectionPool.length = 0;
  currentConnectionIndex = 0;
  connectionAttempts = 0;
  circuitBreakerOpen = false;
  logger.info('RPC connection pool reset');
  // Reinitialize on next use
}

// Open circuit breaker (stops making requests for a period)
function openCircuitBreaker(): void {
  circuitBreakerOpen = true;
  circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT;
  logger.error(`Circuit breaker OPENED (will retry after ${CIRCUIT_BREAKER_TIMEOUT / 1000}s)`);
}

// Wrapper to handle 429 rate limit errors gracefully with retry logic
// Instead of retrying indefinitely, we fail fast and let the next polling cycle retry
async function safeRpcCall<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  operation: string = 'RPC call'
): Promise<T> {
  try {
    const result = await fn();
    
    // Reset error counter on success
    consecutiveErrors = 0;
    
    // Record successful RPC call
    try {
      const { monitoring } = await import('./monitoring');
      monitoring.recordRpcCall('success');
    } catch (e) {
      // Monitoring not available, skip
    }
    
    return result;
  } catch (error: any) {
    consecutiveErrors++;
    
    // If too many consecutive errors, open circuit breaker
    if (consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
      logger.error(`${consecutiveErrors} consecutive RPC errors, opening circuit breaker...`, undefined, { consecutiveErrors });
      openCircuitBreaker();
      resetConnection();
      consecutiveErrors = 0;
    } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      logger.warn(`${consecutiveErrors} consecutive RPC errors, resetting connection...`, { consecutiveErrors });
      resetConnection();
    }
    
    // Check if it's a 429 rate limit error
    if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
      logger.warn(`Rate limit hit during ${operation}, returning default value. Will retry next cycle.`, { operation });
      
      // Record rate limit
      try {
        const { monitoring } = await import('./monitoring');
        monitoring.recordRpcCall('rateLimit');
      } catch (e) {
        // Monitoring not available, skip
      }
      
      return defaultValue;
    }
    
    // Check for timeout
    if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT') {
      logger.warn(`Timeout during ${operation}`, { operation });
      
      try {
        const { monitoring } = await import('./monitoring');
        monitoring.recordRpcCall('timeout');
      } catch (e) {
        // Monitoring not available, skip
      }
      
      return defaultValue;
    }
    
    // Check for connection errors
    if (error?.message?.includes('ECONNREFUSED') || error?.message?.includes('ENOTFOUND') || 
        error?.message?.includes('ECONNRESET') || error?.code === 'ECONNABORTED') {
      logger.warn(`Connection error during ${operation}, may need to reconnect`, { operation });
      resetConnection();
      
      try {
        const { monitoring } = await import('./monitoring');
        monitoring.recordRpcCall('failure');
      } catch (e) {
        // Monitoring not available, skip
      }
      
      return defaultValue;
    }
    
    // For other errors, log and return default
    logger.error(`Error during ${operation}`, error, { operation });
    
    try {
      const { monitoring } = await import('./monitoring');
      monitoring.recordRpcCall('failure');
    } catch (e) {
      // Monitoring not available, skip
    }
    
    return defaultValue;
  }
}

// Validate Solana wallet address (base58 public key)
export function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Get checksummed/normalized address (Solana addresses are case-sensitive base58)
export function getChecksumAddress(address: string): string {
  return new PublicKey(address).toBase58();
}

// Get wallet balance in XNT (with caching)
export async function getBalance(address: string): Promise<string> {
  const { cache, CacheKeys, CacheTTL, withCache } = await import('./cache');
  
  return withCache(
    CacheKeys.walletBalance(address),
    CacheTTL.VERY_SHORT,
    () => safeRpcCall(
      async () => {
        const conn = getConnection();
        const publicKey = new PublicKey(address);
        const balance = await conn.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toString();
      },
      '0',
      `getBalance(${address.slice(0, 8)}...)`
    )
  );
}

// Get transaction count (number of signatures for address)
export async function getTransactionCount(address: string): Promise<number> {
  return safeRpcCall(
    async () => {
      const conn = getConnection();
      const publicKey = new PublicKey(address);
      const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 1 });
      // Return slot number as a proxy for activity tracking
      return signatures.length > 0 ? signatures[0].slot : 0;
    },
    0,
    `getTransactionCount(${address.slice(0, 8)}...)`
  );
}

// Get recent transactions for an address (optimized with batch fetching)
export async function getRecentTransactions(
  address: string,
  lastSignature?: string,
  limit: number = 20
): Promise<TransactionInfo[]> {
  return safeRpcCall(
    async () => {
      const conn = getConnection();
      const publicKey = new PublicKey(address);
      const transactions: TransactionInfo[] = [];
      
      try {
        // Get signatures for address
        const options: { limit: number; until?: string } = { limit };
        if (lastSignature) {
          options.until = lastSignature;
        }
        
        const signatures = await conn.getSignaturesForAddress(publicKey, options);
        
        // Filter out failed transactions upfront
        const validSignatures = signatures.filter(sig => !sig.err);
        
        if (validSignatures.length === 0) {
          return transactions;
        }
        
        // Batch fetch transactions (up to 10 at a time for efficiency)
        const BATCH_SIZE = 10;
        for (let i = 0; i < validSignatures.length; i += BATCH_SIZE) {
          const batch = validSignatures.slice(i, i + BATCH_SIZE);
          
          // Fetch all transactions in parallel
          const txPromises = batch.map(sigInfo =>
            conn.getParsedTransaction(sigInfo.signature, {
              maxSupportedTransactionVersion: 0
            }).catch(err => {
              logger.error(`Error fetching transaction`, err, { signature: sigInfo.signature });
              return null;
            })
          );
          
          const txResults = await Promise.all(txPromises);
          
          // Process results
          for (let j = 0; j < txResults.length; j++) {
            const tx = txResults[j];
            const sigInfo = batch[j];
            
            if (!tx || !tx.meta) continue;
            
            const txInfo = parseTransaction(tx, sigInfo, address);
            if (txInfo) {
              transactions.push(txInfo);
            }
          }
        }
      } catch (error) {
        logger.error('Error fetching recent transactions', error);
      }
      
      return transactions;
    },
    [],
    `getRecentTransactions(${address.slice(0, 8)}...)`
  );
}

// Parse a Solana transaction into our TransactionInfo format
function parseTransaction(
  tx: ParsedTransactionWithMeta,
  sigInfo: ConfirmedSignatureInfo,
  watchedAddress: string
): TransactionInfo | null {
  const meta = tx.meta;
  if (!meta) return null;
  
  const accountKeys = tx.transaction.message.accountKeys;
  const watchedPubkey = new PublicKey(watchedAddress);
  
  // Find the index of our watched address in the account keys
  const watchedIndex = accountKeys.findIndex(
    key => key.pubkey.equals(watchedPubkey)
  );
  
  if (watchedIndex === -1) return null;
  
  // Calculate SOL balance change for the watched address
  const preBalance = meta.preBalances[watchedIndex] || 0;
  const postBalance = meta.postBalances[watchedIndex] || 0;
  const balanceChange = (postBalance - preBalance) / LAMPORTS_PER_SOL;
  
  // Determine direction based on balance change
  const isIncoming = balanceChange > 0;
  
  // Get from/to addresses
  const signerKey = accountKeys[0]?.pubkey.toBase58() || 'Unknown';
  const from = isIncoming ? signerKey : watchedAddress;
  const to = isIncoming ? watchedAddress : (accountKeys[1]?.pubkey.toBase58() || null);
  
  // Check if it's a program interaction (not just a simple transfer)
  const isContractInteraction = tx.transaction.message.instructions.some(
    ix => 'programId' in ix && !ix.programId.equals(new PublicKey('11111111111111111111111111111111'))
  );
  
  return {
    hash: sigInfo.signature,
    from,
    to,
    value: Math.abs(balanceChange).toString(),
    blockNumber: sigInfo.slot,
    timestamp: sigInfo.blockTime || undefined,
    isContractInteraction,
  };
}

// Get current slot number (equivalent to block number)
export async function getCurrentBlockNumber(): Promise<number> {
  const conn = getConnection();
  return await conn.getSlot();
}

// Get latest signatures for an address (used for tracking new transactions)
export async function getLatestSignatures(
  address: string,
  limit: number = 1
): Promise<ConfirmedSignatureInfo[]> {
  // Only cache for single signature requests (polling optimization)
  if (limit === 1) {
    const { cache, CacheKeys, CacheTTL, withCache } = await import('./cache');
    return withCache(
      CacheKeys.walletSignatures(address),
      15, // 15 second cache for signature checks
      () => safeRpcCall(
        async () => {
          const conn = getConnection();
          const publicKey = new PublicKey(address);
          return await conn.getSignaturesForAddress(publicKey, { limit });
        },
        [],
        `getLatestSignatures(${address.slice(0, 8)}...)`
      )
    );
  }
  
  return safeRpcCall(
    async () => {
      const conn = getConnection();
      const publicKey = new PublicKey(address);
      return await conn.getSignaturesForAddress(publicKey, { limit });
    },
    [],
    `getLatestSignatures(${address.slice(0, 8)}...)`
  );
}

// Cache for wallet activity stats (to avoid repeated expensive calls)
const walletStatsCache: Map<string, { data: WalletActivityStatsResult; expiry: number }> = new Map();
const STATS_CACHE_TTL = 60 * 1000; // 1 minute cache

interface WalletActivityStatsResult {
  firstTxDate: Date | null;
  totalTransactions: number;
  last24hTransactions: number;
  last7dTransactions: number;
}

// Get wallet activity stats - FAST version (limited to recent transactions)
// Use this for UI display where speed matters
export async function getWalletActivityStatsFast(address: string): Promise<WalletActivityStatsResult> {
  // Check cache first
  const cached = walletStatsCache.get(address);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  
  const conn = getConnection();
  const pubKey = new PublicKey(address);
  
  try {
    // Only fetch 100 recent signatures for speed
    const signatures = await conn.getSignaturesForAddress(pubKey, { limit: 100 });
    
    const totalTransactions = signatures.length;
    
    // Get first tx date from the oldest in our batch (approximate)
    let firstTxDate: Date | null = null;
    if (signatures.length > 0) {
      const oldestTx = signatures[signatures.length - 1];
      if (oldestTx.blockTime) {
        firstTxDate = new Date(oldestTx.blockTime * 1000);
      }
    }
    
    // Calculate recent activity
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    let last24hTransactions = 0;
    let last7dTransactions = 0;
    
    for (const sig of signatures) {
      if (sig.blockTime) {
        const txTime = sig.blockTime * 1000;
        if (txTime >= oneDayAgo) {
          last24hTransactions++;
        }
        if (txTime >= sevenDaysAgo) {
          last7dTransactions++;
        }
      }
    }
    
    const result: WalletActivityStatsResult = {
      firstTxDate,
      totalTransactions: totalTransactions >= 100 ? 100 : totalTransactions, // Indicate if there are more
      last24hTransactions,
      last7dTransactions
    };
    
    // Cache the result
    walletStatsCache.set(address, { data: result, expiry: Date.now() + STATS_CACHE_TTL });
    
    return result;
  } catch (error) {
    logger.error('Error getting wallet activity stats (fast)', error);
    return {
      firstTxDate: null,
      totalTransactions: 0,
      last24hTransactions: 0,
      last7dTransactions: 0
    };
  }
}

// Get wallet activity stats (first tx date, total tx count, recent activity)
// WARNING: This is SLOW for active wallets - use getWalletActivityStatsFast for UI
export async function getWalletActivityStats(address: string): Promise<WalletActivityStatsResult> {
  const conn = getConnection();
  const pubKey = new PublicKey(address);
  
  try {
    // Get all signatures to count total transactions
    // Note: This fetches up to 1000 signatures per call
    let allSignatures: ConfirmedSignatureInfo[] = [];
    let lastSignature: string | undefined = undefined;
    let hasMore = true;
    
    // Fetch signatures in batches (max 1000 per request)
    while (hasMore) {
      const options: { limit: number; before?: string } = { limit: 1000 };
      if (lastSignature) {
        options.before = lastSignature;
      }
      
      const signatures = await conn.getSignaturesForAddress(pubKey, options);
      
      if (signatures.length === 0) {
        hasMore = false;
      } else {
        allSignatures = allSignatures.concat(signatures);
        lastSignature = signatures[signatures.length - 1].signature;
        
        // Stop if we got less than 1000 (no more pages)
        if (signatures.length < 1000) {
          hasMore = false;
        }
        
        // Safety limit: stop at 50,000 transactions (increased for accurate wallet age)
        if (allSignatures.length >= 50000) {
          hasMore = false;
        }
      }
    }
    
    const totalTransactions = allSignatures.length;
    
    // Get the oldest transaction (last in the array)
    let firstTxDate: Date | null = null;
    if (allSignatures.length > 0) {
      const oldestTx = allSignatures[allSignatures.length - 1];
      if (oldestTx.blockTime) {
        firstTxDate = new Date(oldestTx.blockTime * 1000);
      }
    }
    
    // Calculate recent activity
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    let last24hTransactions = 0;
    let last7dTransactions = 0;
    
    for (const sig of allSignatures) {
      if (sig.blockTime) {
        const txTime = sig.blockTime * 1000;
        if (txTime >= oneDayAgo) {
          last24hTransactions++;
        }
        if (txTime >= sevenDaysAgo) {
          last7dTransactions++;
        }
      }
    }
    
    return {
      firstTxDate,
      totalTransactions,
      last24hTransactions,
      last7dTransactions
    };
  } catch (error) {
    logger.error('Error getting wallet activity stats', error);
    return {
      firstTxDate: null,
      totalTransactions: 0,
      last24hTransactions: 0,
      last7dTransactions: 0
    };
  }
}

// Get quick transaction count (limited, faster)
export async function getQuickTransactionCount(address: string): Promise<number> {
  const conn = getConnection();
  const publicKey = new PublicKey(address);
  
  try {
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 1000 });
    return signatures.length;
  } catch (error) {
    logger.error('Error getting transaction count', error);
    return 0;
  }
}

// Format value for display
export function formatValue(value: string): string {
  const num = parseFloat(value);
  if (num === 0) return '0 XNT';
  if (num < 0.000001) return '< 0.000001 XNT';
  if (num < 0.001) return `${num.toFixed(6)} XNT`;
  if (num < 1) return `${num.toFixed(4)} XNT`;
  return `${num.toFixed(4)} XNT`;
}

// Get explorer URL for transaction
export function getTxExplorerUrl(txHash: string): string {
  return `${config.explorerUrl}/tx/${txHash}`;
}

// Get explorer URL for address
export function getAddressExplorerUrl(address: string): string {
  return `${config.explorerUrl}/account/${address}`;
}

// Check if connection is working
export async function isConnected(): Promise<boolean> {
  try {
    const conn = getConnection();
    await conn.getSlot();
    return true;
  } catch {
    return false;
  }
}

// ==================== SPL & TOKEN-2022 SUPPORT ====================

// Token program types
export type TokenProgram = 'spl-token' | 'token-2022';

interface TokenMintInfo {
  decimals: number;
  program: TokenProgram;
  programId: PublicKey;
}

// Detect which token program a mint belongs to
async function detectTokenProgram(mintAddress: string): Promise<TokenMintInfo | null> {
  const conn = getConnection();
  const mintPubkey = new PublicKey(mintAddress);
  
  // Try SPL Token program first (more common)
  try {
    const mintInfo = await getMint(conn, mintPubkey, 'confirmed', TOKEN_PROGRAM_ID);
    return {
      decimals: mintInfo.decimals,
      program: 'spl-token',
      programId: TOKEN_PROGRAM_ID
    };
  } catch {
    // Not an SPL token, try Token-2022
  }
  
  // Try Token-2022 program
  try {
    const mintInfo = await getMint(conn, mintPubkey, 'confirmed', TOKEN_2022_PROGRAM_ID);
    return {
      decimals: mintInfo.decimals,
      program: 'token-2022',
      programId: TOKEN_2022_PROGRAM_ID
    };
  } catch {
    // Not a valid token mint
  }
  
  return null;
}

// Get token metadata using Metaplex
async function getMetaplexMetadata(mintAddress: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const umi = createUmi(config.x1RpcUrl).use(mplTokenMetadata());
    const mintPublicKey = publicKey(mintAddress);
    
    const asset = await fetchDigitalAsset(umi, mintPublicKey);
    
    return {
      name: asset.metadata.name.replace(/\0/g, '').trim(),
      symbol: asset.metadata.symbol.replace(/\0/g, '').trim()
    };
  } catch {
    return null;
  }
}

// Get Token-2022 on-chain metadata (for tokens using the metadata extension)
async function getToken2022Metadata(mintAddress: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const conn = getConnection();
    const mintPubkey = new PublicKey(mintAddress);
    
    // Try to fetch Token-2022 metadata extension
    const metadata = await getTokenMetadata(conn, mintPubkey, 'confirmed', TOKEN_2022_PROGRAM_ID);
    
    if (metadata) {
      return {
        name: metadata.name || '',
        symbol: metadata.symbol || ''
      };
    }
  } catch {
    // No metadata extension
  }
  
  return null;
}

// Get SPL/Token-2022 token info (symbol, decimals, name) - with caching
export async function getTokenInfo(tokenMint: string): Promise<{ 
  symbol: string; 
  decimals: number; 
  name: string;
  program: TokenProgram;
} | null> {
  const { cache, CacheKeys, CacheTTL, withCache } = await import('./cache');
  
  return withCache(
    CacheKeys.tokenInfo(tokenMint),
    CacheTTL.LONG, // Token info rarely changes
    async () => {
      try {
        // First detect which program the token belongs to
        const mintInfo = await detectTokenProgram(tokenMint);
        if (!mintInfo) {
          return null;
        }
        
        // Try to get metadata
        let metadata: { name: string; symbol: string } | null = null;
        
        // For Token-2022, first try the built-in metadata extension
        if (mintInfo.program === 'token-2022') {
          metadata = await getToken2022Metadata(tokenMint);
        }
        
        // If no metadata yet, try Metaplex (works for both SPL and Token-2022)
        if (!metadata || !metadata.symbol) {
          metadata = await getMetaplexMetadata(tokenMint);
        }
        
        // Fallback to address-based placeholder
        const symbol = metadata?.symbol || tokenMint.slice(0, 4).toUpperCase();
        const name = metadata?.name || `Token ${tokenMint.slice(0, 8)}...`;
        
        return {
          symbol,
          decimals: mintInfo.decimals,
          name,
          program: mintInfo.program
        };
      } catch (error) {
        logger.error('Error getting token info', error);
        return null;
      }
    }
  );
}

// Get SPL/Token-2022 token balance for a wallet
export async function getTokenBalance(tokenMint: string, walletAddress: string): Promise<string | null> {
  try {
    const conn = getConnection();
    const walletPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(tokenMint);
    
    // Detect token program
    const mintInfo = await detectTokenProgram(tokenMint);
    if (!mintInfo) {
      return null;
    }
    
    // Get all token accounts for this wallet and mint using the correct program
    const tokenAccounts = await conn.getTokenAccountsByOwner(
      walletPubkey,
      { mint: mintPubkey },
      { commitment: 'confirmed' }
    );
    
    if (tokenAccounts.value.length === 0) {
      return '0';
    }
    
    // Sum up balances from all token accounts (usually just one)
    let totalBalance = BigInt(0);
    
    for (const accountInfo of tokenAccounts.value) {
      const accountData = AccountLayout.decode(accountInfo.account.data);
      totalBalance += accountData.amount;
    }
    
    // Convert to decimal representation
    const balance = Number(totalBalance) / Math.pow(10, mintInfo.decimals);
    return balance.toString();
  } catch (error) {
    logger.error('Error getting token balance', error);
    return null;
  }
}

// Get all token accounts for a wallet (both SPL and Token-2022) - optimized with parallel fetching
export async function getAllTokenAccounts(walletAddress: string): Promise<Array<{
  mint: string;
  balance: string;
  decimals: number;
  program: TokenProgram;
}>> {
  const conn = getConnection();
  const walletPubkey = new PublicKey(walletAddress);
  const tokens: Array<{
    mint: string;
    balance: string;
    decimals: number;
    program: TokenProgram;
  }> = [];
  
  // Fetch both SPL and Token-2022 accounts in parallel
  const [splResult, token2022Result] = await Promise.allSettled([
    conn.getTokenAccountsByOwner(walletPubkey, { programId: TOKEN_PROGRAM_ID }),
    conn.getTokenAccountsByOwner(walletPubkey, { programId: TOKEN_2022_PROGRAM_ID })
  ]);
  
  // Process SPL Token accounts
  if (splResult.status === 'fulfilled') {
    const mintPromises = splResult.value.value.map(async (account) => {
      try {
        const data = AccountLayout.decode(account.account.data);
        const mint = new PublicKey(data.mint).toBase58();
        const mintInfo = await getMint(conn, new PublicKey(mint), 'confirmed', TOKEN_PROGRAM_ID);
        const balance = Number(data.amount) / Math.pow(10, mintInfo.decimals);
        
        if (balance > 0) {
          return {
            mint,
            balance: balance.toString(),
            decimals: mintInfo.decimals,
            program: 'spl-token' as TokenProgram
          };
        }
      } catch {
        // Skip if can't get mint info
      }
      return null;
    });
    
    const splTokens = await Promise.all(mintPromises);
    tokens.push(...splTokens.filter(t => t !== null) as any[]);
  } else {
    logger.error('Error fetching SPL token accounts', splResult.reason);
  }
  
  // Process Token-2022 accounts
  if (token2022Result.status === 'fulfilled') {
    const mintPromises = token2022Result.value.value.map(async (account) => {
      try {
        const data = AccountLayout.decode(account.account.data);
        const mint = new PublicKey(data.mint).toBase58();
        const mintInfo = await getMint(conn, new PublicKey(mint), 'confirmed', TOKEN_2022_PROGRAM_ID);
        const balance = Number(data.amount) / Math.pow(10, mintInfo.decimals);
        
        if (balance > 0) {
          return {
            mint,
            balance: balance.toString(),
            decimals: mintInfo.decimals,
            program: 'token-2022' as TokenProgram
          };
        }
      } catch {
        // Skip if can't get mint info
      }
      return null;
    });
    
    const token2022Tokens = await Promise.all(mintPromises);
    tokens.push(...token2022Tokens.filter(t => t !== null) as any[]);
  } else {
    logger.error('Error fetching Token-2022 accounts', token2022Result.reason);
  }
  
  return tokens;
}

// Format token balance for display
export function formatTokenBalance(balance: string, symbol: string): string {
  const num = parseFloat(balance);
  if (num === 0) return `0 ${symbol}`;
  if (num < 0.0001) return `< 0.0001 ${symbol}`;
  if (num < 1) return `${num.toFixed(4)} ${symbol}`;
  if (num < 1000) return `${num.toFixed(2)} ${symbol}`;
  if (num < 1000000) return `${(num / 1000).toFixed(2)}K ${symbol}`;
  return `${(num / 1000000).toFixed(2)}M ${symbol}`;
}

// Validate if address is a valid SPL or Token-2022 token mint
export async function isValidTokenContract(tokenMint: string): Promise<boolean> {
  try {
    const mintInfo = await detectTokenProgram(tokenMint);
    return mintInfo !== null;
  } catch {
    return false;
  }
}

// Get explorer URL for token
export function getTokenExplorerUrl(tokenMint: string): string {
  return `${config.explorerUrl}/token/${tokenMint}`;
}

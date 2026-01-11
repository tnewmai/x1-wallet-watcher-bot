import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from './config';
import { getConnection } from './blockchain';
import { cache, CacheKeys, CacheTTL, withCache, batchAsync, parallelAsync } from './cache';
import { createLogger } from './logger';

const logger = createLogger('Security');

// GoPlus Security API (free, no key required for basic checks)
const GOPLUS_API_BASE = 'https://api.gopluslabs.io/api/v1';

// Risk levels
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

// Rugpull indicator types
export type RugpullIndicator = 
  | 'serial_deployer'
  | 'quick_dump'
  | 'wash_trading'
  | 'honeypot_creator'
  | 'liquidity_puller'
  | 'lp_rugger'
  | 'mint_authority_abuse'
  | 'coordinated_wallets'
  | 'fresh_wallet_funder'
  | 'known_scammer'
  | 'suspicious_timing'
  | 'soft_rug'
  | 'slow_rug';

// Rug type classification
export type RugType = 
  | 'lp_pull'           // Removed liquidity suddenly
  | 'honeypot'          // Can buy but not sell
  | 'mint_dump'         // Minted new tokens and dumped
  | 'dev_dump'          // Dev wallet dumped holdings
  | 'soft_rug'          // Abandoned project, slow death
  | 'coordinated_dump'  // Multiple wallets dumped together
  | 'none';

// Rug involvement info for connected wallets
export interface RugInvolvement {
  rugType: RugType;
  tokenMint: string;
  tokenSymbol?: string;
  role: 'deployer' | 'lp_provider' | 'lp_remover' | 'dumper' | 'recipient' | 'wash_trader';
  amount?: number;
  timestamp?: Date;
  evidence: string[];
}

// Suspicious pattern detected
export interface SuspiciousPattern {
  type: RugpullIndicator;
  severity: 'warning' | 'danger' | 'critical';
  description: string;
  evidence: string[];
  timestamp?: Date; // When the suspicious activity occurred
}

// Token deployed by this wallet with analysis
export interface DeployedTokenInfo {
  mint: string;
  name?: string;
  symbol?: string;
  createdAt?: Date;
  hasLiquidity: boolean;
  liquidityPulled: boolean;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  topHolderPercentage?: number;
  isRugpull: boolean;
  rugpullIndicators: string[];
  rugpullTimestamp?: Date; // When the token was rugged (if applicable)
}

// Connected wallet info
export interface ConnectedWallet {
  address: string;
  interactionCount: number;
  totalValueSent: number;
  totalValueReceived: number;
  isDeployer: boolean;
  deployedTokenCount: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  firstInteraction?: Date;
  lastInteraction?: Date;
  pattern?: string; // e.g., "funding source", "dump recipient", "wash trading partner"
  rugInvolvements: RugInvolvement[]; // Direct involvement in rugs
  isLpRugger: boolean;
  isHoneypotCreator: boolean;
  rugCount: number;
}

// Wallet activity analysis
export interface WalletActivityAnalysis {
  totalTransactions: number;
  accountAge: number; // days
  avgDailyTransactions: number;
  largestOutflow: number;
  largestInflow: number;
  uniqueInteractions: number;
  suspiciousTimingCount: number; // transactions at unusual intervals
  rapidFireTransactions: number; // many txs in short period
}

export interface WalletSecurityInfo {
  riskLevel: RiskLevel;
  riskScore: number; // 0-100, higher = more risky
  warnings: string[];
  isDeployer: boolean;
  deployedTokens: string[];
  deployedTokensAnalysis: DeployedTokenInfo[];
  fundingSource: string | null;
  fundingSourceRisk: RiskLevel;
  fundingChain: string[]; // trace back multiple hops
  hasBlacklistHistory: boolean;
  maliciousActivity: boolean;
  connectedWallets: ConnectedWallet[];
  riskyConnections: number;
  suspiciousPatterns: SuspiciousPattern[];
  activityAnalysis: WalletActivityAnalysis | null;
  verdict: string; // Human readable summary
}

// --- Concurrency guard for security scans ---
// Security scans can be very RPC-heavy. If multiple scans run in parallel, the RPC can 429,
// and the bot may appear frozen (even /start won't respond).
// We therefore serialize scans globally.
let securityScanChain: Promise<void> = Promise.resolve();

async function withSecurityScanLock<T>(fn: () => Promise<T>, timeoutMs: number = 60_000): Promise<T> {
  // Simple promise chain mutex
  let release: () => void;
  const next = new Promise<void>((resolve) => (release = resolve));
  const prev = securityScanChain;
  securityScanChain = securityScanChain.then(() => next).catch(() => next);

  // Wait our turn
  await prev;

  try {
    // Also enforce an overall timeout so we don't hold the lock forever
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Security scan timed out')), timeoutMs)),
    ]);
  } finally {
    // @ts-expect-error set in constructor above
    release();
  }
}

// Background pre-scan is intentionally kept but should be used sparingly.
// Track failed security scans for retry logic
const failedSecurityScans: Map<string, { attempts: number; lastAttempt: number }> = new Map();
const MAX_SECURITY_SCAN_RETRIES = 3;
const SECURITY_SCAN_RETRY_DELAY = 5000; // 5 seconds

// It is NOT used by default in handlers.
export function preScanWallet(address: string): void {
  // Check if auto-scan is disabled
  const { config } = require('./config');
  if (config.disableAutoSecurityScan) {
    logger.info('Auto security scan disabled, skipping pre-scan for ' + address.slice(0, 8) + '...');
    return;
  }
  
  const addressKey = address.toLowerCase();
  const failureInfo = failedSecurityScans.get(addressKey);
  
  // Check if we've exceeded retry attempts
  if (failureInfo && failureInfo.attempts >= MAX_SECURITY_SCAN_RETRIES) {
    const timeSinceLastAttempt = Date.now() - failureInfo.lastAttempt;
    // Reset after 1 hour
    if (timeSinceLastAttempt < 3600000) {
      logger.warn(`⚠️  Security scan for ${address.slice(0, 8)}... failed ${failureInfo.attempts} times, skipping`);
      return;
    } else {
      // Reset after cooldown period
      failedSecurityScans.delete(addressKey);
    }
  }
  
  void checkWalletSecurity(address, true).catch(err => {
    logger.error(`⚠️  Security scan error for ${address.slice(0, 8)}...:`, err.message);
    
    // Track failure
    const current = failedSecurityScans.get(addressKey) || { attempts: 0, lastAttempt: 0 };
    current.attempts++;
    current.lastAttempt = Date.now();
    failedSecurityScans.set(addressKey, current);
    
    // Schedule retry if we haven't exceeded max attempts
    if (current.attempts < MAX_SECURITY_SCAN_RETRIES) {
      const delay = SECURITY_SCAN_RETRY_DELAY * current.attempts;
      logger.info(`🔄 Retrying security scan for ${address.slice(0, 8)}... in ${delay}ms (attempt ${current.attempts + 1}/${MAX_SECURITY_SCAN_RETRIES})`);
      
      setTimeout(() => {
        preScanWallet(address);
      }, delay);
    } else {
      logger.error(`❌ Security scan permanently failed for ${address.slice(0, 8)}... after ${MAX_SECURITY_SCAN_RETRIES} attempts`);
    }
  }).then(() => {
    // Clear failure tracking on success
    failedSecurityScans.delete(addressKey);
  });
}

// Clear failed scan tracking (call when wallet is removed)
export function clearSecurityScanFailures(address: string): void {
  failedSecurityScans.delete(address.toLowerCase());
}

// Get security scan status
export function getSecurityScanStatus(address: string): { failed: boolean; attempts: number } | null {
  const info = failedSecurityScans.get(address.toLowerCase());
  if (!info) return null;
  return { failed: info.attempts >= MAX_SECURITY_SCAN_RETRIES, attempts: info.attempts };
}

export function preScanWallets(addresses: string[]): void {
  // Check if auto-scan is disabled
  const { config } = require('./config');
  if (config.disableAutoSecurityScan) {
    logger.info('⏭️  Auto security scan disabled, skipping pre-scan for wallets');
    return;
  }
  
  for (const address of addresses.slice(0, 2)) { // extra conservative
    preScanWallet(address);
  }
}

// Check wallet security using GoPlus API - OPTIMIZED with caching
export async function checkWalletSecurity(address: string, deepScan: boolean = true): Promise<WalletSecurityInfo> {
  return withSecurityScanLock(async () => {

  // Use cache to avoid hammering RPC with 429s
  const cacheKey = CacheKeys.securityScan(address);
  
  // Check cache first - use cached results if available (5 min TTL)
  const cached = cache.get<WalletSecurityInfo>(cacheKey);
  if (cached) {
    logger.info(`✅ Using cached security scan for ${address.slice(0, 8)}...`);
    
    // Record cached scan
    try {
      const { monitoring } = await import('./monitoring');
      monitoring.recordSecurityScan(0, true, true);
    } catch (e) {
      // Monitoring not available, skip
    }
    
    return cached;
  }

  const result: WalletSecurityInfo = {
    riskLevel: 'unknown',
    riskScore: 0,
    warnings: [],
    isDeployer: false,
    deployedTokens: [],
    deployedTokensAnalysis: [],
    fundingSource: null,
    fundingSourceRisk: 'unknown',
    fundingChain: [],
    hasBlacklistHistory: false,
    maliciousActivity: false,
    connectedWallets: [],
    riskyConnections: 0,
    suspiciousPatterns: [],
    activityAnalysis: null,
    verdict: '',
  };

  try {
    logger.info('Starting optimized security scan for: ' + address.slice(0, 8) + '...');
    const startTime = Date.now();
    
    // Run checks with timeout protection to prevent freezing on 429 errors
    // Reduce parallelism to avoid overwhelming RPC (was 6, now 3 at a time)
    const timeoutMs = 20000; // 20 second timeout per operation (increased for slow RPC)
    
    const withTimeout = <T>(promise: Promise<T>, defaultValue: T): Promise<T> => {
      const timeoutRef = { timer: null as NodeJS.Timeout | null };
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutRef.timer = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
      });
      
      return Promise.race([
        promise,
        timeoutPromise
      ]).then((result) => {
        // Clear timeout on success
        if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
        return result;
      }).catch((error) => {
        // Clear timeout on error
        if (timeoutRef.timer) clearTimeout(timeoutRef.timer);
        logger.warn('Security check operation failed:', error.message);
        return defaultValue;
      });
    };
    
    // Phase 1: Essential checks (run in parallel)
    const [goPlusResult, deployerResult, activityResult] = await Promise.all([
      withTimeout(checkGoPlusSecurityCached(address), null),
      withTimeout(checkIfDeployerFast(address), { isDeployer: false, deployedTokens: [], tokenAnalysis: [] }),
      withTimeout(analyzeWalletActivityFast(address), null),
    ]);
    
    logger.info(`⚡ Phase 1 completed in ${Date.now() - startTime}ms`);
    
    // Phase 2: Deep scan checks (only if deepScan is true, run sequentially to reduce load)
    let fundingResult: { source: string | null; chain: string[]; risk: RiskLevel } = { source: null, chain: [], risk: 'unknown' as RiskLevel };
    let connectedResult = new Map();
    let lpRugResult: { isLpRugger: boolean; totalWithdrawn: number; lpBurns: number; largeDumps: number; evidence: string[]; timestamp?: number | null } = { 
      isLpRugger: false, 
      totalWithdrawn: 0, 
      lpBurns: 0, 
      largeDumps: 0, 
      evidence: [],
      timestamp: null
    };
    
    if (deepScan) {
      lpRugResult = await withTimeout(
        detectLpRugActivity(address),
        { isLpRugger: false, totalWithdrawn: 0, lpBurns: 0, largeDumps: 0, evidence: [] }
      );
      
      fundingResult = await withTimeout(
        traceFundingChainFast(address),
        { source: null, chain: [], risk: 'unknown' as RiskLevel }
      );
      
      logger.info(`💰 Funding result for ${address.slice(0, 8)}`, { fundingResult });
      
      connectedResult = await withTimeout(
        findConnectedWalletsFast(address),
        new Map()
      );
    }
    
    logger.info(`⚡ Full scan completed in ${Date.now() - startTime}ms`);

    // Merge GoPlus results
    if (goPlusResult) {
      result.hasBlacklistHistory = goPlusResult.hasBlacklistHistory;
      result.maliciousActivity = goPlusResult.maliciousActivity;
      result.warnings.push(...goPlusResult.warnings);
      
      if (goPlusResult.hasBlacklistHistory) {
        result.suspiciousPatterns.push({
          type: 'known_scammer',
          severity: 'critical',
          description: 'Address found in security blacklists',
          evidence: ['Flagged by GoPlus security database'],
        });
      }
    }

    // Merge deployer results with enhanced analysis
    result.isDeployer = deployerResult.isDeployer;
    result.deployedTokens = deployerResult.deployedTokens;
    result.deployedTokensAnalysis = deployerResult.tokenAnalysis;
    
    // Merge LP rug detection results
    logger.info('LP Rug Result in main scan', { isLpRugger: lpRugResult.isLpRugger, evidence: lpRugResult.evidence });
    if (lpRugResult.isLpRugger) {
      logger.info('Adding LP rugger pattern to results');
      result.suspiciousPatterns.push({
        type: 'lp_rugger',
        severity: 'critical',
        description: 'LP RUGGER - Pulled liquidity from DEX',
        evidence: lpRugResult.evidence,
        timestamp: lpRugResult.timestamp ? new Date(lpRugResult.timestamp * 1000) : undefined,
      });
      result.warnings.push(`🚨 LP RUGGER: ${lpRugResult.evidence.join(', ')}`);
    }
    
    if (deployerResult.isDeployer) {
      const tokenCount = deployerResult.deployedTokens.length;
      const rugpullCount = deployerResult.tokenAnalysis.filter(t => t.isRugpull).length;
      
      if (tokenCount >= 10) {
        result.suspiciousPatterns.push({
          type: 'serial_deployer',
          severity: 'critical',
          description: `Serial token deployer - created ${tokenCount} tokens`,
          evidence: [
            `${tokenCount} tokens deployed`,
            rugpullCount > 0 ? `${rugpullCount} identified as rugpulls` : 'Token analysis pending',
          ],
        });
        result.warnings.push(`🚨 SERIAL DEPLOYER: ${tokenCount} tokens created`);
      } else if (tokenCount >= 3) {
        result.suspiciousPatterns.push({
          type: 'serial_deployer',
          severity: 'danger',
          description: `Multiple token deployer - created ${tokenCount} tokens`,
          evidence: [`${tokenCount} tokens deployed from this wallet`],
        });
        result.warnings.push(`⚠️ Multiple token deployer: ${tokenCount} tokens`);
      }
      
      // Check for rugpull patterns in deployed tokens
      if (rugpullCount > 0) {
        result.suspiciousPatterns.push({
          type: 'liquidity_puller',
          severity: 'critical',
          description: `${rugpullCount} of ${tokenCount} deployed tokens show rugpull indicators`,
          evidence: deployerResult.tokenAnalysis
            .filter(t => t.isRugpull)
            .flatMap(t => t.rugpullIndicators),
        });
        result.warnings.push(`🚨 RUGPULL HISTORY: ${rugpullCount} token(s) rugged`);
      }
    }

    // Merge funding chain results
    result.fundingSource = fundingResult.source;
    result.fundingChain = fundingResult.chain;
    result.fundingSourceRisk = fundingResult.risk;
    
    logger.info(`📊 After merge - fundingChain length: ${result.fundingChain.length}`, { fundingChain: result.fundingChain });
    
    if (fundingResult.risk === 'high' || fundingResult.risk === 'critical') {
      result.suspiciousPatterns.push({
        type: 'fresh_wallet_funder',
        severity: fundingResult.risk === 'critical' ? 'critical' : 'danger',
        description: 'Funded by suspicious source',
        evidence: [`Funding chain: ${fundingResult.chain.map(a => a.slice(0, 6) + '...').join(' → ')}`],
      });
      result.warnings.push(`⚠️ Suspicious funding source detected`);
    }

    // Analyze activity patterns
    result.activityAnalysis = activityResult;
    if (activityResult) {
      // Check for wash trading patterns
      if (activityResult.rapidFireTransactions > 20) {
        result.suspiciousPatterns.push({
          type: 'wash_trading',
          severity: 'warning',
          description: 'High frequency trading pattern detected',
          evidence: [`${activityResult.rapidFireTransactions} rapid-fire transactions detected`],
        });
      }
      
      // Fresh wallet with large activity
      if (activityResult.accountAge < 7 && activityResult.totalTransactions > 100) {
        result.suspiciousPatterns.push({
          type: 'suspicious_timing',
          severity: 'warning',
          description: 'New wallet with unusually high activity',
          evidence: [
            `Account age: ${activityResult.accountAge} days`,
            `Total transactions: ${activityResult.totalTransactions}`,
          ],
        });
      }
    }

    // Analyze connected wallets for risks - FAST MODE: limit to top 5 connections
    if (connectedResult.size > 0) {
      result.connectedWallets = await analyzeConnectedWalletsFast(connectedResult, address);
      result.riskyConnections = result.connectedWallets.filter(
        w => w.riskLevel === 'high' || w.riskLevel === 'critical'
      ).length;
      
      // Check for coordinated wallet patterns
      const coordinatedWallets = detectCoordinatedWallets(result.connectedWallets);
      if (coordinatedWallets.length > 0) {
        result.suspiciousPatterns.push({
          type: 'coordinated_wallets',
          severity: 'danger',
          description: 'Possible coordinated wallet network detected',
          evidence: coordinatedWallets.map(w => `${w.address.slice(0, 6)}...${w.address.slice(-4)}: ${w.pattern}`),
        });
        result.warnings.push(`⚠️ Connected to ${coordinatedWallets.length} coordinated wallet(s)`);
      }
      
      if (result.riskyConnections > 0) {
        result.warnings.push(`Connected to ${result.riskyConnections} risky wallet(s)`);
      }
    }

    // Calculate overall risk score and level
    result.riskScore = calculateRiskScoreEnhanced(result);
    result.riskLevel = getRiskLevelEnhanced(result.riskScore);
    
    // Generate human-readable verdict
    result.verdict = generateVerdict(result);
    
    // Cache the result
    cache.set(cacheKey, result, CacheTTL.SHORT);
    const totalDuration = Date.now() - startTime;
    logger.info(`✅ Security scan completed in ${totalDuration}ms`);
    
    // Record successful scan
    try {
      const { monitoring } = await import('./monitoring');
      monitoring.recordSecurityScan(totalDuration, false, true);
    } catch (e) {
      // Monitoring not available, skip
    }

  } catch (error) {
    logger.error('Error checking wallet security:', error);
    
    // FALLBACK: If full scan fails, at least return blocklist results
    try {
      const { performEnhancedSecurityScan } = await import('./enhanced-security-scanner');
      const blocklistResult = performEnhancedSecurityScan(address, null);
      
      if (blocklistResult.isKnownRugger || blocklistResult.inScamNetwork) {
        // Known threat in blocklist - return this critical info
        result.riskLevel = blocklistResult.riskLevel.toLowerCase() as RiskLevel;
        result.riskScore = blocklistResult.riskScore;
        result.warnings = blocklistResult.warnings;
        result.verdict = `⚠️ Blocklist scan completed (full scan timed out).\n\n${blocklistResult.enhancedVerdict}`;
        logger.warn(`✓ Returned blocklist results for ${address.slice(0, 8)}... after full scan timeout`);
      } else {
        result.verdict = 'Unable to complete full security scan due to slow RPC. No threats found in blocklist. You may retry for detailed analysis.';
      }
    } catch (e) {
      result.verdict = 'Unable to complete security scan. Please try again.';
    }
    
    // Record failed scan
    try {
      const { monitoring } = await import('./monitoring');
      monitoring.recordSecurityScan(0, false, false);
    } catch (e) {
      // Monitoring not available, skip
    }
  }

  return result;
  });
}

// Check GoPlus Security API for address reputation
async function checkGoPlusSecurity(address: string): Promise<{
  hasBlacklistHistory: boolean;
  maliciousActivity: boolean;
  warnings: string[];
} | null> {
  try {
    // GoPlus API for Solana address security
    // Note: GoPlus primarily supports EVM chains, so we'll use their general API
    // and supplement with on-chain analysis for Solana/SVM
    const response = await fetch(
      `${GOPLUS_API_BASE}/address_security/${address}?chain_id=solana`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) {
      // GoPlus may not support this chain, fall back to on-chain analysis
      return null;
    }

    const data = await response.json() as any;
    const warnings: string[] = [];
    let hasBlacklistHistory = false;
    let maliciousActivity = false;

    if (data.result) {
      const result = data.result[address.toLowerCase()] || data.result[address] || {};
      
      if (result.blacklist_doubt === '1') {
        hasBlacklistHistory = true;
        warnings.push('🚨 Address flagged in blacklists');
      }
      if (result.honeypot_related_address === '1') {
        maliciousActivity = true;
        warnings.push('⚠️ Related to honeypot activity');
      }
      if (result.phishing_activities === '1') {
        maliciousActivity = true;
        warnings.push('🎣 Phishing activity detected');
      }
      if (result.stealing_attack === '1') {
        maliciousActivity = true;
        warnings.push('💀 Associated with theft');
      }
      if (result.fake_token === '1') {
        warnings.push('🪙 Created fake tokens');
      }
    }

    return { hasBlacklistHistory, maliciousActivity, warnings };
  } catch (error) {
    // API not available or timeout - continue with on-chain checks
    return null;
  }
}

// Enhanced deployer check with token analysis
async function checkIfDeployerEnhanced(address: string): Promise<{
  isDeployer: boolean;
  deployedTokens: string[];
  tokenAnalysis: DeployedTokenInfo[];
}> {
  const deployedTokens: string[] = [];
  const tokenAnalysis: DeployedTokenInfo[] = [];
  
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // Get more transactions to find all deployed tokens (optimized)
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 50 }); // Optimized for speed
    
    for (const sigInfo of signatures.slice(0, 50)) {
      try {
        const tx = await conn.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        
        if (!tx?.meta || !tx.transaction) continue;
        
        // Look for InitializeMint instructions (token creation)
        const checkInstruction = (ix: any) => {
          if ('parsed' in ix && ix.parsed) {
            const parsed = ix.parsed as any;
            if (parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') {
              const mintAddress = parsed.info?.mint;
              if (mintAddress && !deployedTokens.includes(mintAddress)) {
                deployedTokens.push(mintAddress);
              }
            }
          }
        };
        
        // Check main instructions
        for (const ix of tx.transaction.message.instructions) {
          checkInstruction(ix);
        }
        
        // Check inner instructions
        if (tx.meta.innerInstructions) {
          for (const inner of tx.meta.innerInstructions) {
            for (const ix of inner.instructions) {
              checkInstruction(ix);
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Analyze each deployed token for rugpull indicators
    for (const mint of deployedTokens.slice(0, 10)) { // Limit to 10 for performance
      try {
        const analysis = await analyzeDeployedToken(mint, address);
        tokenAnalysis.push(analysis);
      } catch (e) {
        tokenAnalysis.push({
          mint,
          hasLiquidity: false,
          liquidityPulled: false,
          mintAuthorityRevoked: false,
          freezeAuthorityRevoked: false,
          isRugpull: false,
          rugpullIndicators: [],
        });
      }
    }
  } catch (error) {
    logger.error('Error checking deployer status:', error);
  }
  
  return {
    isDeployer: deployedTokens.length > 0,
    deployedTokens,
    tokenAnalysis,
  };
}

// Analyze a deployed token for rugpull indicators
async function analyzeDeployedToken(mint: string, deployer: string): Promise<DeployedTokenInfo> {
  const result: DeployedTokenInfo = {
    mint,
    hasLiquidity: false,
    liquidityPulled: false,
    mintAuthorityRevoked: false,
    freezeAuthorityRevoked: false,
    isRugpull: false,
    rugpullIndicators: [],
  };
  
  try {
    const conn = getConnection();
    const mintPubkey = new PublicKey(mint);
    
    // Try to get token creation date from deployer's transaction history
    try {
      const deployerSigs = await conn.getSignaturesForAddress(new PublicKey(deployer), { limit: 30 }); // Optimized
      
      // Find the transaction where this token mint was created
      for (const sig of deployerSigs) {
        if (!result.createdAt) {
          try {
            const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
            if (!tx) continue;
            
            // Check if this transaction created the token mint
            for (const ix of tx.transaction.message.instructions) {
              if ('parsed' in ix && ix.parsed) {
                const parsed = ix.parsed as any;
                if ((parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') && 
                    parsed.info?.mint === mint && sig.blockTime) {
                  result.createdAt = new Date(sig.blockTime * 1000);
                  break;
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e) {
      // Ignore timestamp fetching errors
    }
    
    // Try to fetch token metadata (name/symbol)
    try {
      const { getTokenInfo } = await import('./blockchain');
      const tokenInfo = await getTokenInfo(mint);
      if (tokenInfo) {
        result.name = tokenInfo.name;
        result.symbol = tokenInfo.symbol;
      }
    } catch (e) {
      // Continue without metadata
    }
    
    // Get mint account info
    const mintInfo = await conn.getParsedAccountInfo(mintPubkey);
    
    if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
      const data = mintInfo.value.data.parsed as any;
      
      // Check mint authority
      if (data.info?.mintAuthority === null) {
        result.mintAuthorityRevoked = true;
      } else if (data.info?.mintAuthority === deployer) {
        result.rugpullIndicators.push('Deployer still has mint authority');
      }
      
      // Check freeze authority
      if (data.info?.freezeAuthority === null) {
        result.freezeAuthorityRevoked = true;
      } else if (data.info?.freezeAuthority === deployer) {
        result.rugpullIndicators.push('Deployer can freeze accounts');
      }
    }
    
    // Check token supply and holder distribution
    const largestAccounts = await conn.getTokenLargestAccounts(mintPubkey);
    if (largestAccounts.value.length > 0) {
      const totalSupply = largestAccounts.value.reduce((sum, acc) => sum + Number(acc.amount), 0);
      const topHolder = Number(largestAccounts.value[0].amount);
      
      if (totalSupply > 0) {
        const topHolderPercentage = (topHolder / totalSupply) * 100;
        result.topHolderPercentage = topHolderPercentage;
        
        // Check for concentrated holdings (rugpull indicator)
        if (topHolderPercentage > 50) {
          result.rugpullIndicators.push(`Top holder owns ${topHolderPercentage.toFixed(1)}% of supply`);
        }
        
        // Check if top holder is the deployer
        const topHolderAccount = largestAccounts.value[0];
        if (topHolderAccount) {
          try {
            const accountInfo = await conn.getParsedAccountInfo(topHolderAccount.address);
            if (accountInfo.value?.data && 'parsed' in accountInfo.value.data) {
              const owner = (accountInfo.value.data.parsed as any).info?.owner;
              if (owner === deployer && topHolderPercentage > 20) {
                result.rugpullIndicators.push(`Deployer holds ${topHolderPercentage.toFixed(1)}% of tokens`);
              }
            }
          } catch (e) {
            // Skip on error
          }
        }
      }
    }
    
    // Determine if this is likely a rugpull
    result.isRugpull = result.rugpullIndicators.length >= 2 || 
      result.rugpullIndicators.some(i => i.includes('50%') || i.includes('mint authority'));
      
  } catch (error) {
    logger.error('Error analyzing token: ' + mint.slice(0, 8), error);
  }
  
  return result;
}

// Trace funding chain - follow the money multiple hops back
async function traceFundingChain(address: string, maxHops: number = 3): Promise<{
  source: string | null;
  chain: string[];
  risk: RiskLevel;
}> {
  const chain: string[] = [address];
  let currentAddress = address;
  let riskLevel: RiskLevel = 'low';
  
  try {
    const conn = getConnection();
    
    for (let hop = 0; hop < maxHops; hop++) {
      const publicKey = new PublicKey(currentAddress);
      
      // Get oldest transactions
      let allSignatures: any[] = [];
      let lastSignature: string | undefined;
      
      while (true) {
        const options: { limit: number; before?: string } = { limit: 1000 };
        if (lastSignature) options.before = lastSignature;
        
        const sigs = await conn.getSignaturesForAddress(publicKey, options);
        if (sigs.length === 0) break;
        
        allSignatures = allSignatures.concat(sigs);
        lastSignature = sigs[sigs.length - 1].signature;
        
        if (allSignatures.length >= 3000) break;
        if (sigs.length < 1000) break;
      }
      
      if (allSignatures.length === 0) break;
      
      // Get the oldest transaction (first funding)
      // Check array is not empty before accessing
      if (allSignatures.length === 0) break;
      
      const oldestSig = allSignatures[allSignatures.length - 1];
      const tx = await conn.getParsedTransaction(oldestSig.signature, {
        maxSupportedTransactionVersion: 0,
      });
      
      if (!tx?.transaction) break;
      
      // Find the sender
      const accountKeys = tx.transaction.message.accountKeys;
      let funder: string | null = null;
      
      for (const key of accountKeys) {
        if (key.signer && key.pubkey.toBase58() !== currentAddress) {
          funder = key.pubkey.toBase58();
          break;
        }
      }
      
      if (!funder || chain.includes(funder)) break;
      
      chain.push(funder);
      currentAddress = funder;
      
      // Check if this funder is suspicious
      const funderAge = await getWalletAge(funder);
      // Check both null/undefined and ensure it's a valid number
      if (funderAge != null && !isNaN(funderAge) && funderAge < 7) {
        riskLevel = 'high';
      }
      
      // Check if funder is a known deployer
      const deployerCheck = await checkIfDeployerEnhanced(funder);
      if (deployerCheck.deployedTokens.length > 5) {
        riskLevel = 'critical';
      }
    }
  } catch (error) {
    logger.error('Error tracing funding chain:', error);
  }
  
  return {
    source: chain.length > 1 ? chain[chain.length - 1] : null,
    chain: chain.slice(1), // Exclude the original address
    risk: riskLevel,
  };
}

// Get wallet age in days
async function getWalletAge(address: string): Promise<number | null> {
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // Get oldest signature
    let allSignatures: any[] = [];
    let lastSignature: string | undefined;
    
    while (true) {
      const options: { limit: number; before?: string } = { limit: 1000 };
      if (lastSignature) options.before = lastSignature;
      
      const sigs = await conn.getSignaturesForAddress(publicKey, options);
      if (sigs.length === 0) break;
      
      allSignatures = allSignatures.concat(sigs);
      lastSignature = sigs[sigs.length - 1].signature;
      
      if (allSignatures.length >= 3000) break;
      if (sigs.length < 1000) break;
    }
    
    // Check array is not empty before accessing
    if (allSignatures.length === 0) {
      return null;
    }
    
    const oldestSig = allSignatures[allSignatures.length - 1];
    if (oldestSig?.blockTime) {
      const ageMs = Date.now() - (oldestSig.blockTime * 1000);
      return Math.floor(ageMs / (1000 * 60 * 60 * 24));
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Analyze wallet activity patterns
async function analyzeWalletActivity(address: string): Promise<WalletActivityAnalysis | null> {
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // Get recent transactions
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 100 }); // Optimized for speed
    
    if (signatures.length === 0) return null;
    
    const result: WalletActivityAnalysis = {
      totalTransactions: signatures.length,
      accountAge: 0,
      avgDailyTransactions: 0,
      largestOutflow: 0,
      largestInflow: 0,
      uniqueInteractions: 0,
      suspiciousTimingCount: 0,
      rapidFireTransactions: 0,
    };
    
    // Calculate account age
    const oldestSig = signatures[signatures.length - 1];
    const newestSig = signatures[0];
    
    if (oldestSig.blockTime) {
      const ageMs = Date.now() - (oldestSig.blockTime * 1000);
      result.accountAge = Math.max(1, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
      result.avgDailyTransactions = signatures.length / result.accountAge;
    }
    
    // Analyze transaction timing for suspicious patterns
    const uniqueAddresses = new Set<string>();
    let lastTxTime = 0;
    let rapidFireCount = 0;
    
    for (let i = 0; i < Math.min(signatures.length, 100); i++) {
      const sig = signatures[i];
      
      // Check for rapid-fire transactions (< 10 seconds apart)
      if (sig.blockTime && lastTxTime > 0) {
        const timeDiff = lastTxTime - sig.blockTime;
        if (timeDiff < 10) {
          rapidFireCount++;
        }
      }
      lastTxTime = sig.blockTime || 0;
      
      // Get transaction details for value analysis
      try {
        const tx = await conn.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });
        
        if (tx?.meta && tx.transaction) {
          const accountKeys = tx.transaction.message.accountKeys;
          const preBalances = tx.meta.preBalances;
          const postBalances = tx.meta.postBalances;
          
          const ourIndex = accountKeys.findIndex(k => k.pubkey.toBase58() === address);
          if (ourIndex !== -1) {
            const change = (postBalances[ourIndex] - preBalances[ourIndex]) / LAMPORTS_PER_SOL;
            
            if (change > 0 && change > result.largestInflow) {
              result.largestInflow = change;
            } else if (change < 0 && Math.abs(change) > result.largestOutflow) {
              result.largestOutflow = Math.abs(change);
            }
          }
          
          // Track unique interactions
          for (const key of accountKeys) {
            const addr = key.pubkey.toBase58();
            if (addr !== address && !addr.startsWith('1111') && !addr.startsWith('Token')) {
              uniqueAddresses.add(addr);
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    result.rapidFireTransactions = rapidFireCount;
    result.uniqueInteractions = uniqueAddresses.size;
    
    // Check for suspicious timing patterns (transactions at exact intervals)
    if (signatures.length >= 10) {
      const intervals: number[] = [];
      for (let i = 0; i < Math.min(signatures.length - 1, 20); i++) {
        const currentTime = signatures[i].blockTime;
        const nextTime = signatures[i + 1].blockTime;
        if (currentTime !== null && currentTime !== undefined && nextTime !== null && nextTime !== undefined) {
          intervals.push(currentTime - nextTime);
        }
      }
      
      // Check if intervals are suspiciously regular (bot behavior)
      if (intervals.length >= 5) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const regularCount = intervals.filter(i => Math.abs(i - avgInterval) < 5).length;
        if (regularCount > intervals.length * 0.7) {
          result.suspiciousTimingCount = regularCount;
        }
      }
    }
    
    return result;
  } catch (error) {
    logger.error('Error analyzing wallet activity:', error);
    return null;
  }
}

// Enhanced connected wallet finder with timing info
interface ConnectedWalletData {
  sent: number;
  received: number;
  count: number;
  firstTime?: number;
  lastTime?: number;
  txSignatures: string[];
}

async function findConnectedWalletsEnhanced(address: string): Promise<Map<string, ConnectedWalletData>> {
  const connections = new Map<string, ConnectedWalletData>();
  
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // Get more transactions for better analysis (optimized)
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 50 }); // Optimized for speed
    
    for (const sigInfo of signatures.slice(0, 50)) {
      try {
        const tx = await conn.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        
        if (!tx?.meta || !tx.transaction) continue;
        
        const accountKeys = tx.transaction.message.accountKeys;
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;
        const txTime = sigInfo.blockTime || 0;
        
        const ourIndex = accountKeys.findIndex(k => k.pubkey.toBase58() === address);
        if (ourIndex === -1) continue;
        
        const ourChange = (postBalances[ourIndex] - preBalances[ourIndex]) / LAMPORTS_PER_SOL;
        
        for (let i = 0; i < accountKeys.length; i++) {
          if (i === ourIndex) continue;
          
          const otherAddr = accountKeys[i].pubkey.toBase58();
          
          // Skip system accounts
          if (otherAddr.startsWith('1111') || otherAddr.startsWith('Token') || 
              otherAddr.startsWith('Sysvar') || otherAddr.startsWith('Compute') ||
              otherAddr.startsWith('So1') || otherAddr.startsWith('Vote')) {
            continue;
          }
          
          const otherChange = (postBalances[i] - preBalances[i]) / LAMPORTS_PER_SOL;
          
          if (Math.abs(otherChange) < 0.001 && Math.abs(ourChange) < 0.001) continue;
          
          const existing = connections.get(otherAddr) || { 
            sent: 0, received: 0, count: 0, txSignatures: [] 
          };
          existing.count++;
          existing.txSignatures.push(sigInfo.signature);
          
          // Track timing
          if (!existing.firstTime || txTime < existing.firstTime) {
            existing.firstTime = txTime;
          }
          if (!existing.lastTime || txTime > existing.lastTime) {
            existing.lastTime = txTime;
          }
          
          if (ourChange > 0 && otherChange < 0) {
            existing.received += Math.abs(ourChange);
          } else if (ourChange < 0 && otherChange > 0) {
            existing.sent += Math.abs(ourChange);
          }
          
          connections.set(otherAddr, existing);
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    logger.error('Error finding connected wallets:', error);
  }
  
  return connections;
}

// Enhanced connected wallet analysis
async function analyzeConnectedWalletsEnhanced(
  connections: Map<string, ConnectedWalletData>,
  originalAddress: string
): Promise<ConnectedWallet[]> {
  const results: ConnectedWallet[] = [];
  
  // Sort by total value and interaction count
  const sorted = Array.from(connections.entries())
    .filter(([addr, data]) => data.count >= 2 || data.sent > 0.5 || data.received > 0.5)
    .sort((a, b) => {
      const aTotal = a[1].sent + a[1].received + a[1].count;
      const bTotal = b[1].sent + b[1].received + b[1].count;
      return bTotal - aTotal;
    })
    .slice(0, 15);
  
  for (const [addr, data] of sorted) {
    try {
      // Quick deployer check (limited transactions for speed)
      const deployerCheck = await quickDeployerCheck(addr);
      
      // Check GoPlus for this connected wallet
      const goPlusCheck = await checkGoPlusSecurity(addr);
      
      // Detect rug involvements for this wallet (cached)
      const rugCheck = await detectRugInvolvementsFast(addr);
      
      const riskReasons: string[] = [];
      let riskScore = 0;
      let pattern: string | undefined;
      
      // RUG DETECTION - Highest priority
      if (rugCheck.isLpRugger) {
        riskReasons.push('🚨 LP RUGGER: Has pulled liquidity from pools');
        riskScore += 70;
        pattern = '🔴 LP Rugger';
      }
      
      if (rugCheck.isHoneypotCreator) {
        riskReasons.push('🍯 HONEYPOT CREATOR: Created tokens that trap buyers');
        riskScore += 70;
        pattern = '🍯 Honeypot Creator';
      }
      
      // Add specific rug involvement details
      for (const rug of rugCheck.rugInvolvements.slice(0, 3)) {
        const mintShort = `${rug.tokenMint.slice(0, 6)}...${rug.tokenMint.slice(-4)}`;
        const rugTypeLabel = getRugTypeLabel(rug.rugType);
        
        if (rug.role === 'deployer') {
          riskReasons.push(`💀 ${rugTypeLabel}: Deployed rugged token ${mintShort}`);
          riskScore += 40;
        } else if (rug.role === 'lp_remover') {
          riskReasons.push(`💧 Removed LP: ${rug.amount?.toFixed(2) || '?'} XNT from ${mintShort}`);
          riskScore += 50;
        } else if (rug.role === 'dumper') {
          riskReasons.push(`📉 Dumped tokens: ${mintShort}`);
          riskScore += 30;
        }
      }
      
      if (rugCheck.rugCount > 3) {
        riskReasons.push(`⚠️ Involved in ${rugCheck.rugCount} rug incidents total`);
        riskScore += 20;
      }
      
      // Deployer analysis with severity
      if (deployerCheck.isDeployer && !rugCheck.isLpRugger && !rugCheck.isHoneypotCreator) {
        const tokenCount = deployerCheck.tokenCount;
        if (tokenCount > 10) {
          riskReasons.push(`🚨 Serial deployer: ${tokenCount}+ tokens (HIGH RISK)`);
          riskScore += 60;
          if (!pattern) pattern = 'Serial Token Deployer';
        } else if (tokenCount > 3) {
          riskReasons.push(`⚠️ Multiple tokens deployed: ${tokenCount}`);
          riskScore += 35;
          if (!pattern) pattern = 'Token Deployer';
        } else {
          riskReasons.push(`📝 Token deployer: ${tokenCount} token(s)`);
          riskScore += 15;
        }
      }
      
      // GoPlus warnings
      if (goPlusCheck) {
        if (goPlusCheck.hasBlacklistHistory) {
          riskReasons.push('🚫 BLACKLISTED ADDRESS');
          riskScore += 50;
          if (!pattern) pattern = 'Known Scammer';
        }
        if (goPlusCheck.maliciousActivity) {
          riskReasons.push('💀 Malicious activity on record');
          riskScore += 45;
          if (!pattern) pattern = 'Malicious Actor';
        }
        riskReasons.push(...goPlusCheck.warnings);
      }
      
      // Value transfer analysis
      if (data.sent > 50) {
        riskReasons.push(`💸 Sent you ${data.sent.toFixed(2)} XNT`);
        if (!pattern) pattern = 'Major Funder';
      }
      if (data.received > 50) {
        riskReasons.push(`💸 Received ${data.received.toFixed(2)} XNT from you`);
        if (!pattern) pattern = 'Fund Recipient';
        riskScore += 5;
      }
      
      // Check for dump pattern (received large amount, many interactions)
      if (data.received > 10 && data.count > 5 && data.sent < 1) {
        riskReasons.push('📤 One-way outflow pattern (possible dump address)');
        riskScore += 20;
        if (!pattern) pattern = 'Dump Recipient';
      }
      
      // Check for wash trading pattern (back and forth)
      if (data.sent > 5 && data.received > 5 && data.count > 10) {
        riskReasons.push('🔄 Circular transaction pattern detected');
        riskScore += 25;
        if (!pattern) pattern = 'Wash Trading Partner';
      }
      
      // Determine risk level
      let riskLevel: RiskLevel = 'low';
      if (riskScore >= 60) riskLevel = 'critical';
      else if (riskScore >= 40) riskLevel = 'high';
      else if (riskScore >= 15) riskLevel = 'medium';
      
      results.push({
        address: addr,
        interactionCount: data.count,
        totalValueSent: data.sent,
        totalValueReceived: data.received,
        isDeployer: deployerCheck.isDeployer,
        deployedTokenCount: deployerCheck.tokenCount,
        riskLevel,
        riskReasons,
        firstInteraction: data.firstTime ? new Date(data.firstTime * 1000) : undefined,
        lastInteraction: data.lastTime ? new Date(data.lastTime * 1000) : undefined,
        pattern,
        rugInvolvements: rugCheck.rugInvolvements,
        isLpRugger: rugCheck.isLpRugger,
        isHoneypotCreator: rugCheck.isHoneypotCreator,
        rugCount: rugCheck.rugCount,
      });
    } catch (e) {
      continue;
    }
  }
  
  // Sort by risk level (critical/high first), then by rug count
  results.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
    const levelDiff = order[a.riskLevel] - order[b.riskLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.rugCount - a.rugCount;
  });
  
  return results;
}

// Get human-readable label for rug type
function getRugTypeLabel(rugType: RugType): string {
  switch (rugType) {
    case 'lp_pull': return 'LP RUG';
    case 'honeypot': return 'HONEYPOT';
    case 'mint_dump': return 'MINT & DUMP';
    case 'dev_dump': return 'DEV DUMP';
    case 'soft_rug': return 'SOFT RUG';
    case 'coordinated_dump': return 'COORDINATED DUMP';
    default: return 'UNKNOWN RUG';
  }
}

// ============================================
// OPTIMIZED FAST FUNCTIONS WITH CACHING
// ============================================

// Detect LP rug activity on a wallet
async function detectLpRugActivity(address: string): Promise<{
  isLpRugger: boolean;
  totalWithdrawn: number;
  lpBurns: number;
  largeDumps: number;
  evidence: string[];
}> {
  logger.info('Starting LP rug detection for: ' + address.slice(0, 8) + '...');
  
  const cacheKey = `lp_rug:${address}`;
  const cached = cache.get<{
    isLpRugger: boolean;
    totalWithdrawn: number;
    lpBurns: number;
    largeDumps: number;
    evidence: string[];
  }>(cacheKey);
  if (cached) {
    logger.info('⚡ Using cached LP rug result');
    return cached;
  }

  let totalLpWithdrawals = 0;
  let lpBurns = 0;
  let largeDumps = 0;
  const evidence: string[] = [];
  let lpRugTimestamp: number | null = null; // Track when LP was pulled

  try {
    const conn = getConnection();
    const signatures = await conn.getSignaturesForAddress(new PublicKey(address), { limit: 50 });
    
    const txPromises = signatures.slice(0, 30).map(sig =>
      withCache(CacheKeys.transaction(sig.signature), CacheTTL.VERY_LONG, async () => {
        try {
          return await conn.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
        } catch {
          return null;
        }
      })
    );
    
    const transactions = await Promise.all(txPromises);
    
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const sigInfo = signatures[i];
      if (!tx?.meta || !tx.transaction) continue;
      
      const accountKeys = tx.transaction.message.accountKeys;
      const involvedPrograms = accountKeys.map(k => k.pubkey.toBase58());
      
      const isAmmTx = involvedPrograms.some(p => DEX_PROGRAMS.includes(p));
      
      if (isAmmTx) {
        const ourIndex = accountKeys.findIndex(k => k.pubkey.toBase58() === address);
        if (ourIndex !== -1) {
          const balanceChange = (tx.meta.postBalances[ourIndex] - tx.meta.preBalances[ourIndex]) / LAMPORTS_PER_SOL;
          
          if (balanceChange > 5) {
            totalLpWithdrawals += balanceChange;
            // Capture the earliest LP withdrawal timestamp
            if (!lpRugTimestamp && sigInfo.blockTime) {
              lpRugTimestamp = sigInfo.blockTime;
            }
          }
          
          if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
            for (const pre of tx.meta.preTokenBalances) {
              if (pre.owner !== address) continue;
              
              const preAmount = Number(pre.uiTokenAmount.uiAmount || 0);
              const post = tx.meta.postTokenBalances.find(p => p.accountIndex === pre.accountIndex);
              const postAmount = post ? Number(post.uiTokenAmount.uiAmount || 0) : 0;
              
              // LP token burn: large amount going to 0 or near 0
              // Lowered threshold from 1M to 100 tokens - even small LP positions matter
              if (preAmount > 100 && postAmount < preAmount * 0.01) {
                lpBurns++;
                // Capture burn timestamp
                if (!lpRugTimestamp && sigInfo.blockTime) {
                  lpRugTimestamp = sigInfo.blockTime;
                }
              }
              
              // Full dump: 100% of tokens sold (from any amount > 1)
              if (preAmount > 1 && postAmount === 0) {
                largeDumps++;
                // Capture dump timestamp
                if (!lpRugTimestamp && sigInfo.blockTime) {
                  lpRugTimestamp = sigInfo.blockTime;
                }
              }
              // Large dump: >90% sold (more aggressive than 50%)
              else if (preAmount > 10 && postAmount < preAmount * 0.1) {
                largeDumps++;
                // Capture dump timestamp
                if (!lpRugTimestamp && sigInfo.blockTime) {
                  lpRugTimestamp = sigInfo.blockTime;
                }
              }
            }
          }
        }
      }
    }
    
    if (totalLpWithdrawals > 0) {
      evidence.push(`Withdrew ~${totalLpWithdrawals.toFixed(2)} XNT from LP`);
    }
    if (lpBurns > 0) {
      evidence.push(`Burned LP tokens ${lpBurns} time(s)`);
    }
    if (largeDumps > 0) {
      evidence.push(`${largeDumps} large token dumps`);
    }
    
  } catch (error) {
    logger.error('Error detecting LP rug:', error);
  }
  
  // Improved LP rugger detection logic:
  // - Any LP withdrawal > 5 XNT combined with a large dump is suspicious
  // - Multiple large dumps indicate rug behavior
  // - Any LP burn is a red flag
  const isLpRugger = totalLpWithdrawals > 10 || 
                     lpBurns > 0 || 
                     (totalLpWithdrawals > 3 && largeDumps >= 1) ||
                     largeDumps >= 2;
  
  logger.info(`💧 LP Detection results: withdrawn=${totalLpWithdrawals.toFixed(2)}, burns=${lpBurns}, dumps=${largeDumps}, isRugger=${isLpRugger}`);
  
  const result = {
    isLpRugger,
    totalWithdrawn: totalLpWithdrawals,
    lpBurns,
    largeDumps,
    evidence,
    timestamp: lpRugTimestamp, // Include timestamp in result
  };
  
  cache.set(cacheKey, result, CacheTTL.MEDIUM);
  return result;
}

// Cached GoPlus security check
async function checkGoPlusSecurityCached(address: string): Promise<{
  hasBlacklistHistory: boolean;
  maliciousActivity: boolean;
  warnings: string[];
} | null> {
  const cacheKey = `goplus:${address}`;
  return withCache(cacheKey, CacheTTL.MEDIUM, () => checkGoPlusSecurity(address));
}

// Fast deployer check - IMPROVED: scans multiple batches to find token deployments
async function checkIfDeployerFast(address: string): Promise<{
  isDeployer: boolean;
  deployedTokens: string[];
  tokenAnalysis: DeployedTokenInfo[];
}> {
  const cacheKey = CacheKeys.deployerStatus(address);
  const cached = cache.get<{
    isDeployer: boolean;
    deployedTokens: string[];
    tokenAnalysis: DeployedTokenInfo[];
  }>(cacheKey);
  if (cached) return cached;

  const deployedTokens: string[] = [];
  const tokenAnalysis: DeployedTokenInfo[] = [];
  
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // IMPROVED: Get multiple batches of signatures to scan deeper into history
    // Scan from OLDEST to newest since token deployments are usually early in wallet history
    let allSignatures: any[] = [];
    
    // Get first 100 (recent activity)
    const recentSigs = await conn.getSignaturesForAddress(publicKey, { limit: 30 }); // Optimized
    allSignatures = recentSigs;
    
    // If wallet has many transactions, paginate deeper to find early deployments
    if (recentSigs.length >= 100) {
      try {
        // Adaptive depth: scan deeper for very active wallets
        // Start with 30 batches, but if we keep finding full batches, go even deeper
        let lastSig = recentSigs[recentSigs.length - 1].signature;
        const maxBatches = 30; // Up to 3000 more transactions
        
        for (let batch = 0; batch < maxBatches; batch++) {
          const olderSigs = await conn.getSignaturesForAddress(publicKey, { 
            limit: 100, 
            before: lastSig 
          });
          if (olderSigs.length === 0) break;
          allSignatures = allSignatures.concat(olderSigs);
          lastSig = olderSigs[olderSigs.length - 1].signature;
          
          // If we got less than 100, we've reached the end of the wallet's history
          if (olderSigs.length < 100) break;
        }
      } catch (e) {
        // Continue with what we have
      }
    }
    
    logger.info(`🔍 Scanning ${allSignatures.length} signatures for deployments...`);
    
    // Create a reversed copy to scan from oldest first (deployments are typically early)
    // Don't mutate the original allSignatures array
    const reversedSignatures = [...allSignatures].reverse();
    
    // PARALLEL: Fetch transactions in batches
    // For very active wallets, process more transactions to find early deployments
    const txLimit = Math.min(reversedSignatures.length, 400); // Up to 400 transactions
    logger.info(`🔍 Processing ${txLimit} transactions from oldest history...`);
    
    const txPromises = reversedSignatures.slice(0, txLimit).map(async (sigInfo) => {
      const txCacheKey = CacheKeys.transaction(sigInfo.signature);
      return withCache(txCacheKey, CacheTTL.VERY_LONG, async () => {
        try {
          return await conn.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });
        } catch {
          return null;
        }
      });
    });
    
    const transactions = await Promise.all(txPromises);
    
    // Analyze transactions for token deployments
    for (const tx of transactions) {
      if (!tx?.meta || !tx.transaction) continue;
      
      // IMPORTANT: Only count tokens where this address was the deployer
      // Check if this wallet was the fee payer (transaction signer)
      const accountKeys = tx.transaction.message.accountKeys;
      const feePayer = accountKeys[0]?.pubkey.toBase58();
      const isFeePayer = feePayer === address;
      
      // Skip if this wallet didn't initiate the transaction
      if (!isFeePayer) continue;
      
      const checkInstruction = (ix: any) => {
        if ('parsed' in ix && ix.parsed) {
          const parsed = ix.parsed as any;
          if ((parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') && parsed.info?.mint) {
            // Additional verification: check if mint authority is set to this address
            const mintAuthority = parsed.info?.mintAuthority;
            const isMintAuthority = !mintAuthority || mintAuthority === address;
            
            // Only count if this address is the fee payer AND (mint authority or not specified)
            if (isMintAuthority && !deployedTokens.includes(parsed.info.mint)) {
              deployedTokens.push(parsed.info.mint);
              logger.info(`🪙 Found deployed token: ${parsed.info.mint.slice(0, 8)}... (deployed by ${address.slice(0, 8)}...)`);
            }
          }
        }
      };
      
      for (const ix of tx.transaction.message.instructions) {
        checkInstruction(ix);
      }
      
      if (tx.meta.innerInstructions) {
        for (const inner of tx.meta.innerInstructions) {
          for (const ix of inner.instructions) {
            checkInstruction(ix);
          }
        }
      }
    }
    
    // PARALLEL: Analyze deployed tokens (limit to 5)
    if (deployedTokens.length > 0) {
      const analysisPromises = deployedTokens.slice(0, 5).map(mint => 
        analyzeDeployedTokenCached(mint, address)
      );
      const analyses = await Promise.all(analysisPromises);
      tokenAnalysis.push(...analyses);
    }
  } catch (error) {
    logger.error('Error in fast deployer check:', error);
  }
  
  const result = {
    isDeployer: deployedTokens.length > 0,
    deployedTokens,
    tokenAnalysis,
  };
  
  cache.set(cacheKey, result, CacheTTL.MEDIUM);
  return result;
}

// Cached token analysis
async function analyzeDeployedTokenCached(mint: string, deployer: string): Promise<DeployedTokenInfo> {
  const cacheKey = CacheKeys.tokenAnalysis(mint);
  return withCache(cacheKey, CacheTTL.LONG, () => analyzeDeployedToken(mint, deployer));
}

// Fast funding chain trace - reduced hops
async function traceFundingChainFast(address: string, maxHops: number = 2): Promise<{
  source: string | null;
  chain: string[];
  risk: RiskLevel;
}> {
  const chain: string[] = [address];
  let currentAddress = address;
  let riskLevel: RiskLevel = 'low';
  
  try {
    const conn = getConnection();
    
    for (let hop = 0; hop < maxHops; hop++) {
      const publicKey = new PublicKey(currentAddress);
      
      // REDUCED: Only get 100 signatures to find oldest
      const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 100 });
      
      if (signatures.length === 0) break;
      
      // Get oldest transaction
      const oldestSig = signatures[signatures.length - 1];
      
      const tx = await withCache(
        CacheKeys.transaction(oldestSig.signature),
        CacheTTL.VERY_LONG,
        async () => {
          try {
            return await conn.getParsedTransaction(oldestSig.signature, {
              maxSupportedTransactionVersion: 0,
            });
          } catch {
            return null;
          }
        }
      );
      
      if (!tx?.transaction) break;
      
      // Find the sender (who funded this wallet)
      const accountKeys = tx.transaction.message.accountKeys;
      let funder: string | null = null;
      
      // Known program addresses to exclude (these are not wallet funders)
      const KNOWN_PROGRAMS = new Set([
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022 Program
        'memoX1sJsBY6od7CfQ58XooRALwnocAZen4L7mW1ick', // Memo Program
        '11111111111111111111111111111111', // System Program
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
        'ComputeBudget111111111111111111111111111111', // Compute Budget Program
        'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', // Memo Program (old)
      ]);
      
      // Helper function to check if address is a token account (not a real wallet)
      const isTokenAccount = async (addr: string): Promise<boolean> => {
        try {
          const accountInfo = await conn.getAccountInfo(new PublicKey(addr));
          if (!accountInfo) return false;
          
          // Check if owned by Token or Token-2022 program
          const owner = accountInfo.owner.toBase58();
          return owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' || 
                 owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
        } catch {
          return false;
        }
      };
      
      // Check for signers first (most reliable)
      for (const key of accountKeys) {
        const addr = key.pubkey.toBase58();
        
        // Skip if it's a known program address
        if (KNOWN_PROGRAMS.has(addr)) continue;
        
        if (key.signer && addr !== currentAddress) {
          // Check if this is a token account before accepting as funder
          const isToken = await isTokenAccount(addr);
          if (!isToken) {
            funder = addr;
            break;
          }
        }
      }
      
      // If no signer found, check for writable accounts (might be the funder)
      if (!funder) {
        for (const key of accountKeys) {
          const addr = key.pubkey.toBase58();
          
          // Skip if it's a known program address
          if (KNOWN_PROGRAMS.has(addr)) continue;
          
          if (key.writable && addr !== currentAddress && !addr.startsWith('11111111')) {
            // Check if this is a token account before accepting as funder
            const isToken = await isTokenAccount(addr);
            if (!isToken) {
              funder = addr;
              break;
            }
          }
        }
      }
      
      if (!funder) break;
      
      if (chain.includes(funder)) break;
      
      chain.push(funder);
      currentAddress = funder;
    }
  } catch (error) {
    logger.error('Error tracing funding chain:', error);
  }
  
  return {
    source: chain.length > 1 ? chain[chain.length - 1] : null,
    chain: chain.slice(1),
    risk: riskLevel,
  };
}

// Fast wallet activity analysis - reduced scope
async function analyzeWalletActivityFast(address: string): Promise<WalletActivityAnalysis | null> {
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // REDUCED: Only 100 signatures (was 500)
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 100 });
    
    if (signatures.length === 0) return null;
    
    const result: WalletActivityAnalysis = {
      totalTransactions: signatures.length,
      accountAge: 0,
      avgDailyTransactions: 0,
      largestOutflow: 0,
      largestInflow: 0,
      uniqueInteractions: 0,
      suspiciousTimingCount: 0,
      rapidFireTransactions: 0,
    };
    
    // Calculate account age from signatures
    const oldestSig = signatures[signatures.length - 1];
    if (oldestSig.blockTime) {
      const ageMs = Date.now() - (oldestSig.blockTime * 1000);
      result.accountAge = Math.max(1, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
      result.avgDailyTransactions = signatures.length / result.accountAge;
    }
    
    // REDUCED: Only analyze 20 transactions for patterns (was 100)
    const uniqueAddresses = new Set<string>();
    let lastTxTime = 0;
    let rapidFireCount = 0;
    
    // PARALLEL: Fetch transaction details in batch
    const txPromises = signatures.slice(0, 20).map(sig => 
      withCache(CacheKeys.transaction(sig.signature), CacheTTL.VERY_LONG, async () => {
        try {
          return await conn.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
        } catch {
          return null;
        }
      })
    );
    
    const transactions = await Promise.all(txPromises);
    
    for (let i = 0; i < signatures.length && i < 20; i++) {
      const sig = signatures[i];
      const tx = transactions[i];
      
      // Check for rapid-fire transactions
      if (sig.blockTime && lastTxTime > 0) {
        const timeDiff = lastTxTime - sig.blockTime;
        if (timeDiff < 10) rapidFireCount++;
      }
      lastTxTime = sig.blockTime || 0;
      
      if (!tx?.meta || !tx.transaction) continue;
      
      const accountKeys = tx.transaction.message.accountKeys;
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      
      const ourIndex = accountKeys.findIndex(k => k.pubkey.toBase58() === address);
      if (ourIndex !== -1) {
        const change = (postBalances[ourIndex] - preBalances[ourIndex]) / LAMPORTS_PER_SOL;
        
        if (change > 0 && change > result.largestInflow) {
          result.largestInflow = change;
        } else if (change < 0 && Math.abs(change) > result.largestOutflow) {
          result.largestOutflow = Math.abs(change);
        }
      }
      
      // Track unique interactions
      for (const key of accountKeys) {
        const addr = key.pubkey.toBase58();
        if (addr !== address && !addr.startsWith('1111') && !addr.startsWith('Token')) {
          uniqueAddresses.add(addr);
        }
      }
    }
    
    result.rapidFireTransactions = rapidFireCount;
    result.uniqueInteractions = uniqueAddresses.size;
    
    return result;
  } catch (error) {
    logger.error('Error analyzing wallet activity:', error);
    return null;
  }
}

// Fast connected wallets finder - reduced depth
async function findConnectedWalletsFast(address: string): Promise<Map<string, ConnectedWalletData>> {
  const connections = new Map<string, ConnectedWalletData>();
  
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // REDUCED: Only 50 signatures (was 200)
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 50 });
    
    // PARALLEL: Fetch transactions in batch
    const txPromises = signatures.slice(0, 30).map(sigInfo => 
      withCache(CacheKeys.transaction(sigInfo.signature), CacheTTL.VERY_LONG, async () => {
        try {
          return { 
            tx: await conn.getParsedTransaction(sigInfo.signature, {
              maxSupportedTransactionVersion: 0,
            }),
            blockTime: sigInfo.blockTime
          };
        } catch {
          return null;
        }
      })
    );
    
    const results = await Promise.all(txPromises);
    
    for (const result of results) {
      if (!result?.tx?.meta || !result.tx.transaction) continue;
      
      const tx = result.tx;
      const txMeta = tx.meta;
      if (!txMeta) continue;
      
      const txTime = result.blockTime || 0;
      const accountKeys = tx.transaction.message.accountKeys;
      const preBalances = txMeta.preBalances;
      const postBalances = txMeta.postBalances;
      
      const ourIndex = accountKeys.findIndex(k => k.pubkey.toBase58() === address);
      if (ourIndex === -1) continue;
      
      const ourChange = (postBalances[ourIndex] - preBalances[ourIndex]) / LAMPORTS_PER_SOL;
      
      for (let i = 0; i < accountKeys.length; i++) {
        if (i === ourIndex) continue;
        
        const otherAddr = accountKeys[i].pubkey.toBase58();
        
        // Skip system accounts
        if (otherAddr.startsWith('1111') || otherAddr.startsWith('Token') || 
            otherAddr.startsWith('Sysvar') || otherAddr.startsWith('Compute') ||
            otherAddr.startsWith('So1') || otherAddr.startsWith('Vote')) {
          continue;
        }
        
        const otherChange = (postBalances[i] - preBalances[i]) / LAMPORTS_PER_SOL;
        
        if (Math.abs(otherChange) < 0.001 && Math.abs(ourChange) < 0.001) continue;
        
        const existing = connections.get(otherAddr) || { 
          sent: 0, received: 0, count: 0, txSignatures: [] 
        };
        existing.count++;
        
        if (!existing.firstTime || txTime < existing.firstTime) {
          existing.firstTime = txTime;
        }
        if (!existing.lastTime || txTime > existing.lastTime) {
          existing.lastTime = txTime;
        }
        
        if (ourChange > 0 && otherChange < 0) {
          existing.received += Math.abs(ourChange);
        } else if (ourChange < 0 && otherChange > 0) {
          existing.sent += Math.abs(ourChange);
        }
        
        connections.set(otherAddr, existing);
      }
    }
  } catch (error) {
    logger.error('Error finding connected wallets:', error);
  }
  
  return connections;
}

// ULTRA-FAST connected wallet analysis - minimal RPC calls
async function analyzeConnectedWalletsFast(
  connections: Map<string, ConnectedWalletData>,
  originalAddress: string
): Promise<ConnectedWallet[]> {
  const results: ConnectedWallet[] = [];
  
  // Only analyze TOP 5 connections by value/count (was 15)
  const sorted = Array.from(connections.entries())
    .filter(([addr, data]) => data.count >= 2 || data.sent > 1 || data.received > 1)
    .sort((a, b) => {
      const aTotal = a[1].sent + a[1].received + (a[1].count * 0.1);
      const bTotal = b[1].sent + b[1].received + (b[1].count * 0.1);
      return bTotal - aTotal;
    })
    .slice(0, 5); // REDUCED from 15 to 5
  
  // Run ALL wallet checks in PARALLEL
  const checkPromises = sorted.map(async ([addr, data]) => {
    try {
      // Use cached deployer check only - no rug detection for speed
      const deployerCheck = await quickDeployerCheckCached(addr);
      
      const riskReasons: string[] = [];
      let riskScore = 0;
      let pattern: string | undefined;
      
      // Quick deployer analysis
      if (deployerCheck.isDeployer) {
        const tokenCount = deployerCheck.tokenCount;
        if (tokenCount >= 10) {
          riskReasons.push(`🚨 Serial deployer: ${tokenCount}+ tokens`);
          riskScore += 60;
          pattern = 'Serial Deployer';
        } else if (tokenCount >= 3) {
          riskReasons.push(`⚠️ Deployed ${tokenCount} tokens`);
          riskScore += 30;
          pattern = 'Token Deployer';
        } else if (tokenCount > 0) {
          riskReasons.push(`📝 Deployed ${tokenCount} token`);
          riskScore += 10;
        }
      }
      
      // Value transfer analysis (no RPC needed)
      if (data.sent > 50) {
        riskReasons.push(`💸 Sent you ${data.sent.toFixed(1)} XNT`);
        if (!pattern) pattern = 'Major Funder';
      }
      if (data.received > 50) {
        riskReasons.push(`💸 Received ${data.received.toFixed(1)} XNT`);
        if (!pattern) pattern = 'Fund Recipient';
        riskScore += 5;
      }
      
      // Dump pattern
      if (data.received > 10 && data.count > 5 && data.sent < 1) {
        riskReasons.push('📤 One-way outflow');
        riskScore += 15;
        if (!pattern) pattern = 'Dump Recipient';
      }
      
      // Determine risk level
      let riskLevel: RiskLevel = 'low';
      if (riskScore >= 50) riskLevel = 'critical';
      else if (riskScore >= 30) riskLevel = 'high';
      else if (riskScore >= 10) riskLevel = 'medium';
      
      return {
        address: addr,
        interactionCount: data.count,
        totalValueSent: data.sent,
        totalValueReceived: data.received,
        isDeployer: deployerCheck.isDeployer,
        deployedTokenCount: deployerCheck.tokenCount,
        riskLevel,
        riskReasons,
        firstInteraction: data.firstTime ? new Date(data.firstTime * 1000) : undefined,
        lastInteraction: data.lastTime ? new Date(data.lastTime * 1000) : undefined,
        pattern,
        rugInvolvements: [],
        isLpRugger: false,
        isHoneypotCreator: false,
        rugCount: 0,
      } as ConnectedWallet;
    } catch (e) {
      return null;
    }
  });
  
  const walletResults = await Promise.all(checkPromises);
  
  for (const w of walletResults) {
    if (w) results.push(w);
  }
  
  // Sort by risk
  results.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
    return order[a.riskLevel] - order[b.riskLevel];
  });
  
  return results;
}

// Cached quick deployer check
async function quickDeployerCheckCached(address: string): Promise<{ isDeployer: boolean; tokenCount: number }> {
  const cacheKey = `quick_deployer:${address}`;
  const cached = cache.get<{ isDeployer: boolean; tokenCount: number }>(cacheKey);
  if (cached) return cached;
  
  const result = await quickDeployerCheck(address);
  cache.set(cacheKey, result, CacheTTL.MEDIUM);
  return result;
}

// Fast rug detection with caching - IMPROVED LP detection
async function detectRugInvolvementsFast(address: string): Promise<{
  rugInvolvements: RugInvolvement[];
  isLpRugger: boolean;
  isHoneypotCreator: boolean;
  rugCount: number;
}> {
  const cacheKey = CacheKeys.rugCheck(address);
  const cached = cache.get<{
    rugInvolvements: RugInvolvement[];
    isLpRugger: boolean;
    isHoneypotCreator: boolean;
    rugCount: number;
  }>(cacheKey);
  if (cached) return cached;

  const rugInvolvements: RugInvolvement[] = [];
  let isLpRugger = false;
  let isHoneypotCreator = false;
  
  try {
    // Quick deployer check first
    const deployerCheck = await quickDeployerCheck(address);
    
    if (deployerCheck.isDeployer && deployerCheck.tokenCount > 0) {
      // Check first few deployed tokens for rug patterns
      const deployedTokens = await getDeployedTokenMints(address, 3);
      
      for (const mint of deployedTokens) {
        try {
          const tokenAnalysis = await withCache(
            CacheKeys.tokenAnalysis(mint),
            CacheTTL.LONG,
            () => analyzeTokenForRugPatterns(mint, address)
          );
          
          if (tokenAnalysis.isRugged) {
            rugInvolvements.push({
              rugType: tokenAnalysis.rugType,
              tokenMint: mint,
              role: 'deployer',
              evidence: tokenAnalysis.evidence,
              timestamp: tokenAnalysis.timestamp ? new Date(tokenAnalysis.timestamp * 1000) : undefined,
            });
            
            if (tokenAnalysis.rugType === 'honeypot') {
              isHoneypotCreator = true;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    // IMPROVED LP rug detection
    const conn = getConnection();
    const signatures = await conn.getSignaturesForAddress(new PublicKey(address), { limit: 50 });
    
    // Track cumulative LP activity
    let totalLpWithdrawals = 0;
    let lpBurns = 0;
    let largeDumps = 0;
    
    // Check more transactions for LP patterns
    const txPromises = signatures.slice(0, 30).map(sig =>
      withCache(CacheKeys.transaction(sig.signature), CacheTTL.VERY_LONG, async () => {
        try {
          return await conn.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
        } catch {
          return null;
        }
      })
    );
    
    const transactions = await Promise.all(txPromises);
    
    for (const tx of transactions) {
      if (!tx?.meta || !tx.transaction) continue;
      
      const accountKeys = tx.transaction.message.accountKeys;
      const involvedPrograms = accountKeys.map(k => k.pubkey.toBase58());
      
      // Check if any DEX/AMM involved (including XDEX)
      const isAmmTx = involvedPrograms.some(p => DEX_PROGRAMS.includes(p));
      
      if (isAmmTx) {
        const ourIndex = accountKeys.findIndex(k => k.pubkey.toBase58() === address);
        if (ourIndex !== -1) {
          const preBalances = tx.meta.preBalances;
          const postBalances = tx.meta.postBalances;
          const balanceChange = (postBalances[ourIndex] - preBalances[ourIndex]) / LAMPORTS_PER_SOL;
          
          // Track XNT withdrawals from LP
          if (balanceChange > 5) {
            totalLpWithdrawals += balanceChange;
          }
          
          // Check for LP token burns (tokens going to 0)
          if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
            for (const pre of tx.meta.preTokenBalances) {
              if (pre.owner !== address) continue;
              
              const preAmount = Number(pre.uiTokenAmount.uiAmount || 0);
              const post = tx.meta.postTokenBalances.find(p => 
                p.accountIndex === pre.accountIndex
              );
              const postAmount = post ? Number(post.uiTokenAmount.uiAmount || 0) : 0;
              
              // LP token burn: large amount going to 0 or near 0
              // Lowered threshold from 1M to 100 tokens - even small LP positions matter
              if (preAmount > 100 && postAmount < preAmount * 0.01) {
                lpBurns++;
                logger.info(`🔍 LP burn detected: ${preAmount.toFixed(0)} -> ${postAmount.toFixed(0)}`);
              }
              
              // Full dump: 100% of tokens sold (from any amount > 1)
              if (preAmount > 1 && postAmount === 0) {
                largeDumps++;
              }
              // Large dump: >90% sold (more aggressive than 50%)
              else if (preAmount > 10 && postAmount < preAmount * 0.1) {
                largeDumps++;
              }
            }
          }
        }
      }
    }
    
    // Determine if LP rugger based on combined signals
    // Improved logic: lower thresholds to catch more rug patterns
    if (totalLpWithdrawals > 10 || 
        lpBurns > 0 || 
        (totalLpWithdrawals > 3 && largeDumps >= 1) ||
        largeDumps >= 2) {
      isLpRugger = true;
      
      const evidence: string[] = [];
      if (totalLpWithdrawals > 0) {
        evidence.push(`Withdrew ~${totalLpWithdrawals.toFixed(2)} XNT from liquidity`);
      }
      if (lpBurns > 0) {
        evidence.push(`Burned LP tokens ${lpBurns} time(s)`);
      }
      if (largeDumps > 0) {
        evidence.push(`Large token dumps: ${largeDumps}`);
      }
      
      rugInvolvements.push({
        rugType: 'lp_pull',
        tokenMint: 'XDEX LP',
        role: 'lp_remover',
        amount: totalLpWithdrawals,
        evidence,
      });
    }
    
  } catch (error) {
    logger.error('Error in fast rug detection:', error);
  }
  
  const result = {
    rugInvolvements,
    isLpRugger,
    isHoneypotCreator,
    rugCount: rugInvolvements.length,
  };
  
  cache.set(cacheKey, result, CacheTTL.MEDIUM);
  return result;
}

// Quick deployer check (faster, fewer transactions) - OPTIMIZED
async function quickDeployerCheck(address: string): Promise<{ isDeployer: boolean; tokenCount: number }> {
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // REDUCED: Only 20 signatures
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 20 });
    
    let tokenCount = 0;
    
    // PARALLEL: Fetch all transactions at once
    const txPromises = signatures.slice(0, 15).map(sigInfo =>
      withCache(CacheKeys.transaction(sigInfo.signature), CacheTTL.VERY_LONG, async () => {
        try {
          return await conn.getParsedTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });
        } catch {
          return null;
        }
      })
    );
    
    const transactions = await Promise.all(txPromises);
    
    for (const tx of transactions) {
      if (!tx?.meta || !tx.transaction) continue;
      
      for (const ix of tx.transaction.message.instructions) {
        if ('parsed' in ix && ix.parsed) {
          const parsed = ix.parsed as any;
          if (parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') {
            tokenCount++;
          }
        }
      }
    }
    
    return { isDeployer: tokenCount > 0, tokenCount };
  } catch (error) {
    return { isDeployer: false, tokenCount: 0 };
  }
}

// AMM Program IDs for LP detection
const RAYDIUM_AMM_V4 = 'HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8';
const RAYDIUM_CLMM = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
const ORCA_WHIRLPOOL = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
// X1 XDEX Programs
const XDEX_AMM = 'sEsYH97wqmfnkzHedjNcw3zyJdPvUmsa9AixhS4b4fN';
const XDEX_PROGRAM_2 = '9Dpjw2pB5kXJr6ZTHiqzEMfJPic3om9jgNacnwpLCoaU';
const XDEX_PROGRAM_3 = '81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ';
// All DEX programs for LP detection
const DEX_PROGRAMS = [RAYDIUM_AMM_V4, RAYDIUM_CLMM, ORCA_WHIRLPOOL, XDEX_AMM, XDEX_PROGRAM_2, XDEX_PROGRAM_3];

// Detect LP rug and other rug involvements for a wallet
async function detectRugInvolvements(address: string): Promise<{
  rugInvolvements: RugInvolvement[];
  isLpRugger: boolean;
  isHoneypotCreator: boolean;
  rugCount: number;
}> {
  const rugInvolvements: RugInvolvement[] = [];
  let isLpRugger = false;
  let isHoneypotCreator = false;
  
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    
    // Get transactions to analyze
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 100 });
    
    // Track LP interactions
    const lpRemovals: Map<string, { amount: number; timestamp: number }> = new Map();
    const lpAdditions: Map<string, { amount: number; timestamp: number }> = new Map();
    const tokenDumps: Map<string, { amount: number; timestamp: number }> = new Map();
    
    for (const sigInfo of signatures.slice(0, 60)) {
      try {
        const tx = await conn.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        
        if (!tx?.meta || !tx.transaction) continue;
        
        const accountKeys = tx.transaction.message.accountKeys;
        const instructions = tx.transaction.message.instructions;
        const timestamp = sigInfo.blockTime || 0;
        
        // Check for LP-related programs
        const involvedPrograms = accountKeys.map(k => k.pubkey.toBase58());
        const isRaydiumTx = involvedPrograms.some(p => 
          p === RAYDIUM_AMM_V4 || p === RAYDIUM_CLMM
        );
        const isOrcaTx = involvedPrograms.some(p => p === ORCA_WHIRLPOOL);
        
        if (isRaydiumTx || isOrcaTx) {
          // Analyze balance changes to detect LP add/remove
          const preBalances = tx.meta.preBalances;
          const postBalances = tx.meta.postBalances;
          
          const ourIndex = accountKeys.findIndex(k => k.pubkey.toBase58() === address);
          if (ourIndex !== -1) {
            const balanceChange = (postBalances[ourIndex] - preBalances[ourIndex]) / LAMPORTS_PER_SOL;
            
            // Large positive balance = likely LP removal (rug)
            if (balanceChange > 10) {
              // Try to find the token involved
              for (const ix of instructions) {
                if ('parsed' in ix && ix.parsed) {
                  const parsed = ix.parsed as any;
                  if (parsed.info?.mint) {
                    const mintKey = parsed.info.mint;
                    const existing = lpRemovals.get(mintKey) || { amount: 0, timestamp: 0 };
                    existing.amount += balanceChange;
                    existing.timestamp = timestamp;
                    lpRemovals.set(mintKey, existing);
                  }
                }
              }
              
              // If we can't find specific mint, record as general LP removal
              if (lpRemovals.size === 0) {
                lpRemovals.set('unknown_lp', { amount: balanceChange, timestamp });
              }
            }
            
            // Large negative balance = LP addition
            if (balanceChange < -10) {
              lpAdditions.set('lp_add_' + timestamp, { amount: Math.abs(balanceChange), timestamp });
            }
          }
        }
        
        // Check for large token transfers (potential dumps)
        if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
          for (let i = 0; i < tx.meta.preTokenBalances.length; i++) {
            const pre = tx.meta.preTokenBalances[i];
            const post = tx.meta.postTokenBalances.find(p => p.accountIndex === pre.accountIndex);
            
            if (pre && post && pre.owner === address) {
              const preAmount = Number(pre.uiTokenAmount.uiAmount || 0);
              const postAmount = Number(post.uiTokenAmount.uiAmount || 0);
              const diff = preAmount - postAmount;
              
              // Large token outflow = potential dump
              if (diff > 0 && preAmount > 0) {
                const percentageSold = (diff / preAmount) * 100;
                if (percentageSold > 50) {
                  const existing = tokenDumps.get(pre.mint) || { amount: 0, timestamp: 0 };
                  existing.amount += diff;
                  existing.timestamp = timestamp;
                  tokenDumps.set(pre.mint, existing);
                }
              }
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Analyze patterns to classify rug types
    
    // LP Rug detection: Added then quickly removed liquidity
    for (const [mint, removal] of lpRemovals) {
      const addition = Array.from(lpAdditions.values()).find(a => 
        removal.timestamp - a.timestamp < 7 * 24 * 60 * 60 && // Within 7 days
        removal.timestamp > a.timestamp
      );
      
      if (addition || removal.amount > 50) {
        isLpRugger = true;
        rugInvolvements.push({
          rugType: 'lp_pull',
          tokenMint: mint,
          role: 'lp_remover',
          amount: removal.amount,
          timestamp: new Date(removal.timestamp * 1000),
          evidence: [
            `Removed ${removal.amount.toFixed(2)} XNT in liquidity`,
            addition ? 'LP was recently added then quickly removed' : 'Large LP removal detected',
          ],
        });
      }
    }
    
    // Dev dump detection
    for (const [mint, dump] of tokenDumps) {
      if (dump.amount > 0) {
        rugInvolvements.push({
          rugType: 'dev_dump',
          tokenMint: mint,
          role: 'dumper',
          amount: dump.amount,
          timestamp: new Date(dump.timestamp * 1000),
          evidence: [
            `Sold large portion of token holdings`,
          ],
        });
      }
    }
    
    // Check if this wallet created tokens that were rugged
    const deployerCheck = await quickDeployerCheck(address);
    if (deployerCheck.isDeployer && deployerCheck.tokenCount > 0) {
      // Check each deployed token for rug patterns
      const deployedTokens = await getDeployedTokenMints(address, 5);
      
      for (const mint of deployedTokens) {
        try {
          const tokenAnalysis = await analyzeTokenForRugPatterns(mint, address);
          if (tokenAnalysis.isRugged) {
            rugInvolvements.push({
              rugType: tokenAnalysis.rugType,
              tokenMint: mint,
              role: 'deployer',
              evidence: tokenAnalysis.evidence,
              timestamp: tokenAnalysis.timestamp ? new Date(tokenAnalysis.timestamp * 1000) : undefined,
            });
            
            if (tokenAnalysis.rugType === 'honeypot') {
              isHoneypotCreator = true;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
  } catch (error) {
    logger.error('Error detecting rug involvements:', error);
  }
  
  return {
    rugInvolvements,
    isLpRugger,
    isHoneypotCreator,
    rugCount: rugInvolvements.length,
  };
}

// Get deployed token mints for a wallet
async function getDeployedTokenMints(address: string, limit: number): Promise<string[]> {
  const mints: string[] = [];
  
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit: 50 });
    
    for (const sigInfo of signatures) {
      if (mints.length >= limit) break;
      
      try {
        const tx = await conn.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        
        if (!tx?.meta || !tx.transaction) continue;
        
        for (const ix of tx.transaction.message.instructions) {
          if ('parsed' in ix && ix.parsed) {
            const parsed = ix.parsed as any;
            if ((parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') && parsed.info?.mint) {
              if (!mints.includes(parsed.info.mint)) {
                mints.push(parsed.info.mint);
              }
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return mints;
}

// Analyze a token for specific rug patterns
async function analyzeTokenForRugPatterns(mint: string, deployer: string): Promise<{
  isRugged: boolean;
  rugType: RugType;
  evidence: string[];
  timestamp?: number; // When the rug occurred
}> {
  const evidence: string[] = [];
  let isRugged = false;
  let rugType: RugType = 'none';
  let rugTimestamp: number | undefined = undefined;
  
  try {
    const conn = getConnection();
    const mintPubkey = new PublicKey(mint);
    
    // Get mint info
    const mintInfo = await conn.getParsedAccountInfo(mintPubkey);
    
    if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
      const data = mintInfo.value.data.parsed as any;
      
      // Check for honeypot indicators
      // Honeypots typically have mint authority still enabled
      if (data.info?.mintAuthority === deployer) {
        evidence.push('Deployer still controls mint authority');
      }
      
      // Check freeze authority (can freeze buyers from selling)
      if (data.info?.freezeAuthority === deployer) {
        evidence.push('Deployer can freeze token accounts (honeypot indicator)');
        isRugged = true;
        rugType = 'honeypot';
      }
    }
    
    // Check holder distribution
    const largestAccounts = await conn.getTokenLargestAccounts(mintPubkey);
    if (largestAccounts.value.length > 0) {
      const totalSupply = largestAccounts.value.reduce((sum, acc) => sum + Number(acc.amount), 0);
      
      if (totalSupply === 0) {
        evidence.push('Token supply is 0 (likely dumped/rugged)');
        isRugged = true;
        rugType = 'dev_dump';
      } else {
        const topHolder = Number(largestAccounts.value[0].amount);
        const topHolderPct = (topHolder / totalSupply) * 100;
        
        // Check if supply is concentrated (soft rug indicator)
        if (topHolderPct > 80) {
          evidence.push(`${topHolderPct.toFixed(1)}% held by single wallet`);
          isRugged = true;
          rugType = 'soft_rug';
        }
        
        // Check if deployer still holds large amount
        for (const account of largestAccounts.value.slice(0, 3)) {
          try {
            const accInfo = await conn.getParsedAccountInfo(account.address);
            if (accInfo.value?.data && 'parsed' in accInfo.value.data) {
              const owner = (accInfo.value.data.parsed as any).info?.owner;
              if (owner === deployer) {
                const deployerPct = (Number(account.amount) / totalSupply) * 100;
                if (deployerPct > 30) {
                  evidence.push(`Deployer still holds ${deployerPct.toFixed(1)}% of supply`);
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
      }
    }
    
    // If we have multiple evidence points, likely a rug
    if (evidence.length >= 2 && !isRugged) {
      isRugged = true;
      rugType = 'soft_rug';
    }
    
    // Try to get timestamp of when token was rugged (check deployer's transaction history)
    if (isRugged) {
      try {
        const deployerSigs = await conn.getSignaturesForAddress(new PublicKey(deployer), { limit: 50 });
        
        // Look for transactions involving this token mint
        for (const sig of deployerSigs) {
          try {
            const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
            if (!tx) continue;
            
            // Check if this transaction involved the rugged token
            const involvedMints = new Set<string>();
            if (tx.meta?.preTokenBalances) {
              tx.meta.preTokenBalances.forEach(b => involvedMints.add(b.mint));
            }
            if (tx.meta?.postTokenBalances) {
              tx.meta.postTokenBalances.forEach(b => involvedMints.add(b.mint));
            }
            
            if (involvedMints.has(mint) && sig.blockTime) {
              // Found a transaction with this token - use as rug timestamp
              rugTimestamp = sig.blockTime;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      } catch (e) {
        // Ignore timestamp fetching errors
      }
    }
    
  } catch (error) {
    // Token might not exist anymore = rugged
    evidence.push('Token account no longer exists');
    isRugged = true;
    rugType = 'dev_dump';
  }
  
  return { isRugged, rugType, evidence, timestamp: rugTimestamp };
}

// Detect coordinated wallet patterns
function detectCoordinatedWallets(wallets: ConnectedWallet[]): ConnectedWallet[] {
  const coordinated: ConnectedWallet[] = [];
  
  for (const wallet of wallets) {
    // Check for coordination indicators
    const isCoordinated = 
      // Multiple deployers working together
      (wallet.isDeployer && wallet.deployedTokenCount > 2) ||
      // Wash trading pattern
      (wallet.pattern === 'Wash Trading Partner') ||
      // Known scammer
      (wallet.riskLevel === 'critical') ||
      // Dump recipient with high value
      (wallet.pattern === 'Dump Recipient' && wallet.totalValueReceived > 20);
    
    if (isCoordinated) {
      coordinated.push(wallet);
    }
  }
  
  return coordinated;
}

// Enhanced risk score calculation (0-100)
function calculateRiskScoreEnhanced(info: WalletSecurityInfo): number {
  let score = 0;
  
  // Blacklist/malicious activity: high base score
  if (info.hasBlacklistHistory) score += 45;
  if (info.maliciousActivity) score += 45;
  
  // Deployer analysis
  if (info.isDeployer) {
    const tokenCount = info.deployedTokens.length;
    if (tokenCount >= 10) score += 35; // Serial deployer
    else if (tokenCount >= 5) score += 25;
    else if (tokenCount >= 3) score += 15;
    else score += 5;
    
    // Rugpull history is very serious
    const rugpullCount = info.deployedTokensAnalysis.filter(t => t.isRugpull).length;
    if (rugpullCount > 0) score += 30 + (rugpullCount * 5);
  }
  
  // Suspicious patterns scoring
  for (const pattern of info.suspiciousPatterns) {
    if (pattern.severity === 'critical') score += 25;
    else if (pattern.severity === 'danger') score += 15;
    else if (pattern.severity === 'warning') score += 8;
  }
  
  // Funding source risk
  if (info.fundingSourceRisk === 'critical') score += 20;
  else if (info.fundingSourceRisk === 'high') score += 12;
  
  // Risky connections
  const criticalConnections = info.connectedWallets.filter(w => w.riskLevel === 'critical').length;
  const highRiskConnections = info.connectedWallets.filter(w => w.riskLevel === 'high').length;
  score += criticalConnections * 10;
  score += highRiskConnections * 5;
  
  // Activity analysis
  if (info.activityAnalysis) {
    if (info.activityAnalysis.rapidFireTransactions > 30) score += 10;
    if (info.activityAnalysis.suspiciousTimingCount > 10) score += 10;
    if (info.activityAnalysis.accountAge < 3 && info.activityAnalysis.totalTransactions > 200) score += 15;
  }
  
  // Cap at 100
  return Math.min(score, 100);
}

// Get risk level from score
function getRiskLevelEnhanced(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'medium';
  if (score > 0) return 'low';
  return 'low';
}

// Generate human-readable verdict
function generateVerdict(info: WalletSecurityInfo): string {
  const score = info.riskScore;
  const patterns = info.suspiciousPatterns;
  const rugpullCount = info.deployedTokensAnalysis.filter(t => t.isRugpull).length;
  
  // Critical verdict
  if (score >= 70 || info.hasBlacklistHistory || rugpullCount > 0) {
    if (info.hasBlacklistHistory) {
      return '🚨 CRITICAL: This wallet is BLACKLISTED and has been flagged for malicious activity. DO NOT interact with this address.';
    }
    if (rugpullCount > 0) {
      return `🚨 CRITICAL: This wallet has deployed ${rugpullCount} token(s) identified as RUGPULLS. Extremely high risk - likely a scammer.`;
    }
    if (info.deployedTokens.length >= 10) {
      return '🚨 CRITICAL: Serial token deployer detected. This pattern is commonly associated with scam operations.';
    }
    return '🚨 CRITICAL: Multiple severe risk indicators detected. Exercise extreme caution.';
  }
  
  // High risk verdict
  if (score >= 45) {
    const reasons: string[] = [];
    if (info.isDeployer && info.deployedTokens.length > 3) {
      reasons.push(`deployed ${info.deployedTokens.length} tokens`);
    }
    if (info.riskyConnections > 2) {
      reasons.push(`connected to ${info.riskyConnections} risky wallets`);
    }
    if (patterns.some(p => p.type === 'coordinated_wallets')) {
      reasons.push('part of coordinated wallet network');
    }
    if (info.fundingSourceRisk === 'high' || info.fundingSourceRisk === 'critical') {
      reasons.push('suspicious funding source');
    }
    
    return `⚠️ HIGH RISK: ${reasons.length > 0 ? 'Wallet has ' + reasons.join(', ') + '.' : 'Multiple risk factors detected.'} Proceed with caution.`;
  }
  
  // Medium risk verdict
  if (score >= 20) {
    if (info.isDeployer) {
      return `⚡ MEDIUM RISK: This wallet has deployed ${info.deployedTokens.length} token(s). Verify token legitimacy before interacting.`;
    }
    if (info.riskyConnections > 0) {
      return `⚡ MEDIUM RISK: Connected to ${info.riskyConnections} wallet(s) with risk indicators. Review connections carefully.`;
    }
    return '⚡ MEDIUM RISK: Some risk indicators detected. Review the details before proceeding.';
  }
  
  // Low risk verdict
  if (score > 0) {
    return '✅ LOW RISK: Minor indicators detected but no major concerns. Normal wallet activity patterns.';
  }
  
  // Clean verdict
  return '✅ CLEAN: No significant risk indicators detected. Wallet appears safe based on available data.';
}

// Format security info for display (compact version for wallet details)
export function formatSecurityInfo(info: WalletSecurityInfo): string {
  const riskEmoji: Record<RiskLevel, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
    critical: '🚨',
    unknown: '⚪',
  };

  let message = `\n🛡️ <b>Security Analysis</b>\n`;
  message += `├ Risk Level: ${riskEmoji[info.riskLevel]} <b>${info.riskLevel.toUpperCase()}</b>`;
  if (info.riskScore > 0) message += ` (${info.riskScore}/100)`;
  message += `\n`;
  
  if (info.isDeployer) {
    message += `├ Token Deployer: ⚠️ Yes (${info.deployedTokens.length} token${info.deployedTokens.length > 1 ? 's' : ''})\n`;
  } else {
    message += `├ Token Deployer: ✅ No\n`;
  }
  
  if (info.connectedWallets.length > 0) {
    const riskyCount = info.riskyConnections;
    if (riskyCount > 0) {
      message += `├ Connections: ⚠️ ${riskyCount} risky of ${info.connectedWallets.length}\n`;
    } else {
      message += `├ Connections: ✅ ${info.connectedWallets.length} (all safe)\n`;
    }
  }
  
  // Show funding chain with full trace
  logger.info('📊 Formatting security info', { 
    fundingChainLength: info.fundingChain?.length || 0,
    fundingSource: info.fundingSource,
    fundingSourceRisk: info.fundingSourceRisk 
  });
  
  // Always show funding source if available
  if (info.fundingSource || (info.fundingChain && info.fundingChain.length > 0)) {
    message += `\n💰 <b>Funded By:</b>\n`;
    
    if (info.fundingChain && info.fundingChain.length > 0) {
      logger.info(`✅ Funding chain has ${info.fundingChain.length} entries`);
      // Show full chain trace with visual flow
      const chainDisplay = info.fundingChain.map((addr, idx) => {
        const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
        return `   ${idx + 1}. <code>${short}</code>`;
      }).join('\n');
      message += chainDisplay + '\n';
    } else if (info.fundingSource) {
      const shortFunding = `${info.fundingSource.slice(0, 6)}...${info.fundingSource.slice(-4)}`;
      message += `   <code>${shortFunding}</code>\n`;
    } else {
      // No funding chain found
      message += `   🆕 <i>Newly created wallet (no funding history)</i>\n`;
    }
    
    // Add risk indicator for funding source
    if (info.fundingSourceRisk === 'critical') {
      message += `   🚨 <b>High-risk source detected!</b>\n`;
    } else if (info.fundingSourceRisk === 'high') {
      message += `   ⚠️ Suspicious funding source\n`;
    } else if (info.fundingSource || info.fundingChain.length > 0) {
      message += `   ✅ Funding source verified\n`;
    }
  } else {
    // No funding information at all - definitely a new wallet
    message += `\n💰 <b>Funded By:</b>\n`;
    message += `   🆕 <i>Newly created wallet (no funding history)</i>\n`;
  }
  
  if (info.warnings.length > 0) {
    message += `└ ⚠️ ${info.warnings.length} warning(s) - tap Security for details\n`;
  } else {
    message += `└ Warnings: None\n`;
  }
  
  return message;
}

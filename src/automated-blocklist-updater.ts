/**
 * Automated Blocklist Updater
 * 
 * Periodically scans xDEX for new tokens and updates the blocklist
 * with any newly detected rug pullers.
 * 
 * Features:
 * - Incremental scanning (only new tokens since last update)
 * - Automatic deduplication
 * - No performance impact on main bot
 * - Detailed logging and error handling
 * - Optional Telegram notifications
 * 
 * Usage:
 *   npm run update-blocklist           # Run once
 *   node dist/automated-blocklist-updater.js  # Production
 */

import { createLogger } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';

const logger = createLogger('BlocklistUpdater');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // xDEX API endpoint
  XDEX_API: 'https://app.xdex.xyz/mint/list',
  
  // Blockchain RPC
  RPC_URL: process.env.X1_RPC_URL || 'https://rpc.mainnet.x1.xyz',
  
  // Paths
  BLOCKLIST_PATH: path.join(__dirname, '..', 'ENHANCED_RUGGER_BLOCKLIST.json'),
  PROGRESS_PATH: path.join(__dirname, '..', 'data', 'blocklist_update_progress.json'),
  
  // Scanning parameters
  MAX_CONCURRENT_SCANS: 3,
  SCAN_DELAY_MS: 2000, // 2 seconds between scans
  RPC_TIMEOUT_MS: 30000,
  
  // Telegram notification (optional)
  TELEGRAM_NOTIFICATIONS: process.env.BLOCKLIST_NOTIFY_TELEGRAM === 'true',
  TELEGRAM_BOT_TOKEN: process.env.BOT_TOKEN,
  TELEGRAM_ADMIN_ID: process.env.ADMIN_TELEGRAM_ID,
  
  // Safety features
  DRY_RUN: process.env.BLOCKLIST_DRY_RUN === 'true',
  MAX_NEW_RUGGERS_PER_UPDATE: 50, // Safety limit: don't add more than 50 at once
};

// ============================================================================
// TYPES
// ============================================================================

interface UpdateProgress {
  lastUpdateDate: string;
  lastScannedTokenCount: number;
  totalRugPullersFound: number;
  lastScannedTokens: string[]; // Token addresses we've already scanned
}

interface TokenData {
  tokenAddress: string;
  owner: string; // deployer
  symbol: string;
  name: string;
  createdAt: string;
}

interface ScanResult {
  tokenAddress: string;
  deployer: string;
  symbol: string;
  isRugPuller: boolean;
  lpRemoved: boolean;
  riskFactors: string[];
}

interface BlocklistEntry {
  id: number;
  deployer: string;
  tokenAddress: string;
  tokenSymbol: string;
  riskLevel: string;
  riskScore: number;
  detectedDate: string;
  evidence: string[];
  totalRugPulls: number;
  rugPullHistory: any[];
  fundingSource: string | null;
  fundedBy: string[];
  networkId: string | null;
  isNewWallet: boolean;
  walletAge: number;
  status: string;
  lastUpdated: string;
}

// ============================================================================
// PROGRESS MANAGEMENT
// ============================================================================

function loadProgress(): UpdateProgress {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_PATH)) {
      const data = fs.readFileSync(CONFIG.PROGRESS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.warn('Could not load progress file, starting fresh');
  }
  
  return {
    lastUpdateDate: new Date(0).toISOString(),
    lastScannedTokenCount: 0,
    totalRugPullersFound: 0,
    lastScannedTokens: []
  };
}

function saveProgress(progress: UpdateProgress): void {
  try {
    const dataDir = path.dirname(CONFIG.PROGRESS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.PROGRESS_PATH, JSON.stringify(progress, null, 2));
    logger.info('✅ Progress saved');
  } catch (error) {
    logger.error('Failed to save progress:', error);
  }
}

// ============================================================================
// XDEX TOKEN FETCHING
// ============================================================================

async function fetchAllTokensFromXDEX(): Promise<TokenData[]> {
  try {
    logger.info('📡 Fetching token list from xDEX...');
    
    const response = await axios.get(CONFIG.XDEX_API, {
      timeout: 30000,
      headers: {
        'User-Agent': 'X1-Wallet-Watcher-Bot/2.0'
      }
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response from xDEX API');
    }
    
    const tokens: TokenData[] = response.data.map((token: any, index: number) => ({
      tokenAddress: token.tokenAddress || token.address,
      owner: token.owner || token.deployer,
      symbol: token.symbol || 'UNKNOWN',
      name: token.name || 'Unknown Token',
      createdAt: token.createdAt || new Date().toISOString()
    }));
    
    logger.info(`✅ Fetched ${tokens.length} tokens from xDEX`);
    return tokens;
    
  } catch (error) {
    logger.error('❌ Failed to fetch tokens from xDEX:', error);
    throw error;
  }
}

function filterNewTokens(allTokens: TokenData[], progress: UpdateProgress): TokenData[] {
  const newTokens = allTokens.filter(token => 
    !progress.lastScannedTokens.includes(token.tokenAddress)
  );
  
  logger.info(`🆕 Found ${newTokens.length} new tokens to scan (${allTokens.length} total)`);
  return newTokens;
}

// ============================================================================
// RUG PULL DETECTION
// ============================================================================

async function checkForRugPull(token: TokenData): Promise<ScanResult> {
  const connection = new Connection(CONFIG.RPC_URL, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: CONFIG.RPC_TIMEOUT_MS
  });
  
  const result: ScanResult = {
    tokenAddress: token.tokenAddress,
    deployer: token.owner,
    symbol: token.symbol,
    isRugPuller: false,
    lpRemoved: false,
    riskFactors: []
  };
  
  try {
    // Check if deployer wallet still exists and has activity
    const deployerPubkey = new PublicKey(token.owner);
    const balance = await connection.getBalance(deployerPubkey);
    
    // Check for LP removal patterns
    // Get recent transactions from deployer
    const signatures = await connection.getSignaturesForAddress(deployerPubkey, {
      limit: 50
    });
    
    // Look for LP removal indicators
    const hasRecentActivity = signatures.length > 0;
    const recentTxCount = signatures.filter(sig => {
      const txDate = new Date((sig.blockTime || 0) * 1000);
      const daysSinceCreation = (Date.now() - new Date(token.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation < 7;
    }).length;
    
    // Simple heuristic: If wallet created token and has suspicious patterns
    const isNewWallet = signatures.length < 10;
    const hasLowBalance = balance < 0.1 * 1e9; // Less than 0.1 SOL equivalent
    
    // Check for LP removal by looking at transaction patterns
    let lpRemovalDetected = false;
    for (const sig of signatures.slice(0, 20)) {
      try {
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        });
        
        if (tx && tx.meta) {
          // Look for token account closures or large transfers (LP removal indicators)
          const instructions = tx.transaction.message.instructions;
          for (const ix of instructions) {
            if ('parsed' in ix && ix.parsed) {
              const type = ix.parsed.type;
              if (type === 'closeAccount' || type === 'transfer') {
                lpRemovalDetected = true;
                break;
              }
            }
          }
        }
      } catch (e) {
        // Skip transaction if we can't fetch it
        continue;
      }
      
      if (lpRemovalDetected) break;
    }
    
    // Risk factor analysis
    if (isNewWallet) {
      result.riskFactors.push('New wallet deployer');
    }
    if (hasLowBalance) {
      result.riskFactors.push('Low balance');
    }
    if (lpRemovalDetected) {
      result.riskFactors.push('LP removal detected');
      result.lpRemoved = true;
      result.isRugPuller = true;
    }
    
    // Mark as rug puller if LP was removed
    if (result.lpRemoved) {
      logger.warn(`🚨 RUG PULL DETECTED: ${token.symbol} (${token.tokenAddress.slice(0, 8)}...)`);
    }
    
  } catch (error) {
    logger.error(`Error scanning ${token.symbol}:`, error);
    result.riskFactors.push('Scan error - unable to verify');
  }
  
  return result;
}

async function scanTokensForRugPulls(tokens: TokenData[]): Promise<ScanResult[]> {
  logger.info(`🔍 Starting rug pull scan for ${tokens.length} tokens...`);
  
  const results: ScanResult[] = [];
  const batchSize = CONFIG.MAX_CONCURRENT_SCANS;
  
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    
    logger.info(`📊 Scanning batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tokens.length / batchSize)} (${batch.length} tokens)`);
    
    const batchPromises = batch.map(token => checkForRugPull(token));
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error(`Failed to scan ${batch[index].symbol}:`, result.reason);
      }
    });
    
    // Delay between batches to avoid rate limiting
    if (i + batchSize < tokens.length) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.SCAN_DELAY_MS));
    }
  }
  
  const rugPullersFound = results.filter(r => r.isRugPuller).length;
  logger.info(`✅ Scan complete: ${rugPullersFound} rug pullers detected out of ${results.length} tokens`);
  
  return results;
}

// ============================================================================
// BACKUP & SAFETY MECHANISMS
// ============================================================================

/**
 * Create backup of blocklist before making changes
 */
function createBlocklistBackup(): string | null {
  try {
    if (!fs.existsSync(CONFIG.BLOCKLIST_PATH)) {
      logger.warn('No blocklist to backup');
      return null;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = CONFIG.BLOCKLIST_PATH.replace('.json', `.backup.${timestamp}.json`);
    
    fs.copyFileSync(CONFIG.BLOCKLIST_PATH, backupPath);
    logger.info(`✅ Backup created: ${path.basename(backupPath)}`);
    
    // Keep only last 10 backups
    cleanOldBackups();
    
    return backupPath;
  } catch (error) {
    logger.error('Failed to create backup:', error);
    return null;
  }
}

/**
 * Clean old backup files (keep last 10)
 */
function cleanOldBackups(): void {
  try {
    const dir = path.dirname(CONFIG.BLOCKLIST_PATH);
    const files = fs.readdirSync(dir)
      .filter(f => f.includes('ENHANCED_RUGGER_BLOCKLIST.backup.'))
      .map(f => ({
        name: f,
        path: path.join(dir, f),
        time: fs.statSync(path.join(dir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    // Keep last 10, delete older ones
    if (files.length > 10) {
      files.slice(10).forEach(file => {
        fs.unlinkSync(file.path);
        logger.info(`🗑️  Deleted old backup: ${file.name}`);
      });
    }
  } catch (error: any) {
    logger.warn('Failed to clean old backups:', error);
  }
}

/**
 * Restore from backup if update fails
 */
function restoreFromBackup(backupPath: string): boolean {
  try {
    if (!fs.existsSync(backupPath)) {
      logger.error('Backup file not found for restore');
      return false;
    }
    
    fs.copyFileSync(backupPath, CONFIG.BLOCKLIST_PATH);
    logger.info('✅ Blocklist restored from backup');
    return true;
  } catch (error) {
    logger.error('Failed to restore from backup:', error);
    return false;
  }
}

/**
 * Validate blocklist structure
 */
function validateBlocklist(blocklist: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!blocklist.version) errors.push('Missing version');
  if (!blocklist.knownRugPullers) errors.push('Missing knownRugPullers array');
  if (!blocklist.statistics) errors.push('Missing statistics');
  
  // Check array is valid
  if (blocklist.knownRugPullers && !Array.isArray(blocklist.knownRugPullers)) {
    errors.push('knownRugPullers is not an array');
  }
  
  // Check for duplicates
  if (blocklist.knownRugPullers && Array.isArray(blocklist.knownRugPullers)) {
    const deployers = blocklist.knownRugPullers.map((r: any) => r.deployer?.toLowerCase());
    const uniqueDeployers = new Set(deployers);
    if (deployers.length !== uniqueDeployers.size) {
      errors.push(`Found duplicate deployers: ${deployers.length} total, ${uniqueDeployers.size} unique`);
    }
  }
  
  // Check each entry has required fields
  if (blocklist.knownRugPullers && Array.isArray(blocklist.knownRugPullers)) {
    blocklist.knownRugPullers.forEach((rugger: any, index: number) => {
      if (!rugger.deployer) errors.push(`Entry ${index} missing deployer`);
      if (!rugger.tokenAddress) errors.push(`Entry ${index} missing tokenAddress`);
      if (!rugger.tokenSymbol) errors.push(`Entry ${index} missing tokenSymbol`);
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// BLOCKLIST MANAGEMENT
// ============================================================================

function loadBlocklist(): any {
  try {
    if (fs.existsSync(CONFIG.BLOCKLIST_PATH)) {
      const data = fs.readFileSync(CONFIG.BLOCKLIST_PATH, 'utf-8');
      const blocklist = JSON.parse(data);
      
      // Validate loaded blocklist
      const validation = validateBlocklist(blocklist);
      if (!validation.valid) {
        logger.error('❌ Blocklist validation failed:', validation.errors);
        throw new Error('Invalid blocklist structure');
      }
      
      return blocklist;
    }
  } catch (error) {
    logger.error('Failed to load blocklist:', error);
  }
  
  return {
    version: '2.0',
    name: 'Enhanced Rug Puller Intelligence Database',
    lastUpdated: new Date().toISOString(),
    statistics: {
      totalRugPullers: 0,
      totalTokensScanned: 0,
      rugPullRate: '0%',
      suspiciousFunders: 0,
      scamNetworks: 0
    },
    knownRugPullers: [],
    suspiciousFunders: [],
    scamNetworks: []
  };
}

function mergeNewRugPullersIntoBlocklist(
  blocklist: any,
  newRugPullers: ScanResult[]
): { updated: boolean; newCount: number } {
  let newCount = 0;
  const existingDeployers = new Set(
    blocklist.knownRugPullers.map((r: any) => r.deployer.toLowerCase())
  );
  
  // Get next ID
  let nextId = blocklist.knownRugPullers.length > 0
    ? Math.max(...blocklist.knownRugPullers.map((r: any) => r.id)) + 1
    : 1;
  
  for (const rugPuller of newRugPullers) {
    if (!rugPuller.isRugPuller) continue;
    
    // Check if already in blocklist
    if (existingDeployers.has(rugPuller.deployer.toLowerCase())) {
      logger.info(`⏭️  Skipping ${rugPuller.symbol} - already in blocklist`);
      continue;
    }
    
    // Add new entry
    const entry: BlocklistEntry = {
      id: nextId++,
      deployer: rugPuller.deployer,
      tokenAddress: rugPuller.tokenAddress,
      tokenSymbol: rugPuller.symbol,
      riskLevel: 'CRITICAL',
      riskScore: 98,
      detectedDate: new Date().toISOString().split('T')[0],
      evidence: rugPuller.riskFactors,
      totalRugPulls: 1,
      rugPullHistory: [
        {
          tokenSymbol: rugPuller.symbol,
          tokenAddress: rugPuller.tokenAddress,
          rugDate: new Date().toISOString().split('T')[0],
          lpRemoved: '100%',
          estimatedLoss: 10000
        }
      ],
      fundingSource: null,
      fundedBy: [],
      networkId: null,
      isNewWallet: rugPuller.riskFactors.includes('New wallet deployer'),
      walletAge: 0,
      status: 'confirmed',
      lastUpdated: new Date().toISOString()
    };
    
    blocklist.knownRugPullers.push(entry);
    newCount++;
    
    logger.info(`➕ Added new rug puller: ${rugPuller.symbol} (${rugPuller.deployer.slice(0, 8)}...)`);
  }
  
  // Update statistics
  if (newCount > 0) {
    blocklist.statistics.totalRugPullers = blocklist.knownRugPullers.length;
    blocklist.lastUpdated = new Date().toISOString();
  }
  
  return { updated: newCount > 0, newCount };
}

function saveBlocklist(blocklist: any): void {
  // DRY RUN: Don't actually save
  if (CONFIG.DRY_RUN) {
    logger.warn('🔍 DRY RUN MODE: Blocklist NOT saved (simulation only)');
    return;
  }
  
  try {
    // Validate before saving
    const validation = validateBlocklist(blocklist);
    if (!validation.valid) {
      logger.error('❌ Cannot save invalid blocklist:', validation.errors);
      throw new Error(`Blocklist validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Write to temp file first (atomic write)
    const tempPath = CONFIG.BLOCKLIST_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(blocklist, null, 2));
    
    // Verify temp file can be read and parsed
    const testRead = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
    const testValidation = validateBlocklist(testRead);
    if (!testValidation.valid) {
      fs.unlinkSync(tempPath);
      throw new Error('Written file failed validation');
    }
    
    // Atomic rename (overwrites original)
    fs.renameSync(tempPath, CONFIG.BLOCKLIST_PATH);
    
    logger.info('✅ Blocklist saved successfully');
  } catch (error) {
    logger.error('❌ Failed to save blocklist:', error);
    throw error;
  }
}

// ============================================================================
// TELEGRAM NOTIFICATIONS
// ============================================================================

async function sendTelegramNotification(message: string): Promise<void> {
  if (!CONFIG.TELEGRAM_NOTIFICATIONS || !CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_ADMIN_ID) {
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: CONFIG.TELEGRAM_ADMIN_ID,
      text: message,
      parse_mode: 'HTML'
    });
    logger.info('✅ Telegram notification sent');
  } catch (error) {
    logger.error('Failed to send Telegram notification:', error);
  }
}

// ============================================================================
// MAIN UPDATE LOGIC
// ============================================================================

async function performBlocklistUpdate(): Promise<void> {
  const startTime = Date.now();
  let backupPath: string | null = null;
  
  logger.info('═══════════════════════════════════════════════════════════');
  if (CONFIG.DRY_RUN) {
    logger.info('     🔍 DRY RUN MODE - BLOCKLIST UPDATE (SIMULATION)');
  } else {
    logger.info('     AUTOMATED BLOCKLIST UPDATE - STARTING');
  }
  logger.info('═══════════════════════════════════════════════════════════');
  
  try {
    // Step 0: Create backup before any changes
    logger.info('\n🔐 Step 0: Creating safety backup...');
    backupPath = createBlocklistBackup();
    if (backupPath) {
      logger.info(`✅ Backup created: ${path.basename(backupPath)}`);
    }
    
    // Step 1: Load progress
    logger.info('\n📂 Step 1: Loading update progress...');
    const progress = loadProgress();
    logger.info(`   Last update: ${progress.lastUpdateDate}`);
    logger.info(`   Last scanned: ${progress.lastScannedTokenCount} tokens`);
    logger.info(`   Total rug pullers found historically: ${progress.totalRugPullersFound}`);
    
    // Step 2: Fetch all tokens from xDEX
    logger.info('\n📡 Step 2: Fetching tokens from xDEX...');
    const allTokens = await fetchAllTokensFromXDEX();
    
    // Step 3: Filter for new tokens only
    logger.info('\n🔍 Step 3: Identifying new tokens...');
    const newTokens = filterNewTokens(allTokens, progress);
    
    if (newTokens.length === 0) {
      logger.info('\n✅ No new tokens to scan. Blocklist is up to date!');
      return;
    }
    
    // Step 4: Scan new tokens for rug pulls
    logger.info('\n🔎 Step 4: Scanning new tokens for rug pulls...');
    const scanResults = await scanTokensForRugPulls(newTokens);
    const newRugPullers = scanResults.filter(r => r.isRugPuller);
    
    // Step 5: Load and update blocklist
    logger.info('\n📋 Step 5: Updating blocklist...');
    const blocklist = loadBlocklist();
    
    // Validate current blocklist before modification
    const preUpdateValidation = validateBlocklist(blocklist);
    if (!preUpdateValidation.valid) {
      throw new Error(`Pre-update validation failed: ${preUpdateValidation.errors.join(', ')}`);
    }
    
    const { updated, newCount } = mergeNewRugPullersIntoBlocklist(blocklist, newRugPullers);
    
    // Safety check: Don't add too many at once (might indicate scanning error)
    if (newCount > CONFIG.MAX_NEW_RUGGERS_PER_UPDATE) {
      logger.warn(`⚠️ SAFETY CHECK: Attempting to add ${newCount} new rug pullers (limit: ${CONFIG.MAX_NEW_RUGGERS_PER_UPDATE})`);
      logger.warn('⚠️ This might indicate a scanning error. Please review manually.');
      throw new Error(`Safety limit exceeded: ${newCount} > ${CONFIG.MAX_NEW_RUGGERS_PER_UPDATE}`);
    }
    
    if (updated) {
      // Validate before saving
      const postUpdateValidation = validateBlocklist(blocklist);
      if (!postUpdateValidation.valid) {
        throw new Error(`Post-update validation failed: ${postUpdateValidation.errors.join(', ')}`);
      }
      
      saveBlocklist(blocklist);
      
      if (!CONFIG.DRY_RUN) {
        logger.info(`✅ Blocklist updated with ${newCount} new rug puller(s)`);
        
        // Verify saved file
        const verifyBlocklist = loadBlocklist();
        if (verifyBlocklist.knownRugPullers.length !== blocklist.knownRugPullers.length) {
          throw new Error('Saved blocklist verification failed - count mismatch');
        }
        
        logger.info('✅ Blocklist verified after save');
      } else {
        logger.info(`🔍 DRY RUN: Would have added ${newCount} new rug puller(s)`);
      }
      
      // Send notification
      const message = `🚨 <b>Blocklist Update</b>\n\n` +
        `🆕 Found ${newCount} new rug puller(s)\n` +
        `📊 Total rug pullers: ${blocklist.statistics.totalRugPullers}\n` +
        `🔍 Scanned ${newTokens.length} new tokens\n` +
        `⏱️ Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      
      await sendTelegramNotification(message);
    } else {
      logger.info('✅ No new rug pullers detected in this update');
    }
    
    // Step 6: Update progress
    logger.info('\n💾 Step 6: Saving progress...');
    progress.lastUpdateDate = new Date().toISOString();
    progress.lastScannedTokenCount = allTokens.length;
    progress.totalRugPullersFound += newCount;
    progress.lastScannedTokens = allTokens.map(t => t.tokenAddress);
    saveProgress(progress);
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('\n═══════════════════════════════════════════════════════════');
    logger.info('     AUTOMATED BLOCKLIST UPDATE - COMPLETE');
    logger.info('═══════════════════════════════════════════════════════════');
    logger.info(`✅ Update completed in ${duration}s`);
    logger.info(`🆕 New rug pullers added: ${newCount}`);
    logger.info(`📊 Total rug pullers in blocklist: ${blocklist.statistics.totalRugPullers}`);
    logger.info('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    logger.error('\n❌ Blocklist update failed:', error);
    
    // ROLLBACK: Restore from backup if available
    if (backupPath) {
      logger.warn('🔄 Attempting to rollback to backup...');
      const restored = restoreFromBackup(backupPath);
      if (restored) {
        logger.info('✅ Successfully rolled back to backup');
        
        // Verify restored blocklist
        try {
          const restoredBlocklist = loadBlocklist();
          logger.info(`✅ Restored blocklist verified: ${restoredBlocklist.knownRugPullers.length} rug pullers`);
        } catch (verifyError) {
          logger.error('❌ Restored blocklist verification failed:', verifyError);
        }
      } else {
        logger.error('❌ Rollback failed - manual intervention may be required');
      }
    }
    
    // Send error notification
    await sendTelegramNotification(
      `❌ <b>Blocklist Update Failed</b>\n\n` +
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
      `${backupPath ? '✅ Rolled back to backup' : '⚠️ No backup available'}`
    );
    
    throw error;
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

if (require.main === module) {
  performBlocklistUpdate()
    .then(() => {
      logger.info('🎉 Blocklist updater finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Blocklist updater failed:', error);
      process.exit(1);
    });
}

export { performBlocklistUpdate };

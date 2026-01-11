/**
 * Enhanced Security Scanner with Integrated Rug Puller Detection
 * 
 * This module integrates the enhanced blocklist into the existing security scanner
 * to provide real-time protection against known rug pullers, suspicious funders,
 * and organized scam networks.
 * 
 * Features:
 * 1. Known rug puller detection (deployer-based)
 * 2. Funding source tracking (suspicious funder detection)
 * 3. Scam network mapping (organized crime detection)
 * 4. Serial pattern analysis (multiple rug pull tracking)
 * 5. Enhanced risk scoring with blocklist data
 */

import { createLogger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('EnhancedSecurityScanner');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RugPullerProfile {
  id: number;
  deployer: string;
  tokenAddress: string;
  tokenSymbol: string;
  riskLevel: string;
  riskScore: number;
  detectedDate: string;
  evidence: string[];
  totalRugPulls: number;
  rugPullHistory: RugPullHistory[];
  fundingSource: string | null;
  fundedBy: string[];
  networkId: string | null;
  isNewWallet: boolean;
  walletAge: number;
  status: string;
}

export interface RugPullHistory {
  tokenSymbol: string;
  tokenAddress: string;
  rugDate: string;
  lpRemoved: string;
  estimatedLoss: number;
  victimsCount: number;
}

export interface SuspiciousFunder {
  id: number;
  funderAddress: string;
  description: string;
  walletsFinanced: number;
  confirmedRugPulls: number;
  suspectedRugPulls: number;
  totalStolenByNetwork: number;
  riskScore: number;
  riskLevel: string;
  detectedDate: string;
  status: string;
  fundedDeployers: string[];
  evidence: string[];
  activityPeriod: {
    firstSeen: string;
    lastSeen: string;
    durationDays: number;
  };
}

export interface ScamNetwork {
  networkId: string;
  name: string;
  description: string;
  riskLevel: string;
  riskScore: number;
  status: string;
  detectedDate: string;
  masterWallets: string[];
  deployerWallets: string[];
  statistics: {
    totalRugPulls: number;
    totalStolen: number;
    activeDeployers: number;
    inactiveDeployers: number;
    averageTimeToRug: string;
    totalVictims: number;
  };
  ruggedTokens: Array<{
    symbol: string;
    address: string;
    deployer: string;
    rugDate: string;
  }>;
  networkPatterns: string[];
  connections: Array<{
    from: string;
    to: string;
    amount: number;
    date: string;
    type: string;
  }>;
  threatLevel: string;
  recommendation: string;
}

export interface EnhancedBlocklist {
  version: string;
  name: string;
  lastUpdated: string;
  statistics: {
    totalRugPullers: number;
    totalTokensScanned: number;
    rugPullRate: string;
    suspiciousFunders: number;
    scamNetworks: number;
  };
  knownRugPullers: RugPullerProfile[];
  suspiciousFunders: SuspiciousFunder[];
  scamNetworks: ScamNetwork[];
}

export interface EnhancedSecurityResult {
  // Basic fields (from original scanner)
  deployer: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  warnings: string[];
  
  // Enhanced fields (new)
  isKnownRugger: boolean;
  ruggerProfile?: RugPullerProfile;
  serialData?: {
    totalRugPulls: number;
    rugPullHistory: RugPullHistory[];
    riskScore: number;
  };
  
  suspiciousFunding: boolean;
  funderProfile?: SuspiciousFunder;
  fundingRisk?: {
    funderAddress: string;
    walletsFinanced: number;
    confirmedRugPulls: number;
    riskScore: number;
  };
  
  inScamNetwork: boolean;
  networkProfile?: ScamNetwork;
  networkRisk?: {
    networkId: string;
    role: 'deployer' | 'funder' | 'both';
    networkRugPulls: number;
    totalStolen: number;
  };
  
  enhancedVerdict: string;
  recommendedAction: 'BLOCK' | 'WARN' | 'CAUTION' | 'ALLOW';
}

// ============================================================================
// BLOCKLIST MANAGEMENT
// ============================================================================

class BlocklistManager {
  private blocklist: EnhancedBlocklist | null = null;
  private blocklistPath: string;
  private lastLoadTime: number = 0;
  private readonly RELOAD_INTERVAL = 5 * 60 * 1000; // Reload every 5 minutes

  constructor() {
    this.blocklistPath = path.join(__dirname, '..', 'ENHANCED_RUGGER_BLOCKLIST.json');
  }

  /**
   * Load blocklist from file
   */
  public loadBlocklist(): EnhancedBlocklist {
    const now = Date.now();
    
    // Return cached blocklist if recently loaded
    if (this.blocklist && (now - this.lastLoadTime) < this.RELOAD_INTERVAL) {
      return this.blocklist;
    }

    try {
      logger.info('📋 Loading enhanced rug puller blocklist...');
      
      if (!fs.existsSync(this.blocklistPath)) {
        logger.warn(`⚠️ Blocklist not found at ${this.blocklistPath}, creating empty blocklist`);
        this.blocklist = this.createEmptyBlocklist();
        return this.blocklist;
      }

      const data = fs.readFileSync(this.blocklistPath, 'utf-8');
      this.blocklist = JSON.parse(data) as EnhancedBlocklist;
      this.lastLoadTime = now;
      
      logger.info(`✅ Loaded blocklist: ${this.blocklist.knownRugPullers.length} rug pullers, ${this.blocklist.suspiciousFunders.length} funders, ${this.blocklist.scamNetworks.length} networks`);
      
      return this.blocklist;
    } catch (error) {
      logger.error('❌ Error loading blocklist:', error);
      this.blocklist = this.createEmptyBlocklist();
      return this.blocklist;
    }
  }

  /**
   * Save blocklist to file
   */
  public saveBlocklist(blocklist: EnhancedBlocklist): void {
    try {
      const data = JSON.stringify(blocklist, null, 2);
      fs.writeFileSync(this.blocklistPath, data, 'utf-8');
      this.blocklist = blocklist;
      this.lastLoadTime = Date.now();
      logger.info('✅ Blocklist saved successfully');
    } catch (error) {
      logger.error('❌ Error saving blocklist:', error);
    }
  }

  /**
   * Add new rug puller to blocklist
   */
  public addRugPuller(profile: RugPullerProfile): void {
    const blocklist = this.loadBlocklist();
    
    // Check if already exists
    const exists = blocklist.knownRugPullers.find(r => r.deployer === profile.deployer);
    if (exists) {
      logger.warn(`⚠️ Rug puller ${profile.deployer.slice(0, 8)}... already in blocklist`);
      return;
    }

    blocklist.knownRugPullers.push(profile);
    blocklist.statistics.totalRugPullers = blocklist.knownRugPullers.length;
    blocklist.lastUpdated = new Date().toISOString();
    
    this.saveBlocklist(blocklist);
    logger.info(`✅ Added new rug puller to blocklist: ${profile.deployer.slice(0, 8)}...`);
  }

  /**
   * Create empty blocklist structure
   */
  private createEmptyBlocklist(): EnhancedBlocklist {
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

  /**
   * Force reload blocklist
   */
  public reloadBlocklist(): EnhancedBlocklist {
    this.lastLoadTime = 0;
    return this.loadBlocklist();
  }
}

// Singleton instance
const blocklistManager = new BlocklistManager();

// ============================================================================
// ENHANCED SECURITY CHECKS
// ============================================================================

/**
 * Check if deployer is a known rug puller
 */
export function checkKnownRugPuller(deployerAddress: string): {
  isKnownRugger: boolean;
  profile?: RugPullerProfile;
  serialData?: {
    totalRugPulls: number;
    rugPullHistory: RugPullHistory[];
    riskScore: number;
  };
} {
  const blocklist = blocklistManager.loadBlocklist();
  
  const rugger = blocklist.knownRugPullers.find(
    r => r.deployer.toLowerCase() === deployerAddress.toLowerCase()
  );

  if (rugger) {
    logger.warn(`🚨 KNOWN RUG PULLER DETECTED: ${deployerAddress.slice(0, 8)}... with ${rugger.totalRugPulls} previous rug pull(s)`);
    
    return {
      isKnownRugger: true,
      profile: rugger,
      serialData: {
        totalRugPulls: rugger.totalRugPulls,
        rugPullHistory: rugger.rugPullHistory,
        riskScore: rugger.riskScore
      }
    };
  }

  return { isKnownRugger: false };
}

/**
 * Check if funding source is suspicious
 */
export function checkSuspiciousFunder(fundingSource: string | null): {
  suspiciousFunding: boolean;
  profile?: SuspiciousFunder;
  fundingRisk?: {
    funderAddress: string;
    walletsFinanced: number;
    confirmedRugPulls: number;
    riskScore: number;
  };
} {
  if (!fundingSource) {
    return { suspiciousFunding: false };
  }

  const blocklist = blocklistManager.loadBlocklist();
  
  const funder = blocklist.suspiciousFunders.find(
    f => f.funderAddress.toLowerCase() === fundingSource.toLowerCase()
  );

  if (funder) {
    logger.warn(`⚠️ SUSPICIOUS FUNDER DETECTED: ${fundingSource.slice(0, 8)}... funded ${funder.confirmedRugPulls} rug pullers`);
    
    return {
      suspiciousFunding: true,
      profile: funder,
      fundingRisk: {
        funderAddress: funder.funderAddress,
        walletsFinanced: funder.walletsFinanced,
        confirmedRugPulls: funder.confirmedRugPulls,
        riskScore: funder.riskScore
      }
    };
  }

  return { suspiciousFunding: false };
}

/**
 * Check if wallet is part of a scam network
 */
export function checkScamNetwork(
  deployerAddress: string,
  fundingSource: string | null
): {
  inScamNetwork: boolean;
  profile?: ScamNetwork;
  networkRisk?: {
    networkId: string;
    role: 'deployer' | 'funder' | 'both';
    networkRugPulls: number;
    totalStolen: number;
  };
} {
  const blocklist = blocklistManager.loadBlocklist();
  
  const network = blocklist.scamNetworks.find(n => {
    const isDeployer = n.deployerWallets.some(
      w => w.toLowerCase() === deployerAddress.toLowerCase()
    );
    const isFunder = fundingSource && n.masterWallets.some(
      w => w.toLowerCase() === fundingSource.toLowerCase()
    );
    return isDeployer || isFunder;
  });

  if (network) {
    const isDeployer = network.deployerWallets.some(
      w => w.toLowerCase() === deployerAddress.toLowerCase()
    );
    const isFunder = fundingSource && network.masterWallets.some(
      w => w.toLowerCase() === fundingSource.toLowerCase()
    );
    
    const role = (isDeployer && isFunder) ? 'both' : (isDeployer ? 'deployer' : 'funder');
    
    logger.warn(`🕸️ SCAM NETWORK DETECTED: ${network.networkId} with ${network.statistics.totalRugPulls} rug pulls`);
    
    return {
      inScamNetwork: true,
      profile: network,
      networkRisk: {
        networkId: network.networkId,
        role,
        networkRugPulls: network.statistics.totalRugPulls,
        totalStolen: network.statistics.totalStolen
      }
    };
  }

  return { inScamNetwork: false };
}

/**
 * Perform enhanced security scan with blocklist integration
 * This is the main function that integrates with the existing scanner
 */
export function performEnhancedSecurityScan(
  deployerAddress: string,
  fundingSource: string | null,
  tokenAddress?: string
): EnhancedSecurityResult {
  logger.info(`🔍 Starting enhanced security scan for deployer: ${deployerAddress.slice(0, 8)}...`);

  // Initialize result
  const result: EnhancedSecurityResult = {
    deployer: deployerAddress,
    riskLevel: 'LOW',
    riskScore: 0,
    warnings: [],
    isKnownRugger: false,
    suspiciousFunding: false,
    inScamNetwork: false,
    enhancedVerdict: '',
    recommendedAction: 'ALLOW'
  };

  // Feature 1: Check if deployer is known rug puller
  const ruggerCheck = checkKnownRugPuller(deployerAddress);
  result.isKnownRugger = ruggerCheck.isKnownRugger;
  result.ruggerProfile = ruggerCheck.profile;
  result.serialData = ruggerCheck.serialData;

  if (ruggerCheck.isKnownRugger && ruggerCheck.profile) {
    result.riskLevel = 'CRITICAL';
    result.riskScore = Math.max(result.riskScore, ruggerCheck.profile.riskScore);
    result.warnings.push(
      `🚨 KNOWN RUG PULLER: This deployer has rugged ${ruggerCheck.serialData!.totalRugPulls} token(s) before!`
    );
    result.recommendedAction = 'BLOCK';
  }

  // Feature 2: Check funding source
  const funderCheck = checkSuspiciousFunder(fundingSource);
  result.suspiciousFunding = funderCheck.suspiciousFunding;
  result.funderProfile = funderCheck.profile;
  result.fundingRisk = funderCheck.fundingRisk;

  if (funderCheck.suspiciousFunding && funderCheck.fundingRisk) {
    // Elevate risk if not already critical
    if (result.riskLevel !== 'CRITICAL') {
      result.riskLevel = 'HIGH';
    }
    result.riskScore = Math.max(result.riskScore, funderCheck.fundingRisk.riskScore);
    result.warnings.push(
      `⚠️ SUSPICIOUS FUNDING: Funded by wallet that financed ${funderCheck.fundingRisk.confirmedRugPulls} confirmed rug pull(s)`
    );
    if (result.recommendedAction === 'ALLOW') {
      result.recommendedAction = 'WARN';
    }
  }

  // Feature 3: Check scam network involvement
  const networkCheck = checkScamNetwork(deployerAddress, fundingSource);
  result.inScamNetwork = networkCheck.inScamNetwork;
  result.networkProfile = networkCheck.profile;
  result.networkRisk = networkCheck.networkRisk;

  if (networkCheck.inScamNetwork && networkCheck.networkRisk) {
    result.riskLevel = 'CRITICAL';
    result.riskScore = Math.max(result.riskScore, 95);
    result.warnings.push(
      `🕸️ SCAM NETWORK: Part of organized network with ${networkCheck.networkRisk.networkRugPulls} total rug pulls!`
    );
    result.recommendedAction = 'BLOCK';
  }

  // Generate enhanced verdict
  result.enhancedVerdict = generateEnhancedVerdict(result);

  logger.info(`✅ Enhanced scan complete: ${result.riskLevel} (Score: ${result.riskScore})`);

  return result;
}

/**
 * Generate human-readable enhanced verdict
 */
function generateEnhancedVerdict(result: EnhancedSecurityResult): string {
  const parts: string[] = [];

  // Header based on risk level
  if (result.riskLevel === 'CRITICAL') {
    parts.push('🚨 CRITICAL WARNING - DO NOT BUY THIS TOKEN! 🚨\n');
  } else if (result.riskLevel === 'HIGH') {
    parts.push('⚠️ HIGH RISK WARNING - EXTREME CAUTION REQUIRED! ⚠️\n');
  } else if (result.riskLevel === 'MEDIUM') {
    parts.push('🟡 MEDIUM RISK - Proceed with caution\n');
  } else {
    parts.push('✅ No immediate red flags detected\n');
  }

  // Known rug puller details
  if (result.isKnownRugger && result.serialData) {
    parts.push('\n📊 CRIMINAL RECORD:');
    parts.push(`Deployer: ${result.deployer.slice(0, 8)}...${result.deployer.slice(-6)}`);
    parts.push(`Total Rug Pulls: ${result.serialData.totalRugPulls}`);
    parts.push(`Risk Score: ${result.serialData.riskScore}/100`);
    
    if (result.serialData.rugPullHistory.length > 0) {
      parts.push('\n📋 PREVIOUS SCAMS:');
      result.serialData.rugPullHistory.forEach((rug, i) => {
        parts.push(`${i + 1}. "${rug.tokenSymbol}" - ${rug.rugDate}`);
        parts.push(`   └─ ${rug.lpRemoved} LP removed, ~$${rug.estimatedLoss.toLocaleString()} stolen`);
      });
    }
  }

  // Suspicious funding details
  if (result.suspiciousFunding && result.fundingRisk) {
    parts.push('\n💰 FUNDING ANALYSIS:');
    parts.push(`Funded by: ${result.fundingRisk.funderAddress.slice(0, 8)}...${result.fundingRisk.funderAddress.slice(-6)}`);
    parts.push(`This funder financed: ${result.fundingRisk.walletsFinanced} deployer wallet(s)`);
    parts.push(`Confirmed rug pulls from funded wallets: ${result.fundingRisk.confirmedRugPulls}`);
    parts.push(`Funding Risk Score: ${result.fundingRisk.riskScore}/100`);
  }

  // Scam network details
  if (result.inScamNetwork && result.networkRisk) {
    parts.push('\n🕸️ NETWORK ANALYSIS:');
    parts.push(`Network ID: ${result.networkRisk.networkId}`);
    parts.push(`Role in network: ${result.networkRisk.role.toUpperCase()}`);
    parts.push(`Network total rug pulls: ${result.networkRisk.networkRugPulls}`);
    parts.push(`Total stolen by network: $${result.networkRisk.totalStolen.toLocaleString()}`);
    
    if (result.networkProfile) {
      parts.push(`Threat Level: ${result.networkProfile.threatLevel}`);
      parts.push(`Status: ${result.networkProfile.status}`);
    }
  }

  // Recommended action
  parts.push('\n⚡ RECOMMENDED ACTION:');
  switch (result.recommendedAction) {
    case 'BLOCK':
      parts.push('⛔ BLOCK TRANSACTION - This is a confirmed scam!');
      parts.push('DO NOT BUY this token under any circumstances.');
      break;
    case 'WARN':
      parts.push('⚠️ EXTREME CAUTION - High probability of rug pull');
      parts.push('Connected to known scam operations. Invest at your own risk.');
      break;
    case 'CAUTION':
      parts.push('🟡 PROCEED WITH CAUTION - Some risk factors detected');
      parts.push('Always do your own research before investing.');
      break;
    case 'ALLOW':
      parts.push('✅ No major red flags in blocklist');
      parts.push('However, always verify liquidity locks and do your own research.');
      break;
  }

  return parts.join('\n');
}

/**
 * Format enhanced security result for display
 */
export function formatEnhancedSecurityResult(result: EnhancedSecurityResult): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('           ENHANCED SECURITY SCAN RESULT');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Deployer: ${result.deployer}`);
  lines.push(`Risk Level: ${result.riskLevel}`);
  lines.push(`Risk Score: ${result.riskScore}/100`);
  lines.push(`Recommended Action: ${result.recommendedAction}`);
  lines.push('');
  
  if (result.warnings.length > 0) {
    lines.push('⚠️  WARNINGS:');
    result.warnings.forEach(w => lines.push(`   ${w}`));
    lines.push('');
  }
  
  lines.push('───────────────────────────────────────────────────────────');
  lines.push(result.enhancedVerdict);
  lines.push('───────────────────────────────────────────────────────────');
  
  return lines.join('\n');
}

/**
 * Auto-learn: Detect new rug pull and add to blocklist
 */
export function autoLearnRugPull(
  deployerAddress: string,
  tokenAddress: string,
  tokenSymbol: string,
  evidence: string[],
  estimatedLoss: number = 0
): void {
  logger.info(`🧠 Auto-learning new rug pull: ${tokenSymbol} (${deployerAddress.slice(0, 8)}...)`);

  const newProfile: RugPullerProfile = {
    id: Date.now(),
    deployer: deployerAddress,
    tokenAddress: tokenAddress,
    tokenSymbol: tokenSymbol,
    riskLevel: 'CRITICAL',
    riskScore: 85,
    detectedDate: new Date().toISOString().split('T')[0],
    evidence: evidence,
    totalRugPulls: 1,
    rugPullHistory: [
      {
        tokenSymbol: tokenSymbol,
        tokenAddress: tokenAddress,
        rugDate: new Date().toISOString().split('T')[0],
        lpRemoved: '100%',
        estimatedLoss: estimatedLoss,
        victimsCount: 0
      }
    ],
    fundingSource: null,
    fundedBy: [],
    networkId: null,
    isNewWallet: false,
    walletAge: 0,
    status: 'confirmed'
  };

  blocklistManager.addRugPuller(newProfile);
  logger.info(`✅ New rug puller added to blocklist: ${deployerAddress.slice(0, 8)}...`);
}

/**
 * Get blocklist statistics
 */
export function getBlocklistStatistics(): {
  totalRugPullers: number;
  suspiciousFunders: number;
  scamNetworks: number;
  lastUpdated: string;
} {
  const blocklist = blocklistManager.loadBlocklist();
  return {
    totalRugPullers: blocklist.knownRugPullers.length,
    suspiciousFunders: blocklist.suspiciousFunders.length,
    scamNetworks: blocklist.scamNetworks.length,
    lastUpdated: blocklist.lastUpdated
  };
}

/**
 * Reload blocklist manually
 */
export function reloadBlocklist(): void {
  logger.info('🔄 Manually reloading blocklist...');
  blocklistManager.reloadBlocklist();
  const stats = getBlocklistStatistics();
  logger.info(`✅ Reloaded: ${stats.totalRugPullers} ruggers, ${stats.suspiciousFunders} funders, ${stats.scamNetworks} networks`);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  blocklistManager,
  BlocklistManager
};

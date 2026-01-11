/**
 * Enhanced Security Scanner - Cloudflare Workers Edition
 * This version works without Node.js fs/path modules
 */

import { createLogger } from './logger';
import BLOCKLIST from '../blocklist.json';

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
  victimCount: number;
}

export interface EnhancedSecurityResult {
  isKnownRugger: boolean;
  suspiciousFunding: boolean;
  inScamNetwork: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  recommendedAction: 'ALLOW' | 'CAUTION' | 'WARN' | 'BLOCK';
  warnings: string[];
  ruggerProfile?: RugPullerProfile;
  serialData?: {
    totalRugPulls: number;
    rugPullHistory: RugPullHistory[];
    riskScore: number;
  };
  fundingRisk?: {
    funderAddress: string;
    confirmedRugPulls: number;
    fundedWallets: number;
  };
  networkRisk?: {
    networkId: string;
    networkSize: number;
    networkRugPulls: number;
    totalStolen: number;
  };
}

// ============================================================================
// BLOCKLIST FUNCTIONS
// ============================================================================

function checkKnownRugPuller(deployerAddress: string): {
  isKnownRugger: boolean;
  profile?: RugPullerProfile;
  serialData?: {
    totalRugPulls: number;
    rugPullHistory: RugPullHistory[];
    riskScore: number;
  };
} {
  const blocklist = BLOCKLIST as any;
  const rugger = blocklist.knownRugPullers?.find(
    (r: any) => r.deployer.toLowerCase() === deployerAddress.toLowerCase()
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

function checkSuspiciousFunder(fundingSource: string | null): {
  suspiciousFunding: boolean;
  fundingRisk?: {
    funderAddress: string;
    confirmedRugPulls: number;
    fundedWallets: number;
  };
} {
  if (!fundingSource) {
    return { suspiciousFunding: false };
  }

  const blocklist = BLOCKLIST as any;
  const funder = blocklist.suspiciousFunders?.find(
    (f: any) => f.funderAddress.toLowerCase() === fundingSource.toLowerCase()
  );

  if (funder) {
    logger.warn(`⚠️ SUSPICIOUS FUNDER DETECTED: ${fundingSource.slice(0, 8)}... funded ${funder.confirmedRugPulls} rug pullers`);
    return {
      suspiciousFunding: true,
      fundingRisk: {
        funderAddress: funder.funderAddress,
        confirmedRugPulls: funder.confirmedRugPulls,
        fundedWallets: funder.fundedWallets.length
      }
    };
  }

  return { suspiciousFunding: false };
}

function checkScamNetwork(deployerAddress: string): {
  inScamNetwork: boolean;
  networkRisk?: {
    networkId: string;
    networkSize: number;
    networkRugPulls: number;
    totalStolen: number;
  };
} {
  const blocklist = BLOCKLIST as any;
  
  for (const network of blocklist.scamNetworks || []) {
    if (network.members.some((m: string) => m.toLowerCase() === deployerAddress.toLowerCase())) {
      logger.warn(`🕸️ SCAM NETWORK DETECTED: ${network.networkId} with ${network.statistics.totalRugPulls} rug pulls`);
      return {
        inScamNetwork: true,
        networkRisk: {
          networkId: network.networkId,
          networkSize: network.members.length,
          networkRugPulls: network.statistics.totalRugPulls,
          totalStolen: network.statistics.totalStolen
        }
      };
    }
  }

  return { inScamNetwork: false };
}

/**
 * Perform enhanced security scan with blocklist integration
 */
export function performEnhancedSecurityScan(
  deployerAddress: string,
  fundingSource: string | null
): EnhancedSecurityResult {
  logger.info(`🔍 Starting enhanced security scan for deployer: ${deployerAddress.slice(0, 8)}...`);

  const result: EnhancedSecurityResult = {
    isKnownRugger: false,
    suspiciousFunding: false,
    inScamNetwork: false,
    riskLevel: 'LOW',
    riskScore: 0,
    recommendedAction: 'ALLOW',
    warnings: []
  };

  // Check if deployer is known rug puller
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

  // Check funding source
  const funderCheck = checkSuspiciousFunder(fundingSource);
  result.suspiciousFunding = funderCheck.suspiciousFunding;
  result.fundingRisk = funderCheck.fundingRisk;

  if (funderCheck.suspiciousFunding) {
    result.riskScore = Math.max(result.riskScore, 75);
    result.riskLevel = result.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
    result.warnings.push(
      `⚠️ SUSPICIOUS FUNDING: Funded by wallet that financed ${funderCheck.fundingRisk!.confirmedRugPulls} confirmed rug pull(s)`
    );
    if (result.recommendedAction !== 'BLOCK') {
      result.recommendedAction = 'WARN';
    }
  }

  // Check scam network
  const networkCheck = checkScamNetwork(deployerAddress);
  result.inScamNetwork = networkCheck.inScamNetwork;
  result.networkRisk = networkCheck.networkRisk;

  if (networkCheck.inScamNetwork) {
    result.riskScore = Math.max(result.riskScore, 85);
    result.riskLevel = 'CRITICAL';
    result.warnings.push(
      `🕸️ SCAM NETWORK: Part of organized network with ${networkCheck.networkRisk!.networkRugPulls} total rug pulls!`
    );
    result.recommendedAction = 'BLOCK';
  }

  logger.info(`✅ Security scan complete: ${result.riskLevel} risk, score ${result.riskScore}/100`);
  
  return result;
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
  const blocklist = BLOCKLIST as any;
  return {
    totalRugPullers: blocklist.knownRugPullers?.length || 0,
    suspiciousFunders: blocklist.suspiciousFunders?.length || 0,
    scamNetworks: blocklist.scamNetworks?.length || 0,
    lastUpdated: blocklist.lastUpdated || 'Unknown'
  };
}

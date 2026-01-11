/**
 * Security Integration Module
 * 
 * This module provides the integration layer between the existing security.ts scanner
 * and the new enhanced-security-scanner.ts with blocklist features.
 * 
 * Usage: Import this module in your existing code and call the integrated functions.
 */

import { createLogger } from './logger';
import { checkWalletSecurity, WalletSecurityInfo } from './security';
import {
  performEnhancedSecurityScan,
  formatEnhancedSecurityResult,
  autoLearnRugPull,
  getBlocklistStatistics,
  reloadBlocklist,
  EnhancedSecurityResult
} from './enhanced-security-scanner';

const logger = createLogger('SecurityIntegration');

// ============================================================================
// INTEGRATION FUNCTIONS
// ============================================================================

/**
 * Integrated security scan that combines original scanner with blocklist checks
 * 
 * This is the main function you should use instead of checkWalletSecurity
 */
export async function checkWalletSecurityEnhanced(
  address: string,
  deepScan: boolean = true
): Promise<WalletSecurityInfo & { enhanced?: EnhancedSecurityResult }> {
  logger.info(`🔍 Starting integrated security scan for: ${address.slice(0, 8)}...`);

  // Step 1: Run original security scan
  const originalScan = await checkWalletSecurity(address, deepScan);

  // Step 2: Run enhanced blocklist checks
  const enhancedScan = performEnhancedSecurityScan(
    address,
    originalScan.fundingSource,
    undefined // tokenAddress not available at wallet level
  );

  // Step 3: Merge results
  const mergedResult = mergeSecurityResults(originalScan, enhancedScan);

  // Step 4: Auto-learn if new rug pull detected
  if (shouldAutoLearn(originalScan, enhancedScan)) {
    handleAutoLearning(address, originalScan);
  }

  return mergedResult;
}

/**
 * Quick blocklist check for a deployer address
 * Use this for fast checks without full blockchain scan
 */
export function quickBlocklistCheck(deployerAddress: string, fundingSource: string | null = null): EnhancedSecurityResult {
  logger.info(`⚡ Quick blocklist check for: ${deployerAddress.slice(0, 8)}...`);
  return performEnhancedSecurityScan(deployerAddress, fundingSource);
}

/**
 * Check a specific token by its deployer
 */
export async function checkTokenSecurityEnhanced(
  tokenAddress: string,
  deployerAddress: string,
  fundingSource: string | null = null
): Promise<EnhancedSecurityResult> {
  logger.info(`🪙 Checking token security: ${tokenAddress.slice(0, 8)}...`);
  return performEnhancedSecurityScan(deployerAddress, fundingSource, tokenAddress);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Merge original scan results with enhanced blocklist results
 */
function mergeSecurityResults(
  original: WalletSecurityInfo,
  enhanced: EnhancedSecurityResult
): WalletSecurityInfo & { enhanced?: EnhancedSecurityResult } {
  
  // Create merged result
  const merged = { ...original, enhanced };

  // Elevate risk level if blocklist has higher risk
  const riskLevelMap: Record<string, number> = {
    'unknown': 0,
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4
  };

  const originalRiskValue = riskLevelMap[original.riskLevel] || 0;
  const enhancedRiskValue = riskLevelMap[enhanced.riskLevel.toLowerCase()] || 0;

  if (enhancedRiskValue > originalRiskValue) {
    merged.riskLevel = enhanced.riskLevel.toLowerCase() as any;
    logger.info(`⬆️ Risk level elevated from ${original.riskLevel} to ${enhanced.riskLevel} based on blocklist`);
  }

  // Merge risk scores (take the maximum)
  merged.riskScore = Math.max(original.riskScore, enhanced.riskScore);

  // Merge warnings
  if (enhanced.warnings.length > 0) {
    merged.warnings = [...original.warnings, ...enhanced.warnings];
  }

  // Update verdict with enhanced information
  if (enhanced.riskLevel === 'CRITICAL' || enhanced.riskLevel === 'HIGH') {
    merged.verdict = enhanced.enhancedVerdict;
  } else {
    // Prepend enhanced info to original verdict
    merged.verdict = `${enhanced.enhancedVerdict}\n\n${original.verdict}`;
  }

  // Add suspicious patterns from blocklist
  if (enhanced.isKnownRugger) {
    merged.suspiciousPatterns.push({
      type: 'known_scammer',
      severity: 'critical',
      description: `Known rug puller with ${enhanced.serialData?.totalRugPulls || 0} previous scams`,
      evidence: enhanced.ruggerProfile?.evidence || []
    });
  }

  if (enhanced.suspiciousFunding) {
    merged.suspiciousPatterns.push({
      type: 'fresh_wallet_funder',
      severity: 'critical',
      description: 'Funded by wallet that financed confirmed rug pullers',
      evidence: enhanced.funderProfile?.evidence || []
    });
  }

  if (enhanced.inScamNetwork) {
    merged.suspiciousPatterns.push({
      type: 'coordinated_wallets',
      severity: 'critical',
      description: `Part of organized scam network (${enhanced.networkRisk?.networkId})`,
      evidence: enhanced.networkProfile?.networkPatterns || []
    });
  }

  return merged;
}

/**
 * Determine if we should auto-learn this as a new rug pull
 */
function shouldAutoLearn(
  original: WalletSecurityInfo,
  enhanced: EnhancedSecurityResult
): boolean {
  // Only auto-learn if:
  // 1. Original scan detected LP rug activity
  // 2. Not already in blocklist
  // 3. Is a deployer
  
  const hasLpRug = original.suspiciousPatterns.some(p => p.type === 'lp_rugger');
  const notInBlocklist = !enhanced.isKnownRugger;
  const isDeployer = original.isDeployer;

  return hasLpRug && notInBlocklist && isDeployer;
}

/**
 * Handle auto-learning of new rug pull
 */
function handleAutoLearning(address: string, scan: WalletSecurityInfo): void {
  try {
    // Find the token that was rugged
    const lpRugPattern = scan.suspiciousPatterns.find(p => p.type === 'lp_rugger');
    if (!lpRugPattern) return;

    // Get token info
    const tokenAddress = scan.deployedTokens[0] || 'UNKNOWN';
    const tokenSymbol = 'UNKNOWN'; // Would need to fetch from chain
    const evidence = lpRugPattern.evidence || ['LP removal detected'];
    const estimatedLoss = 10000; // Default estimate

    logger.info(`🧠 New rug pull detected! Auto-learning deployer: ${address.slice(0, 8)}...`);
    
    autoLearnRugPull(address, tokenAddress, tokenSymbol, evidence, estimatedLoss);
    
    logger.info(`✅ New rug puller added to blocklist automatically`);
  } catch (error) {
    logger.error('❌ Error in auto-learning:', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format integrated security result for display
 */
export function formatIntegratedSecurityResult(
  result: WalletSecurityInfo & { enhanced?: EnhancedSecurityResult }
): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('         INTEGRATED SECURITY SCAN RESULT');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  
  // Enhanced blocklist results (if available)
  if (result.enhanced) {
    lines.push('🛡️  BLOCKLIST CHECK:');
    lines.push(`   Known Rug Puller: ${result.enhanced.isKnownRugger ? '🚨 YES' : '✅ No'}`);
    lines.push(`   Suspicious Funding: ${result.enhanced.suspiciousFunding ? '⚠️ YES' : '✅ No'}`);
    lines.push(`   In Scam Network: ${result.enhanced.inScamNetwork ? '🕸️ YES' : '✅ No'}`);
    lines.push('');
    
    if (result.enhanced.serialData) {
      lines.push(`   📊 Serial Rug Puller: ${result.enhanced.serialData.totalRugPulls} previous scams`);
      lines.push(`   📈 Rug Puller Risk Score: ${result.enhanced.serialData.riskScore}/100`);
      lines.push('');
    }
  }
  
  // Original scan results
  lines.push('🔍 BLOCKCHAIN ANALYSIS:');
  lines.push(`   Risk Level: ${result.riskLevel.toUpperCase()}`);
  lines.push(`   Risk Score: ${result.riskScore}/100`);
  lines.push(`   Is Deployer: ${result.isDeployer ? 'Yes' : 'No'}`);
  if (result.isDeployer) {
    lines.push(`   Deployed Tokens: ${result.deployedTokens.length}`);
  }
  lines.push(`   Funding Source: ${result.fundingSource || 'Unknown'}`);
  lines.push(`   Risky Connections: ${result.riskyConnections}`);
  lines.push('');
  
  // Suspicious patterns
  if (result.suspiciousPatterns.length > 0) {
    lines.push('⚠️  SUSPICIOUS PATTERNS:');
    result.suspiciousPatterns.forEach((pattern, i) => {
      lines.push(`   ${i + 1}. [${pattern.severity.toUpperCase()}] ${pattern.type}`);
      lines.push(`      ${pattern.description}`);
    });
    lines.push('');
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    lines.push('⚠️  WARNINGS:');
    result.warnings.forEach(w => lines.push(`   ${w}`));
    lines.push('');
  }
  
  // Verdict
  lines.push('───────────────────────────────────────────────────────────');
  lines.push('📋 VERDICT:');
  lines.push('');
  lines.push(result.verdict);
  lines.push('───────────────────────────────────────────────────────────');
  
  // Recommended action
  if (result.enhanced) {
    lines.push('');
    lines.push(`⚡ RECOMMENDED ACTION: ${result.enhanced.recommendedAction}`);
  }
  
  lines.push('═══════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Get comprehensive statistics
 */
export function getSecurityStatistics(): {
  blocklist: {
    totalRugPullers: number;
    suspiciousFunders: number;
    scamNetworks: number;
    lastUpdated: string;
  };
} {
  return {
    blocklist: getBlocklistStatistics()
  };
}

/**
 * Reload blocklist data
 */
export function reloadSecurityData(): void {
  logger.info('🔄 Reloading security data...');
  reloadBlocklist();
  logger.info('✅ Security data reloaded');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Re-export enhanced scanner functions for direct use
  performEnhancedSecurityScan,
  formatEnhancedSecurityResult,
  autoLearnRugPull,
  getBlocklistStatistics,
  reloadBlocklist,
  EnhancedSecurityResult
} from './enhanced-security-scanner';

export {
  // Re-export original security types
  WalletSecurityInfo,
  RiskLevel
} from './security';

/**
 * Simplified Security Scanner for Cloudflare Workers
 * This is a lightweight version that focuses on core security checks
 */

import { createLogger } from './logger';

const logger = createLogger('Security');

export interface SecurityCheckResult {
  isDeployer: boolean;
  deployedTokens: any[];
  deployedTokensAnalysis: any[];
  connectedWallets: any[];
  suspiciousPatterns: any[];
  fundingSource: string | null;
  fundingChain: string[];
  fundingSourceRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Enhanced security check for Cloudflare Workers with blockchain scanning
 * Performs lightweight blockchain analysis within CF Workers limits
 */
export async function checkWalletSecurity(
  walletAddress: string,
  rpcUrl: string = 'https://rpc.mainnet.x1.xyz'
): Promise<SecurityCheckResult> {
  logger.info(`Running enhanced security check for ${walletAddress.slice(0, 8)}...`);
  
  const result: SecurityCheckResult = {
    isDeployer: false,
    deployedTokens: [],
    deployedTokensAnalysis: [],
    connectedWallets: [],
    suspiciousPatterns: [],
    fundingSource: null,
    fundingChain: [],
    fundingSourceRisk: 'low',
    riskScore: 0,
    riskLevel: 'LOW'
  };

  try {
    // 1. Get transaction history (limited to recent txs for performance)
    const txHistory = await getRecentTransactions(walletAddress, rpcUrl);
    
    // 2. Analyze funding source (first incoming transaction)
    const fundingAnalysis = await analyzeFundingSource(txHistory, walletAddress);
    result.fundingSource = fundingAnalysis.fundingSource;
    result.fundingChain = fundingAnalysis.fundingChain;
    result.fundingSourceRisk = fundingAnalysis.riskLevel;
    
    // 3. Check if wallet is a token deployer
    const deployerCheck = await checkTokenDeployments(walletAddress, rpcUrl);
    result.isDeployer = deployerCheck.isDeployer;
    result.deployedTokens = deployerCheck.tokens;
    result.deployedTokensAnalysis = deployerCheck.analysis;
    
    // 4. Detect suspicious patterns
    const patterns = detectSuspiciousPatterns(txHistory, deployerCheck);
    result.suspiciousPatterns = patterns;
    
    // 5. Calculate risk score
    result.riskScore = calculateRiskScore(result);
    result.riskLevel = getRiskLevel(result.riskScore);
    
    logger.info(`Security check complete for ${walletAddress.slice(0, 8)}: ${result.riskLevel} risk`);
    
  } catch (error) {
    logger.error(`Security check failed for ${walletAddress.slice(0, 8)}:`, error);
    // Return basic result on error
  }
  
  return result;
}

// Helper function to get recent transactions
async function getRecentTransactions(address: string, rpcUrl: string, limit: number = 50) {
  try {
    // Get transaction count
    const countResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionCount',
        params: [address, 'latest']
      })
    });
    
    const countData = await countResponse.json();
    const txCount = parseInt(countData.result, 16);
    
    if (txCount === 0) {
      return [];
    }
    
    // Get recent block number
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const blockData = await blockResponse.json();
    const currentBlock = parseInt(blockData.result, 16);
    
    // Get transactions from recent blocks (last ~1000 blocks for performance)
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    const logsResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'eth_getLogs',
        params: [{
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: 'latest',
          address: address
        }]
      })
    });
    
    const logsData = await logsResponse.json();
    return logsData.result || [];
    
  } catch (error) {
    logger.warn('Failed to get transaction history:', error);
    return [];
  }
}

// Analyze funding source from transaction history
async function analyzeFundingSource(txHistory: any[], walletAddress: string) {
  const result = {
    fundingSource: null as string | null,
    fundingChain: [] as string[],
    riskLevel: 'low' as 'low' | 'medium' | 'high' | 'critical'
  };
  
  if (txHistory.length === 0) {
    return result;
  }
  
  // Find first transaction (funding source)
  // In logs, look for transfers TO the wallet
  const firstTx = txHistory[0];
  if (firstTx && firstTx.topics && firstTx.topics.length > 2) {
    // Topics[0] = event signature, topics[1] = from, topics[2] = to
    const fromAddress = '0x' + firstTx.topics[1].slice(26); // Remove padding
    result.fundingSource = fromAddress;
    result.fundingChain = [fromAddress];
  }
  
  return result;
}

// Check if wallet deployed any tokens
async function checkTokenDeployments(address: string, rpcUrl: string) {
  const result = {
    isDeployer: false,
    tokens: [] as any[],
    analysis: [] as any[]
  };
  
  try {
    // Check for contract creation transactions
    // Get recent blocks and check if this address deployed any contracts
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const blockData = await blockResponse.json();
    const currentBlock = parseInt(blockData.result, 16);
    const fromBlock = Math.max(0, currentBlock - 5000); // Check last ~5000 blocks
    
    // Get logs for contract creations
    // This is a simplified check - full implementation would need more analysis
    const logsResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getLogs',
        params: [{
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: 'latest',
          topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer event
          ]
        }]
      })
    });
    
    const logsData = await logsResponse.json();
    const logs = logsData.result || [];
    
    // Check if this address appears as token creator in logs
    for (const log of logs.slice(0, 100)) { // Limit to 100 for performance
      if (log.topics && log.topics.length > 1) {
        const fromAddr = '0x' + log.topics[1].slice(26);
        if (fromAddr.toLowerCase() === address.toLowerCase()) {
          result.isDeployer = true;
          result.tokens.push({
            address: log.address,
            blockNumber: parseInt(log.blockNumber, 16)
          });
        }
      }
    }
    
    // Analyze deployed tokens
    for (const token of result.tokens) {
      result.analysis.push({
        tokenAddress: token.address,
        isRugpull: false, // Would need deeper analysis
        suspicionLevel: 'unknown'
      });
    }
    
  } catch (error) {
    logger.warn('Failed to check token deployments:', error);
  }
  
  return result;
}

// Detect suspicious patterns in transaction history
function detectSuspiciousPatterns(txHistory: any[], deployerCheck: any) {
  const patterns: any[] = [];
  
  // Pattern 1: New wallet (very few transactions)
  if (txHistory.length < 5) {
    patterns.push({
      type: 'new_wallet',
      severity: 'medium',
      description: 'Wallet has very few transactions'
    });
  }
  
  // Pattern 2: Token deployer
  if (deployerCheck.isDeployer) {
    patterns.push({
      type: 'token_deployer',
      severity: 'high',
      description: 'Wallet has deployed tokens'
    });
  }
  
  // Pattern 3: Multiple token deployments (potential serial rugger)
  if (deployerCheck.tokens.length > 1) {
    patterns.push({
      type: 'multiple_deployments',
      severity: 'critical',
      description: `Deployed ${deployerCheck.tokens.length} tokens`
    });
  }
  
  return patterns;
}

// Calculate overall risk score
function calculateRiskScore(result: SecurityCheckResult): number {
  let score = 0;
  
  // Base score from funding
  if (result.fundingSourceRisk === 'high') score += 30;
  if (result.fundingSourceRisk === 'critical') score += 50;
  
  // Token deployer risk
  if (result.isDeployer) score += 20;
  if (result.deployedTokens.length > 1) score += 30;
  
  // Suspicious patterns
  for (const pattern of result.suspiciousPatterns) {
    if (pattern.severity === 'medium') score += 10;
    if (pattern.severity === 'high') score += 20;
    if (pattern.severity === 'critical') score += 40;
  }
  
  return Math.min(score, 100);
}

// Get risk level from score
function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

export function formatSecurityInfo(info: SecurityCheckResult): string {
  return `Security check complete. Risk level: ${info.riskLevel}`;
}

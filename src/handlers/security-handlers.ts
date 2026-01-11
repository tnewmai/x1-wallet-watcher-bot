/**
 * Security Handlers
 * Handlers for security scanning with 24-hour caching
 */

import { Context } from 'grammy';
import { getStorage } from '../storage-v2';
import { checkWalletSecurity, formatSecurityInfo } from '../security';
import { checkSecurityScanRateLimit, checkCommandRateLimit } from '../validation';
import { SECURITY_SCAN_CACHE_TTL, EMOJI } from '../constants';
import { backToMenuKeyboard } from '../keyboards';
import logger from '../logger';

/**
 * Handle security scan request with caching
 */
export async function handleSecurityScan(ctx: Context, walletAddress: string): Promise<void> {
  if (!ctx.from) return;

  // Rate limit check
  const rateLimitCheck = checkSecurityScanRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.answerCallbackQuery({ text: rateLimitCheck.message!, show_alert: true });
    return;
  }

  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  
  // Check cache first
  const storage = getStorage();
  const cachedScan = await storage.getSecurityScanCache(walletAddress);
  
  if (cachedScan) {
    const cacheAge = Date.now() - cachedScan.scannedAt.getTime();
    const hoursOld = Math.floor(cacheAge / (1000 * 60 * 60));
    
    logger.info(`Using cached security scan for ${shortAddr} (${hoursOld}h old)`);
    
    await displaySecurityResults(ctx, walletAddress, cachedScan, true, hoursOld);
    return;
  }
  
  // No cache - perform new scan
  await performSecurityScan(ctx, walletAddress);
}

/**
 * Perform fresh security scan
 */
async function performSecurityScan(ctx: Context, walletAddress: string): Promise<void> {
  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  
  // Show loading message
  await ctx.editMessageText(
    `${EMOJI.SHIELD} <b>Security Scanner</b>\n\n` +
    `📍 <code>${shortAddr}</code>\n\n` +
    `${EMOJI.LOADING} <b>Scanning...</b>\n\n` +
    `Checking for deployers, ruggers, and threats.\n` +
    `This typically takes 3-8 seconds.`,
    { parse_mode: 'HTML' }
  );

  try {
    const securityInfo = await checkWalletSecurity(walletAddress);
    
    // Cache the results
    const storage = getStorage();
    const calculatedRiskScore = calculateRiskScore(securityInfo);
    const { riskScore: _ignored, ...securityInfoRest } = securityInfo as any;
    await storage.cacheSecurityScan(walletAddress, {
      isRugger: securityInfo.isDeployer || securityInfo.deployedTokensAnalysis.some(t => t.isRugpull),
      riskScore: calculatedRiskScore,
      findings: securityInfo.suspiciousPatterns,
      ...securityInfoRest,
    });
    
    logger.info(`Security scan completed for ${shortAddr}, cached for 24h`);
    
    await displaySecurityResults(ctx, walletAddress, securityInfo, false, 0);
  } catch (error) {
    logger.error(`Security scan failed for ${walletAddress}:`, error);
    
    await ctx.editMessageText(
      `${EMOJI.ERROR} <b>Security Scan Failed</b>\n\n` +
      `Unable to complete security scan. Please try again later.`,
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
  }
}

/**
 * Display security scan results
 */
async function displaySecurityResults(
  ctx: Context,
  walletAddress: string,
  securityInfo: any,
  fromCache: boolean,
  cacheAgeHours: number
): Promise<void> {
  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  
  // Calculate threat level
  const riskScore = securityInfo.riskScore || calculateRiskScore(securityInfo);
  const { level, emoji, color, bar } = getThreatDisplay(riskScore, securityInfo);
  
  // Build message
  let message = `${EMOJI.SHIELD} <b>SECURITY SCAN</b>\n\n`;
  message += `📍 <b>Wallet:</b> <code>${shortAddr}</code>\n\n`;
  message += `${emoji} <b>THREAT: ${level} - ${color}</b>\n`;
  message += `${bar}\n\n`;
  message += `─────────────────────────\n\n`;
  
  // Key findings
  if (securityInfo.isDeployer) {
    const tokenCount = securityInfo.deployedTokens?.length || 0;
    message += `${EMOJI.WARNING} <b>TOKEN DEPLOYER</b>\n`;
    message += `Deployed ${tokenCount} token${tokenCount !== 1 ? 's' : ''}\n\n`;
  }
  
  if (securityInfo.deployedTokensAnalysis) {
    const rugCount = securityInfo.deployedTokensAnalysis.filter((t: any) => t.isRugpull).length;
    if (rugCount > 0) {
      message += `${EMOJI.DANGER} <b>RUGGER DETECTED</b>\n`;
      message += `${rugCount} confirmed rug${rugCount !== 1 ? 's' : ''}\n\n`;
    }
  }
  
  if (securityInfo.connectedWallets) {
    const ruggers = securityInfo.connectedWallets.filter((w: any) => w.isLpRugger || w.isHoneypotCreator);
    if (ruggers.length > 0) {
      message += `${EMOJI.WARNING} <b>CONNECTED TO RUGGERS</b>\n`;
      message += `${ruggers.length} suspicious connection${ruggers.length !== 1 ? 's' : ''}\n\n`;
    }
  }
  
  // Cache info
  if (fromCache) {
    message += `\n${EMOJI.CLOCK} <i>Cached result (${cacheAgeHours}h old)</i>\n`;
    message += `<i>Cache expires in ${24 - cacheAgeHours}h</i>`;
  } else {
    message += `\n${EMOJI.CHECK} <i>Fresh scan - cached for 24h</i>`;
  }
  
  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: backToMenuKeyboard()
  });
}

/**
 * Calculate risk score from security info
 */
function calculateRiskScore(securityInfo: any): number {
  let score = 0;
  
  // Deployer status
  if (securityInfo.isDeployer) {
    score += 20;
    const tokenCount = securityInfo.deployedTokens?.length || 0;
    score += Math.min(tokenCount * 5, 30);
  }
  
  // Rug pulls
  if (securityInfo.deployedTokensAnalysis) {
    const rugCount = securityInfo.deployedTokensAnalysis.filter((t: any) => t.isRugpull).length;
    score += rugCount * 25;
  }
  
  // Suspicious patterns
  if (securityInfo.suspiciousPatterns) {
    score += securityInfo.suspiciousPatterns.length * 10;
  }
  
  // Connected ruggers
  if (securityInfo.connectedWallets) {
    const ruggers = securityInfo.connectedWallets.filter(
      (w: any) => w.isLpRugger || w.isHoneypotCreator
    );
    score += ruggers.length * 15;
  }
  
  return Math.min(score, 100);
}

/**
 * Get threat level display
 */
function getThreatDisplay(riskScore: number, securityInfo: any): {
  level: string;
  emoji: string;
  color: string;
  bar: string;
} {
  const isLpRugger = securityInfo.suspiciousPatterns?.some((p: any) => p.type === 'lp_rugger');
  const rugCount = securityInfo.deployedTokensAnalysis?.filter((t: any) => t.isRugpull).length || 0;
  
  if (isLpRugger || rugCount >= 2) {
    return {
      level: 'EXTREME',
      emoji: '🚨',
      color: isLpRugger ? 'LP RUGGER' : 'SERIAL RUGGER',
      bar: '🔴🔴🔴🔴🔴'
    };
  } else if (rugCount >= 1 || riskScore >= 80) {
    return {
      level: 'DANGER',
      emoji: '🔴',
      color: 'KNOWN RUGGER',
      bar: '🟠🟠🟠🟠⚪'
    };
  } else if (riskScore >= 60) {
    return {
      level: 'WARNING',
      emoji: '🟠',
      color: 'HIGH RISK',
      bar: '🟡🟡🟡⚪⚪'
    };
  } else if (riskScore >= 40) {
    return {
      level: 'CAUTION',
      emoji: '🟡',
      color: 'SUSPICIOUS',
      bar: '🟡🟡⚪⚪⚪'
    };
  } else {
    return {
      level: 'SAFE',
      emoji: '🟢',
      color: 'LOW RISK',
      bar: '🟢🟢⚪⚪⚪'
    };
  }
}

/**
 * Force refresh security scan (bypass cache)
 */
export async function handleSecurityScanRefresh(ctx: Context, walletAddress: string): Promise<void> {
  if (!ctx.from) return;

  // Rate limit check (stricter for forced refresh)
  const rateLimitCheck = checkSecurityScanRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.answerCallbackQuery({ text: rateLimitCheck.message!, show_alert: true });
    return;
  }

  await performSecurityScan(ctx, walletAddress);
}

/**
 * Handle /security command
 */
export async function handleSecurityCommand(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const rateLimitCheck = checkCommandRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.reply(rateLimitCheck.message!);
    return;
  }

  const storage = getStorage();
  const wallets = await storage.getWallets(ctx.from.id);
  
  if (wallets.length === 0) {
    await ctx.reply(
      `${EMOJI.SHIELD} <b>Security Scanner</b>\n\n` +
      `❌ No wallets to scan.\n\n` +
      `Add a wallet first with /watch`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Show wallet selection or scan first wallet
  if (wallets.length === 1) {
    await handleSecurityScan(ctx, wallets[0].address);
  } else {
    await ctx.reply(
      `${EMOJI.SHIELD} <b>Security Scanner</b>\n\n` +
      `Select a wallet to scan:`,
      { parse_mode: 'HTML' }
      // TODO: Add wallet selection keyboard
    );
  }
}

// Portfolio tracking and USD value calculations
import { getBalance, getTokenBalance, formatValue } from './blockchain';
import { getTokenPrice, formatPrice, formatValueUsd } from './prices';
import { WatchedWallet, TrackedToken } from './types';
import { createLogger } from './logger';

const logger = createLogger('Portfolio');

export interface WalletPortfolio {
  walletAddress: string;
  label?: string;
  nativeBalance: string; // XNT balance
  nativeValueUsd: number; // USD value of XNT
  tokens: TokenPortfolioItem[];
  totalValueUsd: number; // Total portfolio value in USD
  last24hChange?: number; // Percentage change (if available)
}

export interface TokenPortfolioItem {
  symbol: string;
  balance: string;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  contractAddress: string;
  program: 'spl-token' | 'token-2022';
}

export interface PortfolioSummary {
  wallets: WalletPortfolio[];
  totalValueUsd: number;
  nativeValueUsd: number;
  tokensValueUsd: number;
  topTokens: { symbol: string; valueUsd: number; percentage: number }[];
}

/**
 * Get portfolio value for a single wallet
 */
export async function getWalletPortfolio(
  wallet: WatchedWallet,
  includeTokens: boolean = true
): Promise<WalletPortfolio> {
  try {
    // Get native XNT balance
    const nativeBalance = await getBalance(wallet.address);
    const nativeBalanceNum = parseFloat(nativeBalance);
    
    // Get XNT price in USD (using symbol 'XN' for X1 native token)
    const xntPrice = await getTokenPrice('XN');
    const nativeValueUsd = nativeBalanceNum * xntPrice;
    
    const tokens: TokenPortfolioItem[] = [];
    let tokensValueUsd = 0;
    
    // Get token balances and values
    if (includeTokens && wallet.trackedTokens && wallet.trackedTokens.length > 0) {
      for (const token of wallet.trackedTokens) {
        try {
          const balance = await getTokenBalance(token.contractAddress, wallet.address);
          if (!balance) continue;
          
          const balanceNum = parseFloat(balance);
          
          // Get token price (may not be available for all tokens)
          const tokenPrice = await getTokenPrice(token.symbol);
          const valueUsd = balanceNum * tokenPrice;
          
          if (balanceNum > 0) {
            tokens.push({
              symbol: token.symbol,
              balance,
              decimals: token.decimals,
              priceUsd: tokenPrice,
              valueUsd,
              contractAddress: token.contractAddress,
              program: token.program,
            });
            
            tokensValueUsd += valueUsd;
          }
        } catch (error) {
          logger.warn(`Failed to get portfolio for token ${token.symbol}`, { error });
        }
      }
    }
    
    // Sort tokens by value (highest first)
    tokens.sort((a, b) => b.valueUsd - a.valueUsd);
    
    return {
      walletAddress: wallet.address,
      label: wallet.label,
      nativeBalance,
      nativeValueUsd,
      tokens,
      totalValueUsd: nativeValueUsd + tokensValueUsd,
    };
  } catch (error) {
    logger.error('Failed to get wallet portfolio', error);
    throw error;
  }
}

/**
 * Get portfolio summary for all user wallets
 */
export async function getUserPortfolioSummary(
  wallets: WatchedWallet[]
): Promise<PortfolioSummary> {
  const portfolios: WalletPortfolio[] = [];
  let totalValueUsd = 0;
  let nativeValueUsd = 0;
  let tokensValueUsd = 0;
  
  // Aggregate all tokens across wallets
  const tokenAggregation: Map<string, { symbol: string; valueUsd: number }> = new Map();
  
  for (const wallet of wallets) {
    try {
      const portfolio = await getWalletPortfolio(wallet, true);
      portfolios.push(portfolio);
      
      totalValueUsd += portfolio.totalValueUsd;
      nativeValueUsd += portfolio.nativeValueUsd;
      
      // Aggregate token values
      for (const token of portfolio.tokens) {
        tokensValueUsd += token.valueUsd;
        
        const existing = tokenAggregation.get(token.symbol);
        if (existing) {
          existing.valueUsd += token.valueUsd;
        } else {
          tokenAggregation.set(token.symbol, {
            symbol: token.symbol,
            valueUsd: token.valueUsd,
          });
        }
      }
    } catch (error) {
      logger.warn(`Failed to get portfolio for wallet ${wallet.address}`, { error });
    }
  }
  
  // Sort portfolios by total value
  portfolios.sort((a, b) => b.totalValueUsd - a.totalValueUsd);
  
  // Get top tokens by value
  const topTokens = Array.from(tokenAggregation.values())
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 5)
    .map(token => ({
      symbol: token.symbol,
      valueUsd: token.valueUsd,
      percentage: totalValueUsd > 0 ? (token.valueUsd / totalValueUsd) * 100 : 0,
    }));
  
  return {
    wallets: portfolios,
    totalValueUsd,
    nativeValueUsd,
    tokensValueUsd,
    topTokens,
  };
}

/**
 * Format portfolio value for display
 */
export function formatPortfolioValue(valueUsd: number): string {
  if (valueUsd === 0) return '$0.00';
  if (valueUsd < 0.01) return '< $0.01';
  if (valueUsd < 1) return `$${valueUsd.toFixed(2)}`;
  if (valueUsd < 1000) return `$${valueUsd.toFixed(2)}`;
  if (valueUsd < 1000000) return `$${(valueUsd / 1000).toFixed(2)}K`;
  if (valueUsd < 1000000000) return `$${(valueUsd / 1000000).toFixed(2)}M`;
  return `$${(valueUsd / 1000000000).toFixed(2)}B`;
}

/**
 * Format percentage change
 */
export function formatPercentageChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * Get portfolio change emoji
 */
export function getChangeEmoji(change: number): string {
  if (change > 5) return '🚀';
  if (change > 0) return '📈';
  if (change < -5) return '📉';
  if (change < 0) return '🔻';
  return '➡️';
}

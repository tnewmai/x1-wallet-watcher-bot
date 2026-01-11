// Token Price Service using DexScreener API
import { createLogger } from './logger';

const logger = createLogger('Prices');

// Cache prices for 60 seconds to avoid rate limiting
const priceCache: Map<string, { price: number | null; timestamp: number }> = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

// DexScreener API
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

export interface TokenPrice {
  priceUsd: number | null;
  priceNative: number | null;
  symbol: string | null;
  name: string | null;
}

// Get token price from DexScreener (returns just the USD price as number)
export async function getTokenPrice(symbolOrAddress: string): Promise<number> {
  // Check cache first
  const cached = priceCache.get(symbolOrAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price || 0;
  }

  try {
    // For native token "XN" or "XNT", return a default price or fetch from API
    // You may want to update this with actual X1 token price source
    if (symbolOrAddress === 'XN' || symbolOrAddress === 'XNT') {
      // Placeholder: Replace with actual X1 price API
      const price = 0.05; // Example price
      priceCache.set(symbolOrAddress, { price, timestamp: Date.now() });
      return price;
    }

    const response = await fetch(`${DEXSCREENER_API}/${symbolOrAddress}`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      priceCache.set(symbolOrAddress, { price: 0, timestamp: Date.now() });
      return 0;
    }

    const data = await response.json() as any;

    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      const priceUsd = parseFloat(pair.priceUsd) || 0;
      priceCache.set(symbolOrAddress, { price: priceUsd, timestamp: Date.now() });
      return priceUsd;
    }

    priceCache.set(symbolOrAddress, { price: 0, timestamp: Date.now() });
    return 0;
  } catch (error) {
    logger.error('Error fetching price for ' + symbolOrAddress, error);
    return 0;
  }
}

// Get detailed token price info from DexScreener
export async function getTokenPriceDetailed(mintAddress: string): Promise<TokenPrice> {
  // Check cache first
  const cached = priceCache.get(mintAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      priceUsd: cached.price,
      priceNative: null,
      symbol: null,
      name: null
    };
  }

  try {
    const response = await fetch(`${DEXSCREENER_API}/${mintAddress}`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return { priceUsd: null, priceNative: null, symbol: null, name: null };
    }

    const data = await response.json() as any;

    if (data.pairs && data.pairs.length > 0) {
      // Get the pair with highest liquidity or volume
      const pair = data.pairs[0];
      const priceUsd = parseFloat(pair.priceUsd) || null;
      
      // Cache the result
      priceCache.set(mintAddress, { price: priceUsd, timestamp: Date.now() });

      return {
        priceUsd,
        priceNative: parseFloat(pair.priceNative) || null,
        symbol: pair.baseToken?.symbol || null,
        name: pair.baseToken?.name || null
      };
    }

    // No pairs found - cache null to avoid repeated failed requests
    priceCache.set(mintAddress, { price: null, timestamp: Date.now() });
    return { priceUsd: null, priceNative: null, symbol: null, name: null };

  } catch (error) {
    logger.error('Error fetching price for ' + mintAddress.slice(0, 8) + '...', error);
    return { priceUsd: null, priceNative: null, symbol: null, name: null };
  }
}

// Get prices for multiple tokens (batched)
export async function getTokenPrices(mintAddresses: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  
  // Process in parallel but with a small batch size to avoid rate limits
  const batchSize = 5;
  
  for (let i = 0; i < mintAddresses.length; i += batchSize) {
    const batch = mintAddresses.slice(i, i + batchSize);
    const promises = batch.map(mint => getTokenPrice(mint).then(price => ({ mint, price })));
    
    const batchResults = await Promise.all(promises);
    for (const { mint, price } of batchResults) {
      results.set(mint, price);
    }
  }
  
  return results;
}

// Format price for display (HTML-safe)
export function formatPrice(priceUsd: number | null): string {
  if (priceUsd === null) return '';
  
  if (priceUsd < 0.000001) return '&lt; $0.000001';
  if (priceUsd < 0.0001) return `$${priceUsd.toFixed(8)}`;
  if (priceUsd < 0.01) return `$${priceUsd.toFixed(6)}`;
  if (priceUsd < 1) return `$${priceUsd.toFixed(4)}`;
  if (priceUsd < 1000) return `$${priceUsd.toFixed(2)}`;
  if (priceUsd < 1000000) return `$${(priceUsd / 1000).toFixed(2)}K`;
  return `$${(priceUsd / 1000000).toFixed(2)}M`;
}

// Format value in USD (HTML-safe)
export function formatValueUsd(amount: number, priceUsd: number | null): string {
  if (priceUsd === null) return '';
  const value = amount * priceUsd;
  if (value < 0.01) return '&lt; $0.01';
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1000000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${(value / 1000000).toFixed(2)}M`;
}

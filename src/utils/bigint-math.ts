/**
 * BigInt Math Utilities
 * 
 * Safe utilities for handling large numbers without precision loss
 */

/**
 * Maximum safe integer for Number type
 */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

/**
 * Safely convert BigInt to Number with overflow detection
 * @throws Error if value exceeds safe number range
 */
export function safeBigIntToNumber(value: bigint): number {
  if (value > MAX_SAFE || value < MIN_SAFE) {
    throw new Error(`Value ${value} exceeds safe number range (±${Number.MAX_SAFE_INTEGER})`);
  }
  
  return Number(value);
}

/**
 * Calculate token balance from raw amount with decimals
 * Prevents precision loss by dividing as BigInt first
 * 
 * @param rawAmount - Raw token amount as BigInt
 * @param decimals - Number of decimals for the token
 * @returns Balance as number (safe for display)
 */
export function calculateTokenBalance(
  rawAmount: bigint,
  decimals: number
): number {
  if (decimals < 0 || decimals > 18) {
    throw new Error(`Invalid decimals: ${decimals}. Must be between 0 and 18`);
  }
  
  const divisor = BigInt(10 ** decimals);
  const wholePart = rawAmount / divisor;
  const remainder = rawAmount % divisor;
  
  // Convert after division to maintain precision
  return Number(wholePart) + Number(remainder) / (10 ** decimals);
}

/**
 * Calculate percentage with BigInt precision
 * 
 * @param part - Part value as BigInt
 * @param total - Total value as BigInt
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Percentage as number
 */
export function calculatePercentage(
  part: bigint,
  total: bigint,
  decimalPlaces: number = 2
): number {
  if (total === BigInt(0)) return 0;
  
  // Multiply by 10^(decimalPlaces + 2) to maintain precision
  // Then divide by 10^decimalPlaces to get percentage
  const multiplier = BigInt(10 ** (decimalPlaces + 2));
  const percentage = (part * multiplier) / total;
  
  return Number(percentage) / (10 ** decimalPlaces);
}

/**
 * Check if BigInt can be safely converted to Number
 */
export function canSafelyConvertToNumber(value: bigint): boolean {
  return value <= MAX_SAFE && value >= MIN_SAFE;
}

/**
 * Sum an array of BigInt values
 */
export function sumBigInts(values: bigint[]): bigint {
  return values.reduce((sum, val) => sum + val, BigInt(0));
}

/**
 * Format large number for display
 * If too large for safe conversion, returns string representation
 */
export function formatLargeNumber(value: bigint, decimals: number = 0): string {
  if (canSafelyConvertToNumber(value)) {
    const num = Number(value);
    return decimals > 0 ? num.toFixed(decimals) : num.toString();
  }
  
  // Too large - return as string
  return value.toString();
}

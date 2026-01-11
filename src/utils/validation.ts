/**
 * Validation Utilities
 * 
 * Type guards and validators for safer code
 */

/**
 * Check if value is a valid number (not null, undefined, NaN, or Infinity)
 */
export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

/**
 * Check if string is valid (not null, undefined, or empty)
 */
export function isValidString(value: any): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if array is valid and non-empty
 */
export function isNonEmptyArray<T>(value: any): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Validate block time (Unix timestamp)
 * Returns null if invalid
 */
export function validateBlockTime(blockTime: number | null | undefined): number | null {
  if (!isDefined(blockTime) || blockTime <= 0) {
    return null;
  }
  
  // Check if timestamp is reasonable (after 2020, before 2100)
  const MIN_TIMESTAMP = 1577836800; // 2020-01-01
  const MAX_TIMESTAMP = 4102444800; // 2100-01-01
  
  if (blockTime < MIN_TIMESTAMP || blockTime > MAX_TIMESTAMP) {
    console.warn(`Suspicious block time: ${blockTime}`);
    return null;
  }
  
  return blockTime;
}

/**
 * Calculate wallet age safely with validation
 */
export function calculateWalletAge(blockTime: number | null | undefined): number | null {
  const validBlockTime = validateBlockTime(blockTime);
  
  if (validBlockTime === null) {
    return null;
  }
  
  // Prevent negative ages (future timestamps due to clock skew)
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = Math.max(0, nowSeconds - validBlockTime);
  
  // Convert to days
  return Math.floor(ageSeconds / (60 * 60 * 24));
}

/**
 * Validate and clamp a number to a range
 */
export function clampNumber(
  value: number,
  min: number,
  max: number
): number {
  if (!isValidNumber(value)) return min;
  return Math.max(min, Math.min(max, value));
}

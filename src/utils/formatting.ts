/**
 * Formatting Utilities
 * 
 * Safe string formatting functions with null/undefined handling
 */

/**
 * Format wallet address safely with optional chaining
 * 
 * @param address - Wallet address (may be null/undefined)
 * @param length - Number of characters to show (default: 8)
 * @returns Formatted address or 'unknown'
 */
export function formatAddress(
  address: string | null | undefined, 
  length: number = 8
): string {
  // Handle null/undefined
  if (!address || typeof address !== 'string') {
    return 'unknown';
  }
  
  // If shorter than length, return as-is
  if (address.length <= length) {
    return address;
  }
  
  // Return truncated with ellipsis
  return `${address.slice(0, length)}...`;
}

/**
 * Format wallet address with start and end
 * Example: "ABC...XYZ" 
 */
export function formatAddressFull(
  address: string | null | undefined,
  startLength: number = 4,
  endLength: number = 4
): string {
  if (!address || typeof address !== 'string') {
    return 'unknown';
  }
  
  if (address.length <= startLength + endLength) {
    return address;
  }
  
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * Safely get substring with bounds checking
 */
export function safeSubstring(
  str: string | null | undefined,
  start: number,
  end?: number
): string {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  return str.substring(start, end);
}

/**
 * Format number safely handling null/undefined/NaN
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value == null || isNaN(value) || !isFinite(value)) {
    return '0';
  }
  
  return value.toFixed(decimals);
}

/**
 * Format percentage safely
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value == null || isNaN(value) || !isFinite(value)) {
    return '0.00%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

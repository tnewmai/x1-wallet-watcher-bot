/**
 * BigInt Serialization Fix
 * Enable JSON serialization of BigInt values
 */

import logger from '../logger';

/**
 * Initialize BigInt JSON serialization
 * Call this once at app startup
 */
export function initBigIntSerialization(): void {
  // Add toJSON method to BigInt prototype
  if (!(BigInt.prototype as any).toJSON) {
    (BigInt.prototype as any).toJSON = function() {
      return this.toString();
    };
    logger.debug('BigInt JSON serialization enabled');
  }
}

/**
 * Safe BigInt to Number conversion
 */
export function bigIntToNumber(value: bigint): number {
  if (value > Number.MAX_SAFE_INTEGER) {
    logger.warn(`BigInt ${value} exceeds MAX_SAFE_INTEGER, precision may be lost`);
  }
  return Number(value);
}

/**
 * Safe Number to BigInt conversion
 */
export function numberToBigInt(value: number): bigint {
  if (!Number.isInteger(value)) {
    throw new Error('Cannot convert non-integer to BigInt');
  }
  return BigInt(value);
}

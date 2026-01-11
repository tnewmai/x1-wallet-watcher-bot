/**
 * Validation & Sanitization Utilities
 * Comprehensive input validation and sanitization for security
 */

import logger from './logger';

// Constants
export const MAX_LABEL_LENGTH = 50;
export const MAX_ADDRESS_LENGTH = 100;
export const MIN_ADDRESS_LENGTH = 32;
export const MAX_TOKEN_SYMBOL_LENGTH = 20;

/**
 * Validate and sanitize wallet label
 */
export function validateWalletLabel(label: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  if (!label || typeof label !== 'string') {
    return { valid: false, sanitized: '', error: 'Label must be a non-empty string' };
  }

  // Remove leading/trailing whitespace
  let sanitized = label.trim();

  // Check length
  if (sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'Label cannot be empty' };
  }

  if (sanitized.length > MAX_LABEL_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LABEL_LENGTH);
    logger.warn(`Label truncated to ${MAX_LABEL_LENGTH} characters`);
  }

  // Remove or escape potentially dangerous characters
  sanitized = sanitizeHtml(sanitized);

  // Check for valid characters (alphanumeric, spaces, and common symbols)
  const validLabelPattern = /^[a-zA-Z0-9\s\-_.,()[\]]+$/;
  if (!validLabelPattern.test(sanitized)) {
    return {
      valid: false,
      sanitized,
      error: 'Label contains invalid characters. Only letters, numbers, spaces, and basic symbols allowed.',
    };
  }

  return { valid: true, sanitized };
}

/**
 * Validate blockchain address format
 */
export function validateAddress(address: string): {
  valid: boolean;
  error?: string;
} {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address must be a non-empty string' };
  }

  const trimmed = address.trim();

  // Check length
  if (trimmed.length < MIN_ADDRESS_LENGTH) {
    return { valid: false, error: 'Address is too short' };
  }

  if (trimmed.length > MAX_ADDRESS_LENGTH) {
    return { valid: false, error: 'Address is too long' };
  }

  // Base58 format check (Solana/X1 addresses)
  const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Pattern.test(trimmed)) {
    return { valid: false, error: 'Address contains invalid characters (must be Base58)' };
  }

  return { valid: true };
}

/**
 * Validate token symbol
 */
export function validateTokenSymbol(symbol: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  if (!symbol || typeof symbol !== 'string') {
    return { valid: false, sanitized: '', error: 'Symbol must be a non-empty string' };
  }

  let sanitized = symbol.trim().toUpperCase();

  if (sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'Symbol cannot be empty' };
  }

  if (sanitized.length > MAX_TOKEN_SYMBOL_LENGTH) {
    sanitized = sanitized.slice(0, MAX_TOKEN_SYMBOL_LENGTH);
  }

  // Token symbols should be alphanumeric
  const validSymbolPattern = /^[A-Z0-9]+$/;
  if (!validSymbolPattern.test(sanitized)) {
    return {
      valid: false,
      sanitized,
      error: 'Token symbol must contain only letters and numbers',
    };
  }

  return { valid: true, sanitized };
}

/**
 * Validate numeric value
 */
export function validateNumericValue(
  value: any,
  min?: number,
  max?: number
): {
  valid: boolean;
  parsed: number;
  error?: string;
} {
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);

  if (isNaN(parsed)) {
    return { valid: false, parsed: 0, error: 'Value must be a valid number' };
  }

  if (!isFinite(parsed)) {
    return { valid: false, parsed: 0, error: 'Value must be finite' };
  }

  if (min !== undefined && parsed < min) {
    return { valid: false, parsed, error: `Value must be at least ${min}` };
  }

  if (max !== undefined && parsed > max) {
    return { valid: false, parsed, error: `Value must be at most ${max}` };
  }

  return { valid: true, parsed };
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Escape HTML for display (preserves some formatting)
 */
export function escapeHtml(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Validate telegram user ID
 */
export function validateTelegramId(id: any): {
  valid: boolean;
  parsed: number;
  error?: string;
} {
  const parsed = typeof id === 'string' ? parseInt(id, 10) : Number(id);

  if (isNaN(parsed) || !Number.isInteger(parsed)) {
    return { valid: false, parsed: 0, error: 'Telegram ID must be an integer' };
  }

  if (parsed <= 0) {
    return { valid: false, parsed, error: 'Telegram ID must be positive' };
  }

  if (parsed > Number.MAX_SAFE_INTEGER) {
    return { valid: false, parsed, error: 'Telegram ID is too large' };
  }

  return { valid: true, parsed };
}

/**
 * Validate and sanitize text input (general purpose)
 */
export function validateTextInput(
  text: string,
  maxLength: number = 1000,
  allowHtml: boolean = false
): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  if (!text || typeof text !== 'string') {
    return { valid: false, sanitized: '', error: 'Input must be a non-empty string' };
  }

  let sanitized = text.trim();

  if (sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'Input cannot be empty' };
  }

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
    logger.warn(`Text truncated to ${maxLength} characters`);
  }

  // Sanitize HTML if not allowed
  if (!allowHtml) {
    sanitized = sanitizeHtml(sanitized);
  }

  return { valid: true, sanitized };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): {
  valid: boolean;
  error?: string;
} {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page: any, itemsPerPage: any): {
  valid: boolean;
  page: number;
  itemsPerPage: number;
  error?: string;
} {
  const parsedPage = typeof page === 'string' ? parseInt(page, 10) : Number(page);
  const parsedItemsPerPage = typeof itemsPerPage === 'string' 
    ? parseInt(itemsPerPage, 10) 
    : Number(itemsPerPage);

  if (isNaN(parsedPage) || !Number.isInteger(parsedPage) || parsedPage < 0) {
    return { valid: false, page: 0, itemsPerPage: 10, error: 'Page must be a non-negative integer' };
  }

  if (isNaN(parsedItemsPerPage) || !Number.isInteger(parsedItemsPerPage) || parsedItemsPerPage <= 0) {
    return { valid: false, page: 0, itemsPerPage: 10, error: 'Items per page must be a positive integer' };
  }

  if (parsedItemsPerPage > 100) {
    return { valid: false, page: 0, itemsPerPage: 10, error: 'Items per page cannot exceed 100' };
  }

  return { valid: true, page: parsedPage, itemsPerPage: parsedItemsPerPage };
}

/**
 * Rate limiting - Simple token bucket implementation
 */
export class RateLimiter {
  private buckets: Map<number, { tokens: number; lastRefill: number }>;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private refillInterval: number; // milliseconds

  constructor(maxTokens: number = 10, refillRate: number = 1) {
    this.buckets = new Map();
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = 1000; // 1 second
  }

  /**
   * Check if request is allowed
   */
  checkLimit(userId: number, cost: number = 1): {
    allowed: boolean;
    remaining: number;
    resetIn: number; // seconds until full refill
  } {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    // Initialize bucket if doesn't exist
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(userId, bucket);
    }

    // Refill tokens based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const refillAmount = (timePassed / this.refillInterval) * this.refillRate;
    
    if (refillAmount > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + refillAmount);
      bucket.lastRefill = now;
    }

    // Check if request can be fulfilled
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      
      const resetIn = Math.ceil((this.maxTokens - bucket.tokens) / this.refillRate);
      
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetIn,
      };
    }

    // Rate limit exceeded
    const resetIn = Math.ceil((cost - bucket.tokens) / this.refillRate);
    
    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      resetIn,
    };
  }

  /**
   * Reset rate limit for a user
   */
  reset(userId: number): void {
    this.buckets.delete(userId);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.buckets.clear();
  }

  /**
   * Get bucket info for a user
   */
  getBucket(userId: number): { tokens: number; maxTokens: number } | null {
    const bucket = this.buckets.get(userId);
    if (!bucket) return null;

    // Refill before returning
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const refillAmount = (timePassed / this.refillInterval) * this.refillRate;
    
    const tokens = Math.min(this.maxTokens, bucket.tokens + refillAmount);

    return {
      tokens: Math.floor(tokens),
      maxTokens: this.maxTokens,
    };
  }
}

/**
 * Global rate limiters for different operations
 */
export const rateLimiters = {
  // General commands (10 per 10 seconds)
  commands: new RateLimiter(10, 1),
  
  // Security scans (3 per minute)
  securityScans: new RateLimiter(3, 0.05),
  
  // Wallet additions (5 per minute)
  walletAdditions: new RateLimiter(5, 0.083),
  
  // API calls (20 per minute)
  apiCalls: new RateLimiter(20, 0.33),
};

/**
 * Check command rate limit
 */
export function checkCommandRateLimit(userId: number): {
  allowed: boolean;
  message?: string;
} {
  const result = rateLimiters.commands.checkLimit(userId);
  
  if (!result.allowed) {
    return {
      allowed: false,
      message: `⏱️ Rate limit exceeded. Please wait ${result.resetIn} seconds.`,
    };
  }

  return { allowed: true };
}

/**
 * Check security scan rate limit
 */
export function checkSecurityScanRateLimit(userId: number): {
  allowed: boolean;
  message?: string;
} {
  const result = rateLimiters.securityScans.checkLimit(userId);
  
  if (!result.allowed) {
    return {
      allowed: false,
      message: `🛡️ Security scan rate limit exceeded. Please wait ${result.resetIn} seconds.\n\n` +
               `💡 Tip: Security scans are cached for 24 hours.`,
    };
  }

  return { allowed: true };
}

/**
 * Check wallet addition rate limit
 */
export function checkWalletAdditionRateLimit(userId: number): {
  allowed: boolean;
  message?: string;
} {
  const result = rateLimiters.walletAdditions.checkLimit(userId);
  
  if (!result.allowed) {
    return {
      allowed: false,
      message: `⏱️ Wallet addition rate limit exceeded. Please wait ${result.resetIn} seconds.`,
    };
  }

  return { allowed: true };
}

/**
 * Utility Tests
 * Tests for helper functions and utilities
 */

describe('Pagination Utils', () => {
  test('should paginate array correctly', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const itemsPerPage = 3;
    const page = 0;

    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = items.slice(start, end);

    expect(paginated).toEqual([1, 2, 3]);
    expect(paginated.length).toBe(3);
  });

  test('should handle last page correctly', () => {
    const items = [1, 2, 3, 4, 5];
    const itemsPerPage = 3;
    const page = 1; // Second page

    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = items.slice(start, end);

    expect(paginated).toEqual([4, 5]);
    expect(paginated.length).toBe(2);
  });

  test('should calculate total pages', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const itemsPerPage = 3;
    const totalPages = Math.ceil(items.length / itemsPerPage);

    expect(totalPages).toBe(3);
  });
});

describe('Formatting Utils', () => {
  test('should format token amounts', () => {
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(0.00001)).toContain('0.0001');
    expect(formatAmount(1234.56)).toBe('1234.56');
    expect(formatAmount(1000000)).toContain('M');
  });

  test('should format USD values', () => {
    expect(formatUSD(1234.56)).toBe('$1,234.56');
    expect(formatUSD(0.5)).toBe('$0.50');
    expect(formatUSD(1000000)).toBe('$1,000,000.00');
  });

  test('should escape HTML special characters', () => {
    const html = '<script>alert("xss")</script>';
    const escaped = escapeHtml(html);
    
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
  });
});

// Helper functions for tests
function formatAmount(amount: number): string {
  if (amount === 0) return '0';
  if (amount < 0.0001) return '< 0.0001';
  if (amount < 1) return amount.toFixed(4);
  if (amount < 1000) return amount.toFixed(2);
  if (amount < 1000000) return `${(amount / 1000).toFixed(2)}K`;
  if (amount < 1000000000) return `${(amount / 1000000).toFixed(2)}M`;
  return `${(amount / 1000000000).toFixed(2)}B`;
}

function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

describe('Date/Time Utils', () => {
  test('should format dates consistently', () => {
    const date = new Date('2026-01-09T19:14:34Z');
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
    
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('9');
    expect(formatted).toContain('2026');
  });

  test('should calculate time differences', () => {
    const now = Date.now();
    const yesterday = now - (24 * 60 * 60 * 1000);
    const diff = Math.floor((now - yesterday) / (1000 * 60 * 60 * 24));
    
    expect(diff).toBe(1);
  });
});

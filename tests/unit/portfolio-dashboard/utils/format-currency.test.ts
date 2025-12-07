import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/features/portfolio-dashboard/utils/format-currency';

describe('formatCurrency utility', () => {
  it('should format basic currency value', () => {
    const result = formatCurrency(1000);
    expect(result).toBe('$1,000.00');
  });

  it('should format large currency values with commas', () => {
    const result = formatCurrency(1000000);
    expect(result).toBe('$1,000,000.00');
  });

  it('should format small decimal values', () => {
    const result = formatCurrency(0.5);
    expect(result).toBe('$0.50');
  });

  it('should format negative currency values', () => {
    const result = formatCurrency(-500);
    expect(result).toBe('-$500.00');
  });

  it('should support custom precision', () => {
    const result = formatCurrency(1234.5678, 1);
    expect(result).toBe('$1,234.6');
  });

  it('should support zero precision', () => {
    const result = formatCurrency(1234.5678, 0);
    expect(result).toBe('$1,235');
  });

  it('should handle zero value', () => {
    const result = formatCurrency(0);
    expect(result).toBe('$0.00');
  });

  it('should handle very large numbers', () => {
    const result = formatCurrency(999999999.99);
    expect(result).toBe('$999,999,999.99');
  });

  it('should handle very small numbers', () => {
    const result = formatCurrency(0.01);
    expect(result).toBe('$0.01');
  });

  it('should handle negative large numbers', () => {
    const result = formatCurrency(-1234567.89);
    expect(result).toBe('-$1,234,567.89');
  });
});

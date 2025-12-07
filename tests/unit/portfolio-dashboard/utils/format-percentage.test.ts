import { describe, it, expect } from 'vitest';
import { formatPercentage } from '@/features/portfolio-dashboard/utils/format-percentage';

describe('formatPercentage utility', () => {
  it('should format basic percentage value', () => {
    const result = formatPercentage(5.5);
    expect(result).toBe('5.50%');
  });

  it('should format percentage with sign when showSign is true', () => {
    const result = formatPercentage(5.5, true);
    expect(result).toBe('+5.50%');
  });

  it('should format negative percentage without sign by default', () => {
    const result = formatPercentage(-5.5);
    expect(result).toBe('-5.50%');
  });

  it('should format negative percentage with sign when showSign is true', () => {
    const result = formatPercentage(-5.5, true);
    expect(result).toBe('-5.50%');
  });

  it('should handle zero value', () => {
    const result = formatPercentage(0);
    expect(result).toBe('0.00%');
  });

  it('should handle zero with showSign true', () => {
    const result = formatPercentage(0, true);
    expect(result).toBe('0.00%');
  });

  it('should handle large percentages', () => {
    const result = formatPercentage(150.25);
    expect(result).toBe('150.25%');
  });

  it('should handle small decimals', () => {
    const result = formatPercentage(0.05);
    expect(result).toBe('0.05%');
  });

  it('should handle very small decimals', () => {
    const result = formatPercentage(0.001);
    expect(result).toBe('0.00%');
  });

  it('should add plus sign for positive values when showSign true', () => {
    const result = formatPercentage(10, true);
    expect(result).toBe('+10.00%');
  });
});

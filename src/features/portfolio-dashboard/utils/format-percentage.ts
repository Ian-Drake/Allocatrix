/**
 * Percentage Formatting Utility
 * 
 * Formats numbers as percentages with optional sign (+/-)
 */

export function formatPercentage(value: number, showSign: boolean = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  const formatted = value.toFixed(2);
  return `${sign}${formatted}%`;
}

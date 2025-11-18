/**
 * Currency Formatting Utility
 * 
 * Formats numbers as USD currency with appropriate precision
 */

export function formatCurrency(value: number, precision: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

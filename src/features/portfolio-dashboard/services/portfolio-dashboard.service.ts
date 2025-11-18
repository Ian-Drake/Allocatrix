/**
 * Portfolio Dashboard API Service
 * 
 * Handles all API calls for portfolio summary and chart data
 * Manages loading states, error handling, and caching
 */

import type {
  PortfolioSummary,
  ChartDataPoint,
  Timeframe,
} from '../types/portfolio-dashboard.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Fetch portfolio summary (total value, daily P&L)
 * 
 * @returns Portfolio summary with total value and daily gain/loss
 * @throws Error if API call fails
 */
export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${API_BASE_URL}/portfolios/summary`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include auth cookies
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch portfolio summary: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch portfolio value history for chart
 * 
 * @param period - Timeframe for historical data
 * @returns Array of date/value points for chart rendering
 * @throws Error if API call fails
 */
export async function fetchPortfolioHistory(
  period: Timeframe
): Promise<ChartDataPoint[]> {
  const periodMap: Record<Timeframe, string> = {
    '30d': '30',
    '60d': '60',
    '90d': '90',
    '180d': '180',
    ttm: 'ttm',
  };

  const response = await fetch(
    `${API_BASE_URL}/portfolios/history?period=${periodMap[period]}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch portfolio history: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Retry wrapper for API calls with exponential backoff
 * 
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum number of retry attempts
 * @param delayMs - Initial delay in milliseconds (increases exponentially)
 * @returns Result of the function call
 * @throws Error if all retries fail
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on the last attempt
      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

/**
 * Fetch portfolio summary with retry logic
 */
export async function fetchPortfolioSummaryWithRetry(): Promise<PortfolioSummary> {
  return retryWithBackoff(() => fetchPortfolioSummary());
}

/**
 * Fetch portfolio history with retry logic
 */
export async function fetchPortfolioHistoryWithRetry(
  period: Timeframe
): Promise<ChartDataPoint[]> {
  return retryWithBackoff(() => fetchPortfolioHistory(period));
}

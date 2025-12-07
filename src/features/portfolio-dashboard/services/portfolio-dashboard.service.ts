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
import { logger } from '../../../backend/utils/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Structured error response for API failures
 */
export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Create structured API error
 */
function createAPIError(
  message: string,
  statusCode?: number,
  code?: string,
  details?: Record<string, unknown>
): APIError {
  const error = new Error(message) as APIError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Parse error response from API
 */
async function parseAPIError(response: Response): Promise<APIError> {
  let errorData: Record<string, unknown> = {};
  try {
    errorData = await response.json() as Record<string, unknown>;
  } catch {
    // If response is not JSON, use status text
  }

  const error = (errorData.error as Record<string, unknown>) || {};
  return createAPIError(
    (error.message as string) || `API error: ${response.statusText}`,
    response.status,
    (error.code as string),
    (error.details as Record<string, unknown>)
  );
}

/**
 * Fetch portfolio summary (total value, daily P&L)
 * 
 * @returns Portfolio summary with total value and daily gain/loss
 * @throws APIError if API call fails
 */
export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  try {
    const response = await fetch(`${API_BASE_URL}/portfolios/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include auth cookies
    });

    if (!response.ok) {
      throw await parseAPIError(response);
    }

    const data: PortfolioSummary = await response.json();

    // Validate response schema
    if (
      typeof data.totalValue !== 'number' ||
      typeof data.dailyGainLoss !== 'number' ||
      typeof data.dailyGainLossPercent !== 'number' ||
      typeof data.lastUpdated !== 'string'
    ) {
      throw createAPIError(
        'Invalid portfolio summary response schema',
        500,
        'SCHEMA_VALIDATION_ERROR'
      );
    }

    return data;
  } catch (error) {
    logger.error('Failed to fetch portfolio summary', {}, error as Error);
    throw error;
  }
}

/**
 * Fetch portfolio value history for chart
 * 
 * @param period - Timeframe for historical data
 * @returns Array of date/value points for chart rendering
 * @throws APIError if API call fails
 */
export async function fetchPortfolioHistory(
  period: Timeframe
): Promise<ChartDataPoint[]> {
  try {
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
      throw await parseAPIError(response);
    }

    const data: ChartDataPoint[] = await response.json();

    // Validate response schema
    if (!Array.isArray(data)) {
      throw createAPIError(
        'Invalid portfolio history response schema',
        500,
        'SCHEMA_VALIDATION_ERROR'
      );
    }

    // Validate each data point
    for (const point of data) {
      if (typeof point.date !== 'string' || typeof point.value !== 'number') {
        throw createAPIError(
          'Invalid chart data point schema',
          500,
          'SCHEMA_VALIDATION_ERROR'
        );
      }
    }

    return data;
  } catch (error) {
    logger.error('Failed to fetch portfolio history', { period }, error as Error);
    throw error;
  }
}

/**
 * Fetch accounts list
 * 
 * @returns Array of accounts with all metrics
 * @throws APIError if API call fails
 */
export async function fetchAccounts(): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseAPIError(response);
    }

    const data = await response.json() as unknown;

    // Validate response schema
    if (!Array.isArray(data)) {
      throw createAPIError(
        'Invalid accounts response schema',
        500,
        'SCHEMA_VALIDATION_ERROR'
      );
    }

    // Validate required fields in each account
    const requiredFields = [
      'id',
      'name',
      'currentValue',
      'todayGainLoss',
      'todayGainLossPercent',
      'excessCash',
      'correctableDrift',
      'totalDrift',
      'positionCount',
      'cashBalance',
    ];

    for (const account of data) {
      const accountObj = account as Record<string, unknown>;
      for (const field of requiredFields) {
        if (!(field in accountObj)) {
          throw createAPIError(
            `Missing required field in account: ${field}`,
            500,
            'SCHEMA_VALIDATION_ERROR'
          );
        }
      }
    }

    return data as Record<string, unknown>[];
  } catch (error) {
    logger.error('Failed to fetch accounts', {}, error as Error);
    throw error;
  }
}

/**
 * Retry wrapper for API calls with exponential backoff
 * Only retries on network errors or 5xx responses
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
      const apiError = error as APIError;

      // Don't retry on 4xx errors (validation, auth, etc.) - only network or 5xx
      if (apiError.statusCode && apiError.statusCode < 500) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1);
        logger.info(`Retrying after ${delay}ms (attempt ${attempt}/${maxAttempts})`, {
          error: apiError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed after retries');
}

/**
 * Fetch portfolio summary with retry logic
 * Retries only on network/500 errors, not validation errors
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

/**
 * Fetch accounts with retry logic
 */
export async function fetchAccountsWithRetry(): Promise<Record<string, unknown>[]> {
  return retryWithBackoff(() => fetchAccounts());
}

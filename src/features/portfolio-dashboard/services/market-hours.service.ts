/**
 * Market Hours Detection Service
 * 
 * Determines if US equity markets are currently open
 * Handles API failures by defaulting to "assume closed" for safety
 * Caches result for 1 hour to reduce API calls
 */

import { logger } from '../../../backend/utils/logger';

interface MarketHoursCacheEntry {
  isOpen: boolean;
  timestamp: number;
}

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

// In-memory cache with 1-hour TTL
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let marketHoursCache: MarketHoursCacheEntry | null = null;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Fetch market open status from backend
 * 
 * @returns true if US markets are open, false if closed
 * @throws APIError if API call fails
 */
async function fetchMarketHoursFromAPI(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/market-hours`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseAPIError(response);
    }

    const data = await response.json() as Record<string, unknown>;

    // Validate response schema
    if (typeof data.isOpen !== 'boolean') {
      throw createAPIError(
        'Invalid market hours response schema',
        500,
        'SCHEMA_VALIDATION_ERROR'
      );
    }

    return data.isOpen;
  } catch (error) {
    logger.error('Market hours API error', {}, error as Error);
    throw error;
  }
}

/**
 * Detect if US markets are currently open with caching
 * 
 * On API failure, defaults to "assume closed" for safety (per spec)
 * Caches result for 1 hour to minimize API calls
 * 
 * @returns true if markets are open, false if closed or API fails
 */
export async function isMarketOpen(): Promise<boolean> {
  // Return cached result if still valid
  if (marketHoursCache) {
    const age = Date.now() - marketHoursCache.timestamp;
    if (age < CACHE_TTL_MS) {
      logger.debug('Using cached market hours', {
        age,
        isOpen: marketHoursCache.isOpen,
      });
      return marketHoursCache.isOpen;
    }
  }

  try {
    const isOpen = await fetchMarketHoursFromAPI();

    // Update cache
    marketHoursCache = {
      isOpen,
      timestamp: Date.now(),
    };

    logger.info('Market hours detected', { isOpen });
    return isOpen;
  } catch (error) {
    // Log error for monitoring
    logger.warn('Unable to determine market status; assuming closed for safety', {
      error: (error as Error).message,
    });

    // Safety default: assume market is CLOSED
    // This triggers the thin-order-book warning for liquidate operations
    // Per spec clarification: "if market hours detection fails, assume market is closed"
    return false;
  }
}

/**
 * Clear the market hours cache
 * Useful for testing or forcing a fresh API call
 */
export function clearMarketHoursCache(): void {
  marketHoursCache = null;
  logger.debug('Market hours cache cleared');
}

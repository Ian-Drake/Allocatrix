/**
 * Market Hours Detection Service
 * 
 * Determines if US equity markets are currently open
 * Handles API failures by defaulting to "assume closed" for safety
 * Caches result for 1 hour to reduce API calls
 */

interface MarketHoursCacheEntry {
  isOpen: boolean;
  timestamp: number;
}

// In-memory cache with 1-hour TTL
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let marketHoursCache: MarketHoursCacheEntry | null = null;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Fetch market open status from backend
 * 
 * @returns true if US markets are open, false if closed
 * @throws Error if API call fails
 */
async function fetchMarketHoursFromAPI(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/market-hours`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch market hours: ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.isOpen === true;
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

    return isOpen;
  } catch (error) {
    // Log error server-side for monitoring
    console.error('Market hours API error:', error);

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
}

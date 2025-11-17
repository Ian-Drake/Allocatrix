import { SchwabApiService } from './schwab-api.service';

/**
 * Historical price data point (OHLCV)
 */
export interface PriceCandle {
  datetime: number; // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Cached historical data entry
 */
interface CachedPriceData {
  symbol: string;
  startDate: string;
  endDate: string;
  frequencyType: 'daily' | 'weekly' | 'monthly';
  candles: PriceCandle[];
  cachedAt: number;
}

/**
 * Service for fetching and caching historical price data
 * 
 * Key features:
 * - Caches historical data in memory to avoid redundant API calls
 * - Supports daily, weekly, monthly data frequencies
 * - Implements cache expiration (7-day TTL for historical data)
 * - Handles batch fetching for multiple symbols
 * 
 * SC-008: Enables 5-year backtest in <5s through aggressive caching
 */
export class HistoricalDataService {
  private cache: Map<string, CachedPriceData> = new Map();
  private readonly CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(private schwabApi: SchwabApiService) {}

  /**
   * Get historical prices for a symbol (with caching)
   * 
   * @param symbol - Ticker symbol (e.g., 'AAPL', 'SPY')
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param endDate - End date in ISO format (YYYY-MM-DD)
   * @param frequencyType - Data frequency (daily, weekly, monthly)
   * @returns Array of price candles sorted by datetime
   */
  async getHistoricalPrices(
    symbol: string,
    startDate: string,
    endDate: string,
    frequencyType: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<PriceCandle[]> {
    const cacheKey = this.getCacheKey(symbol, startDate, endDate, frequencyType);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt)) {
      return cached.candles;
    }

    // Fetch from Schwab API
    const candles = await this.schwabApi.getHistoricalPrices(
      symbol,
      startDate,
      endDate,
      frequencyType,
    );

    // Cache the result
    this.cache.set(cacheKey, {
      symbol,
      startDate,
      endDate,
      frequencyType,
      candles,
      cachedAt: Date.now(),
    });

    return candles;
  }

  /**
   * Batch fetch historical prices for multiple symbols
   * Optimized for backtesting where we need data for all tickers in a portfolio
   * 
   * @param symbols - Array of ticker symbols
   * @param startDate - Start date in ISO format
   * @param endDate - End date in ISO format
   * @param frequencyType - Data frequency
   * @returns Map of symbol to price candles
   */
  async getBatchHistoricalPrices(
    symbols: string[],
    startDate: string,
    endDate: string,
    frequencyType: 'daily' | 'weekly' | 'monthly' = 'daily',
  ): Promise<Map<string, PriceCandle[]>> {
    const results = new Map<string, PriceCandle[]>();

    // Fetch prices for each symbol (can be parallelized)
    await Promise.all(
      symbols.map(async (symbol) => {
        const candles = await this.getHistoricalPrices(
          symbol,
          startDate,
          endDate,
          frequencyType,
        );
        results.set(symbol, candles);
      }),
    );

    return results;
  }

  /**
   * Get closing price on a specific date
   * If exact date not found, returns closest previous trading day
   * 
   * @param symbol - Ticker symbol
   * @param date - Target date in ISO format
   * @returns Closing price, or null if no data available
   */
  async getClosingPrice(symbol: string, date: string): Promise<number | null> {
    const targetTimestamp = new Date(date).getTime();

    // Fetch data for ±1 week window to handle weekends/holidays
    const startDate = new Date(targetTimestamp - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const endDate = new Date(targetTimestamp + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const candles = await this.getHistoricalPrices(
      symbol,
      startDate,
      endDate,
      'daily',
    );

    if (candles.length === 0) return null;

    // Find closest date <= target
    let closestCandle: PriceCandle | null = null;
    let minDiff = Infinity;

    for (const candle of candles) {
      const diff = targetTimestamp - candle.datetime;
      if (diff >= 0 && diff < minDiff) {
        minDiff = diff;
        closestCandle = candle;
      }
    }

    return closestCandle?.close ?? null;
  }

  /**
   * Get dividend data for a symbol over a date range
   * Note: Schwab API may not provide dividend data directly
   * This is a placeholder for future enhancement
   * 
   * @param symbol - Ticker symbol
   * @param startDate - Start date in ISO format
   * @param endDate - End date in ISO format
   * @returns Array of dividend events
   */
  async getDividends(
    symbol: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; amount: number }>> {
    // Placeholder: Schwab Market Data API may not include dividend data
    // For now, return empty array
    // In production, might need to integrate with a separate data source
    return [];
  }

  /**
   * Clear cache for specific symbol or all symbols
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      // Clear all cache entries for this symbol
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${symbol}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.cache.delete(key));
    } else {
      // Clear entire cache
      this.cache.clear();
    }
  }

  /**
   * Generate cache key from parameters
   */
  private getCacheKey(
    symbol: string,
    startDate: string,
    endDate: string,
    frequencyType: string,
  ): string {
    return `${symbol}:${startDate}:${endDate}:${frequencyType}`;
  }

  /**
   * Check if cached data is still valid (within TTL)
   */
  private isCacheValid(cachedAt: number): boolean {
    return Date.now() - cachedAt < this.CACHE_TTL_MS;
  }

  /**
   * Get cache statistics (for monitoring/debugging)
   */
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } {
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (this.isCacheValid(entry.cachedAt)) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
    };
  }
}

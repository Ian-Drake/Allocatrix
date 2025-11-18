/**
 * useMarketHours Hook
 * 
 * Detects if markets are currently open
 * Caches result for 1 hour to avoid excessive API calls
 * Defaults to "closed" on error (safe assumption per research.md)
 */

import { useState, useEffect, useCallback } from 'react';
import type { UseMarketHoursReturn } from '../types/portfolio-dashboard.types';
import { isMarketOpen } from '../services/market-hours.service';

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export function useMarketHours(): UseMarketHoursReturn {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number>(0);

  const checkMarketHours = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const isCacheValid = !forceRefresh && (now - lastChecked) < CACHE_DURATION;

    if (isCacheValid) {
      // Use cached value
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const marketOpen = await isMarketOpen();
      setIsOpen(marketOpen);
      setLastChecked(now);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to detect market hours';
      setError(errorMessage);
      // Default to closed on error (safe assumption)
      setIsOpen(false);
      setLastChecked(now);
    } finally {
      setIsLoading(false);
    }
  }, [lastChecked]);

  useEffect(() => {
    checkMarketHours();
  }, [checkMarketHours]);

  // Computed property: true if market is closed OR detection failed
  const isClosedOrError = !isOpen || error !== null;

  return {
    isOpen,
    isLoading,
    error,
    isClosedOrError,
  };
}

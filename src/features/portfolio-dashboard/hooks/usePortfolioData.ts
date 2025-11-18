/**
 * usePortfolioData Hook
 * 
 * Manages fetching and state for portfolio summary and chart data
 * Handles loading, error, and refresh states
 * Supports timeframe selection with data refetch on timeframe change
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  PortfolioSummary,
  ChartDataPoint,
  Timeframe,
  UsePortfolioDataReturn,
} from '../types/portfolio-dashboard.types';
import {
  fetchPortfolioSummaryWithRetry,
  fetchPortfolioHistoryWithRetry,
} from '../services/portfolio-dashboard.service';
import { transformChartData } from '../utils/chart-data-transform';

/**
 * Hook for fetching and managing portfolio summary and chart data
 * 
 * @returns Portfolio data, loading state, errors, and control functions
 */
export function usePortfolioData(): UsePortfolioDataReturn {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch portfolio data from API
   */
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch summary and chart data in parallel
      const [summaryData, historyData] = await Promise.all([
        fetchPortfolioSummaryWithRetry(),
        fetchPortfolioHistoryWithRetry(timeframe),
      ]);

      setSummary(summaryData);
      setChartData(transformChartData(historyData, timeframe));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch portfolio data';
      setError(errorMessage);
      console.error('Portfolio data fetch error:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  /**
   * Initial fetch on component mount
   */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Handle timeframe change
   * Triggers a refetch of chart data
   */
  const handleTimeframeChange = useCallback((newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
    // Note: fetchData will be called automatically by useEffect dependency
  }, []);

  /**
   * Manual refresh function
   * Re-fetches all data immediately
   */
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    summary,
    chartData,
    timeframe,
    isLoading,
    error,
    setTimeframe: handleTimeframeChange,
    refresh,
  };
}

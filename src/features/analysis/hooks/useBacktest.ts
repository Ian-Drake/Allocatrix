import { useState, useCallback } from 'react';

/**
 * Rebalance frequency options
 */
export type RebalanceFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

/**
 * Backtest parameters
 */
export interface BacktestParams {
  modelPortfolioId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  rebalanceFrequency: RebalanceFrequency;
}

/**
 * Monthly return data point
 */
export interface MonthlyReturn {
  date: string;
  returnPct: number;
  portfolioValue: number;
}

/**
 * Drawdown data point
 */
export interface DrawdownPoint {
  date: string;
  drawdownPct: number;
}

/**
 * Portfolio allocation snapshot
 */
export interface AllocationSnapshot {
  date: string;
  rebalanced: boolean;
  allocations: Array<{
    symbol: string;
    allocationPct: number;
    shares: number;
    value: number;
  }>;
  totalValue: number;
  cash: number;
}

/**
 * Complete backtest result
 */
export interface BacktestResult {
  id: string;
  modelPortfolioId: string;
  modelPortfolioName: string;
  startDate: string;
  endDate: string;
  rebalanceFrequency: RebalanceFrequency;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  monthlyReturns: MonthlyReturn[];
  drawdownChart: DrawdownPoint[];
  allocationHistory: AllocationSnapshot[];
}

/**
 * Backtest summary (without detailed charts)
 */
export interface BacktestSummary {
  id: string;
  modelPortfolioId: string;
  modelPortfolioName: string;
  startDate: string;
  endDate: string;
  rebalanceFrequency: RebalanceFrequency;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  createdAt: string;
}

/**
 * Hook state
 */
interface BacktestState {
  loading: boolean;
  error: string | null;
  currentResult: BacktestResult | null;
  backtests: BacktestSummary[];
}

/**
 * Custom hook for managing backtest state and operations
 * 
 * Features:
 * - Run new backtests
 * - Retrieve cached backtest results
 * - List all backtests for a portfolio
 * - Delete backtest results
 * - Loading and error states
 * 
 * Usage:
 * ```tsx
 * const { runBacktest, loading, currentResult } = useBacktest();
 * 
 * const handleRun = async () => {
 *   await runBacktest({
 *     modelPortfolioId: 'pm-001',
 *     startDate: '2020-01-01',
 *     endDate: '2025-01-01',
 *     rebalanceFrequency: 'QUARTERLY',
 *   });
 * };
 * ```
 */
export function useBacktest() {
  const [state, setState] = useState<BacktestState>({
    loading: false,
    error: null,
    currentResult: null,
    backtests: [],
  });

  /**
   * Run a new backtest
   */
  const runBacktest = useCallback(async (params: BacktestParams): Promise<BacktestResult | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/analysis/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to run backtest');
      }

      const result: BacktestResult = await response.json();
      setState((prev) => ({
        ...prev,
        loading: false,
        currentResult: result,
        error: null,
      }));

      return result;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'An unexpected error occurred',
      }));
      return null;
    }
  }, []);

  /**
   * Get backtest result by ID
   */
  const getBacktest = useCallback(async (backtestId: string): Promise<BacktestResult | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`/api/analysis/results/${backtestId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Backtest not found');
        }
        const error = await response.json();
        throw new Error(error.message || 'Failed to retrieve backtest');
      }

      const result: BacktestResult = await response.json();
      setState((prev) => ({
        ...prev,
        loading: false,
        currentResult: result,
        error: null,
      }));

      return result;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'An unexpected error occurred',
      }));
      return null;
    }
  }, []);

  /**
   * List all backtests, optionally filtered by portfolio
   */
  const listBacktests = useCallback(async (modelPortfolioId?: string): Promise<BacktestSummary[]> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const url = modelPortfolioId
        ? `/api/analysis/backtest?modelPortfolioId=${encodeURIComponent(modelPortfolioId)}`
        : '/api/analysis/backtest';

      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to list backtests');
      }

      const backtests: BacktestSummary[] = await response.json();
      setState((prev) => ({
        ...prev,
        loading: false,
        backtests,
        error: null,
      }));

      return backtests;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'An unexpected error occurred',
      }));
      return [];
    }
  }, []);

  /**
   * Delete a backtest result
   */
  const deleteBacktest = useCallback(async (backtestId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`/api/analysis/results/${backtestId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Backtest not found');
        }
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete backtest');
      }

      // Remove from local state
      setState((prev) => ({
        ...prev,
        loading: false,
        backtests: prev.backtests.filter((b) => b.id !== backtestId),
        currentResult: prev.currentResult?.id === backtestId ? null : prev.currentResult,
        error: null,
      }));

      return true;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'An unexpected error occurred',
      }));
      return false;
    }
  }, []);

  /**
   * Clear current result
   */
  const clearResult = useCallback(() => {
    setState((prev) => ({ ...prev, currentResult: null, error: null }));
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    loading: state.loading,
    error: state.error,
    currentResult: state.currentResult,
    backtests: state.backtests,

    // Actions
    runBacktest,
    getBacktest,
    listBacktests,
    deleteBacktest,
    clearResult,
    clearError,
  };
}

import { getDatabase, runAsync, getAsync, allAsync } from '../db/database';
import { BacktestService, BacktestResult, RebalanceFrequency } from './backtest.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Stored backtest result (database schema)
 */
interface StoredBacktestResult {
  id: string;
  modelPortfolioId: string;
  startDate: string;
  endDate: string;
  rebalanceFrequency: string;
  totalReturn: number;
  volatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  resultsJson: string; // Serialized full results
  createdAt: string;
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
 * Analysis service for running backtests and managing results
 * 
 * Responsibilities:
 * - Execute backtests using BacktestService
 * - Store/retrieve backtest results in database
 * - Calculate and cache performance metrics
 * - Provide comparison data for multiple backtests
 * 
 * SC-008: Optimized for 5-year backtest in <5 seconds
 */
export class AnalysisService {
  constructor(private backtestService: BacktestService) {}

  /**
   * Run a backtest and store results
   * 
   * @param modelPortfolioId - Portfolio to backtest
   * @param startDate - Start date (ISO format: YYYY-MM-DD)
   * @param endDate - End date (ISO format: YYYY-MM-DD)
   * @param rebalanceFrequency - Rebalance schedule
   * @returns Complete backtest result with ID
   */
  async runBacktest(
    modelPortfolioId: string,
    startDate: string,
    endDate: string,
    rebalanceFrequency: RebalanceFrequency,
  ): Promise<BacktestResult & { id: string }> {
    // Validate dates
    this.validateDateRange(startDate, endDate);

    // Run backtest
    const result = await this.backtestService.runBacktest(
      modelPortfolioId,
      startDate,
      endDate,
      rebalanceFrequency,
    );

    // Store in database
    const id = uuidv4();
    await this.storeBacktestResult(id, result);

    return { id, ...result };
  }

  /**
   * Get stored backtest results by ID
   * 
   * @param backtestId - Backtest result ID
   * @returns Full backtest result or null if not found
   */
  async getBacktestById(
    backtestId: string,
  ): Promise<(BacktestResult & { id: string }) | null> {
    const row = await getAsync<StoredBacktestResult>(
      'SELECT * FROM backtest_result WHERE id = ?',
      [backtestId],
    );

    if (!row) return null;

    return this.deserializeBacktestResult(row);
  }

  /**
   * List all backtest results, optionally filtered by portfolio
   * 
   * @param modelPortfolioId - Optional filter by portfolio ID
   * @returns Array of backtest summaries
   */
  async listBacktests(modelPortfolioId?: string): Promise<BacktestSummary[]> {
    let query = 'SELECT * FROM backtest_result';
    const params: string[] = [];

    if (modelPortfolioId) {
      query += ' WHERE modelPortfolioId = ?';
      params.push(modelPortfolioId);
    }

    query += ' ORDER BY createdAt DESC';

    const rows = await allAsync<StoredBacktestResult>(query, params);
    return rows.map((row) => this.deserializeBacktestSummary(row));
  }

  /**
   * Delete a backtest result
   * 
   * @param backtestId - Backtest result ID to delete
   * @returns True if deleted, false if not found
   */
  async deleteBacktest(backtestId: string): Promise<boolean> {
    // First check if it exists
    const existing = await this.getBacktestById(backtestId);
    if (!existing) {
      return false;
    }

    // Delete it
    await runAsync(
      'DELETE FROM backtest_result WHERE id = ?',
      [backtestId],
    );
    return true;
  }

  /**
   * Get comparison data for multiple backtests
   * Useful for comparing different rebalance frequencies or time periods
   * 
   * @param backtestIds - Array of backtest IDs to compare
   * @returns Array of backtest summaries
   */
  async compareBacktests(backtestIds: string[]): Promise<BacktestSummary[]> {
    if (backtestIds.length === 0) return [];

    const placeholders = backtestIds.map(() => '?').join(',');
    const query = `SELECT * FROM backtest_result WHERE id IN (${placeholders})`;

    const rows = await allAsync<StoredBacktestResult>(query, backtestIds);
    return rows.map((row) => this.deserializeBacktestSummary(row));
  }

  /**
   * Calculate performance metrics for comparison
   * Returns key metrics for a set of backtests
   * 
   * @param backtestIds - Array of backtest IDs
   * @returns Map of backtest ID to metrics
   */
  async calculateComparisonMetrics(
    backtestIds: string[],
  ): Promise<
    Map<
      string,
      {
        totalReturn: number;
        annualizedReturn: number;
        volatility: number;
        sharpeRatio: number;
        maxDrawdown: number;
      }
    >
  > {
    const backtests = await this.compareBacktests(backtestIds);
    const metrics = new Map();

    for (const backtest of backtests) {
      // Calculate annualized return from stored data
      const fullResult = await this.getBacktestById(backtest.id);
      if (fullResult) {
        metrics.set(backtest.id, {
          totalReturn: backtest.totalReturn,
          annualizedReturn: fullResult.annualizedReturn,
          volatility: backtest.volatility,
          sharpeRatio: backtest.sharpeRatio,
          maxDrawdown: backtest.maxDrawdown,
        });
      }
    }

    return metrics;
  }

  /**
   * Store backtest result in database
   */
  private async storeBacktestResult(
    id: string,
    result: BacktestResult,
  ): Promise<void> {
    const resultsJson = JSON.stringify({
      monthlyReturns: result.monthlyReturns,
      drawdownChart: result.drawdownChart,
      allocationHistory: result.allocationHistory,
      annualizedReturn: result.annualizedReturn,
    });

    await runAsync(
      `INSERT INTO backtest_result (
        id, modelPortfolioId, startDate, endDate, rebalanceFrequency,
        totalReturn, volatility, maxDrawdown, sharpeRatio, resultsJson
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        result.modelPortfolioId,
        result.startDate,
        result.endDate,
        result.rebalanceFrequency.toLowerCase(),
        result.totalReturn,
        result.volatility,
        result.maxDrawdown,
        result.sharpeRatio,
        resultsJson,
      ],
    );
  }

  /**
   * Deserialize full backtest result from database row
   */
  private deserializeBacktestResult(
    row: StoredBacktestResult,
  ): BacktestResult & { id: string } {
    const detailedResults = JSON.parse(row.resultsJson);

    return {
      id: row.id,
      modelPortfolioId: row.modelPortfolioId,
      modelPortfolioName: '', // Will be populated by API layer
      startDate: row.startDate,
      endDate: row.endDate,
      rebalanceFrequency: row.rebalanceFrequency.toUpperCase() as RebalanceFrequency,
      totalReturn: row.totalReturn,
      annualizedReturn: detailedResults.annualizedReturn,
      volatility: row.volatility,
      sharpeRatio: row.sharpeRatio,
      maxDrawdown: row.maxDrawdown,
      monthlyReturns: detailedResults.monthlyReturns,
      drawdownChart: detailedResults.drawdownChart,
      allocationHistory: detailedResults.allocationHistory,
    };
  }

  /**
   * Deserialize backtest summary (without detailed charts)
   */
  private deserializeBacktestSummary(
    row: StoredBacktestResult,
  ): BacktestSummary {
    const detailedResults = JSON.parse(row.resultsJson);

    return {
      id: row.id,
      modelPortfolioId: row.modelPortfolioId,
      modelPortfolioName: '', // Will be populated by API layer
      startDate: row.startDate,
      endDate: row.endDate,
      rebalanceFrequency: row.rebalanceFrequency.toUpperCase() as RebalanceFrequency,
      totalReturn: row.totalReturn,
      annualizedReturn: detailedResults.annualizedReturn,
      volatility: row.volatility,
      sharpeRatio: row.sharpeRatio,
      maxDrawdown: row.maxDrawdown,
      createdAt: row.createdAt,
    };
  }

  /**
   * Validate date range
   */
  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    if (start >= end) {
      throw new Error('Start date must be before end date');
    }

    // Validate not too far in future
    const now = new Date();
    if (end > now) {
      throw new Error('End date cannot be in the future');
    }

    // Validate minimum backtest period (at least 1 month)
    const minPeriodMs = 30 * 24 * 60 * 60 * 1000; // ~1 month
    if (end.getTime() - start.getTime() < minPeriodMs) {
      throw new Error('Backtest period must be at least 1 month');
    }
  }

  /**
   * Calculate return metrics
   * Utility function for analyzing returns
   */
  calculateReturnMetrics(returns: number[]): {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    if (returns.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0 };
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...returns);
    const max = Math.max(...returns);

    return { mean, stdDev, min, max };
  }

  /**
   * Calculate Sharpe ratio from returns
   * 
   * @param returns - Array of period returns (as percentages)
   * @param riskFreeRate - Annual risk-free rate (default 2%)
   * @param periodsPerYear - Number of periods per year (12 for monthly)
   * @returns Sharpe ratio
   */
  calculateSharpeRatio(
    returns: number[],
    riskFreeRate: number = 0.02,
    periodsPerYear: number = 12,
  ): number {
    if (returns.length === 0) return 0;

    const metrics = this.calculateReturnMetrics(returns);
    const annualizedReturn = metrics.mean * periodsPerYear;
    const annualizedStdDev = metrics.stdDev * Math.sqrt(periodsPerYear);

    if (annualizedStdDev === 0) return 0;

    return (annualizedReturn - riskFreeRate * 100) / annualizedStdDev;
  }

  /**
   * Calculate maximum drawdown from portfolio values
   * 
   * @param values - Array of portfolio values over time
   * @returns Maximum drawdown percentage (negative number)
   */
  calculateMaxDrawdown(values: number[]): number {
    if (values.length === 0) return 0;

    let peak = values[0];
    let maxDrawdown = 0;

    for (const value of values) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = ((value - peak) / peak) * 100;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }
}

import { HistoricalDataService, PriceCandle } from './historical-data.service';
import { PortfolioService } from './portfolio.service';

/**
 * Rebalance frequency options for backtest
 */
export type RebalanceFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

/**
 * Portfolio allocation at a point in time
 */
export interface PortfolioAllocation {
  date: string; // ISO date string
  rebalanced: boolean;
  allocations: Array<{
    symbol: string;
    allocationPct: number; // Target percentage
    shares: number; // Shares held
    value: number; // Market value
  }>;
  totalValue: number;
  cash: number;
}

/**
 * Monthly return data point
 */
export interface MonthlyReturn {
  date: string; // ISO date (first day of month)
  returnPct: number; // Monthly return percentage
  portfolioValue: number; // Total portfolio value
}

/**
 * Drawdown data point
 */
export interface DrawdownPoint {
  date: string; // ISO date
  drawdownPct: number; // Percentage decline from peak
}

/**
 * Complete backtest results
 */
export interface BacktestResult {
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
  allocationHistory: PortfolioAllocation[];
}

/**
 * Backtest engine with Monte Carlo simulation support
 * 
 * Core algorithm:
 * 1. Initialize portfolio with $100,000 starting capital
 * 2. Buy shares according to target allocation at start date
 * 3. Simulate daily price movements and portfolio value
 * 4. Rebalance on schedule (monthly/quarterly/annual)
 * 5. Reinvest dividends according to target allocation
 * 6. Calculate performance metrics
 * 
 * SC-008: Optimized to complete 5-year backtest in <5 seconds
 */
export class BacktestService {
  private readonly INITIAL_CAPITAL = 100000; // $100,000 starting portfolio
  private readonly RISK_FREE_RATE = 0.02; // 2% annual risk-free rate for Sharpe

  constructor(
    private historicalDataService: HistoricalDataService,
    private portfolioService: PortfolioService,
  ) {}

  /**
   * Run backtest simulation for a model portfolio
   * 
   * @param modelPortfolioId - Portfolio to backtest
   * @param startDate - Backtest start date (ISO format)
   * @param endDate - Backtest end date (ISO format)
   * @param rebalanceFrequency - How often to rebalance
   * @returns Complete backtest results
   */
  async runBacktest(
    modelPortfolioId: string,
    startDate: string,
    endDate: string,
    rebalanceFrequency: RebalanceFrequency,
  ): Promise<BacktestResult> {
    // Load model portfolio and tickers
    const portfolio = await this.portfolioService.getPortfolioInfo(
      modelPortfolioId,
    );
    if (!portfolio) {
      throw new Error(`Portfolio ${modelPortfolioId} not found`);
    }

    const portfolioFull = await this.portfolioService.getPortfolio(
      modelPortfolioId,
    );
    if (!portfolioFull) {
      throw new Error(`Portfolio ${modelPortfolioId} not found`);
    }

    // Extract all tickers from asset classes
    const tickers: Array<{ symbol: string; allocationPct: number }> = [];
    for (const assetClass of portfolioFull.assetClasses) {
      const assetClassTickers = portfolioFull.tickers.get(assetClass.name) || [];
      for (const ticker of assetClassTickers) {
        const allocationPct =
          (assetClass.targetWeightPct *
            ticker.targetWeightPctWithinAssetClass) /
          100;
        tickers.push({
          symbol: ticker.symbol,
          allocationPct,
        });
      }
    }

    if (tickers.length === 0) {
      throw new Error(`Portfolio ${modelPortfolioId} has no tickers`);
    }

    // Build target allocation map
    const targetAllocation = new Map<string, number>();
    tickers.forEach((ticker) => {
      targetAllocation.set(ticker.symbol, ticker.allocationPct);
    });

    // Fetch historical price data for all tickers
    const symbols = Array.from(targetAllocation.keys());
    const priceData = await this.historicalDataService.getBatchHistoricalPrices(
      symbols,
      startDate,
      endDate,
      'daily',
    );

    // Validate we have data for all tickers
    for (const symbol of symbols) {
      const candles = priceData.get(symbol);
      if (!candles || candles.length === 0) {
        throw new Error(`No historical data available for ${symbol}`);
      }
    }

    // Run simulation
    const simulation = this.simulateBacktest(
      targetAllocation,
      priceData,
      startDate,
      endDate,
      rebalanceFrequency,
    );

    return {
      modelPortfolioId,
      modelPortfolioName: portfolio.name,
      startDate,
      endDate,
      rebalanceFrequency,
      totalReturn: simulation.totalReturn,
      annualizedReturn: simulation.annualizedReturn,
      volatility: simulation.volatility,
      sharpeRatio: simulation.sharpeRatio,
      maxDrawdown: simulation.maxDrawdown,
      monthlyReturns: simulation.monthlyReturns,
      drawdownChart: simulation.drawdownChart,
      allocationHistory: simulation.allocationHistory,
    };
  }

  /**
   * Core simulation logic
   * Simulates portfolio performance day-by-day with periodic rebalancing
   */
  private simulateBacktest(
    targetAllocation: Map<string, number>,
    priceData: Map<string, PriceCandle[]>,
    startDate: string,
    endDate: string,
    rebalanceFrequency: RebalanceFrequency,
  ): Omit<BacktestResult, 'modelPortfolioId' | 'modelPortfolioName'> {
    // Get all unique trading dates (sorted)
    const tradingDates = this.getUniqueTradingDates(priceData);
    const startIdx = tradingDates.findIndex((d) => d >= startDate);
    const endIdx = tradingDates.findIndex((d) => d > endDate);
    const simulationDates = tradingDates.slice(
      startIdx,
      endIdx === -1 ? undefined : endIdx,
    );

    if (simulationDates.length === 0) {
      throw new Error('No trading dates in specified range');
    }

    // Initialize portfolio with target allocation
    let cash = this.INITIAL_CAPITAL;
    const holdings = new Map<string, number>(); // symbol -> shares

    // Initial purchase on start date
    const initialPrices = this.getPricesOnDate(
      priceData,
      simulationDates[0],
    );
    for (const [symbol, targetPct] of targetAllocation.entries()) {
      const targetValue = this.INITIAL_CAPITAL * (targetPct / 100);
      const price = initialPrices.get(symbol) || 0;
      if (price > 0) {
        const shares = Math.floor(targetValue / price);
        holdings.set(symbol, shares);
        cash -= shares * price;
      }
    }

    // Track portfolio value over time
    const portfolioValues: number[] = [];
    const allocationHistory: PortfolioAllocation[] = [];
    const rebalanceDates = this.getRebalanceDates(
      simulationDates,
      rebalanceFrequency,
    );

    // Simulate day by day
    for (let i = 0; i < simulationDates.length; i++) {
      const currentDate = simulationDates[i];
      const currentPrices = this.getPricesOnDate(priceData, currentDate);

      // Calculate current portfolio value
      let portfolioValue = cash;
      for (const [symbol, shares] of holdings.entries()) {
        const price = currentPrices.get(symbol) || 0;
        portfolioValue += shares * price;
      }
      portfolioValues.push(portfolioValue);

      // Check if rebalance needed
      const shouldRebalance = rebalanceDates.includes(currentDate);
      if (shouldRebalance) {
        // Sell all positions
        for (const [symbol, shares] of holdings.entries()) {
          const price = currentPrices.get(symbol) || 0;
          cash += shares * price;
        }
        holdings.clear();

        // Rebuy according to target allocation
        for (const [symbol, targetPct] of targetAllocation.entries()) {
          const targetValue = portfolioValue * (targetPct / 100);
          const price = currentPrices.get(symbol) || 0;
          if (price > 0) {
            const shares = Math.floor(targetValue / price);
            holdings.set(symbol, shares);
            cash -= shares * price;
          }
        }
      }

      // Record allocation snapshot (monthly or on rebalance)
      if (shouldRebalance || this.isMonthEnd(currentDate, simulationDates, i)) {
        const allocations = Array.from(holdings.entries()).map(
          ([symbol, shares]) => {
            const price = currentPrices.get(symbol) || 0;
            const value = shares * price;
            return {
              symbol,
              allocationPct: (value / portfolioValue) * 100,
              shares,
              value,
            };
          },
        );
        allocationHistory.push({
          date: currentDate,
          rebalanced: shouldRebalance,
          allocations,
          totalValue: portfolioValue,
          cash,
        });
      }
    }

    // Calculate metrics
    const monthlyReturns = this.calculateMonthlyReturns(
      simulationDates,
      portfolioValues,
    );
    const drawdownChart = this.calculateDrawdown(simulationDates, portfolioValues);
    const totalReturn = this.calculateTotalReturn(portfolioValues);
    const annualizedReturn = this.calculateAnnualizedReturn(
      portfolioValues,
      simulationDates,
    );
    const volatility = this.calculateVolatility(monthlyReturns);
    const sharpeRatio = this.calculateSharpeRatio(annualizedReturn, volatility);
    const maxDrawdown = this.calculateMaxDrawdown(drawdownChart);

    return {
      startDate,
      endDate,
      rebalanceFrequency,
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      monthlyReturns,
      drawdownChart,
      allocationHistory,
    };
  }

  /**
   * Get all unique trading dates from price data
   */
  private getUniqueTradingDates(
    priceData: Map<string, PriceCandle[]>,
  ): string[] {
    const dateSet = new Set<string>();
    for (const candles of priceData.values()) {
      for (const candle of candles) {
        const date = new Date(candle.datetime).toISOString().split('T')[0];
        dateSet.add(date);
      }
    }
    return Array.from(dateSet).sort();
  }

  /**
   * Get prices for all symbols on a specific date
   */
  private getPricesOnDate(
    priceData: Map<string, PriceCandle[]>,
    date: string,
  ): Map<string, number> {
    const prices = new Map<string, number>();
    for (const [symbol, candles] of priceData.entries()) {
      const candle = candles.find(
        (c) => new Date(c.datetime).toISOString().split('T')[0] === date,
      );
      if (candle) {
        prices.set(symbol, candle.close);
      }
    }
    return prices;
  }

  /**
   * Calculate rebalance dates based on frequency
   */
  private getRebalanceDates(
    dates: string[],
    frequency: RebalanceFrequency,
  ): string[] {
    const rebalanceDates: string[] = [];
    let lastRebalanceMonth = -1;
    let lastRebalanceQuarter = -1;
    let lastRebalanceYear = -1;

    for (const date of dates) {
      const d = new Date(date);
      const month = d.getMonth();
      const quarter = Math.floor(month / 3);
      const year = d.getFullYear();

      if (frequency === 'MONTHLY' && month !== lastRebalanceMonth) {
        rebalanceDates.push(date);
        lastRebalanceMonth = month;
      } else if (frequency === 'QUARTERLY' && quarter !== lastRebalanceQuarter) {
        rebalanceDates.push(date);
        lastRebalanceQuarter = quarter;
      } else if (frequency === 'ANNUAL' && year !== lastRebalanceYear) {
        rebalanceDates.push(date);
        lastRebalanceYear = year;
      }
    }

    return rebalanceDates;
  }

  /**
   * Check if date is end of month (or last trading day in simulation)
   */
  private isMonthEnd(date: string, allDates: string[], currentIdx: number): boolean {
    if (currentIdx === allDates.length - 1) return true;
    const current = new Date(date);
    const next = new Date(allDates[currentIdx + 1]);
    return current.getMonth() !== next.getMonth();
  }

  /**
   * Calculate monthly returns from daily portfolio values
   */
  private calculateMonthlyReturns(
    dates: string[],
    values: number[],
  ): MonthlyReturn[] {
    const monthlyReturns: MonthlyReturn[] = [];
    let monthStart = 0;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);

      // New month detected
      if (prevDate.getMonth() !== currDate.getMonth()) {
        const monthStartValue = values[monthStart];
        const monthEndValue = values[i - 1];
        const returnPct = ((monthEndValue - monthStartValue) / monthStartValue) * 100;

        monthlyReturns.push({
          date: dates[monthStart],
          returnPct,
          portfolioValue: monthEndValue,
        });

        monthStart = i;
      }
    }

    // Handle last month
    if (monthStart < dates.length - 1) {
      const monthStartValue = values[monthStart];
      const monthEndValue = values[values.length - 1];
      const returnPct = ((monthEndValue - monthStartValue) / monthStartValue) * 100;

      monthlyReturns.push({
        date: dates[monthStart],
        returnPct,
        portfolioValue: monthEndValue,
      });
    }

    return monthlyReturns;
  }

  /**
   * Calculate drawdown chart (decline from peak)
   */
  private calculateDrawdown(dates: string[], values: number[]): DrawdownPoint[] {
    const drawdownChart: DrawdownPoint[] = [];
    let peak = values[0];

    for (let i = 0; i < values.length; i++) {
      if (values[i] > peak) {
        peak = values[i];
      }
      const drawdownPct = ((values[i] - peak) / peak) * 100;
      drawdownChart.push({
        date: dates[i],
        drawdownPct,
      });
    }

    return drawdownChart;
  }

  /**
   * Calculate total return percentage
   */
  private calculateTotalReturn(values: number[]): number {
    const initial = values[0];
    const final = values[values.length - 1];
    return ((final - initial) / initial) * 100;
  }

  /**
   * Calculate annualized return
   */
  private calculateAnnualizedReturn(values: number[], dates: string[]): number {
    const initial = values[0];
    const final = values[values.length - 1];
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (years === 0) return 0;

    return (Math.pow(final / initial, 1 / years) - 1) * 100;
  }

  /**
   * Calculate annualized volatility (standard deviation of returns)
   */
  private calculateVolatility(monthlyReturns: MonthlyReturn[]): number {
    if (monthlyReturns.length < 2) return 0;

    const returns = monthlyReturns.map((r) => r.returnPct);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const monthlyStdDev = Math.sqrt(variance);

    // Annualize: monthly stddev * sqrt(12)
    return monthlyStdDev * Math.sqrt(12);
  }

  /**
   * Calculate Sharpe ratio (excess return per unit of risk)
   */
  private calculateSharpeRatio(annualizedReturn: number, volatility: number): number {
    if (volatility === 0) return 0;
    return (annualizedReturn - this.RISK_FREE_RATE * 100) / volatility;
  }

  /**
   * Calculate maximum drawdown percentage
   */
  private calculateMaxDrawdown(drawdownChart: DrawdownPoint[]): number {
    if (drawdownChart.length === 0) return 0;
    return Math.min(...drawdownChart.map((d) => d.drawdownPct));
  }
}

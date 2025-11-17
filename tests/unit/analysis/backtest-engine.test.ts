import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BacktestService, RebalanceFrequency } from '../../../src/backend/services/backtest.service';
import { HistoricalDataService, PriceCandle } from '../../../src/backend/services/historical-data.service';
import { PortfolioService } from '../../../src/backend/services/portfolio.service';

/**
 * Unit tests for BacktestService
 * 
 * Test coverage:
 * - Backtest execution with different rebalance frequencies
 * - Performance metric calculations
 * - Edge cases (insufficient data, invalid dates)
 * - SC-008: Performance requirement (<5s for 5-year backtest)
 */
describe('BacktestService', () => {
  let backtestService: BacktestService;
  let mockHistoricalDataService: HistoricalDataService;
  let mockPortfolioService: PortfolioService;

  beforeEach(() => {
    // Mock services
    mockHistoricalDataService = {
      getBatchHistoricalPrices: vi.fn(),
    } as any;

    mockPortfolioService = {
      getPortfolioById: vi.fn(),
      getPortfolioTickers: vi.fn(),
    } as any;

    backtestService = new BacktestService(
      mockHistoricalDataService,
      mockPortfolioService,
    );
  });

  describe('runBacktest', () => {
    it('should run backtest with monthly rebalancing', async () => {
      // Setup mock portfolio
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: '60/40 Portfolio',
        status: 'Valid',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'SPY', allocationPct: 60 },
        { symbol: 'AGG', allocationPct: 40 },
      ] as any);

      // Setup mock price data (1 year, simplified)
      const spyPrices = generateMockPrices('2023-01-01', '2023-12-31', 100, 0.01);
      const aggPrices = generateMockPrices('2023-01-01', '2023-12-31', 50, 0.005);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      // Run backtest
      const result = await backtestService.runBacktest(
        'pm-001',
        '2023-01-01',
        '2023-12-31',
        'MONTHLY',
      );

      // Assertions
      expect(result.modelPortfolioId).toBe('pm-001');
      expect(result.modelPortfolioName).toBe('60/40 Portfolio');
      expect(result.rebalanceFrequency).toBe('MONTHLY');
      expect(result.startDate).toBe('2023-01-01');
      expect(result.endDate).toBe('2023-12-31');
      expect(result.totalReturn).toBeGreaterThan(0);
      expect(result.volatility).toBeGreaterThan(0);
      expect(result.monthlyReturns.length).toBeGreaterThan(0);
      expect(result.drawdownChart.length).toBeGreaterThan(0);
      expect(result.allocationHistory.length).toBeGreaterThan(0);
    });

    it('should run backtest with quarterly rebalancing', async () => {
      // Setup mocks
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: 'Growth Portfolio',
        status: 'Valid',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'VTI', allocationPct: 100 },
      ] as any);

      const vtiPrices = generateMockPrices('2020-01-01', '2023-12-31', 150, 0.008);
      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([['VTI', vtiPrices]]),
      );

      // Run backtest
      const result = await backtestService.runBacktest(
        'pm-001',
        '2020-01-01',
        '2023-12-31',
        'QUARTERLY',
      );

      // Assertions
      expect(result.rebalanceFrequency).toBe('QUARTERLY');
      expect(result.allocationHistory.some((a) => a.rebalanced)).toBe(true);
    });

    it('should run backtest with annual rebalancing', async () => {
      // Setup mocks
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: 'Index Portfolio',
        status: 'Valid',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'SPY', allocationPct: 70 },
        { symbol: 'BND', allocationPct: 30 },
      ] as any);

      const spyPrices = generateMockPrices('2018-01-01', '2023-12-31', 200, 0.01);
      const bndPrices = generateMockPrices('2018-01-01', '2023-12-31', 80, 0.003);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['BND', bndPrices],
        ]),
      );

      // Run backtest
      const result = await backtestService.runBacktest(
        'pm-001',
        '2018-01-01',
        '2023-12-31',
        'ANNUAL',
      );

      // Assertions
      expect(result.rebalanceFrequency).toBe('ANNUAL');
      // Should have fewer rebalance events than monthly
      const rebalanceCount = result.allocationHistory.filter((a) => a.rebalanced).length;
      expect(rebalanceCount).toBeLessThan(10); // ~5-6 rebalances in 5 years
    });

    it('should throw error if portfolio not found', async () => {
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue(null);

      await expect(
        backtestService.runBacktest('invalid-id', '2023-01-01', '2023-12-31', 'MONTHLY'),
      ).rejects.toThrow('Portfolio invalid-id not found');
    });

    it('should throw error if portfolio has no tickers', async () => {
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: 'Empty Portfolio',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([]);

      await expect(
        backtestService.runBacktest('pm-001', '2023-01-01', '2023-12-31', 'MONTHLY'),
      ).rejects.toThrow('Portfolio pm-001 has no tickers');
    });

    it('should throw error if historical data missing', async () => {
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: 'Test Portfolio',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'INVALID', allocationPct: 100 },
      ] as any);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([['INVALID', []]]),
      );

      await expect(
        backtestService.runBacktest('pm-001', '2023-01-01', '2023-12-31', 'MONTHLY'),
      ).rejects.toThrow('No historical data available for INVALID');
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate positive total return for appreciating assets', async () => {
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: 'Test',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'GROW', allocationPct: 100 },
      ] as any);

      // Price goes from 100 to 120 (20% gain)
      const prices = generateMockPrices('2023-01-01', '2023-12-31', 100, 0.0015);
      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([['GROW', prices]]),
      );

      const result = await backtestService.runBacktest(
        'pm-001',
        '2023-01-01',
        '2023-12-31',
        'MONTHLY',
      );

      expect(result.totalReturn).toBeGreaterThan(0);
      expect(result.annualizedReturn).toBeGreaterThan(0);
    });

    it('should calculate volatility correctly', async () => {
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: 'Test',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'VOLATILE', allocationPct: 100 },
      ] as any);

      // High volatility prices (alternating up/down)
      const prices = generateVolatilePrices('2023-01-01', '2023-12-31', 100);
      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([['VOLATILE', prices]]),
      );

      const result = await backtestService.runBacktest(
        'pm-001',
        '2023-01-01',
        '2023-12-31',
        'MONTHLY',
      );

      expect(result.volatility).toBeGreaterThan(5); // Should have significant volatility
    });

    it('should calculate Sharpe ratio correctly', async () => {
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: 'Test',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'STEADY', allocationPct: 100 },
      ] as any);

      // Steady growth, low volatility
      const prices = generateMockPrices('2023-01-01', '2023-12-31', 100, 0.0008);
      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([['STEADY', prices]]),
      );

      const result = await backtestService.runBacktest(
        'pm-001',
        '2023-01-01',
        '2023-12-31',
        'MONTHLY',
      );

      expect(result.sharpeRatio).toBeGreaterThan(0); // Positive return with low vol = good Sharpe
    });

    it('should calculate maximum drawdown', async () => {
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: 'Test',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'CRASH', allocationPct: 100 },
      ] as any);

      // Price crashes mid-period
      const prices = generateCrashPrices('2023-01-01', '2023-12-31');
      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([['CRASH', prices]]),
      );

      const result = await backtestService.runBacktest(
        'pm-001',
        '2023-01-01',
        '2023-12-31',
        'MONTHLY',
      );

      expect(result.maxDrawdown).toBeLessThan(0); // Should be negative
      expect(Math.abs(result.maxDrawdown)).toBeGreaterThan(10); // Significant drawdown
    });
  });

  describe('SC-008: Performance Requirement', () => {
    it('should complete 5-year backtest in under 5 seconds', async () => {
      vi.mocked(mockPortfolioService.getPortfolioById).mockResolvedValue({
        id: 'pm-001',
        name: '60/40 Portfolio',
      } as any);

      vi.mocked(mockPortfolioService.getPortfolioTickers).mockResolvedValue([
        { symbol: 'SPY', allocationPct: 60 },
        { symbol: 'AGG', allocationPct: 40 },
      ] as any);

      // 5 years of daily data
      const spyPrices = generateMockPrices('2019-01-01', '2023-12-31', 250, 0.001);
      const aggPrices = generateMockPrices('2019-01-01', '2023-12-31', 100, 0.0005);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      const startTime = Date.now();

      await backtestService.runBacktest(
        'pm-001',
        '2019-01-01',
        '2023-12-31',
        'QUARTERLY',
      );

      const duration = Date.now() - startTime;

      // SC-008: Must complete in under 5 seconds
      expect(duration).toBeLessThan(5000);
    }, 10000); // 10s timeout for safety
  });
});

/**
 * Helper: Generate mock price data with linear trend
 */
function generateMockPrices(
  startDate: string,
  endDate: string,
  startPrice: number,
  dailyGrowth: number = 0.001,
): PriceCandle[] {
  const prices: PriceCandle[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let currentPrice = startPrice;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Skip weekends (simplified - doesn't account for holidays)
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const noise = (Math.random() - 0.5) * 0.02; // ±1% daily noise
    currentPrice *= 1 + dailyGrowth + noise;

    prices.push({
      datetime: d.getTime(),
      open: currentPrice * 0.99,
      high: currentPrice * 1.01,
      low: currentPrice * 0.98,
      close: currentPrice,
      volume: Math.floor(Math.random() * 10000000),
    });
  }

  return prices;
}

/**
 * Helper: Generate volatile price data
 */
function generateVolatilePrices(
  startDate: string,
  endDate: string,
  startPrice: number,
): PriceCandle[] {
  const prices: PriceCandle[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let currentPrice = startPrice;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    // High volatility: ±5% daily swings
    const change = (Math.random() - 0.5) * 0.1;
    currentPrice *= 1 + change;

    prices.push({
      datetime: d.getTime(),
      open: currentPrice,
      high: currentPrice * 1.02,
      low: currentPrice * 0.98,
      close: currentPrice,
      volume: Math.floor(Math.random() * 10000000),
    });
  }

  return prices;
}

/**
 * Helper: Generate price data with crash
 */
function generateCrashPrices(startDate: string, endDate: string): PriceCandle[] {
  const prices: PriceCandle[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const crashDate = new Date(
    start.getTime() + (end.getTime() - start.getTime()) / 2,
  );

  let currentPrice = 100;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    // Crash: 30% drop over 1 month
    if (
      d >= crashDate &&
      d < new Date(crashDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    ) {
      currentPrice *= 0.97; // -3% daily during crash
    } else {
      currentPrice *= 1.001; // Steady growth otherwise
    }

    prices.push({
      datetime: d.getTime(),
      open: currentPrice,
      high: currentPrice * 1.01,
      low: currentPrice * 0.99,
      close: currentPrice,
      volume: Math.floor(Math.random() * 10000000),
    });
  }

  return prices;
}

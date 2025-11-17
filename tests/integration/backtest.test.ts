/**
 * Backtest Integration Tests (T104)
 *
 * Tests complete workflow for historical backtesting:
 * - Acceptance Scenario 1: Run monthly rebalance backtest
 * - Acceptance Scenario 2: Run quarterly rebalance backtest
 * - Acceptance Scenario 3: Run annual rebalance backtest
 * - Acceptance Scenario 4: Compare multiple backtests
 * - Acceptance Scenario 5: Verify dividend reinvestment (placeholder)
 * - SC-008: 5-year backtest completes in <5 seconds
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnalysisService } from '../../src/backend/services/analysis.service';
import { BacktestService } from '../../src/backend/services/backtest.service';
import { HistoricalDataService, PriceCandle } from '../../src/backend/services/historical-data.service';
import { PortfolioService } from '../../src/backend/services/portfolio.service';
import { getDatabase, runAsync, getAsync } from '../../src/backend/db/database';

/**
 * Setup test database with portfolio and tickers
 */
async function setupTestPortfolio(): Promise<string> {
  const portfolioId = 'test-pm-backtest-001';

  // Create portfolio
  await runAsync(
    `INSERT INTO model_portfolio (id, name, description, status) 
     VALUES (?, ?, ?, ?)`,
    [portfolioId, 'Test 60/40 Portfolio', '60% SPY, 40% AGG', 'Valid'],
  );

  // Create asset classes
  const equityId = 'ac-equity-test';
  const bondsId = 'ac-bonds-test';

  await runAsync(
    `INSERT INTO asset_class (id, name, description) VALUES (?, ?, ?)`,
    [equityId, 'U.S. Equities', 'S&P 500'],
  );

  await runAsync(
    `INSERT INTO asset_class (id, name, description) VALUES (?, ?, ?)`,
    [bondsId, 'Fixed Income', 'Aggregate Bonds'],
  );

  // Link asset classes to portfolio
  await runAsync(
    `INSERT INTO model_portfolio_asset_class (id, modelPortfolioId, assetClassId, targetWeightPct)
     VALUES (?, ?, ?, ?)`,
    ['mpac-1', portfolioId, equityId, 60],
  );

  await runAsync(
    `INSERT INTO model_portfolio_asset_class (id, modelPortfolioId, assetClassId, targetWeightPct)
     VALUES (?, ?, ?, ?)`,
    ['mpac-2', portfolioId, bondsId, 40],
  );

  // Add tickers
  await runAsync(
    `INSERT INTO ticker_allocation (id, modelPortfolioAssetClassId, symbol, displayName, targetWeightPctWithinAssetClass)
     VALUES (?, ?, ?, ?, ?)`,
    ['ticker-spy', 'mpac-1', 'SPY', 'SPDR S&P 500 ETF', 100],
  );

  await runAsync(
    `INSERT INTO ticker_allocation (id, modelPortfolioAssetClassId, symbol, displayName, targetWeightPctWithinAssetClass)
     VALUES (?, ?, ?, ?, ?)`,
    ['ticker-agg', 'mpac-2', 'AGG', 'iShares Core U.S. Aggregate Bond ETF', 100],
  );

  return portfolioId;
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  await runAsync('DELETE FROM ticker_allocation WHERE id LIKE ?', ['ticker-%']);
  await runAsync('DELETE FROM model_portfolio_asset_class WHERE id LIKE ?', ['mpac-%']);
  await runAsync('DELETE FROM asset_class WHERE id LIKE ?', ['ac-%test%']);
  await runAsync('DELETE FROM model_portfolio WHERE id LIKE ?', ['test-pm-%']);
  await runAsync('DELETE FROM backtest_result WHERE modelPortfolioId LIKE ?', ['test-pm-%']);
}

/**
 * Generate mock price data for testing
 */
function generateTestPrices(
  startDate: string,
  endDate: string,
  startPrice: number,
  dailyReturn: number = 0.001,
): PriceCandle[] {
  const candles: PriceCandle[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let price = startPrice;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const noise = (Math.random() - 0.5) * 0.02;
    price *= 1 + dailyReturn + noise;

    candles.push({
      datetime: d.getTime(),
      open: price * 0.995,
      high: price * 1.005,
      low: price * 0.99,
      close: price,
      volume: Math.floor(Math.random() * 10000000),
    });
  }

  return candles;
}

describe('Backtest Integration Tests (T104)', () => {
  let portfolioService: PortfolioService;
  let mockHistoricalDataService: HistoricalDataService;
  let backtestService: BacktestService;
  let analysisService: AnalysisService;
  let testPortfolioId: string;

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();

    // Setup test portfolio
    testPortfolioId = await setupTestPortfolio();

    // Initialize services
    portfolioService = new PortfolioService();

    // Mock historical data service
    mockHistoricalDataService = {
      getBatchHistoricalPrices: vi.fn(),
      getHistoricalPrices: vi.fn(),
    } as any;

    backtestService = new BacktestService(
      mockHistoricalDataService,
      portfolioService,
    );

    analysisService = new AnalysisService(backtestService);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Acceptance Scenario 1: Monthly Rebalance Backtest', () => {
    it('should run 1-year backtest with monthly rebalancing', async () => {
      // Setup mock price data
      const spyPrices = generateTestPrices('2023-01-01', '2023-12-31', 400, 0.001);
      const aggPrices = generateTestPrices('2023-01-01', '2023-12-31', 100, 0.0005);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      // Run backtest
      const result = await analysisService.runBacktest(
        testPortfolioId,
        '2023-01-01',
        '2023-12-31',
        'MONTHLY',
      );

      // Verify results
      expect(result.id).toBeDefined();
      expect(result.modelPortfolioId).toBe(testPortfolioId);
      expect(result.rebalanceFrequency).toBe('MONTHLY');
      expect(result.startDate).toBe('2023-01-01');
      expect(result.endDate).toBe('2023-12-31');
      expect(result.totalReturn).toBeGreaterThan(0);
      expect(result.annualizedReturn).toBeGreaterThan(0);
      expect(result.volatility).toBeGreaterThan(0);
      expect(result.monthlyReturns.length).toBeGreaterThan(0);
      expect(result.drawdownChart.length).toBeGreaterThan(0);
      expect(result.allocationHistory.length).toBeGreaterThan(0);

      // Verify rebalancing occurred
      const rebalances = result.allocationHistory.filter((a) => a.rebalanced);
      expect(rebalances.length).toBeGreaterThan(0);
      expect(rebalances.length).toBeLessThanOrEqual(12); // Max 12 monthly rebalances
    });

    it('should store backtest results in database', async () => {
      const spyPrices = generateTestPrices('2023-01-01', '2023-06-30', 400, 0.001);
      const aggPrices = generateTestPrices('2023-01-01', '2023-06-30', 100, 0.0005);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      const result = await analysisService.runBacktest(
        testPortfolioId,
        '2023-01-01',
        '2023-06-30',
        'MONTHLY',
      );

      // Verify stored in database
      const stored = await getAsync(
        'SELECT * FROM backtest_result WHERE id = ?',
        [result.id],
      );

      expect(stored).toBeDefined();
      expect(stored.modelPortfolioId).toBe(testPortfolioId);
      expect(stored.totalReturn).toBeCloseTo(result.totalReturn, 2);
    });
  });

  describe('Acceptance Scenario 2: Quarterly Rebalance Backtest', () => {
    it('should run 2-year backtest with quarterly rebalancing', async () => {
      const spyPrices = generateTestPrices('2022-01-01', '2023-12-31', 350, 0.0008);
      const aggPrices = generateTestPrices('2022-01-01', '2023-12-31', 95, 0.0003);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      const result = await analysisService.runBacktest(
        testPortfolioId,
        '2022-01-01',
        '2023-12-31',
        'QUARTERLY',
      );

      expect(result.rebalanceFrequency).toBe('QUARTERLY');
      
      // Verify quarterly rebalancing
      const rebalances = result.allocationHistory.filter((a) => a.rebalanced);
      expect(rebalances.length).toBeGreaterThan(0);
      expect(rebalances.length).toBeLessThanOrEqual(8); // Max 8 quarterly rebalances in 2 years
    });
  });

  describe('Acceptance Scenario 3: Annual Rebalance Backtest', () => {
    it('should run 3-year backtest with annual rebalancing', async () => {
      const spyPrices = generateTestPrices('2021-01-01', '2023-12-31', 300, 0.0007);
      const aggPrices = generateTestPrices('2021-01-01', '2023-12-31', 90, 0.0002);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      const result = await analysisService.runBacktest(
        testPortfolioId,
        '2021-01-01',
        '2023-12-31',
        'ANNUAL',
      );

      expect(result.rebalanceFrequency).toBe('ANNUAL');
      
      // Verify annual rebalancing
      const rebalances = result.allocationHistory.filter((a) => a.rebalanced);
      expect(rebalances.length).toBeGreaterThan(0);
      expect(rebalances.length).toBeLessThanOrEqual(3); // Max 3 annual rebalances in 3 years
    });
  });

  describe('Acceptance Scenario 4: Compare Multiple Backtests', () => {
    it('should compare monthly, quarterly, and annual rebalancing', async () => {
      const spyPrices = generateTestPrices('2023-01-01', '2023-12-31', 400, 0.001);
      const aggPrices = generateTestPrices('2023-01-01', '2023-12-31', 100, 0.0005);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      // Run three backtests with different frequencies
      const monthly = await analysisService.runBacktest(
        testPortfolioId,
        '2023-01-01',
        '2023-12-31',
        'MONTHLY',
      );

      const quarterly = await analysisService.runBacktest(
        testPortfolioId,
        '2023-01-01',
        '2023-12-31',
        'QUARTERLY',
      );

      const annual = await analysisService.runBacktest(
        testPortfolioId,
        '2023-01-01',
        '2023-12-31',
        'ANNUAL',
      );

      // Compare results
      const comparison = await analysisService.compareBacktests([
        monthly.id,
        quarterly.id,
        annual.id,
      ]);

      expect(comparison).toHaveLength(3);
      expect(comparison.find((b) => b.id === monthly.id)).toBeDefined();
      expect(comparison.find((b) => b.id === quarterly.id)).toBeDefined();
      expect(comparison.find((b) => b.id === annual.id)).toBeDefined();

      // Get comparison metrics
      const metrics = await analysisService.calculateComparisonMetrics([
        monthly.id,
        quarterly.id,
        annual.id,
      ]);

      expect(metrics.size).toBe(3);
      expect(metrics.get(monthly.id)).toBeDefined();
      expect(metrics.get(quarterly.id)).toBeDefined();
      expect(metrics.get(annual.id)).toBeDefined();
    });

    it('should list backtests filtered by portfolio', async () => {
      const spyPrices = generateTestPrices('2023-01-01', '2023-06-30', 400, 0.001);
      const aggPrices = generateTestPrices('2023-01-01', '2023-06-30', 100, 0.0005);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      // Run two backtests
      await analysisService.runBacktest(
        testPortfolioId,
        '2023-01-01',
        '2023-06-30',
        'MONTHLY',
      );

      await analysisService.runBacktest(
        testPortfolioId,
        '2023-01-01',
        '2023-06-30',
        'QUARTERLY',
      );

      // List backtests for portfolio
      const backtests = await analysisService.listBacktests(testPortfolioId);

      expect(backtests.length).toBeGreaterThanOrEqual(2);
      expect(backtests.every((b) => b.modelPortfolioId === testPortfolioId)).toBe(true);
    });
  });

  describe('SC-008: Performance Requirement', () => {
    it('should complete 5-year backtest in under 5 seconds', async () => {
      // Generate 5 years of daily data
      const spyPrices = generateTestPrices('2019-01-01', '2023-12-31', 250, 0.0008);
      const aggPrices = generateTestPrices('2019-01-01', '2023-12-31', 90, 0.0003);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      const startTime = Date.now();

      await analysisService.runBacktest(
        testPortfolioId,
        '2019-01-01',
        '2023-12-31',
        'QUARTERLY',
      );

      const duration = Date.now() - startTime;

      // SC-008: Must complete in under 5 seconds
      expect(duration).toBeLessThan(5000);

      console.log(`5-year backtest completed in ${duration}ms`);
    }, 10000); // 10s timeout for safety
  });

  describe('Edge Cases and Error Handling', () => {
    it('should reject invalid date range', async () => {
      await expect(
        analysisService.runBacktest(
          testPortfolioId,
          '2023-12-31',
          '2023-01-01', // End before start
          'MONTHLY',
        ),
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should reject too short backtest period', async () => {
      await expect(
        analysisService.runBacktest(
          testPortfolioId,
          '2023-01-01',
          '2023-01-15', // Less than 1 month
          'MONTHLY',
        ),
      ).rejects.toThrow('at least 1 month');
    });

    it('should reject future end date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await expect(
        analysisService.runBacktest(
          testPortfolioId,
          '2023-01-01',
          futureDateStr,
          'MONTHLY',
        ),
      ).rejects.toThrow('cannot be in the future');
    });

    it('should delete backtest results', async () => {
      const spyPrices = generateTestPrices('2023-01-01', '2023-06-30', 400, 0.001);
      const aggPrices = generateTestPrices('2023-01-01', '2023-06-30', 100, 0.0005);

      vi.mocked(mockHistoricalDataService.getBatchHistoricalPrices).mockResolvedValue(
        new Map([
          ['SPY', spyPrices],
          ['AGG', aggPrices],
        ]),
      );

      const result = await analysisService.runBacktest(
        testPortfolioId,
        '2023-01-01',
        '2023-06-30',
        'MONTHLY',
      );

      // Delete the backtest
      const deleted = await analysisService.deleteBacktest(result.id);
      expect(deleted).toBe(true);

      // Verify deleted
      const retrieved = await analysisService.getBacktestById(result.id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent backtest', async () => {
      const deleted = await analysisService.deleteBacktest('non-existent-id');
      expect(deleted).toBe(false);
    });
  });
});

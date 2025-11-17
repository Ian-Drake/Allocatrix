import type { NextApiRequest, NextApiResponse } from 'next';
import { AnalysisService } from '../../../backend/services/analysis.service';
import { BacktestService, RebalanceFrequency } from '../../../backend/services/backtest.service';
import { HistoricalDataService } from '../../../backend/services/historical-data.service';
import { PortfolioService } from '../../../backend/services/portfolio.service';
import { SchwabApiService } from '../../../backend/services/schwab-api.service';
import { TokenManagerService } from '../../../backend/services/token-manager.service';

/**
 * POST /api/analysis/backtest
 * 
 * Run historical backtest for a model portfolio
 * 
 * Request body:
 * {
 *   modelPortfolioId: string;
 *   startDate: string; // YYYY-MM-DD
 *   endDate: string;   // YYYY-MM-DD
 *   rebalanceFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
 * }
 * 
 * Response:
 * {
 *   id: string;
 *   modelPortfolioId: string;
 *   modelPortfolioName: string;
 *   startDate: string;
 *   endDate: string;
 *   rebalanceFrequency: string;
 *   totalReturn: number;
 *   annualizedReturn: number;
 *   volatility: number;
 *   sharpeRatio: number;
 *   maxDrawdown: number;
 *   monthlyReturns: Array<{ date: string; returnPct: number; portfolioValue: number }>;
 *   drawdownChart: Array<{ date: string; drawdownPct: number }>;
 *   allocationHistory: Array<{ date: string; rebalanced: boolean; allocations: any[]; totalValue: number; cash: number }>;
 * }
 * 
 * SC-008: Must complete 5-year backtest in under 5 seconds
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Only allow POST for running backtests
  if (req.method === 'POST') {
    return handleRunBacktest(req, res);
  }

  // GET for listing backtests
  if (req.method === 'GET') {
    return handleListBacktests(req, res);
  }

  return res.status(405).json({
    code: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed',
  });
}

/**
 * Handle POST request to run backtest
 */
async function handleRunBacktest(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { modelPortfolioId, startDate, endDate, rebalanceFrequency } = req.body;

    // Validate required fields
    if (!modelPortfolioId || !startDate || !endDate || !rebalanceFrequency) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Missing required fields: modelPortfolioId, startDate, endDate, rebalanceFrequency',
      });
    }

    // Validate rebalance frequency
    const validFrequencies: RebalanceFrequency[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];
    if (!validFrequencies.includes(rebalanceFrequency)) {
      return res.status(400).json({
        code: 'INVALID_FREQUENCY',
        message: 'rebalanceFrequency must be MONTHLY, QUARTERLY, or ANNUAL',
      });
    }

    // Validate date format
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        code: 'INVALID_DATE',
        message: 'Dates must be in YYYY-MM-DD format',
      });
    }

    // Validate date range
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(422).json({
        code: 'INVALID_DATE_RANGE',
        message: 'Start date must be before end date',
      });
    }

    // Initialize services
    // Note: In production, access token should be retrieved from session
    // For backtesting, we may not need auth if using cached data
    const tokenManager = new TokenManagerService();
    const token = await tokenManager.getValidAccessToken();

    if (!token) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'No valid access token available. Please authenticate first.',
      });
    }

    const schwabApi = new SchwabApiService(
      process.env.SCHWAB_API_BASE_URL || 'https://api.schwabapi.com',
      token,
    );
    const historicalDataService = new HistoricalDataService(schwabApi);
    const portfolioService = new PortfolioService();
    const backtestService = new BacktestService(
      historicalDataService,
      portfolioService,
    );
    const analysisService = new AnalysisService(backtestService);

    // Run backtest
    const startTime = Date.now();
    const result = await analysisService.runBacktest(
      modelPortfolioId,
      startDate,
      endDate,
      rebalanceFrequency,
    );
    const duration = Date.now() - startTime;

    // Log performance (SC-008 monitoring)
    console.log(`Backtest completed in ${duration}ms`);
    if (duration > 5000) {
      console.warn(
        `SC-008 VIOLATION: Backtest took ${duration}ms, exceeding 5s threshold`,
      );
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Backtest error:', error);

    // Handle specific errors
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: error.message,
      });
    }

    if (error.message?.includes('No historical data')) {
      return res.status(500).json({
        code: 'DATA_UNAVAILABLE',
        message: error.message,
      });
    }

    if (error.message?.includes('Invalid date') || error.message?.includes('must be')) {
      return res.status(422).json({
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    return res.status(500).json({
      code: 'BACKTEST_FAILED',
      message: error.message || 'Failed to run backtest',
    });
  }
}

/**
 * Handle GET request to list backtests
 */
async function handleListBacktests(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { modelPortfolioId } = req.query;

    // Initialize analysis service (no need for Schwab API for listing)
    const portfolioService = new PortfolioService();
    const backtestService = new BacktestService(null as any, portfolioService);
    const analysisService = new AnalysisService(backtestService);

    // List backtests
    const backtests = await analysisService.listBacktests(
      modelPortfolioId as string | undefined,
    );

    // Populate portfolio names
    for (const backtest of backtests) {
      const portfolio = await portfolioService.getPortfolioInfo(
        backtest.modelPortfolioId,
      );
      if (portfolio) {
        backtest.modelPortfolioName = portfolio.name;
      }
    }

    return res.status(200).json(backtests);
  } catch (error: any) {
    console.error('List backtests error:', error);

    return res.status(500).json({
      code: 'LIST_FAILED',
      message: error.message || 'Failed to list backtests',
    });
  }
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { AnalysisService } from '../../../../backend/services/analysis.service';
import { BacktestService } from '../../../../backend/services/backtest.service';
import { PortfolioService } from '../../../../backend/services/portfolio.service';

/**
 * GET /api/analysis/results/[backtestId]
 * 
 * Retrieve cached backtest results by ID
 * 
 * Path parameter:
 * - backtestId: UUID of the backtest result
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
 * DELETE /api/analysis/results/[backtestId]
 * 
 * Delete a cached backtest result
 * 
 * Response: 204 No Content
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { backtestId } = req.query;

  if (!backtestId || typeof backtestId !== 'string') {
    return res.status(400).json({
      code: 'INVALID_ID',
      message: 'Backtest ID is required',
    });
  }

  if (req.method === 'GET') {
    return handleGetBacktest(backtestId, res);
  }

  if (req.method === 'DELETE') {
    return handleDeleteBacktest(backtestId, res);
  }

  return res.status(405).json({
    code: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed',
  });
}

/**
 * Handle GET request to retrieve backtest results
 */
async function handleGetBacktest(backtestId: string, res: NextApiResponse) {
  try {
    // Initialize services
    const portfolioService = new PortfolioService();
    const backtestService = new BacktestService(null as any, portfolioService);
    const analysisService = new AnalysisService(backtestService);

    // Get backtest results
    const result = await analysisService.getBacktestById(backtestId);

    if (!result) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: `Backtest ${backtestId} not found`,
      });
    }

    // Populate portfolio name
    const portfolio = await portfolioService.getPortfolioInfo(
      result.modelPortfolioId,
    );
    if (portfolio) {
      result.modelPortfolioName = portfolio.name;
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Get backtest error:', error);

    return res.status(500).json({
      code: 'FETCH_FAILED',
      message: error.message || 'Failed to retrieve backtest results',
    });
  }
}

/**
 * Handle DELETE request to remove backtest results
 */
async function handleDeleteBacktest(backtestId: string, res: NextApiResponse) {
  try {
    // Initialize services
    const portfolioService = new PortfolioService();
    const backtestService = new BacktestService(null as any, portfolioService);
    const analysisService = new AnalysisService(backtestService);

    // Delete backtest
    const deleted = await analysisService.deleteBacktest(backtestId);

    if (!deleted) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: `Backtest ${backtestId} not found`,
      });
    }

    return res.status(204).end();
  } catch (error: any) {
    console.error('Delete backtest error:', error);

    return res.status(500).json({
      code: 'DELETE_FAILED',
      message: error.message || 'Failed to delete backtest results',
    });
  }
}

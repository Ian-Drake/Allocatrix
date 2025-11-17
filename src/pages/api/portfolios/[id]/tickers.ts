/**
 * POST /api/portfolios/[id]/tickers
 * 
 * Manages tickers within asset classes (add, remove, update)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService, ModelPortfolio } from '@/backend/services/portfolio.service';

interface TickerRequest {
  action: 'add' | 'remove' | 'update';
  assetClassName: string;
  symbol: string;
  weight?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ModelPortfolio>>
) {
  const { id } = req.query as { id: string };

  if (!id) {
    return res.status(400).json({ success: false, error: 'Portfolio ID is required' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { action, assetClassName, symbol, weight } = req.body as TickerRequest;

    if (!action || !assetClassName || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'Action, asset class name, and ticker symbol are required',
      });
    }

    let portfolio: ModelPortfolio;

    switch (action) {
      case 'add':
        if (weight === undefined || weight < 0 || weight > 100) {
          return res
            .status(400)
            .json({ success: false, error: 'Weight must be between 0 and 100' });
        }
        portfolio = portfolioService.addTicker(id, assetClassName, {
          symbol,
          targetWeightPctWithinAssetClass: weight,
        });
        break;

      case 'remove':
        portfolio = portfolioService.removeTicker(id, assetClassName, symbol);
        break;

      case 'update':
        if (weight === undefined || weight < 0 || weight > 100) {
          return res
            .status(400)
            .json({ success: false, error: 'Weight must be between 0 and 100' });
        }
        portfolio = portfolioService.updateTickerWeight(id, assetClassName, symbol, weight);
        break;

      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(200).json({ success: true, data: portfolio });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to manage ticker';
    return res.status(500).json({ success: false, error: message });
  }
}

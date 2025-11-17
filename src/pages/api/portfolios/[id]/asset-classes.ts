/**
 * POST /api/portfolios/[id]/asset-classes
 * 
 * Manages asset classes within a portfolio (add, remove, update)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService, ModelPortfolio } from '@/backend/services/portfolio.service';

interface AssetClassRequest {
  action: 'add' | 'remove' | 'update';
  name: string;
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
    const { action, name, weight } = req.body as AssetClassRequest;

    if (!action || !name) {
      return res
        .status(400)
        .json({ success: false, error: 'Action and asset class name are required' });
    }

    let portfolio: ModelPortfolio;

    switch (action) {
      case 'add':
        if (weight === undefined || weight < 0 || weight > 100) {
          return res
            .status(400)
            .json({ success: false, error: 'Weight must be between 0 and 100' });
        }
        portfolio = portfolioService.addAssetClass(id, { name, targetWeightPct: weight });
        break;

      case 'remove':
        portfolio = portfolioService.removeAssetClass(id, name);
        break;

      case 'update':
        if (weight === undefined || weight < 0 || weight > 100) {
          return res
            .status(400)
            .json({ success: false, error: 'Weight must be between 0 and 100' });
        }
        portfolio = portfolioService.updateAssetClassWeight(id, name, weight);
        break;

      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(200).json({ success: true, data: portfolio });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to manage asset class';
    return res.status(500).json({ success: false, error: message });
  }
}

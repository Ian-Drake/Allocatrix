/**
 * GET /api/portfolios/[id]
 * PUT /api/portfolios/[id]
 * DELETE /api/portfolios/[id]
 * 
 * Retrieves, updates, or deletes a portfolio
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService, ModelPortfolio, PortfolioWithAssets } from '@/backend/services/portfolio.service';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ModelPortfolio | PortfolioWithAssets | boolean>>
) {
  const { id } = req.query as { id: string };

  if (!id) {
    return res.status(400).json({ success: false, error: 'Portfolio ID is required' });
  }

  try {
    if (req.method === 'GET') {
      const portfolio = portfolioService.getPortfolioFull(id);
      if (!portfolio) {
        return res.status(404).json({ success: false, error: 'Portfolio not found' });
      }
      return res.status(200).json({ success: true, data: portfolio });
    }

    if (req.method === 'PUT') {
      const { name, description } = req.body;
      const portfolio = portfolioService.updatePortfolio(id, { name, description });
      return res.status(200).json({ success: true, data: portfolio });
    }

    if (req.method === 'DELETE') {
      const deleted = portfolioService.deletePortfolio(id);
      return res.status(200).json({ success: true, data: deleted });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return res.status(500).json({ success: false, error: message });
  }
}

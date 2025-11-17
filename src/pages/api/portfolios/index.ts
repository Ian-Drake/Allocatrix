/**
 * GET /api/portfolios/list
 * 
 * Lists all model portfolios
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService, ModelPortfolio } from '@/backend/services/portfolio.service';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ModelPortfolio[]>>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const portfolios = portfolioService.listPortfolios();
    return res.status(200).json({
      success: true,
      data: portfolios,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list portfolios';
    return res.status(500).json({ success: false, error: message });
  }
}

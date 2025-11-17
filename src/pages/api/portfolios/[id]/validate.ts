/**
 * POST /api/portfolios/[id]/validate
 * 
 * Validates a portfolio and transitions from Draft to Valid state
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService, ModelPortfolio } from '@/backend/services/portfolio.service';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  errors?: string[];
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
    const result = portfolioService.validatePortfolioAndTransition(id);

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors });
    }

    const portfolio = portfolioService.getPortfolioInfo(id);
    return res.status(200).json({ success: true, data: portfolio || undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate portfolio';
    return res.status(500).json({ success: false, error: message });
  }
}

/**
 * POST /api/portfolios/create
 * GET /api/portfolios/list (via index.ts)
 * 
 * Creates a new Draft model portfolio
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { portfolioService, ModelPortfolio } from '@/backend/services/portfolio.service';

interface CreatePortfolioRequest {
  name: string;
  description?: string;
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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { name, description } = req.body as CreatePortfolioRequest;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Portfolio name is required' });
    }

    const portfolioId = uuidv4();
    const portfolio = portfolioService.createPortfolio(portfolioId, name, description);

    return res.status(201).json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create portfolio';
    return res.status(500).json({ success: false, error: message });
  }
}

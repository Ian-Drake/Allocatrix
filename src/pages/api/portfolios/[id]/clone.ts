/**
 * POST /api/portfolios/[id]/clone
 * 
 * Clones a locked portfolio to a new Draft portfolio
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { portfolioService, ModelPortfolio } from '@/backend/services/portfolio.service';

interface ClonePortfolioRequest {
  newName: string;
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
    const { newName } = req.body as ClonePortfolioRequest;

    if (!newName || newName.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'New portfolio name is required' });
    }

    const newId = uuidv4();
    const clonedPortfolio = portfolioService.clonePortfolio(id, newId, newName);

    return res.status(201).json({
      success: true,
      data: clonedPortfolio,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clone portfolio';
    return res.status(500).json({ success: false, error: message });
  }
}

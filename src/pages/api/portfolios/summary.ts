import type { NextApiRequest, NextApiResponse } from 'next';
import { accountService } from '@/backend/services/account.service';

/**
 * GET /api/portfolios/summary
 * Get portfolio-wide summary metrics
 * 
 * Returns:
 * - totalValue: Total value across all accounts
 * - dailyGainLoss: Total daily P&L in dollars
 * - dailyGainLossPercent: Daily P&L as percentage
 * - lastUpdated: ISO timestamp of last calculation
 * 
 * Note: This is MVP implementation with calculated values.
 * Production should aggregate real-time data from Schwab API
 */

interface PortfolioSummary {
  totalValue: number;
  dailyGainLoss: number;
  dailyGainLossPercent: number;
  lastUpdated: string;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PortfolioSummary | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET requests are allowed',
      },
    });
  }

  try {
    // Get all accounts
    const accounts = await accountService.getAllAccounts();
    
    if (accounts.length === 0) {
      // No accounts - return zero values
      return res.status(200).json({
        totalValue: 0,
        dailyGainLoss: 0,
        dailyGainLossPercent: 0,
        lastUpdated: new Date().toISOString(),
      });
    }
    
    // Aggregate values across all accounts
    let totalValue = 0;
    let totalDailyGainLoss = 0;
    
    for (const account of accounts) {
      const details = await accountService.getAccountById(account.id);
      const accountValue = details.totalAccountValue || 0;
      
      totalValue += accountValue;
      
      // Calculate daily P&L for this account
      // In production, this would come from Schwab API comparing to yesterday's close
      // For MVP, using simulated values
      const dailyChange = accountValue * (Math.random() * 0.04 - 0.02); // -2% to +2%
      totalDailyGainLoss += dailyChange;
    }
    
    // Calculate portfolio-wide percentage
    const dailyGainLossPercent = totalValue > 0 
      ? (totalDailyGainLoss / totalValue) * 100 
      : 0;
    
    const summary: PortfolioSummary = {
      totalValue,
      dailyGainLoss: totalDailyGainLoss,
      dailyGainLossPercent,
      lastUpdated: new Date().toISOString(),
    };
    
    return res.status(200).json(summary);
  } catch (error) {
    console.error('Failed to fetch portfolio summary:', error);
    
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to calculate portfolio summary',
      },
    });
  }
}

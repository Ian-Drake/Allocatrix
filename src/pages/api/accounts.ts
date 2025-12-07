import type { NextApiRequest, NextApiResponse } from 'next';
import { accountService } from '@/backend/services/account.service';

/**
 * GET /api/accounts
 * Get all accounts with dashboard metrics
 * 
 * Returns accounts with:
 * - id, name
 * - currentValue, todayGainLoss, todayGainLossPercent
 * - excessCash, correctableDrift, totalDrift
 * - positionCount, cashBalance
 * 
 * Note: This is a simplified implementation for MVP.
 * Production should calculate real-time drift metrics and P&L from Schwab API
 */

interface DashboardAccount {
  id: string;
  name: string;
  currentValue: number;
  todayGainLoss: number;
  todayGainLossPercent: number;
  excessCash: number;
  correctableDrift: number;
  totalDrift: number;
  positionCount: number;
  cashBalance: number;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardAccount[] | ErrorResponse>
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
    // Get all accounts from database
    const accounts = await accountService.getAllAccounts();
    
    // Transform to dashboard format with metrics
    // For MVP, using mock/calculated values since we don't have real-time Schwab data yet
    const dashboardAccounts: DashboardAccount[] = await Promise.all(
      accounts.map(async (account) => {
        // Get account details including positions
        const details = await accountService.getAccountById(account.id);
        
        // Calculate metrics
        // Note: These are simplified calculations for MVP
        // Production should use real-time data from Schwab API
        const currentValue = details.totalAccountValue || 0;
        const cashBalance = details.availableCash || 0;
        const positionCount = details.positions.length;
        
        // Mock daily P&L (in production, compare to yesterday's closing value)
        const todayGainLoss = currentValue * (Math.random() * 0.04 - 0.02); // -2% to +2%
        const todayGainLossPercent = currentValue > 0 ? (todayGainLoss / currentValue) * 100 : 0;
        
        // Calculate drift metrics (simplified)
        // In production, compare current allocations to model portfolio targets
        let totalDrift = 0;
        let correctableDrift = 0;
        let excessCash = 0;
        
        if (details.assignedModelPortfolioId && details.positions.length > 0) {
          // Calculate drift from model (simplified - would use drift-calculator.service in production)
          totalDrift = Math.random() * 15; // 0-15% total drift
          correctableDrift = totalDrift * 0.6; // Assume 60% can be corrected
          
          // Excess cash is cash beyond what's needed for rebalancing
          const minCashNeeded = currentValue * 0.01; // Keep 1% as minimum
          excessCash = Math.max(0, cashBalance - minCashNeeded);
        } else {
          // No model assigned, all cash is excess
          excessCash = cashBalance;
        }
        
        return {
          id: account.id,
          name: account.nickname || `Account ${account.id.slice(0, 8)}`,
          currentValue,
          todayGainLoss,
          todayGainLossPercent,
          excessCash,
          correctableDrift,
          totalDrift,
          positionCount,
          cashBalance,
        };
      })
    );
    
    return res.status(200).json(dashboardAccounts);
  } catch (error) {
    console.error('Failed to fetch dashboard accounts:', error);
    
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve account dashboard data',
      },
    });
  }
}

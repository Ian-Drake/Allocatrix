import type { NextApiRequest, NextApiResponse } from 'next';
import { accountService } from '@/backend/services/account.service';

/**
 * GET /api/portfolios/history?period=30
 * Get historical portfolio value data points for charting
 * 
 * Query params:
 * - period: "30", "60", "90", "180", or "ttm" (trailing twelve months)
 * 
 * Returns array of {date: ISO string, value: number} points
 * 
 * Note: This is MVP implementation with generated historical data.
 * Production should query actual historical snapshots or calculate from Schwab API
 */

interface ChartDataPoint {
  date: string; // ISO 8601 date
  value: number;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Generate historical data points for a given period
 * In production, this would query the database for historical snapshots
 */
function generateHistoricalData(
  currentValue: number,
  periodDays: number
): ChartDataPoint[] {
  const dataPoints: ChartDataPoint[] = [];
  const now = new Date();
  
  // Generate one data point per day
  for (let i = periodDays; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(16, 0, 0, 0); // Market close time
    
    // Simulate realistic market movement
    // Start from slightly lower value and trend upward with volatility
    const dayProgress = (periodDays - i) / periodDays;
    const trend = currentValue * 0.9 + (currentValue * 0.1 * dayProgress);
    const volatility = currentValue * 0.02 * (Math.random() - 0.5);
    const value = Math.max(0, trend + volatility);
    
    dataPoints.push({
      date: date.toISOString(),
      value: Math.round(value * 100) / 100, // Round to 2 decimals
    });
  }
  
  return dataPoints;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChartDataPoint[] | ErrorResponse>
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
    const { period } = req.query;
    
    // Validate period parameter
    const validPeriods = ['30', '60', '90', '180', 'ttm'];
    if (!period || typeof period !== 'string' || !validPeriods.includes(period)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PERIOD',
          message: 'Period must be one of: 30, 60, 90, 180, ttm',
        },
      });
    }
    
    // Convert period to days
    const periodDays = period === 'ttm' ? 365 : parseInt(period, 10);
    
    // Get current total portfolio value
    const accounts = await accountService.getAllAccounts();
    let currentTotalValue = 0;
    
    for (const account of accounts) {
      const details = await accountService.getAccountById(account.id);
      currentTotalValue += details.totalAccountValue || 0;
    }
    
    // Generate historical data points
    // In production, this would query account_snapshot table or similar
    const historyData = generateHistoricalData(currentTotalValue, periodDays);
    
    return res.status(200).json(historyData);
  } catch (error) {
    console.error('Failed to fetch portfolio history:', error);
    
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve portfolio history',
      },
    });
  }
}

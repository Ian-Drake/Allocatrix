import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * GET /api/market-hours
 * Check if US equity markets are currently open
 * 
 * Returns:
 * - isOpen: boolean indicating if markets are open
 * 
 * Used by dashboard to show warnings for liquidation during closed markets
 */

interface MarketHoursResponse {
  isOpen: boolean;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Determine if US markets are currently open
 * 
 * Market hours (Eastern Time):
 * - Regular trading: Mon-Fri 9:30 AM - 4:00 PM ET
 * - Closed on weekends and market holidays
 * 
 * Note: This is a simplified implementation.
 * Production should integrate with Schwab market hours API or holiday calendar.
 */
function isMarketCurrentlyOpen(): boolean {
  const now = new Date();
  
  // Convert to Eastern Time (UTC-5 or UTC-4 depending on DST)
  const etOffset = -5; // Simplified: doesn't account for DST
  const utcHours = now.getUTCHours();
  const etHours = (utcHours + etOffset + 24) % 24;
  const etMinutes = now.getUTCMinutes();
  
  // Check if weekend (0 = Sunday, 6 = Saturday)
  const dayOfWeek = now.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Convert current time to minutes since midnight ET
  const currentMinutes = etHours * 60 + etMinutes;
  
  // Market open: 9:30 AM = 570 minutes
  // Market close: 4:00 PM = 960 minutes
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM
  
  return currentMinutes >= marketOpen && currentMinutes < marketClose;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarketHoursResponse | ErrorResponse>
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
    const isOpen = isMarketCurrentlyOpen();
    
    return res.status(200).json({ isOpen });
  } catch (error) {
    console.error('Market hours check failed:', error);
    
    // On error, assume market is closed for safety
    return res.status(500).json({
      error: {
        code: 'MARKET_HOURS_ERROR',
        message: 'Unable to determine market status; assuming closed for safety',
      },
    });
  }
}

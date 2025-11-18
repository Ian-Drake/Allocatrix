/**
 * Chart Data Transform Utility
 * 
 * Transforms backend API responses into Recharts-compatible data format
 */

import type { ChartDataPoint, Timeframe } from '../types/portfolio-dashboard.types';

/**
 * Transform raw API data into Recharts format
 * 
 * @param rawData - Raw data points from API
 * @param timeframe - Selected timeframe (used for context, not transformation)
 * @returns Array of chart data points in Recharts format
 */
export function transformChartData(
  rawData: Array<{ date: string; value: number }>,
  timeframe: Timeframe
): ChartDataPoint[] {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }

  return rawData.map((point) => ({
    date: point.date,
    value: point.value,
  }));
}

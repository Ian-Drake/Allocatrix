'use client';

/**
 * PortfolioSummary Component
 * 
 * Displays portfolio high-level metrics:
 * - Total portfolio value (large, prominent)
 * - Daily gain/loss with percentage and color coding (green/red)
 * - Last refreshed timestamp
 * - Refresh button for manual data refresh
 */

import React, { useState } from 'react';
import type { PortfolioSummaryProps } from '../../types/portfolio-dashboard.types';
import { formatCurrency } from '../../utils/format-currency';
import { formatPercentage } from '../../utils/format-percentage';

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  summary,
  isLoading,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading && !summary) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="space-y-4">
          <div className="h-12 bg-gray-200 rounded animate-pulse w-1/3"></div>
          <div className="h-6 bg-gray-200 rounded animate-pulse w-1/4"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <p className="text-gray-600">Unable to load portfolio summary</p>
      </div>
    );
  }

  const isGain = summary.dailyGainLoss >= 0;
  const gainLossColor = isGain ? 'text-green-600' : 'text-red-600';
  const gainLossBgColor = isGain ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-300">
      <div className="p-4 md:p-6 lg:p-8">
        {/* Header with Title and Refresh Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <div className="flex-1 min-w-0">
            <p className="text-gray-600 text-xs md:text-sm font-medium mb-2">Total Portfolio Value</p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 break-words">
              {formatCurrency(summary.totalValue)}
            </h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto px-3 md:px-4 py-2 bg-blue-600 text-white text-sm md:text-base rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
            title="Refresh portfolio data"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Daily Gain/Loss Card */}
        <div className={`${gainLossBgColor} rounded-lg p-4 md:p-6 transition-all duration-300 animate-fadeIn`}>
          <p className="text-gray-600 text-xs md:text-sm font-medium mb-2">Today&apos;s Gain/Loss</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-2 md:gap-4">
            <span className={`text-2xl md:text-3xl lg:text-4xl font-bold ${gainLossColor} transition-colors duration-300`}>
              {isGain ? '+' : ''}{formatCurrency(summary.dailyGainLoss)}
            </span>
            <span className={`text-lg md:text-xl lg:text-2xl font-semibold ${gainLossColor} transition-colors duration-300`}>
              ({formatPercentage(summary.dailyGainLossPercent)})
            </span>
          </div>
        </div>

        {/* Last Updated Timestamp */}
        <div className="mt-4 md:mt-6 text-right">
          <p className="text-xs text-gray-500">
            Last refreshed: {new Date(summary.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

PortfolioSummary.displayName = 'PortfolioSummary';

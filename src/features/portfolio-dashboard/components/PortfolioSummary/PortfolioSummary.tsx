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
    <div className="bg-white rounded-lg shadow">
      <div className="p-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-2">Total Portfolio Value</p>
            <h1 className="text-4xl font-bold text-gray-900">
              {formatCurrency(summary.totalValue)}
            </h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            title="Refresh portfolio data"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className={`${gainLossBgColor} rounded-lg p-6`}>
          <p className="text-gray-600 text-sm font-medium mb-2">Today&apos;s Gain/Loss</p>
          <div className="flex items-baseline gap-4">
            <span className={`text-2xl font-bold ${gainLossColor}`}>
              {isGain ? '+' : ''}{formatCurrency(summary.dailyGainLoss)}
            </span>
            <span className={`text-lg font-semibold ${gainLossColor}`}>
              {formatPercentage(summary.dailyGainLossPercent)}
            </span>
          </div>
        </div>

        <div className="mt-6 text-right">
          <p className="text-xs text-gray-500">
            Last refreshed: {new Date(summary.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

PortfolioSummary.displayName = 'PortfolioSummary';

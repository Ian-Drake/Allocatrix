'use client';

/**
 * DashboardPage Component
 * 
 * Main dashboard page that combines:
 * - Portfolio Summary (total value, daily P&L, refresh button)
 * - Performance Chart (with timeframe selector)
 * - Responsive layout with loading and error states
 */

import React from 'react';
import { PortfolioSummary } from '../components/PortfolioSummary/PortfolioSummary';
import { PerformanceChart } from '../components/PerformanceChart/PerformanceChart';
import { usePortfolioData } from '../hooks/usePortfolioData';

export const DashboardPage: React.FC = () => {
  const {
    summary,
    chartData,
    timeframe,
    isLoading,
    error,
    setTimeframe,
    refresh,
  } = usePortfolioData();

  if (error && !summary) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <h1 className="text-2xl font-bold text-red-900 mb-2">
              Error Loading Dashboard
            </h1>
            <p className="text-red-700 mb-6">{error}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Monitor your portfolio performance and account metrics
          </p>
        </div>

        {/* Portfolio Summary */}
        <PortfolioSummary
          summary={summary}
          isLoading={isLoading}
          onRefresh={refresh}
        />

        {/* Performance Chart */}
        <PerformanceChart
          data={chartData}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          isLoading={isLoading}
        />

        {/* Info Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>
            Dashboard data is refreshed on demand. Click the &apos;Refresh&apos; button to
            get the latest metrics.
          </p>
        </div>
      </div>
    </div>
  );
};

DashboardPage.displayName = 'DashboardPage';

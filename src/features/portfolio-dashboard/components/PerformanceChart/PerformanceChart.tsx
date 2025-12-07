'use client';

/**
 * PerformanceChart Component
 * 
 * Displays interactive performance chart with:
 * - Recharts LineChart for portfolio value over time
 * - Timeframe selector buttons (30/60/90/180/TTM)
 * - Responsive container for different screen sizes
 * - Smooth animations on data/timeframe changes
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  PerformanceChartProps,
  Timeframe,
} from '../../types/portfolio-dashboard.types';
import { formatCurrency } from '../../utils/format-currency';

const TIMEFRAME_OPTIONS: Array<{ label: string; value: Timeframe }> = [
  { label: '30D', value: '30d' },
  { label: '60D', value: '60d' },
  { label: '90D', value: '90d' },
  { label: '180D', value: '180d' },
  { label: 'TTM', value: 'ttm' },
];

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  timeframe,
  onTimeframeChange,
  isLoading,
}) => {
  if (isLoading && (!data || data.length === 0)) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="h-80 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <p className="text-gray-600 text-center">No chart data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-300">
      <div className="p-4 md:p-6 lg:p-8">
        {/* Header with Title and Timeframe Selector */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">
            Performance Trend
          </h2>
          <div className="flex gap-1 md:gap-2 flex-wrap">
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onTimeframeChange(option.value)}
                disabled={isLoading}
                className={`px-2 md:px-3 py-1 md:py-2 rounded text-xs md:text-sm font-medium transition-all duration-200 ${
                  timeframe === option.value
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Chart Container */}
        <div className="w-full overflow-x-auto -mx-4 md:mx-0 md:overflow-x-visible">
          <div className="min-h-64 md:min-h-80 lg:h-96 w-full md:w-auto px-4 md:px-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  interval={Math.floor(data.length / 6)}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: number) => formatCurrency(value, 0)}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Value']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                  }}
                  labelFormatter={(label: string) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Data Point Info */}
        <div className="mt-4 md:mt-6 text-center text-xs md:text-sm text-gray-600">
          <p>
            Showing {data.length} data point{data.length !== 1 ? 's' : ''} for {timeframe}
          </p>
        </div>
      </div>
    </div>
  );
};

PerformanceChart.displayName = 'PerformanceChart';

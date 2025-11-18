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
    <div className="bg-white rounded-lg shadow">
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Performance Trend
          </h2>
          <div className="flex gap-2">
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onTimeframeChange(option.value)}
                disabled={isLoading}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  timeframe === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
                interval={Math.floor(data.length / 6)}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
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

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Showing {data.length} data point{data.length !== 1 ? 's' : ''} for {timeframe}
          </p>
        </div>
      </div>
    </div>
  );
};

PerformanceChart.displayName = 'PerformanceChart';

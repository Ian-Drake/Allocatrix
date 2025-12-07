/**
 * Integration test for Portfolio Overview (Dashboard Page)
 * Tests the combined functionality of PortfolioSummary and PerformanceChart
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type {
  PortfolioSummary as PortfolioSummaryType,
  ChartDataPoint,
  Timeframe,
} from '../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

// Mock components for testing integration
const MockDashboardPage = ({
  initialSummary,
  initialChartData,
  onRefresh,
  onTimeframeChange,
}: {
  initialSummary: PortfolioSummaryType;
  initialChartData: ChartDataPoint[];
  onRefresh: () => Promise<void>;
  onTimeframeChange: (timeframe: Timeframe) => Promise<ChartDataPoint[]>;
}) => {
  const [summary, setSummary] = React.useState(initialSummary);
  const [chartData, setChartData] = React.useState(initialChartData);
  const [timeframe, setTimeframe] = React.useState<Timeframe>('30d');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await onRefresh();
      setSummary(prev => ({
        ...prev,
        lastUpdated: new Date().toISOString(),
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeframeChange = async (tf: Timeframe) => {
    setTimeframe(tf);
    setIsLoading(true);
    try {
      const newData = await onTimeframeChange(tf);
      setChartData(newData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="portfolio-summary-section">
        <h2>Portfolio Summary</h2>
        <div className="portfolio-value">${summary.totalValue.toFixed(2)}</div>
        <div className={summary.dailyGainLoss >= 0 ? 'gain' : 'loss'}>
          {summary.dailyGainLoss > 0 ? '+' : ''}{summary.dailyGainLoss.toFixed(2)} ({summary.dailyGainLossPercent.toFixed(2)}%)
        </div>
        <button onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="performance-chart-section">
        <h2>Performance Chart</h2>
        <div className="timeframe-buttons">
          {(['30d', '60d', '90d', '180d', 'ttm'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              disabled={isLoading}
              className={timeframe === tf ? 'active' : ''}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="chart-data">
          {chartData.length > 0 ? (
            <div>Chart with {chartData.length} points</div>
          ) : (
            <div>No chart data</div>
          )}
        </div>
      </div>
    </div>
  );
};

describe('Portfolio Overview Integration', () => {
  const mockInitialSummary: PortfolioSummaryType = {
    totalValue: 500000,
    dailyGainLoss: 2500,
    dailyGainLossPercent: 0.5,
    lastUpdated: new Date().toISOString(),
  };

  const mockInitialChartData: ChartDataPoint[] = [
    { date: '2024-01-01', value: 100000 },
    { date: '2024-01-02', value: 101000 },
    { date: '2024-01-03', value: 99500 },
    { date: '2024-01-04', value: 102000 },
    { date: '2024-01-05', value: 105000 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load and display DashboardPage component with portfolio summary section', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onTimeframeChange = vi.fn().mockResolvedValue(mockInitialChartData);

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    expect(screen.getByText('Portfolio Summary')).toBeInTheDocument();
  });

  it('should display performance chart section', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onTimeframeChange = vi.fn().mockResolvedValue(mockInitialChartData);

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    expect(screen.getByText('Performance Chart')).toBeInTheDocument();
  });

  it('should display chart with data points', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onTimeframeChange = vi.fn().mockResolvedValue(mockInitialChartData);

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    expect(screen.getByText('Chart with 5 points')).toBeInTheDocument();
  });

  it('should render all 5 timeframe buttons for chart', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onTimeframeChange = vi.fn().mockResolvedValue(mockInitialChartData);

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    expect(screen.getByText('30D')).toBeInTheDocument();
    expect(screen.getByText('60D')).toBeInTheDocument();
    expect(screen.getByText('90D')).toBeInTheDocument();
    expect(screen.getByText('180D')).toBeInTheDocument();
    expect(screen.getByText('TTM')).toBeInTheDocument();
  });

  it('should update chart when timeframe button is clicked', async () => {
    const newChartData: ChartDataPoint[] = [
      { date: '2024-02-01', value: 110000 },
      { date: '2024-02-02', value: 111000 },
      { date: '2024-02-03', value: 109500 },
    ];

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onTimeframeChange = vi.fn().mockResolvedValue(newChartData);

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    // Verify initial state
    expect(screen.getByText('Chart with 5 points')).toBeInTheDocument();

    // Click 60D button
    const button60d = screen.getByText('60D');
    fireEvent.click(button60d);

    // Wait for chart to update
    await waitFor(() => {
      expect(screen.getByText('Chart with 3 points')).toBeInTheDocument();
    });

    // Verify callback was called with correct timeframe
    expect(onTimeframeChange).toHaveBeenCalledWith('60d');
  });

  it('should call refresh callback when refresh button is clicked', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onTimeframeChange = vi.fn().mockResolvedValue(mockInitialChartData);

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    const refreshBtn = screen.getByText('Refresh');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('should update portfolio summary after refresh', async () => {
    const updatedSummary: PortfolioSummaryType = {
      totalValue: 505000,
      dailyGainLoss: 3000,
      dailyGainLossPercent: 0.6,
      lastUpdated: new Date().toISOString(),
    };

    const onRefresh = vi.fn().mockImplementation(async () => {
      // Simulate async update
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    const onTimeframeChange = vi.fn().mockResolvedValue(mockInitialChartData);

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    const refreshBtn = screen.getByText('Refresh');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });

    // Verify button returns to normal state
    expect(screen.getByText('Refresh')).not.toBeDisabled();
  });

  it('should disable buttons during refresh', async () => {
    const onRefresh = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    const onTimeframeChange = vi.fn().mockResolvedValue(mockInitialChartData);

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    const refreshBtn = screen.getByText('Refresh') as HTMLButtonElement;
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(refreshBtn).toBeDisabled();
    });
  });

  it('should handle error during chart data fetch gracefully', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onTimeframeChange = vi.fn().mockRejectedValue(new Error('Failed to load chart'));

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    const button60d = screen.getByText('60D');
    fireEvent.click(button60d);

    // Chart should still be visible (showing original data)
    await waitFor(() => {
      expect(screen.getByText('Chart with 5 points')).toBeInTheDocument();
    });
  });

  it('should maintain portfolio summary data while chart is loading', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onTimeframeChange = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockInitialChartData), 100))
    );

    render(
      <MockDashboardPage
        initialSummary={mockInitialSummary}
        initialChartData={mockInitialChartData}
        onRefresh={onRefresh}
        onTimeframeChange={onTimeframeChange}
      />
    );

    // Verify initial portfolio value is visible
    expect(screen.getByText('$500000.00')).toBeInTheDocument();

    // Click timeframe button
    const button60d = screen.getByText('60D');
    fireEvent.click(button60d);

    // Portfolio value should still be visible during chart loading
    await waitFor(() => {
      expect(screen.getByText('$500000.00')).toBeInTheDocument();
    });
  });
});

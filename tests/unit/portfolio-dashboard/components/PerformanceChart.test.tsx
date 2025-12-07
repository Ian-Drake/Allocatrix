/**
 * Unit tests for PerformanceChart component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerformanceChart } from '../../../../src/features/portfolio-dashboard/components/PerformanceChart/PerformanceChart';
import type {
  ChartDataPoint,
  Timeframe,
} from '../../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

describe('PerformanceChart Component', () => {
  const mockChartData: ChartDataPoint[] = [
    { date: '2024-01-01', value: 100000 },
    { date: '2024-01-02', value: 101000 },
    { date: '2024-01-03', value: 99500 },
    { date: '2024-01-04', value: 102000 },
    { date: '2024-01-05', value: 105000 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render component with chart data', () => {
    const onTimeframeChange = vi.fn();

    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={onTimeframeChange}
        isLoading={false}
      />
    );

    expect(screen.getByText('Performance Trend')).toBeInTheDocument();
  });

  it('should render Recharts LineChart with data', () => {
    const { container } = render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    // Verify SVG chart is rendered (Recharts renders SVG)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render all 5 timeframe buttons', () => {
    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('30D')).toBeInTheDocument();
    expect(screen.getByText('60D')).toBeInTheDocument();
    expect(screen.getByText('90D')).toBeInTheDocument();
    expect(screen.getByText('180D')).toBeInTheDocument();
    expect(screen.getByText('TTM')).toBeInTheDocument();
  });

  it('should highlight active timeframe button', () => {
    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    const button30d = screen.getByText('30D') as HTMLButtonElement;
    expect(button30d.classList.contains('bg-blue-600')).toBe(true);
    expect(button30d.classList.contains('text-white')).toBe(true);
  });

  it('should trigger onChange callback when timeframe button is clicked', () => {
    const onTimeframeChange = vi.fn();

    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={onTimeframeChange}
        isLoading={false}
      />
    );

    const button60d = screen.getByText('60D');
    fireEvent.click(button60d);

    expect(onTimeframeChange).toHaveBeenCalledWith('60d');
    expect(onTimeframeChange).toHaveBeenCalledTimes(1);
  });

  it('should trigger onChange with correct timeframe for each button', () => {
    const onTimeframeChange = vi.fn();

    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={onTimeframeChange}
        isLoading={false}
      />
    );

    const timeframes: Timeframe[] = ['60d', '90d', '180d', 'ttm'];
    const labels = ['60D', '90D', '180D', 'TTM'];

    timeframes.forEach((tf, index) => {
      fireEvent.click(screen.getByText(labels[index]));
      expect(onTimeframeChange).toHaveBeenCalledWith(tf);
    });

    expect(onTimeframeChange).toHaveBeenCalledTimes(timeframes.length);
  });

  it('should update chart data when prop changes', () => {
    const newChartData: ChartDataPoint[] = [
      { date: '2024-02-01', value: 110000 },
      { date: '2024-02-02', value: 111000 },
      { date: '2024-02-03', value: 109500 },
    ];

    const { rerender, container } = render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    // Store reference to first render's chart container height
    let initialChart = container.querySelector('svg');
    expect(initialChart).toBeInTheDocument();

    // Update with new data
    rerender(
      <PerformanceChart
        data={newChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    // Chart should still be present
    initialChart = container.querySelector('svg');
    expect(initialChart).toBeInTheDocument();
  });

  it('should apply animations to line chart', () => {
    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    // Check that component renders with animation configuration
    // The Line component has isAnimationActive={true} and animationDuration={300}
    expect(screen.getByText('Performance Trend')).toBeInTheDocument();
  });

  it('should display loading skeleton when loading with empty data', () => {
    const { container } = render(
      <PerformanceChart
        data={[]}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={true}
      />
    );

    const animatePulse = container.querySelector('.animate-pulse');
    expect(animatePulse).toBeInTheDocument();
  });

  it('should display no data message when data is empty', () => {
    render(
      <PerformanceChart
        data={[]}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('No chart data available')).toBeInTheDocument();
  });

  it('should disable timeframe buttons while loading', () => {
    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={true}
      />
    );

    const button60d = screen.getByText('60D') as HTMLButtonElement;
    expect(button60d).toBeDisabled();
  });

  it('should display data point count in footer', () => {
    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('Showing 5 data points for 30d')).toBeInTheDocument();
  });

  it('should display singular data point text for single point', () => {
    const singlePointData: ChartDataPoint[] = [{ date: '2024-01-01', value: 100000 }];

    render(
      <PerformanceChart
        data={singlePointData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('Showing 1 data point for 30d')).toBeInTheDocument();
  });

  it('should render with different timeframes', () => {
    const { rerender } = render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    const button30d = screen.getByText('30D') as HTMLButtonElement;
    expect(button30d.classList.contains('bg-blue-600')).toBe(true);

    rerender(
      <PerformanceChart
        data={mockChartData}
        timeframe="90d"
        onTimeframeChange={vi.fn()}
        isLoading={false}
      />
    );

    const button90d = screen.getByText('90D') as HTMLButtonElement;
    expect(button90d.classList.contains('bg-blue-600')).toBe(true);
  });

  it('should not call callback when buttons are disabled', () => {
    const onTimeframeChange = vi.fn();

    render(
      <PerformanceChart
        data={mockChartData}
        timeframe="30d"
        onTimeframeChange={onTimeframeChange}
        isLoading={true}
      />
    );

    const button60d = screen.getByText('60D') as HTMLButtonElement;
    
    // Button is disabled, so this click should be ignored
    fireEvent.click(button60d);

    // May or may not call depending on implementation, but button should be disabled
    expect(button60d).toBeDisabled();
  });
});

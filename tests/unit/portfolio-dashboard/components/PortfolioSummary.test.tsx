/**
 * Unit tests for PortfolioSummary component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PortfolioSummary } from '../../../../src/features/portfolio-dashboard/components/PortfolioSummary/PortfolioSummary';
import type { PortfolioSummary as PortfolioSummaryType } from '../../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

describe('PortfolioSummary Component', () => {
  const mockSummary: PortfolioSummaryType = {
    totalValue: 500000,
    dailyGainLoss: 2500,
    dailyGainLossPercent: 0.5,
    lastUpdated: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render component with all required props', () => {
    const onRefresh = vi.fn();
    
    render(
      <PortfolioSummary
        summary={mockSummary}
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText("Today's Gain/Loss")).toBeInTheDocument();
  });

  it('should display total value formatted as currency', () => {
    render(
      <PortfolioSummary
        summary={mockSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    // Check for currency formatting with dollar sign
    expect(screen.getByText('$500,000.00')).toBeInTheDocument();
  });

  it('should display daily gain as positive amount and percentage', () => {
    const gainSummary: PortfolioSummaryType = {
      totalValue: 100000,
      dailyGainLoss: 1500,
      dailyGainLossPercent: 1.5,
      lastUpdated: new Date().toISOString(),
    };

    render(
      <PortfolioSummary
        summary={gainSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('+$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('+1.50%')).toBeInTheDocument();
  });

  it('should display daily loss as negative amount and percentage', () => {
    const lossSummary: PortfolioSummaryType = {
      totalValue: 100000,
      dailyGainLoss: -1000,
      dailyGainLossPercent: -1.0,
      lastUpdated: new Date().toISOString(),
    };

    render(
      <PortfolioSummary
        summary={lossSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('-$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('-1.00%')).toBeInTheDocument();
  });

  it('should apply green color coding for positive gains', () => {
    const gainSummary: PortfolioSummaryType = {
      totalValue: 100000,
      dailyGainLoss: 500,
      dailyGainLossPercent: 0.5,
      lastUpdated: new Date().toISOString(),
    };

    const { container } = render(
      <PortfolioSummary
        summary={gainSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    const gainLossSection = container.querySelector('.bg-green-50');
    expect(gainLossSection).toBeInTheDocument();
    
    const gainText = container.querySelectorAll('.text-green-600');
    expect(gainText.length).toBeGreaterThan(0);
  });

  it('should apply red color coding for negative losses', () => {
    const lossSummary: PortfolioSummaryType = {
      totalValue: 100000,
      dailyGainLoss: -500,
      dailyGainLossPercent: -0.5,
      lastUpdated: new Date().toISOString(),
    };

    const { container } = render(
      <PortfolioSummary
        summary={lossSummary}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    const gainLossSection = container.querySelector('.bg-red-50');
    expect(gainLossSection).toBeInTheDocument();
    
    const lossText = container.querySelectorAll('.text-red-600');
    expect(lossText.length).toBeGreaterThan(0);
  });

  it('should display last refreshed timestamp', () => {
    const now = new Date();
    const summaryWithTime: PortfolioSummaryType = {
      totalValue: 100000,
      dailyGainLoss: 0,
      dailyGainLossPercent: 0,
      lastUpdated: now.toISOString(),
    };

    render(
      <PortfolioSummary
        summary={summaryWithTime}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/Last refreshed:/)).toBeInTheDocument();
  });

  it('should render refresh button', () => {
    const onRefresh = vi.fn();
    
    render(
      <PortfolioSummary
        summary={mockSummary}
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    const refreshBtn = screen.getByText('Refresh');
    expect(refreshBtn).toBeInTheDocument();
    expect(refreshBtn).not.toBeDisabled();
  });

  it('should trigger onRefresh callback when refresh button is clicked', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    
    render(
      <PortfolioSummary
        summary={mockSummary}
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    const refreshBtn = screen.getByText('Refresh');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('should show refreshing state while refresh is in progress', async () => {
    const onRefresh = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(
      <PortfolioSummary
        summary={mockSummary}
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    const refreshBtn = screen.getByText('Refresh');
    fireEvent.click(refreshBtn);

    // Button text should change to indicate refreshing
    await waitFor(() => {
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });
  });

  it('should display loading skeleton when loading with no summary', () => {
    const { container } = render(
      <PortfolioSummary
        summary={null}
        isLoading={true}
        onRefresh={vi.fn()}
      />
    );

    const animatePulse = container.querySelector('.animate-pulse');
    expect(animatePulse).toBeInTheDocument();
  });

  it('should display error message when summary is null and not loading', () => {
    render(
      <PortfolioSummary
        summary={null}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('Unable to load portfolio summary')).toBeInTheDocument();
  });

  it('should disable refresh button while refreshing', async () => {
    const onRefresh = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(
      <PortfolioSummary
        summary={mockSummary}
        isLoading={false}
        onRefresh={onRefresh}
      />
    );

    const refreshBtn = screen.getByText('Refresh') as HTMLButtonElement;
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(refreshBtn).toBeDisabled();
    });
  });
});

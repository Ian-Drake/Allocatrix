/**
 * Integration test for Account Grid functionality
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AccountGrid } from '../../../src/features/portfolio-dashboard/components/AccountGrid/AccountGrid';
import * as portfolioService from '../../../src/features/portfolio-dashboard/services/portfolio-dashboard.service';
import type { Account } from '../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

vi.mock('../../../src/features/portfolio-dashboard/services/portfolio-dashboard.service');

describe('Account Grid Integration', () => {
  const createMockAccounts = (count: number): Account[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `acc-${i + 1}`,
      name: `Account ${i + 1}`,
      currentValue: 100000 + i * 10000,
      todayGainLoss: (i % 2 === 0 ? 1 : -1) * (500 + i * 100),
      todayGainLossPercent: (i % 2 === 0 ? 1 : -1) * (0.5 + i * 0.1),
      excessCash: 100 + i * 50,
      correctableDrift: 0.1 + i * 0.05,
      totalDrift: 0.5 + i * 0.1,
      positionCount: 5 + i,
      cashBalance: 1000 + i * 200,
    }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and display account grid', async () => {
    const mockAccounts = createMockAccounts(5);
    vi.spyOn(portfolioService, 'fetchAccounts').mockResolvedValue(mockAccounts);

    const onSelectionChange = vi.fn();
    
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={onSelectionChange}
      />
    );

    // Verify all 6 columns display
    expect(screen.getByText('Account Name')).toBeInTheDocument();
    expect(screen.getByText('Current Value')).toBeInTheDocument();
    expect(screen.getByText("Today's Gain/Loss")).toBeInTheDocument();
    expect(screen.getByText('Excess Cash')).toBeInTheDocument();
    expect(screen.getByText('Correctable Drift')).toBeInTheDocument();
    expect(screen.getByText('Total Drift')).toBeInTheDocument();

    // Verify accounts are displayed
    mockAccounts.forEach(account => {
      expect(screen.getByText(account.name)).toBeInTheDocument();
    });
  });

  it('should format currency values correctly', () => {
    const mockAccounts = createMockAccounts(2);
    
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    // Check that currency formatting includes dollar sign and commas
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$110,000/)).toBeInTheDocument();
  });

  it('should color-code gains and losses', () => {
    const mockAccounts: Account[] = [
      {
        id: 'acc-1',
        name: 'Gain Account',
        currentValue: 100000,
        todayGainLoss: 1500,
        todayGainLossPercent: 1.5,
        excessCash: 500,
        correctableDrift: 0.5,
        totalDrift: 1.2,
        positionCount: 10,
        cashBalance: 2000,
      },
      {
        id: 'acc-2',
        name: 'Loss Account',
        currentValue: 50000,
        todayGainLoss: -500,
        todayGainLossPercent: -1.0,
        excessCash: 0,
        correctableDrift: 0.2,
        totalDrift: 0.8,
        positionCount: 5,
        cashBalance: 1000,
      },
    ];

    const { container } = render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    // Verify color classes are applied
    const greenElements = container.querySelectorAll('.text-green-600');
    const redElements = container.querySelectorAll('.text-red-600');

    expect(greenElements.length).toBeGreaterThan(0);
    expect(redElements.length).toBeGreaterThan(0);
  });

  it('should handle 50+ accounts without performance degradation', async () => {
    const mockAccounts = createMockAccounts(50);
    const startTime = performance.now();

    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    const renderTime = performance.now() - startTime;

    // Render should complete in reasonable time (less than 1 second)
    expect(renderTime).toBeLessThan(1000);

    // Verify virtual scrolling is used
    // With 50+ accounts, we should see virtual scrolling container
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeLessThan(mockAccounts.length + 1);
    });
  });

  it('should display percentage values for drift', () => {
    const mockAccounts = createMockAccounts(2);
    
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    // Check for percentage formatting
    expect(screen.getByText(/0\.10%/)).toBeInTheDocument(); // Correctable drift
    expect(screen.getByText(/0\.50%/)).toBeInTheDocument(); // Total drift
  });

  it('should handle empty account list gracefully', () => {
    render(
      <AccountGrid
        accounts={[]}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    expect(screen.getByText('No accounts found')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(
      <AccountGrid
        accounts={[]}
        selectedAccountIds={[]}
        isLoading={true}
        onSelectionChange={vi.fn()}
      />
    );

    expect(screen.getByText('Loading accounts...')).toBeInTheDocument();
  });
});

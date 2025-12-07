/**
 * Unit tests for AccountGrid component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountGrid } from '../../../../src/features/portfolio-dashboard/components/AccountGrid/AccountGrid';
import type { Account } from '../../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

describe('AccountGrid', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Growth Account',
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
      name: 'Conservative Account',
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

  it('should render loading state', () => {
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

  it('should render empty state when no accounts', () => {
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

  it('should render account grid with all columns', () => {
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    // Check column headers
    expect(screen.getByText('Account Name')).toBeInTheDocument();
    expect(screen.getByText('Current Value')).toBeInTheDocument();
    expect(screen.getByText("Today's Gain/Loss")).toBeInTheDocument();
    expect(screen.getByText('Excess Cash')).toBeInTheDocument();
    expect(screen.getByText('Correctable Drift')).toBeInTheDocument();
    expect(screen.getByText('Total Drift')).toBeInTheDocument();

    // Check account names
    expect(screen.getByText('Growth Account')).toBeInTheDocument();
    expect(screen.getByText('Conservative Account')).toBeInTheDocument();
  });

  it('should display formatted currency values', () => {
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    // Check formatted values appear
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
  });

  it('should display gain/loss with color coding', () => {
    const { container } = render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    // Find gain/loss cells by class
    const greenCells = container.querySelectorAll('.text-green-600');
    const redCells = container.querySelectorAll('.text-red-600');

    expect(greenCells.length).toBeGreaterThan(0); // Positive gain
    expect(redCells.length).toBeGreaterThan(0);   // Negative loss
  });

  it('should handle row selection', () => {
    const onSelectionChange = vi.fn();
    
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={onSelectionChange}
      />
    );

    // Click first checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // Skip "select all" checkbox

    expect(onSelectionChange).toHaveBeenCalledWith(['acc-1']);
  });

  it('should handle select all', () => {
    const onSelectionChange = vi.fn();
    
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={[]}
        isLoading={false}
        onSelectionChange={onSelectionChange}
      />
    );

    // Click "select all" checkbox
    const selectAllCheckbox = screen.getByLabelText('Select all accounts');
    fireEvent.click(selectAllCheckbox);

    expect(onSelectionChange).toHaveBeenCalledWith(['acc-1', 'acc-2']);
  });

  it('should handle deselect all', () => {
    const onSelectionChange = vi.fn();
    
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={['acc-1', 'acc-2']}
        isLoading={false}
        onSelectionChange={onSelectionChange}
      />
    );

    // Click "select all" checkbox to deselect
    const selectAllCheckbox = screen.getByLabelText('Select all accounts');
    fireEvent.click(selectAllCheckbox);

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('should show indeterminate state when some selected', () => {
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={['acc-1']}
        isLoading={false}
        onSelectionChange={vi.fn()}
      />
    );

    const selectAllCheckbox = screen.getByLabelText('Select all accounts') as HTMLInputElement;
    expect(selectAllCheckbox.indeterminate).toBe(true);
  });

  it('should toggle individual row selection', () => {
    const onSelectionChange = vi.fn();
    
    render(
      <AccountGrid
        accounts={mockAccounts}
        selectedAccountIds={['acc-1']}
        isLoading={false}
        onSelectionChange={onSelectionChange}
      />
    );

    // Click first checkbox to deselect
    const checkbox = screen.getByLabelText('Select Growth Account');
    fireEvent.click(checkbox);

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});

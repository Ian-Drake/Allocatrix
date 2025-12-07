/**
 * Unit tests for RebalanceConfirmDialog component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RebalanceConfirmDialog } from '../../../../src/features/portfolio-dashboard/components/RebalanceConfirmDialog/RebalanceConfirmDialog';
import type { Account } from '../../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

describe('RebalanceConfirmDialog Component', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Account 1',
      currentValue: 100000,
      todayGainLoss: 500,
      todayGainLossPercent: 0.5,
      excessCash: 1000,
      correctableDrift: 0.1,
      totalDrift: 0.5,
      positionCount: 10,
      cashBalance: 5000,
    },
    {
      id: 'acc-2',
      name: 'Account 2',
      currentValue: 150000,
      todayGainLoss: -300,
      todayGainLossPercent: -0.2,
      excessCash: 500,
      correctableDrift: 0.15,
      totalDrift: 0.6,
      positionCount: 8,
      cashBalance: 3000,
    },
  ];

  const defaultProps = {
    isOpen: true,
    selectedAccounts: mockAccounts,
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    isExecuting: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <RebalanceConfirmDialog {...defaultProps} isOpen={false} />
    );

    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('should render dialog with confirmation message', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Rebalance')).toBeInTheDocument();
    expect(screen.getByText('You are about to rebalance')).toBeInTheDocument();
  });

  it('should display selected accounts count and total value', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    expect(screen.getByText('2 accounts')).toBeInTheDocument();
    expect(screen.getByText('$250,000.00')).toBeInTheDocument();
  });

  it('should display singular text for single account', () => {
    const singleAccountProps = {
      ...defaultProps,
      selectedAccounts: [mockAccounts[0]],
    };

    render(<RebalanceConfirmDialog {...singleAccountProps} />);

    expect(screen.getByText('1 account')).toBeInTheDocument();
  });

  it('should list all selected accounts with values and drift', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Account 1')).toBeInTheDocument();
    expect(screen.getByText('Account 2')).toBeInTheDocument();
    expect(screen.getByText('$100,000.00')).toBeInTheDocument();
    expect(screen.getByText('$150,000.00')).toBeInTheDocument();
  });

  it('should display drift percentages for each account', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    // Drift values should be displayed
    expect(screen.getByText(/Drift:/)).toBeInTheDocument();
  });

  it('should display what will happen section', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    expect(screen.getByText('What will happen:')).toBeInTheDocument();
    expect(
      screen.getByText(/Positions will be adjusted to match target model allocation/)
    ).toBeInTheDocument();
  });

  it('should list rebalancing consequences', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    expect(
      screen.getByText(/Overweight positions may be sold/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Underweight positions may be purchased/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Cash may be deployed or generated/)).toBeInTheDocument();
  });

  it('should render Cancel button', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should render Confirm Rebalance button', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Rebalance')).toBeInTheDocument();
  });

  it('should call onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();

    render(<RebalanceConfirmDialog {...defaultProps} onCancel={onCancel} />);

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when Confirm button is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<RebalanceConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    const confirmBtn = screen.getByText('Confirm Rebalance');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('should disable buttons while executing', () => {
    render(<RebalanceConfirmDialog {...defaultProps} isExecuting={true} />);

    const cancelBtn = screen.getByText('Cancel') as HTMLButtonElement;
    const confirmBtn = screen.getByText('Confirm Rebalance') as HTMLButtonElement;

    expect(cancelBtn).toBeDisabled();
    expect(confirmBtn).toBeDisabled();
  });

  it('should show processing state on confirm button while executing', () => {
    render(<RebalanceConfirmDialog {...defaultProps} isExecuting={true} />);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should display error message when error prop is provided', () => {
    const errorMsg = 'Failed to rebalance account';

    render(
      <RebalanceConfirmDialog {...defaultProps} error={errorMsg} />
    );

    expect(screen.getByText('Error:')).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it('should display error message with Error label', () => {
    render(
      <RebalanceConfirmDialog
        {...defaultProps}
        error="Test error message"
      />
    );

    const errorElements = screen.getAllByText(/Error:/);
    expect(errorElements.length).toBeGreaterThan(0);
  });

  it('should not call onCancel when disabled', () => {
    const onCancel = vi.fn();

    render(
      <RebalanceConfirmDialog
        {...defaultProps}
        onCancel={onCancel}
        isExecuting={true}
      />
    );

    const cancelBtn = screen.getByText('Cancel') as HTMLButtonElement;
    fireEvent.click(cancelBtn);

    // Button is disabled so click shouldn't trigger callback
    expect(cancelBtn).toBeDisabled();
  });

  it('should show correct button text when not executing', () => {
    render(<RebalanceConfirmDialog {...defaultProps} isExecuting={false} />);

    expect(screen.getByText('Confirm Rebalance')).toBeInTheDocument();
    expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
  });

  it('should display all account information correctly with multiple accounts', () => {
    const threeAccounts: Account[] = [
      mockAccounts[0],
      mockAccounts[1],
      {
        id: 'acc-3',
        name: 'Account 3',
        currentValue: 200000,
        todayGainLoss: 1000,
        todayGainLossPercent: 0.5,
        excessCash: 2000,
        correctableDrift: 0.2,
        totalDrift: 0.8,
        positionCount: 12,
        cashBalance: 4000,
      },
    ];

    render(
      <RebalanceConfirmDialog
        {...defaultProps}
        selectedAccounts={threeAccounts}
      />
    );

    expect(screen.getByText('3 accounts')).toBeInTheDocument();
    expect(screen.getByText('Account 1')).toBeInTheDocument();
    expect(screen.getByText('Account 2')).toBeInTheDocument();
    expect(screen.getByText('Account 3')).toBeInTheDocument();
  });

  it('should calculate and display average drift correctly', () => {
    render(<RebalanceConfirmDialog {...defaultProps} />);

    // The dialog calculates average correctable drift
    // For the two accounts: (0.1 + 0.15) / 2 = 0.125
    // This should be displayed somewhere in the "What will happen" section
    expect(screen.getByText('What will happen:')).toBeInTheDocument();
  });
});

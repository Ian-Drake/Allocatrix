/**
 * Unit tests for LiquidateConfirmDialog component
 * Tests multi-step dialog state machine for liquidation workflow
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LiquidateConfirmDialog } from '../../../../src/features/portfolio-dashboard/components/LiquidateConfirmDialog/LiquidateConfirmDialog';
import type { Account } from '../../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

describe('LiquidateConfirmDialog Component', () => {
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
    isMarketClosed: false,
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
      <LiquidateConfirmDialog {...defaultProps} isOpen={false} />
    );

    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('should render Dialog 1 (intent confirmation) when opened', () => {
    render(<LiquidateConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Liquidation')).toBeInTheDocument();
    expect(screen.getByText('You are about to liquidate')).toBeInTheDocument();
  });

  it('should display selected accounts count and total value in Dialog 1', () => {
    render(<LiquidateConfirmDialog {...defaultProps} />);

    expect(screen.getByText('2 accounts')).toBeInTheDocument();
    expect(screen.getByText('$250,000.00')).toBeInTheDocument();
  });

  it('should list all selected accounts in Dialog 1', () => {
    render(<LiquidateConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Account 1')).toBeInTheDocument();
    expect(screen.getByText('Account 2')).toBeInTheDocument();
  });

  it('should display singular text for single account', () => {
    const singleAccountProps = {
      ...defaultProps,
      selectedAccounts: [mockAccounts[0]],
    };

    render(<LiquidateConfirmDialog {...singleAccountProps} />);

    expect(screen.getByText('1 account')).toBeInTheDocument();
  });

  it('should render Continue and Cancel buttons in Dialog 1', () => {
    render(<LiquidateConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Continue')).toBeInTheDocument();
    expect(screen.getAllByText('Cancel')[0]).toBeInTheDocument();
  });

  it('should advance to Dialog 2 when Continue button is clicked in Dialog 1', async () => {
    render(<LiquidateConfirmDialog {...defaultProps} />);

    const continueBtn = screen.getByText('Continue');
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText('Final Confirmation Required')).toBeInTheDocument();
    });
  });

  it('should display Dialog 2 (final confirmation) with warning', async () => {
    const { rerender } = render(<LiquidateConfirmDialog {...defaultProps} />);

    const continueBtn = screen.getByText('Continue');
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
      expect(screen.getByText(/Immediate sale of all securities/)).toBeInTheDocument();
    });
  });

  it('should render Back button in Dialog 2 to return to Dialog 1', async () => {
    render(<LiquidateConfirmDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Final Confirmation Required')).toBeInTheDocument();
    });

    const backBtn = screen.getByText('Back');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByText('Confirm Liquidation')).toBeInTheDocument();
    });
  });

  it('should advance to Dialog 3 from Dialog 2 when market is closed', async () => {
    const closedMarketProps = {
      ...defaultProps,
      isMarketClosed: true,
    };

    render(<LiquidateConfirmDialog {...closedMarketProps} />);

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Final Confirmation Required')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByText('Confirm Liquidation');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Market Closed Warning')).toBeInTheDocument();
    });
  });

  it('should execute action directly from Dialog 2 when market is open', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <LiquidateConfirmDialog
        {...defaultProps}
        isMarketClosed={false}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Final Confirmation Required')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByText('Confirm Liquidation');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('should render Dialog 3 (market closed warning)', async () => {
    render(
      <LiquidateConfirmDialog {...defaultProps} isMarketClosed={true} />
    );

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Final Confirmation Required')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByText('Confirm Liquidation');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Market Closed Warning')).toBeInTheDocument();
      expect(screen.getByText(/Markets are currently closed/)).toBeInTheDocument();
    });
  });

  it('should display market closed risks in Dialog 3', async () => {
    render(
      <LiquidateConfirmDialog {...defaultProps} isMarketClosed={true} />
    );

    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm Liquidation'));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Execution at next market open/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Thin order books/)
      ).toBeInTheDocument();
    });
  });

  it('should have Back button in Dialog 3', async () => {
    render(
      <LiquidateConfirmDialog {...defaultProps} isMarketClosed={true} />
    );

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm Liquidation'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Back').length).toBeGreaterThan(0);
    });
  });

  it('should execute action when Proceed Anyway is clicked in Dialog 3', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <LiquidateConfirmDialog
        {...defaultProps}
        isMarketClosed={true}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm Liquidation'));
    });

    await waitFor(() => {
      expect(screen.getByText('Proceed Anyway')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Proceed Anyway'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onCancel when Cancel button is clicked in Dialog 1', () => {
    const onCancel = vi.fn();

    render(<LiquidateConfirmDialog {...defaultProps} onCancel={onCancel} />);

    const cancelBtn = screen.getAllByText('Cancel')[0];
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should display error message when error prop is provided', async () => {
    const errorMsg = 'Failed to execute liquidation';

    render(
      <LiquidateConfirmDialog
        {...defaultProps}
        isMarketClosed={true}
        error={errorMsg}
      />
    );

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm Liquidation'));
    });

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument();
    });
  });

  it('should disable confirm button while executing', async () => {
    render(
      <LiquidateConfirmDialog {...defaultProps} isExecuting={true} />
    );

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      const confirmBtn = screen.getByText('Confirm Liquidation') as HTMLButtonElement;
      expect(confirmBtn).toBeDisabled();
    });
  });

  it('should show processing state on confirm button', async () => {
    render(
      <LiquidateConfirmDialog {...defaultProps} isExecuting={true} />
    );

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  it('should reset to step 1 after successful execution', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <LiquidateConfirmDialog
        {...defaultProps}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm Liquidation'));
    });

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });

    // Close and reopen the dialog to verify reset
    const { rerender: rerenderComponent } = render(
      <LiquidateConfirmDialog
        {...defaultProps}
        isOpen={false}
        onConfirm={onConfirm}
      />
    );

    rerenderComponent(
      <LiquidateConfirmDialog
        {...defaultProps}
        isOpen={true}
        onConfirm={onConfirm}
      />
    );

    // Should be back at step 1
    expect(screen.getByText('Confirm Liquidation')).toBeInTheDocument();
    expect(screen.queryByText('Final Confirmation Required')).not.toBeInTheDocument();
  });

  it('should handle account value calculations correctly', async () => {
    render(<LiquidateConfirmDialog {...defaultProps} />);

    // Dialog 1 shows total of 2 accounts
    expect(screen.getByText('$250,000.00')).toBeInTheDocument();
    expect(screen.getByText('$100,000.00')).toBeInTheDocument();
    expect(screen.getByText('$150,000.00')).toBeInTheDocument();
  });
});

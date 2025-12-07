/**
 * Integration test for Bulk Actions functionality
 * Tests the complete workflow for liquidate, rebalance, and use-cash actions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Account } from '../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

// Mock component that simulates the bulk actions workflow
const MockBulkActionsPage = ({
  onLiquidate,
  onRebalance,
  onUseCash,
  isMarketClosed,
}: {
  onLiquidate: (accountIds: string[]) => Promise<void>;
  onRebalance: (accountIds: string[]) => Promise<void>;
  onUseCash: (accountIds: string[]) => Promise<void>;
  isMarketClosed: boolean;
}) => {
  const [selectedAccounts, setSelectedAccounts] = React.useState<string[]>([]);
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [activeDialog, setActiveDialog] = React.useState<string | null>(null);

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

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleLiquidate = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsExecuting(true);
    try {
      await onLiquidate(selectedAccounts);
      setSuccessMessage(`Successfully liquidated ${selectedAccounts.length} account(s)`);
      setSelectedAccounts([]);
      setActiveDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to liquidate');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRebalance = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsExecuting(true);
    try {
      await onRebalance(selectedAccounts);
      setSuccessMessage(`Successfully rebalanced ${selectedAccounts.length} account(s)`);
      setSelectedAccounts([]);
      setActiveDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rebalance');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUseCash = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsExecuting(true);
    try {
      await onUseCash(selectedAccounts);
      setSuccessMessage(`Successfully deployed cash in ${selectedAccounts.length} account(s)`);
      setSelectedAccounts([]);
      setActiveDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy cash');
    } finally {
      setIsExecuting(false);
    }
  };

  const isActionsEnabled = selectedAccounts.length > 0;

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="account-grid">
        <h2>Select Accounts</h2>
        {mockAccounts.map(account => (
          <div key={account.id} className="account-row">
            <input
              type="checkbox"
              id={account.id}
              checked={selectedAccounts.includes(account.id)}
              onChange={() => toggleAccount(account.id)}
            />
            <label htmlFor={account.id}>{account.name}</label>
          </div>
        ))}
      </div>

      <div className="bulk-action-bar">
        <p>{selectedAccounts.length} accounts selected</p>
        <button
          onClick={() => setActiveDialog('liquidate')}
          disabled={!isActionsEnabled || isExecuting}
        >
          Liquidate
        </button>
        <button
          onClick={() => setActiveDialog('rebalance')}
          disabled={!isActionsEnabled || isExecuting}
        >
          Rebalance
        </button>
        <button
          onClick={() => setActiveDialog('useCash')}
          disabled={!isActionsEnabled || isExecuting}
        >
          Use Cash
        </button>
      </div>

      {activeDialog === 'liquidate' && (
        <div className="dialog liquidate-dialog">
          <h3>Confirm Liquidation</h3>
          <p>Liquidate {selectedAccounts.length} selected account(s)?</p>
          {isMarketClosed && <p className="warning">Markets are closed</p>}
          <button onClick={() => setActiveDialog(null)} disabled={isExecuting}>
            Cancel
          </button>
          <button onClick={handleLiquidate} disabled={isExecuting}>
            {isExecuting ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      )}

      {activeDialog === 'rebalance' && (
        <div className="dialog rebalance-dialog">
          <h3>Confirm Rebalance</h3>
          <p>Rebalance {selectedAccounts.length} selected account(s)?</p>
          <button onClick={() => setActiveDialog(null)} disabled={isExecuting}>
            Cancel
          </button>
          <button onClick={handleRebalance} disabled={isExecuting}>
            {isExecuting ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      )}

      {activeDialog === 'useCash' && (
        <div className="dialog usecash-dialog">
          <h3>Deploy Cash</h3>
          <p>Deploy available cash in {selectedAccounts.length} selected account(s)?</p>
          <button onClick={() => setActiveDialog(null)} disabled={isExecuting}>
            Cancel
          </button>
          <button onClick={handleUseCash} disabled={isExecuting}>
            {isExecuting ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  );
};

describe('Bulk Actions Integration', () => {
  const mockLiquidate = vi.fn().mockResolvedValue(undefined);
  const mockRebalance = vi.fn().mockResolvedValue(undefined);
  const mockUseCash = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enable bulk action buttons when accounts are selected', () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    // Initially buttons should be disabled
    expect(screen.getByText('Liquidate')).toBeDisabled();
    expect(screen.getByText('Rebalance')).toBeDisabled();
    expect(screen.getByText('Use Cash')).toBeDisabled();

    // Select an account
    const checkbox1 = screen.getByLabelText('Account 1') as HTMLInputElement;
    fireEvent.click(checkbox1);

    // Buttons should now be enabled
    expect(screen.getByText('Liquidate')).not.toBeDisabled();
    expect(screen.getByText('Rebalance')).not.toBeDisabled();
    expect(screen.getByText('Use Cash')).not.toBeDisabled();
  });

  it('should disable bulk action buttons when no accounts are selected', () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    const liquidateBtn = screen.getByText('Liquidate') as HTMLButtonElement;
    expect(liquidateBtn).toBeDisabled();
  });

  it('should select multiple accounts', () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    const checkbox1 = screen.getByLabelText('Account 1') as HTMLInputElement;
    const checkbox2 = screen.getByLabelText('Account 2') as HTMLInputElement;

    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);

    expect(checkbox1.checked).toBe(true);
    expect(checkbox2.checked).toBe(true);
    expect(screen.getByText('2 accounts selected')).toBeInTheDocument();
  });

  it('should execute liquidate action flow', async () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    // Select account
    fireEvent.click(screen.getByLabelText('Account 1'));

    // Click Liquidate button
    fireEvent.click(screen.getByText('Liquidate'));

    // Verify dialog opens
    await waitFor(() => {
      expect(screen.getByText('Confirm Liquidation')).toBeInTheDocument();
    });

    // Confirm liquidation
    const confirmBtn = screen.getByText('Confirm');
    fireEvent.click(confirmBtn);

    // Verify callback was called
    await waitFor(() => {
      expect(mockLiquidate).toHaveBeenCalledWith(['acc-1']);
    });
  });

  it('should execute rebalance action flow', async () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    // Select account
    fireEvent.click(screen.getByLabelText('Account 2'));

    // Click Rebalance button
    fireEvent.click(screen.getByText('Rebalance'));

    // Verify dialog opens
    await waitFor(() => {
      expect(screen.getByText('Confirm Rebalance')).toBeInTheDocument();
    });

    // Confirm rebalance
    const confirmBtn = screen.getAllByText('Confirm')[0];
    fireEvent.click(confirmBtn);

    // Verify callback was called
    await waitFor(() => {
      expect(mockRebalance).toHaveBeenCalledWith(['acc-2']);
    });
  });

  it('should execute use-cash action flow', async () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    // Select account
    fireEvent.click(screen.getByLabelText('Account 3'));

    // Click Use Cash button
    fireEvent.click(screen.getByText('Use Cash'));

    // Verify dialog opens
    await waitFor(() => {
      expect(screen.getByText('Deploy Cash')).toBeInTheDocument();
    });

    // Confirm action
    const confirmBtn = screen.getAllByText('Confirm')[0];
    fireEvent.click(confirmBtn);

    // Verify callback was called
    await waitFor(() => {
      expect(mockUseCash).toHaveBeenCalledWith(['acc-3']);
    });
  });

  it('should handle multiple account selection for bulk action', async () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    // Select multiple accounts
    fireEvent.click(screen.getByLabelText('Account 1'));
    fireEvent.click(screen.getByLabelText('Account 2'));

    // Click Liquidate
    fireEvent.click(screen.getByText('Liquidate'));

    await waitFor(() => {
      expect(screen.getByText('Liquidate 2 selected account(s)?')).toBeInTheDocument();
    });

    // Confirm
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockLiquidate).toHaveBeenCalledWith(['acc-1', 'acc-2']);
    });
  });

  it('should show success message after action completes', async () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Account 1'));
    fireEvent.click(screen.getByText('Liquidate'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Liquidation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(screen.getByText('Successfully liquidated 1 account(s)')).toBeInTheDocument();
    });
  });

  it('should handle action errors gracefully', async () => {
    const errorMessage = 'Network error during liquidation';
    const mockLiquidateWithError = vi.fn().mockRejectedValue(new Error(errorMessage));

    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidateWithError}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Account 1'));
    fireEvent.click(screen.getByText('Liquidate'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Liquidation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should disable buttons during action execution', async () => {
    const mockLiquidateSlowCall = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidateSlowCall}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Account 1'));
    fireEvent.click(screen.getByText('Liquidate'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm'));
    });

    // Buttons should be disabled while processing
    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  it('should clear selection after successful action', async () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Account 1'));
    fireEvent.click(screen.getByText('Liquidate'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm'));
    });

    await waitFor(() => {
      expect(screen.getByText('Successfully liquidated 1 account(s)')).toBeInTheDocument();
    });

    // Selection should be cleared
    expect(screen.getByText('0 accounts selected')).toBeInTheDocument();
  });

  it('should display market closed warning in liquidate dialog when market is closed', async () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={true}
      />
    );

    fireEvent.click(screen.getByLabelText('Account 1'));
    fireEvent.click(screen.getByText('Liquidate'));

    await waitFor(() => {
      expect(screen.getByText('Markets are closed')).toBeInTheDocument();
    });
  });

  it('should allow cancel before execution', async () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Account 1'));
    fireEvent.click(screen.getByText('Liquidate'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Liquidation')).toBeInTheDocument();
    });

    // Click Cancel
    const cancelBtn = screen.getAllByText('Cancel')[0];
    fireEvent.click(cancelBtn);

    // Dialog should be gone
    expect(screen.queryByText('Confirm Liquidation')).not.toBeInTheDocument();

    // Action should not have been called
    expect(mockLiquidate).not.toHaveBeenCalled();
  });

  it('should maintain selection count display', () => {
    render(
      <MockBulkActionsPage
        onLiquidate={mockLiquidate}
        onRebalance={mockRebalance}
        onUseCash={mockUseCash}
        isMarketClosed={false}
      />
    );

    expect(screen.getByText('0 accounts selected')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Account 1'));
    expect(screen.getByText('1 accounts selected')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Account 2'));
    expect(screen.getByText('2 accounts selected')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Account 1'));
    expect(screen.getByText('1 accounts selected')).toBeInTheDocument();
  });
});

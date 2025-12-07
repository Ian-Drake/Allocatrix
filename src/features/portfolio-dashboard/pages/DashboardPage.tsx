'use client';

/**
 * DashboardPage Component
 * 
 * Main dashboard page that combines:
 * - Portfolio Summary (total value, daily P&L, refresh button)
 * - Performance Chart (with timeframe selector)
 * - Account Grid with bulk actions
 * - Responsive layout with loading and error states
 */

import React, { useState } from 'react';
import { PortfolioSummary } from '../components/PortfolioSummary/PortfolioSummary';
import { PerformanceChart } from '../components/PerformanceChart/PerformanceChart';
import { AccountGrid } from '../components/AccountGrid/AccountGrid';
import { BulkActionBar } from '../components/BulkActionBar/BulkActionBar';
import { LiquidateConfirmDialog } from '../components/LiquidateConfirmDialog/LiquidateConfirmDialog';
import { RebalanceConfirmDialog } from '../components/RebalanceConfirmDialog/RebalanceConfirmDialog';
import { LoadingState } from '../components/LoadingState/LoadingState';
import { EmptyPortfolioState, EmptyGridState } from '../components/EmptyState/EmptyState';
import { MarketClosedWarning } from '../components/ActionStatus/ActionStatus';
import { usePortfolioData } from '../hooks/usePortfolioData';
import { useAccountsData } from '../hooks/useAccountsData';
import { useBulkActions } from '../hooks/useBulkActions';
import { useMarketHours } from '../hooks/useMarketHours';


export const DashboardPage: React.FC = () => {
  const {
    summary,
    chartData,
    timeframe,
    isLoading,
    error,
    setTimeframe,
    refresh,
  } = usePortfolioData();

  const {
    accounts,
    isLoading: isAccountsLoading,
    error: accountsError,
    refresh: refreshAccounts,
  } = useAccountsData();

  const {
    isExecuting,
    error: bulkActionError,
    result: bulkActionResult,
    executeLiquidate,
    executeRebalance,
    executeUseCash,
    reset: resetBulkAction,
  } = useBulkActions();

  const {
    isClosedOrError: isMarketClosedOrError,
  } = useMarketHours();

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [showLiquidateDialog, setShowLiquidateDialog] = useState<boolean>(false);
  const [showRebalanceDialog, setShowRebalanceDialog] = useState<boolean>(false);

  const handleSelectionChange = (accountIds: string[]) => {
    setSelectedAccountIds(accountIds);
  };

  const handleRefreshAll = async () => {
    await Promise.all([refresh(), refreshAccounts()]);
  };

  // Bulk action handlers
  const handleLiquidateClick = () => {
    setShowLiquidateDialog(true);
  };

  const handleRebalanceClick = () => {
    setShowRebalanceDialog(true);
  };

  const handleUseCashClick = async () => {
    // Use cash doesn't need a dialog (per spec)
    await executeUseCash(selectedAccountIds);
    // Refresh data after action
    await handleRefreshAll();
    // Clear selection
    setSelectedAccountIds([]);
  };

  const handleLiquidateConfirm = async () => {
    await executeLiquidate(selectedAccountIds);
    setShowLiquidateDialog(false);
    // Refresh data after action
    await handleRefreshAll();
    // Clear selection
    setSelectedAccountIds([]);
  };

  const handleRebalanceConfirm = async () => {
    await executeRebalance(selectedAccountIds);
    setShowRebalanceDialog(false);
    // Refresh data after action
    await handleRefreshAll();
    // Clear selection
    setSelectedAccountIds([]);
  };

  const handleCancelDialog = () => {
    setShowLiquidateDialog(false);
    setShowRebalanceDialog(false);
    resetBulkAction();
  };

  const getSelectedAccounts = () => {
    return accounts.filter(acc => selectedAccountIds.includes(acc.id));
  };

  if (error && !summary) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <h1 className="text-2xl font-bold text-red-900 mb-2">
              Error Loading Dashboard
            </h1>
            <p className="text-red-700 mb-6">{error}</p>
            <button
              onClick={handleRefreshAll}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show empty portfolio state if no accounts
  if (!isLoading && accounts.length === 0) {
    return (
      <EmptyPortfolioState
        onCreateAccount={() => {
          // Navigate to account linking or show dialog
          window.location.href = '/accounts/link';
        }}
      />
    );
  }

  // Show loading state while fetching initial data
  if (isLoading || isAccountsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Monitor your portfolio performance and account metrics
            </p>
          </div>
          <LoadingState showSummary={true} showChart={true} showGrid={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Monitor your portfolio performance and account metrics
          </p>
        </div>

        {/* Market Closed Warning */}
        {isMarketClosedOrError && (
          <MarketClosedWarning />
        )}

        {/* Portfolio Summary */}
        <PortfolioSummary
          summary={summary}
          isLoading={isLoading}
          onRefresh={handleRefreshAll}
        />

        {/* Performance Chart */}
        <PerformanceChart
          data={chartData}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          isLoading={isLoading}
        />

        {/* Account Grid */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Account Details</h2>
          {accountsError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800">{accountsError}</p>
              <button
                onClick={refreshAccounts}
                className="mt-2 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-sm"
              >
                Retry
              </button>
            </div>
          )}
          
          {/* Bulk Action Bar */}
          {selectedAccountIds.length > 0 && (
            <BulkActionBar
              selectedCount={selectedAccountIds.length}
              onLiquidate={handleLiquidateClick}
              onRebalance={handleRebalanceClick}
              onUseCash={handleUseCashClick}
              isEnabled={selectedAccountIds.length > 0}
            />
          )}

          {/* Bulk Action Result Message */}
          {bulkActionResult && (
            <div className={`rounded-lg p-4 mb-4 ${bulkActionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={bulkActionResult.success ? 'text-green-800' : 'text-red-800'}>
                {bulkActionResult.message}
              </p>
              {bulkActionResult.errors.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-sm">
                  {bulkActionResult.errors.map((err, idx) => (
                    <li key={idx} className="text-red-700">
                      {err.accountId}: {err.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {accounts.length === 0 ? (
            <EmptyGridState message="No accounts to display" />
          ) : (
            <AccountGrid
              accounts={accounts}
              selectedAccountIds={selectedAccountIds}
              isLoading={isAccountsLoading}
              onSelectionChange={handleSelectionChange}
            />
          )}
        </div>

        {/* Liquidate Confirm Dialog */}
        <LiquidateConfirmDialog
          isOpen={showLiquidateDialog}
          selectedAccounts={getSelectedAccounts()}
          isMarketClosed={isMarketClosedOrError}
          onConfirm={handleLiquidateConfirm}
          onCancel={handleCancelDialog}
          isExecuting={isExecuting}
          error={bulkActionError}
        />

        {/* Rebalance Confirm Dialog */}
        <RebalanceConfirmDialog
          isOpen={showRebalanceDialog}
          selectedAccounts={getSelectedAccounts()}
          onConfirm={handleRebalanceConfirm}
          onCancel={handleCancelDialog}
          isExecuting={isExecuting}
          error={bulkActionError}
        />

        {/* Info Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>
            Dashboard data is refreshed on demand. Click the &apos;Refresh&apos; button to
            get the latest metrics.
          </p>
        </div>
      </div>
    </div>
  );
};

DashboardPage.displayName = 'DashboardPage';

/**
 * RebalanceConfirmDialog Component
 * 
 * Single-step confirmation dialog for rebalance action
 * Shows selected accounts and what will happen
 */

import React from 'react';
import type { RebalanceConfirmDialogProps } from '../../types/portfolio-dashboard.types';
import { formatCurrency } from '../../utils/format-currency';
import { formatPercentage } from '../../utils/format-percentage';

export const RebalanceConfirmDialog: React.FC<RebalanceConfirmDialogProps> = ({
  isOpen,
  selectedAccounts,
  onConfirm,
  onCancel,
  isExecuting,
  error,
}) => {
  if (!isOpen) return null;

  const totalValue = selectedAccounts.reduce((sum, acc) => sum + acc.currentValue, 0);
  const accountCount = selectedAccounts.length;
  const totalCorrectableDrift = selectedAccounts.reduce((sum, acc) => sum + acc.correctableDrift, 0) / accountCount;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Confirm Rebalance
        </h2>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            You are about to rebalance <strong>{accountCount}</strong> {accountCount === 1 ? 'account' : 'accounts'} with a total value of <strong>{formatCurrency(totalValue)}</strong>.
          </p>
          
          <div className="bg-gray-50 rounded p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-2">Selected Accounts:</h3>
            <ul className="space-y-2">
              {selectedAccounts.map(account => (
                <li key={account.id} className="text-gray-700">
                  <div className="flex justify-between">
                    <span>{account.name}</span>
                    <span className="text-sm">
                      {formatCurrency(account.currentValue)} | 
                      Drift: {formatPercentage(account.correctableDrift)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <h3 className="font-semibold text-blue-900 mb-2">What will happen:</h3>
            <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
              <li>Positions will be adjusted to match target model allocation</li>
              <li>Average correctable drift will reduce from {formatPercentage(totalCorrectableDrift)} toward 0%</li>
              <li>Overweight positions may be sold</li>
              <li>Underweight positions may be purchased</li>
              <li>Cash may be deployed or generated</li>
            </ul>
          </div>

          <p className="text-sm text-gray-600">
            Rebalancing helps maintain your portfolio&apos;s target allocation and risk profile.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p className="text-red-800 text-sm font-semibold">Error:</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={isExecuting}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isExecuting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            {isExecuting ? 'Processing...' : 'Confirm Rebalance'}
          </button>
        </div>
      </div>
    </div>
  );
};

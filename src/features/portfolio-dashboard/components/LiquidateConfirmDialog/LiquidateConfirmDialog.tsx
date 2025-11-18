/**
 * LiquidateConfirmDialog Component
 * 
 * Multi-step progressive confirmation dialog for liquidate action
 * Step 1: Intent confirmation (show selected accounts)
 * Step 2: Final confirmation (show impact details)
 * Step 3 (conditional): Market closed warning (if market is closed or API fails)
 */

import React, { useState } from 'react';
import type { LiquidateConfirmDialogProps } from '../../types/portfolio-dashboard.types';
import { formatCurrency } from '../../utils/format-currency';

export const LiquidateConfirmDialog: React.FC<LiquidateConfirmDialogProps> = ({
  isOpen,
  selectedAccounts,
  isMarketClosed,
  onConfirm,
  onCancel,
  isExecuting,
  error,
}) => {
  const [step, setStep] = useState<number>(1);

  if (!isOpen) return null;

  const totalValue = selectedAccounts.reduce((sum, acc) => sum + acc.currentValue, 0);
  const accountCount = selectedAccounts.length;

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2 && isMarketClosed) {
      setStep(3);
    } else {
      handleConfirmFinal();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleConfirmFinal = async () => {
    await onConfirm();
    setStep(1); // Reset for next time
  };

  const handleCancelDialog = () => {
    setStep(1); // Reset step
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        {/* Step 1: Intent Confirmation */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Confirm Liquidation
            </h2>
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                You are about to liquidate <strong>{accountCount}</strong> {accountCount === 1 ? 'account' : 'accounts'} with a total value of <strong>{formatCurrency(totalValue)}</strong>.
              </p>
              <div className="bg-gray-50 rounded p-4 mb-4">
                <h3 className="font-semibold text-gray-900 mb-2">Selected Accounts:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {selectedAccounts.map(account => (
                    <li key={account.id} className="text-gray-700">
                      {account.name} - {formatCurrency(account.currentValue)}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-gray-600">
                This will submit market orders to sell all positions in the selected accounts.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDialog}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {/* Step 2: Final Confirmation */}
        {step === 2 && (
          <>
            <h2 className="text-2xl font-bold text-red-900 mb-4">
              Final Confirmation Required
            </h2>
            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                <p className="text-red-800 font-semibold mb-2">
                  ⚠️ Warning: This action cannot be undone
                </p>
                <p className="text-red-700 text-sm">
                  All positions in {accountCount} {accountCount === 1 ? 'account' : 'accounts'} will be sold at market price.
                  This may result in:
                </p>
                <ul className="list-disc list-inside mt-2 text-red-700 text-sm space-y-1">
                  <li>Immediate sale of all securities</li>
                  <li>Potential tax implications</li>
                  <li>Realized capital gains or losses</li>
                  <li>Portfolio rebalancing disruption</li>
                </ul>
              </div>
              <p className="text-gray-700">
                Are you absolutely sure you want to proceed with liquidating these accounts?
              </p>
            </div>
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Back
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelDialog}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNext}
                  disabled={isExecuting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
                >
                  {isExecuting ? 'Processing...' : 'Confirm Liquidation'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Market Closed Warning (Conditional) */}
        {step === 3 && (
          <>
            <h2 className="text-2xl font-bold text-orange-900 mb-4">
              Market Closed Warning
            </h2>
            <div className="mb-6">
              <div className="bg-orange-50 border border-orange-200 rounded p-4 mb-4">
                <p className="text-orange-800 font-semibold mb-2">
                  ⚠️ Markets are currently closed
                </p>
                <p className="text-orange-700 text-sm mb-3">
                  Executing liquidation orders outside of normal market hours may result in:
                </p>
                <ul className="list-disc list-inside text-orange-700 text-sm space-y-1">
                  <li>Execution at next market open (potentially hours or days away)</li>
                  <li>Thin order books leading to poor pricing</li>
                  <li>Higher volatility and price slippage</li>
                  <li>Less favorable execution compared to market hours</li>
                </ul>
              </div>
              <p className="text-gray-700">
                Do you want to proceed with liquidation knowing markets are closed?
              </p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Back
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelDialog}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmFinal}
                  disabled={isExecuting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
                >
                  {isExecuting ? 'Processing...' : 'Proceed Anyway'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

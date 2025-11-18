/**
 * BulkActionBar Component
 * 
 * Displays bulk action buttons for selected accounts
 * Buttons are enabled only when 1 or more accounts are selected
 */

import React from 'react';
import type { BulkActionBarProps } from '../../types/portfolio-dashboard.types';

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onLiquidate,
  onRebalance,
  onUseCash,
  isEnabled,
}) => {
  const buttonBaseClass = 'px-4 py-2 rounded-lg font-medium transition-colors';
  const enabledClass = 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer';
  const disabledClass = 'bg-gray-300 text-gray-500 cursor-not-allowed';

  const liquidateClass = isEnabled
    ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
    : disabledClass;
  
  const rebalanceClass = isEnabled
    ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
    : disabledClass;
  
  const useCashClass = isEnabled
    ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
    : disabledClass;

  return (
    <div className="flex items-center justify-between bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center space-x-4">
        <span className="text-gray-700 font-medium">
          {selectedCount > 0 ? (
            <span className="text-blue-600">
              {selectedCount} {selectedCount === 1 ? 'account' : 'accounts'} selected
            </span>
          ) : (
            <span className="text-gray-500">No accounts selected</span>
          )}
        </span>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onLiquidate}
          disabled={!isEnabled}
          className={`${buttonBaseClass} ${liquidateClass}`}
          aria-label="Liquidate selected accounts"
        >
          Liquidate
        </button>
        
        <button
          onClick={onRebalance}
          disabled={!isEnabled}
          className={`${buttonBaseClass} ${rebalanceClass}`}
          aria-label="Rebalance selected accounts"
        >
          Rebalance
        </button>
        
        <button
          onClick={onUseCash}
          disabled={!isEnabled}
          className={`${buttonBaseClass} ${useCashClass}`}
          aria-label="Use cash in selected accounts"
        >
          Use Cash
        </button>
      </div>
    </div>
  );
};

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
  const buttonBaseClass = 'px-2 md:px-4 py-1 md:py-2 rounded-lg text-sm md:text-base font-medium transition-all duration-200 flex-shrink-0';
  const disabledClass = 'bg-gray-300 text-gray-500 cursor-not-allowed';

  const liquidateClass = isEnabled
    ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-md hover:shadow-lg'
    : disabledClass;
  
  const rebalanceClass = isEnabled
    ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer shadow-md hover:shadow-lg'
    : disabledClass;
  
  const useCashClass = isEnabled
    ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-md hover:shadow-lg'
    : disabledClass;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg shadow-md p-3 md:p-4 mb-4 gap-3 md:gap-4 animate-slideIn">
      {/* Selection Summary */}
      <div className="flex items-center">
        <span className="text-gray-700 text-sm md:text-base font-medium">
          {selectedCount > 0 ? (
            <span className="text-blue-600 font-semibold">
              {selectedCount} {selectedCount === 1 ? 'account' : 'accounts'} selected
            </span>
          ) : (
            <span className="text-gray-500">No accounts selected</span>
          )}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 md:gap-3 flex-wrap md:flex-nowrap">
        <button
          onClick={onLiquidate}
          disabled={!isEnabled}
          className={`${buttonBaseClass} ${liquidateClass}`}
          aria-label="Liquidate selected accounts"
          title="Liquidate selected accounts"
        >
          Liquidate
        </button>
        
        <button
          onClick={onRebalance}
          disabled={!isEnabled}
          className={`${buttonBaseClass} ${rebalanceClass}`}
          aria-label="Rebalance selected accounts"
          title="Rebalance selected accounts"
        >
          Rebalance
        </button>
        
        <button
          onClick={onUseCash}
          disabled={!isEnabled}
          className={`${buttonBaseClass} ${useCashClass}`}
          aria-label="Use cash in selected accounts"
          title="Deploy excess cash to selected accounts"
        >
          Use Cash
        </button>
      </div>
    </div>
  );
};

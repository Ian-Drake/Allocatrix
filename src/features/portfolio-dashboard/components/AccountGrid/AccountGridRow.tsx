/**
 * AccountGridRow Component
 * 
 * Renders a single account row in the account grid
 * Displays account metrics with proper formatting
 */

import React from 'react';
import type { Account } from '../../types/portfolio-dashboard.types';
import { formatCurrency } from '../../utils/format-currency';
import { formatPercentage } from '../../utils/format-percentage';

export interface AccountGridRowProps {
  account: Account;
  isSelected: boolean;
  onToggle: (accountId: string) => void;
}

export const AccountGridRow: React.FC<AccountGridRowProps> = ({
  account,
  isSelected,
  onToggle,
}) => {
  const handleCheckboxChange = () => {
    onToggle(account.id);
  };

  const gainLossClass = account.todayGainLoss >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-200">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          className="w-4 h-4 cursor-pointer"
          aria-label={`Select ${account.name}`}
        />
      </td>
      <td className="px-4 py-3 font-medium text-gray-900">{account.name}</td>
      <td className="px-4 py-3 text-right text-gray-900">
        {formatCurrency(account.currentValue)}
      </td>
      <td className={`px-4 py-3 text-right ${gainLossClass}`}>
        {formatCurrency(account.todayGainLoss, 2)} ({formatPercentage(account.todayGainLossPercent, true)})
      </td>
      <td className="px-4 py-3 text-right text-gray-900">
        {formatCurrency(account.excessCash)}
      </td>
      <td className="px-4 py-3 text-right text-gray-900">
        {formatPercentage(account.correctableDrift)}
      </td>
      <td className="px-4 py-3 text-right text-gray-900">
        {formatPercentage(account.totalDrift)}
      </td>
    </tr>
  );
};

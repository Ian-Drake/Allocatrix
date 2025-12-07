/**
 * AccountGrid Component
 * 
 * Displays a table grid of accounts with performance and drift metrics
 * Supports multi-select via checkboxes and virtual scrolling for 50+ accounts
 */

import React from 'react';
import { FixedSizeList as List } from 'react-window';
import type { AccountGridProps } from '../../types/portfolio-dashboard.types';
import { AccountGridRow } from './AccountGridRow';

export const AccountGrid: React.FC<AccountGridProps> = ({
  accounts,
  selectedAccountIds,
  isLoading,
  onSelectionChange,
}) => {
  const handleToggle = (accountId: string) => {
    const isCurrentlySelected = selectedAccountIds.includes(accountId);
    const newSelection = isCurrentlySelected
      ? selectedAccountIds.filter(id => id !== accountId)
      : [...selectedAccountIds, accountId];
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectionChange(accounts.map(acc => acc.id));
    } else {
      onSelectionChange([]);
    }
  };

  const isAllSelected = accounts.length > 0 && selectedAccountIds.length === accounts.length;
  const isSomeSelected = selectedAccountIds.length > 0 && !isAllSelected;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading accounts...</div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">No accounts found</div>
      </div>
    );
  }

  // Use virtual scrolling if more than 20 accounts
  const useVirtualScrolling = accounts.length > 20;

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-300">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 md:px-4 py-2 md:py-3 text-left">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={input => {
                  if (input) {
                    input.indeterminate = isSomeSelected;
                  }
                }}
                onChange={handleSelectAll}
                className="w-4 h-4 cursor-pointer"
                aria-label="Select all accounts"
              />
            </th>
            <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs md:text-xs font-medium text-gray-500 uppercase tracking-wider">
              Account Name
            </th>
            <th className="hidden sm:table-cell px-2 md:px-4 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Value
            </th>
            <th className="px-2 md:px-4 py-2 md:py-3 text-right text-xs md:text-xs font-medium text-gray-500 uppercase tracking-wider">
              Today's Gain/Loss
            </th>
            <th className="hidden md:table-cell px-2 md:px-4 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Excess Cash
            </th>
            <th className="hidden lg:table-cell px-2 md:px-4 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Correctable Drift
            </th>
            <th className="hidden sm:table-cell px-2 md:px-4 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Drift
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {!useVirtualScrolling && accounts.map((account) => (
            <AccountGridRow
              key={account.id}
              account={account}
              isSelected={selectedAccountIds.includes(account.id)}
              onToggle={handleToggle}
            />
          ))}
          {useVirtualScrolling && (
            <tr>
              <td colSpan={7}>
                <List
                  height={600}
                  itemCount={accounts.length}
                  itemSize={60}
                  width="100%"
                >
                  {({ index, style }) => (
                    <div style={style}>
                      <table className="w-full">
                        <tbody>
                          <AccountGridRow
                            account={accounts[index]}
                            isSelected={selectedAccountIds.includes(accounts[index].id)}
                            onToggle={handleToggle}
                          />
                        </tbody>
                      </table>
                    </div>
                  )}
                </List>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

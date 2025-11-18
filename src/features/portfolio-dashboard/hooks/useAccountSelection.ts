/**
 * useAccountSelection Hook
 * 
 * Manages checkbox selection state for accounts
 * Provides methods for selecting/deselecting individual accounts or all accounts
 */

import { useState, useCallback } from 'react';
import type { Account, UseAccountSelectionReturn } from '../types/portfolio-dashboard.types';

export function useAccountSelection(): UseAccountSelectionReturn {
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  const isAccountSelected = useCallback((accountId: string): boolean => {
    return selectedAccountIds.includes(accountId);
  }, [selectedAccountIds]);

  const toggleAccount = useCallback((accountId: string) => {
    setSelectedAccountIds(prev => {
      const isCurrentlySelected = prev.includes(accountId);
      if (isCurrentlySelected) {
        return prev.filter(id => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  }, []);

  const selectAll = useCallback((accounts: Account[]) => {
    setSelectedAccountIds(accounts.map(acc => acc.id));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAccountIds([]);
  }, []);

  const getSelectedCount = useCallback(() => {
    return selectedAccountIds.length;
  }, [selectedAccountIds]);

  return {
    selectedAccountIds,
    isAccountSelected,
    toggleAccount,
    selectAll,
    clearSelection,
    getSelectedCount,
  };
}

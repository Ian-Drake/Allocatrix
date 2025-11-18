/**
 * useAccountsData Hook
 * 
 * Fetches and manages account-level data for the dashboard grid
 * Provides loading, error, and refresh states
 */

import { useState, useEffect, useCallback } from 'react';
import { Account, UseAccountsDataReturn } from '../types/portfolio-dashboard.types';
import { fetchAccounts } from '../services/portfolio-dashboard.service';

export function useAccountsData(): UseAccountsDataReturn {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchAccounts();
      setAccounts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load accounts';
      setError(errorMessage);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return {
    accounts,
    isLoading,
    error,
    refresh,
  };
}

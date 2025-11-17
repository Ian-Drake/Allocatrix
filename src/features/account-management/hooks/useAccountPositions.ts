import { useEffect, useState, useCallback } from 'react';
import { create } from 'zustand';

export interface Position {
  symbol: string;
  displayName?: string | null;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  currentAllocationPct: number;
}

export interface PositionsData {
  positions: Position[];
  totalAccountValue: number;
  availableCash: number;
  lastUpdated: string;
  isCached: boolean;
}

interface PositionsState {
  positions: Position[];
  totalAccountValue: number;
  availableCash: number;
  lastUpdated: string | null;
  isCached: boolean;
  loading: boolean;
  error: string | null;
  cacheAge: number | null; // minutes
  fetchPositions: (accountId: string, forceRefresh?: boolean) => Promise<void>;
  refreshPositions: (accountId: string) => Promise<void>;
  reset: () => void;
}

// Create Zustand store for positions state
export const usePositionsStore = create<PositionsState>((set) => ({
  positions: [],
  totalAccountValue: 0,
  availableCash: 0,
  lastUpdated: null,
  isCached: false,
  loading: false,
  error: null,
  cacheAge: null,

  fetchPositions: async (accountId: string, forceRefresh: boolean = false) => {
    try {
      set({ loading: true, error: null });
      const useCache = !forceRefresh;
      const response = await fetch(`/api/accounts/${accountId}/positions?useCache=${useCache}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Account not found');
        } else if (response.status === 401) {
          throw new Error('Unauthorized - please login');
        } else if (response.status === 503) {
          throw new Error('Schwab API unavailable - please try again later');
        } else {
          throw new Error(`Failed to fetch positions: ${response.statusText}`);
        }
      }

      const data: PositionsData = await response.json();

      // Calculate cache age in minutes
      const lastUpdatedTime = new Date(data.lastUpdated).getTime();
      const nowTime = new Date().getTime();
      const cacheAgeMinutes = Math.round((nowTime - lastUpdatedTime) / (1000 * 60));

      set({
        positions: data.positions,
        totalAccountValue: data.totalAccountValue,
        availableCash: data.availableCash,
        lastUpdated: data.lastUpdated,
        isCached: data.isCached,
        cacheAge: cacheAgeMinutes,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error fetching positions',
      });
    }
  },

  refreshPositions: async (accountId: string) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/accounts/${accountId}/refresh-positions`, {
        method: 'POST',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Account not found');
        } else if (response.status === 401) {
          throw new Error('Unauthorized - please login');
        } else if (response.status === 503) {
          throw new Error('Schwab API unavailable - please try again later');
        } else {
          throw new Error(`Failed to refresh positions: ${response.statusText}`);
        }
      }

      // After refresh, fetch the updated positions
      // Note: can't directly pass accountId here, but the refresh ensures fresh data
      const positionsResponse = await fetch(`/api/accounts/${accountId}/positions?useCache=false`);
      if (positionsResponse.ok) {
        const data: PositionsData = await positionsResponse.json();
        const lastUpdatedTime = new Date(data.lastUpdated).getTime();
        const nowTime = new Date().getTime();
        const cacheAgeMinutes = Math.round((nowTime - lastUpdatedTime) / (1000 * 60));

        set({
          positions: data.positions,
          totalAccountValue: data.totalAccountValue,
          availableCash: data.availableCash,
          lastUpdated: data.lastUpdated,
          isCached: data.isCached,
          cacheAge: cacheAgeMinutes,
          loading: false,
        });
      } else {
        throw new Error('Failed to fetch refreshed positions');
      }
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error refreshing positions',
      });
    }
  },

  reset: () => {
    set({
      positions: [],
      totalAccountValue: 0,
      availableCash: 0,
      lastUpdated: null,
      isCached: false,
      loading: false,
      error: null,
      cacheAge: null,
    });
  },
}));

/**
 * useAccountPositions Hook
 * Manages fetching, caching, and refreshing of account positions
 * 
 * Usage:
 * const { positions, loading, error, refreshPositions } = useAccountPositions(accountId);
 */
export function useAccountPositions(accountId?: string) {
  const store = usePositionsStore();
  const [initialLoad, setInitialLoad] = useState(false);

  // Auto-fetch positions when accountId changes
  useEffect(() => {
    if (accountId && !initialLoad) {
      store.fetchPositions(accountId, false);
      setInitialLoad(true);
    }
  }, [accountId, initialLoad, store]);

  const refreshPositions = useCallback(async () => {
    if (accountId) {
      await store.refreshPositions(accountId);
    }
  }, [accountId, store]);

  return {
    positions: store.positions,
    totalAccountValue: store.totalAccountValue,
    availableCash: store.availableCash,
    lastUpdated: store.lastUpdated,
    isCached: store.isCached,
    cacheAge: store.cacheAge,
    loading: store.loading,
    error: store.error,
    refreshPositions,
    reset: store.reset,
  };
}

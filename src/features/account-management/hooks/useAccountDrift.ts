import { useEffect, useState, useCallback } from 'react';
import { create } from 'zustand';

export interface DriftAnalysis {
  symbol: string;
  currentAllocationPct: number;
  targetAllocationPct: number;
  driftPct: number;
  status: 'aligned' | 'overweight' | 'underweight';
}

export interface DriftData {
  drifts: DriftAnalysis[];
  lastCalculatedAt: string;
}

interface DriftState {
  drifts: DriftAnalysis[];
  lastCalculatedAt: string | null;
  loading: boolean;
  error: string | null;
  highDriftPositions: DriftAnalysis[]; // positions with |drift| > 5%
  overweightPositions: DriftAnalysis[];
  underweightPositions: DriftAnalysis[];
  averageDrift: number;
  totalDriftScore: number;
  fetchDrift: (accountId: string) => Promise<void>;
  reset: () => void;
}

// Create Zustand store for drift state
export const useDriftStore = create<DriftState>((set) => ({
  drifts: [],
  lastCalculatedAt: null,
  loading: false,
  error: null,
  highDriftPositions: [],
  overweightPositions: [],
  underweightPositions: [],
  averageDrift: 0,
  totalDriftScore: 0,

  fetchDrift: async (accountId: string) => {
    try {
      set({ loading: true, error: null });
      const response = await fetch(`/api/accounts/${accountId}/drift`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Account not found');
        } else if (response.status === 401) {
          throw new Error('Unauthorized - please login');
        } else if (response.status === 403) {
          throw new Error('Account has no assigned model portfolio');
        } else if (response.status === 500) {
          throw new Error('Failed to calculate drift - please try again');
        } else {
          throw new Error(`Failed to fetch drift: ${response.statusText}`);
        }
      }

      const data: DriftData = await response.json();

      // Calculate summary statistics
      const highDrift = data.drifts.filter((d) => Math.abs(d.driftPct) > 5);
      const overweight = data.drifts.filter((d) => d.status === 'overweight').sort((a, b) => b.driftPct - a.driftPct);
      const underweight = data.drifts.filter((d) => d.status === 'underweight').sort((a, b) => a.driftPct - b.driftPct);
      const avgDrift = data.drifts.length > 0 ? data.drifts.reduce((sum, d) => sum + Math.abs(d.driftPct), 0) / data.drifts.length : 0;
      const totalScore = data.drifts.reduce((sum, d) => sum + Math.abs(d.driftPct), 0);

      set({
        drifts: data.drifts,
        lastCalculatedAt: data.lastCalculatedAt,
        highDriftPositions: highDrift,
        overweightPositions: overweight,
        underweightPositions: underweight,
        averageDrift: Math.round(avgDrift * 100) / 100,
        totalDriftScore: Math.round(totalScore * 100) / 100,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error fetching drift',
      });
    }
  },

  reset: () => {
    set({
      drifts: [],
      lastCalculatedAt: null,
      loading: false,
      error: null,
      highDriftPositions: [],
      overweightPositions: [],
      underweightPositions: [],
      averageDrift: 0,
      totalDriftScore: 0,
    });
  },
}));

/**
 * useAccountDrift Hook
 * Manages fetching and analyzing portfolio drift from assigned model allocation
 * 
 * Usage:
 * const { drifts, highDriftPositions, averageDrift, loading } = useAccountDrift(accountId);
 */
export function useAccountDrift(accountId?: string) {
  const store = useDriftStore();
  const [initialLoad, setInitialLoad] = useState(false);

  // Auto-fetch drift when accountId changes
  useEffect(() => {
    if (accountId && !initialLoad) {
      store.fetchDrift(accountId);
      setInitialLoad(true);
    }
  }, [accountId, initialLoad, store]);

  const recalculate = useCallback(async () => {
    if (accountId) {
      await store.fetchDrift(accountId);
    }
  }, [accountId, store]);

  return {
    drifts: store.drifts,
    lastCalculatedAt: store.lastCalculatedAt,
    loading: store.loading,
    error: store.error,
    highDriftPositions: store.highDriftPositions,
    overweightPositions: store.overweightPositions,
    underweightPositions: store.underweightPositions,
    averageDrift: store.averageDrift,
    totalDriftScore: store.totalDriftScore,
    recalculate,
    reset: store.reset,
  };
}

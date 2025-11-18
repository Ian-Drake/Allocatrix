/**
 * Unit tests for useAccountsData hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAccountsData } from '../../../src/features/portfolio-dashboard/hooks/useAccountsData';
import * as portfolioService from '../../../src/features/portfolio-dashboard/services/portfolio-dashboard.service';
import type { Account } from '../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

vi.mock('../../../src/features/portfolio-dashboard/services/portfolio-dashboard.service');

describe('useAccountsData', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Account 1',
      currentValue: 100000,
      todayGainLoss: 1500,
      todayGainLossPercent: 1.5,
      excessCash: 500,
      correctableDrift: 0.5,
      totalDrift: 1.2,
      positionCount: 10,
      cashBalance: 2000,
    },
    {
      id: 'acc-2',
      name: 'Account 2',
      currentValue: 50000,
      todayGainLoss: -500,
      todayGainLossPercent: -1.0,
      excessCash: 0,
      correctableDrift: 0.2,
      totalDrift: 0.8,
      positionCount: 5,
      cashBalance: 1000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load accounts on mount', async () => {
    vi.spyOn(portfolioService, 'fetchAccounts').mockResolvedValue(mockAccounts);

    const { result } = renderHook(() => useAccountsData());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.accounts).toEqual([]);
    expect(result.current.error).toBeNull();

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accounts).toEqual(mockAccounts);
    expect(result.current.error).toBeNull();
    expect(portfolioService.fetchAccounts).toHaveBeenCalledTimes(1);
  });

  it('should handle errors when fetching accounts', async () => {
    const errorMessage = 'Network error';
    vi.spyOn(portfolioService, 'fetchAccounts').mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useAccountsData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accounts).toEqual([]);
    expect(result.current.error).toBe(errorMessage);
  });

  it('should refresh accounts when refresh is called', async () => {
    vi.spyOn(portfolioService, 'fetchAccounts')
      .mockResolvedValueOnce(mockAccounts)
      .mockResolvedValueOnce([mockAccounts[0]]);

    const { result } = renderHook(() => useAccountsData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accounts).toEqual(mockAccounts);

    // Trigger refresh
    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.accounts).toEqual([mockAccounts[0]]);
    });

    expect(portfolioService.fetchAccounts).toHaveBeenCalledTimes(2);
  });

  it('should clear error on successful refresh after error', async () => {
    vi.spyOn(portfolioService, 'fetchAccounts')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockAccounts);

    const { result } = renderHook(() => useAccountsData());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    // Trigger refresh
    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.accounts).toEqual(mockAccounts);
    });
  });

  it('should handle non-Error exceptions', async () => {
    vi.spyOn(portfolioService, 'fetchAccounts').mockRejectedValue('String error');

    const { result } = renderHook(() => useAccountsData());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load accounts');
      expect(result.current.accounts).toEqual([]);
    });
  });
});

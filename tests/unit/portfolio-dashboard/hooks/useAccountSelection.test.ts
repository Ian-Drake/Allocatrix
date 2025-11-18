/**
 * Unit tests for useAccountSelection hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccountSelection } from '../../../src/features/portfolio-dashboard/hooks/useAccountSelection';
import type { Account } from '../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

describe('useAccountSelection', () => {
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
    {
      id: 'acc-3',
      name: 'Account 3',
      currentValue: 75000,
      todayGainLoss: 200,
      todayGainLossPercent: 0.27,
      excessCash: 300,
      correctableDrift: 0.3,
      totalDrift: 0.9,
      positionCount: 8,
      cashBalance: 1500,
    },
  ];

  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => useAccountSelection());

    expect(result.current.selectedAccountIds).toEqual([]);
    expect(result.current.getSelectedCount()).toBe(0);
  });

  it('should toggle account selection', () => {
    const { result } = renderHook(() => useAccountSelection());

    // Select account
    act(() => {
      result.current.toggleAccount('acc-1');
    });

    expect(result.current.selectedAccountIds).toEqual(['acc-1']);
    expect(result.current.isAccountSelected('acc-1')).toBe(true);
    expect(result.current.getSelectedCount()).toBe(1);

    // Deselect account
    act(() => {
      result.current.toggleAccount('acc-1');
    });

    expect(result.current.selectedAccountIds).toEqual([]);
    expect(result.current.isAccountSelected('acc-1')).toBe(false);
    expect(result.current.getSelectedCount()).toBe(0);
  });

  it('should toggle multiple accounts', () => {
    const { result } = renderHook(() => useAccountSelection());

    act(() => {
      result.current.toggleAccount('acc-1');
      result.current.toggleAccount('acc-2');
    });

    expect(result.current.selectedAccountIds).toEqual(['acc-1', 'acc-2']);
    expect(result.current.isAccountSelected('acc-1')).toBe(true);
    expect(result.current.isAccountSelected('acc-2')).toBe(true);
    expect(result.current.getSelectedCount()).toBe(2);
  });

  it('should select all accounts', () => {
    const { result } = renderHook(() => useAccountSelection());

    act(() => {
      result.current.selectAll(mockAccounts);
    });

    expect(result.current.selectedAccountIds).toEqual(['acc-1', 'acc-2', 'acc-3']);
    expect(result.current.getSelectedCount()).toBe(3);
  });

  it('should clear selection', () => {
    const { result } = renderHook(() => useAccountSelection());

    // Select some accounts
    act(() => {
      result.current.toggleAccount('acc-1');
      result.current.toggleAccount('acc-2');
    });

    expect(result.current.getSelectedCount()).toBe(2);

    // Clear selection
    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedAccountIds).toEqual([]);
    expect(result.current.getSelectedCount()).toBe(0);
  });

  it('should check if account is selected', () => {
    const { result } = renderHook(() => useAccountSelection());

    expect(result.current.isAccountSelected('acc-1')).toBe(false);

    act(() => {
      result.current.toggleAccount('acc-1');
    });

    expect(result.current.isAccountSelected('acc-1')).toBe(true);
    expect(result.current.isAccountSelected('acc-2')).toBe(false);
  });

  it('should maintain state across multiple operations', () => {
    const { result } = renderHook(() => useAccountSelection());

    act(() => {
      result.current.selectAll(mockAccounts);
    });

    expect(result.current.getSelectedCount()).toBe(3);

    act(() => {
      result.current.toggleAccount('acc-2'); // Deselect
    });

    expect(result.current.selectedAccountIds).toEqual(['acc-1', 'acc-3']);
    expect(result.current.getSelectedCount()).toBe(2);

    act(() => {
      result.current.toggleAccount('acc-2'); // Re-select
    });

    expect(result.current.selectedAccountIds).toContain('acc-1');
    expect(result.current.selectedAccountIds).toContain('acc-2');
    expect(result.current.selectedAccountIds).toContain('acc-3');
    expect(result.current.getSelectedCount()).toBe(3);
  });
});

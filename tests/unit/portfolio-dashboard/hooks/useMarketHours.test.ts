/**
 * Unit tests for useMarketHours hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMarketHours } from '../../../src/features/portfolio-dashboard/hooks/useMarketHours';
import * as marketHoursService from '../../../src/features/portfolio-dashboard/services/market-hours.service';

vi.mock('../../../src/features/portfolio-dashboard/services/market-hours.service');

describe('useMarketHours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize and check market hours on mount', async () => {
    vi.spyOn(marketHoursService, 'isMarketOpen').mockResolvedValue(true);

    const { result } = renderHook(() => useMarketHours());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isClosedOrError).toBe(false);
    expect(marketHoursService.isMarketOpen).toHaveBeenCalledTimes(1);
  });

  it('should detect market closed', async () => {
    vi.spyOn(marketHoursService, 'isMarketOpen').mockResolvedValue(false);

    const { result } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isClosedOrError).toBe(true);
  });

  it('should handle errors and default to closed', async () => {
    const errorMessage = 'Network error';
    vi.spyOn(marketHoursService, 'isMarketOpen').mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isOpen).toBe(false); // Default to closed on error
    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isClosedOrError).toBe(true);
  });

  it('should cache result for 1 hour', async () => {
    vi.spyOn(marketHoursService, 'isMarketOpen').mockResolvedValue(true);

    const { result, unmount } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(marketHoursService.isMarketOpen).toHaveBeenCalledTimes(1);

    // Advance time by 30 minutes (within cache duration)
    vi.advanceTimersByTime(30 * 60 * 1000);

    // Unmount and remount hook
    unmount();
    const { result: result2 } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    // Should use cached value, not call service again
    expect(marketHoursService.isMarketOpen).toHaveBeenCalledTimes(1);
  });

  it('should refresh after cache expires (1 hour)', async () => {
    vi.spyOn(marketHoursService, 'isMarketOpen')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const { result, unmount } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result.current.isOpen).toBe(true);
    });

    expect(marketHoursService.isMarketOpen).toHaveBeenCalledTimes(1);

    // Advance time by 61 minutes (past cache duration)
    vi.advanceTimersByTime(61 * 60 * 1000);

    // Unmount and remount hook
    unmount();
    const { result: result2 } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result2.current.isOpen).toBe(false);
    });

    // Should call service again after cache expires
    expect(marketHoursService.isMarketOpen).toHaveBeenCalledTimes(2);
  });

  it('should set isClosedOrError to true when market is closed', async () => {
    vi.spyOn(marketHoursService, 'isMarketOpen').mockResolvedValue(false);

    const { result } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result.current.isClosedOrError).toBe(true);
    });
  });

  it('should set isClosedOrError to true when there is an error', async () => {
    vi.spyOn(marketHoursService, 'isMarketOpen').mockRejectedValue(new Error('Error'));

    const { result } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result.current.isClosedOrError).toBe(true);
    });
  });

  it('should set isClosedOrError to false when market is open and no error', async () => {
    vi.spyOn(marketHoursService, 'isMarketOpen').mockResolvedValue(true);

    const { result } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result.current.isClosedOrError).toBe(false);
    });
  });

  it('should handle non-Error exceptions', async () => {
    vi.spyOn(marketHoursService, 'isMarketOpen').mockRejectedValue('String error');

    const { result } = renderHook(() => useMarketHours());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to detect market hours');
      expect(result.current.isOpen).toBe(false);
      expect(result.current.isClosedOrError).toBe(true);
    });
  });
});

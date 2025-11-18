/**
 * Unit tests for useBulkActions hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBulkActions } from '../../../src/features/portfolio-dashboard/hooks/useBulkActions';
import * as bulkActionsService from '../../../src/features/portfolio-dashboard/services/bulk-actions.service';
import type { ActionResult } from '../../../src/features/portfolio-dashboard/types/portfolio-dashboard.types';

vi.mock('../../../src/features/portfolio-dashboard/services/bulk-actions.service');

describe('useBulkActions', () => {
  const mockSuccessResult: ActionResult = {
    success: true,
    successCount: 2,
    failureCount: 0,
    errors: [],
    message: 'Action completed successfully',
  };

  const mockPartialSuccessResult: ActionResult = {
    success: false,
    successCount: 1,
    failureCount: 1,
    errors: [{ accountId: 'acc-2', reason: 'Insufficient funds' }],
    message: 'Action partially completed',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useBulkActions());

    expect(result.current.isExecuting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  describe('executeLiquidate', () => {
    it('should execute liquidate successfully', async () => {
      vi.spyOn(bulkActionsService, 'liquidateAccounts').mockResolvedValue(mockSuccessResult);

      const { result } = renderHook(() => useBulkActions());

      const promise = result.current.executeLiquidate(['acc-1', 'acc-2']);

      // Should be executing
      expect(result.current.isExecuting).toBe(true);

      const actionResult = await promise;

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(actionResult).toEqual(mockSuccessResult);
      expect(result.current.result).toEqual(mockSuccessResult);
      expect(result.current.error).toBeNull();
      expect(bulkActionsService.liquidateAccounts).toHaveBeenCalledWith(['acc-1', 'acc-2']);
    });

    it('should handle liquidate errors', async () => {
      const errorMessage = 'Network error';
      vi.spyOn(bulkActionsService, 'liquidateAccounts').mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useBulkActions());

      const actionResult = await result.current.executeLiquidate(['acc-1']);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(actionResult.success).toBe(false);
      expect(actionResult.successCount).toBe(0);
      expect(actionResult.failureCount).toBe(1);
    });

    it('should handle partial success', async () => {
      vi.spyOn(bulkActionsService, 'liquidateAccounts').mockResolvedValue(mockPartialSuccessResult);

      const { result } = renderHook(() => useBulkActions());

      const actionResult = await result.current.executeLiquidate(['acc-1', 'acc-2']);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(actionResult).toEqual(mockPartialSuccessResult);
      expect(result.current.error).toBe('Action partially completed');
      expect(result.current.result).toEqual(mockPartialSuccessResult);
    });
  });

  describe('executeRebalance', () => {
    it('should execute rebalance successfully', async () => {
      vi.spyOn(bulkActionsService, 'rebalanceAccounts').mockResolvedValue(mockSuccessResult);

      const { result } = renderHook(() => useBulkActions());

      const actionResult = await result.current.executeRebalance(['acc-1', 'acc-2']);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(actionResult).toEqual(mockSuccessResult);
      expect(result.current.result).toEqual(mockSuccessResult);
      expect(result.current.error).toBeNull();
    });

    it('should handle rebalance errors', async () => {
      vi.spyOn(bulkActionsService, 'rebalanceAccounts').mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useBulkActions());

      const actionResult = await result.current.executeRebalance(['acc-1']);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.error).toBe('API error');
      expect(actionResult.success).toBe(false);
    });
  });

  describe('executeUseCash', () => {
    it('should execute use cash successfully', async () => {
      vi.spyOn(bulkActionsService, 'useCashOnAccounts').mockResolvedValue(mockSuccessResult);

      const { result } = renderHook(() => useBulkActions());

      const actionResult = await result.current.executeUseCash(['acc-1', 'acc-2']);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(actionResult).toEqual(mockSuccessResult);
      expect(result.current.result).toEqual(mockSuccessResult);
      expect(result.current.error).toBeNull();
    });

    it('should handle use cash errors', async () => {
      vi.spyOn(bulkActionsService, 'useCashOnAccounts').mockRejectedValue(new Error('Validation error'));

      const { result } = renderHook(() => useBulkActions());

      const actionResult = await result.current.executeUseCash(['acc-1']);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.error).toBe('Validation error');
      expect(actionResult.success).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('should clear error', async () => {
      vi.spyOn(bulkActionsService, 'liquidateAccounts').mockRejectedValue(new Error('Error'));

      const { result } = renderHook(() => useBulkActions());

      await result.current.executeLiquidate(['acc-1']);

      await waitFor(() => {
        expect(result.current.error).toBe('Error');
      });

      result.current.clearError();

      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeTruthy(); // Result should still be there
    });

    it('should reset state', async () => {
      vi.spyOn(bulkActionsService, 'liquidateAccounts').mockResolvedValue(mockSuccessResult);

      const { result } = renderHook(() => useBulkActions());

      await result.current.executeLiquidate(['acc-1']);

      await waitFor(() => {
        expect(result.current.result).toBeTruthy();
      });

      result.current.reset();

      expect(result.current.isExecuting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
    });
  });
});

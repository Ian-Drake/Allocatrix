/**
 * useBulkActions Hook
 * 
 * Orchestrates bulk account actions (liquidate, rebalance, use cash)
 * Manages action state and error handling
 */

import { useState, useCallback } from 'react';
import type { UseBulkActionsReturn, ActionResult } from '../types/portfolio-dashboard.types';
import {
  liquidateAccounts,
  rebalanceAccounts,
  useCashAccounts,
} from '../services/bulk-actions.service';

export function useBulkActions(): UseBulkActionsReturn {
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const executeLiquidate = useCallback(async (accountIds: string[]): Promise<ActionResult> => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const actionResult = await liquidateAccounts(accountIds);
      setResult(actionResult);
      
      if (!actionResult.success) {
        setError(actionResult.message || 'Liquidate action failed');
      }
      
      return actionResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute liquidate';
      setError(errorMessage);
      
      const errorResult: ActionResult = {
        success: false,
        successCount: 0,
        failureCount: accountIds.length,
        errors: accountIds.map(id => ({ accountId: id, reason: errorMessage })),
        message: errorMessage,
      };
      
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const executeRebalance = useCallback(async (accountIds: string[]): Promise<ActionResult> => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const actionResult = await rebalanceAccounts(accountIds);
      setResult(actionResult);
      
      if (!actionResult.success) {
        setError(actionResult.message || 'Rebalance action failed');
      }
      
      return actionResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute rebalance';
      setError(errorMessage);
      
      const errorResult: ActionResult = {
        success: false,
        successCount: 0,
        failureCount: accountIds.length,
        errors: accountIds.map(id => ({ accountId: id, reason: errorMessage })),
        message: errorMessage,
      };
      
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const executeUseCash = useCallback(async (accountIds: string[]): Promise<ActionResult> => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const actionResult = await useCashAccounts(accountIds);
      setResult(actionResult);
      
      if (!actionResult.success) {
        setError(actionResult.message || 'Use cash action failed');
      }
      
      return actionResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute use cash';
      setError(errorMessage);
      
      const errorResult: ActionResult = {
        success: false,
        successCount: 0,
        failureCount: accountIds.length,
        errors: accountIds.map(id => ({ accountId: id, reason: errorMessage })),
        message: errorMessage,
      };
      
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsExecuting(false);
    setError(null);
    setResult(null);
  }, []);

  return {
    isExecuting,
    error,
    result,
    executeLiquidate,
    executeRebalance,
    executeUseCash,
    clearError,
    reset,
  };
}

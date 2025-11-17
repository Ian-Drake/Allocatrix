/**
 * useCashDeployment Hook
 * Manages cash deployment state and API interactions
 * 
 * State Management:
 * - Loading state for preview and execution
 * - Deployment preview data
 * - Execution results
 * - Error handling
 * 
 * User Story 5: Cash Deployment frontend state
 */

import { useState, useCallback } from 'react';

export interface CashDeploymentPreview {
  accountId: string;
  availableCash: number;
  reserveAmount: number;
  cashToDeployAmount: number;
  proposedTrades: Array<{
    symbol: string;
    quantity: number;
    estimatedPrice: number;
    totalCost: number;
  }>;
  projectedAllocation: Array<{
    symbol: string;
    currentValue: number;
    postDeploymentValue: number;
    currentWeight: number;
    projectedWeight: number;
  }>;
  totalDeploymentCost: number;
  remainingCash: number;
  estimatedExecutionTime: number;
  warnings: string[];
}

export interface DeploymentExecutionResult {
  successful: number;
  failed: number;
  trades: Array<{
    symbol: string;
    status: 'executed' | 'failed';
    quantity?: number;
    errorMessage?: string;
  }>;
  totalValueDeployed: number;
  executionSummary: string;
}

interface UseCashDeploymentState {
  // Preview state
  previewLoading: boolean;
  previewData: CashDeploymentPreview | null;
  previewError: string | null;

  // Execution state
  executeLoading: boolean;
  executionResult: DeploymentExecutionResult | null;
  executionError: string | null;

  // UI state
  showPreview: boolean;
  showConfirmation: boolean;
}

/**
 * Hook for managing cash deployment workflow
 * 
 * @param accountId - Account ID to deploy cash for
 * @returns Deployment state and control functions
 */
export function useCashDeployment(accountId: string) {
  const [state, setState] = useState<UseCashDeploymentState>({
    previewLoading: false,
    previewData: null,
    previewError: null,
    executeLoading: false,
    executionResult: null,
    executionError: null,
    showPreview: false,
    showConfirmation: false,
  });

  /**
   * Calculate deployment preview
   * Calls GET /api/accounts/[id]/deploy-cash
   * 
   * @param reservePercent - Percentage to reserve (0-100)
   */
  const calculatePreview = useCallback(
    async (reservePercent: number = 3) => {
      setState((prev) => ({
        ...prev,
        previewLoading: true,
        previewError: null,
      }));

      try {
        const response = await fetch(
          `/api/accounts/${accountId}/deploy-cash?reservePercent=${reservePercent}`
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.details || error.error || 'Failed to calculate preview');
        }

        const data = await response.json();

        setState((prev) => ({
          ...prev,
          previewLoading: false,
          previewData: data.data,
          showPreview: true,
        }));

        return data.data as CashDeploymentPreview;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        setState((prev) => ({
          ...prev,
          previewLoading: false,
          previewError: errorMessage,
        }));

        throw error;
      }
    },
    [accountId]
  );

  /**
   * Execute deployment
   * Submits trades to POST /api/accounts/[id]/deploy-cash/execute
   * 
   * This is a destructive operation - actual trades will be executed
   */
  const executeDeployment = useCallback(async () => {
    if (!state.previewData) {
      throw new Error('No preview data available - calculate preview first');
    }

    setState((prev) => ({
      ...prev,
      executeLoading: true,
      executionError: null,
    }));

    try {
      const response = await fetch(`/api/accounts/${accountId}/deploy-cash/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedTrades: state.previewData.proposedTrades,
          reserveAmount: state.previewData.reserveAmount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to execute deployment');
      }

      const data = await response.json();

      setState((prev) => ({
        ...prev,
        executeLoading: false,
        executionResult: data.data,
        showPreview: false,
        showConfirmation: false,
      }));

      return data.data as DeploymentExecutionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setState((prev) => ({
        ...prev,
        executeLoading: false,
        executionError: errorMessage,
      }));

      throw error;
    }
  }, [accountId, state.previewData]);

  /**
   * Close preview and reset state
   */
  const closePreview = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showPreview: false,
      showConfirmation: false,
    }));
  }, []);

  /**
   * Show confirmation dialog
   */
  const showConfirmationDialog = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showConfirmation: true,
    }));
  }, []);

  /**
   * Cancel execution
   */
  const cancelExecution = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showConfirmation: false,
    }));
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState({
      previewLoading: false,
      previewData: null,
      previewError: null,
      executeLoading: false,
      executionResult: null,
      executionError: null,
      showPreview: false,
      showConfirmation: false,
    });
  }, []);

  /**
   * Check if deployment is worthwhile
   * @returns true if there are trades to execute
   */
  const isWorthwhile = useCallback(() => {
    return state.previewData && state.previewData.proposedTrades.length > 0;
  }, [state.previewData]);

  /**
   * Get total deployment summary
   */
  const getSummary = useCallback(() => {
    if (!state.previewData) return null;

    return {
      totalToDeploy: state.previewData.totalDeploymentCost,
      remainingCash: state.previewData.remainingCash,
      numTrades: state.previewData.proposedTrades.length,
      isReady: state.previewData.proposedTrades.length > 0,
    };
  }, [state.previewData]);

  return {
    // State
    isLoading: state.previewLoading || state.executeLoading,
    isExecuting: state.executeLoading,
    previewData: state.previewData,
    executionResult: state.executionResult,
    error: state.previewError || state.executionError,
    showPreview: state.showPreview,
    showConfirmation: state.showConfirmation,

    // Actions
    calculatePreview,
    executeDeployment,
    closePreview,
    showConfirmationDialog,
    cancelExecution,
    reset,

    // Helpers
    isWorthwhile,
    getSummary,
  };
}

/**
 * Hook for deployment state in context
 * Optional: Use this to share deployment state across multiple components
 */
export function useCashDeploymentContext() {
  // Would be implemented with React Context
  // For now, consumers should use useCashDeployment hook directly
  throw new Error('useCashDeploymentContext not yet implemented - use useCashDeployment hook');
}

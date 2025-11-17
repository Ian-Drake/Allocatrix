/**
 * TickerAllocator Component
 *
 * Manages ticker allocations within asset classes
 * Displays tickers, their weights, and validation within each asset class
 */

import React, { useCallback } from 'react';
import { usePortfolioStore } from '../../services/portfolio.store';

interface TickerAllocatorProps {
  onAddTicker?: (
    assetClassId: string,
    symbol: string,
    weight: number,
    displayName?: string
  ) => Promise<void>;
  onUpdateTickerWeight?: (
    assetClassId: string,
    symbol: string,
    weight: number
  ) => Promise<void>;
  onRemoveTicker?: (assetClassId: string, symbol: string) => Promise<void>;
  isSubmitting?: boolean;
  error?: string;
}

interface FormState {
  newSymbol: string;
  newWeight: string;
  displayName: string;
  errorMessage?: string;
}

export const TickerAllocator: React.FC<TickerAllocatorProps> = ({
  onAddTicker,
  onUpdateTickerWeight,
  onRemoveTicker,
  isSubmitting = false,
  error,
}) => {
  const currentPortfolio = usePortfolioStore((state) => state.currentPortfolio);
  const addTicker = usePortfolioStore((state) => state.addTicker);
  const updateTickerWeight = usePortfolioStore((state) => state.updateTickerWeight);
  const removeTicker = usePortfolioStore((state) => state.removeTicker);

  const [expandedAssetClassId, setExpandedAssetClassId] = React.useState<string | null>(null);
  const [formStates, setFormStates] = React.useState<Record<string, FormState>>({});

  const isReadOnly = currentPortfolio?.status !== 'Draft';

  // Initialize form state for asset class
  const getFormState = useCallback(
    (assetClassId: string): FormState => {
      if (!formStates[assetClassId]) {
        setFormStates((prev) => ({
          ...prev,
          [assetClassId]: {
            newSymbol: '',
            newWeight: '',
            displayName: '',
          },
        }));
      }
      return (
        formStates[assetClassId] || {
          newSymbol: '',
          newWeight: '',
          displayName: '',
        }
      );
    },
    [formStates]
  );

  // Validate ticker symbol
  const validateSymbol = useCallback((symbol: string): boolean => {
    return /^[A-Z0-9.-]{1,10}$/.test(symbol);
  }, []);

  // Calculate weight sum for asset class
  const getAssetClassWeightSum = useCallback(
    (assetClassId: string): number => {
      const assetClass = currentPortfolio?.assetClasses.find(
        (ac) => ac.id === assetClassId
      );
      if (!assetClass?.tickers) return 0;
      return assetClass.tickers.reduce(
        (sum, t) => sum + t.targetWeightPctWithinAssetClass,
        0
      );
    },
    [currentPortfolio?.assetClasses]
  );

  // Check if asset class weight sum is valid
  const isAssetClassWeightValid = useCallback(
    (assetClassId: string): boolean => {
      const sum = getAssetClassWeightSum(assetClassId);
      return Math.abs(sum - 100) <= 1;
    },
    [getAssetClassWeightSum]
  );

  const handleAddTicker = useCallback(
    async (assetClassId: string) => {
      const state = getFormState(assetClassId);
      const errors: string[] = [];

      if (!state.newSymbol) {
        errors.push('Ticker symbol is required');
      } else if (!validateSymbol(state.newSymbol)) {
        errors.push('Symbol must be 1-10 chars (letters, numbers, dots, dashes)');
      }

      const weight = parseFloat(state.newWeight);
      if (!state.newWeight || isNaN(weight)) {
        errors.push('Weight is required and must be a number');
      } else if (weight < 0 || weight > 100) {
        errors.push('Weight must be between 0 and 100');
      }

      if (errors.length > 0) {
        setFormStates((prev) => ({
          ...prev,
          [assetClassId]: {
            ...state,
            errorMessage: errors.join('; '),
          },
        }));
        return;
      }

      try {
        const newTicker = {
          id: `${assetClassId}-${state.newSymbol}`,
          symbol: state.newSymbol.toUpperCase(),
          displayName: state.displayName || undefined,
          targetWeightPctWithinAssetClass: weight,
        };

        addTicker(assetClassId, newTicker);

        if (onAddTicker) {
          await onAddTicker(
            assetClassId,
            state.newSymbol.toUpperCase(),
            weight,
            state.displayName || undefined
          );
        }

        setFormStates((prev) => ({
          ...prev,
          [assetClassId]: {
            newSymbol: '',
            newWeight: '',
            displayName: '',
          },
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add ticker';
        setFormStates((prev) => ({
          ...prev,
          [assetClassId]: {
            ...state,
            errorMessage: message,
          },
        }));
      }
    },
    [getFormState, validateSymbol, addTicker, onAddTicker]
  );

  const handleUpdateTickerWeight = useCallback(
    async (assetClassId: string, tickerId: string, weight: number) => {
      try {
        updateTickerWeight(assetClassId, tickerId, weight);

        if (onUpdateTickerWeight) {
          const ticker = currentPortfolio?.assetClasses
            .find((ac) => ac.id === assetClassId)
            ?.tickers.find((t) => t.id === tickerId);
          if (ticker) {
            await onUpdateTickerWeight(assetClassId, ticker.symbol, weight);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update weight';
        console.error(message);
      }
    },
    [updateTickerWeight, onUpdateTickerWeight, currentPortfolio?.assetClasses]
  );

  const handleRemoveTicker = useCallback(
    async (assetClassId: string, tickerId: string) => {
      try {
        const ticker = currentPortfolio?.assetClasses
          .find((ac) => ac.id === assetClassId)
          ?.tickers.find((t) => t.id === tickerId);
        if (!ticker) return;

        removeTicker(assetClassId, tickerId);

        if (onRemoveTicker) {
          await onRemoveTicker(assetClassId, ticker.symbol);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove ticker';
        console.error(message);
      }
    },
    [removeTicker, onRemoveTicker, currentPortfolio?.assetClasses]
  );

  if (!currentPortfolio?.assetClasses || currentPortfolio.assetClasses.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center">
        <p className="text-gray-600 text-sm">
          Add asset classes first before allocating tickers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Ticker Allocations</h3>

      {currentPortfolio.assetClasses.map((assetClass) => {
        const weightSum = getAssetClassWeightSum(assetClass.id);
        const isValid = isAssetClassWeightValid(assetClass.id);
        const formState = getFormState(assetClass.id);

        return (
          <div key={assetClass.id} className="border border-gray-200 rounded-lg p-4">
            {/* Asset Class Header */}
            <button
              type="button"
              onClick={() =>
                setExpandedAssetClassId(
                  expandedAssetClassId === assetClass.id ? null : assetClass.id
                )
              }
              className="w-full text-left flex items-center justify-between"
            >
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{assetClass.name}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Target Weight: {assetClass.targetWeightPct.toFixed(2)}%
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {assetClass.tickers?.length || 0} ticker{(assetClass.tickers?.length || 0) !== 1 ? 's' : ''}
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      isValid ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {weightSum.toFixed(2)}% / 100%
                  </p>
                </div>

                <span className="text-gray-400">
                  {expandedAssetClassId === assetClass.id ? '▼' : '▶'}
                </span>
              </div>
            </button>

            {/* Expanded Content */}
            {expandedAssetClassId === assetClass.id && (
              <div className="mt-4 space-y-4 pt-4 border-t border-gray-200">
                {/* Tickers List */}
                {assetClass.tickers && assetClass.tickers.length > 0 ? (
                  <div className="space-y-2">
                    {assetClass.tickers.map((ticker) => (
                      <div
                        key={ticker.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{ticker.symbol}</p>
                          {ticker.displayName && (
                            <p className="text-sm text-gray-600">{ticker.displayName}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={ticker.targetWeightPctWithinAssetClass}
                            onChange={(e) =>
                              handleUpdateTickerWeight(
                                assetClass.id,
                                ticker.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            disabled={isReadOnly || isSubmitting}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-sm font-medium text-gray-600">%</span>

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveTicker(assetClass.id, ticker.id)
                              }
                              disabled={isSubmitting}
                              className="px-2 py-1 text-xs text-red-700 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No tickers added yet</p>
                )}

                {/* Weight Validation */}
                <div
                  className={`p-3 rounded text-sm ${
                    isValid
                      ? 'bg-green-50 text-green-800'
                      : 'bg-yellow-50 text-yellow-800'
                  }`}
                >
                  {isValid
                    ? `✓ Ticker weights valid (${weightSum.toFixed(2)}%)`
                    : `⚠ Ticker weights must sum to 100% ±1% (currently ${weightSum.toFixed(2)}%)`}
                </div>

                {/* Add Ticker Form */}
                {!isReadOnly && (
                  <div className="p-3 bg-gray-100 rounded space-y-3">
                    <h5 className="font-medium text-sm text-gray-900">
                      Add Ticker
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {/* Symbol */}
                      <input
                        type="text"
                        placeholder="Symbol"
                        value={formState.newSymbol}
                        onChange={(e) => {
                          const newSymbol = e.target.value.toUpperCase();
                          setFormStates((prev) => ({
                            ...prev,
                            [assetClass.id]: {
                              ...formState,
                              newSymbol,
                            },
                          }));
                        }}
                        disabled={isSubmitting}
                        maxLength={10}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />

                      {/* Weight */}
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="Weight"
                        value={formState.newWeight}
                        onChange={(e) => {
                          setFormStates((prev) => ({
                            ...prev,
                            [assetClass.id]: {
                              ...formState,
                              newWeight: e.target.value,
                            },
                          }));
                        }}
                        disabled={isSubmitting}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />

                      {/* Display Name */}
                      <input
                        type="text"
                        placeholder="Name (optional)"
                        value={formState.displayName}
                        onChange={(e) => {
                          setFormStates((prev) => ({
                            ...prev,
                            [assetClass.id]: {
                              ...formState,
                              displayName: e.target.value,
                            },
                          }));
                        }}
                        disabled={isSubmitting}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={() => handleAddTicker(assetClass.id)}
                        disabled={
                          isSubmitting ||
                          !formState.newSymbol ||
                          !formState.newWeight
                        }
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>

                    {formState.errorMessage && (
                      <p className="text-sm text-red-600">{formState.errorMessage}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}
    </div>
  );
};

TickerAllocator.displayName = 'TickerAllocator';

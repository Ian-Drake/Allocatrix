/**
 * AssetClassEditor Component
 *
 * Allows adding, removing, and updating asset class weights in a portfolio
 * Displays total weight sum and validation feedback
 */

import React, { useCallback, useMemo } from 'react';
import { usePortfolioStore } from '../../services/portfolio.store';

interface AssetClassEditorProps {
  availableAssetClasses: Array<{ id: string; name: string }>;
  onAddAssetClass?: (assetClassId: string, weight: number) => Promise<void>;
  onUpdateWeight?: (assetClassId: string, weight: number) => Promise<void>;
  onRemoveAssetClass?: (assetClassId: string) => Promise<void>;
  isSubmitting?: boolean;
  error?: string;
}

export const AssetClassEditor: React.FC<AssetClassEditorProps> = ({
  availableAssetClasses,
  onAddAssetClass,
  onUpdateWeight,
  onRemoveAssetClass,
  isSubmitting = false,
  error,
}) => {
  const currentPortfolio = usePortfolioStore((state) => state.currentPortfolio);
  const addAssetClass = usePortfolioStore((state) => state.addAssetClass);
  const updateAssetClassWeight = usePortfolioStore(
    (state) => state.updateAssetClassWeight
  );
  const removeAssetClass = usePortfolioStore((state) => state.removeAssetClass);

  const [newWeight, setNewWeight] = React.useState<string>('');
  const [selectedAssetClass, setSelectedAssetClass] = React.useState<string>('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Calculate total weight
  const totalWeight = useMemo(() => {
    if (!currentPortfolio?.assetClasses) return 0;
    return currentPortfolio.assetClasses.reduce(
      (sum, ac) => sum + ac.targetWeightPct,
      0
    );
  }, [currentPortfolio?.assetClasses]);

  const remainingWeight = useMemo(() => 100 - totalWeight, [totalWeight]);

  // Validate weight tolerance (±1%)
  const isWeightValid = useMemo(() => {
    return Math.abs(totalWeight - 100) <= 1;
  }, [totalWeight]);

  const isReadOnly = currentPortfolio?.status !== 'Draft';

  // Get available asset classes (not yet added)
  const availableToAdd = useMemo(() => {
    const addedIds = new Set(currentPortfolio?.assetClasses.map((ac) => ac.id));
    return availableAssetClasses.filter((ac) => !addedIds.has(ac.id));
  }, [availableAssetClasses, currentPortfolio?.assetClasses]);

  const handleAddAssetClass = useCallback(async () => {
    const localErrors: Record<string, string> = {};

    if (!selectedAssetClass) {
      localErrors.assetClass = 'Please select an asset class';
    }

    const weight = parseFloat(newWeight);
    if (!newWeight || isNaN(weight)) {
      localErrors.weight = 'Weight is required and must be a number';
    } else if (weight < 0 || weight > 100) {
      localErrors.weight = 'Weight must be between 0 and 100';
    }

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    try {
      const assetClass = availableAssetClasses.find(
        (ac) => ac.id === selectedAssetClass
      );
      if (!assetClass) {
        setErrors({ assetClass: 'Asset class not found' });
        return;
      }

      const newAssetClass = {
        id: selectedAssetClass,
        name: assetClass.name,
        targetWeightPct: weight,
      };

      addAssetClass(newAssetClass);

      if (onAddAssetClass) {
        await onAddAssetClass(selectedAssetClass, weight);
      }

      setSelectedAssetClass('');
      setNewWeight('');
      setErrors({});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add asset class';
      setErrors({ submit: message });
    }
  }, [
    selectedAssetClass,
    newWeight,
    availableAssetClasses,
    addAssetClass,
    onAddAssetClass,
  ]);

  const handleUpdateWeight = useCallback(
    async (assetClassId: string, weight: number) => {
      try {
        updateAssetClassWeight(assetClassId, weight);

        if (onUpdateWeight) {
          await onUpdateWeight(assetClassId, weight);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update weight';
        setErrors({ [assetClassId]: message });
      }
    },
    [updateAssetClassWeight, onUpdateWeight]
  );

  const handleRemoveAssetClass = useCallback(
    async (assetClassId: string) => {
      try {
        removeAssetClass(assetClassId);

        if (onRemoveAssetClass) {
          await onRemoveAssetClass(assetClassId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove asset class';
        setErrors({ [assetClassId]: message });
      }
    },
    [removeAssetClass, onRemoveAssetClass]
  );

  return (
    <div className="space-y-6">
      {/* Current Asset Classes */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Asset Classes</h3>
          <div className="text-sm text-gray-600">
            Total Weight:{' '}
            <span
              className={`font-semibold ${
                isWeightValid
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {totalWeight.toFixed(2)}%
            </span>
            <span className="text-gray-500 ml-2">(Target: 100% ±1%)</span>
          </div>
        </div>

        {currentPortfolio?.assetClasses && currentPortfolio.assetClasses.length > 0 ? (
          <div className="space-y-3">
            {currentPortfolio.assetClasses.map((ac) => (
              <div
                key={ac.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{ac.name}</h4>
                  <p className="text-sm text-gray-600">
                    {ac.tickers?.length || 0} ticker{ac.tickers?.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Weight Input */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={ac.targetWeightPct}
                      onChange={(e) =>
                        handleUpdateWeight(ac.id, parseFloat(e.target.value) || 0)
                      }
                      disabled={isReadOnly || isSubmitting}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <span className="text-sm font-medium text-gray-600">%</span>
                  </div>

                  {/* Remove Button */}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAssetClass(ac.id)}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-3 py-1 text-sm font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {errors[ac.id] && (
                  <p className="text-sm text-red-600 mt-1">{errors[ac.id]}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm p-4 bg-gray-50 rounded-lg">
            No asset classes added yet. Add one using the form below.
          </p>
        )}
      </div>

      {/* Add Asset Class Form */}
      {!isReadOnly && (
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
          <h4 className="font-medium text-gray-900">Add Asset Class</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Asset Class Selector */}
            <div>
              <label
                htmlFor="assetClass"
                className="block text-sm font-medium text-gray-700"
              >
                Asset Class
              </label>
              <select
                id="assetClass"
                value={selectedAssetClass}
                onChange={(e) => {
                  setSelectedAssetClass(e.target.value);
                  setErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.assetClass;
                    return updated;
                  });
                }}
                disabled={isSubmitting || availableToAdd.length === 0}
                className={`mt-1 block w-full rounded-md border ${
                  errors.assetClass
                    ? 'border-red-500'
                    : 'border-gray-300'
                } px-3 py-2 text-sm`}
              >
                <option value="">Select an asset class...</option>
                {availableToAdd.map((ac) => (
                  <option key={ac.id} value={ac.id}>
                    {ac.name}
                  </option>
                ))}
              </select>
              {errors.assetClass && (
                <p className="mt-1 text-sm text-red-600">{errors.assetClass}</p>
              )}
              {availableToAdd.length === 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  All available asset classes have been added
                </p>
              )}
            </div>

            {/* Weight Input */}
            <div>
              <label
                htmlFor="weight"
                className="block text-sm font-medium text-gray-700"
              >
                Target Weight (%)
              </label>
              <input
                id="weight"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={newWeight}
                onChange={(e) => {
                  setNewWeight(e.target.value);
                  setErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.weight;
                    return updated;
                  });
                }}
                disabled={isSubmitting}
                placeholder={`0 - ${remainingWeight.toFixed(2)}`}
                className={`mt-1 block w-full rounded-md border ${
                  errors.weight
                    ? 'border-red-500'
                    : 'border-gray-300'
                } px-3 py-2 text-sm`}
              />
              {errors.weight && (
                <p className="mt-1 text-sm text-red-600">{errors.weight}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Remaining: {remainingWeight.toFixed(2)}%
              </p>
            </div>

            {/* Add Button */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddAssetClass}
                disabled={
                  isSubmitting ||
                  !selectedAssetClass ||
                  !newWeight ||
                  availableToAdd.length === 0
                }
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          {errors.submit && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}
        </div>
      )}

      {/* Validation Status */}
      <div
        className={`p-4 rounded-lg ${
          isWeightValid
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}
      >
        <p
          className={`text-sm font-medium ${
            isWeightValid ? 'text-green-800' : 'text-yellow-800'
          }`}
        >
          {isWeightValid
            ? '✓ Asset class weights are valid (100% ±1%)'
            : `⚠ Asset class weights must sum to 100% ±1% (currently ${totalWeight.toFixed(2)}%)`}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}
    </div>
  );
};

AssetClassEditor.displayName = 'AssetClassEditor';

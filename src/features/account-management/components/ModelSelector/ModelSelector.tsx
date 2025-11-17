'use client';

import React, { useState } from 'react';
import type { ModelPortfolio } from '@/backend/types/index';

interface ModelSelectorProps {
  models: ModelPortfolio[];
  selectedModelId?: string | null;
  onSelect: (modelId: string) => void;
  onConfirm: (modelId: string) => void;
  isLoading?: boolean;
  error?: string | null;
  disabled?: boolean;
}

/**
 * ModelSelector Component
 * Allows user to select a valid model portfolio to assign to an account
 * 
 * User Story 3: Account Model Assignment
 * Features:
 * - Filter models by state (Valid, Locked, Draft)
 * - Display only Valid models for assignment
 * - Show model details and status
 * - Confirm selection action
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelect,
  onConfirm,
  isLoading = false,
  error = null,
  disabled = false,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  // Filter to only Valid models (can be assigned)
  const validModels = models.filter((m) => m.status === 'Valid');
  const lockedModels = models.filter((m) => m.status === 'Locked');
  const draftModels = models.filter((m) => m.status === 'Draft');

  const selectedModel = validModels.find((m) => m.id === selectedModelId);

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    setShowConfirm(false);
  };

  const handleConfirm = () => {
    if (selectedModelId) {
      onConfirm(selectedModelId);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-100 text-red-700 text-sm rounded" role="alert">
          {error}
        </div>
      )}

      {/* Available Models Section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Available Models (Valid)</h3>
        {validModels.length === 0 ? (
          <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
            No valid models available. Create and validate a model first.
          </p>
        ) : (
          <div className="space-y-2">
            {validModels.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => handleSelect(model.id)}
                disabled={disabled || isLoading}
                className={`
                  w-full p-3 text-left border-2 rounded-lg transition-all
                  ${
                    selectedModelId === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }
                  ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                aria-pressed={selectedModelId === model.id}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{model.name}</p>
                    {model.description && (
                      <p className="text-xs text-gray-600 mt-1">{model.description}</p>
                    )}
                  </div>
                  {selectedModelId === model.id && (
                    <span className="text-blue-600 font-bold">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Model Details */}
      {selectedModel && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-900">Selected Model</p>
          <p className="text-sm text-green-800 mt-1">{selectedModel.name}</p>
          {selectedModel.description && (
            <p className="text-xs text-green-700 mt-2">{selectedModel.description}</p>
          )}
        </div>
      )}

      {/* Confirmation Section */}
      {selectedModel && !showConfirm && (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={disabled || isLoading}
          className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Assigning...' : 'Confirm Assignment'}
        </button>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && selectedModel && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-semibold text-yellow-900 mb-3">
            Confirm assignment of &quot;{selectedModel.name}&quot;?
          </p>
          <p className="text-xs text-yellow-800 mb-4">
            This action will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Lock this model to prevent further editing</li>
              <li>Allow trading on this account with this model</li>
              <li>Be recorded in the audit log</li>
            </ul>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={disabled || isLoading}
              className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Confirming...' : 'Yes, Assign'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={disabled || isLoading}
              className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Locked Models Section */}
      {lockedModels.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Locked Models ({lockedModels.length})</p>
          <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
            {lockedModels.map((model) => (
              <div key={model.id} className="py-1">
                <p className="font-medium">{model.name}</p>
                <p className="text-gray-500">Locked (assigned to account)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft Models Section */}
      {draftModels.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Draft Models ({draftModels.length})</p>
          <p className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
            Draft models must be validated before assignment
          </p>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;

/**
 * PortfolioForm Component
 *
 * Form for creating and editing model portfolio details (name, description)
 * Handles portfolio metadata in Draft state
 */

import React, { useCallback } from 'react';
import { usePortfolioStore } from '../../services/portfolio.store';

interface PortfolioFormProps {
  onSubmit?: (name: string, description?: string) => Promise<void>;
  isSubmitting?: boolean;
  error?: string;
}

export const PortfolioForm: React.FC<PortfolioFormProps> = ({
  onSubmit,
  isSubmitting = false,
  error,
}) => {
  const currentPortfolio = usePortfolioStore((state) => state.currentPortfolio);
  const setCurrentPortfolio = usePortfolioStore(
    (state) => state.setCurrentPortfolio
  );
  const setIsDirty = usePortfolioStore((state) => state.setIsDirty);

  const [formErrors, setFormErrors] = React.useState<{
    name?: string;
    description?: string;
  }>({});

  const validateForm = useCallback((): boolean => {
    const errors: typeof formErrors = {};

    if (!currentPortfolio?.name || currentPortfolio.name.trim().length === 0) {
      errors.name = 'Portfolio name is required';
    } else if (currentPortfolio.name.length > 255) {
      errors.name = 'Portfolio name must be 255 characters or less';
    }

    if (
      currentPortfolio?.description &&
      currentPortfolio.description.length > 1000
    ) {
      errors.description = 'Description must be 1000 characters or less';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [currentPortfolio]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!currentPortfolio) return;

      setCurrentPortfolio({
        ...currentPortfolio,
        name: e.target.value,
      });
      setIsDirty(true);
      setFormErrors((prev) => ({ ...prev, name: undefined }));
    },
    [currentPortfolio, setCurrentPortfolio, setIsDirty]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!currentPortfolio) return;

      setCurrentPortfolio({
        ...currentPortfolio,
        description: e.target.value,
      });
      setIsDirty(true);
      setFormErrors((prev) => ({ ...prev, description: undefined }));
    },
    [currentPortfolio, setCurrentPortfolio, setIsDirty]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      if (!currentPortfolio) {
        setFormErrors({ name: 'Portfolio not loaded' });
        return;
      }

      try {
        if (onSubmit) {
          await onSubmit(currentPortfolio.name, currentPortfolio.description);
        }
        setIsDirty(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setFormErrors({ name: message });
      }
    },
    [validateForm, currentPortfolio, onSubmit, setIsDirty]
  );

  if (!currentPortfolio) {
    return <div className="text-gray-500">Loading portfolio...</div>;
  }

  const isReadOnly = currentPortfolio.status !== 'Draft';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name Field */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Portfolio Name
        </label>
        <input
          id="name"
          type="text"
          value={currentPortfolio.name}
          onChange={handleNameChange}
          disabled={isReadOnly || isSubmitting}
          maxLength={255}
          className={`mt-1 block w-full rounded-md shadow-sm px-3 py-2 border ${
            formErrors.name
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } ${isReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          placeholder="e.g., 60/40 Growth Portfolio"
        />
        {formErrors.name && (
          <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          {currentPortfolio.name.length}/255 characters
        </p>
      </div>

      {/* Description Field */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Description <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          id="description"
          value={currentPortfolio.description || ''}
          onChange={handleDescriptionChange}
          disabled={isReadOnly || isSubmitting}
          maxLength={1000}
          rows={4}
          className={`mt-1 block w-full rounded-md shadow-sm px-3 py-2 border ${
            formErrors.description
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } ${isReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          placeholder="Describe the portfolio strategy and allocation rationale..."
        />
        {formErrors.description && (
          <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          {(currentPortfolio.description || '').length}/1000 characters
        </p>
      </div>

      {/* Portfolio Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
              currentPortfolio.status === 'Draft'
                ? 'bg-yellow-100 text-yellow-800'
                : currentPortfolio.status === 'Valid'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
            }`}
          >
            {currentPortfolio.status}
          </span>
        </div>

        {isReadOnly && (
          <p className="text-sm text-gray-600">
            {currentPortfolio.status === 'Valid'
              ? 'Portfolio is valid and ready to assign to accounts'
              : 'Portfolio is locked and cannot be edited'}
          </p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            disabled={isSubmitting}
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !currentPortfolio.name.trim()}
            className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Portfolio'}
          </button>
        </div>
      )}

      {/* Metadata */}
      <div className="pt-4 border-t border-gray-200 text-xs text-gray-500">
        <p>Created: {currentPortfolio.createdAt.toLocaleString()}</p>
        <p>Updated: {currentPortfolio.updatedAt.toLocaleString()}</p>
      </div>
    </form>
  );
};

PortfolioForm.displayName = 'PortfolioForm';

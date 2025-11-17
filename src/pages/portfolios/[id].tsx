/**
 * Portfolio Edit Page
 *
 * Edits a portfolio: name, description, asset classes, and tickers
 * Combines PortfolioForm, AssetClassEditor, and TickerAllocator components
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PortfolioForm } from '@/features/portfolio-management/components/PortfolioForm/PortfolioForm';
import { AssetClassEditor } from '@/features/portfolio-management/components/AssetClassEditor/AssetClassEditor';
import { TickerAllocator } from '@/features/portfolio-management/components/TickerAllocator/TickerAllocator';
import { usePortfolioStore } from '@/features/portfolio-management/services/portfolio.store';

export default function PortfolioEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const { authenticated, loading: authLoading } = useAuth();

  const currentPortfolio = usePortfolioStore((state) => state.currentPortfolio);
  const setCurrentPortfolio = usePortfolioStore((state) => state.setCurrentPortfolio);
  const isDirty = usePortfolioStore((state) => state.isDirty);
  const setIsDirty = usePortfolioStore((state) => state.setIsDirty);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push('/login');
    }
  }, [authenticated, authLoading, router]);

  // Load portfolio
  useEffect(() => {
    if (!id || !authenticated) return;

    const loadPortfolio = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/portfolios/${id}`);
        if (!response.ok) {
          throw new Error('Failed to load portfolio');
        }
        const data = await response.json();
        setCurrentPortfolio(data.portfolio);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load portfolio';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadPortfolio();
  }, [id, authenticated, setCurrentPortfolio]);

  const handleSave = async () => {
    if (!currentPortfolio) return;

    try {
      setIsSubmitting(true);
      setSaveError(null);
      setSaveSuccess(false);

      const response = await fetch(`/api/portfolios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentPortfolio.name,
          description: currentPortfolio.description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save portfolio');
      }

      const data = await response.json();
      setCurrentPortfolio(data.portfolio);
      setIsDirty(false);
      setSaveSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save portfolio';
      setSaveError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidate = async () => {
    if (!currentPortfolio) return;

    try {
      setIsSubmitting(true);
      setSaveError(null);

      const response = await fetch(`/api/portfolios/${id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to validate portfolio');
      }

      const data = await response.json();
      setCurrentPortfolio(data.portfolio);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to validate portfolio';
      setSaveError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClone = async () => {
    if (!currentPortfolio) return;

    try {
      setIsSubmitting(true);
      setSaveError(null);

      const response = await fetch(`/api/portfolios/${id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${currentPortfolio.name} (Copy)`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to clone portfolio');
      }

      const data = await response.json();
      router.push(`/portfolios/${data.portfolio.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clone portfolio';
      setSaveError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/portfolios"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              ← Back to Portfolios
            </Link>
            <div className="flex gap-2">
              {currentPortfolio?.status === 'Valid' && (
                <button
                  onClick={handleClone}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50 font-medium"
                >
                  Clone Portfolio
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="text-gray-600">Loading portfolio...</div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          ) : currentPortfolio ? (
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {currentPortfolio.name}
              </h1>
              <p className="text-gray-600 mt-2">
                Status:{' '}
                <span
                  className={`font-semibold ${
                    currentPortfolio.status === 'Draft'
                      ? 'text-yellow-600'
                      : currentPortfolio.status === 'Valid'
                      ? 'text-blue-600'
                      : 'text-green-600'
                  }`}
                >
                  {currentPortfolio.status}
                </span>
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 rounded-md bg-green-50 p-4 border border-green-200">
            <div className="text-sm text-green-800">✓ Portfolio updated successfully</div>
          </div>
        )}

        {/* Error Message */}
        {saveError && (
          <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-800">{saveError}</div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading portfolio details...</div>
          </div>
        ) : !currentPortfolio ? (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-800">Portfolio not found</div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Portfolio Form */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Portfolio Details
              </h2>
              <PortfolioForm
                onSubmit={handleSave}
                isSubmitting={isSubmitting}
                error={saveError || undefined}
              />
            </div>

            {/* Asset Class Editor */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Asset Allocation
              </h2>
              <AssetClassEditor
                availableAssetClasses={[
                  { id: '1', name: 'U.S. Large Cap' },
                  { id: '2', name: 'U.S. Mid Cap' },
                  { id: '3', name: 'U.S. Small Cap' },
                  { id: '4', name: 'International Developed' },
                  { id: '5', name: 'Emerging Markets' },
                  { id: '6', name: 'Fixed Income' },
                  { id: '7', name: 'Real Estate' },
                  { id: '8', name: 'Commodities' },
                ]}
                isSubmitting={isSubmitting}
              />
            </div>

            {/* Ticker Allocator */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Ticker Allocations
              </h2>
              <TickerAllocator isSubmitting={isSubmitting} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6">
              {currentPortfolio.status === 'Draft' && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSubmitting || !isDirty}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {isSubmitting ? 'Validating...' : 'Validate & Lock'}
                  </button>
                </>
              )}
              {currentPortfolio.status === 'Valid' && (
                <button
                  onClick={handleClone}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {isSubmitting ? 'Cloning...' : 'Clone Portfolio'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

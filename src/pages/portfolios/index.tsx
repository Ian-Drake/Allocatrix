/**
 * Portfolio List Page
 *
 * Displays all portfolios with status, allows creating new portfolios
 * and navigating to portfolio editors
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface Portfolio {
  id: string;
  name: string;
  description: string;
  status: 'Draft' | 'Valid' | 'Locked';
  assetClassCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function PortfoliosPage() {
  const router = useRouter();
  const { authenticated, loading: authLoading } = useAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !authenticated) {
      router.push('/login');
    }
  }, [authenticated, authLoading, router]);

  // Fetch portfolios on mount
  useEffect(() => {
    if (!authenticated) return;

    const fetchPortfolios = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/portfolios');
        if (!response.ok) {
          throw new Error('Failed to fetch portfolios');
        }
        const data = await response.json();
        setPortfolios(data.portfolios || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch portfolios';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolios();
  }, [authenticated]);

  const handleCreatePortfolio = async () => {
    try {
      setIsCreating(true);
      setCreateError(null);
      const response = await fetch('/api/portfolios/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Portfolio',
          description: '',
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create portfolio');
      }
      const data = await response.json();
      router.push(`/portfolios/${data.portfolio.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create portfolio';
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-yellow-50 text-yellow-800 border border-yellow-200';
      case 'Valid':
        return 'bg-blue-50 text-blue-800 border border-blue-200';
      case 'Locked':
        return 'bg-green-50 text-green-800 border border-green-200';
      default:
        return 'bg-gray-50 text-gray-800 border border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Draft':
        return '✏️';
      case 'Valid':
        return '✓';
      case 'Locked':
        return '🔒';
      default:
        return '○';
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Model Portfolios</h1>
              <p className="text-gray-600 mt-2">
                Create and manage your investment model portfolios
              </p>
            </div>
            <button
              onClick={handleCreatePortfolio}
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isCreating ? 'Creating...' : '+ New Portfolio'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Error */}
        {createError && (
          <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-800">{createError}</div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading portfolios...</div>
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        ) : portfolios.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-600 mb-4">
              No portfolios yet. Create your first model portfolio to get started.
            </div>
            <button
              onClick={handleCreatePortfolio}
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isCreating ? 'Creating...' : 'Create Portfolio'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolios.map((portfolio) => (
              <Link
                key={portfolio.id}
                href={`/portfolios/${portfolio.id}`}
                className="block"
              >
                <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer h-full p-6 border border-gray-200 hover:border-blue-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {portfolio.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {portfolio.description || 'No description'}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        portfolio.status
                      )}`}
                    >
                      {getStatusIcon(portfolio.status)} {portfolio.status}
                    </span>
                  </div>

                  {/* Asset Class Count */}
                  <div className="mb-4 pt-4 border-t border-gray-200">
                    <div className="text-sm">
                      <span className="text-gray-600">Asset Classes: </span>
                      <span className="font-semibold text-gray-900">
                        {portfolio.assetClassCount}
                      </span>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      Created: {new Date(portfolio.createdAt).toLocaleDateString()}
                    </div>
                    {portfolio.updatedAt && (
                      <div>
                        Updated: {new Date(portfolio.updatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Edit Link */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                      Edit Portfolio →
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

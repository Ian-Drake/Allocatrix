import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAccountStore } from '@/features/account-management/services/account.store';
import ModelSelector from '@/features/account-management/components/ModelSelector/ModelSelector';
import type { AccountDetail, ModelPortfolio } from '@/backend/types/index';

/**
 * Account Detail Page
 * Displays account details and handles model assignment
 * 
 * User Story 3: Account Model Assignment
 * Acceptance Scenarios 2-5: Assign/reassign models
 * 
 * URL: /accounts/[id]
 * Query Params:
 * - action=assign-model (shows model selector)
 */
export default function AccountDetailPage() {
  const router = useRouter();
  const { id: accountId, action } = router.query;
  const showAssignModal = action === 'assign-model';
  const { updateAccount } = useAccountStore();

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [models, setModels] = useState<ModelPortfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Fetch account details
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const response = await fetch(`/api/accounts/${accountId}`);
        if (!response.ok) throw new Error(`Failed to fetch account: ${response.statusText}`);
        const data = (await response.json()) as AccountDetail;
        setAccount(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load account');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccount();
  }, [accountId]);

  // Fetch models for selector
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/portfolios/list');
        if (!response.ok) throw new Error('Failed to fetch portfolios');
        const data = (await response.json()) as ModelPortfolio[];
        setModels(data);
      } catch (err) {
        console.error('Failed to load models:', err);
      }
    };

    if (showAssignModal) {
      fetchModels();
    }
  }, [showAssignModal]);

  const handleAssignModel = async (modelId: string) => {
    setIsAssigning(true);
    setAssignError(null);

    try {
      const response = await fetch(`/api/accounts/${accountId}/assign-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelPortfolioId: modelId }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message: string };
        throw new Error(errorData.message || 'Failed to assign model');
      }

      const updatedAccount = (await response.json()) as AccountDetail;
      setAccount(updatedAccount);
      updateAccount(updatedAccount);

      // Show success message and close modal
      router.push(`/accounts/${accountId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setAssignError(message);
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin text-blue-600 text-3xl">⏳</div>
          <p className="mt-4 text-gray-600">Loading account details...</p>
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-100 text-red-700 p-4 rounded" role="alert">
            {error || 'Account not found'}
          </div>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            ← Back to Accounts
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{account.nickname}</h1>
          <p className="text-gray-600 mt-1">Account ID: {account.id}</p>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Account Type</p>
              <p className="font-medium text-gray-900">Schwab Brokerage</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="font-medium text-gray-900">
                {new Date(account.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="font-medium text-gray-900">
                ${account.totalAccountValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Available Cash</p>
              <p className="font-medium text-gray-900">
                ${account.availableCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Model Assignment Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Portfolio Assignment</h2>

          {account.assignedModelPortfolioId ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-600 font-medium">Currently Assigned</p>
              <p className="text-lg font-semibold text-green-900 mt-2">
                {account.assignedModelPortfolioName}
              </p>
              <p className="text-xs text-green-700 mt-3">
                This model is locked and cannot be edited. Reassign to switch to a different model.
              </p>
              <button
                onClick={() => router.push(`/accounts/${account.id}?action=assign-model`)}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium text-sm"
              >
                Change Model
              </button>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-600 font-medium">No Model Assigned</p>
              <p className="text-gray-700 mt-2">
                Assign a valid model portfolio to this account to begin trading.
              </p>
              <button
                onClick={() => router.push(`/accounts/${account.id}?action=assign-model`)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
              >
                Assign Model
              </button>
            </div>
          )}
        </div>

        {/* Model Selector Modal */}
        {showAssignModal && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-blue-300">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Model Portfolio</h3>
            <ModelSelector
              models={models}
              selectedModelId={account.assignedModelPortfolioId}
              onSelect={() => {}} // Selection handled internally
              onConfirm={handleAssignModel}
              isLoading={isAssigning}
              error={assignError}
              disabled={isAssigning}
            />
          </div>
        )}

        {/* Positions Section */}
        {account.positions && account.positions.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Holdings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-semibold text-gray-900">Symbol</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-900">Quantity</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-900">Price</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-900">Value</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-900">%</th>
                  </tr>
                </thead>
                <tbody>
                  {account.positions.map((position) => (
                    <tr key={position.symbol} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium text-gray-900">{position.symbol}</td>
                      <td className="text-right py-2 px-2 text-gray-700">
                        {position.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2 px-2 text-gray-700">
                        ${position.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2 px-2 text-gray-700">
                        ${position.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-2 px-2 font-medium text-gray-900">
                        {position.currentAllocationPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

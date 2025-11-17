import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AccountCard from '@/features/account-management/components/AccountCard/AccountCard';
import { useAccountStore } from '@/features/account-management/services/account.store';
import type { Account } from '@/backend/types/index';

/**
 * Accounts List Page
 * Displays all linked Schwab accounts with model assignments
 * 
 * User Story 3: Account Model Assignment
 * Acceptance Scenario 1: View linked accounts
 * 
 * Features:
 * - Fetch and display all linked accounts
 * - Show model assignment status
 * - Navigate to account detail page
 * - Quick-assign model button
 */
export default function AccountsListPage() {
  const router = useRouter();
  const { accounts, setAccounts, setSelectedAccountId, setIsLoading, setError, isLoading, error } = useAccountStore();
  const [localError, setLocalError] = useState<string | null>(null);

  // Fetch accounts on page load
  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoading(true);
      setLocalError(null);
      try {
        const response = await fetch('/api/accounts/list');
        if (!response.ok) {
          throw new Error(`Failed to fetch accounts: ${response.statusText}`);
        }
        const data = (await response.json()) as Account[];
        setAccounts(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        setLocalError(message);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccounts();
  }, [setAccounts, setError, setIsLoading]);

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    router.push(`/accounts/${accountId}`);
  };

  const handleAssignModel = (accountId: string) => {
    setSelectedAccountId(accountId);
    router.push(`/accounts/${accountId}?action=assign-model`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Linked Accounts</h1>
            <Link
              href="/portfolios"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Back to Portfolios
            </Link>
          </div>
          <p className="text-gray-600">
            View and manage your linked Schwab accounts. Assign model portfolios to begin trading.
          </p>
        </div>

        {/* Error Message */}
        {(localError || error) && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 text-sm rounded" role="alert">
            <p className="font-semibold">Error</p>
            <p>{localError || error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <div className="inline-block animate-spin text-blue-600">
                ⏳
              </div>
              <p className="mt-2 text-gray-600">Loading accounts...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && accounts.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No accounts linked yet.</p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              Link Schwab Account
            </Link>
          </div>
        )}

        {/* Accounts Grid */}
        {!isLoading && accounts.length > 0 && (
          <div>
            <div className="grid gap-4 md:grid-cols-2">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onSelect={handleSelectAccount}
                  onAssignModel={handleAssignModel}
                />
              ))}
            </div>

            {/* Summary Stats */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-600 text-sm font-medium">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{accounts.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-600 text-sm font-medium">With Models</p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {accounts.filter((a) => a.assignedModelPortfolioId).length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <p className="text-gray-600 text-sm font-medium">Without Models</p>
                <p className="text-2xl font-bold text-orange-600 mt-2">
                  {accounts.filter((a) => !a.assignedModelPortfolioId).length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

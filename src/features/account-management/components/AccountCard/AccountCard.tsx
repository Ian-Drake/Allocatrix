'use client';

import React from 'react';
import type { Account } from '@/backend/types/index';

interface AccountCardProps {
  account: Account;
  isSelected?: boolean;
  onSelect?: (accountId: string) => void;
  onAssignModel?: (accountId: string) => void;
}

/**
 * AccountCard Component
 * Displays a single account with:
 * - Account nickname
 * - Assigned model portfolio (if any)
 * - Last synced timestamp
 * - Actions: Select, Assign Model
 * 
 * User Story 3: Account Model Assignment
 * UI: Display account and model assignment state
 */
export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  isSelected = false,
  onSelect,
  onAssignModel,
}) => {
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div
      className={`
        p-4 border rounded-lg shadow-sm transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
      `}
      role="article"
      aria-label={`Account: ${account.nickname}`}
    >
      {/* Header: Nickname and Click Handler */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{account.nickname}</h3>
          <p className="text-xs text-gray-500">ID: {account.id.slice(0, 8)}...</p>
        </div>
        {isSelected && (
          <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
            Selected
          </span>
        )}
      </div>

      {/* Model Assignment Section */}
      <div className="mb-3 p-2 bg-gray-50 rounded">
        {account.assignedModelPortfolioId ? (
          <div>
            <p className="text-xs text-gray-600 font-medium">Assigned Model</p>
            <p className="text-sm font-semibold text-green-700">{account.assignedModelPortfolioName}</p>
            <p className="text-xs text-gray-500 mt-1">Model is locked (cannot edit)</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-600 font-medium">No Model Assigned</p>
            <p className="text-sm text-gray-700">Assign a model to begin trading</p>
          </div>
        )}
      </div>

      {/* Sync Status */}
      <div className="mb-3 text-xs text-gray-600">
        <span>Last synced: </span>
        <span className="font-medium">{formatDate(account.lastSyncedAt)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSelect?.(account.id)}
          className={`
            flex-1 px-3 py-2 text-sm font-medium rounded
            ${
              isSelected
                ? 'bg-blue-500 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }
            transition-colors
          `}
          aria-label={`Select account ${account.nickname}`}
        >
          {isSelected ? '✓ Selected' : 'Select'}
        </button>

        {!account.assignedModelPortfolioId && (
          <button
            type="button"
            onClick={() => onAssignModel?.(account.id)}
            className="flex-1 px-3 py-2 text-sm font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            aria-label={`Assign model to account ${account.nickname}`}
          >
            Assign Model
          </button>
        )}

        {account.assignedModelPortfolioId && (
          <button
            type="button"
            onClick={() => onAssignModel?.(account.id)}
            className="flex-1 px-3 py-2 text-sm font-medium bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
            aria-label={`Change model assignment for account ${account.nickname}`}
          >
            Change Model
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountCard;

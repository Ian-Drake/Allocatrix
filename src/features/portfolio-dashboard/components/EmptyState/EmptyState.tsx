import React from 'react';

interface EmptyPortfolioProps {
  onCreateAccount?: () => void;
}

/**
 * EmptyPortfolioState component displays when user has no accounts
 */
export const EmptyPortfolioState: React.FC<EmptyPortfolioProps> = ({
  onCreateAccount,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <div className="text-blue-600 mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          No Accounts Yet
        </h1>
        <p className="text-gray-600 mb-6">
          You don&apos;t have any linked accounts. Connect an account to get started with portfolio tracking.
        </p>
        {onCreateAccount && (
          <button
            onClick={onCreateAccount}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Link Account
          </button>
        )}
      </div>
    </div>
  );
};

interface EmptyGridProps {
  message?: string;
}

/**
 * EmptyGridState component displays when no grid data is available
 */
export const EmptyGridState: React.FC<EmptyGridProps> = ({
  message = 'No data available',
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 text-center">
      <svg
        className="w-12 h-12 mx-auto text-gray-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <p className="text-gray-500">{message}</p>
    </div>
  );
};

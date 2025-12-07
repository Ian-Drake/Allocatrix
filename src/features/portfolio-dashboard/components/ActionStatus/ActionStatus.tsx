import React from 'react';

interface ActionInProgressProps {
  actionLabel: string;
  accountsCount: number;
}

/**
 * ActionInProgress component shows progress indicator while bulk action is executing
 */
export const ActionInProgress: React.FC<ActionInProgressProps> = ({
  actionLabel,
  accountsCount,
}) => {
  return (
    <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="animate-spin">
        <svg
          className="w-5 h-5 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">
          {actionLabel} {accountsCount} {accountsCount === 1 ? 'account' : 'accounts'}...
        </p>
        <p className="text-xs text-blue-600">This may take a few moments</p>
      </div>
    </div>
  );
};

interface ActionResult {
  success: boolean;
  accountId: string;
  accountName: string;
  error?: string;
}

interface BulkActionResultsProps {
  results: ActionResult[];
  actionLabel: string;
  onDismiss?: () => void;
}

/**
 * BulkActionResults component displays results of bulk action execution
 * Shows succeeded/failed counts and detailed results
 */
export const BulkActionResults: React.FC<BulkActionResultsProps> = ({
  results,
  actionLabel,
  onDismiss,
}) => {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const hasFailures = failed.length > 0;

  const bgColor = hasFailures
    ? 'bg-yellow-50 border border-yellow-200'
    : 'bg-green-50 border border-green-200';

  const textColor = hasFailures ? 'text-yellow-900' : 'text-green-900';
  const badgeColor = hasFailures ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';

  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className={`font-semibold ${textColor} mb-1`}>
            {actionLabel} Complete
          </h3>
          <div className="flex gap-4">
            <span className={`px-2 py-1 rounded text-xs font-medium ${badgeColor}`}>
              {succeeded.length} succeeded
            </span>
            {failed.length > 0 && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                {failed.length} failed
              </span>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`text-${hasFailures ? 'yellow' : 'green'}-600 hover:text-${hasFailures ? 'yellow' : 'green'}-700`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {failed.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-yellow-200 pt-4">
          <p className="text-sm font-medium text-yellow-900">Failed accounts:</p>
          {failed.map((result) => (
            <div
              key={result.accountId}
              className="text-sm text-yellow-800 bg-white bg-opacity-50 p-2 rounded"
            >
              <p className="font-medium">{result.accountName}</p>
              {result.error && <p className="text-xs text-yellow-700">{result.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface MarketClosedWarningProps {
  onDismiss?: () => void;
}

/**
 * MarketClosedWarning component alerts user when market is closed
 * Explains potential risks of trading outside market hours
 */
export const MarketClosedWarning: React.FC<MarketClosedWarningProps> = ({
  onDismiss,
}) => {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4v2m0 4v2M8.228 10c-2.485 0-4.726 1.492-5.732 3.635m0 0h-.004c-.176.349-.326.743-.326 1.175 0 1.666 1.343 3 3 3h.002M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
          />
        </svg>
        <div className="flex-1">
          <h3 className="font-semibold text-orange-900 mb-1">Markets Closed</h3>
          <p className="text-sm text-orange-800 mb-2">
            Financial markets are currently closed. Trades placed now may execute at unfavorable prices with wider spreads when markets reopen.
          </p>
          <p className="text-xs text-orange-700">
            Please ensure you understand the risks before proceeding with your action.
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-orange-600 hover:text-orange-700 flex-shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

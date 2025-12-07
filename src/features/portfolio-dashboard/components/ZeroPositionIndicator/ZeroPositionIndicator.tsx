import React from 'react';

interface ZeroPositionIndicatorProps {
  accountName: string;
}

/**
 * ZeroPositionIndicator shows in place of performance data when account has no positions
 */
export const ZeroPositionIndicator: React.FC<ZeroPositionIndicatorProps> = () => {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100">
        <svg
          className="w-3 h-3 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <span className="text-sm text-gray-500">No positions</span>
    </div>
  );
};

interface ZeroPositionRowProps {
  accountName: string;
  className?: string;
}

/**
 * ZeroPositionRow displays message for account grid row with no positions
 */
export const ZeroPositionRow: React.FC<ZeroPositionRowProps> = ({
  accountName,
  className = '',
}) => {
  return (
    <tr className={`bg-gray-50 ${className}`}>
      <td colSpan={7} className="px-4 py-3">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <span>{accountName} has no positions</span>
        </div>
      </td>
    </tr>
  );
};

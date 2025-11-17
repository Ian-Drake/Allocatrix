import React, { useMemo } from 'react';
import { Position } from '../../hooks/useAccountPositions';
import { DriftAnalysis } from '../../hooks/useAccountDrift';

export interface PositionsTableProps {
  positions: Position[];
  driftData?: DriftAnalysis[];
  totalAccountValue: number;
  availableCash: number;
  isLoading: boolean;
  cacheAge?: number | null;
  isCached?: boolean;
  onRefresh: () => void;
  highDriftOnly?: boolean; // Show only positions with high drift (>5%)
}

/**
 * PositionsTable Component
 * Displays account positions with drift highlighting
 * Features:
 * - Shows symbol, quantity, price, value, allocation%
 * - Highlights positions with >5% drift in red/orange
 * - Shows drift status (aligned/overweight/underweight)
 * - Cache info and manual refresh button
 * - Optional filtering for high-drift positions only
 */
export function PositionsTable({
  positions,
  driftData = [],
  totalAccountValue,
  availableCash,
  isLoading,
  cacheAge,
  isCached,
  onRefresh,
  highDriftOnly = false,
}: PositionsTableProps): React.ReactElement {
  // Create a map of drift data by symbol for quick lookup
  const driftMap = useMemo(() => {
    return driftData.reduce(
      (acc, drift) => {
        acc[drift.symbol] = drift;
        return acc;
      },
      {} as Record<string, DriftAnalysis>,
    );
  }, [driftData]);

  // Filter positions if showing only high drift
  const displayPositions = useMemo(() => {
    if (!highDriftOnly) return positions;
    return positions.filter((pos) => {
      const drift = driftMap[pos.symbol];
      return drift && Math.abs(drift.driftPct) > 5;
    });
  }, [positions, highDriftOnly, driftMap]);

  // Get drift status styling
  const getDriftStyling = (symbol: string) => {
    const drift = driftMap[symbol];
    if (!drift) return { className: '', color: 'gray' };

    const absDrift = Math.abs(drift.driftPct);
    if (absDrift > 5) {
      // High drift - use more intense colors
      if (drift.status === 'overweight') {
        return { className: 'bg-red-100', color: 'red', label: `+${drift.driftPct.toFixed(2)}%` };
      } else if (drift.status === 'underweight') {
        return { className: 'bg-orange-100', color: 'orange', label: `${drift.driftPct.toFixed(2)}%` };
      }
    } else if (absDrift > 2) {
      // Medium drift - use lighter colors
      if (drift.status === 'overweight') {
        return { className: 'bg-red-50', color: 'light-red', label: `+${drift.driftPct.toFixed(2)}%` };
      } else if (drift.status === 'underweight') {
        return { className: 'bg-orange-50', color: 'light-orange', label: `${drift.driftPct.toFixed(2)}%` };
      }
    }

    return { className: '', color: 'gray', label: drift.driftPct.toFixed(2) + '%' };
  };

  if (isLoading) {
    return (
      <div className="positions-table loading">
        <p>Loading positions...</p>
      </div>
    );
  }

  if (displayPositions.length === 0) {
    return (
      <div className="positions-table empty">
        <p>No positions found</p>
        <button onClick={onRefresh} disabled={isLoading}>
          Refresh Positions
        </button>
      </div>
    );
  }

  return (
    <div className="positions-table-container">
      <div className="positions-header">
        <div className="header-info">
          <h2>Account Positions</h2>
          <div className="cache-info">
            {isCached && cacheAge !== null && (
              <span className="cache-age">
                {cacheAge === 0 ? 'Just now' : cacheAge === 1 ? '1 minute ago' : `${cacheAge} minutes ago`}
              </span>
            )}
            <button onClick={onRefresh} disabled={isLoading} className="refresh-btn">
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="header-summary">
          <div className="summary-item">
            <span className="label">Total Account Value:</span>
            <span className="value">${totalAccountValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="summary-item">
            <span className="label">Available Cash:</span>
            <span className="value">${availableCash.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <table className="positions-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Display Name</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Value</th>
            <th>Allocation %</th>
            <th>Target %</th>
            <th>Drift</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {displayPositions.map((position) => {
            const drift = driftMap[position.symbol];
            const styling = getDriftStyling(position.symbol);

            return (
              <tr key={position.symbol} className={styling.className}>
                <td className="symbol">{position.symbol}</td>
                <td className="display-name">{position.displayName || '-'}</td>
                <td className="quantity">{position.quantity.toFixed(2)}</td>
                <td className="price">${position.currentPrice.toFixed(2)}</td>
                <td className="value">${position.currentValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                <td className="allocation">{position.currentAllocationPct.toFixed(2)}%</td>
                <td className="target">
                  {drift ? `${drift.targetAllocationPct.toFixed(2)}%` : '-'}
                </td>
                <td className="drift">
                  {drift ? (
                    <span className={`drift-value drift-${styling.color}`}>
                      {styling.label}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="status">
                  {drift ? (
                    <span className={`status-badge status-${drift.status}`}>
                      {drift.status.charAt(0).toUpperCase() + drift.status.slice(1)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <style>{`
        .positions-table-container {
          width: 100%;
          margin: 1rem 0;
        }

        .positions-header {
          margin-bottom: 1.5rem;
        }

        .header-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .header-info h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .cache-info {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .cache-age {
          font-size: 0.875rem;
          color: #666;
        }

        .refresh-btn {
          padding: 0.5rem 1rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .refresh-btn:hover {
          background-color: #2563eb;
        }

        .refresh-btn:disabled {
          background-color: #d1d5db;
          cursor: not-allowed;
        }

        .header-summary {
          display: flex;
          gap: 2rem;
          padding: 1rem;
          background-color: #f9fafb;
          border-radius: 0.375rem;
          border: 1px solid #e5e7eb;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
        }

        .summary-item .label {
          font-size: 0.875rem;
          color: #666;
          margin-bottom: 0.25rem;
        }

        .summary-item .value {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .positions-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
          overflow: hidden;
        }

        .positions-table thead {
          background-color: #f3f4f6;
          border-bottom: 2px solid #e5e7eb;
        }

        .positions-table th {
          padding: 0.75rem;
          text-align: left;
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          white-space: nowrap;
        }

        .positions-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.875rem;
        }

        .positions-table tbody tr:hover {
          background-color: #f9fafb;
        }

        .symbol {
          font-weight: 600;
          color: #1f2937;
        }

        .quantity,
        .price,
        .value,
        .allocation,
        .target,
        .drift {
          text-align: right;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .drift-value {
          font-weight: 600;
        }

        .drift-red {
          color: #dc2626;
        }

        .drift-orange {
          color: #ea580c;
        }

        .drift-light-red {
          color: #991b1b;
        }

        .drift-light-orange {
          color: #b45309;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-aligned {
          background-color: #d1fae5;
          color: #065f46;
        }

        .status-overweight {
          background-color: #fee2e2;
          color: #7f1d1d;
        }

        .status-underweight {
          background-color: #fef3c7;
          color: #78350f;
        }

        .bg-red-100 {
          background-color: #fee2e2;
        }

        .bg-orange-100 {
          background-color: #ffedd5;
        }

        .bg-red-50 {
          background-color: #fef2f2;
        }

        .bg-orange-50 {
          background-color: #fffbeb;
        }

        .positions-table.loading,
        .positions-table.empty {
          padding: 2rem;
          text-align: center;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 0.375rem;
        }

        .positions-table.empty button {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .positions-table.empty button:hover {
          background-color: #2563eb;
        }

        @media (max-width: 768px) {
          .positions-table {
            font-size: 0.75rem;
          }

          .positions-table th,
          .positions-table td {
            padding: 0.5rem 0.25rem;
          }

          .header-summary {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}

export default PositionsTable;

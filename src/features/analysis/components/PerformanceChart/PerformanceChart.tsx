import React, { useState } from 'react';
import { BacktestResult } from '../../hooks/useBacktest';

/**
 * Performance chart props
 */
export interface PerformanceChartProps {
  results: BacktestResult[];
  title?: string;
}

/**
 * Chart tab options
 */
type ChartTab = 'returns' | 'drawdown' | 'metrics';

/**
 * PerformanceChart Component
 * 
 * Visualizes backtest results with multiple views:
 * - Portfolio value over time (line chart)
 * - Drawdown chart (showing decline from peak)
 * - Performance metrics comparison table
 * - Multiple backtests comparison (overlay different rebalance frequencies)
 * 
 * Note: This implementation uses simple SVG charts for demonstration.
 * In production, consider using a charting library like recharts, victory, or chart.js
 * 
 * Usage:
 * ```tsx
 * <PerformanceChart
 *   results={[monthlyBacktest, quarterlyBacktest, annualBacktest]}
 *   title="Portfolio Performance Comparison"
 * />
 * ```
 */
export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  results,
  title = 'Backtest Results',
}) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('returns');

  if (results.length === 0) {
    return (
      <div className="performance-chart">
        <div className="empty-state">
          <p>No backtest results to display</p>
          <p className="empty-hint">Run a backtest to see performance analysis</p>
        </div>
      </div>
    );
  }

  /**
   * Format percentage
   */
  const formatPercent = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  /**
   * Format currency
   */
  const formatCurrency = (value: number): string => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  /**
   * Get color for chart line
   */
  const getChartColor = (index: number): string => {
    const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];
    return colors[index % colors.length];
  };

  /**
   * Render metrics comparison table
   */
  const renderMetricsTable = () => {
    return (
      <div className="metrics-table">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              {results.map((result, idx) => (
                <th key={idx}>
                  {result.rebalanceFrequency}
                  <br />
                  <span className="metric-subtitle">
                    {result.startDate} - {result.endDate}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Total Return</strong></td>
              {results.map((result, idx) => (
                <td key={idx} className={result.totalReturn >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(result.totalReturn)}
                </td>
              ))}
            </tr>
            <tr>
              <td><strong>Annualized Return</strong></td>
              {results.map((result, idx) => (
                <td key={idx} className={result.annualizedReturn >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(result.annualizedReturn)}
                </td>
              ))}
            </tr>
            <tr>
              <td><strong>Volatility</strong></td>
              {results.map((result, idx) => (
                <td key={idx}>
                  {formatPercent(result.volatility)}
                </td>
              ))}
            </tr>
            <tr>
              <td><strong>Sharpe Ratio</strong></td>
              {results.map((result, idx) => (
                <td key={idx} className={result.sharpeRatio >= 1 ? 'positive' : ''}>
                  {result.sharpeRatio.toFixed(2)}
                </td>
              ))}
            </tr>
            <tr>
              <td><strong>Max Drawdown</strong></td>
              {results.map((result, idx) => (
                <td key={idx} className="negative">
                  {formatPercent(result.maxDrawdown)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  /**
   * Render simple line chart for portfolio value
   */
  const renderReturnsChart = () => {
    const chartWidth = 800;
    const chartHeight = 400;
    const padding = { top: 20, right: 120, bottom: 60, left: 60 };

    // Get all unique dates across results
    const allDates = Array.from(
      new Set(results.flatMap((r) => r.monthlyReturns.map((m) => m.date))),
    ).sort();

    // Find min/max values
    const allValues = results.flatMap((r) => r.monthlyReturns.map((m) => m.portfolioValue));
    const minValue = Math.min(...allValues) * 0.95;
    const maxValue = Math.max(...allValues) * 1.05;

    const xScale = (dateStr: string) => {
      const index = allDates.indexOf(dateStr);
      return padding.left + (index / (allDates.length - 1)) * (chartWidth - padding.left - padding.right);
    };

    const yScale = (value: number) => {
      return chartHeight - padding.bottom - ((value - minValue) / (maxValue - minValue)) * (chartHeight - padding.top - padding.bottom);
    };

    return (
      <div className="chart-container">
        <svg width={chartWidth} height={chartHeight}>
          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={chartHeight - padding.bottom}
            stroke="#ccc"
          />
          {/* X-axis */}
          <line
            x1={padding.left}
            y1={chartHeight - padding.bottom}
            x2={chartWidth - padding.right}
            y2={chartHeight - padding.bottom}
            stroke="#ccc"
          />

          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const value = minValue + (maxValue - minValue) * pct;
            const y = yScale(value);
            return (
              <g key={pct}>
                <line x1={padding.left - 5} y1={y} x2={padding.left} y2={y} stroke="#ccc" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                  {formatCurrency(value)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels (show every Nth date) */}
          {allDates.filter((_, i) => i % Math.ceil(allDates.length / 8) === 0).map((date) => {
            const x = xScale(date);
            return (
              <text
                key={date}
                x={x}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                fontSize="12"
                fill="#666"
              >
                {new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              </text>
            );
          })}

          {/* Plot lines for each result */}
          {results.map((result, idx) => {
            const points = result.monthlyReturns.map((m) => ({
              x: xScale(m.date),
              y: yScale(m.portfolioValue),
            }));

            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            return (
              <g key={idx}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={getChartColor(idx)}
                  strokeWidth="2"
                />
                {/* Legend */}
                <g transform={`translate(${chartWidth - padding.right + 10}, ${30 + idx * 25})`}>
                  <line x1="0" y1="0" x2="20" y2="0" stroke={getChartColor(idx)} strokeWidth="2" />
                  <text x="25" y="4" fontSize="12" fill="#333">
                    {result.rebalanceFrequency}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  /**
   * Render drawdown chart
   */
  const renderDrawdownChart = () => {
    const chartWidth = 800;
    const chartHeight = 400;
    const padding = { top: 20, right: 120, bottom: 60, left: 60 };

    const allDates = Array.from(
      new Set(results.flatMap((r) => r.drawdownChart.map((d) => d.date))),
    ).sort();

    const allDrawdowns = results.flatMap((r) => r.drawdownChart.map((d) => d.drawdownPct));
    const minDrawdown = Math.min(...allDrawdowns, 0) * 1.1;

    const xScale = (dateStr: string) => {
      const index = allDates.indexOf(dateStr);
      return padding.left + (index / (allDates.length - 1)) * (chartWidth - padding.left - padding.right);
    };

    const yScale = (value: number) => {
      return chartHeight - padding.bottom - ((value - minDrawdown) / (0 - minDrawdown)) * (chartHeight - padding.top - padding.bottom);
    };

    return (
      <div className="chart-container">
        <svg width={chartWidth} height={chartHeight}>
          {/* Axes */}
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} stroke="#ccc" />
          <line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} stroke="#ccc" />

          {/* Zero line */}
          <line
            x1={padding.left}
            y1={yScale(0)}
            x2={chartWidth - padding.right}
            y2={yScale(0)}
            stroke="#999"
            strokeDasharray="4 4"
          />

          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const value = minDrawdown * pct;
            const y = yScale(value);
            return (
              <g key={pct}>
                <line x1={padding.left - 5} y1={y} x2={padding.left} y2={y} stroke="#ccc" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                  {formatPercent(value)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {allDates.filter((_, i) => i % Math.ceil(allDates.length / 8) === 0).map((date) => (
            <text
              key={date}
              x={xScale(date)}
              y={chartHeight - padding.bottom + 20}
              textAnchor="middle"
              fontSize="12"
              fill="#666"
            >
              {new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            </text>
          ))}

          {/* Plot drawdown lines */}
          {results.map((result, idx) => {
            const points = result.drawdownChart.map((d) => ({
              x: xScale(d.date),
              y: yScale(d.drawdownPct),
            }));

            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            return (
              <path
                key={idx}
                d={pathData}
                fill="none"
                stroke={getChartColor(idx)}
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="performance-chart">
      <div className="chart-header">
        <h3>{title}</h3>
      </div>

      {/* Tabs */}
      <div className="chart-tabs">
        <button
          className={`tab ${activeTab === 'returns' ? 'active' : ''}`}
          onClick={() => setActiveTab('returns')}
        >
          Portfolio Value
        </button>
        <button
          className={`tab ${activeTab === 'drawdown' ? 'active' : ''}`}
          onClick={() => setActiveTab('drawdown')}
        >
          Drawdown
        </button>
        <button
          className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
      </div>

      {/* Chart Content */}
      <div className="chart-content">
        {activeTab === 'returns' && renderReturnsChart()}
        {activeTab === 'drawdown' && renderDrawdownChart()}
        {activeTab === 'metrics' && renderMetricsTable()}
      </div>

      <style jsx>{`
        .performance-chart {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 24px;
        }

        .chart-header h3 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
        }

        .chart-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid #ddd;
          margin-bottom: 24px;
        }

        .tab {
          padding: 8px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 14px;
          color: #666;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #333;
        }

        .tab.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }

        .chart-content {
          min-height: 400px;
        }

        .chart-container {
          overflow-x: auto;
        }

        .metrics-table {
          overflow-x: auto;
        }

        .metrics-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .metrics-table th,
        .metrics-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .metrics-table th {
          background: #f8f9fa;
          font-weight: 600;
          font-size: 14px;
        }

        .metric-subtitle {
          display: block;
          font-size: 11px;
          font-weight: 400;
          color: #666;
          margin-top: 4px;
        }

        .metrics-table td {
          font-size: 14px;
        }

        .metrics-table td.positive {
          color: #28a745;
        }

        .metrics-table td.negative {
          color: #dc3545;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .empty-state p {
          margin: 8px 0;
        }

        .empty-hint {
          font-size: 14px;
          color: #999;
        }

        @media (max-width: 900px) {
          .chart-container svg {
            width: 100%;
            height: auto;
          }
        }
      `}</style>
    </div>
  );
};

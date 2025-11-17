import React, { useState, useEffect } from 'react';
import { RebalanceFrequency } from '../../hooks/useBacktest';

/**
 * Backtest form props
 */
export interface BacktestFormProps {
  modelPortfolioId?: string;
  modelPortfolioName?: string;
  onSubmit: (params: {
    modelPortfolioId: string;
    startDate: string;
    endDate: string;
    rebalanceFrequency: RebalanceFrequency;
  }) => void;
  loading?: boolean;
}

/**
 * BacktestForm Component
 * 
 * Form for configuring and running a backtest:
 * - Date range selection (start/end dates)
 * - Rebalance frequency (monthly, quarterly, annual)
 * - Validation of date range
 * - Quick date presets (1Y, 3Y, 5Y, 10Y)
 * 
 * Usage:
 * ```tsx
 * <BacktestForm
 *   modelPortfolioId="pm-001"
 *   modelPortfolioName="60/40 Portfolio"
 *   onSubmit={handleRunBacktest}
 *   loading={isRunning}
 * />
 * ```
 */
export const BacktestForm: React.FC<BacktestFormProps> = ({
  modelPortfolioId,
  modelPortfolioName,
  onSubmit,
  loading = false,
}) => {
  const [portfolioId, setPortfolioId] = useState(modelPortfolioId || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rebalanceFrequency, setRebalanceFrequency] = useState<RebalanceFrequency>('QUARTERLY');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize with default dates (5 years ago to today)
  useEffect(() => {
    const today = new Date();
    const fiveYearsAgo = new Date(today);
    fiveYearsAgo.setFullYear(today.getFullYear() - 5);

    setEndDate(formatDate(today));
    setStartDate(formatDate(fiveYearsAgo));
  }, []);

  // Update portfolio ID if prop changes
  useEffect(() => {
    if (modelPortfolioId) {
      setPortfolioId(modelPortfolioId);
    }
  }, [modelPortfolioId]);

  /**
   * Format date to YYYY-MM-DD
   */
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  /**
   * Set date range using preset
   */
  const setPresetRange = (years: number) => {
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setFullYear(today.getFullYear() - years);

    setEndDate(formatDate(today));
    setStartDate(formatDate(pastDate));
  };

  /**
   * Validate form
   */
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!portfolioId) {
      newErrors.portfolioId = 'Portfolio is required';
    }

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        newErrors.dateRange = 'Start date must be before end date';
      }

      // Check minimum period (1 month)
      const minPeriod = 30 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() < minPeriod) {
        newErrors.dateRange = 'Backtest period must be at least 1 month';
      }

      // Check if end date is in future
      if (end > new Date()) {
        newErrors.endDate = 'End date cannot be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onSubmit({
      modelPortfolioId: portfolioId,
      startDate,
      endDate,
      rebalanceFrequency,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="backtest-form">
      <div className="form-header">
        <h3>Run Backtest</h3>
        {modelPortfolioName && (
          <p className="portfolio-name">Portfolio: {modelPortfolioName}</p>
        )}
      </div>

      {/* Date Range */}
      <div className="form-section">
        <h4>Date Range</h4>
        
        {/* Quick presets */}
        <div className="date-presets">
          <button
            type="button"
            onClick={() => setPresetRange(1)}
            className="preset-button"
            disabled={loading}
          >
            1Y
          </button>
          <button
            type="button"
            onClick={() => setPresetRange(3)}
            className="preset-button"
            disabled={loading}
          >
            3Y
          </button>
          <button
            type="button"
            onClick={() => setPresetRange(5)}
            className="preset-button"
            disabled={loading}
          >
            5Y
          </button>
          <button
            type="button"
            onClick={() => setPresetRange(10)}
            className="preset-button"
            disabled={loading}
          >
            10Y
          </button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
              className={errors.startDate ? 'error' : ''}
            />
            {errors.startDate && (
              <span className="error-message">{errors.startDate}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
              className={errors.endDate ? 'error' : ''}
            />
            {errors.endDate && (
              <span className="error-message">{errors.endDate}</span>
            )}
          </div>
        </div>

        {errors.dateRange && (
          <span className="error-message">{errors.dateRange}</span>
        )}
      </div>

      {/* Rebalance Frequency */}
      <div className="form-section">
        <h4>Rebalance Frequency</h4>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="rebalanceFrequency"
              value="MONTHLY"
              checked={rebalanceFrequency === 'MONTHLY'}
              onChange={(e) => setRebalanceFrequency(e.target.value as RebalanceFrequency)}
              disabled={loading}
            />
            <span>Monthly</span>
            <span className="radio-description">Rebalance every month</span>
          </label>

          <label className="radio-label">
            <input
              type="radio"
              name="rebalanceFrequency"
              value="QUARTERLY"
              checked={rebalanceFrequency === 'QUARTERLY'}
              onChange={(e) => setRebalanceFrequency(e.target.value as RebalanceFrequency)}
              disabled={loading}
            />
            <span>Quarterly</span>
            <span className="radio-description">Rebalance every 3 months</span>
          </label>

          <label className="radio-label">
            <input
              type="radio"
              name="rebalanceFrequency"
              value="ANNUAL"
              checked={rebalanceFrequency === 'ANNUAL'}
              onChange={(e) => setRebalanceFrequency(e.target.value as RebalanceFrequency)}
              disabled={loading}
            />
            <span>Annual</span>
            <span className="radio-description">Rebalance once per year</span>
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <div className="form-actions">
        <button
          type="submit"
          className="submit-button"
          disabled={loading}
        >
          {loading ? 'Running Backtest...' : 'Run Backtest'}
        </button>
      </div>

      <style jsx>{`
        .backtest-form {
          max-width: 600px;
          margin: 0 auto;
          padding: 24px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .form-header h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 600;
        }

        .portfolio-name {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .form-section {
          margin-top: 24px;
        }

        .form-section h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 500;
        }

        .date-presets {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .preset-button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .preset-button:hover:not(:disabled) {
          background: #f5f5f5;
        }

        .preset-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          margin-bottom: 4px;
          font-size: 14px;
          font-weight: 500;
        }

        .form-group input[type="date"] {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-group input.error {
          border-color: #dc3545;
        }

        .error-message {
          color: #dc3545;
          font-size: 12px;
          margin-top: 4px;
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .radio-label {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .radio-label:hover {
          background: #f5f5f5;
        }

        .radio-label input[type="radio"] {
          margin-top: 2px;
        }

        .radio-label span:nth-of-type(1) {
          font-weight: 500;
          flex: 1;
        }

        .radio-description {
          display: block;
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }

        .form-actions {
          margin-top: 24px;
          text-align: right;
        }

        .submit-button {
          padding: 10px 24px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .submit-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
};

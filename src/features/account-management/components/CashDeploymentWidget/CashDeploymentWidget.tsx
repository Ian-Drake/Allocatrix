/**
 * CashDeploymentWidget Component
 * 
 * Main component for cash deployment workflow
 * Shows available cash, reserve, and deployment options
 * Orchestrates preview and execution flow
 * 
 * User Story 5 UI: Deploy available cash into underweight positions
 * SC-007: <5 clicks for operations
 */

import React, { useState, useEffect } from 'react';
import { useCashDeployment } from '../../hooks/useCashDeployment';
import { TradePreview } from './TradePreview/TradePreview';
import { ConfirmationDialog } from '../../../shared/components/ConfirmationDialog/ConfirmationDialog';
import type { DeploymentExecutionResult } from '../../hooks/useCashDeployment';

interface CashDeploymentWidgetProps {
  accountId: string;
  availableCash: number;
  totalAccountValue: number;
  onDeploymentComplete?: (result: DeploymentExecutionResult) => void;
  onError?: (error: string) => void;
}

/**
 * CashDeploymentWidget: Main deployment UI component
 * 
 * Workflow:
 * 1. User views available cash and current allocation
 * 2. User clicks "Calculate Preview"
 * 3. System shows proposed trades and projected allocation
 * 4. User clicks "Execute Deployment" (or cancels)
 * 5. System submits trades and shows results
 */
export function CashDeploymentWidget({
  accountId,
  availableCash,
  totalAccountValue,
  onDeploymentComplete,
  onError,
}: CashDeploymentWidgetProps) {
  const deployment = useCashDeployment(accountId);
  const [reservePercent, setReservePercent] = useState(3);
  const [showExecuting, setShowExecuting] = useState(false);

  // Handle successful execution
  useEffect(() => {
    if (deployment.executionResult && onDeploymentComplete) {
      onDeploymentComplete(deployment.executionResult);
    }
  }, [deployment.executionResult, onDeploymentComplete]);

  // Handle errors
  useEffect(() => {
    if (deployment.error && onError) {
      onError(deployment.error);
    }
  }, [deployment.error, onError]);

  /**
   * Step 1: Calculate preview
   * Click 1 in user journey
   */
  const handleCalculatePreview = async () => {
    try {
      await deployment.calculatePreview(reservePercent);
    } catch (error) {
      console.error('Failed to calculate preview:', error);
    }
  };

  /**
   * Step 2: Show confirmation
   * Click 2 - User reviews and confirms
   */
  const handleShowConfirmation = () => {
    deployment.showConfirmationDialog();
  };

  /**
   * Step 3: Execute deployment
   * Click 3 - Confirmation click
   */
  const handleExecuteDeployment = async () => {
    try {
      setShowExecuting(true);
      await deployment.executeDeployment();
    } catch (error) {
      console.error('Failed to execute deployment:', error);
    } finally {
      setShowExecuting(false);
    }
  };

  /**
   * Cancel execution
   * Go back to preview
   */
  const handleCancel = () => {
    deployment.cancelExecution();
  };

  // Render: Initial state - show deployment options
  if (!deployment.showPreview) {
    return (
      <div className="cash-deployment-widget">
        <div className="widget-header">
          <h3>Cash Deployment</h3>
          <p className="subtitle">Deploy available cash to underweight positions</p>
        </div>

        <div className="cash-info">
          <div className="info-row">
            <label>Available Cash:</label>
            <span className="value">${availableCash.toFixed(2)}</span>
          </div>

          <div className="info-row">
            <label>Total Account Value:</label>
            <span className="value">${totalAccountValue.toFixed(2)}</span>
          </div>

          <div className="info-row">
            <label>Reserve Percentage:</label>
            <div className="reserve-control">
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={reservePercent}
                onChange={(e) => setReservePercent(parseInt(e.target.value))}
                disabled={deployment.isLoading}
              />
              <span className="reserve-value">{reservePercent}%</span>
            </div>
          </div>

          <div className="info-row">
            <label>Reserve Amount:</label>
            <span className="value">${((reservePercent / 100) * totalAccountValue).toFixed(2)}</span>
          </div>
        </div>

        <div className="actions">
          <button
            onClick={handleCalculatePreview}
            disabled={deployment.isLoading || availableCash <= 0}
            className="btn btn-primary"
          >
            {deployment.isLoading ? 'Calculating...' : 'Calculate Preview'}
          </button>
        </div>

        {deployment.error && (
          <div className="error-message">
            <p>{deployment.error}</p>
          </div>
        )}
      </div>
    );
  }

  // Render: Preview state
  if (deployment.showPreview && deployment.previewData && !deployment.showConfirmation) {
    return (
      <div className="cash-deployment-widget preview-mode">
        <div className="widget-header">
          <h3>Deployment Preview</h3>
          <button onClick={() => deployment.closePreview()} className="btn-close">
            ✕
          </button>
        </div>

        <TradePreview preview={deployment.previewData} />

        <div className="preview-summary">
          <div className="summary-row">
            <label>Cash to Deploy:</label>
            <span>${deployment.previewData.cashToDeployAmount.toFixed(2)}</span>
          </div>

          <div className="summary-row">
            <label>Total Deployment Cost:</label>
            <span>${deployment.previewData.totalDeploymentCost.toFixed(2)}</span>
          </div>

          <div className="summary-row">
            <label>Remaining Cash:</label>
            <span>${deployment.previewData.remainingCash.toFixed(2)}</span>
          </div>

          <div className="summary-row">
            <label>Number of Trades:</label>
            <span>{deployment.previewData.proposedTrades.length}</span>
          </div>
        </div>

        {deployment.previewData.warnings.length > 0 && (
          <div className="warnings">
            <h4>Warnings</h4>
            <ul>
              {deployment.previewData.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="actions">
          <button
            onClick={handleShowConfirmation}
            disabled={deployment.previewData.proposedTrades.length === 0}
            className="btn btn-success"
          >
            Execute Deployment
          </button>
          <button onClick={() => deployment.closePreview()} className="btn btn-secondary">
            Cancel
          </button>
        </div>

        {deployment.error && (
          <div className="error-message">
            <p>{deployment.error}</p>
          </div>
        )}
      </div>
    );
  }

  // Render: Confirmation state
  if (deployment.showConfirmation && deployment.previewData) {
    return (
      <div className="cash-deployment-widget confirmation-mode">
        <ConfirmationDialog
          title="Confirm Cash Deployment"
          message={`Are you sure you want to deploy $${deployment.previewData.totalDeploymentCost.toFixed(2)} across ${deployment.previewData.proposedTrades.length} trades?\n\nThis action cannot be undone.`}
          onConfirm={handleExecuteDeployment}
          onCancel={handleCancel}
          isLoading={deployment.isExecuting}
          isDangerous={true}
        />
      </div>
    );
  }

  // Render: Execution result state
  if (deployment.executionResult) {
    const result = deployment.executionResult;
    const successRate = (result.successful / (result.successful + result.failed)) * 100 || 0;

    return (
      <div className="cash-deployment-widget result-mode">
        <div className="widget-header">
          <h3>Deployment Complete</h3>
        </div>

        <div className={`result-status ${result.failed === 0 ? 'success' : 'partial'}`}>
          <div className="status-icon">{result.failed === 0 ? '✓' : '⚠'}</div>
          <div className="status-text">
            <h4>{result.failed === 0 ? 'Deployment Successful' : 'Partial Deployment'}</h4>
            <p>{result.executionSummary}</p>
          </div>
        </div>

        <div className="result-stats">
          <div className="stat-row">
            <label>Successful Trades:</label>
            <span className="value success">{result.successful}</span>
          </div>

          <div className="stat-row">
            <label>Failed Trades:</label>
            <span className={`value ${result.failed > 0 ? 'error' : ''}`}>{result.failed}</span>
          </div>

          <div className="stat-row">
            <label>Success Rate:</label>
            <span className="value">{successRate.toFixed(1)}%</span>
          </div>

          <div className="stat-row">
            <label>Total Value Deployed:</label>
            <span className="value">${result.totalValueDeployed.toFixed(2)}</span>
          </div>
        </div>

        {result.trades.length > 0 && (
          <div className="trades-summary">
            <h4>Trade Results</h4>
            <div className="trades-list">
              {result.trades.map((trade, index) => (
                <div key={index} className={`trade-item ${trade.status}`}>
                  <div className="trade-symbol">{trade.symbol}</div>
                  <div className="trade-qty">
                    {trade.quantity} shares
                  </div>
                  <div className={`trade-status ${trade.status}`}>
                    {trade.status === 'executed' ? '✓ Executed' : '✗ Failed'}
                  </div>
                  {trade.errorMessage && (
                    <div className="trade-error">{trade.errorMessage}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="actions">
          <button
            onClick={() => {
              deployment.reset();
            }}
            className="btn btn-primary"
          >
            New Deployment
          </button>
          <button
            onClick={() => {
              deployment.reset();
              // In real app, would navigate back to account
            }}
            className="btn btn-secondary"
          >
            Back to Account
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// Styles would be in separate CSS file
const styles = `
.cash-deployment-widget {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.widget-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.cash-info,
.preview-summary,
.result-stats {
  margin-bottom: 20px;
}

.info-row,
.summary-row,
.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-row label,
.summary-row label,
.stat-row label {
  font-weight: 500;
  color: #666;
}

.value {
  font-weight: 600;
  color: #333;
}

.value.success {
  color: #28a745;
}

.value.error {
  color: #dc3545;
}

.reserve-control {
  display: flex;
  gap: 10px;
  align-items: center;
}

.reserve-control input {
  flex: 1;
}

.reserve-value {
  min-width: 40px;
  text-align: right;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #218838;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 10px 12px;
  border-radius: 4px;
  margin-top: 10px;
  border: 1px solid #f5c6cb;
}

.warnings {
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 15px;
}

.warnings h4 {
  margin-top: 0;
  margin-bottom: 8px;
  color: #856404;
}

.warnings ul {
  margin: 0;
  padding-left: 20px;
  color: #856404;
}

.result-status {
  display: flex;
  gap: 15px;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  background-color: #f8f9fa;
}

.result-status.success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
}

.result-status.partial {
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
}

.status-icon {
  font-size: 28px;
  font-weight: bold;
  min-width: 40px;
  text-align: center;
}

.result-status.success .status-icon {
  color: #28a745;
}

.result-status.partial .status-icon {
  color: #ffc107;
}

.status-text h4 {
  margin: 0 0 5px 0;
}

.status-text p {
  margin: 0;
  font-size: 14px;
}

.trades-list {
  display: grid;
  gap: 8px;
}

.trade-item {
  display: grid;
  grid-template-columns: 80px 1fr 120px;
  gap: 10px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  align-items: center;
}

.trade-item.executed {
  background-color: #f0fff4;
}

.trade-item.failed {
  background-color: #fff5f5;
}

.trade-symbol {
  font-weight: 600;
}

.trade-status {
  text-align: right;
  font-weight: 500;
}

.trade-status.executed {
  color: #28a745;
}

.trade-status.failed {
  color: #dc3545;
}

.trade-error {
  grid-column: 1 / -1;
  font-size: 12px;
  color: #dc3545;
  margin-top: 5px;
}
`;

export default CashDeploymentWidget;

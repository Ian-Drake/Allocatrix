/**
 * Audit Logger Utility
 * 
 * Records all user actions and trades to the audit_log_entry table
 * per requirement FR-021 and SC-010 (100% trade audit coverage).
 * 
 * Action Types:
 * - OAUTH_LOGIN, OAUTH_REFRESH, OAUTH_LOGOUT
 * - MODEL_CREATED, MODEL_UPDATED, MODEL_VALIDATED, MODEL_ASSIGNED, MODEL_CLONED
 * - POSITION_REFRESHED
 * - DEPLOYMENT_PROPOSED, DEPLOYMENT_EXECUTED
 * - REBALANCE_PROPOSED, REBALANCE_EXECUTED
 * - BACKTEST_COMPLETED
 * - API_ERROR
 */

import { v4 as uuidv4 } from 'uuid';
import { runAsync } from '../db/database';
import { logger } from './logger';

export type AuditAction =
  | 'OAUTH_LOGIN'
  | 'OAUTH_REFRESH'
  | 'OAUTH_LOGOUT'
  | 'MODEL_CREATED'
  | 'MODEL_UPDATED'
  | 'MODEL_VALIDATED'
  | 'MODEL_ASSIGNED'
  | 'MODEL_CLONED'
  | 'POSITION_REFRESHED'
  | 'DEPLOYMENT_PROPOSED'
  | 'DEPLOYMENT_EXECUTED'
  | 'REBALANCE_PROPOSED'
  | 'REBALANCE_EXECUTED'
  | 'BACKTEST_COMPLETED'
  | 'API_ERROR';

export type AuditStatus = 'pending' | 'executed' | 'failed';

export interface AuditEntry {
  id?: string;
  timestamp?: Date;
  action: AuditAction;
  userId?: string;
  accountId?: string;
  details: Record<string, unknown>;
  status: AuditStatus;
  errorMessage?: string;
}

/**
 * Log an audit entry to the database
 */
export async function logAudit(entry: AuditEntry): Promise<string> {
  const id = entry.id || uuidv4();
  const timestamp = entry.timestamp || new Date();

  try {
    await runAsync(
      `INSERT INTO audit_log_entry (
        id, 
        timestamp, 
        action, 
        userId, 
        accountId, 
        details, 
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        timestamp.toISOString(),
        entry.action,
        entry.userId || null,
        entry.accountId || null,
        JSON.stringify(entry.details),
        entry.status,
      ]
    );

    logger.debug('Audit entry created', {
      auditId: id,
      action: entry.action,
      accountId: entry.accountId,
      status: entry.status,
    });

    return id;
  } catch (error) {
    logger.error('Failed to create audit entry', { action: entry.action }, error as Error);
    throw error;
  }
}

/**
 * Update the status of an existing audit entry
 */
export async function updateAuditStatus(
  id: string,
  status: AuditStatus,
  errorMessage?: string
): Promise<void> {
  try {
    await runAsync(
      `UPDATE audit_log_entry 
       SET status = ?, 
           details = json_set(details, '$.errorMessage', ?)
       WHERE id = ?`,
      [status, errorMessage || null, id]
    );

    logger.debug('Audit entry updated', { auditId: id, status, errorMessage });
  } catch (error) {
    logger.error('Failed to update audit entry', { auditId: id, status }, error as Error);
    throw error;
  }
}

/**
 * Log OAuth-related events
 */
export async function logOAuthEvent(
  action: Extract<AuditAction, 'OAUTH_LOGIN' | 'OAUTH_REFRESH' | 'OAUTH_LOGOUT'>,
  details: Record<string, unknown>
): Promise<string> {
  return logAudit({
    action,
    details,
    status: 'executed',
  });
}

/**
 * Log model portfolio operations
 */
export async function logModelEvent(
  action: Extract<
    AuditAction,
    'MODEL_CREATED' | 'MODEL_UPDATED' | 'MODEL_VALIDATED' | 'MODEL_ASSIGNED' | 'MODEL_CLONED'
  >,
  modelPortfolioId: string,
  details: Record<string, unknown>
): Promise<string> {
  return logAudit({
    action,
    details: {
      modelPortfolioId,
      ...details,
    },
    status: 'executed',
  });
}

/**
 * Log trade operations (deployment, rebalance)
 * Returns audit ID for updating status after Schwab responds
 */
export async function logTradeEvent(
  action: Extract<
    AuditAction,
    'DEPLOYMENT_PROPOSED' | 'DEPLOYMENT_EXECUTED' | 'REBALANCE_PROPOSED' | 'REBALANCE_EXECUTED'
  >,
  accountId: string,
  details: Record<string, unknown>,
  status: AuditStatus = 'pending'
): Promise<string> {
  return logAudit({
    action,
    accountId,
    details,
    status,
  });
}

/**
 * Log position refresh
 */
export async function logPositionRefresh(
  accountId: string,
  details: Record<string, unknown>
): Promise<string> {
  return logAudit({
    action: 'POSITION_REFRESHED',
    accountId,
    details,
    status: 'executed',
  });
}

/**
 * Log backtest completion
 */
export async function logBacktest(details: Record<string, unknown>): Promise<string> {
  return logAudit({
    action: 'BACKTEST_COMPLETED',
    details,
    status: 'executed',
  });
}

/**
 * Log API errors for retry tracking
 */
export async function logApiError(
  accountId: string | undefined,
  details: Record<string, unknown>,
  errorMessage: string
): Promise<string> {
  return logAudit({
    action: 'API_ERROR',
    accountId,
    details,
    status: 'failed',
    errorMessage,
  });
}

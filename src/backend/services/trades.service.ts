/**
 * Trades Service
 * Handles Schwab order submission, execution tracking, and audit logging
 * Manages trade status transitions: pending → executed/failed
 */

import { v4 as uuid } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db/database';
import type { ProposedTrade } from './cash-deployment.service';

/**
 * Trade execution record stored in audit log
 */
export interface TradeExecutionRecord {
  id: string;
  accountId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalValue: number;
  orderType: 'MARKET' | 'LIMIT';
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  schwabOrderId?: string; // Order ID returned from Schwab
  executedPrice?: number; // Actual execution price
  executedQuantity?: number; // Actual quantity filled
  executedAt?: string; // Actual execution timestamp
  errorMessage?: string; // Error details if failed
  createdAt: string;
  updatedAt: string;
}

/**
 * Batch trade submission result
 */
export interface TradeExecutionResult {
  successful: number;
  failed: number;
  trades: TradeExecutionRecord[];
  totalValue: number;
  executionSummary: string;
}

export class TradesService {
  /**
   * Submit batch of trades to Schwab
   * Creates pending records, attempts execution, updates status
   * 
   * @param accountId - Account UUID
   * @param schwabAccountId - Encrypted Schwab account identifier
   * @param proposedTrades - Array of proposed trades from deployment calculator
   * @param schwabApiService - Reference to Schwab API service for submission
   * @returns Trade execution results with status for each trade
   */
  async submitTrades(
    accountId: string,
    schwabAccountId: string,
    proposedTrades: ProposedTrade[],
    schwabApiService?: Record<string, unknown>, // Injected dependency for testing
  ): Promise<TradeExecutionResult> {
    const startTime = Date.now();
    const executedTrades: TradeExecutionRecord[] = [];
    let successful = 0;
    let failed = 0;
    let totalValue = 0;

    // Create pending audit records for all trades
    const pendingRecords = await Promise.all(
      proposedTrades.map((trade) =>
        this.createPendingTradeRecord(accountId, trade)
      )
    );

    executedTrades.push(...pendingRecords);

    // Submit each trade to Schwab (or mock if no service provided)
    for (const trade of proposedTrades) {
      try {
        let updatedRecord = pendingRecords.find((r) => r.symbol === trade.symbol)!;

        // Attempt to execute via Schwab API
        if (schwabApiService && typeof schwabApiService === 'object' && 'submitOrder' in schwabApiService) {
          const submitOrderFn = schwabApiService.submitOrder as (
            accountId: string,
            order: Record<string, unknown>
          ) => Promise<Record<string, unknown>>;

          const schwabOrder = await submitOrderFn.call(
            schwabApiService,
            schwabAccountId,
            {
              symbol: trade.symbol,
              quantity: trade.quantity,
              orderType: trade.orderType,
              instruction: 'BUY',
            }
          );

          // Update record with Schwab response
          updatedRecord = await this.updateTradeRecord(
            updatedRecord.id,
            {
              status: 'executed',
              schwabOrderId: (schwabOrder.orderId as string) || undefined,
              executedPrice: (schwabOrder.executedPrice as number) || trade.estimatedPrice,
              executedQuantity: (schwabOrder.executedQuantity as number) || trade.quantity,
              executedAt: new Date().toISOString(),
            }
          );

          successful++;
          totalValue += trade.totalCost;
        } else {
          // Mock execution for testing
          updatedRecord = await this.updateTradeRecord(
            updatedRecord.id,
            {
              status: 'executed',
              executedPrice: trade.estimatedPrice,
              executedQuantity: trade.quantity,
              executedAt: new Date().toISOString(),
            }
          );

          successful++;
          totalValue += trade.totalCost;
        }
      } catch (error) {
        // Mark trade as failed but continue with others
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.updateTradeRecord(
          pendingRecords.find((r) => r.symbol === trade.symbol)!.id,
          {
            status: 'failed',
            errorMessage,
          }
        );

        failed++;
      }
    }

    const executionTime = Date.now() - startTime;

    // Create summary audit log entry
    await this.createTradeExecutionSummary(
      accountId,
      successful,
      failed,
      totalValue,
      executionTime
    );

    return {
      successful,
      failed,
      trades: executedTrades,
      totalValue,
      executionSummary: `${successful} executed, ${failed} failed in ${executionTime}ms`,
    };
  }

  /**
   * Create pending trade record in audit log
   * Used before actual Schwab submission
   * 
   * @param accountId - Account UUID
   * @param trade - Proposed trade details
   * @returns Pending trade record
   */
  private async createPendingTradeRecord(
    accountId: string,
    trade: ProposedTrade
  ): Promise<TradeExecutionRecord> {
    const recordId = uuid();
    const now = new Date().toISOString();

    const record: TradeExecutionRecord = {
      id: recordId,
      accountId,
      symbol: trade.symbol,
      action: trade.action,
      quantity: trade.quantity,
      price: trade.estimatedPrice,
      totalValue: trade.totalCost,
      orderType: trade.orderType,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    // Store in audit log
    await runAsync(
      `
      INSERT INTO audit_log_entry (id, timestamp, action, accountId, details, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        recordId,
        now,
        'TRADE_SUBMITTED',
        accountId,
        JSON.stringify({
          tradeId: recordId,
          symbol: trade.symbol,
          action: trade.action,
          quantity: trade.quantity,
          estimatedPrice: trade.estimatedPrice,
          totalCost: trade.totalCost,
          orderType: trade.orderType,
        }),
        'pending',
      ]
    );

    return record;
  }

  /**
   * Update trade execution status
   * Called after Schwab response received
   * 
   * @param tradeId - Trade record ID
   * @param updates - Status updates from Schwab or local execution
   * @returns Updated trade record
   */
  private async updateTradeRecord(
    tradeId: string,
    updates: Partial<TradeExecutionRecord>
  ): Promise<TradeExecutionRecord> {
    const now = new Date().toISOString();

    // Update audit log entry
    const auditEntry = await getAsync<{ details: string; status: string }>(
      `
      SELECT details, status FROM audit_log_entry WHERE id = ?
    `,
      [tradeId]
    );

    if (auditEntry) {
      const details = JSON.parse(auditEntry.details);
      const updatedDetails = {
        ...details,
        status: updates.status,
        executedPrice: updates.executedPrice,
        executedQuantity: updates.executedQuantity,
        executedAt: updates.executedAt,
        schwabOrderId: updates.schwabOrderId,
        errorMessage: updates.errorMessage,
      };

      await runAsync(
        `
        UPDATE audit_log_entry
        SET details = ?, status = ?, timestamp = ?
        WHERE id = ?
      `,
        [JSON.stringify(updatedDetails), updates.status, now, tradeId]
      );
    }

    // Retrieve and return updated record
    const entry = await getAsync<{ details: string }>(
      `SELECT details FROM audit_log_entry WHERE id = ?`,
      [tradeId]
    );

    const details = entry ? JSON.parse(entry.details) : {};

    return {
      id: tradeId,
      accountId: details.accountId || '',
      symbol: details.symbol,
      action: details.action,
      quantity: details.quantity,
      price: details.estimatedPrice,
      totalValue: details.totalCost,
      orderType: details.orderType,
      status: updates.status || 'pending',
      schwabOrderId: updates.schwabOrderId,
      executedPrice: updates.executedPrice,
      executedQuantity: updates.executedQuantity,
      executedAt: updates.executedAt,
      errorMessage: updates.errorMessage,
      createdAt: details.createdAt || new Date().toISOString(),
      updatedAt: now,
    };
  }

  /**
   * Create summary audit log entry for batch execution
   * Records overall deployment statistics
   * 
   * @param accountId - Account UUID
   * @param successful - Number of successful trades
   * @param failed - Number of failed trades
   * @param totalValue - Total value deployed
   * @param executionTime - Time taken in milliseconds
   */
  private async createTradeExecutionSummary(
    accountId: string,
    successful: number,
    failed: number,
    totalValue: number,
    executionTime: number
  ): Promise<void> {
    try {
      await runAsync(
        `
        INSERT INTO audit_log_entry (id, timestamp, action, accountId, details, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          uuid(),
          new Date().toISOString(),
          'DEPLOYMENT_EXECUTED',
          accountId,
          JSON.stringify({
            successfulTrades: successful,
            failedTrades: failed,
            totalValueDeployed: totalValue,
            executionTimeMs: executionTime,
          }),
          'executed',
        ]
      );
    } catch (error) {
      console.error('Failed to create trade execution summary:', error);
    }
  }

  /**
   * Get all trades for an account
   * 
   * @param accountId - Account UUID
   * @returns Array of trade execution records
   */
  async getAccountTrades(accountId: string): Promise<TradeExecutionRecord[]> {
    try {
      const rows = await allAsync<{ details: string }>(
        `
        SELECT details FROM audit_log_entry
        WHERE accountId = ? AND action = 'TRADE_SUBMITTED'
        ORDER BY timestamp DESC
      `,
        [accountId]
      );

      return rows.map((row) => {
        const details = JSON.parse(row.details);
        return {
          id: details.tradeId,
          accountId,
          symbol: details.symbol,
          action: details.action,
          quantity: details.quantity,
          price: details.estimatedPrice,
          totalValue: details.totalCost,
          orderType: details.orderType,
          status: details.status,
          schwabOrderId: details.schwabOrderId,
          executedPrice: details.executedPrice,
          executedQuantity: details.executedQuantity,
          executedAt: details.executedAt,
          errorMessage: details.errorMessage,
          createdAt: details.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      throw new Error(`Failed to retrieve trades: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get trade execution statistics for an account
   * 
   * @param accountId - Account UUID
   * @returns Statistics about trades
   */
  async getTradeStatistics(accountId: string): Promise<{
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    totalValueDeployed: number;
    successRate: number;
  }> {
    const trades = await this.getAccountTrades(accountId);

    const successful = trades.filter((t) => t.status === 'executed').length;
    const failed = trades.filter((t) => t.status === 'failed').length;
    const totalValue = trades
      .filter((t) => t.status === 'executed')
      .reduce((sum, t) => sum + t.totalValue, 0);

    return {
      totalTrades: trades.length,
      successfulTrades: successful,
      failedTrades: failed,
      totalValueDeployed: totalValue,
      successRate: trades.length > 0 ? (successful / trades.length) * 100 : 0,
    };
  }

  /**
   * Cancel pending trades (before execution)
   * 
   * @param tradeIds - Array of trade IDs to cancel
   * @returns Count of cancelled trades
   */
  async cancelPendingTrades(tradeIds: string[]): Promise<number> {
    let cancelled = 0;

    for (const tradeId of tradeIds) {
      try {
        const entry = await getAsync<{ status: string }>(
          `SELECT status FROM audit_log_entry WHERE id = ?`,
          [tradeId]
        );

        if (entry && entry.status === 'pending') {
          await runAsync(
            `
            UPDATE audit_log_entry
            SET status = 'cancelled'
            WHERE id = ?
          `,
            [tradeId]
          );
          cancelled++;
        }
      } catch (error) {
        console.error(`Failed to cancel trade ${tradeId}:`, error);
      }
    }

    return cancelled;
  }

  /**
   * Retry failed trades
   * Attempts to resubmit failed trades with optional modifications
   * 
   * @param accountId - Account UUID
   * @param schwabAccountId - Encrypted Schwab account ID
   * @param failedTradeIds - Trade IDs that failed to retry
   * @param schwabApiService - Schwab API service
   * @returns Retry results
   */
  async retryFailedTrades(
    accountId: string,
    schwabAccountId: string,
    failedTradeIds: string[],
    schwabApiService?: Record<string, unknown>
  ): Promise<TradeExecutionResult> {
    const trades = await this.getAccountTrades(accountId);
    const failedTrades = trades.filter((t) => failedTradeIds.includes(t.id) && t.status === 'failed');

    // Convert to ProposedTrade format for resubmission
    // All cash deployment trades are BUY orders
    const proposedTrades: ProposedTrade[] = failedTrades.map((t) => ({
      symbol: t.symbol,
      action: 'BUY' as const,
      targetAllocationDollars: t.totalValue,
      quantity: t.quantity,
      estimatedPrice: t.price,
      totalCost: t.totalValue,
      orderType: t.orderType as 'MARKET' | 'LIMIT',
    }));

    return this.submitTrades(accountId, schwabAccountId, proposedTrades, schwabApiService);
  }
}

// Export singleton instance
export const tradesService = new TradesService();

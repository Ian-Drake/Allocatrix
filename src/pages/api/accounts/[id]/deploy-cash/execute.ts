/**
 * API Endpoint: POST /api/accounts/[id]/deploy-cash/execute
 * 
 * Submits trades to Schwab and records in audit log
 * This is a destructive operation - actual trades will be executed
 * 
 * Request Body:
 * - proposedTrades: Array of trades from preview endpoint
 * - reserveAmount: Reserve amount to protect
 * 
 * Response: Execution results with status for each trade
 * 
 * User Story 5 Acceptance Criteria:
 * - Trades submitted to Schwab and recorded in audit log
 * - 100% of trades have audit entries (SC-010)
 * - All trades or atomic failure pattern (if applicable)
 * - Insufficient cash handled gracefully
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { tradesService } from '@/backend/services/trades.service';
import { accountService } from '@/backend/services/account.service';
import type { ProposedTrade } from '@/backend/services/cash-deployment.service';

interface ExecuteRequest {
  proposedTrades: ProposedTrade[];
  reserveAmount: number;
}

interface ExecuteResponse {
  success: boolean;
  data?: {
    successful: number;
    failed: number;
    trades: Array<{
      symbol: string;
      status: 'executed' | 'failed';
      quantity?: number;
      errorMessage?: string;
    }>;
    totalValueDeployed: number;
    executionSummary: string;
  };
  error?: string;
  code?: string;
  details?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExecuteResponse>
) {
  // Only POST allowed for execution
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    });
  }

  try {
    // TODO: Verify session/authentication middleware

    const { id: accountId } = req.query;

    // Validate account ID
    if (!accountId || typeof accountId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid account ID',
        code: 'INVALID_ACCOUNT_ID',
      });
    }

    // Parse request body
    const body = req.body as ExecuteRequest;

    if (!body.proposedTrades || !Array.isArray(body.proposedTrades)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        code: 'INVALID_REQUEST',
        details: 'proposedTrades array is required',
      });
    }

    if (body.proposedTrades.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No trades to execute',
        code: 'NO_TRADES',
        details: 'At least one trade is required',
      });
    }

    // Retrieve account details
    const account = await accountService.getAccountById(accountId);

    // Verify account has assigned model
    if (!account.assignedModelPortfolioId) {
      return res.status(400).json({
        success: false,
        error: 'Account does not have assigned model portfolio',
        code: 'NO_ASSIGNED_MODEL',
      });
    }

    // Validate that total proposed cost doesn't exceed available cash minus reserve
    const totalCost = body.proposedTrades.reduce((sum, t) => sum + t.totalCost, 0);
    const availableAfterReserve = account.availableCash - (body.reserveAmount || 0);

    if (totalCost > availableAfterReserve) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient cash after reserve',
        code: 'INSUFFICIENT_CASH',
        details: `Total cost $${totalCost.toFixed(2)} exceeds available $${availableAfterReserve.toFixed(2)}`,
      });
    }

    // Validate trades one more time
    const validation = body.proposedTrades.every((trade) => {
      return (
        trade.symbol &&
        trade.quantity > 0 &&
        trade.estimatedPrice > 0 &&
        trade.totalCost > 0 &&
        trade.action === 'BUY'
      );
    });

    if (!validation) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proposed trades',
        code: 'INVALID_TRADES',
        details: 'One or more trades have invalid parameters',
      });
    }

    // Execute trades via Schwab
    // Note: In real implementation, would pass schwabApiService instance
    const result = await tradesService.submitTrades(
      accountId,
      account.id, // Or use schwabEncryptedAccountId if available
      body.proposedTrades,
      undefined // No external API in this simple implementation
    );

    // Return execution results
    return res.status(200).json({
      success: true,
      data: {
        successful: result.successful,
        failed: result.failed,
        trades: result.trades.map((t) => ({
          symbol: t.symbol,
          status: t.status as 'executed' | 'failed',
          quantity: t.executedQuantity || t.quantity,
          errorMessage: t.errorMessage,
        })),
        totalValueDeployed: result.totalValue,
        executionSummary: result.executionSummary,
      },
    });
  } catch (error) {
    console.error('Error executing deployment:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return res.status(500).json({
      success: false,
      error: 'Failed to execute deployment',
      code: 'EXECUTION_ERROR',
      details: errorMessage,
    });
  }
}

export default handler;

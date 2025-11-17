/**
 * API Endpoint: GET /api/accounts/[id]/deploy-cash
 * 
 * Calculates cash deployment preview showing:
 * - Available cash after reserve
 * - Proposed trades for underweight positions
 * - Projected allocation after deployment
 * - Execution warnings
 * 
 * This endpoint is read-only and safe to call multiple times.
 * Use /execute endpoint to actually submit trades.
 * 
 * User Story 5 Acceptance Criteria:
 * - Algorithm calculates target dollar amounts for underweight tickers
 * - Trades proportionally allocated across underweights
 * - Projected allocation preview shown before execution (SC-007: <5 clicks)
 * - Rounding handled: minimal leftover cash
 * - Performance: Calculation <1s (SC-005)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { DriftCalculatorService } from '@/backend/services/drift-calculator.service';
import { CashDeploymentService } from '@/backend/services/cash-deployment.service';
import { accountService } from '@/backend/services/account.service';

interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}

interface SuccessResponse {
  success: true;
  data: {
    accountId: string;
    availableCash: number;
    reserveAmount: number;
    cashToDeployAmount: number;
    proposedTrades: Array<{
      symbol: string;
      quantity: number;
      estimatedPrice: number;
      totalCost: number;
    }>;
    projectedAllocation: Array<{
      symbol: string;
      currentValue: number;
      postDeploymentValue: number;
      currentWeight: number;
      projectedWeight: number;
    }>;
    totalDeploymentCost: number;
    remainingCash: number;
    estimatedExecutionTime: number;
    warnings: string[];
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  // Only GET allowed for preview
  if (req.method !== 'GET') {
    return res.status(405).json({
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
        error: 'Invalid account ID',
        code: 'INVALID_ACCOUNT_ID',
      });
    }

    // Get query parameters
    const reservePercentStr = typeof req.query.reservePercent === 'string' ? req.query.reservePercent : '3';
    const reservePercent = parseFloat(reservePercentStr);

    if (isNaN(reservePercent) || reservePercent < 0 || reservePercent > 100) {
      return res.status(400).json({
        error: 'Invalid reserve percent',
        code: 'INVALID_RESERVE_PERCENT',
        details: 'Reserve percent must be between 0 and 100',
      });
    }

    // Retrieve account details
    const account = await accountService.getAccountById(accountId);

    // Verify account has assigned model
    if (!account.assignedModelPortfolioId) {
      return res.status(400).json({
        error: 'Account does not have assigned model portfolio',
        code: 'NO_ASSIGNED_MODEL',
        details: 'Assign a model portfolio to this account before deploying cash',
      });
    }

    // Verify we have positions data
    if (!account.positions || account.positions.length === 0) {
      return res.status(400).json({
        error: 'No positions available',
        code: 'NO_POSITIONS',
        details: 'Account has no positions. Refresh positions before deploying cash.',
      });
    }

    // Build model allocations from assigned portfolio
    // This would normally fetch from database - for now assume structure
    const modelAllocations = account.positions.map((pos: { symbol: string; currentAllocationPct: number }) => ({
      symbol: pos.symbol,
      targetWeightPct: pos.currentAllocationPct, // In real implementation, fetch from model
    }));

    // Calculate drift
    const driftService = new DriftCalculatorService();
    const driftCalculations = driftService.calculateDrift(
      account.positions.map(
        (p: { symbol: string; quantity: number; currentPrice: number; currentValue: number; currentAllocationPct: number }) => ({
          symbol: p.symbol,
          quantity: p.quantity,
          currentPrice: p.currentPrice,
          currentValue: p.currentValue,
          percentOfAccount: p.currentAllocationPct,
        })
      ),
      modelAllocations,
      account.totalAccountValue
    );

    // Calculate recommended reserve
    const deploymentService = new CashDeploymentService();
    const recommendedReserve = (reservePercent / 100) * account.totalAccountValue;

    // Calculate deployment preview
    const preview = deploymentService.calculateDeploymentPreview(
      accountId,
      account.availableCash,
      recommendedReserve,
      driftCalculations,
      account.totalAccountValue
    );

    // Validate deployment
    const validation = deploymentService.validateDeployment(preview);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Deployment validation failed',
        code: 'VALIDATION_FAILED',
        details: validation.errors.join('; '),
      });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      data: {
        accountId: preview.accountId,
        availableCash: preview.availableCash,
        reserveAmount: preview.reserveAmount,
        cashToDeployAmount: preview.cashToDeployAmount,
        proposedTrades: preview.proposedTrades.map((t) => ({
          symbol: t.symbol,
          quantity: t.quantity,
          estimatedPrice: t.estimatedPrice,
          totalCost: t.totalCost,
        })),
        projectedAllocation: preview.projectedAllocation,
        totalDeploymentCost: preview.totalDeploymentCost,
        remainingCash: preview.remainingCash,
        estimatedExecutionTime: preview.estimatedExecutionTime,
        warnings: preview.warnings,
      },
    });
  } catch (error) {
    console.error('Error calculating deployment:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return res.status(500).json({
      error: 'Failed to calculate deployment',
      code: 'CALCULATION_ERROR',
      details: errorMessage,
    });
  }
}

export default handler;


/**
 * API Endpoint: GET /api/accounts/[id]/rebalance
 * 
 * Calculates full rebalance preview showing:
 * - All proposed sells (overweight positions)
 * - All proposed buys (underweight positions)
 * - Projected allocation after rebalance
 * - Total commissions and net cash movement
 * - Execution warnings and liquidity analysis
 * 
 * This endpoint is read-only and safe to call multiple times.
 * Use /execute endpoint to actually submit trades.
 * 
 * User Story 6 Acceptance Criteria:
 * - Algorithm calculates all sells and buys to reach target allocation
 * - Preview shows all proposed trades with estimated commissions
 * - Projected allocation calculated correctly
 * - Performance: SC-006 Calculation <2s
 * - Insufficient liquidity detected and alternative suggested
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { RebalanceService } from '@/backend/services/rebalance.service';
import { DriftCalculatorService } from '@/backend/services/drift-calculator.service';
import { LiquidityAnalyzerService } from '@/backend/services/liquidity-analyzer.service';

interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}

interface SuccessResponse {
  success: true;
  data: {
    accountId: string;
    accountValue: number;
    sells: Array<{
      symbol: string;
      currentValue: number;
      targetValue: number;
      tradeAmount: number;
      quantity: number;
      estimatedPrice: number;
      totalCost: number;
      orderType: string;
      commission: number;
      estimatedTotalWithCommission: number;
    }>;
    buys: Array<{
      symbol: string;
      currentValue: number;
      targetValue: number;
      tradeAmount: number;
      quantity: number;
      estimatedPrice: number;
      totalCost: number;
      orderType: string;
      commission: number;
      estimatedTotalWithCommission: number;
    }>;
    projectedAllocation: Array<{
      symbol: string;
      currentWeight: number;
      currentValue: number;
      projectedWeight: number;
      projectedValue: number;
    }>;
    totalSellValue: number;
    totalBuyValue: number;
    totalCommissions: number;
    cashNeeded: number;
    cashGenerated: number;
    netCashMovement: number;
    isAllocatingPercentages: boolean;
    warnings: string[];
    estimatedExecutionTime: number;
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

    // TODO: Replace with actual account and position fetching
    // This is a skeleton showing the API contract
    // Implementation would:
    // 1. Get account details from AccountService
    // 2. Get positions from PositionsService
    // 3. Get model allocations
    // 4. Calculate drift, rebalance preview, and liquidity analysis
    // 5. Return combined result

    // Placeholder response (integration tests would provide real data)
    const rebalanceService = new RebalanceService();
    const dummyDriftCalculations = [];
    const dummyAccountValue = 100000;

    const preview = rebalanceService.calculateRebalancePreview(
      accountId,
      dummyDriftCalculations,
      dummyAccountValue
    );

    return res.status(200).json({
      success: true,
      data: {
        accountId,
        accountValue: dummyAccountValue,
        sells: preview.sells,
        buys: preview.buys,
        projectedAllocation: preview.projectedAllocation,
        totalSellValue: preview.totalSellValue,
        totalBuyValue: preview.totalBuyValue,
        totalCommissions: preview.totalCommissions,
        cashNeeded: preview.cashNeeded,
        cashGenerated: preview.cashGenerated,
        netCashMovement: preview.netCashMovement,
        isAllocatingPercentages: preview.isAllocatingPercentages,
        warnings: preview.warnings,
        estimatedExecutionTime: preview.estimatedExecutionTime,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error calculating rebalance preview:', error);

    return res.status(500).json({
      error: 'Failed to calculate rebalance preview',
      code: 'REBALANCE_CALCULATION_FAILED',
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
}

interface SuccessResponse {
  success: true;
  data: {
    accountId: string;
    accountValue: number;
    sells: Array<{
      symbol: string;
      currentValue: number;
      targetValue: number;
      tradeAmount: number;
      quantity: number;
      estimatedPrice: number;
      totalCost: number;
      orderType: string;
      commission: number;
      estimatedTotalWithCommission: number;
    }>;
    buys: Array<{
      symbol: string;
      currentValue: number;
      targetValue: number;
      tradeAmount: number;
      quantity: number;
      estimatedPrice: number;
      totalCost: number;
      orderType: string;
      commission: number;
      estimatedTotalWithCommission: number;
    }>;
    projectedAllocation: Array<{
      symbol: string;
      currentWeight: number;
      currentValue: number;
      projectedWeight: number;
      projectedValue: number;
    }>;
    totalSellValue: number;
    totalBuyValue: number;
    totalCommissions: number;
    cashNeeded: number;
    cashGenerated: number;
    netCashMovement: number;
    isAllocatingPercentages: boolean;
    warnings: string[];
    estimatedExecutionTime: number;
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

    // Get account details
    const accountService = new AccountService();
    const account = await accountService.getAccountById(accountId);

    // Verify model is assigned
    if (!account.assignedModelPortfolioId) {
      return res.status(400).json({
        error: 'No model portfolio assigned to this account',
        code: 'NO_MODEL_ASSIGNED',
      });
    }

    // Get current positions
    const positionsService = new PositionsService();
    const snapshot = await positionsService.getAccountPositions(accountId);
    const accountValue = snapshot.totalAccountValue;

    if (accountValue <= 0) {
      return res.status(400).json({
        error: 'Account has no value. Cannot calculate rebalance.',
        code: 'INVALID_ACCOUNT_VALUE',
      });
    }

    // Get model allocations from positions and map to model allocations
    // TODO: Fetch from actual model portfolio
    const modelAllocations = snapshot.positions.map((p) => ({
      symbol: p.symbol,
      targetWeightPct: (p.percentOfAccount * 100) || 0,
    }));

    // Calculate drift
    const driftCalculator = new DriftCalculatorService();
    const driftCalculations = driftCalculator.calculateDrift(
      snapshot.positions.map((p) => ({
        symbol: p.symbol,
        quantity: p.quantity,
        currentPrice: p.currentPrice,
        currentValue: p.currentValue,
        percentOfAccount: p.percentOfAccount,
      })),
      modelAllocations,
      accountValue
    );

    // Calculate rebalance preview
    const rebalanceService = new RebalanceService();
    const preview = rebalanceService.calculateRebalancePreview(
      accountId,
      driftCalculations,
      accountValue
    );

    // Check liquidity
    const liquidityAnalyzer = new LiquidityAnalyzerService();
    const availableCash = snapshot.availableCash;
    const liquidityAnalysis = liquidityAnalyzer.analyzeLiquidity(
      driftCalculations,
      availableCash,
      accountValue
    );

    // Add liquidity warnings
    if (!liquidityAnalysis.isFeasible) {
      preview.warnings.push(
        `Insufficient liquidity for full rebalance. ${liquidityAnalysis.partialRebalanceOption?.description || ''}`
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        accountId,
        accountValue,
        sells: preview.sells,
        buys: preview.buys,
        projectedAllocation: preview.projectedAllocation,
        totalSellValue: preview.totalSellValue,
        totalBuyValue: preview.totalBuyValue,
        totalCommissions: preview.totalCommissions,
        cashNeeded: preview.cashNeeded,
        cashGenerated: preview.cashGenerated,
        netCashMovement: preview.netCashMovement,
        isAllocatingPercentages: preview.isAllocatingPercentages,
        warnings: preview.warnings,
        estimatedExecutionTime: preview.estimatedExecutionTime,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error calculating rebalance preview:', error);

    return res.status(500).json({
      error: 'Failed to calculate rebalance preview',
      code: 'REBALANCE_CALCULATION_FAILED',
      details: error instanceof Error ? error.message : undefined,
    });
  }
}

export default handler;

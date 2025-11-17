/**
 * Cash Deployment Service
 * Calculates proportional cash allocation across underweight positions
 * Handles reserve protection and rounding for minimal leftover cash
 * 
 * User Story 5: Deploy available cash into underweight positions according to model allocation
 * Performance Target: SC-005 Calculation <1s
 */

import type { DriftCalculation } from './drift-calculator.service';

/**
 * Proposed trade to execute during deployment
 */
export interface ProposedTrade {
  symbol: string;
  action: 'BUY'; // Cash deployment only buys underweight
  targetAllocationDollars: number;
  quantity: number; // Calculated based on current price
  estimatedPrice: number; // Current market price
  totalCost: number; // quantity * estimatedPrice
  orderType: 'MARKET' | 'LIMIT';
}

/**
 * Preview of cash deployment showing all proposed trades and projected allocation
 */
export interface DeploymentPreview {
  accountId: string;
  availableCash: number;
  reserveAmount: number;
  cashToDeployAmount: number;
  underweightPositions: Array<{
    symbol: string;
    currentWeight: number;
    targetWeight: number;
    shortfall: number;
    targetAllocationDollars: number;
  }>;
  proposedTrades: ProposedTrade[];
  projectedAllocation: Array<{
    symbol: string;
    currentValue: number;
    postDeploymentValue: number;
    currentWeight: number;
    projectedWeight: number;
  }>;
  totalDeploymentCost: number;
  remainingCash: number;
  estimatedExecutionTime: number; // milliseconds
  warnings: string[];
}

export class CashDeploymentService {
  /**
   * Calculate deployment preview with proposed trades
   * Allocates available cash proportionally across underweight positions
   * 
   * Acceptance Criteria:
   * - Algorithm calculates target dollar amounts for underweight tickers
   * - Trades proportionally allocated across underweights
   * - Reserve amount protected (not deployed)
   * - Insufficient cash handled: proportional allocation across available funds
   * - Rounding handled: minimal leftover cash
   * 
   * @param availableCash - Cash available for deployment
   * @param reserveAmount - Minimum cash to keep in reserve (protected from deployment)
   * @param driftCalculations - Current drift for all positions
   * @param accountValue - Total account value
   * @returns Preview of proposed deployment with all trades
   */
  calculateDeploymentPreview(
    accountId: string,
    availableCash: number,
    reserveAmount: number,
    driftCalculations: DriftCalculation[],
    accountValue: number,
  ): DeploymentPreview {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Validate inputs
    if (availableCash < 0) {
      throw new Error('Available cash cannot be negative');
    }
    if (reserveAmount < 0) {
      throw new Error('Reserve amount cannot be negative');
    }
    if (reserveAmount > availableCash) {
      warnings.push('Reserve amount exceeds available cash');
    }

    // Calculate deployable cash (after reserve)
    const cashToDeployAmount = Math.max(0, availableCash - reserveAmount);

    // Get only underweight positions
    const underweightPositions = driftCalculations.filter((d) => d.isUnderweight);

    // If no underweights or no cash to deploy, return empty preview
    if (underweightPositions.length === 0 || cashToDeployAmount <= 0) {
      return {
        accountId,
        availableCash,
        reserveAmount,
        cashToDeployAmount,
        underweightPositions: [],
        proposedTrades: [],
        projectedAllocation: driftCalculations.map((d) => ({
          symbol: d.symbol,
          currentValue: d.currentValue,
          postDeploymentValue: d.currentValue,
          currentWeight: d.currentWeight,
          projectedWeight: d.currentWeight,
        })),
        totalDeploymentCost: 0,
        remainingCash: availableCash,
        estimatedExecutionTime: Date.now() - startTime,
        warnings,
      };
    }

    // Calculate total underweight shortfall (in dollars)
    const totalUnderweightShortfall = underweightPositions.reduce((sum, pos) => {
      const dollarShortfall = (Math.abs(pos.drift) / 100) * accountValue;
      return sum + dollarShortfall;
    }, 0);

    // If we have enough cash to fully cover underweights, use it for that
    // Otherwise, proportionally allocate across underweights
    const cashAllocationRatio = Math.min(1, cashToDeployAmount / totalUnderweightShortfall);

    // Calculate proposed trades with proper rounding
    const proposedTrades: ProposedTrade[] = [];
    let totalDeploymentCost = 0;

    underweightPositions.forEach((pos, index) => {
      const dollarShortfall = (Math.abs(pos.drift) / 100) * accountValue;
      const targetAllocationDollars = dollarShortfall * cashAllocationRatio;

      // Calculate quantity (round down to avoid overshooting)
      const quantity = Math.floor(targetAllocationDollars / pos.currentPrice);

      // Only create trade if quantity > 0
      if (quantity > 0) {
        const totalCost = quantity * pos.currentPrice;
        proposedTrades.push({
          symbol: pos.symbol,
          action: 'BUY',
          targetAllocationDollars,
          quantity,
          estimatedPrice: pos.currentPrice,
          totalCost,
          orderType: 'MARKET',
        });
        totalDeploymentCost += totalCost;
      } else if (index === underweightPositions.length - 1 && totalDeploymentCost < cashToDeployAmount) {
        // On last position, try to use remaining cash if there's any left
        const remainingCash = Math.min(
          cashToDeployAmount - totalDeploymentCost,
          cashToDeployAmount * 0.01, // Limit remainder to 1% to avoid large fractional trades
        );
        const remainingQuantity = Math.floor(remainingCash / pos.currentPrice);
        if (remainingQuantity > 0) {
          const remainingCost = remainingQuantity * pos.currentPrice;
          proposedTrades.push({
            symbol: pos.symbol,
            action: 'BUY',
            targetAllocationDollars: remainingCash,
            quantity: remainingQuantity,
            estimatedPrice: pos.currentPrice,
            totalCost: remainingCost,
            orderType: 'MARKET',
          });
          totalDeploymentCost += remainingCost;
        }
      }
    });

    // Calculate projected allocation after deployment
    const projectedAllocation = driftCalculations.map((d) => {
      const relevantTrade = proposedTrades.find((t) => t.symbol === d.symbol);
      const postDeploymentValue = d.currentValue + (relevantTrade?.totalCost || 0);
      const projectedAccountValue = accountValue + totalDeploymentCost;
      const projectedWeight = (postDeploymentValue / projectedAccountValue) * 100;

      return {
        symbol: d.symbol,
        currentValue: d.currentValue,
        postDeploymentValue,
        currentWeight: d.currentWeight,
        projectedWeight,
      };
    });

    const remainingCash = availableCash - totalDeploymentCost;

    // Validate remaining cash is non-negative
    if (remainingCash < 0) {
      warnings.push('Calculated remaining cash is negative - rounding error detected');
    }

    return {
      accountId,
      availableCash,
      reserveAmount,
      cashToDeployAmount,
      underweightPositions: underweightPositions.map((pos) => ({
        symbol: pos.symbol,
        currentWeight: pos.currentWeight,
        targetWeight: pos.targetWeight,
        shortfall: Math.abs(pos.drift),
        targetAllocationDollars: (Math.abs(pos.drift) / 100) * accountValue,
      })),
      proposedTrades,
      projectedAllocation,
      totalDeploymentCost,
      remainingCash,
      estimatedExecutionTime: Date.now() - startTime,
      warnings,
    };
  }

  /**
   * Validate that a deployment preview is safe to execute
   * Checks for edge cases and potential issues
   * 
   * @param preview - Deployment preview to validate
   * @returns { valid: boolean, errors: string[] }
   */
  validateDeployment(preview: DeploymentPreview): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for no trades
    if (preview.proposedTrades.length === 0) {
      errors.push('No trades to execute');
    }

    // Check for negative remaining cash
    if (preview.remainingCash < 0) {
      errors.push('Remaining cash calculation is negative');
    }

    // Check for excessive cash allocation
    if (preview.totalDeploymentCost > preview.cashToDeployAmount) {
      errors.push('Total deployment cost exceeds available cash for deployment');
    }

    // Check for high rounding losses (>2% of deployment amount)
    const roundingLoss = preview.cashToDeployAmount - preview.totalDeploymentCost;
    if (roundingLoss > preview.cashToDeployAmount * 0.02) {
      errors.push(`High rounding loss detected: $${roundingLoss.toFixed(2)}`);
    }

    // Check for extreme projected weights (safety check)
    for (const alloc of preview.projectedAllocation) {
      if (alloc.projectedWeight > 100) {
        errors.push(`${alloc.symbol} projected weight exceeds 100%`);
      }
      if (alloc.projectedWeight < 0) {
        errors.push(`${alloc.symbol} projected weight is negative`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate minimum cash needed to meaningfully deploy
   * Avoids deployment when cash is too small to move allocations
   * 
   * @param driftCalculations - Current drift for positions
   * @param accountValue - Total account value
   * @param minimumAllocationChangePercent - Minimum change required per ticker (default 0.5%)
   * @returns Minimum cash needed in dollars
   */
  calculateMinimumDeployableAmount(
    driftCalculations: DriftCalculation[],
    accountValue: number,
    minimumAllocationChangePercent: number = 0.5,
  ): number {
    const underweights = driftCalculations.filter((d) => d.isUnderweight);

    if (underweights.length === 0) {
      return 0;
    }

    // Average minimum needed per underweight position
    const minPerPosition = (minimumAllocationChangePercent / 100) * accountValue;

    // For proportional allocation across N underweights, we need N * minPerPosition
    return minPerPosition * underweights.length;
  }

  /**
   * Calculate optimal reserve amount based on account value
   * Recommendation: 2-5% of account value
   * 
   * @param accountValue - Total account value
   * @param reservePercentage - Percentage to reserve (default 3%)
   * @returns Recommended reserve amount in dollars
   */
  calculateRecommendedReserve(accountValue: number, reservePercentage: number = 3): number {
    return (reservePercentage / 100) * accountValue;
  }

  /**
   * Check if deployment is worthwhile given cash available
   * Returns false if cash is too small to meaningfully affect allocations
   * 
   * @param availableCash - Available cash
   * @param reserveAmount - Reserve amount
   * @param accountValue - Total account value
   * @param minAllocationChangePct - Minimum change % per position
   * @returns true if deployment is worthwhile
   */
  isDeploymentWorthwhile(
    availableCash: number,
    reserveAmount: number,
    accountValue: number,
    minAllocationChangePct: number = 0.5,
  ): boolean {
    const deployableAmount = Math.max(0, availableCash - reserveAmount);
    const minimumThreshold = (minAllocationChangePct / 100) * accountValue;

    return deployableAmount >= minimumThreshold;
  }

  /**
   * Estimate transaction costs for proposed trades
   * 
   * @param proposedTrades - List of proposed trades
   * @param commissionPerTrade - Fixed commission per trade (default $0 - modern brokers often free)
   * @param commissionPct - Percentage commission (default 0.1%)
   * @returns Estimated total transaction cost in dollars
   */
  estimateTransactionCosts(
    proposedTrades: ProposedTrade[],
    commissionPerTrade: number = 0,
    commissionPct: number = 0.001,
  ): number {
    const flatCommission = proposedTrades.length * commissionPerTrade;
    const percentCommission = proposedTrades.reduce((sum, trade) => sum + trade.totalCost * commissionPct, 0);

    return flatCommission + percentCommission;
  }

  /**
   * Handle edge case: insufficient cash after reserve
   * Return alternative deployment across available funds
   * 
   * @param availableCash - Available cash
   * @param reserveAmount - Reserve amount
   * @param driftCalculations - Current drift
   * @param accountValue - Total account value
   * @returns Limited deployment preview
   */
  handleInsufficientCash(
    accountId: string,
    availableCash: number,
    reserveAmount: number,
    driftCalculations: DriftCalculation[],
    accountValue: number,
  ): DeploymentPreview {
    // When cash is insufficient, still calculate deployment using what's available
    // The proportional allocation algorithm will handle it gracefully
    return this.calculateDeploymentPreview(
      accountId,
      Math.max(0, availableCash - reserveAmount),
      0, // Don't apply reserve twice
      driftCalculations,
      accountValue,
    );
  }

  /**
   * Calculate impact of deployment on portfolio metrics
   * Used for preview and education
   * 
   * @param preview - Deployment preview
   * @param currentDriftSummary - Current drift metrics
   * @returns Impact analysis
   */
  analyzeDeploymentImpact(preview: DeploymentPreview, currentWeights: Record<string, number>) {
    const postDeploymentWeights: Record<string, number> = {};

    for (const alloc of preview.projectedAllocation) {
      postDeploymentWeights[alloc.symbol] = alloc.projectedWeight;
    }

    // Calculate drift reduction
    const preDeploymentDrift = Object.entries(currentWeights).reduce((sum, [symbol, weight]) => {
      const target = preview.projectedAllocation.find((a) => a.symbol === symbol)?.projectedWeight || 0;
      return sum + Math.abs(weight - target);
    }, 0);

    const postDeploymentDrift = Object.entries(postDeploymentWeights).reduce((sum, [symbol, weight]) => {
      const target = preview.projectedAllocation.find((a) => a.symbol === symbol)?.projectedWeight || 0;
      return sum + Math.abs(weight - target);
    }, 0);

    return {
      preDeploymentTotalDrift: preDeploymentDrift,
      postDeploymentTotalDrift: postDeploymentDrift,
      driftReduction: preDeploymentDrift - postDeploymentDrift,
      driftReductionPercent: ((preDeploymentDrift - postDeploymentDrift) / preDeploymentDrift) * 100 || 0,
    };
  }
}

// Export singleton instance
export const cashDeploymentService = new CashDeploymentService();

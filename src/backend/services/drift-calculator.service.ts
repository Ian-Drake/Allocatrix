/**
 * Drift Calculator Service
 * Computes drift percentage for each ticker comparing current allocation vs target
 * A drift >5% triggers highlighting in UI (red for overweight, green for underweight)
 */

interface Position {
  symbol: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  percentOfAccount: number;
}

interface ModelAllocation {
  symbol: string;
  targetWeightPct: number; // Percentage of entire portfolio
}

interface DriftCalculation {
  symbol: string;
  currentWeight: number; // % of portfolio
  targetWeight: number; // % of portfolio
  drift: number; // Positive = overweight, Negative = underweight
  driftPct: number; // Absolute difference
  isOverweight: boolean;
  isUnderweight: boolean;
  isHighDrift: boolean; // |drift| > 5%
  currentValue: number;
  quantity: number;
  currentPrice: number;
}

interface DriftSummary {
  timestamp: number;
  totalDriftScore: number; // Sum of absolute drift % across all positions
  maxDrift: number; // Largest single drift
  minDrift: number; // Smallest single drift
  positionsOverweight: number; // Count of overweight positions
  positionsUnderweight: number; // Count of underweight positions
  positionsHighDrift: number; // Count with |drift| > 5%
  averageDrift: number; // Mean absolute drift
  rebalanceNeeded: boolean; // true if any drift > 5%
}

export class DriftCalculatorService {
  /**
   * Calculate drift for all positions compared to model allocation
   */
  calculateDrift(
    positions: Position[],
    modelAllocations: ModelAllocation[],
    accountValue: number,
  ): DriftCalculation[] {
    if (accountValue <= 0) {
      throw new Error('Account value must be greater than 0');
    }

    // Create a map of symbol to target weight for quick lookup
    const targetWeightMap = new Map<string, number>();
    modelAllocations.forEach((alloc) => {
      targetWeightMap.set(alloc.symbol, alloc.targetWeightPct);
    });

    // Calculate drift for each position
    const driftResults: DriftCalculation[] = positions.map((pos) => {
      const currentWeight = (pos.currentValue / accountValue) * 100;
      const targetWeight = targetWeightMap.get(pos.symbol) || 0;
      const drift = currentWeight - targetWeight;
      const isOverweight = drift > 0;
      const isUnderweight = drift < 0;
      const driftPct = Math.abs(drift);
      const isHighDrift = driftPct > 5;

      return {
        symbol: pos.symbol,
        currentWeight,
        targetWeight,
        drift,
        driftPct,
        isOverweight,
        isUnderweight,
        isHighDrift,
        currentValue: pos.currentValue,
        quantity: pos.quantity,
        currentPrice: pos.currentPrice,
      };
    });

    // Add positions that are in the model but not currently held
    modelAllocations.forEach((alloc) => {
      if (!targetWeightMap.has(alloc.symbol)) {
        return; // Already in results
      }
      if (!positions.some((p) => p.symbol === alloc.symbol)) {
        driftResults.push({
          symbol: alloc.symbol,
          currentWeight: 0,
          targetWeight: alloc.targetWeightPct,
          drift: -alloc.targetWeightPct,
          driftPct: alloc.targetWeightPct,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: alloc.targetWeightPct > 5,
          currentValue: 0,
          quantity: 0,
          currentPrice: 0,
        });
      }
    });

    // Sort by drift (most overweight to most underweight)
    return driftResults.sort((a, b) => b.drift - a.drift);
  }

  /**
   * Calculate summary metrics for drift across all positions
   */
  calculateDriftSummary(driftCalculations: DriftCalculation[]): DriftSummary {
    if (driftCalculations.length === 0) {
      return {
        timestamp: Date.now(),
        totalDriftScore: 0,
        maxDrift: 0,
        minDrift: 0,
        positionsOverweight: 0,
        positionsUnderweight: 0,
        positionsHighDrift: 0,
        averageDrift: 0,
        rebalanceNeeded: false,
      };
    }

    const totalDriftScore = driftCalculations.reduce(
      (sum, calc) => sum + calc.driftPct,
      0,
    );

    const maxDrift = Math.max(...driftCalculations.map((c) => c.drift));
    const minDrift = Math.min(...driftCalculations.map((c) => c.drift));
    const positionsOverweight = driftCalculations.filter(
      (c) => c.isOverweight,
    ).length;
    const positionsUnderweight = driftCalculations.filter(
      (c) => c.isUnderweight,
    ).length;
    const positionsHighDrift = driftCalculations.filter(
      (c) => c.isHighDrift,
    ).length;
    const averageDrift = totalDriftScore / driftCalculations.length;
    const rebalanceNeeded = positionsHighDrift > 0;

    return {
      timestamp: Date.now(),
      totalDriftScore,
      maxDrift,
      minDrift,
      positionsOverweight,
      positionsUnderweight,
      positionsHighDrift,
      averageDrift,
      rebalanceNeeded,
    };
  }

  /**
   * Get overweight positions (for potential selling)
   */
  getOverweightPositions(driftCalculations: DriftCalculation[]): DriftCalculation[] {
    return driftCalculations.filter((c) => c.isOverweight).sort((a, b) => b.drift - a.drift);
  }

  /**
   * Get underweight positions (for potential buying)
   */
  getUnderweightPositions(driftCalculations: DriftCalculation[]): DriftCalculation[] {
    return driftCalculations.filter((c) => c.isUnderweight).sort((a, b) => a.drift - b.drift);
  }

  /**
   * Get positions with high drift (>5%)
   */
  getHighDriftPositions(driftCalculations: DriftCalculation[]): DriftCalculation[] {
    return driftCalculations.filter((c) => c.isHighDrift);
  }

  /**
   * Calculate cash needed to close underweight gaps
   * Returns total $ needed to bring all underweights to target
   */
  calculateCashNeededToRebalance(
    driftCalculations: DriftCalculation[],
    accountValue: number,
  ): number {
    const underweightPositions = this.getUnderweightPositions(driftCalculations);

    const cashNeeded = underweightPositions.reduce((sum, pos) => {
      const dollarShortfall = (Math.abs(pos.drift) / 100) * accountValue;
      return sum + dollarShortfall;
    }, 0);

    return cashNeeded;
  }

  /**
   * Estimate the cost in trades to close drift
   * Assumes fixed commission per trade + percentage commission
   */
  estimateRebalanceCost(
    driftCalculations: DriftCalculation[],
    commissionPerTrade: number = 0,
    commissionPct: number = 0.001, // 0.1%
  ): number {
    // Each overweight position requires a sell, each underweight requires a buy
    // Some positions might be both rebalancing-affected
    const estimatedTrades = Math.max(
      driftCalculations.filter((c) => c.isOverweight).length,
      driftCalculations.filter((c) => c.isUnderweight).length,
    ) * 2; // Sell + Buy for each pair

    // Calculate percentage commission on total value
    const totalValue = driftCalculations.reduce((sum, c) => sum + c.currentValue, 0);
    const percentCommission = totalValue * commissionPct;
    const flatCommission = estimatedTrades * commissionPerTrade;

    return flatCommission + percentCommission;
  }

  /**
   * Check if drift is within acceptable tolerance (no rebalance needed)
   */
  isWithinAcceptableDrift(driftCalculations: DriftCalculation[], tolerancePct: number = 5): boolean {
    return !driftCalculations.some((c) => c.driftPct > tolerancePct);
  }

  /**
   * Get asset class level drift
   * Useful when you have tickers grouped by asset class
   */
  getAssetClassDrift(
    driftCalculations: DriftCalculation[],
    assetClassMap: Record<string, string[]>, // { assetClassId: [ticker1, ticker2] }
  ): Record<string, { drift: number; weight: number; targetWeight: number }> {
    const acDrift: Record<string, { drift: number; weight: number; targetWeight: number }> = {};

    for (const [acId, symbols] of Object.entries(assetClassMap)) {
      const relevantCalcs = driftCalculations.filter((c) =>
        symbols.includes(c.symbol),
      );

      const weight = relevantCalcs.reduce((sum, c) => sum + c.currentWeight, 0);
      const targetWeight = relevantCalcs.reduce((sum, c) => sum + c.targetWeight, 0);
      const drift = weight - targetWeight;

      acDrift[acId] = { drift, weight, targetWeight };
    }

    return acDrift;
  }
}

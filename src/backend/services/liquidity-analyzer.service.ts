/**
 * Liquidity Analyzer Service
 * Analyzes account liquidity to determine if rebalance operations are feasible
 * 
 * User Story 6: Full Rebalance (Priority: P2)
 * Acceptance Criteria:
 * - Insufficient liquidity detected and alternative suggested
 * - Identifies problematic tickers and suggests partial rebalance
 */

import type { DriftCalculation } from './drift-calculator.service';

/**
 * Liquidity analysis for a specific ticker
 */
export interface TickerLiquidityAnalysis {
  symbol: string;
  currentValue: number;
  targetValue: number; // Dollar value based on target weight
  tradeAmount: number; // Positive for buys, negative for sells
  tradeAction: 'BUY' | 'SELL';
  estimatedPrice: number;
  quantityToTrade: number;
  estimatedLiquidity: number; // Available cash after this trade
  isFeasible: boolean; // Can trade this amount
  reason?: string; // Why not feasible if applicable
}

/**
 * Full liquidity analysis result
 */
export interface LiquidityAnalysisResult {
  isFeasible: boolean; // Can perform full rebalance
  totalCashNeeded: number; // Cash required for all buys
  availableCash: number;
  requiredCash: number;
  surplus: number; // Positive if enough cash, negative if short
  problematicTickers: TickerLiquidityAnalysis[]; // Tickers that can't be fully rebalanced
  feasibleTrades: TickerLiquidityAnalysis[]; // Tickers that can be rebalanced
  partialRebalanceOption?: {
    description: string;
    trades: TickerLiquidityAnalysis[];
    projectedAllocation: Array<{
      symbol: string;
      currentWeight: number;
      projectedWeight: number;
    }>;
  };
}

export class LiquidityAnalyzerService {
  /**
   * Analyze if rebalance is feasible given current positions and cash
   * 
   * @param driftCalculations - Current drift for all positions
   * @param availableCash - Available cash in account
   * @param accountValue - Total account value
   * @returns Liquidity analysis result with feasibility and alternatives
   */
  analyzeLiquidity(
    driftCalculations: DriftCalculation[],
    availableCash: number,
    accountValue: number,
  ): LiquidityAnalysisResult {
    const analysis: LiquidityAnalysisResult = {
      isFeasible: true,
      totalCashNeeded: 0,
      availableCash,
      requiredCash: 0,
      surplus: availableCash,
      problematicTickers: [],
      feasibleTrades: [],
    };

    // Helper to calculate target value from target weight percentage
    const getTargetValue = (targetWeight: number): number => (targetWeight / 100) * accountValue;

    // Separate sells and buys (negative drift = underweight = buy, positive = overweight = sell)
    const underweight = driftCalculations.filter((d) => d.drift < 0); // Buy
    const overweight = driftCalculations.filter((d) => d.drift > 0); // Sell

    // Calculate cash generated from sells
    let cashFromSells = 0;
    for (const sell of overweight) {
      const targetValue = getTargetValue(sell.targetWeight);
      const sellValue = sell.currentValue - targetValue;
      if (sellValue > 0) {
        cashFromSells += sellValue;
      }
    }

    // Calculate cash needed for buys
    let cashNeededForBuys = 0;
    for (const buy of underweight) {
      const targetValue = getTargetValue(buy.targetWeight);
      const buyValue = targetValue - buy.currentValue;
      if (buyValue > 0) {
        cashNeededForBuys += buyValue;
      }
    }

    analysis.requiredCash = cashNeededForBuys;
    analysis.totalCashNeeded = cashNeededForBuys;

    // Available cash = current cash + proceeds from sells
    const totalAvailableForBuys = availableCash + cashFromSells;
    analysis.surplus = totalAvailableForBuys - cashNeededForBuys;

    // Determine feasibility
    if (analysis.surplus >= 0) {
      analysis.isFeasible = true;
      // All trades are feasible
      for (const drift of driftCalculations) {
        const targetValue = getTargetValue(drift.targetWeight);
        const tradeAmount = Math.abs(drift.currentValue - targetValue);
        if (tradeAmount > 0.01) {
          // Ignore trades < $0.01
          analysis.feasibleTrades.push({
            symbol: drift.symbol,
            currentValue: drift.currentValue,
            targetValue,
            tradeAmount,
            tradeAction: drift.isUnderweight ? 'BUY' : 'SELL',
            estimatedPrice: drift.currentPrice,
            quantityToTrade: Math.round((tradeAmount / drift.currentPrice) * 100) / 100,
            estimatedLiquidity: 0,
            isFeasible: true,
          });
        }
      }
    } else {
      analysis.isFeasible = false;
      const cashShortfall = Math.abs(analysis.surplus);

      // Identify problematic tickers (those that won't fit in available cash)
      let remainingCash = totalAvailableForBuys;
      const buysProcessed = underweight.map((b, i) => ({
        drift: b,
        orderIndex: i,
      }));

      // Sort by drift magnitude (smallest drift first) to maximize completion
      buysProcessed.sort((a, b) => Math.abs(a.drift.drift) - Math.abs(b.drift.drift));

      for (const buyItem of buysProcessed) {
        const buy = buyItem.drift;
        const targetValue = getTargetValue(buy.targetWeight);
        const buyValue = targetValue - buy.currentValue;

        if (buyValue > 0 && remainingCash >= buyValue) {
          // Can do this buy
          analysis.feasibleTrades.push({
            symbol: buy.symbol,
            currentValue: buy.currentValue,
            targetValue,
            tradeAmount: buyValue,
            tradeAction: 'BUY',
            estimatedPrice: buy.currentPrice,
            quantityToTrade: Math.round((buyValue / buy.currentPrice) * 100) / 100,
            estimatedLiquidity: remainingCash - buyValue,
            isFeasible: true,
          });
          remainingCash -= buyValue;
        } else if (buyValue > 0) {
          // Cannot do this buy
          analysis.problematicTickers.push({
            symbol: buy.symbol,
            currentValue: buy.currentValue,
            targetValue,
            tradeAmount: buyValue,
            tradeAction: 'BUY',
            estimatedPrice: buy.currentPrice,
            quantityToTrade: Math.round((buyValue / buy.currentPrice) * 100) / 100,
            estimatedLiquidity: remainingCash,
            isFeasible: false,
            reason: `Insufficient cash. Need $${buyValue.toFixed(2)}, have $${remainingCash.toFixed(2)}`,
          });
        }
      }

      // All sells are feasible (selling generates cash)
      for (const sell of overweight) {
        const targetValue = getTargetValue(sell.targetWeight);
        const sellValue = sell.currentValue - targetValue;
        if (sellValue > 0) {
          analysis.feasibleTrades.push({
            symbol: sell.symbol,
            currentValue: sell.currentValue,
            targetValue,
            tradeAmount: sellValue,
            tradeAction: 'SELL',
            estimatedPrice: sell.currentPrice,
            quantityToTrade: Math.round((sellValue / sell.currentPrice) * 100) / 100,
            estimatedLiquidity: 0,
            isFeasible: true,
          });
        }
      }

      // Create partial rebalance option
      analysis.partialRebalanceOption = {
        description: `Partial rebalance: Execute ${analysis.feasibleTrades.length} trades. Shortage: $${cashShortfall.toFixed(2)}`,
        trades: analysis.feasibleTrades,
        projectedAllocation: driftCalculations.map((d) => {
          // Find if this is in feasible trades
          const feasibleTrade = analysis.feasibleTrades.find((t) => t.symbol === d.symbol);
          let projectedValue = d.currentValue;

          if (feasibleTrade) {
            if (feasibleTrade.tradeAction === 'BUY') {
              projectedValue += feasibleTrade.tradeAmount;
            } else {
              projectedValue -= feasibleTrade.tradeAmount;
            }
          }

          return {
            symbol: d.symbol,
            currentWeight: d.currentWeight,
            projectedWeight: (projectedValue / accountValue) * 100,
          };
        }),
      };
    }

    return analysis;
  }
}

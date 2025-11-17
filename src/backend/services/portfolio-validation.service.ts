/**
 * Portfolio Validation Service
 * 
 * Validates portfolio weight constraints:
 * - Asset class weights must sum to 100% ±1% tolerance
 * - Ticker weights within asset class must sum to 100% ±1% tolerance
 * - Effective ticker weight = AssetClassWeight × TickerWeightWithinAssetClass
 * 
 * Per FR-005: Weight Validation
 */

const WEIGHT_TOLERANCE = 1; // ±1% tolerance for weight validation

export interface AssetClassForValidation {
  name: string;
  targetWeightPct: number;
}

export interface TickerForValidation {
  symbol: string;
  targetWeightPctWithinAssetClass: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  assetClassSum: number;
  tickerSums: Map<string, number>;
}

/**
 * Validates that weights sum to 100% ±tolerance
 */
function validateWeightSum(weights: number[], _context: string, tolerance: number = WEIGHT_TOLERANCE): {
  valid: boolean;
  sum: number;
} {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const valid = Math.abs(sum - 100) <= tolerance;
  return { valid, sum };
}

/**
 * Validates asset class weights sum to 100% ±1%
 */
export function validateAssetClassWeights(weights: number[]): {
  valid: boolean;
  sum: number;
} {
  return validateWeightSum(weights, 'Asset classes');
}

/**
 * Validates ticker weights within asset class sum to 100% ±1%
 */
export function validateTickerWeightsWithinAssetClass(weights: number[]): {
  valid: boolean;
  sum: number;
} {
  return validateWeightSum(weights, 'Ticker weights', WEIGHT_TOLERANCE);
}

/**
 * Validates entire portfolio structure
 * - Asset class weights must sum to 100% ±1%
 * - For each asset class with tickers, ticker weights must sum to 100% ±1%
 */
export function validatePortfolio(
  assetClasses: AssetClassForValidation[],
  tickersByAssetClass: Map<string, TickerForValidation[]>
): ValidationResult {
  const errors: string[] = [];
  const tickerSums = new Map<string, number>();

  // Validate asset class weights
  const assetClassWeights = assetClasses.map((ac) => ac.targetWeightPct);
  const { valid: acValid, sum: acSum } = validateAssetClassWeights(assetClassWeights);

  if (!acValid) {
    errors.push(
      `Asset class weights sum to ${acSum.toFixed(2)}%, expected 100% ±${WEIGHT_TOLERANCE}%`
    );
  }

  // Validate ticker weights within each asset class
  assetClasses.forEach((assetClass) => {
    const tickers = tickersByAssetClass.get(assetClass.name) || [];
    if (tickers.length > 0) {
      const tickerWeights = tickers.map((t) => t.targetWeightPctWithinAssetClass);
      const { valid: tickerValid, sum: tickerSum } = validateTickerWeightsWithinAssetClass(tickerWeights);
      tickerSums.set(assetClass.name, tickerSum);

      if (!tickerValid) {
        errors.push(
          `Ticker weights in ${assetClass.name} sum to ${tickerSum.toFixed(2)}%, expected 100% ±${WEIGHT_TOLERANCE}%`
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    assetClassSum: acSum,
    tickerSums,
  };
}

/**
 * Calculates effective ticker weight in portfolio
 * Formula: TickerWeight = AssetClassWeight × TickerWeightWithinAssetClass
 */
export function calculateEffectiveTickerWeight(
  assetClassWeight: number,
  tickerWeightWithinAssetClass: number
): number {
  return (assetClassWeight / 100) * tickerWeightWithinAssetClass;
}

/**
 * Calculates all effective ticker weights for a portfolio
 */
export function calculateAllEffectiveTickerWeights(
  assetClasses: AssetClassForValidation[],
  tickersByAssetClass: Map<string, TickerForValidation[]>
): Map<string, number> {
  const effectiveWeights = new Map<string, number>();

  assetClasses.forEach((assetClass) => {
    const tickers = tickersByAssetClass.get(assetClass.name) || [];
    tickers.forEach((ticker) => {
      const effectiveWeight = calculateEffectiveTickerWeight(
        assetClass.targetWeightPct,
        ticker.targetWeightPctWithinAssetClass
      );
      effectiveWeights.set(ticker.symbol, effectiveWeight);
    });
  });

  return effectiveWeights;
}

/**
 * Validates that portfolio structure can transition to Valid state
 * - Asset classes must exist
 * - Asset class weights must be valid
 * - All asset classes must have at least one ticker
 * - Ticker weights must be valid
 */
export function validatePortfolioCanTransitionToValid(
  assetClasses: AssetClassForValidation[],
  tickersByAssetClass: Map<string, TickerForValidation[]>
): { canTransition: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check asset classes exist
  if (assetClasses.length === 0) {
    errors.push('Portfolio must have at least one asset class');
    return { canTransition: false, errors };
  }

  // Validate weights
  const validationResult = validatePortfolio(assetClasses, tickersByAssetClass);
  if (!validationResult.valid) {
    errors.push(...validationResult.errors);
  }

  // Check all asset classes have tickers
  assetClasses.forEach((assetClass) => {
    const tickers = tickersByAssetClass.get(assetClass.name);
    if (!tickers || tickers.length === 0) {
      errors.push(`Asset class "${assetClass.name}" must have at least one ticker`);
    }
  });

  return {
    canTransition: errors.length === 0,
    errors,
  };
}

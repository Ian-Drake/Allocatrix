import { describe, it, expect } from 'vitest';

/**
 * Portfolio Validation Tests (TDD: Red-Green-Refactor)
 * 
 * Test weight sum validation to ensure portfolios sum to 100% ±1% tolerance
 * as per FR-005: Weight Validation
 * 
 * Acceptance Criteria:
 * - Portfolio with sum = 100% is valid
 * - Portfolio with sum = 99.5% is valid (within tolerance)
 * - Portfolio with sum = 100.5% is valid (within tolerance)
 * - Portfolio with sum = 98.5% is invalid (outside tolerance)
 * - Portfolio with sum = 101.5% is invalid (outside tolerance)
 * - Asset class weights must sum to 100% ±1% tolerance
 * - Ticker weights within asset class must sum to 100% ±1% tolerance
 */

interface AssetClassAllocation {
  name: string;
  weightPct: number;
}

interface TickerAllocation {
  symbol: string;
  weightPctWithinAssetClass: number;
}

interface PortfolioForValidation {
  name: string;
  assetClasses: AssetClassAllocation[];
  tickers: Map<string, TickerAllocation[]>; // assetClassName -> tickers
}

// Tolerance for weight validation (1%)
const WEIGHT_TOLERANCE = 1;

/**
 * Validates that asset class weights sum to 100% ±1%
 */
function validateAssetClassWeights(weights: number[]): { valid: boolean; sum: number } {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const valid = Math.abs(sum - 100) <= WEIGHT_TOLERANCE;
  return { valid, sum };
}

/**
 * Validates that ticker weights within an asset class sum to 100% ±1%
 */
function validateTickerWeightsWithinAssetClass(weights: number[]): { valid: boolean; sum: number } {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const valid = Math.abs(sum - 100) <= WEIGHT_TOLERANCE;
  return { valid, sum };
}

/**
 * Validates entire portfolio: all asset classes and all tickers
 */
function validatePortfolio(portfolio: PortfolioForValidation): {
  valid: boolean;
  errors: string[];
  assetClassSum: number;
  tickerSums: Map<string, number>;
} {
  const errors: string[] = [];
  const tickerSums = new Map<string, number>();

  // Validate asset class weights sum to 100%
  const assetClassWeights = portfolio.assetClasses.map((ac) => ac.weightPct);
  const { valid: acValid, sum: acSum } = validateAssetClassWeights(assetClassWeights);

  if (!acValid) {
    errors.push(`Asset class weights sum to ${acSum.toFixed(2)}%, expected 100% ±${WEIGHT_TOLERANCE}%`);
  }

  // Validate ticker weights within each asset class
  portfolio.assetClasses.forEach((assetClass) => {
    const tickers = portfolio.tickers.get(assetClass.name) || [];
    if (tickers.length > 0) {
      const tickerWeights = tickers.map((t) => t.weightPctWithinAssetClass);
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

describe('Portfolio Validation - Weight Sum (FR-005)', () => {
  describe('Asset Class Weight Validation', () => {
    it('should validate portfolio with exactly 100% weight', () => {
      const weights = [60, 40];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(true);
      expect(result.sum).toBe(100);
    });

    it('should validate portfolio with 99.5% weight (within tolerance)', () => {
      const weights = [59.5, 40];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(true);
      expect(result.sum).toBe(99.5);
    });

    it('should validate portfolio with 100.5% weight (within tolerance)', () => {
      const weights = [60.5, 40];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(true);
      expect(result.sum).toBe(100.5);
    });

    it('should reject portfolio with 98.5% weight (below tolerance)', () => {
      const weights = [58.5, 40];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(false);
      expect(result.sum).toBe(98.5);
    });

    it('should reject portfolio with 101.5% weight (above tolerance)', () => {
      const weights = [61.5, 40];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(false);
      expect(result.sum).toBe(101.5);
    });

    it('should handle multiple asset classes summing to 100%', () => {
      const weights = [30, 30, 20, 20];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(true);
      expect(result.sum).toBe(100);
    });

    it('should handle fractional weights', () => {
      const weights = [33.33, 33.33, 33.34];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(true);
      expect(result.sum).toBeCloseTo(100, 1);
    });
  });

  describe('Ticker Weight Validation Within Asset Class', () => {
    it('should validate tickers summing to exactly 100%', () => {
      const weights = [50, 50];
      const result = validateTickerWeightsWithinAssetClass(weights);
      expect(result.valid).toBe(true);
      expect(result.sum).toBe(100);
    });

    it('should validate tickers within tolerance', () => {
      const weights = [33.33, 33.33, 33.34];
      const result = validateTickerWeightsWithinAssetClass(weights);
      expect(result.valid).toBe(true);
    });

    it('should reject tickers outside tolerance', () => {
      const weights = [60, 30];
      const result = validateTickerWeightsWithinAssetClass(weights);
      expect(result.valid).toBe(false);
      expect(result.sum).toBe(90);
    });
  });

  describe('Full Portfolio Validation', () => {
    it('should validate complete valid portfolio', () => {
      const portfolio: PortfolioForValidation = {
        name: '60/40 Growth',
        assetClasses: [
          { name: 'Equities', weightPct: 60 },
          { name: 'Bonds', weightPct: 40 },
        ],
        tickers: new Map([
          ['Equities', [
            { symbol: 'AAPL', weightPctWithinAssetClass: 50 },
            { symbol: 'VTI', weightPctWithinAssetClass: 50 },
          ]],
          ['Bonds', [
            { symbol: 'BND', weightPctWithinAssetClass: 100 },
          ]],
        ]),
      };

      const result = validatePortfolio(portfolio);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.assetClassSum).toBe(100);
      expect(result.tickerSums.get('Equities')).toBe(100);
      expect(result.tickerSums.get('Bonds')).toBe(100);
    });

    it('should validate portfolio with multiple tickers per asset class', () => {
      const portfolio: PortfolioForValidation = {
        name: 'Diversified',
        assetClasses: [
          { name: 'US Equities', weightPct: 40 },
          { name: 'International', weightPct: 20 },
          { name: 'Bonds', weightPct: 40 },
        ],
        tickers: new Map([
          ['US Equities', [
            { symbol: 'VTI', weightPctWithinAssetClass: 50 },
            { symbol: 'QQQ', weightPctWithinAssetClass: 30 },
            { symbol: 'IJR', weightPctWithinAssetClass: 20 },
          ]],
          ['International', [
            { symbol: 'VXUS', weightPctWithinAssetClass: 100 },
          ]],
          ['Bonds', [
            { symbol: 'BND', weightPctWithinAssetClass: 70 },
            { symbol: 'SCHP', weightPctWithinAssetClass: 30 },
          ]],
        ]),
      };

      const result = validatePortfolio(portfolio);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject portfolio with invalid asset class weights', () => {
      const portfolio: PortfolioForValidation = {
        name: 'Invalid Allocation',
        assetClasses: [
          { name: 'Equities', weightPct: 60 },
          { name: 'Bonds', weightPct: 30 }, // Only 90% total
        ],
        tickers: new Map(),
      };

      const result = validatePortfolio(portfolio);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Asset class weights sum to');
    });

    it('should reject portfolio with invalid ticker weights in one asset class', () => {
      const portfolio: PortfolioForValidation = {
        name: 'Partial Invalid',
        assetClasses: [
          { name: 'Equities', weightPct: 60 },
          { name: 'Bonds', weightPct: 40 },
        ],
        tickers: new Map([
          ['Equities', [
            { symbol: 'AAPL', weightPctWithinAssetClass: 60 },
            { symbol: 'VTI', weightPctWithinAssetClass: 30 }, // Only 90%
          ]],
          ['Bonds', [
            { symbol: 'BND', weightPctWithinAssetClass: 100 },
          ]],
        ]),
      };

      const result = validatePortfolio(portfolio);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Ticker weights in Equities sum to');
    });

    it('should handle portfolio with no tickers yet (Draft state)', () => {
      const portfolio: PortfolioForValidation = {
        name: 'Empty Draft',
        assetClasses: [
          { name: 'Equities', weightPct: 60 },
          { name: 'Bonds', weightPct: 40 },
        ],
        tickers: new Map(),
      };

      const result = validatePortfolio(portfolio);
      // Should validate just the asset class weights when no tickers defined
      expect(result.assetClassSum).toBe(100);
    });

    it('should validate portfolio within 1% tolerance boundary', () => {
      const portfolio: PortfolioForValidation = {
        name: 'Boundary Case',
        assetClasses: [
          { name: 'Equities', weightPct: 60.5 },
          { name: 'Bonds', weightPct: 39.5 },
        ],
        tickers: new Map(),
      };

      const result = validatePortfolio(portfolio);
      expect(result.valid).toBe(true);
      expect(result.assetClassSum).toBe(100);
    });

    it('should reject portfolio outside 1% tolerance boundary', () => {
      const portfolio: PortfolioForValidation = {
        name: 'Outside Boundary',
        assetClasses: [
          { name: 'Equities', weightPct: 61.5 },
          { name: 'Bonds', weightPct: 39.8 },
        ],
        tickers: new Map(),
      };

      const result = validatePortfolio(portfolio);
      expect(result.valid).toBe(false);
      expect(result.assetClassSum).toBe(101.3); // Outside +1% tolerance
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty portfolio', () => {
      const portfolio: PortfolioForValidation = {
        name: 'Empty',
        assetClasses: [],
        tickers: new Map(),
      };

      const result = validatePortfolio(portfolio);
      expect(result.assetClassSum).toBe(0);
    });

    it('should handle zero weights', () => {
      const weights = [0, 0, 0];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(false);
      expect(result.sum).toBe(0);
    });

    it('should handle very small fractional weights', () => {
      const weights = [33.3333, 33.3333, 33.3334];
      const result = validateAssetClassWeights(weights);
      expect(result.valid).toBe(true);
    });
  });
});

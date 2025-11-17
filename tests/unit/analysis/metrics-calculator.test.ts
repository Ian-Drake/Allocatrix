import { describe, it, expect, beforeEach } from 'vitest';
import { AnalysisService } from '../../../src/backend/services/analysis.service';

/**
 * Unit tests for AnalysisService metric calculations
 * 
 * Test coverage:
 * - Return metric calculations (mean, stddev, min, max)
 * - Sharpe ratio calculation
 * - Maximum drawdown calculation
 * - Edge cases (empty arrays, zero values)
 */
describe('AnalysisService - Metrics Calculator', () => {
  let analysisService: AnalysisService;

  beforeEach(() => {
    analysisService = new AnalysisService(null as any);
  });

  describe('calculateReturnMetrics', () => {
    it('should calculate mean return correctly', () => {
      const returns = [5, 10, 15, 20];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.mean).toBe(12.5);
    });

    it('should calculate standard deviation correctly', () => {
      const returns = [10, 20, 30, 40, 50];
      const metrics = analysisService.calculateReturnMetrics(returns);

      // Expected stddev = sqrt(variance)
      // Mean = 30
      // Variance = [(10-30)^2 + (20-30)^2 + (30-30)^2 + (40-30)^2 + (50-30)^2] / 5
      //          = [400 + 100 + 0 + 100 + 400] / 5 = 200
      // StdDev = sqrt(200) ≈ 14.14
      expect(metrics.stdDev).toBeCloseTo(14.14, 1);
    });

    it('should find min and max returns', () => {
      const returns = [-5, 10, -15, 20, 3];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.min).toBe(-15);
      expect(metrics.max).toBe(20);
    });

    it('should handle empty array', () => {
      const returns: number[] = [];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.mean).toBe(0);
      expect(metrics.stdDev).toBe(0);
      expect(metrics.min).toBe(0);
      expect(metrics.max).toBe(0);
    });

    it('should handle single value', () => {
      const returns = [5.5];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.mean).toBe(5.5);
      expect(metrics.stdDev).toBe(0); // No variance with single value
      expect(metrics.min).toBe(5.5);
      expect(metrics.max).toBe(5.5);
    });

    it('should handle negative returns', () => {
      const returns = [-5, -10, -3, -8];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.mean).toBe(-6.5);
      expect(metrics.min).toBe(-10);
      expect(metrics.max).toBe(-3);
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should calculate Sharpe ratio for positive returns', () => {
      // Monthly returns of 1% with low volatility
      const returns = [1.0, 1.2, 0.8, 1.1, 0.9, 1.3, 1.0, 1.1, 0.9, 1.2, 1.0, 1.1];
      const sharpe = analysisService.calculateSharpeRatio(returns, 0.02, 12);

      // Annualized return ≈ 12% (1% * 12)
      // Risk-free rate = 2%
      // Excess return = 10%
      // With low volatility, Sharpe should be positive and reasonable
      expect(sharpe).toBeGreaterThan(0);
      expect(sharpe).toBeLessThan(10); // Sanity check
    });

    it('should handle zero volatility (constant returns)', () => {
      const returns = [2, 2, 2, 2, 2, 2];
      const sharpe = analysisService.calculateSharpeRatio(returns, 0.02, 12);

      // Zero volatility = infinite Sharpe, but we return 0
      expect(sharpe).toBe(0);
    });

    it('should handle negative average returns', () => {
      const returns = [-1, -2, -1.5, -1, -2, -1.5];
      const sharpe = analysisService.calculateSharpeRatio(returns, 0.02, 12);

      // Negative returns = negative Sharpe
      expect(sharpe).toBeLessThan(0);
    });

    it('should handle empty returns array', () => {
      const returns: number[] = [];
      const sharpe = analysisService.calculateSharpeRatio(returns);

      expect(sharpe).toBe(0);
    });

    it('should use custom risk-free rate', () => {
      const returns = [1, 1, 1, 1, 1, 1]; // 1% monthly
      const sharpe1 = analysisService.calculateSharpeRatio(returns, 0.02, 12); // 2% annual
      const sharpe2 = analysisService.calculateSharpeRatio(returns, 0.10, 12); // 10% annual

      // Higher risk-free rate = lower Sharpe
      expect(sharpe2).toBeLessThan(sharpe1);
    });

    it('should annualize properly for different periods', () => {
      const monthlyReturns = [1, 1, 1, 1, 1, 1]; // 1% monthly
      const quarterlyReturns = [3, 3, 3, 3]; // 3% quarterly

      const monthlySharpe = analysisService.calculateSharpeRatio(
        monthlyReturns,
        0.02,
        12,
      );
      const quarterlySharpe = analysisService.calculateSharpeRatio(
        quarterlyReturns,
        0.02,
        4,
      );

      // Both should annualize to ~12%, similar Sharpe
      expect(Math.abs(monthlySharpe - quarterlySharpe)).toBeLessThan(2);
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should calculate drawdown from peak', () => {
      const values = [100, 110, 105, 95, 90, 100, 105];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      // Peak = 110, trough = 90
      // Drawdown = (90 - 110) / 110 = -18.18%
      expect(maxDrawdown).toBeCloseTo(-18.18, 1);
    });

    it('should return 0 for always increasing values', () => {
      const values = [100, 105, 110, 115, 120];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      expect(maxDrawdown).toBe(0); // No drawdown
    });

    it('should handle single value', () => {
      const values = [100];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      expect(maxDrawdown).toBe(0);
    });

    it('should handle empty array', () => {
      const values: number[] = [];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      expect(maxDrawdown).toBe(0);
    });

    it('should find maximum drawdown across multiple declines', () => {
      const values = [
        100, 90, 95, // First drawdown: -10%
        110, 100, 105, // Second drawdown: -9.09%
        120, 80, 90, // Third drawdown: -33.33% (max)
        100,
      ];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      // Maximum drawdown should be from 120 to 80 = -33.33%
      expect(maxDrawdown).toBeCloseTo(-33.33, 1);
    });

    it('should handle severe market crash', () => {
      const values = [100, 105, 110, 55, 60, 65]; // 50% crash
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      // Peak = 110, trough = 55
      // Drawdown = (55 - 110) / 110 = -50%
      expect(maxDrawdown).toBeCloseTo(-50, 0);
    });

    it('should handle recovery after drawdown', () => {
      const values = [100, 120, 80, 100, 140];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      // Peak = 120, trough = 80 (before new peak)
      // Drawdown = (80 - 120) / 120 = -33.33%
      // Recovery to 140 doesn't change max drawdown
      expect(maxDrawdown).toBeCloseTo(-33.33, 1);
    });

    it('should handle flat portfolio', () => {
      const values = [100, 100, 100, 100, 100];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      expect(maxDrawdown).toBe(0);
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle very small returns', () => {
      const returns = [0.001, 0.002, 0.001, 0.003];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.mean).toBeCloseTo(0.00175, 5);
      expect(metrics.stdDev).toBeGreaterThan(0);
    });

    it('should handle very large returns', () => {
      const returns = [1000, 1500, 2000, 2500];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.mean).toBe(1750);
      expect(metrics.max).toBe(2500);
    });

    it('should handle mixed positive and negative returns', () => {
      const returns = [10, -5, 15, -10, 20, -3];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.min).toBe(-10);
      expect(metrics.max).toBe(20);
      expect(metrics.mean).toBeCloseTo(4.5, 1);
    });

    it('should handle precision in Sharpe calculation', () => {
      // Test with realistic monthly returns
      const returns = [
        1.2, -0.5, 2.1, 0.8, -1.0, 1.5, 0.3, 1.8, -0.2, 1.1, 0.6, 1.4,
      ];
      const sharpe = analysisService.calculateSharpeRatio(returns, 0.02, 12);

      // Should produce reasonable Sharpe ratio
      expect(sharpe).toBeGreaterThan(-5);
      expect(sharpe).toBeLessThan(5);
      expect(typeof sharpe).toBe('number');
      expect(isNaN(sharpe)).toBe(false);
    });

    it('should handle precision in drawdown calculation', () => {
      // Test with realistic portfolio values
      const values = [
        100000, 102000, 101500, 103000, 102000, 104500, 103000, 105000, 104000,
        106000,
      ];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      expect(maxDrawdown).toBeLessThan(0);
      expect(typeof maxDrawdown).toBe('number');
      expect(isNaN(maxDrawdown)).toBe(false);
    });
  });

  describe('Statistical Accuracy', () => {
    it('should calculate variance correctly for known dataset', () => {
      // Dataset: [2, 4, 4, 4, 5, 5, 7, 9]
      // Mean = 5
      // Variance = 4
      // Std Dev = 2
      const returns = [2, 4, 4, 4, 5, 5, 7, 9];
      const metrics = analysisService.calculateReturnMetrics(returns);

      expect(metrics.mean).toBe(5);
      expect(metrics.stdDev).toBe(2);
    });

    it('should handle standard normal distribution returns', () => {
      // Simulate returns with mean=0, stddev=1
      const returns = [
        -1.5, -0.8, -0.2, 0, 0.3, 0.8, 1.2, -1.0, 0.5, -0.3, 0.7, -0.7,
      ];
      const metrics = analysisService.calculateReturnMetrics(returns);

      // Mean should be close to 0
      expect(Math.abs(metrics.mean)).toBeLessThan(0.5);
      // StdDev should be close to 1
      expect(Math.abs(metrics.stdDev - 1)).toBeLessThan(0.5);
    });

    it('should calculate Sharpe for realistic portfolio', () => {
      // Realistic monthly returns: ~1% avg, ~2% volatility
      const returns = [
        1.5, 0.8, 1.2, -0.5, 2.1, 0.3, 1.8, 0.6, 1.1, -0.3, 1.4, 0.9,
      ];
      const sharpe = analysisService.calculateSharpeRatio(returns, 0.02, 12);

      // Expected: ~12% annual return, ~7% volatility
      // Sharpe ≈ (12 - 2) / 7 ≈ 1.4
      expect(sharpe).toBeGreaterThan(0.5);
      expect(sharpe).toBeLessThan(3.0);
    });

    it('should calculate drawdown for realistic market crash', () => {
      // Simulate 2008-style crash: -50% from peak
      const values = [
        10000, 10500, 11000, 11200, 11500, // Bull market
        11000, 10000, 9000, 7500, 6000, 5500, // Crash -52%
        6000, 6500, 7000, 7500, 8000, // Recovery
      ];
      const maxDrawdown = analysisService.calculateMaxDrawdown(values);

      // Should capture the -52% drawdown
      expect(maxDrawdown).toBeLessThan(-50);
      expect(maxDrawdown).toBeGreaterThan(-55);
    });
  });
});

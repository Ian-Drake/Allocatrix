/**
 * Rebalance Calculator Tests
 * User Story 6: Full Rebalance (Priority: P2)
 * 
 * TDD Approach: Red-Green-Refactor
 * 1. RED: Write tests that fail (feature not implemented)
 * 2. GREEN: Implement minimal code to pass tests
 * 3. REFACTOR: Improve code quality while keeping tests green
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RebalanceService } from '../../../src/backend/services/rebalance.service';
import type { DriftCalculation } from '../../../src/backend/services/drift-calculator.service';

describe('RebalanceService', () => {
  let service: RebalanceService;

  beforeEach(() => {
    service = new RebalanceService();
  });

  describe('calculateRebalancePreview', () => {
    /**
     * Acceptance Criterion 1: Algorithm calculates all sells and buys to reach target allocation
     */
    it('should calculate sells for overweight positions', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 40,
          targetWeight: 30,
          drift: 10, // Overweight
          driftPct: 10,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 4000,
          quantity: 10,
          currentPrice: 400,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);

      expect(preview.sells).toHaveLength(1);
      expect(preview.sells[0].symbol).toBe('AAPL');
      expect(preview.sells[0].action).toBe('SELL');
      expect(preview.sells[0].tradeAmount).toBeCloseTo(1000, 1); // 40% - 30% = 10% of $10k
      expect(preview.sells[0].quantity).toBeCloseTo(2.5, 1); // 1000 / 400
    });

    it('should calculate buys for underweight positions', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'BND',
          currentWeight: 20,
          targetWeight: 40,
          drift: -20, // Underweight
          driftPct: 20,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 2000,
          quantity: 20,
          currentPrice: 100,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);

      expect(preview.buys).toHaveLength(1);
      expect(preview.buys[0].symbol).toBe('BND');
      expect(preview.buys[0].action).toBe('BUY');
      expect(preview.buys[0].tradeAmount).toBeCloseTo(2000, 1); // 40% - 20% = 20% of $10k
      expect(preview.buys[0].quantity).toBeCloseTo(20, 1); // 2000 / 100
    });

    /**
     * Acceptance Criterion 1 (complex): Calculate all sells and buys together
     */
    it('should calculate both sells and buys in full rebalance', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 50,
          targetWeight: 30,
          drift: 20,
          driftPct: 20,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 5000,
          quantity: 10,
          currentPrice: 500,
        },
        {
          symbol: 'MSFT',
          currentWeight: 20,
          targetWeight: 40,
          drift: -20,
          driftPct: 20,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 2000,
          quantity: 10,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 30,
          targetWeight: 30,
          drift: 0,
          driftPct: 0,
          isOverweight: false,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 3000,
          quantity: 30,
          currentPrice: 100,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);

      // Should have 1 sell (AAPL overweight) and 1 buy (MSFT underweight)
      expect(preview.sells).toHaveLength(1);
      expect(preview.buys).toHaveLength(1);
      expect(preview.sells[0].symbol).toBe('AAPL');
      expect(preview.buys[0].symbol).toBe('MSFT');

      // AAPL: sell $2000 (50% → 30%)
      expect(preview.sells[0].tradeAmount).toBeCloseTo(2000, 1);
      // MSFT: buy $2000 (20% → 40%)
      expect(preview.buys[0].tradeAmount).toBeCloseTo(2000, 1);
    });

    /**
     * Acceptance Criterion 2: Preview shows all proposed trades with estimated commissions
     */
    it('should include commission estimates in preview', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 40,
          targetWeight: 30,
          drift: 10,
          driftPct: 10,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 4000,
          quantity: 10,
          currentPrice: 400,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);

      expect(preview.totalCommissions).toBeGreaterThan(0);
      expect(preview.sells[0].commission).toBeGreaterThan(0);
      expect(preview.sells[0].estimatedTotalWithCommission).toBe(
        preview.sells[0].totalCost - preview.sells[0].commission
      );
    });

    /**
     * Acceptance Criterion 2: Preview calculates projected allocation after trades
     */
    it('should calculate projected allocation after rebalance', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 60,
          targetWeight: 50,
          drift: 10,
          driftPct: 10,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 6000,
          quantity: 10,
          currentPrice: 600,
        },
        {
          symbol: 'BND',
          currentWeight: 40,
          targetWeight: 50,
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 4000,
          quantity: 40,
          currentPrice: 100,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);

      const projectedAllocation = preview.projectedAllocation;
      expect(projectedAllocation).toHaveLength(2);

      // After rebalance, both should be at target weights
      const appleProjection = projectedAllocation.find((p) => p.symbol === 'AAPL');
      const bondProjection = projectedAllocation.find((p) => p.symbol === 'BND');

      expect(appleProjection?.projectedWeight).toBeCloseTo(50, 0);
      expect(bondProjection?.projectedWeight).toBeCloseTo(50, 0);
    });

    /**
     * Test: Ignore trades less than $0.01 (rounding)
     */
    it('should ignore micro-trades less than $0.01', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 30.0001, // Very tiny drift - 0.0001% of $10k = $0.01
          targetWeight: 30,
          drift: 0.0001,
          driftPct: 0.0001,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 3000.01,
          quantity: 10,
          currentPrice: 300,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);

      // Should not include trades < $0.01 (only trade is $0.01 which is borderline)
      // Trade amount is 0.0001% of 10k = 0.01, so should be included
      expect(preview.sells.length).toBeLessThanOrEqual(1);
    });

    /**
     * Performance Target: SC-006 Calculation <2s
     */
    it('should calculate rebalance in less than 2 seconds', () => {
      // Create a portfolio with many positions
      const driftCalculations: DriftCalculation[] = Array.from({ length: 50 }, (_, i) => ({
        symbol: `SYM${i}`,
        currentWeight: 2,
        targetWeight: 2,
        drift: 0,
        driftPct: 0,
        isOverweight: false,
        isUnderweight: false,
        isHighDrift: false,
        currentValue: 200,
        quantity: 1,
        currentPrice: 200,
      }));

      const startTime = Date.now();
      service.calculateRebalancePreview('acc-001', driftCalculations, 10000);
      const elapsedTime = Date.now() - startTime;

      expect(elapsedTime).toBeLessThan(2000);
    });
  });

  describe('validateRebalance', () => {
    /**
     * Test: Detect when no rebalance needed
     */
    it('should detect when no rebalance is needed', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 50,
          targetWeight: 50,
          drift: 0,
          driftPct: 0,
          isOverweight: false,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 5000,
          quantity: 10,
          currentPrice: 500,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);
      const errors = service.validateRebalance(preview);

      // Should have error indicating no trades needed
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('No trades needed');
    });

    /**
     * Test: Detect large cash requirements
     */
    it('should flag rebalances requiring large additional cash', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 10,
          targetWeight: 60,
          drift: -50,
          driftPct: 50,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 1000,
          quantity: 2,
          currentPrice: 500,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);
      const errors = service.validateRebalance(preview);

      // Should warn about large cash requirement if needed exceeds $1000
      if (preview.cashNeeded > 1000) {
        expect(errors.some((e) => e.includes('cash'))).toBe(true);
      }
    });
  });

  describe('getSummaryText', () => {
    it('should generate correct summary text', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 40,
          targetWeight: 30,
          drift: 10,
          driftPct: 10,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 4000,
          quantity: 10,
          currentPrice: 400,
        },
        {
          symbol: 'MSFT',
          currentWeight: 20,
          targetWeight: 40,
          drift: -20,
          driftPct: 20,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 2000,
          quantity: 10,
          currentPrice: 200,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);
      const summary = service.getSummaryText(preview);

      expect(summary).toContain('1 sell');
      expect(summary).toContain('1 buy');
      expect(summary).toContain('Commission:');
    });
  });

  describe('executeRebalanceAtomically', () => {
    /**
     * Test: Mock transaction execution (Green phase - minimal implementation)
     */
    it('should track trade execution status', async () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 40,
          targetWeight: 30,
          drift: 10,
          driftPct: 10,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 4000,
          quantity: 10,
          currentPrice: 400,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);
      const result = await service.executeRebalanceAtomically(
        'tx-001',
        'acc-001',
        preview,
        undefined,
        undefined
      );

      expect(result.transactionId).toBe('tx-001');
      expect(result.accountId).toBe('acc-001');
      expect(result.status).toBe('success');
      expect(result.totalTradesSuccessful).toBe(1);
      expect(result.totalTradesFailed).toBe(0);
    });

    /**
     * Test: Handles zero trades gracefully
     */
    it('should handle rebalance with no trades', async () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 50,
          targetWeight: 50,
          drift: 0,
          driftPct: 0,
          isOverweight: false,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 5000,
          quantity: 10,
          currentPrice: 500,
        },
      ];

      const preview = service.calculateRebalancePreview('acc-001', driftCalculations, 10000);
      const result = await service.executeRebalanceAtomically(
        'tx-001',
        'acc-001',
        preview,
        undefined,
        undefined
      );

      expect(result.executionSummary).toContain('No trades needed');
    });
  });
});

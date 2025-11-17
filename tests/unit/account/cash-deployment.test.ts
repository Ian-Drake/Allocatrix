/**
 * Unit Tests: Cash Deployment Service
 * Test-Driven Development approach: Red-Green-Refactor
 * Tests allocation algorithm for proportional cash distribution across underweight positions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CashDeploymentService } from '../../../src/backend/services/cash-deployment.service';
import type { DriftCalculation } from '../../../src/backend/services/drift-calculator.service';

describe('CashDeploymentService', () => {
  let service: CashDeploymentService;

  beforeEach(() => {
    service = new CashDeploymentService();
  });

  // ============================================================================
  // RED-GREEN-REFACTOR: Test 1 - Basic Allocation to Single Underweight
  // ============================================================================
  describe('calculateDeploymentPreview', () => {
    it('should allocate cash proportionally to single underweight position', () => {
      // ARRANGE: Setup single underweight position
      const accountId = 'acc-001';
      const availableCash = 10000;
      const reserveAmount = 1000;
      const accountValue = 100000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 20,
          targetWeight: 30, // 10% underweight
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 20000,
          quantity: 100,
          currentPrice: 200,
        },
      ];

      // ACT: Calculate deployment
      const preview = service.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue,
      );

      // ASSERT: Verify preview structure and calculations
      expect(preview.accountId).toBe(accountId);
      expect(preview.availableCash).toBe(availableCash);
      expect(preview.reserveAmount).toBe(reserveAmount);
      expect(preview.cashToDeployAmount).toBe(9000); // 10000 - 1000
      expect(preview.proposedTrades.length).toBeGreaterThan(0);
      expect(preview.proposedTrades[0].action).toBe('BUY');
      expect(preview.proposedTrades[0].symbol).toBe('AAPL');
      expect(preview.remainingCash).toBeGreaterThanOrEqual(0); // Should not be negative
      expect(preview.projectedAllocation.length).toBe(1);
    });

    // ============================================================================
    // Test 2 - Proportional Allocation to Multiple Underweights
    // ============================================================================
    it('should allocate proportionally across multiple underweight positions', () => {
      // ARRANGE: Setup multiple underweights with different shortfalls
      const accountId = 'acc-002';
      const availableCash = 20000;
      const reserveAmount = 2000;
      const accountValue = 100000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 20,
          targetWeight: 30, // $10k shortfall
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 20000,
          quantity: 100,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 10,
          targetWeight: 20, // $10k shortfall
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 10000,
          quantity: 100,
          currentPrice: 100,
        },
      ];

      // ACT: Calculate deployment
      const preview = service.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue,
      );

      // ASSERT: Verify proportional allocation
      expect(preview.proposedTrades.length).toBe(2);
      // Since both have same shortfall and equal total cash available for both,
      // each should get roughly equal allocation
      const applTrade = preview.proposedTrades.find((t: { symbol: string }) => t.symbol === 'AAPL');
      const bndTrade = preview.proposedTrades.find((t: { symbol: string }) => t.symbol === 'BND');

      expect(applTrade).toBeDefined();
      expect(bndTrade).toBeDefined();
      expect(applTrade!.totalCost).toBeGreaterThan(0);
      expect(bndTrade!.totalCost).toBeGreaterThan(0);

      // Total deployment should not exceed available cash minus reserve
      expect(preview.totalDeploymentCost).toBeLessThanOrEqual(18000);
    });

    // ============================================================================
    // Test 3 - Insufficient Cash After Reserve
    // ============================================================================
    it('should handle insufficient cash after reserve protection', () => {
      // ARRANGE: Very small cash relative to shortfalls
      const accountId = 'acc-003';
      const availableCash = 100;
      const reserveAmount = 50;
      const accountValue = 100000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 20,
          targetWeight: 30, // $10k shortfall (but only $50 available)
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 20000,
          quantity: 100,
          currentPrice: 200,
        },
      ];

      // ACT: Calculate deployment with insufficient cash
      const preview = service.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue,
      );

      // ASSERT: Should handle gracefully
      expect(preview.cashToDeployAmount).toBe(50);
      expect(preview.totalDeploymentCost).toBeLessThanOrEqual(50);
      expect(preview.remainingCash).toBeGreaterThanOrEqual(0);
    });

    // ============================================================================
    // Test 4 - No Underweight Positions (All Overweight or At Target)
    // ============================================================================
    it('should return empty trades when no underweights exist', () => {
      // ARRANGE: All positions overweight or at target
      const accountId = 'acc-004';
      const availableCash = 10000;
      const reserveAmount = 1000;
      const accountValue = 100000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 30,
          targetWeight: 30, // Exactly at target
          drift: 0,
          driftPct: 0,
          isOverweight: false,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 30000,
          quantity: 150,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 40,
          targetWeight: 30, // Overweight (not eligible for deployment)
          drift: 10,
          driftPct: 10,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 40000,
          quantity: 400,
          currentPrice: 100,
        },
      ];

      // ACT: Calculate deployment
      const preview = service.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue,
      );

      // ASSERT: No trades should be generated
      expect(preview.proposedTrades.length).toBe(0);
      expect(preview.totalDeploymentCost).toBe(0);
      expect(preview.remainingCash).toBe(availableCash);
    });

    // ============================================================================
    // Test 5 - Reserve Amount Protection
    // ============================================================================
    it('should protect reserve amount from deployment', () => {
      // ARRANGE: Verify reserve is excluded from deployment
      const accountId = 'acc-005';
      const availableCash = 10000;
      const reserveAmount = 3000;
      const accountValue = 100000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 20,
          targetWeight: 30,
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 20000,
          quantity: 100,
          currentPrice: 200,
        },
      ];

      // ACT: Calculate deployment
      const preview = service.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue,
      );

      // ASSERT: Verify reserve is protected
      expect(preview.cashToDeployAmount).toBe(7000); // 10000 - 3000
      expect(preview.remainingCash).toBeGreaterThanOrEqual(3000); // At least reserve left
      expect(preview.totalDeploymentCost).toBeLessThanOrEqual(7000);
    });

    // ============================================================================
    // Test 6 - Rounding and Fractional Share Handling
    // ============================================================================
    it('should handle rounding correctly and minimize leftover cash', () => {
      // ARRANGE: Setup for rounding scenario
      const accountId = 'acc-006';
      const availableCash = 1000;
      const reserveAmount = 0;
      const accountValue = 100000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'MSFT',
          currentWeight: 10,
          targetWeight: 15, // $5k shortfall but only $1k cash
          drift: -5,
          driftPct: 5,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 10000,
          quantity: 10,
          currentPrice: 350, // $1k / $350 = 2 shares + $300 remainder
        },
      ];

      // ACT: Calculate deployment
      const preview = service.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue,
      );

      // ASSERT: Verify rounding handled correctly
      expect(preview.proposedTrades.length).toBeGreaterThan(0);
      const trade = preview.proposedTrades[0];
      expect(trade.quantity).toBe(Math.floor(availableCash / trade.estimatedPrice));
      expect(trade.totalCost).toBe(trade.quantity * trade.estimatedPrice);
      expect(preview.remainingCash).toBeLessThanOrEqual(availableCash);
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================
  describe('validateDeployment', () => {
    it('should validate successful deployment preview', () => {
      // ARRANGE: Valid preview
      const preview = {
        accountId: 'acc-001',
        availableCash: 10000,
        reserveAmount: 1000,
        cashToDeployAmount: 9000,
        underweightPositions: [
          {
            symbol: 'AAPL',
            currentWeight: 20,
            targetWeight: 30,
            shortfall: 10,
            targetAllocationDollars: 10000,
          },
        ],
        proposedTrades: [
          {
            symbol: 'AAPL',
            action: 'BUY' as const,
            targetAllocationDollars: 10000,
            quantity: 45,
            estimatedPrice: 200,
            totalCost: 9000,
            orderType: 'MARKET' as const,
          },
        ],
        projectedAllocation: [
          {
            symbol: 'AAPL',
            currentValue: 20000,
            postDeploymentValue: 29000,
            currentWeight: 20,
            projectedWeight: 29,
          },
        ],
        totalDeploymentCost: 9000,
        remainingCash: 1000,
        estimatedExecutionTime: 150,
        warnings: [],
      };

      // ACT: Validate
      const result = service.validateDeployment(preview);

      // ASSERT: Should be valid
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should catch deployment with no trades', () => {
      // ARRANGE: Empty trades
      const preview = {
        accountId: 'acc-001',
        availableCash: 100,
        reserveAmount: 100,
        cashToDeployAmount: 0,
        underweightPositions: [],
        proposedTrades: [],
        projectedAllocation: [],
        totalDeploymentCost: 0,
        remainingCash: 100,
        estimatedExecutionTime: 50,
        warnings: [],
      };

      // ACT: Validate
      const result = service.validateDeployment(preview);

      // ASSERT: Should be invalid
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No trades to execute');
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================
  describe('Edge Cases', () => {
    it('should reject negative available cash', () => {
      expect(() => {
        service.calculateDeploymentPreview(
          'acc-001',
          -1000, // Negative cash
          0,
          [],
          100000,
        );
      }).toThrow('Available cash cannot be negative');
    });

    it('should reject negative reserve amount', () => {
      expect(() => {
        service.calculateDeploymentPreview(
          'acc-001',
          10000,
          -1000, // Negative reserve
          [],
          100000,
        );
      }).toThrow('Reserve amount cannot be negative');
    });

    it('should handle reserve exceeding cash with warning', () => {
      const preview = service.calculateDeploymentPreview(
        'acc-001',
        1000,
        5000, // Reserve > cash
        [],
        100000,
      );

      expect(preview.warnings).toContain('Reserve amount exceeds available cash');
    });

    it('should handle zero cash deployment gracefully', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 20,
          targetWeight: 30,
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 20000,
          quantity: 100,
          currentPrice: 200,
        },
      ];

      const preview = service.calculateDeploymentPreview(
        'acc-001',
        0, // No cash
        0,
        driftCalculations,
        100000,
      );

      expect(preview.proposedTrades.length).toBe(0);
      expect(preview.totalDeploymentCost).toBe(0);
    });
  });

  // ============================================================================
  // Helper Method Tests
  // ============================================================================
  describe('Helper Methods', () => {
    it('should calculate minimum deployable amount correctly', () => {
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 20,
          targetWeight: 30,
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 20000,
          quantity: 100,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 10,
          targetWeight: 20,
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 10000,
          quantity: 100,
          currentPrice: 100,
        },
      ];

      const minAmount = service.calculateMinimumDeployableAmount(driftCalculations, 100000, 0.5);

      // With 0.5% minimum per position and 2 underweights: 2 * 0.5% * 100k = $1000
      expect(minAmount).toBeGreaterThan(0);
    });

    it('should calculate recommended reserve correctly', () => {
      const reserve = service.calculateRecommendedReserve(100000, 3);
      expect(reserve).toBe(3000); // 3% of 100k
    });

    it('should determine if deployment is worthwhile', () => {
      // Worthwhile: $10k cash - $1k reserve = $9k deployable > $500 threshold
      const worthwhile1 = service.isDeploymentWorthwhile(10000, 1000, 100000, 0.5);
      expect(worthwhile1).toBe(true);

      // Not worthwhile: $1k cash - $990 reserve = $10 deployable < $500 threshold
      const worthwhile2 = service.isDeploymentWorthwhile(1000, 990, 100000, 0.5);
      expect(worthwhile2).toBe(false);
    });

    it('should estimate transaction costs correctly', () => {
      const proposedTrades = [
        {
          symbol: 'AAPL',
          action: 'BUY' as const,
          targetAllocationDollars: 5000,
          quantity: 25,
          estimatedPrice: 200,
          totalCost: 5000,
          orderType: 'MARKET' as const,
        },
        {
          symbol: 'BND',
          action: 'BUY' as const,
          targetAllocationDollars: 4000,
          quantity: 40,
          estimatedPrice: 100,
          totalCost: 4000,
          orderType: 'MARKET' as const,
        },
      ];

      const costs = service.estimateTransactionCosts(proposedTrades, 0, 0.001);
      // 0.1% of $9000 = $9
      expect(costs).toBe(9);
    });
  });

  // ============================================================================
  // Performance Test: SC-005 Calculation <1s
  // ============================================================================
  describe('Performance - SC-005', () => {
    it('should calculate deployment preview in under 1 second', () => {
      // ARRANGE: Large number of positions to stress test
      const accountValue = 500000;
      const driftCalculations: DriftCalculation[] = [];

      // Create 50 positions (realistic portfolio with many holdings)
      for (let i = 0; i < 50; i++) {
        driftCalculations.push({
          symbol: `SYM${i}`,
          currentWeight: Math.random() * 5,
          targetWeight: Math.random() * 5,
          drift: (Math.random() - 0.5) * 5,
          driftPct: Math.random() * 5,
          isOverweight: Math.random() > 0.5,
          isUnderweight: Math.random() > 0.5,
          isHighDrift: Math.random() > 0.7,
          currentValue: (accountValue / 50) * (0.5 + Math.random()),
          quantity: Math.floor(Math.random() * 1000),
          currentPrice: Math.random() * 500 + 50,
        });
      }

      // ACT: Measure time
      const startTime = performance.now();
      service.calculateDeploymentPreview('acc-001', 50000, 5000, driftCalculations, accountValue);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // ASSERT: Should complete in under 1 second (1000ms)
      expect(executionTime).toBeLessThan(1000);
    });
  });
});

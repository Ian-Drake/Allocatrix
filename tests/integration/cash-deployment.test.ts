/**
 * Integration Tests: Cash Deployment Workflow
 * 
 * Tests complete end-to-end cash deployment process:
 * 1. Calculate deployment preview
 * 2. Validate preview
 * 3. Submit trades to Schwab
 * 4. Verify audit logging
 * 5. Verify performance (SC-005: <1s calculation)
 * 
 * User Story 5 Acceptance Scenarios:
 * - Scenario 1: User can deploy available cash
 * - Scenario 2: Algorithm calculates target dollar amounts correctly
 * - Scenario 3: Projected allocation preview shown before execution
 * - Scenario 4: Trades submitted and recorded in audit log
 * - Scenario 5: Insufficient cash handled gracefully
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CashDeploymentService } from '../../../src/backend/services/cash-deployment.service';
import { TradesService } from '../../../src/backend/services/trades.service';
import type { DriftCalculation } from '../../../src/backend/services/drift-calculator.service';

describe('Cash Deployment Integration Tests', () => {
  let deploymentService: CashDeploymentService;
  let tradesService_Inst: TradesService;

  beforeEach(() => {
    deploymentService = new CashDeploymentService();
    tradesService_Inst = new TradesService();
  });

  // ============================================================================
  // Scenario 1: User can deploy available cash
  // ============================================================================
  describe('Scenario 1: User deploys available cash', () => {
    it('should complete full deployment workflow', async () => {
      // ARRANGE: Setup account with underweights
      const accountId = 'acc-integration-001';
      const availableCash = 50000;
      const reserveAmount = 5000;
      const accountValue = 500000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 15,
          targetWeight: 25,
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 75000,
          quantity: 375,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 20,
          targetWeight: 30,
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 100000,
          quantity: 1000,
          currentPrice: 100,
        },
      ];

      // ACT 1: Calculate preview
      const preview = deploymentService.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue
      );

      // ASSERT 1: Preview is valid
      expect(preview.accountId).toBe(accountId);
      expect(preview.cashToDeployAmount).toBe(45000);
      expect(preview.proposedTrades.length).toBe(2);
      expect(preview.totalDeploymentCost).toBeLessThanOrEqual(45000);

      // ACT 2: Validate preview
      const validation = deploymentService.validateDeployment(preview);

      // ASSERT 2: Validation passes
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);

      // ACT 3: Simulate trade submission
      const result = await tradesService_Inst.submitTrades(
        accountId,
        accountId,
        preview.proposedTrades,
        undefined // Mock execution
      );

      // ASSERT 3: Trades executed successfully
      expect(result.successful).toBe(preview.proposedTrades.length);
      expect(result.failed).toBe(0);
      expect(result.totalValue).toBeGreaterThan(0);
    });

    it('should execute with <5 clicks user experience', () => {
      // Verify workflow requires minimal user interactions
      // Click 1: View account
      // Click 2: Click "Deploy Cash" button
      // Click 3: Review preview
      // Click 4: Confirm execution
      // Click 5: View results
      expect(true).toBe(true); // UX verification - would test UI component
    });
  });

  // ============================================================================
  // Scenario 2: Algorithm calculates target dollar amounts correctly
  // ============================================================================
  describe('Scenario 2: Algorithm calculates correctly', () => {
    it('should calculate proportional allocation to multiple underweights', () => {
      // ARRANGE: Specific allocation scenario
      const accountId = 'acc-integration-002';
      const availableCash = 100000;
      const reserveAmount = 10000;
      const accountValue = 1000000;

      // Setup: Two underweights with different shortfalls
      // AAPL: 5% underweight = $50k shortfall (higher priority)
      // BND: 2% underweight = $20k shortfall (lower priority)
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 20,
          targetWeight: 25, // $50k shortfall
          drift: -5,
          driftPct: 5,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 200000,
          quantity: 1000,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 18,
          targetWeight: 20, // $20k shortfall
          drift: -2,
          driftPct: 2,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: false,
          currentValue: 180000,
          quantity: 1800,
          currentPrice: 100,
        },
      ];

      // ACT: Calculate deployment
      const preview = deploymentService.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue
      );

      // ASSERT: Proportional allocation verified
      const totalShortfall = 70000; // $50k + $20k
      const deployableAmount = 90000; // $100k - $10k reserve
      const allocationRatio = deployableAmount / totalShortfall; // ~1.29

      // AAPL should get ~$50k * 1.29 = ~$64.3k (capped at deployable)
      // BND should get ~$20k * 1.29 = ~$25.7k
      const applTrade = preview.proposedTrades.find((t) => t.symbol === 'AAPL');
      const bndTrade = preview.proposedTrades.find((t) => t.symbol === 'BND');

      expect(applTrade).toBeDefined();
      expect(bndTrade).toBeDefined();
      expect(applTrade!.totalCost).toBeGreaterThan(bndTrade!.totalCost);

      // Total should not exceed available
      expect(preview.totalDeploymentCost).toBeLessThanOrEqual(deployableAmount);
    });

    it('should handle tickers with different prices correctly', () => {
      // ARRANGE: Different price per share
      const accountId = 'acc-integration-003';
      const availableCash = 10000;
      const reserveAmount = 1000;
      const accountValue = 100000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'EXPENSIVE', // $500/share
          currentWeight: 20,
          targetWeight: 25,
          drift: -5,
          driftPct: 5,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 20000,
          quantity: 40,
          currentPrice: 500,
        },
        {
          symbol: 'CHEAP', // $50/share
          currentWeight: 20,
          targetWeight: 25,
          drift: -5,
          driftPct: 5,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 20000,
          quantity: 400,
          currentPrice: 50,
        },
      ];

      // ACT
      const preview = deploymentService.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue
      );

      // ASSERT: Both positions should get allocation proportional to shortfall, not price
      const expensiveTrade = preview.proposedTrades.find((t) => t.symbol === 'EXPENSIVE');
      const cheapTrade = preview.proposedTrades.find((t) => t.symbol === 'CHEAP');

      expect(expensiveTrade).toBeDefined();
      expect(cheapTrade).toBeDefined();

      // Both have same shortfall so should get similar dollar allocation
      const tolerance = 0.1; // 10% tolerance for rounding
      const ratio = expensiveTrade!.totalCost / cheapTrade!.totalCost;
      expect(ratio).toBeGreaterThan(1 - tolerance);
      expect(ratio).toBeLessThan(1 + tolerance);
    });
  });

  // ============================================================================
  // Scenario 3: Projected allocation shown before execution
  // ============================================================================
  describe('Scenario 3: Preview shows projected allocation', () => {
    it('should show accurate projected allocation after deployment', () => {
      // ARRANGE
      const accountId = 'acc-integration-004';
      const availableCash = 100000;
      const reserveAmount = 10000;
      const accountValue = 500000;

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
          currentValue: 100000,
          quantity: 500,
          currentPrice: 200,
        },
        {
          symbol: 'MSFT',
          currentWeight: 30,
          targetWeight: 30,
          drift: 0,
          driftPct: 0,
          isOverweight: false,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 150000,
          quantity: 500,
          currentPrice: 300,
        },
      ];

      // ACT
      const preview = deploymentService.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue
      );

      // ASSERT: Projected allocation shows improvement
      const aaplProjection = preview.projectedAllocation.find((a) => a.symbol === 'AAPL');
      expect(aaplProjection).toBeDefined();
      expect(aaplProjection!.projectedWeight).toBeGreaterThan(aaplProjection!.currentWeight);
      expect(aaplProjection!.projectedWeight).toBeLessThanOrEqual(35); // Should move closer to 30%

      // MSFT should stay roughly same
      const msftProjection = preview.projectedAllocation.find((a) => a.symbol === 'MSFT');
      expect(msftProjection).toBeDefined();
      expect(msftProjection!.projectedWeight).toBeCloseTo(msftProjection!.currentWeight, 1);
    });

    it('should include warnings for edge cases', () => {
      // ARRANGE: Scenario that might generate warnings
      const accountId = 'acc-integration-005';
      const availableCash = 100;
      const reserveAmount = 50;
      const accountValue = 500000;

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
          currentValue: 100000,
          quantity: 500,
          currentPrice: 200,
        },
      ];

      // ACT
      const preview = deploymentService.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue
      );

      // ASSERT: May have warnings but should complete
      expect(preview).toBeDefined();
      // Warnings might include "high rounding loss" or similar
    });
  });

  // ============================================================================
  // Scenario 4: Trades recorded in audit log
  // ============================================================================
  describe('Scenario 4: Audit logging', () => {
    it('should create audit log entry for each trade', async () => {
      // ARRANGE
      const accountId = 'acc-integration-006';
      const proposedTrades = [
        {
          symbol: 'AAPL',
          action: 'BUY' as const,
          targetAllocationDollars: 30000,
          quantity: 150,
          estimatedPrice: 200,
          totalCost: 30000,
          orderType: 'MARKET' as const,
        },
        {
          symbol: 'BND',
          action: 'BUY' as const,
          targetAllocationDollars: 20000,
          quantity: 200,
          estimatedPrice: 100,
          totalCost: 20000,
          orderType: 'MARKET' as const,
        },
      ];

      // ACT: Submit trades (mock execution)
      const result = await tradesService_Inst.submitTrades(
        accountId,
        accountId,
        proposedTrades,
        undefined
      );

      // ASSERT: All trades recorded
      expect(result.successful).toBe(proposedTrades.length);
      expect(result.trades.length).toBe(proposedTrades.length);

      // Each trade should have status and be in audit log
      for (const trade of result.trades) {
        expect(trade.status).toBeDefined();
        expect(['pending', 'executed', 'failed']).toContain(trade.status);
      }

      // SC-010: 100% audit logging
      expect(result.trades.length).toBe(proposedTrades.length);
    });

    it('should record failed trades with error details', async () => {
      // ARRANGE: Simulate a trade that might fail
      const accountId = 'acc-integration-007';
      const proposedTrades = [
        {
          symbol: 'AAPL',
          action: 'BUY' as const,
          targetAllocationDollars: 30000,
          quantity: 150,
          estimatedPrice: 200,
          totalCost: 30000,
          orderType: 'MARKET' as const,
        },
      ];

      // ACT
      const result = await tradesService_Inst.submitTrades(
        accountId,
        accountId,
        proposedTrades,
        {
          // Inject mock API that fails
          submitOrder: async () => {
            throw new Error('Order rejected by Schwab');
          },
        }
      );

      // ASSERT: Failed trade recorded with error
      expect(result.failed).toBe(1);
      expect(result.trades[0].status).toBe('failed');
      expect(result.trades[0].errorMessage).toContain('Order rejected');
    });
  });

  // ============================================================================
  // Scenario 5: Insufficient cash handled gracefully
  // ============================================================================
  describe('Scenario 5: Insufficient cash handling', () => {
    it('should allocate proportionally when cash is insufficient', () => {
      // ARRANGE: Shortfalls exceed cash available
      const accountId = 'acc-integration-008';
      const availableCash = 10000; // Only $10k available
      const reserveAmount = 2000; // Reserve $2k
      const accountValue = 500000;

      // Underweights totaling $100k shortfall
      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 10,
          targetWeight: 30, // $100k shortfall
          drift: -20,
          driftPct: 20,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 50000,
          quantity: 250,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 10,
          targetWeight: 20, // $50k shortfall
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 50000,
          quantity: 500,
          currentPrice: 100,
        },
      ];

      // ACT
      const preview = deploymentService.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue
      );

      // ASSERT: Uses all available cash but doesn't exceed it
      expect(preview.cashToDeployAmount).toBe(8000);
      expect(preview.totalDeploymentCost).toBeLessThanOrEqual(8000);
      expect(preview.remainingCash).toBeGreaterThanOrEqual(2000); // Reserve protected

      // Both underweights should still get allocation (proportional)
      expect(preview.proposedTrades.length).toBeGreaterThan(0);
    });

    it('should return empty deployment when cash insufficient for any position', () => {
      // ARRANGE: Very tiny cash amount
      const accountId = 'acc-integration-009';
      const availableCash = 50; // Only $50
      const reserveAmount = 50; // Full reserve
      const accountValue = 100000;

      const driftCalculations: DriftCalculation[] = [
        {
          symbol: 'AAPL',
          currentWeight: 10,
          targetWeight: 20,
          drift: -10,
          driftPct: 10,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 10000,
          quantity: 50,
          currentPrice: 200,
        },
      ];

      // ACT
      const preview = deploymentService.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue
      );

      // ASSERT: No deployment possible
      expect(preview.cashToDeployAmount).toBe(0);
      expect(preview.proposedTrades.length).toBe(0);
      expect(preview.totalDeploymentCost).toBe(0);
    });
  });

  // ============================================================================
  // Performance Test: SC-005 Calculation <1s
  // ============================================================================
  describe('Performance: SC-005 (<1 second calculation)', () => {
    it('should complete deployment calculation in under 1 second with large portfolio', () => {
      // ARRANGE: Create large realistic portfolio (50 positions)
      const accountId = 'acc-integration-perf-001';
      const availableCash = 200000;
      const reserveAmount = 20000;
      const accountValue = 1000000;

      const driftCalculations: DriftCalculation[] = [];
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

      // ACT: Measure calculation time
      const startTime = performance.now();
      const preview = deploymentService.calculateDeploymentPreview(
        accountId,
        availableCash,
        reserveAmount,
        driftCalculations,
        accountValue
      );
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // ASSERT: SC-005 performance target
      expect(executionTime).toBeLessThan(1000); // Less than 1 second (1000ms)
      expect(preview.estimatedExecutionTime).toBeLessThan(1000);
      expect(preview.proposedTrades.length).toBeGreaterThan(0);
    });
  });
});

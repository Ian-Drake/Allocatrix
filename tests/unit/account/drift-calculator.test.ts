import { describe, it, expect, beforeEach } from 'vitest';
import { DriftCalculatorService } from '../../../src/backend/services/drift-calculator.service';

describe('DriftCalculatorService', () => {
  let service: DriftCalculatorService;

  beforeEach(() => {
    service = new DriftCalculatorService();
  });

  describe('calculateDrift', () => {
    it('should calculate drift correctly for a single position', () => {
      const positions = [
        {
          symbol: 'AAPL',
          quantity: 10,
          currentPrice: 150,
          currentValue: 1500,
          percentOfAccount: 50,
        },
      ];

      const modelAllocations = [{ symbol: 'AAPL', targetWeightPct: 60 }];

      const result = service.calculateDrift(positions, modelAllocations, 3000);

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('AAPL');
      expect(result[0].currentWeight).toBe(50); // 1500 / 3000 * 100
      expect(result[0].targetWeight).toBe(60);
      expect(result[0].drift).toBe(-10); // 50 - 60
      expect(result[0].driftPct).toBe(10);
      expect(result[0].isUnderweight).toBe(true);
      expect(result[0].isOverweight).toBe(false);
    });

    it('should identify overweight positions (drift > 0)', () => {
      const positions = [
        {
          symbol: 'MSFT',
          quantity: 20,
          currentPrice: 350,
          currentValue: 7000,
          percentOfAccount: 70,
        },
      ];

      const modelAllocations = [{ symbol: 'MSFT', targetWeightPct: 50 }];

      const result = service.calculateDrift(positions, modelAllocations, 10000);

      expect(result[0].isOverweight).toBe(true);
      expect(result[0].isUnderweight).toBe(false);
      expect(result[0].drift).toBe(20); // 70 - 50
      expect(result[0].driftPct).toBe(20);
    });

    it('should mark positions with drift > 5% as high drift', () => {
      const positions = [
        {
          symbol: 'AAPL',
          quantity: 10,
          currentPrice: 150,
          currentValue: 1500,
          percentOfAccount: 35,
        },
        {
          symbol: 'MSFT',
          quantity: 5,
          currentPrice: 350,
          currentValue: 1750,
          percentOfAccount: 35,
        },
      ];

      const modelAllocations = [
        { symbol: 'AAPL', targetWeightPct: 30 },
        { symbol: 'MSFT', targetWeightPct: 40 },
      ];

      const result = service.calculateDrift(positions, modelAllocations, 5000);

      // AAPL: 35 - 30 = 5% drift (exactly 5, should not trigger)
      expect(result.find((r: { symbol: string }) => r.symbol === 'AAPL')?.isHighDrift).toBe(false);

      // MSFT: 35 - 40 = -5% drift (exactly 5, should not trigger)
      expect(result.find((r: { symbol: string }) => r.symbol === 'MSFT')?.isHighDrift).toBe(false);
    });

    it('should mark positions with drift > 5% as high drift (strict)', () => {
      const positions = [
        {
          symbol: 'BND',
          quantity: 50,
          currentPrice: 100,
          currentValue: 5000,
          percentOfAccount: 50,
        },
      ];

      const modelAllocations = [{ symbol: 'BND', targetWeightPct: 40 }];

      const result = service.calculateDrift(positions, modelAllocations, 10000);

      expect(result[0].driftPct).toBe(10);
      expect(result[0].isHighDrift).toBe(true);
    });

    it('should handle missing positions from model (underweight)', () => {
      const positions = [
        {
          symbol: 'AAPL',
          quantity: 10,
          currentPrice: 150,
          currentValue: 1500,
          percentOfAccount: 50,
        },
      ];

      const modelAllocations = [
        { symbol: 'AAPL', targetWeightPct: 50 },
        { symbol: 'MSFT', targetWeightPct: 50 },
      ];

      const result = service.calculateDrift(positions, modelAllocations, 3000);

      expect(result).toHaveLength(2);

      const msft = result.find((r: { symbol: string }) => r.symbol === 'MSFT');
      expect(msft).toBeDefined();
      expect(msft?.currentWeight).toBe(0);
      expect(msft?.targetWeight).toBe(50);
      expect(msft?.drift).toBe(-50);
      expect(msft?.isUnderweight).toBe(true);
      expect(msft?.currentValue).toBe(0);
      expect(msft?.quantity).toBe(0);
    });

    it('should throw error for invalid account value', () => {
      const positions = [
        {
          symbol: 'AAPL',
          quantity: 10,
          currentPrice: 150,
          currentValue: 1500,
          percentOfAccount: 50,
        },
      ];

      const modelAllocations = [{ symbol: 'AAPL', targetWeightPct: 100 }];

      expect(() =>
        service.calculateDrift(positions, modelAllocations, 0),
      ).toThrow('Account value must be greater than 0');

      expect(() =>
        service.calculateDrift(positions, modelAllocations, -1000),
      ).toThrow('Account value must be greater than 0');
    });

    it('should sort results by drift (most overweight to most underweight)', () => {
      const positions = [
        {
          symbol: 'AAPL',
          quantity: 10,
          currentPrice: 150,
          currentValue: 1500,
          percentOfAccount: 30,
        },
        {
          symbol: 'MSFT',
          quantity: 20,
          currentPrice: 350,
          currentValue: 7000,
          percentOfAccount: 70,
        },
        {
          symbol: 'GOOGL',
          quantity: 5,
          currentPrice: 200,
          currentValue: 1000,
          percentOfAccount: 0,
        },
      ];

      const modelAllocations = [
        { symbol: 'AAPL', targetWeightPct: 50 },
        { symbol: 'MSFT', targetWeightPct: 30 },
        { symbol: 'GOOGL', targetWeightPct: 20 },
      ];

      const result = service.calculateDrift(positions, modelAllocations, 10000);

      expect(result[0].symbol).toBe('MSFT'); // +40 drift
      expect(result[1].symbol).toBe('GOOGL'); // -20 drift
      expect(result[2].symbol).toBe('AAPL'); // -20 drift
    });
  });

  describe('calculateDriftSummary', () => {
    it('should calculate summary metrics correctly', () => {
      const driftCalculations = [
        {
          symbol: 'AAPL',
          currentWeight: 35,
          targetWeight: 30,
          drift: 5,
          driftPct: 5,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 1500,
          quantity: 10,
          currentPrice: 150,
        },
        {
          symbol: 'MSFT',
          currentWeight: 25,
          targetWeight: 40,
          drift: -15,
          driftPct: 15,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 1000,
          quantity: 5,
          currentPrice: 200,
        },
      ];

      const summary = service.calculateDriftSummary(driftCalculations);

      expect(summary.totalDriftScore).toBe(20); // 5 + 15
      expect(summary.maxDrift).toBe(5); // AAPL
      expect(summary.minDrift).toBe(-15); // MSFT
      expect(summary.positionsOverweight).toBe(1);
      expect(summary.positionsUnderweight).toBe(1);
      expect(summary.positionsHighDrift).toBe(1); // Only MSFT
      expect(summary.averageDrift).toBe(10); // 20 / 2
      expect(summary.rebalanceNeeded).toBe(true);
    });

    it('should return zero metrics for empty drift calculations', () => {
      const summary = service.calculateDriftSummary([]);

      expect(summary.totalDriftScore).toBe(0);
      expect(summary.maxDrift).toBe(0);
      expect(summary.minDrift).toBe(0);
      expect(summary.positionsOverweight).toBe(0);
      expect(summary.positionsUnderweight).toBe(0);
      expect(summary.positionsHighDrift).toBe(0);
      expect(summary.averageDrift).toBe(0);
      expect(summary.rebalanceNeeded).toBe(false);
    });
  });

  describe('getOverweightPositions', () => {
    it('should return only overweight positions sorted by drift descending', () => {
      const driftCalculations = [
        {
          symbol: 'AAPL',
          currentWeight: 35,
          targetWeight: 30,
          drift: 5,
          driftPct: 5,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 1500,
          quantity: 10,
          currentPrice: 150,
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
          currentValue: 1000,
          quantity: 5,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 45,
          targetWeight: 30,
          drift: 15,
          driftPct: 15,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 2000,
          quantity: 50,
          currentPrice: 40,
        },
      ];

      const result = service.getOverweightPositions(driftCalculations);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('BND'); // 15 drift
      expect(result[1].symbol).toBe('AAPL'); // 5 drift
    });
  });

  describe('getUnderweightPositions', () => {
    it('should return only underweight positions sorted by drift ascending', () => {
      const driftCalculations = [
        {
          symbol: 'AAPL',
          currentWeight: 10,
          targetWeight: 30,
          drift: -20,
          driftPct: 20,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 500,
          quantity: 5,
          currentPrice: 100,
        },
        {
          symbol: 'MSFT',
          currentWeight: 50,
          targetWeight: 40,
          drift: 10,
          driftPct: 10,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 2000,
          quantity: 10,
          currentPrice: 200,
        },
        {
          symbol: 'BND',
          currentWeight: 15,
          targetWeight: 30,
          drift: -15,
          driftPct: 15,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 600,
          quantity: 10,
          currentPrice: 60,
        },
      ];

      const result = service.getUnderweightPositions(driftCalculations);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('AAPL'); // -20 drift
      expect(result[1].symbol).toBe('BND'); // -15 drift
    });
  });

  describe('calculateCashNeededToRebalance', () => {
    it('should calculate total cash needed to close underweight gaps', () => {
      const driftCalculations = [
        {
          symbol: 'AAPL',
          currentWeight: 30,
          targetWeight: 50,
          drift: -20,
          driftPct: 20,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: true,
          currentValue: 1500,
          quantity: 10,
          currentPrice: 150,
        },
        {
          symbol: 'MSFT',
          currentWeight: 60,
          targetWeight: 40,
          drift: 20,
          driftPct: 20,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 3000,
          quantity: 10,
          currentPrice: 300,
        },
      ];

      const accountValue = 5000;
      const cashNeeded = service.calculateCashNeededToRebalance(
        driftCalculations,
        accountValue,
      );

      // Only AAPL is underweight: 20% of 5000 = 1000
      expect(cashNeeded).toBe(1000);
    });

    it('should return 0 if no underweights', () => {
      const driftCalculations = [
        {
          symbol: 'AAPL',
          currentWeight: 30,
          targetWeight: 30,
          drift: 0,
          driftPct: 0,
          isOverweight: false,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 1500,
          quantity: 10,
          currentPrice: 150,
        },
      ];

      const cashNeeded = service.calculateCashNeededToRebalance(driftCalculations, 5000);

      expect(cashNeeded).toBe(0);
    });
  });

  describe('isWithinAcceptableDrift', () => {
    it('should return true if all drift within tolerance', () => {
      const driftCalculations = [
        {
          symbol: 'AAPL',
          currentWeight: 32,
          targetWeight: 30,
          drift: 2,
          driftPct: 2,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 1500,
          quantity: 10,
          currentPrice: 150,
        },
        {
          symbol: 'MSFT',
          currentWeight: 38,
          targetWeight: 40,
          drift: -2,
          driftPct: 2,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: false,
          currentValue: 2000,
          quantity: 10,
          currentPrice: 200,
        },
      ];

      expect(service.isWithinAcceptableDrift(driftCalculations, 5)).toBe(true);
    });

    it('should return false if any drift exceeds tolerance', () => {
      const driftCalculations = [
        {
          symbol: 'AAPL',
          currentWeight: 36,
          targetWeight: 30,
          drift: 6,
          driftPct: 6,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: true,
          currentValue: 1500,
          quantity: 10,
          currentPrice: 150,
        },
      ];

      expect(service.isWithinAcceptableDrift(driftCalculations, 5)).toBe(false);
    });
  });

  describe('getAssetClassDrift', () => {
    it('should calculate drift at asset class level', () => {
      const driftCalculations = [
        {
          symbol: 'AAPL',
          currentWeight: 20,
          targetWeight: 25,
          drift: -5,
          driftPct: 5,
          isOverweight: false,
          isUnderweight: true,
          isHighDrift: false,
          currentValue: 1000,
          quantity: 10,
          currentPrice: 100,
        },
        {
          symbol: 'MSFT',
          currentWeight: 30,
          targetWeight: 25,
          drift: 5,
          driftPct: 5,
          isOverweight: true,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 1500,
          quantity: 10,
          currentPrice: 150,
        },
        {
          symbol: 'BND',
          currentWeight: 50,
          targetWeight: 50,
          drift: 0,
          driftPct: 0,
          isOverweight: false,
          isUnderweight: false,
          isHighDrift: false,
          currentValue: 2500,
          quantity: 50,
          currentPrice: 50,
        },
      ];

      const assetClassMap = {
        equities: ['AAPL', 'MSFT'],
        bonds: ['BND'],
      };

      const result = service.getAssetClassDrift(driftCalculations, assetClassMap);

      expect(result.equities.weight).toBe(50); // 20 + 30
      expect(result.equities.targetWeight).toBe(50); // 25 + 25
      expect(result.equities.drift).toBe(0);

      expect(result.bonds.weight).toBe(50);
      expect(result.bonds.targetWeight).toBe(50);
      expect(result.bonds.drift).toBe(0);
    });
  });
});

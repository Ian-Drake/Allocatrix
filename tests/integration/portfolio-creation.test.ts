/**
 * Portfolio Creation Integration Tests (T046)
 *
 * Tests complete workflow for creating and managing model portfolios:
 * - Acceptance Scenario 1: Create Draft portfolio
 * - Acceptance Scenario 2: Add Asset Classes with target weights
 * - Acceptance Scenario 3: Add tickers within Asset Classes
 * - Acceptance Scenario 4: Validate portfolio weights
 * - Acceptance Scenario 5: Transition from Draft to Valid
 * - Acceptance Scenario 6: Clone Locked portfolio to new Draft
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { portfolioService } from '../../src/backend/services/portfolio.service';
import type { AssetClass } from '../../src/backend/services/portfolio.service';

interface PortfolioServiceState {
  portfolios: Map<string, unknown>;
}

/**
 * Helper: Reset portfolio service state before each test
 */
function resetPortfolioState() {
  (portfolioService as unknown as PortfolioServiceState).portfolios = new Map();
}

describe('Portfolio Creation Integration Tests (T046)', () => {
  beforeEach(() => {
    resetPortfolioState();
  });

  describe('Acceptance Scenario 1: Create Draft Portfolio', () => {
    it('should create a new Draft portfolio with name and description', () => {
      const portfolioId = uuidv4();
      const portfolio = portfolioService.createPortfolio(
        portfolioId,
        '60/40 Growth Portfolio',
        '60% equities, 40% bonds'
      );

      expect(portfolio).toBeDefined();
      expect(portfolio.id).toBe(portfolioId);
      expect(portfolio.name).toBe('60/40 Growth Portfolio');
      expect(portfolio.description).toBe('60% equities, 40% bonds');
      expect(portfolio.status).toBe('Draft');
      expect(portfolio.createdAt).toBeInstanceOf(Date);
    });

    it('should create multiple Draft portfolios with unique IDs', () => {
      const id1 = uuidv4();
      const id2 = uuidv4();

      const portfolio1 = portfolioService.createPortfolio(id1, 'Portfolio 1');
      const portfolio2 = portfolioService.createPortfolio(id2, 'Portfolio 2');

      expect(portfolio1.id).toBe(id1);
      expect(portfolio2.id).toBe(id2);
      expect(portfolio1.id).not.toBe(portfolio2.id);
    });

    it('should throw when creating portfolio with duplicate ID', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');

      expect(() => {
        portfolioService.createPortfolio(portfolioId, 'Another Portfolio');
      }).toThrow('already exists');
    });

    it('should retrieve created portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(
        portfolioId,
        'Test Portfolio',
        'Test Description'
      );

      const retrieved = portfolioService.getPortfolio(portfolioId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(portfolioId);
      expect(retrieved?.name).toBe('Test Portfolio');
      expect(retrieved?.status).toBe('Draft');
    });
  });

  describe('Acceptance Scenario 2: Add Asset Classes with Target Weights', () => {
    it('should add single asset class to Draft portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');

      const assetClass: AssetClass = { name: 'US Large Cap Equities', targetWeightPct: 50.0 };
      const result = portfolioService.addAssetClass(portfolioId, assetClass);

      expect(result).toBeDefined();
      expect(result.assetClasses).toHaveLength(1);
      expect(result.assetClasses[0].name).toBe('US Large Cap Equities');
      expect(result.assetClasses[0].targetWeightPct).toBe(50.0);
    });

    it('should add multiple asset classes with complementary weights', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');

      portfolioService.addAssetClass(portfolioId, {
        name: 'US Large Cap Equities',
        targetWeightPct: 60.0,
      });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 40.0 });

      const retrieved = portfolioService.getPortfolio(portfolioId);
      expect(retrieved?.assetClasses).toHaveLength(2);
      expect(retrieved?.assetClasses[0].targetWeightPct).toBe(60.0);
      expect(retrieved?.assetClasses[1].targetWeightPct).toBe(40.0);
    });

    it('should prevent duplicate asset classes in same portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');

      const assetClass: AssetClass = { name: 'US Large Cap Equities', targetWeightPct: 50.0 };
      portfolioService.addAssetClass(portfolioId, assetClass);

      expect(() => {
        portfolioService.addAssetClass(portfolioId, assetClass);
      }).toThrow('already exists');
    });

    it('should prevent adding asset class to non-Draft portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');

      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 100.0 });

      // Lock portfolio
      portfolioService.lockPortfolio(portfolioId);

      expect(() => {
        portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 50.0 });
      }).toThrow('non-Draft');
    });

    it('should update asset class weight in Draft portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, {
        name: 'US Large Cap',
        targetWeightPct: 50.0,
      });

      const result = portfolioService.updateAssetClassWeight(
        portfolioId,
        'US Large Cap',
        75.0
      );

      expect(result.assetClasses[0].targetWeightPct).toBe(75.0);
    });

    it('should remove asset class from Draft portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');

      portfolioService.addAssetClass(portfolioId, {
        name: 'US Large Cap',
        targetWeightPct: 50.0,
      });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 50.0 });

      const result = portfolioService.removeAssetClass(portfolioId, 'US Large Cap');

      expect(result.assetClasses).toHaveLength(1);
      expect(result.assetClasses[0].name).toBe('Bonds');
    });
  });

  describe('Acceptance Scenario 3: Add Tickers within Asset Classes', () => {
    it('should add single ticker to asset class', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, {
        name: 'US Large Cap',
        targetWeightPct: 100.0,
      });

      const ticker = { symbol: 'AAPL', targetWeightPctWithinAssetClass: 100.0 };
      const result = portfolioService.addTicker(portfolioId, 'US Large Cap', ticker);

      expect(result).toBeDefined();
      const portfolio = portfolioService.getPortfolio(portfolioId);
      const tickers = portfolio?.tickers.get('US Large Cap') || [];
      expect(tickers).toHaveLength(1);
      expect(tickers[0].symbol).toBe('AAPL');
    });

    it('should add multiple tickers with proportional weights', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 100.0 });

      portfolioService.addTicker(portfolioId, 'US Large Cap', {
        symbol: 'AAPL',
        targetWeightPctWithinAssetClass: 33.33,
      });
      portfolioService.addTicker(portfolioId, 'US Large Cap', {
        symbol: 'MSFT',
        targetWeightPctWithinAssetClass: 33.33,
      });
      portfolioService.addTicker(portfolioId, 'US Large Cap', {
        symbol: 'GOOGL',
        targetWeightPctWithinAssetClass: 33.34,
      });

      const portfolio = portfolioService.getPortfolio(portfolioId);
      const tickers = portfolio?.tickers.get('US Large Cap') || [];

      expect(tickers).toHaveLength(3);
      const sumWeights = tickers.reduce(
        (sum: number, t) => sum + t.targetWeightPctWithinAssetClass,
        0
      );
      expect(Math.abs(sumWeights - 100.0)).toBeLessThan(0.1);
    });

    it('should prevent duplicate tickers in same asset class', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 100.0 });

      const ticker = { symbol: 'AAPL', targetWeightPctWithinAssetClass: 50.0 };
      portfolioService.addTicker(portfolioId, 'US Large Cap', ticker);

      expect(() => {
        portfolioService.addTicker(portfolioId, 'US Large Cap', ticker);
      }).toThrow('already exists');
    });

    it('should allow same ticker in different asset classes', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 50.0 });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 50.0 });

      portfolioService.addTicker(portfolioId, 'US Large Cap', {
        symbol: 'SPY',
        targetWeightPctWithinAssetClass: 100.0,
      });

      const result = portfolioService.addTicker(portfolioId, 'Bonds', {
        symbol: 'SPY',
        targetWeightPctWithinAssetClass: 100.0,
      });

      expect(result).toBeDefined();
    });

    it('should update ticker weight within asset class', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 100.0 });
      portfolioService.addTicker(portfolioId, 'US Large Cap', {
        symbol: 'AAPL',
        targetWeightPctWithinAssetClass: 50.0,
      });

      const result = portfolioService.updateTickerWeight(
        portfolioId,
        'US Large Cap',
        'AAPL',
        75.0
      );

      expect(result).toBeDefined();
      const portfolio = portfolioService.getPortfolio(portfolioId);
      const ticker = portfolio?.tickers.get('US Large Cap')?.[0];
      expect(ticker?.targetWeightPctWithinAssetClass).toBe(75.0);
    });

    it('should remove ticker from asset class', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 100.0 });
      portfolioService.addTicker(portfolioId, 'US Large Cap', {
        symbol: 'AAPL',
        targetWeightPctWithinAssetClass: 100.0,
      });

      const result = portfolioService.removeTicker(portfolioId, 'US Large Cap', 'AAPL');

      expect(result).toBeDefined();
      const portfolio = portfolioService.getPortfolio(portfolioId);
      const tickers = portfolio?.tickers.get('US Large Cap') || [];
      expect(tickers).toHaveLength(0);
    });
  });

  describe('Acceptance Scenario 4: Validate Portfolio Weights', () => {
    it('should validate portfolio with correct total weight (100%)', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 60.0 });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 40.0 });

      const result = portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept weights within ±1% tolerance', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 50.1 });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 49.1 });

      const result = portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(result.success).toBe(true);
    });

    it('should reject portfolio with total weight below acceptable range', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 60.0 });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 38.5 });

      const result = portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject portfolio with total weight above acceptable range', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 60.0 });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 41.5 });

      const result = portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject portfolio with empty asset classes', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');

      const result = portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(result.success).toBe(false);
    });
  });

  describe('Acceptance Scenario 5: Transition from Draft to Valid', () => {
    it('should transition Draft to Valid on successful validation', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 60.0 });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 40.0 });

      const result = portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(result.success).toBe(true);

      const portfolio = portfolioService.getPortfolio(portfolioId);
      expect(portfolio?.status).toBe('Valid');
    });

    it('should prevent editing portfolio after transition to Valid', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 100.0 });
      portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(() => {
        portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 50.0 });
      }).toThrow('non-Draft');
    });

    it('should prevent re-validation of Valid portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, { name: 'US Large Cap', targetWeightPct: 100.0 });
      portfolioService.validatePortfolioAndTransition(portfolioId);

      const result = portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('Draft'))).toBe(true);
    });
  });

  describe('Acceptance Scenario 6: Clone Locked Portfolio to Draft', () => {
    it('should clone Locked portfolio to new Draft with same structure', () => {
      const originalId = uuidv4();
      const cloneId = uuidv4();

      portfolioService.createPortfolio(originalId, 'Original Portfolio');
      portfolioService.addAssetClass(originalId, { name: 'US Large Cap', targetWeightPct: 60.0 });
      portfolioService.addAssetClass(originalId, { name: 'Bonds', targetWeightPct: 40.0 });
      portfolioService.addTicker(originalId, 'US Large Cap', {
        symbol: 'AAPL',
        targetWeightPctWithinAssetClass: 100.0,
      });

      portfolioService.validatePortfolioAndTransition(originalId);
      portfolioService.lockPortfolio(originalId);

      const cloned = portfolioService.clonePortfolio(originalId, cloneId, 'Cloned Portfolio');

      expect(cloned.id).toBe(cloneId);
      expect(cloned.name).toBe('Cloned Portfolio');
      expect(cloned.status).toBe('Draft');
      expect(cloned.assetClasses).toHaveLength(2);
    });

    it('should preserve asset class and ticker structure in clone', () => {
      const originalId = uuidv4();
      const cloneId = uuidv4();

      portfolioService.createPortfolio(originalId, 'Original Portfolio');
      portfolioService.addAssetClass(originalId, { name: 'US Large Cap', targetWeightPct: 100.0 });
      portfolioService.addTicker(originalId, 'US Large Cap', {
        symbol: 'AAPL',
        targetWeightPctWithinAssetClass: 33.33,
      });
      portfolioService.addTicker(originalId, 'US Large Cap', {
        symbol: 'MSFT',
        targetWeightPctWithinAssetClass: 33.33,
      });
      portfolioService.addTicker(originalId, 'US Large Cap', {
        symbol: 'GOOGL',
        targetWeightPctWithinAssetClass: 33.34,
      });

      portfolioService.validatePortfolioAndTransition(originalId);
      portfolioService.lockPortfolio(originalId);

      const cloned = portfolioService.clonePortfolio(originalId, cloneId, 'Cloned Portfolio');

      expect(cloned.assetClasses).toHaveLength(1);

      const clonedTickers = cloned.tickers.get('US Large Cap') || [];
      expect(clonedTickers).toHaveLength(3);
      expect(clonedTickers[0].symbol).toBe('AAPL');
      expect(clonedTickers[1].symbol).toBe('MSFT');
      expect(clonedTickers[2].symbol).toBe('GOOGL');
    });

    it('should not modify original portfolio when cloning', () => {
      const originalId = uuidv4();
      const cloneId = uuidv4();

      portfolioService.createPortfolio(originalId, 'Original Portfolio');
      portfolioService.addAssetClass(originalId, { name: 'US Large Cap', targetWeightPct: 100.0 });
      portfolioService.validatePortfolioAndTransition(originalId);
      portfolioService.lockPortfolio(originalId);

      const originalBefore = portfolioService.getPortfolio(originalId);

      portfolioService.clonePortfolio(originalId, cloneId, 'Cloned Portfolio');

      const originalAfter = portfolioService.getPortfolio(originalId);

      expect(originalAfter?.status).toBe(originalBefore?.status);
      expect(originalAfter?.name).toBe(originalBefore?.name);
    });
  });

  describe('Complete Workflow: Draft → Valid → Locked → Clone', () => {
    it('should complete full portfolio creation workflow', () => {
      // 1. Create Draft portfolio
      const portfolioId = uuidv4();
      const portfolio = portfolioService.createPortfolio(
        portfolioId,
        'Complete Test Portfolio',
        'Test workflow from Draft to Locked to Cloned'
      );

      expect(portfolio.status).toBe('Draft');

      // 2. Add asset classes
      portfolioService.addAssetClass(portfolioId, {
        name: 'US Large Cap',
        targetWeightPct: 60.0,
      });
      portfolioService.addAssetClass(portfolioId, { name: 'Bonds', targetWeightPct: 40.0 });

      // 3. Add tickers
      portfolioService.addTicker(portfolioId, 'US Large Cap', {
        symbol: 'AAPL',
        targetWeightPctWithinAssetClass: 50.0,
      });
      portfolioService.addTicker(portfolioId, 'US Large Cap', {
        symbol: 'MSFT',
        targetWeightPctWithinAssetClass: 50.0,
      });

      // 4. Validate
      const validated = portfolioService.validatePortfolioAndTransition(portfolioId);
      expect(validated.success).toBe(true);

      const validPortfolio = portfolioService.getPortfolio(portfolioId);
      expect(validPortfolio?.status).toBe('Valid');

      // 5. Lock
      const lockResult = portfolioService.lockPortfolio(portfolioId);
      expect(lockResult.success).toBe(true);

      const lockedPortfolio = portfolioService.getPortfolio(portfolioId);
      expect(lockedPortfolio?.status).toBe('Locked');

      // 6. Clone
      const cloneId = uuidv4();
      const cloned = portfolioService.clonePortfolio(portfolioId, cloneId, 'Cloned Portfolio');

      expect(cloned.status).toBe('Draft');
      expect(cloned.assetClasses).toHaveLength(2);

      // 7. Verify both portfolios exist
      const allPortfolios = portfolioService.listPortfolios();
      expect(allPortfolios).toHaveLength(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent portfolio gracefully', () => {
      const fakeId = uuidv4();
      const result = portfolioService.getPortfolio(fakeId);

      expect(result).toBeNull();
    });

    it('should list portfolios with multiple entries', () => {
      for (let i = 0; i < 5; i++) {
        portfolioService.createPortfolio(uuidv4(), `Portfolio ${i + 1}`);
      }

      const portfolios = portfolioService.listPortfolios();

      expect(portfolios).toHaveLength(5);
    });

    it('should delete Draft portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');

      const deleted = portfolioService.deletePortfolio(portfolioId);

      expect(deleted).toBe(true);
      expect(portfolioService.getPortfolio(portfolioId)).toBeNull();
    });

    it('should prevent deletion of non-Draft portfolio', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, {
        name: 'US Large Cap',
        targetWeightPct: 100.0,
      });
      portfolioService.validatePortfolioAndTransition(portfolioId);

      expect(() => {
        portfolioService.deletePortfolio(portfolioId);
      }).toThrow('Draft');
    });

    it('should update portfolio name and description', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Original Name', 'Original Description');

      const updated = portfolioService.updatePortfolio(portfolioId, {
        name: 'Updated Name',
        description: 'Updated Description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated Description');
    });

    it('should revert portfolio from Valid to Draft', () => {
      const portfolioId = uuidv4();
      portfolioService.createPortfolio(portfolioId, 'Test Portfolio');
      portfolioService.addAssetClass(portfolioId, {
        name: 'US Large Cap',
        targetWeightPct: 100.0,
      });
      portfolioService.validatePortfolioAndTransition(portfolioId);

      const revertResult = portfolioService.revertPortfolioToDraft(portfolioId);

      expect(revertResult.success).toBe(true);

      const portfolio = portfolioService.getPortfolio(portfolioId);
      expect(portfolio?.status).toBe('Draft');
    });
  });
});

/**
 * Portfolio Service
 * 
 * Manages model portfolio lifecycle:
 * - CRUD operations (Create, Read, Update, Delete)
 * - State transitions (Draft → Valid → Locked)
 * - Portfolio cloning (Locked → Draft clone)
 * - Weight validation integration
 * 
 * Per FR-004: Portfolio Creation & Editing
 * Per FR-005: Weight Validation
 */

import {
  validatePortfolio,
  validatePortfolioCanTransitionToValid,
} from './portfolio-validation.service';

export type PortfolioStatus = 'Draft' | 'Valid' | 'Locked';

export interface AssetClass {
  name: string;
  targetWeightPct: number;
}

export interface Ticker {
  symbol: string;
  targetWeightPctWithinAssetClass: number;
}

export interface ModelPortfolio {
  id: string;
  name: string;
  description?: string;
  status: PortfolioStatus;
  clonedFromModelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioWithAssets extends ModelPortfolio {
  assetClasses: AssetClass[];
  tickers: Map<string, Ticker[]>; // assetClassName -> tickers
}

/**
 * Portfolio Service - handles all portfolio operations
 */
export class PortfolioService {
  private portfolios = new Map<string, PortfolioWithAssets>();

  /**
   * Create a new Draft portfolio
   */
  createPortfolio(id: string, name: string, description?: string): ModelPortfolio {
    if (this.portfolios.has(id)) {
      throw new Error(`Portfolio with ID ${id} already exists`);
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Portfolio name cannot be empty');
    }

    const now = new Date();
    const portfolio: PortfolioWithAssets = {
      id,
      name,
      description,
      status: 'Draft',
      createdAt: now,
      updatedAt: now,
      assetClasses: [],
      tickers: new Map(),
    };

    this.portfolios.set(id, portfolio);
    return this.modelPortfolioFromFull(portfolio);
  }

  /**
   * Get portfolio by ID
   */
  getPortfolio(id: string): PortfolioWithAssets | null {
    return this.portfolios.get(id) || null;
  }

  /**
   * Get portfolio (basic info only)
   */
  getPortfolioInfo(id: string): ModelPortfolio | null {
    const full = this.portfolios.get(id);
    return full ? this.modelPortfolioFromFull(full) : null;
  }

  /**
   * List all portfolios
   */
  listPortfolios(): ModelPortfolio[] {
    return Array.from(this.portfolios.values()).map((p) => this.modelPortfolioFromFull(p));
  }

  /**
   * Update portfolio name/description (only in Draft state)
   */
  updatePortfolio(id: string, updates: { name?: string; description?: string }): ModelPortfolio {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (portfolio.status !== 'Draft') {
      throw new Error(
        `Cannot edit portfolio in ${portfolio.status} state. Only Draft portfolios can be edited. Clone a Locked portfolio instead.`
      );
    }

    if (updates.name && updates.name.trim().length === 0) {
      throw new Error('Portfolio name cannot be empty');
    }

    if (updates.name) {
      portfolio.name = updates.name;
    }
    if (updates.description !== undefined) {
      portfolio.description = updates.description;
    }
    portfolio.updatedAt = new Date();

    return this.modelPortfolioFromFull(portfolio);
  }

  /**
   * Delete portfolio
   * Only Draft portfolios can be deleted; Valid/Locked require special handling
   */
  deletePortfolio(id: string): boolean {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      return false;
    }

    if (portfolio.status !== 'Draft') {
      throw new Error(
        `Cannot delete ${portfolio.status} portfolio. Only Draft portfolios can be deleted.`
      );
    }

    return this.portfolios.delete(id);
  }

  /**
   * Add asset class to portfolio (Draft only)
   */
  addAssetClass(id: string, assetClass: AssetClass): ModelPortfolio {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (portfolio.status !== 'Draft') {
      throw new Error(`Cannot add asset class to ${portfolio.status} portfolio`);
    }

    // Check if asset class already exists
    if (portfolio.assetClasses.some((ac) => ac.name === assetClass.name)) {
      throw new Error(`Asset class "${assetClass.name}" already exists in this portfolio`);
    }

    portfolio.assetClasses.push(assetClass);
    portfolio.updatedAt = new Date();

    return this.modelPortfolioFromFull(portfolio);
  }

  /**
   * Remove asset class from portfolio (Draft only)
   */
  removeAssetClass(id: string, assetClassName: string): ModelPortfolio {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (portfolio.status !== 'Draft') {
      throw new Error(`Cannot remove asset class from ${portfolio.status} portfolio`);
    }

    const index = portfolio.assetClasses.findIndex((ac) => ac.name === assetClassName);
    if (index === -1) {
      throw new Error(`Asset class "${assetClassName}" not found`);
    }

    portfolio.assetClasses.splice(index, 1);
    portfolio.tickers.delete(assetClassName);
    portfolio.updatedAt = new Date();

    return this.modelPortfolioFromFull(portfolio);
  }

  /**
   * Update asset class weight (Draft only)
   */
  updateAssetClassWeight(id: string, assetClassName: string, newWeight: number): ModelPortfolio {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (portfolio.status !== 'Draft') {
      throw new Error(`Cannot update weights in ${portfolio.status} portfolio`);
    }

    const assetClass = portfolio.assetClasses.find((ac) => ac.name === assetClassName);
    if (!assetClass) {
      throw new Error(`Asset class "${assetClassName}" not found`);
    }

    if (newWeight < 0 || newWeight > 100) {
      throw new Error('Weight must be between 0 and 100');
    }

    assetClass.targetWeightPct = newWeight;
    portfolio.updatedAt = new Date();

    return this.modelPortfolioFromFull(portfolio);
  }

  /**
   * Add ticker to asset class (Draft only)
   */
  addTicker(id: string, assetClassName: string, ticker: Ticker): ModelPortfolio {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (portfolio.status !== 'Draft') {
      throw new Error(`Cannot add ticker to ${portfolio.status} portfolio`);
    }

    const assetClass = portfolio.assetClasses.find((ac) => ac.name === assetClassName);
    if (!assetClass) {
      throw new Error(`Asset class "${assetClassName}" not found`);
    }

    if (!portfolio.tickers.has(assetClassName)) {
      portfolio.tickers.set(assetClassName, []);
    }

    const tickers = portfolio.tickers.get(assetClassName)!;
    if (tickers.some((t) => t.symbol === ticker.symbol)) {
      throw new Error(`Ticker ${ticker.symbol} already exists in ${assetClassName}`);
    }

    tickers.push(ticker);
    portfolio.updatedAt = new Date();

    return this.modelPortfolioFromFull(portfolio);
  }

  /**
   * Remove ticker from asset class (Draft only)
   */
  removeTicker(id: string, assetClassName: string, symbol: string): ModelPortfolio {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (portfolio.status !== 'Draft') {
      throw new Error(`Cannot remove ticker from ${portfolio.status} portfolio`);
    }

    const tickers = portfolio.tickers.get(assetClassName);
    if (!tickers) {
      throw new Error(`Asset class "${assetClassName}" not found`);
    }

    const index = tickers.findIndex((t) => t.symbol === symbol);
    if (index === -1) {
      throw new Error(`Ticker ${symbol} not found in ${assetClassName}`);
    }

    tickers.splice(index, 1);
    portfolio.updatedAt = new Date();

    return this.modelPortfolioFromFull(portfolio);
  }

  /**
   * Update ticker weight (Draft only)
   */
  updateTickerWeight(
    id: string,
    assetClassName: string,
    symbol: string,
    newWeight: number
  ): ModelPortfolio {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (portfolio.status !== 'Draft') {
      throw new Error(`Cannot update weights in ${portfolio.status} portfolio`);
    }

    const tickers = portfolio.tickers.get(assetClassName);
    if (!tickers) {
      throw new Error(`Asset class "${assetClassName}" not found`);
    }

    const ticker = tickers.find((t) => t.symbol === symbol);
    if (!ticker) {
      throw new Error(`Ticker ${symbol} not found in ${assetClassName}`);
    }

    if (newWeight < 0 || newWeight > 100) {
      throw new Error('Weight must be between 0 and 100');
    }

    ticker.targetWeightPctWithinAssetClass = newWeight;
    portfolio.updatedAt = new Date();

    return this.modelPortfolioFromFull(portfolio);
  }

  /**
   * Validate portfolio and transition from Draft to Valid
   */
  validatePortfolioAndTransition(id: string): { success: boolean; errors: string[] } {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (portfolio.status !== 'Draft') {
      return {
        success: false,
        errors: [`Cannot validate ${portfolio.status} portfolio. Only Draft can transition to Valid.`],
      };
    }

    const { canTransition, errors } = validatePortfolioCanTransitionToValid(
      portfolio.assetClasses,
      portfolio.tickers
    );

    if (canTransition) {
      portfolio.status = 'Valid';
      portfolio.updatedAt = new Date();
      return { success: true, errors: [] };
    }

    return { success: false, errors };
  }

  /**
   * Transition portfolio from Valid to Draft (for corrections)
   */
  revertPortfolioToDraft(id: string): { success: boolean; error?: string } {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      return { success: false, error: `Portfolio ${id} not found` };
    }

    if (portfolio.status !== 'Valid') {
      return {
        success: false,
        error: `Cannot revert ${portfolio.status} portfolio to Draft. Only Valid can revert.`,
      };
    }

    portfolio.status = 'Draft';
    portfolio.updatedAt = new Date();
    return { success: true };
  }

  /**
   * Transition portfolio from Valid to Locked (automatic on account assignment)
   */
  lockPortfolio(id: string): { success: boolean; error?: string } {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      return { success: false, error: `Portfolio ${id} not found` };
    }

    if (portfolio.status !== 'Valid') {
      return {
        success: false,
        error: `Cannot lock ${portfolio.status} portfolio. Only Valid portfolios can be locked.`,
      };
    }

    portfolio.status = 'Locked';
    portfolio.updatedAt = new Date();
    return { success: true };
  }

  /**
   * Clone a Locked portfolio to new Draft
   */
  clonePortfolio(id: string, newId: string, newName: string): ModelPortfolio {
    const original = this.portfolios.get(id);
    if (!original) {
      throw new Error(`Portfolio ${id} not found`);
    }

    if (original.status !== 'Locked') {
      throw new Error(
        `Cannot clone ${original.status} portfolio. Only Locked portfolios can be cloned.`
      );
    }

    if (this.portfolios.has(newId)) {
      throw new Error(`Portfolio with ID ${newId} already exists`);
    }

    const now = new Date();
    const cloned: PortfolioWithAssets = {
      id: newId,
      name: newName,
      description: original.description,
      status: 'Draft',
      clonedFromModelId: original.id,
      createdAt: now,
      updatedAt: now,
      assetClasses: original.assetClasses.map((ac) => ({ ...ac })),
      tickers: new Map(
        Array.from(original.tickers.entries()).map(([key, tickers]) => [
          key,
          tickers.map((t) => ({ ...t })),
        ])
      ),
    };

    this.portfolios.set(newId, cloned);
    return this.modelPortfolioFromFull(cloned);
  }

  /**
   * Validate portfolio weights without transitioning
   */
  validatePortfolioWeights(id: string): { valid: boolean; errors: string[] } {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) {
      throw new Error(`Portfolio ${id} not found`);
    }

    const result = validatePortfolio(portfolio.assetClasses, portfolio.tickers);
    return {
      valid: result.valid,
      errors: result.errors,
    };
  }

  /**
   * Get portfolio with all details
   */
  getPortfolioFull(id: string): PortfolioWithAssets | null {
    return this.portfolios.get(id) || null;
  }

  /**
   * Helper: extract basic portfolio info from full portfolio
   */
  private modelPortfolioFromFull(full: PortfolioWithAssets): ModelPortfolio {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { assetClasses, tickers, ...basic } = full;
    return basic;
  }
}

/**
 * Export default singleton instance
 */
export const portfolioService = new PortfolioService();

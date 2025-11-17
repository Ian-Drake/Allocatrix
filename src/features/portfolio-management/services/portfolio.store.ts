/**
 * Portfolio Store - Zustand state management
 *
 * Manages portfolio state for the frontend:
 * - Portfolio list
 * - Current portfolio being edited
 * - Validation errors and UI state
 * - Loading states
 */

import { create } from 'zustand';

export type PortfolioStatus = 'Draft' | 'Valid' | 'Locked';

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  status: PortfolioStatus;
  createdAt: Date;
  updatedAt: Date;
  clonedFromModelId?: string;
}

export interface AssetClass {
  id: string;
  name: string;
  targetWeightPct: number;
}

export interface Ticker {
  id: string;
  symbol: string;
  displayName?: string;
  targetWeightPctWithinAssetClass: number;
}

export interface PortfolioDetail extends Portfolio {
  assetClasses: (AssetClass & {
    tickers: Ticker[];
  })[];
}

export interface ValidationError {
  field: string;
  error: string;
}

export interface PortfolioStoreState {
  // Portfolio List
  portfolios: Portfolio[];
  isLoadingList: boolean;

  // Current Portfolio Being Edited
  currentPortfolio: PortfolioDetail | null;
  isLoadingCurrent: boolean;

  // Editing State
  isEditing: boolean;
  isDirty: boolean;

  // Validation
  validationErrors: ValidationError[];
  isValidating: boolean;

  // UI Actions
  setPortfolios: (portfolios: Portfolio[]) => void;
  setCurrentPortfolio: (portfolio: PortfolioDetail | null) => void;
  setIsEditing: (isEditing: boolean) => void;
  setIsDirty: (isDirty: boolean) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  setIsLoadingList: (loading: boolean) => void;
  setIsLoadingCurrent: (loading: boolean) => void;
  setIsValidating: (validating: boolean) => void;

  // Portfolio Operations
  addPortfolioToList: (portfolio: Portfolio) => void;
  updatePortfolioInList: (portfolio: Portfolio) => void;
  removePortfolioFromList: (id: string) => void;

  // Asset Class Operations
  addAssetClass: (assetClass: AssetClass) => void;
  updateAssetClass: (assetClass: AssetClass) => void;
  removeAssetClass: (assetClassId: string) => void;
  updateAssetClassWeight: (assetClassId: string, weight: number) => void;

  // Ticker Operations
  addTicker: (assetClassId: string, ticker: Ticker) => void;
  updateTicker: (assetClassId: string, ticker: Ticker) => void;
  removeTicker: (assetClassId: string, tickerId: string) => void;
  updateTickerWeight: (
    assetClassId: string,
    tickerId: string,
    weight: number
  ) => void;

  // State Transitions
  transitionToValid: () => void;
  transitionToLocked: () => void;
  revertToDraft: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  portfolios: [],
  isLoadingList: false,
  currentPortfolio: null,
  isLoadingCurrent: false,
  isEditing: false,
  isDirty: false,
  validationErrors: [],
  isValidating: false,
};

export const usePortfolioStore = create<PortfolioStoreState>((set) => ({
  ...initialState,

  // Setters
  setPortfolios: (portfolios) => set({ portfolios }),
  setCurrentPortfolio: (portfolio) => set({ currentPortfolio: portfolio }),
  setIsEditing: (isEditing) => set({ isEditing }),
  setIsDirty: (isDirty) => set({ isDirty }),
  setValidationErrors: (errors) => set({ validationErrors: errors }),
  setIsLoadingList: (loading) => set({ isLoadingList: loading }),
  setIsLoadingCurrent: (loading) => set({ isLoadingCurrent: loading }),
  setIsValidating: (validating) => set({ isValidating: validating }),

  // Portfolio list operations
  addPortfolioToList: (portfolio) =>
    set((state) => ({
      portfolios: [...state.portfolios, portfolio],
    })),

  updatePortfolioInList: (portfolio) =>
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolio.id ? portfolio : p
      ),
    })),

  removePortfolioFromList: (id) =>
    set((state) => ({
      portfolios: state.portfolios.filter((p) => p.id !== id),
    })),

  // Asset class operations
  addAssetClass: (assetClass) =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          assetClasses: [
            ...state.currentPortfolio.assetClasses,
            { ...assetClass, tickers: [] },
          ],
        },
        isDirty: true,
      };
    }),

  updateAssetClass: (assetClass) =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          assetClasses: state.currentPortfolio.assetClasses.map((ac) =>
            ac.id === assetClass.id ? { ...ac, ...assetClass } : ac
          ),
        },
        isDirty: true,
      };
    }),

  removeAssetClass: (assetClassId) =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          assetClasses: state.currentPortfolio.assetClasses.filter(
            (ac) => ac.id !== assetClassId
          ),
        },
        isDirty: true,
      };
    }),

  updateAssetClassWeight: (assetClassId, weight) =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          assetClasses: state.currentPortfolio.assetClasses.map((ac) =>
            ac.id === assetClassId
              ? { ...ac, targetWeightPct: weight }
              : ac
          ),
        },
        isDirty: true,
      };
    }),

  // Ticker operations
  addTicker: (assetClassId, ticker) =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          assetClasses: state.currentPortfolio.assetClasses.map((ac) =>
            ac.id === assetClassId
              ? { ...ac, tickers: [...ac.tickers, ticker] }
              : ac
          ),
        },
        isDirty: true,
      };
    }),

  updateTicker: (assetClassId, ticker) =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          assetClasses: state.currentPortfolio.assetClasses.map((ac) =>
            ac.id === assetClassId
              ? {
                  ...ac,
                  tickers: ac.tickers.map((t) =>
                    t.id === ticker.id ? ticker : t
                  ),
                }
              : ac
          ),
        },
        isDirty: true,
      };
    }),

  removeTicker: (assetClassId, tickerId) =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          assetClasses: state.currentPortfolio.assetClasses.map((ac) =>
            ac.id === assetClassId
              ? {
                  ...ac,
                  tickers: ac.tickers.filter((t) => t.id !== tickerId),
                }
              : ac
          ),
        },
        isDirty: true,
      };
    }),

  updateTickerWeight: (assetClassId, tickerId, weight) =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          assetClasses: state.currentPortfolio.assetClasses.map((ac) =>
            ac.id === assetClassId
              ? {
                  ...ac,
                  tickers: ac.tickers.map((t) =>
                    t.id === tickerId
                      ? {
                          ...t,
                          targetWeightPctWithinAssetClass: weight,
                        }
                      : t
                  ),
                }
              : ac
          ),
        },
        isDirty: true,
      };
    }),

  // State transitions
  transitionToValid: () =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          status: 'Valid',
        },
      };
    }),

  transitionToLocked: () =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          status: 'Locked',
        },
      };
    }),

  revertToDraft: () =>
    set((state) => {
      if (!state.currentPortfolio) return state;

      return {
        currentPortfolio: {
          ...state.currentPortfolio,
          status: 'Draft',
        },
      };
    }),

  // Reset
  reset: () => set(initialState),
}));

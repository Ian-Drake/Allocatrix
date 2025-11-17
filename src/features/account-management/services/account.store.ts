import { create } from 'zustand';
import type { Account } from '@/backend/types/index';

/**
 * Account Store
 * Manages account list and selection state using Zustand
 * 
 * User Story 3: Account Model Assignment
 * Stores:
 * - List of all linked accounts
 * - Currently selected account
 * - Account loading state
 */

interface AccountStoreState {
  accounts: Account[];
  selectedAccountId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAccounts: (accounts: Account[]) => void;
  setSelectedAccountId: (accountId: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateAccount: (account: Account) => void;
  addAccount: (account: Account) => void;
  resetStore: () => void;
}

const initialState = {
  accounts: [],
  selectedAccountId: null,
  isLoading: false,
  error: null,
};

export const useAccountStore = create<AccountStoreState>((set) => ({
  ...initialState,

  setAccounts: (accounts: Account[]) => set({ accounts }),

  setSelectedAccountId: (accountId: string | null) => set({ selectedAccountId: accountId }),

  setIsLoading: (loading: boolean) => set({ isLoading: loading }),

  setError: (error: string | null) => set({ error }),

  /**
   * Update existing account in the store
   */
  updateAccount: (account: Account) =>
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === account.id ? account : a)),
    })),

  /**
   * Add new account to the store
   */
  addAccount: (account: Account) =>
    set((state) => ({
      accounts: [...state.accounts, account],
    })),

  /**
   * Reset store to initial state
   */
  resetStore: () => set(initialState),
}));

/**
 * Selector: Get currently selected account
 */
export const selectedAccount = (state: AccountStoreState) =>
  state.selectedAccountId ? state.accounts.find((a) => a.id === state.selectedAccountId) : null;

/**
 * Selector: Get accounts with assigned models
 */
export const accountsWithModels = (state: AccountStoreState) =>
  state.accounts.filter((a) => a.assignedModelPortfolioId);

/**
 * Selector: Get accounts without assigned models
 */
export const accountsWithoutModels = (state: AccountStoreState) =>
  state.accounts.filter((a) => !a.assignedModelPortfolioId);
